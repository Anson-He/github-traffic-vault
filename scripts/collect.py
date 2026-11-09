"""GitHub official REST API collector. Python standard library only."""
import csv
import gzip
import io
import json
import os
from pathlib import Path
import sys
import time
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
API_VERSION = "2026-03-10"


class API:
    def __init__(self, token):
        self.token = token

    def get(self, path):
        req = Request("https://api.github.com" + path, headers={
            "Accept": "application/vnd.github+json", "Authorization": "Bearer " + self.token,
            "X-GitHub-Api-Version": API_VERSION, "User-Agent": "github-traffic-vault"})
        for attempt in range(3):
            try:
                with urlopen(req, timeout=45) as response:
                    return json.load(response)
            except HTTPError as error:
                if error.code >= 500 and attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                raise RuntimeError(f"GitHub HTTP {error.code}: {path.split('?')[0]}") from None
            except (URLError, TimeoutError):
                if attempt == 2:
                    raise RuntimeError(f"Network failure: {path.split('?')[0]}") from None
                time.sleep(2 ** attempt)

    def pages(self, path):
        items = []
        page = 1
        while True:
            sep = "&" if "?" in path else "?"
            batch = self.get(path + sep + urlencode({"per_page": 100, "page": page}))
            if not isinstance(batch, list):
                raise RuntimeError("Expected a paginated array")
            items.extend(batch)
            if len(batch) < 100:
                return items
            page += 1


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")
    temp.replace(path)


def merge_daily(previous, response, key, collected_at):
    """Overlap is replaced by date; data outside the API window is retained."""
    rows = {row["date"]: row for row in previous}
    for item in response[key]:
        day = item["timestamp"][:10]
        rows[day] = {"date": day, "count": item["count"], "uniques": item["uniques"],
                     "observed_at": collected_at}
    return [rows[day] for day in sorted(rows)]


def release_assets(api, base):
    releases = api.pages(base + "/releases")
    assets = []
    for release in releases:
        # Explicit pagination avoids truncating releases with many attached files.
        for asset in api.pages(base + f"/releases/{release['id']}/assets"):
            assets.append({"id": asset["id"], "name": asset["name"],
                           "release": release["tag_name"], "release_id": release["id"],
                           "download_count": asset["download_count"], "size": asset["size"],
                           "created_at": asset["created_at"], "updated_at": asset["updated_at"]})
    return assets


def collect_repo(api, repo, previous, collected_at):
    name = repo["full_name"]
    base = "/repos/" + name
    state = dict(previous or {})
    state.update({"id": repo["id"], "name": name, "url": repo["html_url"],
                  "private": repo["private"], "archived": repo["archived"],
                  "description": repo.get("description"), "last_attempt_at": collected_at})
    raw = {"collected_at": collected_at, "repository": repo}
    errors = {}
    status = {}
    for key, suffix in [("views", "/traffic/views?per=day"),
                        ("clones", "/traffic/clones?per=day"),
                        ("referrers", "/traffic/popular/referrers"),
                        ("paths", "/traffic/popular/paths"),
                        ("languages", "/languages"), ("assets", None)]:
        try:
            value = release_assets(api, base) if key == "assets" else api.get(base + suffix)
            raw[key] = value
            status[key] = {"ok": True, "observed_at": collected_at}
            if key in ("views", "clones"):
                state[key] = merge_daily(state.get(key, []), value, key, collected_at)
                state[key + "_window"] = {"count": value["count"], "uniques": value["uniques"],
                                          "observed_at": collected_at, "window_days": 14}
            else:
                state[key] = value
        except (RuntimeError, KeyError, TypeError, ValueError) as error:
            errors[key] = str(error)
            # Retain last good values and timestamp; failed reads never become zero.
            old = state.get("status", {}).get(key, {})
            status[key] = {**old, "ok": False, "error": str(error)}
    state["status"] = status
    daily = {"date": collected_at[:10], "observed_at": collected_at,
             "stars": repo["stargazers_count"], "forks": repo["forks_count"],
             "open_issues_and_prs": repo["open_issues_count"], "size_kb": repo["size"],
             "pushed_at": repo.get("pushed_at")}
    # Only a fully read asset list can establish a download snapshot.
    if "assets" in raw:
        daily["downloads"] = sum(a["download_count"] for a in raw["assets"])
        daily["asset_counts"] = {str(a["id"]): a["download_count"] for a in raw["assets"]}
    snapshots = {r["date"]: r for r in state.get("snapshots", [])}
    snapshots[daily["date"]] = daily
    state["snapshots"] = [snapshots[d] for d in sorted(snapshots)]
    raw["errors"] = errors
    if not errors:
        state["last_success_at"] = collected_at
    return state, raw, errors


