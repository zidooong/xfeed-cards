# 每日更新流程（简版）

1. **Claw / 管线** 生成当日 memo（MD）与卡片 JSON。
2. **写入本仓** `data/YYYY-MM-DD.json`，可选 `memos/YYYY-MM-DD.md`。
3. **刷新** `data/index.json`（`latest` + `dates`）。
4. **`git push`** 到 `main` → GitHub Pages 自动更新。
5. 手机 XFeed 下次打开（或下拉刷新逻辑）即拉到新日；失败则用包内 bundle。

推送前自检：无 API token / FEEDBACK_TOKEN / 私钥 / `.env` / `auth.json` / claim token / 内网 IP。
