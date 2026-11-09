# GitHub 流量档案

这是 Anson-He 的私密 GitHub 流量归档仓库。使用 **GitHub 官方 REST API + GitHub Actions** 每天采集，数据永久保存在本仓库的 Git 历史中，公开的静态界面通过浏览器直接读取私密仓库，流量数据不随网站公开。

仪表盘：https://anson-he.github.io/github-traffic-vault/

## 首次启用（必需）

1. 打开 https://github.com/settings/personal-access-tokens/new 创建 Fine-grained personal access token。Resource owner 选择 `Anson-He`；Repository access 选择 **All repositories**（只限本账号仓库，以便自动覆盖未来新仓库），或明确选择所有要统计的仓库。仅授予：
   - **Administration: Read-only**：读取 Traffic API。
   - **Contents: Read-only**：读取私密仓库的 Release 附件和语言数据。
   - Metadata 的读取权限自动附带。无须对被统计仓库授予写权限。
2. 设置合理的有效期并在到期前续期。Token 不要提交到代码或发到聊天。
3. 打开 https://github.com/Anson-He/github-traffic-vault/settings/secrets/actions ，新建 Repository secret，名称为 `TRAFFIC_TOKEN`，值为上一步 Token。
4. 打开本仓库 **Actions → Collect repository traffic → Run workflow**，选择 `main` 并运行。等待成功后，`data/dashboard.json`、`data/traffic.csv` 和原始快照会出现。
5. 此后每天 **北京时间 09:00 / UTC 01:00** 自动运行，无需电脑开机。首次应手动运行，不必等待明天。

本工作流的 `GITHUB_TOKEN` 仅负责写入当前归档仓库；跨仓库流量读取使用上面的 `TRAFFIC_TOKEN`。不要试图通过 `permissions: contents: write` 替代 Traffic API 所需的 Administration 读取权限。

## 网站读取数据（GitHub Pages）

正式入口：**https://anson-he.github.io/github-traffic-vault/**

网站界面部署在现有公开仓库 `Anson-He/Anson-He.github.io` 的 `github-traffic-vault/index.html`，保留原学术主页。公开仓库仅包含界面代码，流量 JSON、CSV、原始快照与 TRAFFIC_TOKEN 仍在本私密归档仓库中，绝不复制到公开网站。

1. 创建一个仅选择 `github-traffic-vault`、仅授予 **Contents: Read-only** 的 Fine-grained Token。
2. 打开网站，点击“连接仓库”，输入该只读 Token。在自己的设备上勾选“记住此设备，下次自动连接”。
3. 浏览器直接请求固定地址 `https://api.github.com/repos/Anson-He/github-traffic-vault/contents/data/dashboard.json`；不会经过 ChatGPT 或自建后端。
4. 不勾选时 Token 仅保留在当前页面内存中；勾选后，使用 Web Crypto AES-GCM 加密凭据，并把密文和不可导出的 CryptoKey 保存到当前浏览器的 IndexedDB。不会把明文 Token 写入 localStorage、sessionStorage、URL、代码或数据仓库。点击“断开连接并忘记”可删除设备凭据和本机档案。不要把跨仓库的采集 Token 用在网站中。
5. 记住设备后，每次打开网站会自动恢复连接并获取最新归档，切回已打开的页面也会在距上次读取超过一分钟时刷新。读取失败会提示重新连接，但不自动删除设备凭据或本机档案。更换浏览器、清除网站数据或使用隐私模式时，可能需要重新连接。

也可以从本私密仓库下载 `data/dashboard.json`，在网站点击“导入数据文件”。文件在当前浏览器本地解析，并加密保存为本机档案，刷新后可恢复，不上传到公开网站。

GitHub Pages 界面是公开的，能打开网址不代表能读取私密档案。网站没有访问者统计、第三方脚本或公开数据快照，也不需要配置服务端环境变量。数据请求只允许连接 GitHub API；字体沿用个人主页的 Google Fonts，其他外部脚本不加载。

### 公开界面与私密数据

- 个人主页页脚提供低调的 `Analytics ↗` 入口，任何人都可以打开静态界面；没有额外的密码或 GitHub 账号登录页。
- 公开仓库仅存放界面代码，归档仓库和流量数据保持 private。浏览器没有私密仓库读取凭据时不发起数据请求，只显示空状态；数据访问由 GitHub 权限控制。
- 已连接并选择记住设备的浏览器会自动读取最新档案，并将成功读取的数据用 AES-GCM 加密保存到当前浏览器 IndexedDB，刷新后先显示本机副本再尝试更新。
- 401、403、404、限流、网络错误都不会自动删除保存的读取凭据或本机档案；只有“断开连接并忘记”主动清除两者。
- 导入文件仅在本机解析并加密缓存，不上传或公开。没有读取凭据时，导入的副本仍可跨刷新查看，但不能自动拉取未来更新。
- 更换设备、浏览器、隐私窗口、清除网站数据时不能恢复其他浏览器的副本；这时需要导入文件或重新连接一次。
- 页面页脚明确标记数据来源为 GitHub 归档、本机缓存或本机导入，并显示归档更新时间，避免把旧副本误认为实时结果。
- 个人主页在已连接设备上跳过第三方访客计数脚本，普通游客的主页计数流程不变。
- 统计页沿用个人主页的字体、蓝灰配色及深浅色主题；每天北京时间 09:00 的采集不变。

