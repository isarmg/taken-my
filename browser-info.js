// Read-only browser facts. No transport, persistent storage, identifiers, or probes.
export const STATUS = Object.freeze({
  available: { en: 'Available', zh: '已获取' },
  unsupported: { en: 'Not exposed', zh: '未提供' },
  blocked: { en: 'Blocked', zh: '已阻止' },
  timeout: { en: 'Timed out', zh: '已超时' },
  unavailable: { en: 'Unavailable', zh: '暂不可用' },
  error: { en: 'Could not read', zh: '读取失败' },
  pending: { en: 'Reading', zh: '正在读取' },
  'not-checked': { en: 'Not checked', zh: '尚未检查' }
});

export const GROUPS = {
  browser: { en: 'Browser & language', zh: '浏览器与语言' },
  display: { en: 'Screen & window', zh: '屏幕与窗口' },
  input: { en: 'Input & hardware hints', zh: '输入与硬件提示' },
  preferences: { en: 'Display & accessibility preferences', zh: '显示与辅助功能偏好' },
  network: { en: 'Connection hints', zh: '连接提示' },
  storage: { en: 'Storage & battery', zh: '存储与电池' },
  context: { en: 'Page & privacy signals', zh: '页面与隐私信号' },
  capabilities: { en: 'API availability', zh: 'API 可用性' },
  permissions: { en: 'Existing permission states', zh: '已有权限状态' }
};

const doc = name => `https://developer.mozilla.org/en-US/docs/${name}`;
const note = (en, zh) => ({ en, zh });
const reported = note('A browser-reported value; settings or privacy protections can change it.', '浏览器报告值，设置或隐私保护可能改变结果。');
const approximate = note('An approximate browser hint, not a measurement of the physical device.', '浏览器提供的近似提示，并非对物理设备的实测。');
const mediaNote = note('A CSS media-query result. “No match” can also mean the feature is unsupported.', 'CSS 媒体查询结果。“未匹配”也可能表示浏览器不支持该特性。');
const storageNote = note('Approximate storage for this origin, not free disk space. Other pages on the same origin may contribute. This app writes nothing to browser storage.', '当前源的存储估值，并非硬盘剩余空间。同源其他页面也可能占用存储。本应用不写入浏览器存储。');
const capabilityNote = note('API presence only; no access request or device operation is made. Support does not imply permission.', '仅检查 API 是否存在，不申请访问或操作设备。支持 API 不代表已授予权限。');
const missing = () => { const error = new Error('Not exposed'); error.name = 'UnsupportedError'; throw error; };
const present = value => value === undefined || value === null || value === '' ? missing() : value;
const size = (width, height) => `${present(width)} × ${present(height)}`;
const media = (env, queries) => {
  if (typeof env.matchMedia !== 'function') return missing();
  return queries.filter(query => env.matchMedia(query).matches);
};
const def = (id, group, en, zh, source, path, read, options = {}) => ({
  id, group, label: note(en, zh), source, docs: doc(path), note: reported, read, ...options
});