def export_csv(data, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as output:
        writer = csv.writer(output)
        writer.writerow(["repository", "date_utc", "views", "daily_unique_visitors", "clones", "daily_unique_cloners"])
        for repo in data["repositories"]:
            views = {r["date"]: r for r in repo.get("views", [])}
            clones = {r["date"]: r for r in repo.get("clones", [])}
            for day in sorted(views.keys() | clones.keys()):
                v, c = views.get(day, {}), clones.get(day, {})
                writer.writerow([repo["name"], day, v.get("count", ""), v.get("uniques", ""),
                                 c.get("count", ""), c.get("uniques", "")])


def main():
    token = os.environ.get("TRAFFIC_TOKEN")
    if not token:
        print("Missing TRAFFIC_TOKEN. Add a fine-grained PAT in Actions secrets; see README.", file=sys.stderr)
        return 1
    config = json.loads((ROOT / "config.json").read_text())
    path = ROOT / "data/dashboard.json"
    old = json.loads(path.read_text()) if path.exists() else {"repositories": []}
    by_id = {str(r["id"]): r for r in old["repositories"]}
    collected_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    api = API(token)
    try:
        repos = api.pages("/user/repos?affiliation=owner&sort=full_name")
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 1
    errors = []
    seen = set()
    for repo in repos:
        name = repo["full_name"]
        if repo["owner"]["login"].lower() != config["owner"].lower() or name in config["exclude"]:
            continue
        if repo["archived"] and not config["include_archived"]:
            continue
        seen.add(str(repo["id"]))
        state, raw, failures = collect_repo(api, repo, by_id.get(str(repo["id"])), collected_at)
        state["discovered_in_latest_run"] = True
        by_id[str(repo["id"])] = state
        stamp = collected_at.replace(":", "-")
        archive = ROOT / "data/raw" / str(repo["id"]) / collected_at[:10] / (stamp + ".json.gz")
        archive.parent.mkdir(parents=True, exist_ok=True)
        with gzip.open(archive, "wt", encoding="utf-8") as out:
            json.dump(raw, out, ensure_ascii=False, separators=(",", ":"))
        errors.extend({"repository": name, "source": key, "error": message} for key, message in failures.items())
        print(f"{name}: {len(failures)} source error(s)")
    # Previously collected repositories are retained when access changes/deletions occur.
    for rid, repo in by_id.items():
        if rid not in seen:
            repo["discovered_in_latest_run"] = False
            errors.append({"repository": repo["name"], "source": "discovery", "error": "Not returned by current token; retained history"})
    result = {"schema_version": 1, "owner": config["owner"], "vault": config["repository"],
              "generated_at": collected_at, "timezone": "UTC", "errors": errors,
              "repositories": sorted(by_id.values(), key=lambda r: r["name"].lower())}
    write_json(path, result)
    write_json(ROOT / "data/runs" / (collected_at.replace(":", "-") + ".json"),
               {"collected_at": collected_at, "discovered": len(seen), "errors": errors})
    export_csv(result, ROOT / "data/traffic.csv")
    # Persist partial results first, then make the run visibly fail.
    return 1 if errors or not seen else 0


if __name__ == "__main__":
    sys.exit(main())