Pages 发布源的备份在本私密仓库 `web/github-pages/index.html`，测试为 `tests/test-pages.mjs`。更新界面时，把该 HTML 同步到公开仓库的 `github-traffic-vault/index.html` 即触发已有的 GitHub Pages 发布流程。旧的 Sites/Worker 源文件保留作历史兼容，已不作为正式入口。

## 采集范围与文件结构

`config.json` 控制 owner、排除列表、是否包含归档仓库。默认发现本账号下 Token 可访问的所有自有仓库，排除归档仓库本身（避免采集行为干扰统计）。组织仓库目前不在自动发现范围。Token 只选择部分仓库时，只能看到这些仓库；选择 All repositories 才能自动纳入未来仓库。

- `data/dashboard.json`：网站用的汇总档案；按仓库数字 ID 保留历史，支持仓库改名。
- `data/traffic.csv`：按仓库、UTC 日期合并的长期访问/克隆记录。
- `data/raw/<repository_id>/<UTC日期>/<采集时间>.json.gz`：每次运行的详细原始快照，含仓库元数据、浏览、克隆、来源、热门页面、语言分布、附件信息和错误。
- `data/runs/<采集时间>.json`：每次采集的发现数量和异常。

| 来源 | 保存内容 | 时间含义 |
| --- | --- | --- |
| Traffic views | 浏览次数、独立访客数、每日明细、14 天窗口总量 | UTC 每日 + 滚动 14 天 |
| Traffic clones | 完整克隆次数、独立克隆数、每日明细、14 天窗口总量 | UTC 每日 + 滚动 14 天；不含后续 fetch |
| Popular referrers / paths | GitHub 返回的 Top 10 来源和页面 | 最近 14 天窗口快照，不能分解成每日数据 |
| Repository metadata | Stars、Forks、未关闭 Issue 与 PR 合计、大小、更新时间等 | 采集时快照；完整元数据存原始文件 |
| Languages | 各语言代码字节数 | 采集时快照 |
| Releases / assets | 所有可见版本的上传附件名称、大小、累计下载次数 | 每附件累计量；源码 zip/tar 自动包无单独计数 |

两个分页层级（Releases 和每个 Release 的附件）都完整读取，避免只统计第一页。附件删除会导致累计总量下降，不能把总量差简单当作当天下载；历史每附件 ID 的计数保存在每日快照。重跑同一天时，当前汇总中的该天记录更新，所有原始运行快照仍保留。

## 统计口径与可靠性

- 每次重新拉取最近 14 天，**按日期替换重叠记录**，更早记录保留，绝不叠加每天的滚动窗口总数。
- UTC 00:00 是北京时间 08:00。采集当日数据仍可能增长，后续采集会再次更新。
- 每日独立访客不能累加为月度独立人数；跨仓库独立人数也不能去重。网站只在单仓库展示最近一次成功读取的 14 天独立人数。
- 接口失败保留最后成功结果与时间，记录异常并让 Actions 标记失败；尽可能先提交已经成功获取的部分数据。发现不到旧仓库时仍保留其历史并标记异常。
- 没有采集记录的日期显示为空缺，**不伪造为零**。折线图用不同圆点显示部分仓库覆盖；汇总次数只表示已记录的数据。
- API 只有最近 14 天的流量；第一次采集可补回窗口内明细，更早的历史无法恢复。中断超过窗口可能永久缺数据。窗口两端是否完整以每次原始快照为准。
- 来源和路径的滚动窗口快照不相加。GitHub 不提供具体访客身份、所有下载路径、任意历史日期的去重人数。流量可能包含自动化访问。
- 定时任务可能延迟或丢弃。监控 Actions 的失败记录与网站“超过 48 小时未更新”提示。Token 到期需更新 Secret。
- 私密仓库的 Actions 用量计入你的 GitHub 计划；这里无需第三方数据库或 npm 依赖。长期原始数据会增加 Git 仓库大小，可按年归档；网站当前限制单次 JSON 文件约 20 MB。

## 本地运行和验证

Python 3.12+、Node.js 20+，采集器与网站均无外部依赖。

```sh
python3 -m unittest discover -s tests -p 'test_*.py'
# 在终端安全设置 TRAFFIC_TOKEN 后：
python3 scripts/collect.py
node tests/test-pages.mjs
```

GitHub Pages 页面为无构建依赖的静态 HTML，可本地打开测试导入功能；在线读取使用 GitHub API 的 CORS 支持。线上发布使用现有公开主页仓库的 GitHub Pages 配置，归档数据仓库保持 private。

## 官方文档

- https://docs.github.com/en/rest/metrics/traffic
- https://docs.github.com/en/rest/releases/assets
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
- https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
- https://docs.github.com/en/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site