export const checks = [
  def('userAgent', 'browser', 'User agent', '用户代理', 'navigator.userAgent', 'Web/API/Navigator/userAgent', e => present(e.navigator.userAgent), { note: note('May be reduced or spoofed. This cannot reliably identify your browser or operating system.', '可能被缩减或伪装，不能可靠判定浏览器或操作系统。') }),
  def('languages', 'browser', 'Preferred languages', '首选语言', 'navigator.languages', 'Web/API/Navigator/languages', e => present(e.navigator.languages)?.slice()),
  ...[
    ['locale', 'Formatting locale', '格式化区域'], ['timeZone', 'Time zone', '时区'],
    ['calendar', 'Calendar', '日历'], ['numberingSystem', 'Numbering system', '数字系统'], ['hourCycle', 'Hour cycle', '小时制']
  ].map(([key, en, zh]) => def(key, 'browser', en, zh, 'Intl.DateTimeFormat().resolvedOptions()', 'Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/resolvedOptions', e => present(new e.Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions()[key]))),
  def('utcOffset', 'browser', 'UTC offset (minutes)', 'UTC 偏移（分钟）', 'Date.getTimezoneOffset()', 'Web/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset', e => -new e.Date().getTimezoneOffset(), { note: note('Offset at the time of this check; it can change with daylight saving time.', '检测时的偏移量，可能随夏令时改变。') }),
  def('screen', 'display', 'Screen (CSS pixels)', '屏幕（CSS 像素）', 'screen.width / height', 'Web/API/Screen', e => size(e.screen.width, e.screen.height)),
  def('availableScreen', 'display', 'Available screen (CSS pixels)', '可用屏幕（CSS 像素）', 'screen.availWidth / availHeight', 'Web/API/Screen', e => size(e.screen.availWidth, e.screen.availHeight)),
  def('viewport', 'display', 'Layout viewport (CSS pixels)', '布局视口（CSS 像素）', 'window.innerWidth / innerHeight', 'Web/API/Window/innerWidth', e => size(e.innerWidth, e.innerHeight)),
  def('visualViewport', 'display', 'Visual viewport (CSS pixels)', '可视视口（CSS 像素）', 'window.visualViewport', 'Web/API/VisualViewport', e => e.visualViewport ? size(Math.round(e.visualViewport.width), Math.round(e.visualViewport.height)) : missing()),
  def('pixelRatio', 'display', 'Device pixel ratio', '设备像素比', 'window.devicePixelRatio', 'Web/API/Window/devicePixelRatio', e => present(e.devicePixelRatio), { note: note('The ratio between device and CSS pixels. Page zoom can affect it.', '设备像素与 CSS 像素的比例，页面缩放可能影响此值。') }),
  def('colorDepth', 'display', 'Color depth (bits)', '色深（位）', 'screen.colorDepth', 'Web/API/Screen/colorDepth', e => present(e.screen.colorDepth)),
  def('orientation', 'display', 'Screen orientation', '屏幕方向', 'screen.orientation.type', 'Web/API/ScreenOrientation/type', e => present(e.screen.orientation?.type)),
  def('touchPoints', 'input', 'Maximum touch points', '最大触控点数', 'navigator.maxTouchPoints', 'Web/API/Navigator/maxTouchPoints', e => present(e.navigator.maxTouchPoints)),
  def('logicalProcessors', 'input', 'Reported logical processors', '报告的逻辑处理器数', 'navigator.hardwareConcurrency', 'Web/API/Navigator/hardwareConcurrency', e => present(e.navigator.hardwareConcurrency), { note: approximate }),
  def('deviceMemory', 'input', 'Approximate memory (GiB)', '近似内存（GiB）', 'navigator.deviceMemory', 'Web/API/Navigator/deviceMemory', e => present(e.navigator.deviceMemory), { note: approximate }),
  def('pointer', 'input', 'Primary pointer', '主要指针', 'matchMedia(pointer)', 'Web/CSS/@media/pointer', e => media(e, ['(pointer: fine)', '(pointer: coarse)', '(pointer: none)']), { note: mediaNote, format: 'queries' }),
  def('anyPointer', 'input', 'All pointer capabilities', '所有指针能力', 'matchMedia(any-pointer)', 'Web/CSS/@media/any-pointer', e => media(e, ['(any-pointer: fine)', '(any-pointer: coarse)', '(any-pointer: none)']), { note: mediaNote, format: 'queries' }),
  def('hover', 'input', 'Primary pointer hover', '主要指针悬停', 'matchMedia(hover)', 'Web/CSS/@media/hover', e => media(e, ['(hover: hover)', '(hover: none)']), { note: mediaNote, format: 'queries' }),
  ...[
    ['colorScheme', 'Color scheme', '配色方案', 'prefers-color-scheme', ['dark', 'light']],
    ['reducedMotion', 'Motion preference', '动态效果偏好', 'prefers-reduced-motion', ['reduce', 'no-preference']],
    ['contrast', 'Contrast preference', '对比度偏好', 'prefers-contrast', ['more', 'less', 'custom', 'no-preference']],
    ['forcedColors', 'Forced colors', '强制颜色', 'forced-colors', ['active', 'none']],
    ['colorGamut', 'Color gamut matches', '色域匹配', 'color-gamut', ['srgb', 'p3', 'rec2020']],
    ['dynamicRange', 'Dynamic range', '动态范围', 'dynamic-range', ['standard', 'high']]
  ].map(([id, en, zh, feature, values]) => def(id, 'preferences', en, zh, `matchMedia(${feature})`, `Web/CSS/@media/${feature}`, e => media(e, values.map(value => `(${feature}: ${value})`)), { note: mediaNote, format: 'queries' })),
  def('online', 'network', 'Browser online hint', '浏览器在线提示', 'navigator.onLine', 'Web/API/Navigator/onLine', e => present(e.navigator.onLine), { note: note('Does not prove Internet access. No connection test or network request is performed.', '不能证明互联网可达。本页面不进行连接测试或网络请求。') }),
  ...[
    ['effectiveType', 'Effective connection type', '估计连接类型'], ['downlink', 'Estimated downlink (Mbps)', '估计下行速率（Mbps）'],
    ['rtt', 'Estimated round-trip time (ms)', '估计往返延迟（毫秒）'], ['saveData', 'Data-saving preference', '节省流量偏好']
  ].map(([key, en, zh]) => def(key, 'network', en, zh, `navigator.connection.${key}`, 'Web/API/NetworkInformation', e => present(e.navigator.connection?.[key]), { note: note('A rounded or cached browser hint with limited support, not a speed test. No IP address, router details, or external service is queried.', '有限支持的浏览器提示，可能经过取整或缓存，并非测速。不查询 IP、路由器详情或外部服务。') })),
  def('storage', 'storage', 'Origin storage estimate', '当前源存储估值', 'navigator.storage.estimate()', 'Web/API/StorageManager/estimate', async e => {
    if (!e.navigator.storage?.estimate) return missing();
    const { quota, usage } = await e.navigator.storage.estimate();
    if (!Number.isFinite(quota) || !Number.isFinite(usage)) return missing();
    return { quotaBytes: quota, usageBytes: usage };
  }, { note: storageNote, format: 'storage', secure: true }),
  def('persisted', 'storage', 'Origin has persistent storage', '当前源已获持久存储', 'navigator.storage.persisted()', 'Web/API/StorageManager/persisted', e => e.navigator.storage?.persisted ? e.navigator.storage.persisted() : missing(), { note: note('Read-only state check. This page never requests persistence or writes data.', '只读状态检查，本页面不申请持久存储，也不写入数据。'), secure: true }),
  def('battery', 'storage', 'Battery snapshot', '电池快照', 'navigator.getBattery()', 'Web/API/Navigator/getBattery', async e => {
    if (!e.navigator.getBattery) return missing();
    const battery = await e.navigator.getBattery();
    return { levelPercent: Math.round(present(battery.level) * 100), charging: present(battery.charging) };
  }, { note: note('Limited browser support; desktops or privacy protections may return defaults. No background battery monitoring.', '浏览器支持有限；桌面设备或隐私保护可能返回默认值。不在后台持续监测电池。'), format: 'battery', secure: true }),
  def('secureContext', 'context', 'Secure context', '安全上下文', 'window.isSecureContext', 'Web/API/Window/isSecureContext', e => present(e.isSecureContext)),
  def('isolated', 'context', 'Cross-origin isolated', '跨源隔离', 'window.crossOriginIsolated', 'Web/API/Window/crossOriginIsolated', e => present(e.crossOriginIsolated)),
  def('visibility', 'context', 'Document visibility', '文档可见状态', 'document.visibilityState', 'Web/API/Document/visibilityState', e => present(e.document.visibilityState)),
  def('focused', 'context', 'Document has focus', '文档拥有焦点', 'document.hasFocus()', 'Web/API/Document/hasFocus', e => e.document.hasFocus()),
  def('cookies', 'context', 'Cookie-enabled hint', 'Cookie 启用提示', 'navigator.cookieEnabled', 'Web/API/Navigator/cookieEnabled', e => present(e.navigator.cookieEnabled), { note: note('Does not guarantee cookies are allowed in every context. This page neither reads nor writes cookies.', '不保证所有场景都允许 Cookie。本页面不读取或写入 Cookie。') }),
  def('dnt', 'context', 'Do Not Track signal (legacy)', '禁止追踪信号（旧版）', 'navigator.doNotTrack', 'Web/API/Navigator/doNotTrack', e => present(e.navigator.doNotTrack), { note: note('Deprecated and inconsistently implemented. This is a preference signal, not proof that tracking is blocked.', '已弃用且实现不一致。这是偏好信号，不代表追踪已被阻止。') }),
  def('gpc', 'context', 'Global Privacy Control signal', '全局隐私控制信号', 'navigator.globalPrivacyControl', 'Web/API/Navigator/globalPrivacyControl', e => present(e.navigator.globalPrivacyControl), { note: note('Limited support. A reported preference, not a test of privacy enforcement.', '浏览器支持有限。这是报告的偏好，不是对隐私保护执行情况的测试。') }),
  ...[
    ['geolocation', 'Geolocation API', '地理位置 API', e => !!e.navigator.geolocation, 'Web/API/Geolocation_API'],
    ['mediaDevices', 'Media device API', '媒体设备 API', e => !!e.navigator.mediaDevices, 'Web/API/MediaDevices'],
    ['clipboard', 'Clipboard API', '剪贴板 API', e => !!e.navigator.clipboard, 'Web/API/Clipboard_API'],
    ['webgpu', 'WebGPU API', 'WebGPU API', e => !!e.navigator.gpu, 'Web/API/WebGPU_API'],
    ['serviceWorker', 'Service worker API', 'Service Worker API', e => !!e.navigator.serviceWorker, 'Web/API/Service_Worker_API'],
    ['webAssembly', 'WebAssembly', 'WebAssembly', e => typeof e.WebAssembly === 'object', 'WebAssembly'],
    ['notifications', 'Notifications API', '通知 API', e => typeof e.Notification === 'function', 'Web/API/Notifications_API'],
    ['permissions', 'Permissions API', '权限 API', e => typeof e.navigator.permissions?.query === 'function', 'Web/API/Permissions_API']
  ].map(([id, en, zh, read, path]) => def(`api-${id}`, 'capabilities', en, zh, 'Feature detection (presence only)', path, read, { note: capabilityNote, format: 'support' }))
];

