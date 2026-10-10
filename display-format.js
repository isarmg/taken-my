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
  if (record.format === 'graphics') return `${value.vendor} · ${value.renderer} · ${value.unmaskedExtension ? (zh ? '调试扩展可用' : 'Debug extension available') : (zh ? '通用渲染器' : 'Generic renderer')}`;
  if (typeof value === 'boolean') return value ? (zh ? '是' : 'Yes') : (zh ? '否' : 'No');
  if (Array.isArray(value)) {
    if (!value.length) return zh ? '未匹配' : 'No match';
    return value.join(' · ');
  }
  return String(value);
}
