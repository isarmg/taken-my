import { formatBytes, formatValue } from './display-format.js';

// Presentation only: this module reads the existing snapshot, never the browser.
// Only useful visitor facts cross into the page or its downloadable copy.
const visitorLabels = {
  userAgent: ['Browser and system, as reported', '浏览器与系统的自述'],
  languages: ['Preferred languages', '偏好的语言'],
  timeZone: ['Device time zone', '设备上的时区'],
  utcOffset: ['Time difference from UTC', '与世界标准时间的时差'],
  screen: ['Screen size, in page pixels', '屏幕大小（页面像素）'],
  availableScreen: ['Usable screen size, in page pixels', '可用屏幕大小（页面像素）'],
  viewport: ['Page window, in page pixels', '页面窗口大小（页面像素）'],
  pixelRatio: ['Screen pixels per page pixel', '每个页面像素对应的屏幕像素数'],
  colorDepth: ['Color depth, in bits', '色彩深度（位）'],
  orientation: ['Screen direction', '屏幕方向'],
  touchPoints: ['Simultaneous touches reported', '报告的同时触控点数'],
  logicalProcessors: ['Processing threads reported', '报告的处理线程数'],
  deviceMemory: ['Approximate memory, in GiB', '大致的内存容量（GiB）'],
  colorScheme: ['Light and dark', '明与暗'],
  reducedMotion: ['Movement preference', '动态效果偏好'],
  contrast: ['Contrast preference', '对比度偏好'],
  online: ['Browser connection hint', '浏览器报告的连接状态'],
  downlink: ['Estimated download rate, in Mbps', '估计下载速率（Mbps）'],
  rtt: ['Estimated connection delay, in milliseconds', '估计连接延迟（毫秒）'],
  saveData: ['Data-saving preference', '节省流量'],
  storage: ['Storage offered to this site', '留给这个站点的存储'],
  battery: ['Battery, as reported now', '浏览器此刻报告的电量'],
  visibility: ['Where this page is', '页面此刻的位置'],
  focused: ['This page has your focus', '当前焦点是否在本页'],
  graphics: ['What renders your world', '渲染你眼前世界的东西'],
  fontHints: ['A few possible fonts', '你可能随身带着的字体']
};

export function visitorRecords(records) {
  return [...records].filter(record => record.status === 'available' && Object.hasOwn(visitorLabels, record.id))
    .map(record => ({ ...record, value: Array.isArray(record.value)
      ? record.value.filter(value => typeof value === 'string' && value.trim()).map(value => value.trim())
      : typeof record.value === 'string' ? record.value.trim() : record.value }))
    .filter(record => record.value !== null && record.value !== undefined && record.value !== ''
      && (typeof record.value !== 'number' || Number.isFinite(record.value))
      && (!Array.isArray(record.value) || record.value.length > 0)
      && (record.id !== 'userAgent' || browserDescription(record.value)));
}

export function visitorLabel(record, language = 'en') {
  return visitorLabels[record.id]?.[language === 'zh' ? 1 : 0] || '';
}

export function visitorValue(record, language = 'en') {
  const zh = language === 'zh';
  if (record.id === 'userAgent') return browserDescription(record.value);
  if (record.id === 'languages') return languageNames(record.value, language);
  if (record.id === 'timeZone') return String(record.value);
  if (record.id === 'utcOffset') {
    const minutes = Number(record.value);
    const sign = minutes < 0 ? '−' : '+';
    return `UTC${sign}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, '0')}:${String(Math.abs(minutes) % 60).padStart(2, '0')}`;
  }
  if (record.id === 'online') return record.value ? (zh ? '在线' : 'Online') : (zh ? '离线' : 'Offline');
  if (record.id === 'saveData') return record.value ? (zh ? '开启' : 'On') : (zh ? '关闭' : 'Off');
  if (record.id === 'orientation') return ({
    'landscape-primary': zh ? '横向' : 'Landscape', 'landscape-secondary': zh ? '横向（旋转）' : 'Landscape, rotated',
    'portrait-primary': zh ? '纵向' : 'Portrait', 'portrait-secondary': zh ? '纵向（旋转）' : 'Portrait, rotated'
  })[record.value] || String(record.value);
  if (record.id === 'visibility') return ({ visible: zh ? '在前台' : 'In the foreground', hidden: zh ? '在后台' : 'In the background' })[record.value] || String(record.value);
  return formatValue(record, language);
}

export function exportPortrait(records, capturedAt, language = 'en') {
  return {
    schemaVersion: 1, capturedAt,
    privacy: language === 'zh' ? '仅包含本页展示的信息，在你的浏览器中生成。分享前请先检查。' : 'Contains only the observations shown on this page, prepared in your browser. Review before sharing.',
    facts: visitorRecords(records).map(record => ({ label: visitorLabel(record, language), value: visitorValue(record, language) }))
  };
}

const text = (en, zh, language) => language === 'zh' ? zh : en;