export const permissionChecks = [
  ['geolocation', 'Location permission', '位置权限'],
  ['camera', 'Camera permission', '摄像头权限'],
  ['microphone', 'Microphone permission', '麦克风权限'],
  ['notifications', 'Notification permission', '通知权限']
].map(([name, en, zh]) => def(`permission-${name}`, 'permissions', en, zh, `navigator.permissions.query({ name: '${name}' })`, 'Web/API/Permissions/query', async e => {
  if (!e.navigator.permissions?.query) return missing();
  try { return (await e.navigator.permissions.query({ name })).state; }
  catch (error) { if (error.name === 'TypeError') return missing(); throw error; }
}, { secure: true, format: 'permission', note: note('Only reads the existing permission state. Does not request access, activate sensors, enumerate devices, or retrieve a location. Unsupported permission names vary by browser.', '只读取已有权限状态，不申请访问、不启动传感器、不枚举设备、不获取位置。各浏览器支持的权限名称不同。') }));

export function metadata(check, status = 'pending') {
  const { read, secure, ...info } = check;
  return { ...info, status, value: null };
}

export function errorStatus(error) {
  if (error?.name === 'UnsupportedError') return 'unsupported';
  if (['NotAllowedError', 'SecurityError'].includes(error?.name)) return 'blocked';
  if (error?.name === 'TimeoutError') return 'timeout';
  if (error?.name === 'NotFoundError') return 'unavailable';
  return 'error';
}

