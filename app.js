import { checks, detailChecks, permissionChecks, GROUPS, STATUS, metadata, collectFacts, cleanShareUrl, exportSnapshot, withTimeout } from './browser-info.js';
import { formatValue } from './display-format.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const requestedLanguage = new URLSearchParams(location.search).get('lang');
let language = ['en', 'zh'].includes(requestedLanguage) ? requestedLanguage : ((navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en');
const copy = {
  en: {
    series: 'A browser portrait · Local edition', intro: 'See what arrives with your browser.', privacy: 'Calculated here. No accounts, cloud APIs, analytics, or uploads.',
    skip: 'Show now', shown: 'All fields shown', refresh: 'Check again', export: 'Export local JSON', exportNote: 'Export includes device and setting details. Review the downloaded file before sharing.',
    filter: 'Find a field', availableOnly: 'Available only', empty: 'No matching fields.', optional: 'Look a little closer',
    optionalNote: 'Optional checks run only when you press their button. Permission states are read without asking for new access; location, camera, and microphone are never activated.',
    details: 'Inspect graphics & font hints', permissions: 'Read permission states', clearOptional: 'Clear optional results', optionalCleared: 'Optional results cleared from this page.',
    sessionHeading: 'This tab, this moment', sessionNote: 'Only aggregate counters in this page’s memory. No keystrokes, pointer coordinates, browsing history, or cross-site identifier.',
    sources: 'Sources & limits', share: 'Copy page link', edition: 'Standard APIs. Nothing bypassed.', credit: 'An independent study inspired by ',
    shareHeading: 'Share the page, not your snapshot.', shareNote: 'This link excludes the query string, fragment, and all detected values. No social network is contacted by this page.', pageLink: 'Page link', copy: 'Copy link', close: 'Close',
    copied: 'Link copied.', copyFailed: 'Clipboard unavailable. Select and copy the link above.',
    sourcesHeading: 'Sources & limits', sourcesNote: 'Every field names its documented browser API and links to its source. Missing values can mean unsupported APIs, privacy protections, policy restrictions, or a timeout. They are never treated as proof about you.',
    localTitle: 'What stays local', localNote: 'Results live only in this tab’s memory. The app never writes cookies, localStorage, sessionStorage, IndexedDB, or an identifier. Export creates a file only when you ask. Reloading or clearing optional results discards them from the page; downloaded files remain on your device.',
    networkTitle: 'What uses the network', networkNote: 'Your browser downloads this page, scripts, styles, and bundled fonts from its host. Like any website, the host can see ordinary requests and may log them; this app cannot control hosting logs. Detection sends no requests. External documentation links open only when clicked. Browser vendors may implement APIs internally; this app cannot audit the browser itself.',
    limitsTitle: 'No hidden access', limitsNote: 'No IP lookup, geolocation retrieval, camera or microphone capture, WebRTC/STUN/TURN, port scan, network speed test, exploit, or permission bypass. API presence does not mean permission. Reported values can be approximate, masked, stale, or spoofed.',
    permissionTitle: 'Permissions stay yours', permissionNote: 'The optional permission check only reads existing states. “Prompt” means a real access attempt would need your permission; this page never makes that attempt. Manage permissions in your browser’s site settings.',
    reading: 'Reading independent local checks…', ready: 'Snapshot ready. Check again after changing settings or resizing.', optionalReading: 'Reading optional local checks…', optionalReady: 'Optional checks finished. Each field shows its own status.',
    source: 'Source & explanation', checked: 'Snapshot started', exportDone: 'Local JSON download prepared. Nothing uploaded.', exportFailed: 'The download could not be prepared. Please try again.', controls: 'Browser inspector controls', facts: 'Browser facts', optionalFacts: 'Optional browser facts', snapshot: 'Snapshot status'
  },
  zh: {
    series: '浏览器画像 · 本地版', intro: '看看是什么与你的浏览器一同抵达。', privacy: '在这里计算。无需账号，不接入云端 API、统计分析或上传服务。',
    skip: '立即查看', shown: '已显示所有字段', refresh: '重新检测', export: '导出本地 JSON', exportNote: '导出包含设备和设置详情，请先检查下载的文件再分享。',
    filter: '查找字段', availableOnly: '仅显示已获取', empty: '没有匹配的字段。', optional: '再看仔细一点',
    optionalNote: '可选检测只在你点击对应按钮后运行。读取已有权限状态，不申请新权限；从不启用定位、摄像头或麦克风。',
    details: '查看图形与字体提示', permissions: '读取权限状态', clearOptional: '清除可选结果', optionalCleared: '已从当前页面清除可选结果。',
    sessionHeading: '这个标签页，这一刻', sessionNote: '仅在页面内存中保留汇总计数，不记录按键、指针坐标、浏览历史或跨站标识。',
    sources: '来源与局限', share: '复制页面链接', edition: '标准 API，不绕过任何限制。', credit: '独立研究，灵感来自 ',
    shareHeading: '分享页面，不分享你的检测快照。', shareNote: '链接不包含查询参数、片段或任何检测结果。本页面不连接社交网络。', pageLink: '页面链接', copy: '复制链接', close: '关闭', copied: '链接已复制。', copyFailed: '剪贴板不可用，请选中上方链接手动复制。',
    sourcesHeading: '来源与局限', sourcesNote: '每个字段都列出所用的公开浏览器 API 和文档链接。缺失值可能源于不支持、隐私保护、策略限制或超时，不能据此判断你的情况。',
    localTitle: '哪些信息留在本地', localNote: '结果仅存在于当前标签页内存中。应用不写入 Cookie、localStorage、sessionStorage、IndexedDB 或身份标识。仅在你点击导出时生成文件。刷新或清除可选结果会丢弃页面中的相应结果，已下载的文件仍保留在设备上。',
    networkTitle: '哪些操作使用网络', networkNote: '浏览器需要从托管站点下载页面、脚本、样式和自带字体。与普通网站一样，托管方可看到常规请求并可能记录日志，应用无法控制托管日志。检测过程不发送请求。外部文档链接仅在点击时打开。浏览器厂商可能在内部实现 API，本应用无法审计浏览器本身。',
    limitsTitle: '没有隐藏访问', limitsNote: '不查询 IP、不获取地理位置、不启动摄像头或麦克风，不使用 WebRTC/STUN/TURN、端口扫描、网络测速、漏洞或权限绕过。API 存在不代表有访问权限。报告值可能近似、被隐藏、过期或被伪装。',
    permissionTitle: '权限由你掌握', permissionNote: '可选权限检查只读取已有状态。“需询问”表示真正尝试访问时需要征得同意，本页面不会进行这种尝试。你可以在浏览器的站点设置中管理权限。',
    reading: '正在独立读取各项本地信息…', ready: '快照已就绪。更改设置或调整窗口后可重新检测。', optionalReading: '正在读取可选本地信息…', optionalReady: '可选检测已完成，每个字段都有独立状态。',
    source: '来源与说明', checked: '快照开始时间', exportDone: '本地 JSON 下载已准备好，没有上传任何信息。', exportFailed: '无法准备下载，请重试。', controls: '浏览器检测操作', facts: '浏览器信息', optionalFacts: '可选浏览器信息', snapshot: '快照状态'
  }
};

const state = { generation: 0, optionalGeneration: 0, records: new Map(), optional: new Map(), capturedAt: '', collecting: false, optionalBusy: 0, revealed: false, scanMessage: 'reading', optionalMessage: '', clicks: 0, moves: 0, tabSwitches: 0, scrollMax: 0 };
const rows = new Map();
const startedAt = performance.now();
let copyGeneration = 0;
const t = key => copy[language][key];
function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function applyLanguage() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.title = language === 'zh' ? 'taken. — 浏览器画像' : 'taken. — browser portrait';
  $('meta[name="description"]').setAttribute('content', `${t('intro')} ${t('privacy')}`);
  $$('[data-i18n]').forEach(element => element.textContent = t(element.dataset.i18n));
  $('#languageSwitch').textContent = language === 'zh' ? 'EN' : '中文';
  $('#languageSwitch').setAttribute('aria-label', language === 'zh' ? 'Switch to English' : '切换到中文');
  $('#toolbar').setAttribute('aria-label', t('controls'));
  $('#observations').setAttribute('aria-label', t('facts'));
  $('#optionalResults').setAttribute('aria-label', t('optionalFacts'));
  $('.snapshot-summary').setAttribute('aria-label', t('snapshot'));
  $('#skipButton').textContent = t(state.revealed ? 'shown' : 'skip');
  for (const [id, record] of [...state.records, ...state.optional]) updateRow(record);
  $$('[data-group]').forEach(element => element.textContent = GROUPS[element.dataset.group][language]);
  updateSummary();
  populateBehavior();
  filterRows();
}

function createRows(selected, target) {
  const groups = new Map();
  for (const check of selected) {
    if (!groups.has(check.group)) {
      const article = node('article', 'observation fact-group');
      const heading = node('h2', '', GROUPS[check.group][language]);
      heading.dataset.group = check.group;
      const list = node('dl', 'fact-list');
      article.append(heading, list);
      target.append(article);
      groups.set(check.group, list);
    }
    const wrapper = node('div', 'fact');
    wrapper.dataset.factId = check.id;
    const term = node('dt');
    const label = node('span', 'fact-label');
    const status = node('span', 'fact-status');
    term.append(label, status);
    const definition = node('dd');
    const value = node('p', 'datum');
    const details = node('details', 'fact-details');
    const summary = node('summary');
    const source = node('a', 'source-link', check.source);
    source.href = check.docs;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    const explanation = node('p');
    details.append(summary, source, explanation);
    definition.append(value, details);
    wrapper.append(term, definition);
    groups.get(check.group).append(wrapper);
    rows.set(check.id, { wrapper, label, status, value, summary, explanation });
    updateRow(metadata(check));
  }
}

function updateRow(record) {
  const row = rows.get(record.id);
  if (!row) return;
  row.label.textContent = record.label[language];
  row.status.textContent = STATUS[record.status][language];
  row.status.dataset.status = record.status;
  row.value.textContent = formatValue(record, language);
  row.summary.textContent = t('source');
  row.explanation.textContent = record.note[language];
}

function updateSummary() {
  const records = [...state.records.values()];
  const available = records.filter(record => record.status === 'available').length;
  const pending = records.filter(record => record.status === 'pending').length;
  $('#scanStatus').textContent = t(state.scanMessage);
  $('#optionalStatus').textContent = state.optionalMessage ? t(state.optionalMessage) : '';
  $('#summaryCount').textContent = language === 'zh'
    ? `${records.length} 个字段 · ${available} 项已获取 · ${pending} 项读取中 · ${records.length - available - pending} 项未获取`
    : `${records.length} fields · ${available} available · ${pending} reading · ${records.length - available - pending} not available`;
  $('#snapshotTime').textContent = state.capturedAt ? `${t('checked')}: ${new Date(state.capturedAt).toLocaleString(language === 'zh' ? 'zh-CN' : 'en')}` : '';
}

function filterRows() {
  const query = $('#filterInput').value.trim().toLocaleLowerCase();
  const availableOnly = $('#availableOnly').checked;
  let visible = 0;
  for (const record of state.records.values()) {
    const row = rows.get(record.id);
    const matches = `${record.label.en} ${record.label.zh} ${record.source} ${formatValue(record, language)}`.toLocaleLowerCase().includes(query);
    row.wrapper.hidden = !matches || (availableOnly && record.status !== 'available');
    if (!row.wrapper.hidden) visible++;
  }
  $$('#observations .fact-group').forEach(group => { group.hidden = ![...group.querySelectorAll('.fact')].some(row => !row.hidden); });
  $('#emptyResults').hidden = visible > 0;
}

function reveal() {
  state.revealed = true;
  $('#inspector').hidden = false;
  $('#skipButton').disabled = true;
  $('#skipButton').textContent = t('shown');
  document.body.classList.add('revealed');
}

function clearOptional({ announce = true } = {}) {
  state.optionalGeneration++;
  state.optionalBusy = 0;
  for (const id of state.optional.keys()) rows.delete(id);
  state.optional.clear();
  $('#optionalResults').replaceChildren();
  $('#detailsButton').disabled = false;
  $('#permissionsButton').disabled = false;
  $('#clearOptionalButton').hidden = true;
  state.optionalMessage = announce ? 'optionalCleared' : '';
  updateSummary();
}

async function refresh() {
  const generation = ++state.generation;
  clearOptional({ announce: false });
  state.collecting = true;
  state.capturedAt = new Date().toISOString();
  state.records = new Map(checks.map(check => [check.id, metadata(check)]));
  state.scanMessage = 'reading';
  $('#exportButton').disabled = true;
  for (const record of state.records.values()) updateRow(record);
  updateSummary();
  filterRows();
  await collectFacts({ onResult: result => {
    if (generation !== state.generation) return;
    state.records.set(result.id, result);
    updateRow(result);
    filterRows();
    updateSummary();
  } });
  if (generation !== state.generation) return;
  state.collecting = false;
  state.scanMessage = 'ready';
  $('#exportButton').disabled = false;
  updateSummary();
}

async function runOptional(selected, button) {
  const generation = state.optionalGeneration;
  const mainGeneration = state.generation;
  button.disabled = true;
  state.optionalBusy++;
  state.optionalMessage = 'optionalReading';
  for (const check of selected) state.optional.set(check.id, metadata(check));
  createRows(selected, $('#optionalResults'));
  $('#clearOptionalButton').hidden = false;
  updateSummary();
  await collectFacts({ selected, onResult: result => {
    if (generation !== state.optionalGeneration || mainGeneration !== state.generation) return;
    state.optional.set(result.id, result);
    updateRow(result);
  } });
  if (generation !== state.optionalGeneration || mainGeneration !== state.generation) return;
  state.optionalBusy--;
  state.optionalMessage = state.optionalBusy ? 'optionalReading' : 'optionalReady';
  updateSummary();
}

function populateBehavior() {
  const seconds = Math.round((performance.now() - startedAt) / 1000);
  $('#behaviorText').textContent = language === 'zh'
    ? `停留 ${seconds} 秒 · 滚动最远 ${state.scrollMax}% · 指针/触控移动 ${state.moves} 次 · 点击 ${state.clicks} 次 · 离开标签页 ${state.tabSwitches} 次`
    : `${seconds}s here · ${state.scrollMax}% maximum scroll · ${state.moves} pointer/touch moves · ${state.clicks} clicks · ${state.tabSwitches} tab departures`;
}

document.addEventListener('pointermove', () => state.moves++, { passive: true });
// Pointer events cover mice, pens, and touch without double-counting touchmove.
document.addEventListener('click', () => state.clicks++);
document.addEventListener('visibilitychange', () => { if (document.hidden) state.tabSwitches++; });
window.addEventListener('scroll', () => { state.scrollMax = Math.max(state.scrollMax, Math.min(100, Math.round(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight) * 100))); }, { passive: true });
setInterval(() => { if (!document.hidden) populateBehavior(); }, 1000);

