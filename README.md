# taken. — 浏览器画像 / browser portrait

使用标准 Web API，在用户浏览器本地展示设备与设置提示的中英双语静态应用。

A bilingual static inspector that shows browser-exposed device and setting hints, processed locally in the current tab.

## 功能 / Features

- 以时间、设备、语言、显示偏好、资源余量与连接为短章，呈现此刻的浏览器画像
- 只展示成功取得的实际信息；有效的 `0` 和 `false` 保留，空项与诊断状态不展示
- 中英切换、可展开的简明信息清单、搜索、重新查看、本地副本下载与页面链接分享
- 图形与候选字体由按钮触发，不查询权限状态，不启动位置、摄像头或麦克风

Short bilingual chapters describe the moment through device, time, language, appearance, resource, and connection hints. Only successful visitor observations appear, including valid zero and false values. A searchable appendix, refresh, local copy, and clean page-link sharing remain available. Optional graphics and font hints run only on request; the page does not query permissions or activate sensors.

## 平台 / Platforms

面向现代浏览器，具体 API 支持因浏览器而异；安全上下文 API 需要 HTTPS 或 localhost。开发环境使用 Node.js 24.15+（24 系列）或 26+。

Modern browsers; API availability varies. Secure-context features require HTTPS or localhost. Development requires Node.js 24.15+ (24.x) or 26+.

## 快速开始 / Quick start

```sh
npm ci --ignore-scripts
npm run dev
```

打开终端显示的本地地址，右上角可切换语言。Open the local URL shown in the terminal; switch languages at the top right.

## 构建与部署 / Build & deploy

```sh
npm run build
npm run preview
```

将生成的 `dist/` 发布到静态托管即可。Deploy the generated `dist/` directory to a static host.

[详细文档 / Documentation](docs/README.md)