export function withTimeout(work, timeoutMs = 1800) {
  let timer;
  return Promise.race([
    Promise.resolve().then(work),
    new Promise((_, reject) => { timer = setTimeout(() => { const error = new Error('Timed out'); error.name = 'TimeoutError'; reject(error); }, timeoutMs); })
  ]).finally(() => clearTimeout(timer));
}

export async function readCheck(check, env = globalThis, timeoutMs = 1800) {
  const result = metadata(check);
  if (check.secure && env.isSecureContext === false) return { ...result, status: 'blocked' };
  try {
    const value = await withTimeout(() => check.read(env), timeoutMs);
    return { ...result, status: value === undefined || value === null ? 'unavailable' : 'available', value: value ?? null };
  } catch (error) { return { ...result, status: errorStatus(error) }; }
}

export async function collectFacts({ env = globalThis, timeoutMs = 1800, selected = checks, onResult = () => {} } = {}) {
  return Promise.all(selected.map(async check => {
    const result = await readCheck(check, env, timeoutMs);
    onResult(result);
    return result;
  }));
}

export function cleanShareUrl(href) {
  const url = new URL(href);
  url.search = '';
  url.hash = '';
  url.username = '';
  url.password = '';
  return url.href;
}

export function exportSnapshot(records, capturedAt) {
  return { schemaVersion: 1, capturedAt, privacy: 'Generated in this browser. Contains device/settings information; review before sharing. No persistent identifier is created.', facts: records.map(({ id, group, source, status, value }) => ({ id, group, source, status, value })) };
}

