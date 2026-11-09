import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("collector", Path(__file__).resolve().parents[1] / "scripts/collect.py")
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


class Tests(unittest.TestCase):
    def test_overlap_updates_not_adds_and_retains_history(self):
        old = [{"date": "2026-01-01", "count": 5, "uniques": 2}, {"date": "2026-01-20", "count": 1, "uniques": 1}]
        response = {"views": [{"timestamp": "2026-01-20T00:00:00Z", "count": 9, "uniques": 3}]}
        rows = c.merge_daily(old, response, "views", "2026-01-21T00:00:00Z")
        self.assertEqual([r["count"] for r in rows], [5, 9])

    def test_partial_failure_preserves_last_good_data(self):
        class BrokenAPI:
            def get(self, path):
                raise RuntimeError("GitHub HTTP 403")
            def pages(self, path):
                raise RuntimeError("GitHub HTTP 403")
        repo = {"id": 1, "full_name": "a/b", "html_url": "https://github.com/a/b", "private": True,
                "archived": False, "stargazers_count": 2, "forks_count": 1, "open_issues_count": 0, "size": 1}
        previous = {"views": [{"date": "2026-01-01", "count": 7, "uniques": 2}],
                    "status": {"views": {"ok": True, "observed_at": "old"}}}
        state, raw, errors = c.collect_repo(BrokenAPI(), repo, previous, "2026-01-02T00:00:00Z")
        self.assertEqual(state["views"][0]["count"], 7)
        self.assertEqual(state["status"]["views"]["observed_at"], "old")
        self.assertFalse(state["status"]["views"]["ok"])
        self.assertNotIn("downloads", state["snapshots"][0])
        self.assertEqual(len(errors), 6)

    def test_release_and_asset_pagination_are_both_used(self):
        class Fake:
            def __init__(self): self.calls = []
            def pages(self, path):
                self.calls.append(path)
                if path.endswith('/releases'): return [{"id": 9, "tag_name": "v1"}]
                return [{"id": i, "name": str(i), "download_count": i, "size": 1,
                         "created_at": "date", "updated_at": "date"} for i in range(105)]
        api = Fake()
        assets = c.release_assets(api, '/repos/a/b')
        self.assertEqual(len(assets), 105)
        self.assertIn('/repos/a/b/releases/9/assets', api.calls)


if __name__ == '__main__': unittest.main()
