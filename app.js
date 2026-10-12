import { checks, detailChecks, GROUPS, metadata, collectFacts, cleanShareUrl, withTimeout } from './browser-info.js';
import { createPortrait, visitorRecords, visitorLabel, visitorValue, exportPortrait } from './portrait.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const requestedLanguage = new URLSearchParams(location.search).get('lang');
let language = ['en', 'zh'].includes(requestedLanguage) ? requestedLanguage : ((navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en');
const copy = {
  en: {
    series: 'A browser portrait · Vol. I', intro: 'You opened a page. A few details arrived with you.', privacy: 'A portrait made in this tab. The observations are not uploaded.',
    skip: 'Let me see', shown: 'Here you are', refresh: 'Take another look', export: 'Keep a copy', exportNote: 'Save these observations as a file (JSON) on your device. It contains device and setting details, so take a look before sharing it.',
    allFacts: 'Unfold the smaller details', filter: 'Find something', empty: 'Try another word.', optional: 'A little more of the picture',
    optionalNote: 'If you like, add the graphics and a few possible fonts behind the page. These two glimpses begin only when you choose.',
    details: 'Look at graphics & fonts', clearOptional: 'Put these details away',
    sessionHeading: 'While you were here', sessionNote: 'These little counts stay with you only on this page.',
    sources: 'A note on this portrait', share: 'Pass the page along', edition: 'A fleeting portrait. A little room for mystery.', credit: 'An independent study inspired by ',
    shareHeading: 'A page described a little of my device.', shareNote: 'The link carries only the page. None of your observations travel with it.', pageLink: 'Page link', copy: 'Copy link', close: 'Close',
    copied: 'Link copied.', copyFailed: 'Clipboard unavailable. Select and copy the link above.',
    sourcesHeading: 'Sources & confessions', sourcesNote: 'This portrait is made from details your browser shares with the page. These are device hints and settings, not a complete picture of you.',
    localTitle: 'What stays here', localNote: 'The observations stay in this tab’s memory. Activity is counted in totals; no typed words, exact pointer positions, or browsing history are recorded. This app does not save the observations in your browser or upload them. Reloading starts a new portrait. A copy is saved to your device only when you ask; downloaded files stay there until you remove them.',
    networkTitle: 'How the page arrives', networkNote: 'Your browser downloads the page and its fonts from the host, which may keep ordinary website access logs. Making this portrait sends no additional requests.',
    limitsTitle: 'The edges of the picture', limitsNote: 'This page does not retrieve your location, record sound or pictures, read browsing history, or look up your network address. Browser settings and privacy protections may alter what is reported. A hint is not proof of who you are.',
    reading: '', ready: '',
    checked: 'This moment', exportDone: 'Your copy is ready to download. Nothing was uploaded.', exportFailed: 'The download could not be prepared. Please try again.', controls: 'Portrait controls', facts: 'The smaller details', optionalFacts: 'Graphics and font observations', portrait: 'What came with your browser'
  },
  zh: {
    series: '浏览器画像 · 第一卷', intro: '你只是打开了页面。一些关于此刻的线索，已经随你抵达。', privacy: '这份画像只在当前标签页里展开。检测结果不会上传。',
    skip: '直接往下看', shown: '画像已展开', refresh: '再看一眼', export: '留一份副本', exportNote: '把这些信息存成设备上的文件（JSON）。其中有设备与设置详情，分享前请先看一眼。',
    allFacts: '展开那些更小的细节', filter: '找一找', empty: '换一个词试试。', optional: '还有两笔，可以由你添上',
    optionalNote: '如果愿意，再看看绘制页面的设备，以及几种可能的字体。这两笔，等你点头才开始。',
    details: '再看看图形与字体', clearOptional: '收起补充信息',
    sessionHeading: '你停留的这一会儿', sessionNote: '这些计数，只陪你停留在这一页。',
    sources: '关于这份画像', share: '把这一页递给别人', edition: '一幅片刻的画像，留一点未知。', credit: '独立研究，灵感来自 ',
    shareHeading: '一个页面，描述了我设备的一小部分。', shareNote: '链接只带走页面，不带走你的这些信息。', pageLink: '页面链接', copy: '复制链接', close: '关闭', copied: '链接已复制。', copyFailed: '剪贴板不可用，请选中上方链接手动复制。',
    sourcesHeading: '来源与坦白', sourcesNote: '这份画像来自浏览器交给页面的信息。它们是设备的线索与设置，拼不出一个完整的你。',
    localTitle: '哪些东西留在这里', localNote: '这些信息只留在当前标签页的内存里。页面只汇总互动次数，不记录输入的文字、指针的具体位置或浏览历史。应用不会把这些信息存入浏览器或上传。刷新页面，画像便重新开始。只有你选择保留副本时，才会在设备上生成文件；已下载的文件需要你自行删除。',
    networkTitle: '这一页如何抵达', networkNote: '浏览器从托管站点下载页面和字体，托管方可能保留普通的网站访问日志。生成画像的过程不会另发请求。',
    limitsTitle: '画像的边缘', limitsNote: '本页不获取你的位置，不拍摄或录音，不读取浏览历史，也不查询你的网络地址。浏览器设置与隐私保护可能改变呈现的信息。线索终究不是身份的证明。',
    reading: '', ready: '',
    checked: '这一刻', exportDone: '副本已准备好下载，没有上传任何信息。', exportFailed: '无法准备下载，请重试。', controls: '画像操作', facts: '更小的细节', optionalFacts: '图形与字体信息', portrait: '随浏览器一同抵达的信息'
  }
};

const state = { generation: 0, optionalGeneration: 0, records: new Map(), optional: new Map(), capturedAt: '', collecting: false, optionalBusy: 0, revealed: false, scanMessage: 'reading', clicks: 0, moves: 0, tabSwitches: 0, scrollMax: 0 };
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
  $('#portrait').setAttribute('aria-label', t('portrait'));
  $('#skipButton').textContent = t(state.revealed ? 'shown' : 'skip');
  for (const [id, record] of [...state.records, ...state.optional]) updateRow(record);
  $$('[data-group]').forEach(element => element.textContent = GROUPS[element.dataset.group][language]);
  renderPortrait();
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
      article.hidden = true;
      target.append(article);
      groups.set(check.group, list);
    }
    const wrapper = node('div', 'fact');
    wrapper.dataset.factId = check.id;
    wrapper.hidden = true;
    const term = node('dt');
    const label = node('span', 'fact-label');
    term.append(label);
    const definition = node('dd');
    const value = node('p', 'datum');
    definition.append(value);
    wrapper.append(term, definition);
    groups.get(check.group).append(wrapper);
    rows.set(check.id, { wrapper, label, value });
    updateRow(metadata(check));
  }
}

