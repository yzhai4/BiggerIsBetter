# 验收证据

此目录由本地浏览器检查生成 JSON 与截图。运行前执行 `python build.py`；浏览器检查依赖已安装的 Python Playwright 和 `/usr/bin/chromium`。

```sh
npm test
npm run check
python build.py
python tests/browser-checks.py
```

2026-10-10 仓库导入时重新运行 Node 测试：60 通过，0 失败；本地 Chromium 检查重新运行：58 通过，0 失败。9 个代码与测试文件的 Git blob 哈希与原交付包一致，见 ../../../../versions/world-impact-0.1.0.json。

所有这些检查针对独立模块，不是线上 v15，不是微信真机，不代表完成正式 Boss 战。CI 当前只执行语法、Node 测试与 HTML 构建，不自动执行浏览器测试。