// Optional local observations. These are never part of automatic collection.
export const detailChecks = [
  def('graphics', 'input', 'WebGL graphics renderer', 'WebGL 图形渲染器', 'WebGLRenderingContext.getParameter()', 'Web/API/WEBGL_debug_renderer_info', e => {
    const canvas = e.document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (!gl) return missing();
    try {
      const extension = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        vendor: String(present(gl.getParameter(extension ? extension.UNMASKED_VENDOR_WEBGL : gl.VENDOR))),
        renderer: String(present(gl.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : gl.RENDERER))),
        unmaskedExtension: !!extension
      };
    } finally { gl.getExtension('WEBGL_lose_context')?.loseContext(); }
  }, { format: 'graphics', note: note('A browser-reported renderer, which may be virtualized or masked. No image is drawn, hashed, saved, or transmitted. The temporary graphics context is released when the browser supports it.', '浏览器报告的渲染器，可能经过虚拟化或掩盖。不绘图、不生成哈希、不保存或传输；浏览器支持时会释放临时图形上下文。') }),
  def('fontHints', 'input', 'Candidate font hints', '候选字体提示', 'CSS font fallback + element width', 'Web/API/HTMLElement/offsetWidth', e => {
    const candidates = ['Arial', 'Georgia', 'Courier New', 'Verdana', 'Trebuchet MS', 'Garamond', 'Palatino', 'Consolas', 'Menlo', 'Monaco'];
    const baselines = ['monospace', 'sans-serif', 'serif'];
    const probe = e.document.createElement('span');
    probe.textContent = 'mmmmmmmmmmwwwwwiiiiii0123456789';
    probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;font-size:72px;font-weight:normal;font-style:normal;letter-spacing:normal;visibility:hidden;white-space:nowrap';
    e.document.body.appendChild(probe);
    try {
      const widths = baselines.map(base => { probe.style.fontFamily = base; return probe.offsetWidth; });
      return candidates.filter(font => baselines.some((base, i) => {
        probe.style.fontFamily = `"${font}", ${base}`;
        return probe.offsetWidth !== widths[i];
      }));
    } finally { probe.remove(); }
  }, { format: 'fonts', note: note('A small fixed candidate list inferred from text-width differences, not an installed-font inventory. Aliases, fallback, and privacy protections can cause false matches or omissions. No Local Font Access permission is requested.', '根据文字宽度差异推测一小组固定候选字体，并非已安装字体清单。别名、字体回退及隐私保护可能造成误报或遗漏。不申请本地字体访问权限。') })
];