$('#skipButton').addEventListener('click', reveal);
$('#refreshButton').addEventListener('click', () => { reveal(); refresh(); });
$('#detailsButton').addEventListener('click', () => runOptional(detailChecks, $('#detailsButton')));
$('#permissionsButton').addEventListener('click', () => runOptional(permissionChecks, $('#permissionsButton')));
$('#clearOptionalButton').addEventListener('click', () => clearOptional());
$('#filterInput').addEventListener('input', filterRows);
$('#availableOnly').addEventListener('change', filterRows);
$('#languageSwitch').addEventListener('click', () => {
  language = language === 'en' ? 'zh' : 'en';
  const url = new URL(location.href);
  url.searchParams.set('lang', language);
  history.replaceState(null, '', url);
  $('#copyStatus').textContent = '';
  applyLanguage();
});
$('#exportButton').addEventListener('click', () => {
  try {
    const snapshot = exportSnapshot([...state.records.values(), ...state.optional.values()], state.capturedAt);
    const blob = new Blob([`${JSON.stringify(snapshot, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `taken-browser-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    state.scanMessage = 'exportDone';
  } catch { state.scanMessage = 'exportFailed'; }
  updateSummary();
});

$$('[data-open]').forEach(button => button.addEventListener('click', () => {
  const dialog = button.dataset.open === 'share' ? $('#shareModal') : $('#sourcesModal');
  if (button.dataset.open === 'share') {
    copyGeneration++;
    $('#copyButton').disabled = false;
    $('#shareUrl').value = cleanShareUrl(location.href);
    $('#copyStatus').textContent = '';
  }
  if (!dialog.open) dialog.showModal();
}));
$$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$$('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); }));
$('#shareModal').addEventListener('close', () => {
  copyGeneration++;
  $('#copyButton').disabled = false;
  $('#copyStatus').textContent = '';
});
$('#copyButton').addEventListener('click', async () => {
  const generation = ++copyGeneration;
  $('#copyButton').disabled = true;
  $('#copyStatus').textContent = '';
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await withTimeout(() => navigator.clipboard.writeText($('#shareUrl').value));
    if (generation !== copyGeneration || !$('#shareModal').open) return;
    $('#copyStatus').textContent = t('copied');
  } catch {
    if (generation !== copyGeneration || !$('#shareModal').open) return;
    $('#copyStatus').textContent = t('copyFailed');
    $('#shareUrl').focus();
    $('#shareUrl').select();
  } finally { if (generation === copyGeneration) $('#copyButton').disabled = false; }
});

$('#inspector').hidden = true;
createRows(checks, $('#observations'));
applyLanguage();
refresh();
if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) reveal();
else setTimeout(reveal, 1400);
