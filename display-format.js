import { STATUS } from './browser-info.js';

export function formatBytes(bytes, language = 'en') {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const index = Math.max(0, Math.min(units.length - 1, Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024))));
  return `${new Intl.NumberFormat(language === 'zh' ? 'zh-CN' : 'en', { maximumFractionDigits: 1 }).format(bytes / 1024 ** index)} ${units[index]}`;
}

export function formatValue(record, language = 'en') {
  const zh = language === 'zh';
  if (record.status !== 'available') return STATUS[record.status]?.[language] || '—';
  const value = record.value;
  if (record.format === 'support') return value ? (zh ? '存在' : 'Present') : (zh ? '不存在' : 'Absent');
  if (record.format === 'permission') return ({ granted: zh ? '已允许' : 'Granted', denied: zh ? '已拒绝' : 'Denied', prompt: zh ? '需询问' : 'Prompt' })[value] || String(value);
  if (record.format === 'storage') return zh
    ? `使用约 ${formatBytes(value.usageBytes, language)} / 配额约 ${formatBytes(value.quotaBytes, language)}`
    : `About ${formatBytes(value.usageBytes, language)} used / ${formatBytes(value.quotaBytes, language)} quota`;
  if (record.format === 'battery') return `${value.levelPercent}% · ${value.charging ? (zh ? '正在充电' : 'Charging') : (zh ? '未充电' : 'Not charging')}`;
  if (record.format === 'graphics') return `${value.vendor} · ${value.renderer}`;
  if (record.format === 'queries') {
    const meanings = {
      '(pointer: fine)': ['Precise pointing, such as a mouse', '精细指针，例如鼠标'],
      '(pointer: coarse)': ['Coarse pointing, such as touch', '粗略指针，例如触控'],
      '(pointer: none)': ['No primary pointer', '没有主要指针'],
      '(any-pointer: fine)': ['Precise pointing is available', '可使用精细指针'],
      '(any-pointer: coarse)': ['Coarse pointing is available', '可使用粗略指针'],
      '(any-pointer: none)': ['No pointing device reported', '没有报告指针设备'],
      '(hover: hover)': ['Hover is available', '支持悬停'],
      '(hover: none)': ['No hover', '不支持悬停'],
      '(prefers-color-scheme: dark)': ['Dark', '深色'],
      '(prefers-color-scheme: light)': ['Light', '浅色'],
      '(prefers-reduced-motion: reduce)': ['Less motion', '减少动态效果'],
      '(prefers-reduced-motion: no-preference)': ['No special motion preference', '未特别设置动态效果偏好'],
      '(prefers-contrast: more)': ['More contrast', '更高对比度'],
      '(prefers-contrast: less)': ['Less contrast', '更低对比度'],
      '(prefers-contrast: custom)': ['Custom contrast', '自定对比度'],
      '(prefers-contrast: no-preference)': ['No special contrast preference', '未特别设置对比度偏好'],
      '(forced-colors: active)': ['A limited color palette is in use', '正在使用限定配色'],
      '(forced-colors: none)': ['No forced color palette', '未启用强制配色'],
      '(color-gamut: srgb)': ['sRGB colors', 'sRGB 色彩'],
      '(color-gamut: p3)': ['P3 wide colors', 'P3 广色域'],
      '(color-gamut: rec2020)': ['Rec. 2020 wide colors', 'Rec. 2020 广色域'],
      '(dynamic-range: standard)': ['Standard brightness range', '标准亮度范围'],
      '(dynamic-range: high)': ['High brightness range', '高亮度范围']
    };
    return value.map(query => meanings[query]?.[zh ? 1 : 0] || query).join(' · ') || (zh ? '未匹配' : 'No match');
  }
  if (typeof value === 'boolean') return value ? (zh ? '是' : 'Yes') : (zh ? '否' : 'No');
  if (Array.isArray(value)) {
    if (!value.length) return zh ? '未匹配' : 'No match';
    return value.join(' · ');
  }
  return String(value);
}
