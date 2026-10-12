import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';
import * as browserInfo from '../../browser-info.js';
import * as portrait from '../../portrait.js';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../../app.js', import.meta.url), 'utf8');
const appSource = source.replace(/^import .* from '\.\/(?:browser-info|portrait)\.js';\r?\n/gm, '');
assert.doesNotMatch(appSource, /^import /m, 'Update the controlled harness if the app adds another dependency');
const dependencyNames = ['checks', 'detailChecks', 'GROUPS', 'metadata', 'collectFacts', 'cleanShareUrl', 'withTimeout', 'createPortrait', 'visitorRecords', 'visitorLabel', 'visitorValue', 'exportPortrait'];

const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function waitFor(condition, description, timeoutMs = 2500) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    assert.ok(Date.now() < deadline, `Timed out waiting for ${description}`);
    await new Promise(resolve => setTimeout(resolve, 2));
  }
}

function define(target, name, value) {
  Object.defineProperty(target, name, { configurable: true, value });
}

function setup(t, { url = 'https://example.test/portrait/?lang=en', navigatorLanguage = 'en-US', reducedMotion = false, copyTimeoutMs = 40, beforeStart = () => {} } = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  // Resource loading is deliberately not enabled. No HTML script, stylesheet,
  // font, image, or external page is fetched by this outside-only DOM harness.
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', virtualConsole });
  const { window } = dom;
  const document = window.document;
  const calls = { collections: [], permissions: [], forbidden: [], downloads: [], objects: [], revoked: [] };
  const collections = [];
  const copies = [];
  const forbidden = name => () => { calls.forbidden.push(name); throw new Error(`Unexpected operation: ${name}`); };
  define(window, 'isSecureContext', true);
  define(window.navigator, 'language', navigatorLanguage);
  define(window.navigator, 'languages', [navigatorLanguage]);
  define(window.navigator, 'userAgent', 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36');
  window.HTMLCanvasElement.prototype.getContext = () => null;
  define(window.navigator, 'storage', { estimate: async () => ({ quota: 1024, usage: 0 }), persisted: async () => false, persist: forbidden('storage.persist') });
  define(window.navigator, 'getBattery', async () => ({ level: 0.5, charging: false }));
  define(window.navigator, 'permissions', {
    query: async ({ name }) => { calls.permissions.push(name); return { state: name === 'geolocation' ? 'denied' : 'prompt' }; }
  });
  define(window.navigator, 'geolocation', { getCurrentPosition: forbidden('geolocation'), watchPosition: forbidden('watchPosition') });
  define(window.navigator, 'mediaDevices', { getUserMedia: forbidden('getUserMedia'), enumerateDevices: forbidden('enumerateDevices') });
  define(window.navigator, 'clipboard', { writeText: async () => {} });
  window.matchMedia = query => ({ matches: reducedMotion && query === '(prefers-reduced-motion: reduce)' });
  for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'RTCPeerConnection', 'queryLocalFonts']) window[name] = forbidden(name);
  window.navigator.sendBeacon = forbidden('sendBeacon');
  // jsdom does not implement modal presentation. Only model its open/closed
  // state here; native focus management, Escape, and layout need browser QA.
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  window.URL.createObjectURL = blob => {
    const href = `blob:https://example.test/export-${calls.objects.length + 1}`;
    calls.objects.push({ href, blob });
    return href;
  };
  window.URL.revokeObjectURL = href => calls.revoked.push(href);
  window.HTMLAnchorElement.prototype.click = function () { calls.downloads.push({ href: this.href, filename: this.download, connected: this.isConnected }); };
  window.__appDependencies = {
    ...browserInfo, ...portrait,
    collectFacts(options = {}) {
      calls.collections.push(options.selected?.map(check => check.id) ?? browserInfo.checks.map(check => check.id));
      const task = browserInfo.collectFacts({ env: window, timeoutMs: 500, ...options });
      collections.push(task);
      return task;
    },
    withTimeout(work, timeoutMs = copyTimeoutMs) {
      const task = browserInfo.withTimeout(work, timeoutMs);
      copies.push(task);
      return task;
    }
  };
  t.after(async () => {
    try {
      // Let bounded API tasks settle before removing their DOM, including when
      // an assertion fails, then always dispose of app intervals and timers.
      await Promise.allSettled([...collections, ...copies]);
      await tick();
      assert.deepEqual(errors.map(error => error.message), [], 'No uncaught script/DOM errors');
      assert.deepEqual(calls.forbidden, [], 'No active sensor/network calls');
    } finally { window.close(); }
  });
  beforeStart(window, calls);
  window.eval(`const { ${dependencyNames.join(', ')} } = window.__appDependencies;\n${appSource}`);
  const $ = selector => document.querySelector(selector);
  const all = selector => [...document.querySelectorAll(selector)];
  const fact = id => $(`[data-fact-id="${id}"]`);
  const ready = () => waitFor(() => $('#inspector').getAttribute('aria-busy') === 'false', 'the main snapshot');
  const optionalReady = () => waitFor(() => $('#optionalResults').getAttribute('aria-busy') === 'false', 'optional results');
  const input = value => { $('#filterInput').value = value; $('#filterInput').dispatchEvent(new window.Event('input', { bubbles: true })); };
  return { dom, window, document, calls, $, all, fact, ready, optionalReady, input, collections };
}