function updateRow(record) {
  const row = rows.get(record.id);
  if (!row) return;
  const disclosed = visitorRecords([record])[0];
  row.wrapper.hidden = !disclosed;
  row.label.textContent = disclosed ? visitorLabel(disclosed, language) : '';
  row.value.textContent = disclosed ? visitorValue(disclosed, language) : '';
}

function renderPortrait() {
  const chapters = createPortrait(state.records.values(), language);
  const fragments = chapters.map((chapter, index) => {
    const article = node('article', 'portrait-chapter');
    article.dataset.chapter = chapter.id;
    const number = node('p', 'chapter-number', String(index + 1).padStart(2, '0'));
    const heading = node('h2', '', chapter.title);
    const list = node('dl', 'portrait-lines');
    for (const line of chapter.lines) {
      const item = node('div', 'portrait-line');
      item.dataset.observation = line.id;
      item.append(node('dt', '', line.label), node('dd', '', line.value));
      list.append(item);
    }
    article.append(number, heading, list, node('p', 'prose', chapter.prose));
    return article;
  });
  $('#portrait').replaceChildren(...fragments);
}

function updateSummary() {
  const records = visitorRecords([...state.records.values(), ...state.optional.values()]);
  $('#exportButton').disabled = state.collecting || state.optionalBusy > 0 || !records.length;
  $('#inspector').setAttribute('aria-busy', String(state.collecting));
  $('#optionalResults').setAttribute('aria-busy', String(state.optionalBusy > 0));
  $('#scanStatus').textContent = t(state.scanMessage);
  $('#scanStatus').hidden = !t(state.scanMessage);
  $('#snapshotTime').textContent = state.capturedAt ? `${t('checked')}: ${new Date(state.capturedAt).toLocaleString(language === 'zh' ? 'zh-CN' : 'en')}` : '';
  $('#allFacts').hidden = visitorRecords(state.records.values()).length === 0;
  $('#clearOptionalButton').hidden = visitorRecords(state.optional.values()).length === 0 && state.optionalBusy === 0;
}

