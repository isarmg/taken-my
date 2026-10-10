# taken. — 浏览器画像 / browser portrait

使用标准 Web API，在用户浏览器本地展示设备与设置提示的中英双语静态应用。

A bilingual static inspector that shows browser-exposed device and setting hints, processed locally in the current tab.

## 功能 / Features

- 50 项常规信息：浏览器、语言时区、屏幕输入、显示偏好、存储与电池等
- 6 项按钮触发的可选检测：图形、字体候选与已有权限状态
- 字段搜索、来源说明、状态筛选、重新检测、本地 JSON 导出和页面链接复制

50 regular fields, 6 optional checks, bilingual search, per-field sources/status, recheck, local JSON export, and page-link copying.

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
