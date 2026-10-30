# XFeed 每日简报（公开静态站）

手机 App **XFeed** 从本仓库的 **GitHub Pages** 拉取每日卡片（JSON + 前端）。失败时 App 回退到包内 bundle。

- **站点**：https://zidooong.github.io/xfeed-cards/?theme=d
- **数据**：`data/index.json` + `data/YYYY-MM-DD.json`
- **可选备忘**：`memos/*.md`（资讯摘要，无密钥）

本仓库**只含公开资讯与前端静态资源**。禁止提交 token、密钥、`.env`、内网地址、claim token、反馈密钥。

## 每日更新（Claw → cards → git push）

在生成管线（Claw / multi-source-feed / x-feed-agent）产出当日 memo 与卡片后：

```bash
# 1) 从管线拷贝当日 JSON（及可选 MD memo）到本仓库工作副本
cp /path/to/out/YYYY-MM-DD.json data/
# 可选：cp /path/to/out/YYYY-MM-DD.md memos/

# 2) 更新 index（dates 新→旧，latest=今日）
python3 - <<'PY'
import json, pathlib
p = pathlib.Path("data")
dates = sorted((f.stem for f in p.glob("20*.json")), reverse=True)
(p / "index.json").write_text(
    json.dumps({"dates": dates, "latest": dates[0]}, ensure_ascii=False) + "\n",
    encoding="utf-8",
)
print("latest=", dates[0], "n=", len(dates))
PY

# 3) 推送（Pages 约 1 分钟内生效）
git add data/ memos/ || true
git commit -m "daily: YYYY-MM-DD"
git push origin main
```

App 基址（`XFeedContentURL`）保持：

`https://zidooong.github.io/xfeed-cards/?theme=d`

无需改 App 即可吃到新日数据（相对路径 `data/`）。

## 本地预览

```bash
python3 -m http.server 8080 --directory .
# 打开 http://127.0.0.1:8080/?theme=d
```