function filterRows() {
  const query = $('#filterInput').value.trim().toLocaleLowerCase();
  let visible = 0;
  for (const record of state.records.values()) {
    const row = rows.get(record.id);
    const disclosed = visitorRecords([record])[0];
    const matches = `${visitorLabel(record, 'en')} ${visitorLabel(record, 'zh')} ${disclosed ? visitorValue(disclosed, language) : ''}`.toLocaleLowerCase().includes(query);
    row.wrapper.hidden = !disclosed || !matches;
    if (!row.wrapper.hidden) visible++;
  }
  $$('.fact-group').forEach(group => { group.hidden = ![...group.querySelectorAll('.fact')].some(row => !row.hidden); });
  $('#emptyResults').hidden = !query || visible > 0;
}

function reveal() {
  state.revealed = true;
  $('#inspector').hidden = false;
  $('#skipButton').disabled = true;
  $('#skipButton').textContent = t('shown');
  document.body.classList.add('revealed');
}

function clearOptional() {
  state.optionalGeneration++;
  state.optionalBusy = 0;
  for (const id of state.optional.keys()) rows.delete(id);
  state.optional.clear();
  $('#optionalResults').replaceChildren();
  $('#detailsButton').disabled = false;
  $('#clearOptionalButton').hidden = true;
  updateSummary();
}

async function refresh() {
  const generation = ++state.generation;
  clearOptional();
  state.collecting = true;
  state.capturedAt = new Date().toISOString();
  state.records = new Map(checks.map(check => [check.id, metadata(check)]));
  state.scanMessage = 'reading';
  for (const record of state.records.values()) updateRow(record);
  renderPortrait();
  updateSummary();
  filterRows();
  await collectFacts({ onResult: result => {
    if (generation !== state.generation) return;
    state.records.set(result.id, result);
    updateRow(result);
    renderPortrait();
    filterRows();
    updateSummary();
  } });
  if (generation !== state.generation) return;
  state.collecting = false;
  state.scanMessage = 'ready';
  updateSummary();
}

async function runOptional(selected, button) {
  clearOptional();
  const generation = state.optionalGeneration;
  const mainGeneration = state.generation;
  button.disabled = true;
  state.optionalBusy++;
  for (const check of selected) state.optional.set(check.id, metadata(check));
  createRows(selected, $('#optionalResults'));
  $('#clearOptionalButton').hidden = false;
  updateSummary();
  await collectFacts({ selected, onResult: result => {
    if (generation !== state.optionalGeneration || mainGeneration !== state.generation) return;
    state.optional.set(result.id, result);
    updateRow(result);
    filterRows();
  } });
  if (generation !== state.optionalGeneration || mainGeneration !== state.generation) return;
  state.optionalBusy--;
  button.disabled = false;
  updateSummary();
}

function populateBehavior() {
  const seconds = Math.round((performance.now() - startedAt) / 1000);
  $('#behaviorText').textContent = language === 'zh'
    ? `你在这里停留了 ${seconds} 秒，最远翻到页面的 ${state.scrollMax}%，轻点了 ${state.clicks} 次。指针或触控移动了 ${state.moves} 次，页面转入后台 ${state.tabSwitches} 次。`
    : `You have spent ${seconds} seconds here, reached ${state.scrollMax}% down the page, and clicked ${state.clicks} times. There have been ${state.moves} pointer or touch movements and ${state.tabSwitches} moments with the page in the background.`;
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
$('#clearOptionalButton').addEventListener('click', () => clearOptional());
$('#filterInput').addEventListener('input', filterRows);
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
    const snapshot = exportPortrait([...state.records.values(), ...state.optional.values()], state.capturedAt, language);
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
