# 按浏览器查看 / Choose your browser

taken. 在各平台使用同一个静态页面。字段是否能读取，取决于浏览器引擎、版本、站点权限和安全上下文。

The same static page runs across platforms. Field availability depends on the browser engine/version, site policy, and secure context.

## Chrome / Edge（Chromium）

在使用 Chromium 引擎的平台上，电池、近似内存和网络连接提示有 API 支持。设备类型、HTTPS 和浏览器策略仍可能限制返回结果。内存和网络字段应按提示值理解。

On Chromium-based platforms, Battery, Device Memory, and Network Information APIs are supported. Device type, HTTPS, and browser policy may still limit results. Treat memory and connection fields as hints.

## Firefox

当前 Firefox 不提供本项目使用的电池、近似内存和网络连接 API；这些字段显示“未提供”属于正常情况。其他可用字段仍独立显示。

Current Firefox does not expose the Battery, Device Memory, or Network Information APIs used here. “Not exposed” is expected for those fields; other fields remain independently usable.

## Safari / WebKit

Safari 同样不提供上述三项 API。使用 WebKit 的移动浏览器应按引擎能力判断，而不是仅凭浏览器品牌。

Safari also does not expose those three APIs. For mobile browsers using WebKit, availability follows the engine rather than the browser brand alone.

## 权限与安全上下文 / Permissions and secure contexts

现代 Chrome、Edge、Firefox 和 Safari 都提供 Permissions API，但支持查询的具体权限名称可能不同。点击“读取权限状态”后，以每个字段的实际返回状态为准。HTTP 站点上的安全上下文 API 会显示“已阻止”；localhost 可用于本地开发。

Modern Chrome, Edge, Firefox, and Safari expose the Permissions API, but supported permission names differ. After “Read permission states,” use the individual field result. Secure-context APIs show “Blocked” on ordinary HTTP sites; localhost is suitable for development.

以上是 API 支持说明，不代表本项目已在每个平台完成视觉测试。兼容信息核对于 2026-10-10，后续版本以 MDN 和页面实际检测为准。

This describes API support, not a claim of visual testing on every platform. Checked on 2026-10-10; use MDN and actual field results for later versions.

Sources: [Battery](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getBattery#browser_compatibility), [Device Memory](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory#browser_compatibility), [Network Information](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/connection#browser_compatibility), [Permissions](https://developer.mozilla.org/en-US/docs/Web/API/Permissions/query#browser_compatibility), [MDN compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json).