async function readDownload(app, index = app.calls.objects.length - 1) {
  const { blob } = app.calls.objects[index];
  assert.equal(blob.type, 'application/json');
  const text = await new Promise((resolve, reject) => {
    const reader = new app.window.FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
  return { text, snapshot: JSON.parse(text) };
}


const displayed = (app, selector = '#observations .fact') => app.all(selector).filter(row => !row.hidden);
const optionalValue = id => id === 'graphics' ? { vendor: 'Local vendor', renderer: 'Local renderer', unmaskedExtension: false } : ['Arial'];
function mockOptional(window, read = optionalValue) {
  window.__appDependencies.detailChecks = browserInfo.detailChecks.map(check => ({ ...check, read: () => read(check.id) }));
}

test('DOM: startup reveals a literary portrait, with only successful human-readable facts in the closed appendix', async t => {
  const app = setup(t);
  assert.equal(app.$('#inspector').hidden, true);
  assert.equal(app.$('#exportButton').disabled, true);
  app.$('#skipButton').click();
  app.$('#skipButton').click();
  assert.equal(app.$('#inspector').hidden, false);
  assert.equal(app.$('#skipButton').disabled, true);
  await app.ready();
  assert.equal(app.calls.collections.length, 1);
  assert.deepEqual(app.calls.permissions, []);
  assert.equal(app.$('#permissionsButton'), null);
  assert.equal(app.$('#availableOnly'), null);
  assert.equal(app.$('#allFacts').open, false);
  assert.ok(app.all('.portrait-chapter').length > 0);
  assert.ok(displayed(app).length > 0);
  assert.equal(app.all('.source-link, .fact-status').length, 0);
  assert.equal(app.fact('api-geolocation').hidden, true);
  assert.equal(app.fact('secureContext').hidden, true);
  assert.doesNotMatch(app.$('#inspector').textContent, /navigator\.|window\.|matchMedia|Not exposed|Blocked|读取失败|未提供/);
  assert.equal(app.$('#exportButton').disabled, false);
  assert.equal(app.window.localStorage.length, 0);
  assert.equal(app.window.sessionStorage.length, 0);
  assert.equal(app.document.cookie, '');
});

test('DOM: bilingual portrait and search reuse the same snapshot without introducing raw API names', async t => {
  const app = setup(t);
  await app.ready();
  const timestamp = app.$('#snapshotTime').textContent;
  app.$('#languageSwitch').click();
  assert.equal(app.document.documentElement.lang, 'zh-CN');
  assert.equal(app.$('#refreshButton').textContent, '再看一眼');
  assert.equal(app.$('#exportButton').textContent, '留一份副本');
  assert.equal(app.$('[data-chapter="arrival"] h2').textContent, '你抵达的时间');
  assert.equal(app.fact('battery').querySelector('.datum').textContent, '50% · 未充电');
  app.input('电量');
  assert.deepEqual(displayed(app).map(row => row.dataset.factId), ['battery']);
  app.input('time zone');
  assert.deepEqual(displayed(app).map(row => row.dataset.factId), ['timeZone']);
  app.input('not-a-real-field');
  assert.equal(app.$('#emptyResults').hidden, false);
  assert.ok(app.all('#observations .fact-group').every(group => group.hidden));
  app.input('navigator.getBattery');
  assert.equal(displayed(app).length, 0);
  app.input('');
  app.$('#languageSwitch').click();
  assert.equal(app.$('#snapshotTime').textContent, timestamp);
  assert.equal(app.calls.collections.length, 1);
});

test('DOM: valid URL language overrides browser language and reduced motion reveals immediately', async t => {
  const english = setup(t, { url: 'https://example.test/?lang=en', navigatorLanguage: 'zh-TW', reducedMotion: true });
  assert.equal(english.document.documentElement.lang, 'en');
  assert.equal(english.$('#inspector').hidden, false);
  await english.ready();
  const fallback = setup(t, { url: 'https://example.test/?lang=unsupported', navigatorLanguage: 'zh-CN' });
  assert.equal(fallback.document.documentElement.lang, 'zh-CN');
  await fallback.ready();
});

test('DOM: hostile strings stay text and do not create markup; unrecognized user agents are omitted', async t => {
  const hostile = '<img class="injected" src="https://example.invalid/leak" onerror="window.injected=true">';
  const app = setup(t, { beforeStart(window) {
    define(window.navigator, 'userAgent', hostile);
    define(window.navigator, 'languages', [hostile]);
  } });
  await app.ready();
  assert.equal(app.fact('userAgent').hidden, true);
  assert.equal(app.fact('userAgent').textContent, '');
  assert.equal(app.fact('languages').querySelector('.datum').textContent, hostile);
  assert.equal(app.$('[data-observation="languages"] dd').textContent, hostile);
  assert.equal(app.all('img.injected').length, 0);
  assert.equal(app.window.injected, undefined);
  app.$('#languageSwitch').click();
  assert.equal(app.all('img.injected').length, 0);
});

test('DOM: blocked, pending, and timed-out results leave no card, error wording, or stale prose', async t => {
  const app = setup(t, { beforeStart(window) {
    define(window.navigator, 'getBattery', () => new Promise(() => {}));
    window.navigator.storage.estimate = async () => { throw new window.DOMException('Private error', 'NotAllowedError'); };
  } });
  await tick();
  assert.equal(app.fact('userAgent').hidden, false);
  assert.equal(app.fact('storage').hidden, true);
  assert.equal(app.fact('battery').hidden, true);
  assert.equal(app.$('[data-chapter="resources"]'), null);
  assert.equal(app.$('#exportButton').disabled, true);
  await app.ready();
  assert.equal(app.fact('battery').hidden, true);
  assert.equal(app.fact('battery').textContent, '');
  assert.equal(app.$('#exportButton').disabled, false);
  assert.doesNotMatch(app.document.body.textContent, /Private error|Timed out|Blocked|Not exposed/);
});

test('DOM: zero/false remain real observations, while an empty or failed snapshot invents no chapters', async t => {
  const app = setup(t, { beforeStart(window) {
    define(window.navigator, 'maxTouchPoints', 0);
    define(window.navigator, 'onLine', false);
    define(window.navigator, 'getBattery', async () => ({ level: 0, charging: false }));
  } });
  await app.ready();
  assert.equal(app.$('[data-observation="touchPoints"] dd').textContent, '0');
  assert.equal(app.$('[data-observation="online"] dd').textContent, 'Offline');
  assert.equal(app.$('[data-observation="battery"] dd').textContent, '0% · Not charging');
  const empty = setup(t, { beforeStart(window) {
    window.__appDependencies.collectFacts = async ({ onResult }) => {
      for (const check of browserInfo.checks) onResult(browserInfo.metadata(check, 'unsupported'));
    };
  } });
  await empty.ready();
  assert.equal(empty.all('.portrait-chapter').length, 0);
  assert.equal(displayed(empty).length, 0);
  assert.equal(empty.$('#allFacts').hidden, true);
  assert.equal(empty.$('#exportButton').disabled, true);
  assert.doesNotMatch(empty.$('#inspector').textContent, /Not exposed|Unsupported|Could not read/);
});

test('DOM: optional observations require a click, suppress repeated clicks, and never query permissions', async t => {
  const app = setup(t, { beforeStart: window => mockOptional(window) });
  await app.ready();
  assert.equal(app.all('#optionalResults .fact').length, 0);
  app.$('#detailsButton').click();
  app.$('#detailsButton').click();
  assert.equal(app.$('#detailsButton').disabled, true);
  await app.optionalReady();
  assert.equal(displayed(app, '#optionalResults .fact').length, 2);
  assert.equal(app.fact('graphics').querySelector('.datum').textContent, 'Local vendor · Local renderer');
  assert.equal(app.fact('fontHints').querySelector('.datum').textContent, 'Arial');
  assert.equal(app.calls.collections.filter(ids => ids.includes('graphics')).length, 1);
  assert.deepEqual(app.calls.permissions, []);
  app.$('#clearOptionalButton').click();
  assert.equal(app.all('#optionalResults .fact').length, 0);
  assert.equal(app.$('#clearOptionalButton').hidden, true);
  assert.equal(app.$('#detailsButton').disabled, false);
});

test('DOM: unmatched fonts and unavailable graphics disappear without placeholders and leave no probe', async t => {
  const app = setup(t);
  await app.ready();
  app.$('#detailsButton').click();
  await app.optionalReady();
  assert.equal(displayed(app, '#optionalResults .fact').length, 0);
  assert.equal(app.fact('graphics').textContent, '');
  assert.equal(app.fact('fontHints').textContent, '');
  assert.equal(app.all('body > span').length, 0);
  assert.equal(app.$('#clearOptionalButton').hidden, true);
  assert.equal(app.$('#detailsButton').disabled, false);
});

test('DOM: clearing and refreshing discard old optional results', async t => {
  let batch = deferred();
  const app = setup(t, { beforeStart: window => mockOptional(window, async id => { await batch.promise; return optionalValue(id); }) });
  await app.ready();
  app.$('#detailsButton').click();
  await tick();
  app.$('#clearOptionalButton').click();
  batch.resolve();
  await Promise.all(app.collections);
  assert.equal(app.all('#optionalResults .fact').length, 0);
  assert.equal(app.$('#detailsButton').disabled, false);
  batch = deferred();
  app.$('#detailsButton').click();
  await tick();
  app.$('#refreshButton').click();
  await app.ready();
  batch.resolve();
  await Promise.all(app.collections);
  assert.equal(app.all('#optionalResults .fact').length, 0);
  assert.equal(app.$('#detailsButton').disabled, false);
});

test('DOM: repeated refresh clears the old portrait and discards older results finishing late', async t => {
  const app = setup(t);
  await app.ready();
  const oldBattery = deferred();
  let calls = 0;
  define(app.window.navigator, 'getBattery', () => ++calls === 1 ? oldBattery.promise : Promise.resolve({ level: 0.9, charging: true }));
  app.$('#refreshButton').click();
  assert.equal(app.all('.portrait-chapter').length, 0);
  assert.equal(app.fact('battery').textContent, '');
  await tick();
  assert.equal(app.$('#exportButton').disabled, true);
  app.$('#refreshButton').click();
  await app.ready();
  oldBattery.resolve({ level: 0.1, charging: false });
  await Promise.all(app.collections);
  assert.equal(app.fact('battery').querySelector('.datum').textContent, '90% · Charging');
  assert.equal(app.$('[data-observation="battery"] dd').textContent, '90% · Charging');
});

test('DOM: the downloaded copy matches successful displayed values, without internal names, states, or URL secrets', async t => {
  const app = setup(t, { url: 'https://example.test/?lang=zh&private=token#private-fragment', beforeStart: window => mockOptional(window) });
  await app.ready();
  app.$('#exportButton').click();
  const first = await readDownload(app);
  const expected = displayed(app).map(row => ({ label: row.querySelector('.fact-label').textContent, value: row.querySelector('.datum').textContent }));
  assert.deepEqual(first.snapshot.facts, expected);
  assert.equal(first.snapshot.schemaVersion, 2);
  assert.equal(app.calls.downloads[0].connected, true);
  assert.match(app.calls.downloads[0].filename, /^taken-browser-.*\.json$/);
  assert.equal(app.all('a[download]').length, 0);
  assert.ok(!Number.isNaN(Date.parse(first.snapshot.capturedAt)));
  assert.doesNotMatch(first.text, /private=token|private-fragment|example\.test|navigator\.|source|status|permission-|api-|Not exposed/);
  app.$('#detailsButton').click();
  await app.optionalReady();
  app.$('#exportButton').click();
  const second = await readDownload(app);
  assert.equal(second.snapshot.facts.length, first.snapshot.facts.length + 2);
  assert.ok(second.snapshot.facts.some(fact => fact.value === 'Arial'));
  app.$('#clearOptionalButton').click();
  app.$('#exportButton').click();
  assert.equal((await readDownload(app)).snapshot.facts.length, first.snapshot.facts.length);
  await waitFor(() => app.calls.revoked.length === 3, 'export URLs released');
  assert.deepEqual(app.calls.revoked, app.calls.objects.map(object => object.href));
});

test('DOM: optional reads block export until done or cancelled, and cancelled results stay out of copies', async t => {
  let pending = deferred();
  const app = setup(t, { beforeStart: window => mockOptional(window, async id => { await pending.promise; return optionalValue(id); }) });
  await app.ready();
  app.$('#detailsButton').click();
  await tick();
  assert.equal(app.$('#exportButton').disabled, true);
  app.$('#exportButton').click();
  assert.equal(app.calls.downloads.length, 0);
  pending.resolve();
  await app.optionalReady();
  app.$('#exportButton').click();
  const completed = await readDownload(app);
  assert.ok(completed.snapshot.facts.some(fact => fact.value === 'Arial'));
  app.$('#clearOptionalButton').click();
  pending = deferred();
  app.$('#detailsButton').click();
  await tick();
  assert.equal(app.$('#exportButton').disabled, true);
  app.$('#clearOptionalButton').click();
  assert.equal(app.$('#exportButton').disabled, false);
  app.$('#exportButton').click();
  assert.equal((await readDownload(app)).snapshot.facts.some(fact => fact.value === 'Arial'), false);
  pending.resolve();
  await Promise.all(app.collections);
});

test('DOM: export readiness waits for both main and optional collections in either completion order', async t => {
  for (const mainFirst of [true, false]) {
    const main = deferred();
    const optional = deferred();
    const app = setup(t, { beforeStart(window) {
      define(window.navigator, 'getBattery', () => main.promise);
      mockOptional(window, async id => { await optional.promise; return optionalValue(id); });
    } });
    app.$('#detailsButton').click();
    await tick();
    if (mainFirst) { main.resolve({ level: 0.5, charging: false }); await app.ready(); }
    else { optional.resolve(); await app.optionalReady(); }
    assert.equal(app.$('#exportButton').disabled, true);
    main.resolve({ level: 0.5, charging: false }); optional.resolve();
    await Promise.all(app.collections);
    assert.equal(app.$('#exportButton').disabled, false);
  }
});

test('DOM: optional timeout restores export but contributes no failure entry', async t => {
  const app = setup(t, { beforeStart: window => mockOptional(window, () => new Promise(() => {})) });
  await app.ready();
  app.$('#detailsButton').click();
  assert.equal(app.$('#exportButton').disabled, true);
  await app.optionalReady();
  assert.equal(app.$('#exportButton').disabled, false);
  assert.equal(displayed(app, '#optionalResults .fact').length, 0);
  app.$('#exportButton').click();
  assert.doesNotMatch((await readDownload(app)).text, /Timed out|timeout|graphics|fontHints/);
});

test('DOM: search survives refresh and rematches only after a fresh successful value arrives', async t => {
  const app = setup(t);
  await app.ready();
  app.input('90%');
  assert.equal(app.$('#emptyResults').hidden, false);
  const battery = deferred();
  define(app.window.navigator, 'getBattery', () => battery.promise);
  app.$('#refreshButton').click();
  assert.equal(app.$('#filterInput').value, '90%');
  assert.equal(app.fact('battery').hidden, true);
  battery.resolve({ level: 0.9, charging: false });
  await app.ready();
  assert.equal(app.$('#emptyResults').hidden, true);
  assert.deepEqual(displayed(app).map(row => row.dataset.factId), ['battery']);
});

test('DOM: clearing and retrying optional reads isolates the newer busy state and content', async t => {
  const old = deferred(); const current = deferred(); let batch = old;
  const app = setup(t, { beforeStart: window => mockOptional(window, async id => { const active = batch; await active.promise; return optionalValue(id); }) });
  await app.ready();
  app.$('#detailsButton').click();
  await tick();
  app.$('#clearOptionalButton').click();
  batch = current;
  app.$('#detailsButton').click();
  await tick();
  old.resolve();
  await tick();
  assert.equal(app.$('#exportButton').disabled, true);
  assert.equal(app.$('#optionalResults').getAttribute('aria-busy'), 'true');
  assert.equal(displayed(app, '#optionalResults .fact').length, 0);
  current.resolve();
  await app.optionalReady();
  assert.equal(app.$('#exportButton').disabled, false);
  assert.equal(displayed(app, '#optionalResults .fact').length, 2);
});
test('DOM: copy strips credentials, query, and fragment, then reports honest clipboard failure', async t => {
  const writes = [];
  const app = setup(t, { url: 'https://alice:secret@example.test/portrait/?lang=en&private=token#private-fragment', beforeStart(window) {
    define(window.navigator, 'clipboard', { writeText: async value => { writes.push(value); throw new window.DOMException('Denied', 'NotAllowedError'); } });
  } });
  await app.ready();
  app.$('[data-open="share"]').click();
  assert.equal(app.$('#shareModal').open, true);
  assert.equal(app.$('#shareUrl').value, 'https://example.test/portrait/');
  app.$('#copyButton').click();
  await waitFor(() => !app.$('#copyButton').disabled, 'clipboard failure feedback');
  assert.deepEqual(writes, ['https://example.test/portrait/']);
  assert.equal(app.$('#copyStatus').textContent, 'Clipboard unavailable. Select and copy the link above.');
  assert.equal(app.document.activeElement, app.$('#shareUrl'));
  app.$('#shareModal [data-close]').click();
  assert.equal(app.$('#shareModal').open, false);
  app.$('[data-open="share"]').click();
  assert.equal(app.$('#copyStatus').textContent, '', 'Reopening clears stale feedback');
});

test('DOM: successful copy suppresses duplicate clicks and localizes feedback', async t => {
  const pending = deferred();
  const writes = [];
  const app = setup(t, { url: 'https://example.test/?lang=zh&secret=x#fragment', beforeStart(window) {
    define(window.navigator, 'clipboard', { writeText: value => { writes.push(value); return pending.promise; } });
  } });
  await app.ready();
  app.$('[data-open="share"]').click();
  app.$('#copyButton').click();
  app.$('#copyButton').click();
  await tick();
  assert.equal(app.$('#copyButton').disabled, true);
  assert.deepEqual(writes, ['https://example.test/']);
  pending.resolve();
  await waitFor(() => !app.$('#copyButton').disabled, 'successful copy feedback');
  assert.equal(app.$('#copyStatus').textContent, '链接已复制。');
});

test('DOM: absent or hung clipboard APIs fail gracefully and leave copy enabled', async t => {
  for (const clipboard of [undefined, { writeText: () => new Promise(() => {}) }]) {
    const app = setup(t, { beforeStart(window) { define(window.navigator, 'clipboard', clipboard); } });
    await app.ready();
    app.$('[data-open="share"]').click();
    app.$('#copyButton').click();
    await waitFor(() => !app.$('#copyButton').disabled, 'clipboard fallback');
    assert.equal(app.$('#copyStatus').textContent, 'Clipboard unavailable. Select and copy the link above.');
  }
});

test('DOM: stale successful copy cannot publish feedback after closing and reopening the dialog', async t => {
  const oldCopy = deferred();
  const app = setup(t, { copyTimeoutMs: 500, beforeStart(window) {
    define(window.navigator, 'clipboard', { writeText: () => oldCopy.promise });
  } });
  await app.ready();
  app.$('[data-open="share"]').click();
  app.$('#copyButton').click();
  await tick();
  assert.equal(app.$('#copyButton').disabled, true);
  app.$('#shareModal [data-close]').click();
  assert.equal(app.$('#copyButton').disabled, false);
  app.$('[data-open="share"]').click();
  app.$('#copyButton').focus();
  assert.equal(app.$('#copyButton').disabled, false, 'A new dialog session is ready for a new copy');
  oldCopy.resolve();
  await tick();
  assert.equal(app.$('#copyStatus').textContent, '');
  assert.equal(app.document.activeElement, app.$('#copyButton'));
  assert.equal(app.$('#copyButton').disabled, false);
});

test('DOM: stale rejected copy cannot steal focus or re-enable a newer pending copy', async t => {
  const oldCopy = deferred();
  const newCopy = deferred();
  let attempts = 0;
  const app = setup(t, { copyTimeoutMs: 500, beforeStart(window) {
    define(window.navigator, 'clipboard', { writeText: () => ++attempts === 1 ? oldCopy.promise : newCopy.promise });
  } });
  await app.ready();
  app.$('[data-open="share"]').click();
  app.$('#copyButton').click();
  await tick();
  app.$('#shareModal [data-close]').click();
  app.$('[data-open="share"]').click();
  assert.equal(app.$('#copyButton').disabled, false);
  app.$('#copyButton').click();
  app.$('#shareModal [data-close]').focus();
  await tick();
  oldCopy.reject(new app.window.DOMException('Old copy denied', 'NotAllowedError'));
  await tick();
  assert.equal(app.$('#copyStatus').textContent, '');
  assert.equal(app.document.activeElement, app.$('#shareModal [data-close]'));
  assert.equal(app.$('#copyButton').disabled, true, 'Only the current copy may re-enable its button');
  newCopy.resolve();
  await waitFor(() => !app.$('#copyButton').disabled, 'the current copy to finish');
  assert.equal(app.$('#copyStatus').textContent, 'Link copied.');
});

test('DOM: local export preparation errors produce a visible retryable failure', async t => {
  const app = setup(t, { beforeStart(window) {
    window.URL.createObjectURL = () => { throw new Error('Storage quota error'); };
  } });
  await app.ready();
  app.$('#exportButton').click();
  assert.equal(app.$('#scanStatus').textContent, 'The download could not be prepared. Please try again.');
  assert.equal(app.calls.downloads.length, 0);
  assert.equal(app.$('#exportButton').disabled, false);
});

test('DOM: dialog close and backdrop events update modal state without cross-closing content clicks', async t => {
  const app = setup(t);
  await app.ready();
  app.$('[data-open="sources"]').click();
  assert.equal(app.$('#sourcesModal').open, true);
  app.$('#sourcesHeading').click();
  assert.equal(app.$('#sourcesModal').open, true);
  app.$('#sourcesModal').click();
  assert.equal(app.$('#sourcesModal').open, false);
  app.$('[data-open="sources"]').click();
  app.$('#sourcesModal [data-close]').click();
  assert.equal(app.$('#sourcesModal').open, false);
});


test('DOM: a failed copy can be retried successfully without reopening the dialog', async t => {
  let attempts = 0;
  const app = setup(t, { beforeStart(window) {
    define(window.navigator, 'clipboard', { writeText: async () => {
      if (++attempts === 1) throw new window.DOMException('Denied', 'NotAllowedError');
    } });
  } });
  await app.ready();
  app.$('[data-open="share"]').click();
  app.$('#copyButton').click();
  await waitFor(() => !app.$('#copyButton').disabled, 'the failed copy');
  assert.match(app.$('#copyStatus').textContent, /Clipboard unavailable/);
  app.$('#copyButton').click();
  await waitFor(() => !app.$('#copyButton').disabled, 'the successful retry');
  assert.equal(app.$('#copyStatus').textContent, 'Link copied.');
  assert.equal(attempts, 2);
});

test('DOM: mixed blank language items are cleaned identically in narrative, appendix, and bilingual copy', async t => {
  const app = setup(t, { beforeStart(window) { define(window.navigator, 'languages', ['  ', 'en-US', '']); } });
  await app.ready();
  for (const language of ['en', 'zh']) {
    if (language === 'zh') app.$('#languageSwitch').click();
    const expected = new Intl.DisplayNames([language === 'zh' ? 'zh-CN' : 'en'], { type: 'language' }).of('en-US');
    assert.equal(app.$('[data-observation="languages"] dd').textContent, expected);
    assert.equal(app.fact('languages').querySelector('.datum').textContent, expected);
    app.input(expected);
    assert.equal(app.fact('languages').hidden, false);
    app.$('#exportButton').click();
    const { snapshot } = await readDownload(app);
    const label = app.fact('languages').querySelector('.fact-label').textContent;
    assert.equal(snapshot.facts.find(fact => fact.label === label).value, expected);
    app.input('');
  }
  assert.deepEqual([...app.window.navigator.languages], ['  ', 'en-US', ''], 'The browser snapshot is not mutated');
});
