# 信息来源与说明 / Sources and interpretation

`browser-info.js` 保留底层字段与来源，`display-format.js` 格式化值，`portrait.js` 筛选面向访客的成功事实并生成双语叙事。技术来源只留在源码与本文档，不进入访客页面或副本。

`browser-info.js` retains the internal catalogue and sources, `display-format.js` formats values, and `portrait.js` selects successful visitor facts and composes the bilingual narrative. Technical sources stay in code and this reference, not in the visitor view or its copy.

## 按信息类型查阅 / Look up a category

- [Navigator](https://developer.mozilla.org/en-US/docs/Web/API/Navigator)：用户代理、语言、触控、处理器/内存提示与 API 存在性。User agent, languages, touch, hardware hints, and API presence.
- [Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/resolvedOptions)：区域、时区、日历、数字系统和小时制。Locale, time zone, calendar, numbering system, and hour cycle.
- [Screen](https://developer.mozilla.org/en-US/docs/Web/API/Screen) 与 [VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)：屏幕、方向、色深和窗口尺寸。Screen, orientation, color depth, and viewport dimensions.
- [matchMedia](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia)：输入能力、配色、动态效果、对比度及色域。Input, appearance, motion, contrast, and gamut queries.
- [Storage estimates](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate)：当前源的近似使用量与配额，并非硬盘剩余空间。Approximate current-origin usage/quota, not free disk space.
- [Network Information](https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation)：有限支持、可能经过取整或缓存的连接提示，并非测速。Limited, possibly rounded or cached hints, not a speed test.
- [Battery status](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getBattery)：支持情况及安全上下文/策略限制因浏览器而异。Support and secure-context/policy restrictions vary.
- [Permissions.query](https://developer.mozilla.org/en-US/docs/Web/API/Permissions/query)：内部保留的权限读取器；访客页面不调用它，也不展示权限状态。Retained as an internal reader; the visitor page does not call it or show permission states.
- [WebGL renderer extension](https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_debug_renderer_info)：可能被隐私保护禁用。May be disabled by privacy protections.
- [HTMLElement.offsetWidth](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetWidth)：可选字体候选比较使用的文本宽度信息。Text-width information used by the optional font-candidate comparison.

## 读懂数值 / Read the values accurately

用户代理可能被缩减或伪装；硬件提示不等于实测规格。媒体查询“未匹配”也可能表示特性不受支持。电池状态可能是默认值。存储估值属于整个当前源，同源其他页面可能占用空间。

User agents can be reduced or spoofed, and hardware hints are not measured specifications. A media query with no match may be unsupported. Battery values may be defaults. Storage estimates cover the current origin, including other pages on that origin.

字体检查将 10 个固定候选与三种 CSS 回退字体做宽度比较，结果只是提示。WebGL 读取临时上下文中的渲染器字符串，在浏览器支持时释放上下文。

The font check compares 10 fixed candidates against three CSS fallbacks; the result is only a hint. WebGL reads renderer strings from a temporary context and releases it when supported.

## 素材与灵感 / Assets and inspiration

项目视觉灵感来自 [Since You Arrived · Vol. IV](https://sinceyouarrived.world/taken)。当前实现采用独立的静态应用结构，保留浏览器信息的可解释展示。

The presentation is inspired by [Since You Arrived · Vol. IV](https://sinceyouarrived.world/taken), with an independent static implementation and inspectable browser facts.

三个原有 WOFF2 字体文件保持不变。字体内嵌元数据、上游来源及完整 SIL OFL 许可位于 [字体说明](../public/fonts/README.md)，会随构建复制到发布目录。

The three original WOFF2 fonts are unchanged. Their embedded metadata, upstream attribution, and full SIL OFL licenses are documented in [the font notes](../public/fonts/README.md) and copied into the production output.
