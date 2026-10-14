# 运行、测试与部署

## 本地运行

使用 Node.js `^24.15.0 || >=26.0.0`；CI 固定 Node `26.7.0`。Vite、Playwright 和 jsdom 的直接依赖版本固定在 `package.json`，完整依赖由 `package-lock.json` 锁定。

```sh
npm ci --ignore-scripts
npm run dev
```

开发服务器默认绑定 `127.0.0.1`。

## 验证修改

```sh
npm test
npm run build
npm audit --audit-level=high
```

`npm test` 运行检测器、格式化函数的单元测试和 jsdom 界面事件测试。DOM 测试不加载外部资源，也不能代替真实浏览器的布局、焦点和原生交互验证。

运行生产构建的 Chromium 回归测试：

```sh
npx playwright install chromium
npm run build
npm run test:browser
```

也可使用环境中已安装的 Chromium：

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

浏览器测试需要允许 Chromium 正常启动的环境。测试覆盖本地资源请求、成功事实筛选、缺失/阻止/超时结果隐藏、安全文本显示、双语切换、搜索、可选检查、过期结果丢弃、链接复制、访客副本及移动端布局。GitHub Actions 在依赖检查、单元/DOM 测试和构建后安装 Chromium 并运行这些场景。

## 发布静态站点

```sh
npm run build
npm run preview
```

将 `dist/` 上传至静态托管。安全上下文 API 需要 HTTPS 或 localhost。部署到子目录时，在 `vite.config.js` 中设置对应 `base`。

生产构建包含 `connect-src 'none'` 的内容安全策略，限制应用主动网络连接。开发模式保留 Vite 本地热更新。页面资源与字体由同一站点提供，底层 API 参考保留在开发文档中。

正式发行在精确标签的干净源码上，从 `build-tools-source.json` 固定的公开 `xssi` 提交取得物料工具。构建时保存 Vite 实际渲染的模块和最终输出；打包结合原始 npm 许可、随包字体、源修订和最终文件生成 SBOM。开发或测试依赖不会因存在于锁文件中就被视为已交付组件。

随包字体定义位于 `public/fonts/provenance.json`。工具核对字体与许可的实际源文件、生产输出，以及当前不可变源码修订的公开镜像字节；历史字体原始下载地址仍明确为未知，不据此推测上游下载来源。字体本身和时区采集行为没有改变。

最终 TAR/ZIP 保留 `share/release-sbom.cdx.json`、`share/package.json` 和 `share/package.sha256`，使用 SHA-256 校验。发布前重新展开两个实际压缩包并核验内部清单，外部 `SHA256SUMS` 则核对下载制品。工具修订尚未固定时正式打包明确失败。

## 提交源码

提交源码、锁文件及素材许可。`.gitignore` 排除 `node_modules/`、`dist/`、测试输出、日志和本地环境文件。用 `npm ci` 重建依赖。此次清理只移除了生成文件的跟踪，保留了已有 Git 历史。
