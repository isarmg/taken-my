# 运行、测试与部署 / Run, test, and deploy

## 本地运行 / Run locally

使用 Node.js `^24.15.0 || >=26.0.0`；CI 使用 Node 24。Vite、Playwright 和 jsdom 的直接依赖版本固定在 `package.json`，完整依赖由 `package-lock.json` 锁定。

Use Node.js `^24.15.0 || >=26.0.0`; CI uses Node 24. Direct Vite, Playwright, and jsdom versions are pinned in `package.json`, with the full dependency graph in `package-lock.json`.

```sh
npm ci --ignore-scripts
npm run dev
```

开发服务器默认绑定 `127.0.0.1`。Development binds to `127.0.0.1` by default.

## 验证修改 / Check changes

```sh
npm test
npm run build
npm audit --audit-level=high
```

`npm test` 运行检测器、格式化函数的单元测试和 jsdom 界面事件测试。DOM 测试不加载外部资源，也不能代替真实浏览器的布局、焦点和原生交互验证。

`npm test` runs collector/formatter unit tests and resource-free jsdom UI event tests. DOM tests do not replace real-browser layout, focus, or native-interaction checks.

运行生产构建的 Chromium 回归测试：Run Chromium regressions against the production build:

```sh
npx playwright install chromium
npm run build
npm run test:browser
```

也可使用环境中已安装的 Chromium：Or use an existing Chromium installation:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

浏览器测试需要允许 Chromium 正常启动的环境。测试覆盖本地资源请求、成功事实筛选、缺失/阻止/超时结果隐藏、安全文本显示、双语切换、搜索、可选检查、过期结果丢弃、链接复制、访客副本及移动端布局。GitHub Actions 在依赖检查、单元/DOM 测试和构建后安装 Chromium 并运行这些场景。

Browser tests require an environment that permits Chromium to launch. They cover local asset requests, success-only facts, hidden unavailable/blocked/hanging results, safe text rendering, languages, search, optional checks, stale results, copying, visitor exports, and mobile layout. GitHub Actions runs dependency checks, unit/DOM tests, the build, and these Chromium scenarios.

## 发布静态站点 / Deploy the static site

```sh
npm run build
npm run preview
```

将 `dist/` 上传至静态托管。安全上下文 API 需要 HTTPS 或 localhost。部署到子目录时，在 `vite.config.js` 中设置对应 `base`。

Upload `dist/` to a static host. Secure-context APIs need HTTPS or localhost. For subdirectory deployments, set the matching `base` in `vite.config.js`.

生产构建包含 `connect-src 'none'` 的内容安全策略，限制应用主动网络连接。开发模式保留 Vite 本地热更新。页面资源与字体由同一站点提供，底层 API 参考保留在开发文档中。

The production Content Security Policy includes `connect-src 'none'` to restrict application-initiated network connections. Development retains Vite's local HMR. Page assets and fonts are served from the same site; Underlying API references remain in the developer documentation.

## 提交源码 / Keep the repository reproducible

提交源码、锁文件及素材许可。`.gitignore` 排除 `node_modules/`、`dist/`、测试输出、日志和本地环境文件。用 `npm ci` 重建依赖。此次清理只移除了生成文件的跟踪，保留了已有 Git 历史。

Commit source, the lockfile, and asset licenses. `.gitignore` excludes dependencies, builds, test output, logs, and local environment files. Recreate dependencies with `npm ci`. The cleanup removed generated artifacts from tracking while preserving existing Git history.
