# 查看信息与导出 / Inspect and export

## 查看当前快照 / Read the current snapshot

打开页面后，50 项常规检测会独立运行。点击“立即查看”可跳过短暂显示过渡；启用系统“减少动态效果”时会立即显示。

Use “Show now” to skip the brief reveal. Each of the 50 regular checks runs independently; reduced-motion users see the fields immediately.

搜索框同时支持中英文名称、API 名称和当前值。“仅显示已获取”用于隐藏本次未能取得的字段。展开“来源与说明”查看每项的 API 和解释。

Search accepts English/Chinese labels, API names, and current values. “Available only” hides fields that could not be read. Expand “Source & explanation” for the API reference and caveat.

更改窗口大小或浏览器设置后，点击“重新检测”。这会刷新常规快照并清除可选结果。切换语言保留当前快照；也可用 `?lang=zh` 或 `?lang=en` 指定初始语言。

Use “Check again” after resizing or changing browser settings. It refreshes the regular snapshot and clears optional results. Language switching keeps the current snapshot; `?lang=zh` or `?lang=en` sets the initial language.

## 理解状态 / Interpret status

- 已获取 / Available：成功读到值，包括有效的 `0` 或 `false`。
- 未提供 / Not exposed：浏览器没有提供该 API 或属性。
- 已阻止 / Blocked：受到安全上下文、权限策略或浏览器限制。
- 已超时 / Timed out：单项检测超过 1.8 秒，其他结果仍可使用。
- 暂不可用、读取失败 / Unavailable, Could not read：此次读取没有结果或发生异常。

API 存在只表示接口可见。它不等于已获访问权限；近似值和媒体查询的“未匹配”需要结合每个字段的说明阅读。

API presence means the interface is exposed, not that access is allowed. Approximate values and media-query “No match” results should be read with their field-specific explanations.

## 运行可选检查 / Run optional checks

“查看图形与字体提示”读取 WebGL 渲染器，并用一小组固定候选字体做本地文字宽度比较。渲染器可能被隐藏或虚拟化，字体结果可能有误报或遗漏，并非已安装字体清单。

“Inspect graphics & font hints” reads the WebGL renderer and compares a small, fixed font-candidate list using local text widths. The renderer may be masked or virtualized. Font hints can miss fonts or produce false matches; they are not an inventory.

“读取权限状态”查询位置、摄像头、麦克风和通知的已有权限。它不会发起访问或权限申请。“已拒绝”是成功读到的权限值；“需询问”表示真正访问时需要申请。本应用不会进行该访问。

“Read permission states” queries existing location, camera, microphone, and notification permissions without requesting access. “Denied” is a successfully read permission value; “Prompt” means a real access attempt would need permission. The app does not make that attempt.

可选结果可通过“清除可选结果”移除，再次点击对应按钮重新读取。Optional results can be cleared and explicitly checked again.

## 导出或分享 / Export or share

“导出本地 JSON”生成设备与设置详情文件，包含已经运行的可选检查。分享前请先检查内容。文件保存在你的设备上；刷新页面或清除结果不会删除已下载文件。

“Export local JSON” downloads device/settings details, including optional checks already run. Review the file before sharing. Refreshing or clearing the page does not delete downloaded files.

“复制页面链接”保留页面路径，移除查询参数、片段和 URL 中的账号信息。检测值不会加入链接。剪贴板不可用时，可以选中显示的链接手动复制。

“Copy page link” keeps the page path while removing query parameters, fragments, and URL credentials. Detected values are not added to the link. If the clipboard is unavailable, select and copy the displayed link manually.

## 结果保留在哪里 / Where results live

快照和当前标签页的汇总互动计数保留在页面内存中。应用不写入持久化浏览器存储或生成跨站标识。检测使用本地 API；托管方仍会收到加载页面、脚本、样式和自带字体的常规请求，并可能记录日志。外部参考链接仅在点击时打开。

Snapshots and aggregate current-tab interaction counters live in page memory. The app does not write persistent browser storage or create a cross-site identifier. Detection uses local APIs; the host still receives ordinary requests for the page, scripts, styles, and bundled fonts and may log them. External references open when clicked.