export function browserDescription(userAgent) {
  const ua = String(userAgent);
  const browser = /Edg(?:A|iOS)?\//.test(ua) ? 'Edge'
    : /SamsungBrowser\//.test(ua) ? 'Samsung Internet'
      : /(?:OPR|OPiOS|Opera)\//.test(ua) ? 'Opera'
      : /(?:Firefox|FxiOS)\//.test(ua) ? 'Firefox'
        : /(?:Chrome|CriOS)\//.test(ua) ? 'Chrome'
          : /Version\/.*Safari\//.test(ua) ? 'Safari' : '';
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
      : /Windows/.test(ua) ? 'Windows'
        : /CrOS/.test(ua) ? 'ChromeOS'
          : /Macintosh|Mac OS/.test(ua) ? 'macOS'
            : /Linux/.test(ua) ? 'Linux' : '';
  return [browser, os].filter(Boolean).join(' · ');
}

function languageNames(values, language) {
  return values.map(value => {
    try { return new Intl.DisplayNames([language === 'zh' ? 'zh-CN' : 'en'], { type: 'language' }).of(value) || value; }
    catch { return String(value); }
  }).join(' · ');
}

export function createPortrait(records, language = 'en') {
  const facts = new Map(visitorRecords(records).map(record => [record.id, record]));
  const choose = (en, zh) => text(en, zh, language);
  const line = (id, en, zh, formatter = record => visitorValue(record, language)) => {
    const record = facts.get(id);
    if (!record) return null;
    const value = formatter(record);
    if (!value) return null;
    return { id, label: choose(en, zh), value };
  };
  const chapter = (id, en, zh, lines, proseEn, proseZh) => ({
    id, title: choose(en, zh), lines: lines.filter(Boolean), prose: choose(proseEn, proseZh)
  });
  return [
    chapter('arrival', 'The time you brought', '你抵达的时间', [
      line('timeZone', 'Your device’s time zone', '设备上的时区'),
      line('utcOffset', 'Its distance from universal time', '与世界标准时间的时差', record => {
        const minutes = Number(record.value);
        const sign = minutes < 0 ? '−' : '+';
        return `UTC${sign}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, '0')}:${String(Math.abs(minutes) % 60).padStart(2, '0')}`;
      })
    ], 'Your device brought its own clock. For a moment, this page keeps time with it.',
    '设备带来了自己的时钟。这一刻，页面也跟着它走了一小步。'),
    chapter('device', 'What you brought with you', '你带来的东西', [
      line('userAgent', 'Browser and system, as reported', '浏览器与系统的自述', record => browserDescription(record.value)),
      line('screen', 'Screen, in page pixels', '屏幕大小（页面像素）'),
      line('viewport', 'Room for this page', '留给这一页的空间（页面像素）'),
      line('touchPoints', 'Simultaneous touches reported', '报告的同时触控点数')
    ], 'A few details give this page its frame. The words settle into the room you brought.',
    '你带来几笔设备的轮廓，文字便在其中安顿下来。'),
    chapter('languages', 'The words that came with you', '你所使用的语言', [
      line('languages', 'Preferred languages, in order', '按偏好排列的语言', record => languageNames(record.value, language))
    ], 'A small list of languages came with you. The one at the top was the first to say hello.',
    '一张语言清单随你而来。排在最前面的那一行，先替你向这一页问好。'),
    chapter('preferences', 'How you like the page to feel', '你习惯的光与动静', [
      line('colorScheme', 'Light and dark', '明与暗'),
      line('reducedMotion', 'Movement', '动态效果'),
      line('contrast', 'Contrast', '对比度')
    ], 'The page found a few of your display preferences waiting at the door. Small choices, shaping the way words appear.',
    '几项显示偏好先一步到了门口。小小的选择，也会改变文字与你见面的样子。'),
    chapter('resources', 'How much is left', '还剩下多少', [
      line('battery', 'Battery, as reported now', '浏览器此刻报告的电量'),
      line('storage', 'Estimated storage allowance for this site', '这个站点的估算存储配额', record => choose(
        `About ${formatBytes(record.value.quotaBytes, language)} allowed · ${formatBytes(record.value.usageBytes, language)} used`,
        `配额约 ${formatBytes(record.value.quotaBytes, language)} · 已用约 ${formatBytes(record.value.usageBytes, language)}`))
    ], 'For a moment, the browser let a few numbers surface. Leave and return, and the picture may have shifted.',
    '几个数字从浏览器里浮上来，停在这一刻。等你下次经过，它们或许已经换了模样。'),
    chapter('connection', 'A hint of the connection', '此刻，连接的样子', [
      line('online', 'Browser connection hint', '浏览器报告的连接状态', record => choose(record.value ? 'Online' : 'Offline', record.value ? '在线' : '离线')),
      line('downlink', 'Estimated download rate', '估计的下载速率', record => `${record.value} Mbps`),
      line('saveData', 'Data-saving preference', '节省流量', record => choose(record.value ? 'On' : 'Off', record.value ? '开启' : '关闭'))
    ], 'A few connection hints came along for the journey. Here is how the browser describes this moment.',
    '连接也带来了几句近况。这是浏览器此刻的描述，写在你停留的这一页。')
  ].filter(section => section.lines.length > 0);
}
