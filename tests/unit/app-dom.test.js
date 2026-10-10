import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';
import * as browserInfo from '../../browser-info.js';
import { formatValue } from '../../display-format.js';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../../app.js', import.meta.url), 'utf8');
const appSource = source.replace(/^import .* from '\.\/(?:browser-info|display-format)\.js';\r?\n/gm, '');
assert.doesNotMatch(appSource, /^import /m, 'Update the controlled harness if the app adds another dependency');
const dependencyNames = ['checks', 'detailChecks', 'permissionChecks', 'GROUPS', 'STATUS', 'metadata', 'collectFacts', 'cleanShareUrl', 'exportSnapshot', 'withTimeout', 'formatValue'];

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
  define(window.navigator, 'userAgent', 'DOM fixture browser/1.0');
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
    ...browserInfo, formatValue,
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
  const ready = () => waitFor(() => /Snapshot ready|快照已就绪/.test($('#scanStatus').textContent), 'the main snapshot');
  const optionalReady = () => waitFor(() => /Optional checks finished|可选检测已完成/.test($('#optionalStatus').textContent), 'optional results');
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

test('DOM: startup collects only main facts, renders API sources, and reveal remains idempotent', async t => {
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
  assert.equal(app.all('#optionalResults .fact').length, 0);
  assert.equal(app.all('#observations .fact').length, browserInfo.checks.length);
  assert.equal(app.all('#observations .source-link').length, browserInfo.checks.length);
  for (const link of app.all('#observations .source-link')) {
    assert.ok(link.href.startsWith('https://developer.mozilla.org/en-US/docs/'));
    assert.equal(link.target, '_blank');
    assert.equal(link.rel, 'noopener noreferrer');
  }
  assert.equal(app.$('#exportButton').disabled, false);
  assert.equal(app.window.localStorage.length, 0);
  assert.equal(app.window.sessionStorage.length, 0);
  assert.equal(app.document.cookie, '');
});

test('DOM: language toggle translates existing values and filters either language without recollecting', async t => {
  const app = setup(t);
  await app.ready();
  const timestamp = app.$('#snapshotTime').textContent;
  app.$('#languageSwitch').click();
  assert.equal(app.document.documentElement.lang, 'zh-CN');
  assert.equal(app.document.title, 'taken. — 浏览器画像');
  assert.equal(app.$('#refreshButton').textContent, '重新检测');
  assert.equal(app.$('#permissionsButton').textContent, '读取权限状态');
  assert.equal(app.fact('battery').querySelector('.datum').textContent, '50% · 未充电');
  assert.equal(new URL(app.window.location.href).searchParams.get('lang'), 'zh');
  app.input('电池');
  assert.deepEqual(app.all('#observations .fact').filter(row => !row.hidden).map(row => row.dataset.factId), ['battery']);
  app.input('time zone');
  assert.deepEqual(app.all('#observations .fact').filter(row => !row.hidden).map(row => row.dataset.factId), ['timeZone']);
  app.input('  not-a-real-field  ');
  assert.equal(app.$('#emptyResults').hidden, false);
  assert.ok(app.all('#observations .fact-group').every(group => group.hidden));
  app.input('');
  app.$('#availableOnly').checked = true;
  app.$('#availableOnly').dispatchEvent(new app.window.Event('change'));
  assert.ok(app.all('#observations .fact').filter(row => !row.hidden).every(row => row.querySelector('.fact-status').dataset.status === 'available'));
  app.$('#languageSwitch').click();
  assert.equal(app.document.documentElement.lang, 'en');
  assert.equal(app.$('#snapshotTime').textContent, timestamp);
  assert.equal(app.calls.collections.length, 1);
});

test('DOM: valid URL language overrides browser language, invalid URL language falls back', async t => {
  const english = setup(t, { url: 'https://example.test/?lang=en', navigatorLanguage: 'zh-TW', reducedMotion: true });
  assert.equal(english.document.documentElement.lang, 'en');
  assert.equal(english.$('#inspector').hidden, false, 'Reduced-motion preference bypasses delayed reveal');
  await english.ready();
  const fallback = setup(t, { url: 'https://example.test/?lang=unsupported', navigatorLanguage: 'zh-CN' });
  assert.equal(fallback.document.documentElement.lang, 'zh-CN');
  await fallback.ready();
});

test('DOM: untrusted API values remain text and cannot create markup or handlers', async t => {
  const hostile = '<img class="injected" src="https://example.invalid/leak" onerror="window.injected=true">';
  const app = setup(t, { beforeStart(window) {
    define(window.navigator, 'userAgent', hostile);
    define(window.navigator, 'languages', [hostile]);
  } });
  await app.ready();
  assert.equal(app.fact('userAgent').querySelector('.datum').textContent, hostile);
  assert.equal(app.fact('languages').querySelector('.datum').textContent, hostile);
  assert.equal(app.all('img.injected').length, 0);
  assert.equal(app.window.injected, undefined);
  assert.ok(app.fact('userAgent').querySelector('.datum').innerHTML.startsWith('&lt;img'));
  app.$('#languageSwitch').click();
  assert.equal(app.fact('userAgent').querySelector('.datum').textContent, hostile);
  assert.equal(app.all('img.injected').length, 0);
});

test('DOM: blocked and timed-out APIs leave independently usable partial results', async t => {
  const app = setup(t, { beforeStart(window) {
    define(window.navigator, 'getBattery', () => new Promise(() => {}));
    window.navigator.storage.estimate = async () => { throw new window.DOMException('Private error', 'NotAllowedError'); };
  } });
  await tick();
  assert.equal(app.fact('userAgent').querySelector('.fact-status').dataset.status, 'available');
  assert.equal(app.fact('storage').querySelector('.fact-status').dataset.status, 'blocked');
  assert.equal(app.fact('battery').querySelector('.fact-status').dataset.status, 'pending');
  assert.equal(app.$('#exportButton').disabled, true);
  await app.ready();
  assert.equal(app.fact('battery').querySelector('.fact-status').dataset.status, 'timeout');
  assert.equal(app.$('#exportButton').disabled, false);
  assert.doesNotMatch(app.document.body.textContent, /Private error/);
});

test('DOM: permission reads require a click, preserve denied state, and cannot double-submit', async t => {
  const app = setup(t, { beforeStart(window, calls) {
    window.navigator.permissions.query = async ({ name }) => {
      calls.permissions.push(name);
      if (name === 'camera') throw new TypeError('Unsupported permission');
      return { state: name === 'geolocation' ? 'denied' : 'prompt' };
    };
  } });
  await app.ready();
  assert.deepEqual(app.calls.permissions, []);
  app.$('#permissionsButton').click();
  app.$('#permissionsButton').click();
  assert.equal(app.$('#permissionsButton').disabled, true);
  await app.optionalReady();
  assert.deepEqual(app.calls.permissions, ['geolocation', 'camera', 'microphone', 'notifications']);
  assert.equal(app.all('#optionalResults .fact').length, 4);
  assert.equal(app.fact('permission-geolocation').querySelector('.datum').textContent, 'Denied');
  assert.equal(app.fact('permission-camera').querySelector('.fact-status').dataset.status, 'unsupported');
  app.$('#languageSwitch').click();
  assert.equal(app.fact('permission-geolocation').querySelector('.datum').textContent, '已拒绝');
  app.$('#clearOptionalButton').click();
  assert.equal(app.all('#optionalResults .fact').length, 0);
  assert.equal(app.$('#clearOptionalButton').hidden, true);
  assert.equal(app.$('#permissionsButton').disabled, false);
  assert.equal(app.$('#optionalStatus').textContent, '已从当前页面清除可选结果。');
});

test('DOM: clear and refresh discard delayed optional results without resurrecting stale rows', async t => {
  let batch = deferred();
  const app = setup(t, { beforeStart(window) {
    window.navigator.permissions.query = () => batch.promise;
  } });
  await app.ready();
  app.$('#permissionsButton').click();
  await tick();
  app.$('#clearOptionalButton').click();
  batch.resolve({ state: 'granted' });
  await Promise.all(app.collections);
  await tick();
  assert.equal(app.all('#optionalResults .fact').length, 0);
  assert.equal(app.$('#optionalStatus').textContent, 'Optional results cleared from this page.');
  assert.equal(app.$('#permissionsButton').disabled, false);

  batch = deferred();
  app.$('#permissionsButton').click();
  await tick();
  app.$('#refreshButton').click();
  await app.ready();
  batch.resolve({ state: 'granted' });
  await Promise.all(app.collections);
  await tick();
  assert.equal(app.all('#optionalResults .fact').length, 0);
  assert.equal(app.$('#optionalStatus').textContent, '');
  assert.equal(app.$('#permissionsButton').disabled, false);
  assert.equal(app.all('#observations .fact').length, browserInfo.checks.length);
});

test('DOM: repeated refresh ignores an older main snapshot finishing after the latest one', async t => {
  const app = setup(t);
  await app.ready();
  const oldBattery = deferred();
  let batteryCalls = 0;
  define(app.window.navigator, 'getBattery', () => ++batteryCalls === 1 ? oldBattery.promise : Promise.resolve({ level: 0.9, charging: true }));
  app.$('#refreshButton').click();
  await tick();
  assert.equal(app.$('#exportButton').disabled, true);
  app.$('#refreshButton').click();
  await app.ready();
  assert.equal(app.fact('battery').querySelector('.datum').textContent, '90% · Charging');
  oldBattery.resolve({ level: 0.1, charging: false });
  await Promise.all(app.collections);
  await tick();
  assert.equal(app.fact('battery').querySelector('.datum').textContent, '90% · Charging');
  assert.equal(app.$('#exportButton').disabled, false);
  assert.equal(app.all('#observations .fact').length, browserInfo.checks.length);
});

test('DOM: optional details run once on explicit request and clearing removes their rows', async t => {
  const app = setup(t, { beforeStart(window) {
    window.HTMLCanvasElement.prototype.getContext = () => null;
  } });
  await app.ready();
  assert.equal(app.all('#optionalResults .fact').length, 0);
  app.$('#detailsButton').click();
  app.$('#detailsButton').click();
  await app.optionalReady();
  assert.equal(app.all('#optionalResults .fact').length, 2);
  assert.equal(app.fact('graphics').querySelector('.fact-status').dataset.status, 'unsupported');
  assert.equal(app.fact('fontHints').querySelector('.fact-status').dataset.status, 'available');
  assert.equal(app.all('body > span').length, 0, 'The temporary local font probe is removed');
  assert.equal(app.calls.collections.filter(ids => ids.includes('graphics')).length, 1);
  app.$('#clearOptionalButton').click();
  assert.equal(app.all('#optionalResults .fact').length, 0);
  assert.equal(app.$('#detailsButton').disabled, false);
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

test('DOM: local JSON export contains statuses, excludes URL secrets, and tracks optional clear/reset', async t => {
  const app = setup(t, { url: 'https://example.test/portrait/?lang=en&private=token#private-fragment' });
  await app.ready();
  app.$('#exportButton').click();
  const first = await readDownload(app);
  assert.equal(app.calls.downloads.length, 1);
  assert.equal(app.calls.downloads[0].connected, true);
  assert.match(app.calls.downloads[0].filename, /^taken-browser-.*\.json$/);
  assert.equal(app.all('a[download]').length, 0, 'Temporary download links are removed');
  assert.equal(first.snapshot.schemaVersion, 1);
  assert.equal(first.snapshot.facts.length, browserInfo.checks.length);
  assert.ok(!Number.isNaN(Date.parse(first.snapshot.capturedAt)));
  for (const fact of first.snapshot.facts) assert.deepEqual(Object.keys(fact).sort(), ['group', 'id', 'source', 'status', 'value']);
  assert.doesNotMatch(first.text, /private=token|private-fragment|https:\/\/example\.test|referrer|visitorId|sessionId/);
  assert.equal(first.snapshot.facts.some(fact => fact.id.startsWith('permission-')), false);
  assert.equal(app.$('#scanStatus').textContent, 'Local JSON download prepared. Nothing uploaded.');

  app.$('#permissionsButton').click();
  await app.optionalReady();
  app.$('#exportButton').click();
  const second = await readDownload(app);
  assert.equal(second.snapshot.facts.length, browserInfo.checks.length + browserInfo.permissionChecks.length);
  assert.equal(second.snapshot.facts.find(fact => fact.id === 'permission-geolocation').value, 'denied');
  app.$('#clearOptionalButton').click();
  app.$('#exportButton').click();
  assert.equal((await readDownload(app)).snapshot.facts.length, browserInfo.checks.length);
  await waitFor(() => app.calls.revoked.length === 3, 'export object URLs to be released');
  assert.deepEqual(app.calls.revoked, app.calls.objects.map(object => object.href));
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


test('DOM: export waits for optional reads, and clearing them restores export readiness', async t => {
  let pending = deferred();
  const app = setup(t, { beforeStart(window) {
    window.navigator.permissions.query = () => pending.promise;
  } });
  await app.ready();
  app.$('#permissionsButton').click();
  await tick();
  assert.equal(app.$('#exportButton').disabled, true, 'Pending optional results must not be exported');
  app.$('#exportButton').click();
  assert.equal(app.calls.downloads.length, 0);
  pending.resolve({ state: 'granted' });
  await app.optionalReady();
  assert.equal(app.$('#exportButton').disabled, false);
  app.$('#exportButton').click();
  const completed = await readDownload(app);
  assert.ok(completed.snapshot.facts.every(fact => fact.status !== 'pending'));
  assert.equal(completed.snapshot.facts.find(fact => fact.id === 'permission-camera').value, 'granted');

  app.$('#clearOptionalButton').click();
  pending = deferred();
  app.$('#permissionsButton').click();
  await tick();
  assert.equal(app.$('#exportButton').disabled, true);
  app.$('#clearOptionalButton').click();
  assert.equal(app.$('#exportButton').disabled, false, 'Cleared optional reads no longer block the ready main snapshot');
  app.$('#exportButton').click();
  assert.equal((await readDownload(app)).snapshot.facts.length, browserInfo.checks.length);
  pending.resolve({ state: 'denied' });
  await Promise.all(app.collections);
});


test('DOM: export readiness waits for both main and optional collections in either completion order', async t => {
  for (const mainFirst of [true, false]) {
    const main = deferred();
    const optional = deferred();
    const app = setup(t, { beforeStart(window) {
      define(window.navigator, 'getBattery', () => main.promise);
      window.navigator.permissions.query = () => optional.promise;
    } });
    app.$('#permissionsButton').click();
    await tick();
    assert.equal(app.$('#exportButton').disabled, true);
    if (mainFirst) {
      main.resolve({ level: 0.5, charging: false });
      await app.ready();
    } else {
      optional.resolve({ state: 'prompt' });
      await app.optionalReady();
    }
    assert.equal(app.$('#exportButton').disabled, true, 'The other collection is still reading');
    main.resolve({ level: 0.5, charging: false });
    optional.resolve({ state: 'prompt' });
    await Promise.all(app.collections);
    await tick();
    assert.equal(app.$('#exportButton').disabled, false);
  }
});

test('DOM: an optional timeout restores export with its final timeout status', async t => {
  const app = setup(t, { beforeStart(window) {
    window.navigator.permissions.query = () => new Promise(() => {});
  } });
  await app.ready();
  app.$('#permissionsButton').click();
  assert.equal(app.$('#exportButton').disabled, true);
  await app.optionalReady();
  assert.equal(app.$('#exportButton').disabled, false);
  app.$('#exportButton').click();
  const download = await readDownload(app);
  assert.ok(download.snapshot.facts.filter(fact => fact.id.startsWith('permission-')).every(fact => fact.status === 'timeout'));
});

test('DOM: search survives refresh and updates matches when the new value arrives', async t => {
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
  assert.deepEqual(app.all('#observations .fact').filter(row => !row.hidden).map(row => row.dataset.factId), ['battery']);
  app.input('navigator.getBattery');
  assert.equal(app.fact('battery').hidden, false);
  app.$('#languageSwitch').click();
  assert.equal(app.fact('battery').hidden, false);
  assert.equal(app.fact('battery').querySelector('.datum').textContent, '90% · 未充电');
});

test('DOM: clearing and retrying optional reads isolates the newer export readiness', async t => {
  const old = deferred();
  const current = deferred();
  let batch = old;
  const app = setup(t, { beforeStart(window) {
    window.navigator.permissions.query = () => batch.promise;
  } });
  await app.ready();
  app.$('#permissionsButton').click();
  await tick();
  app.$('#clearOptionalButton').click();
  batch = current;
  app.$('#permissionsButton').click();
  await tick();
  old.resolve({ state: 'granted' });
  await tick();
  assert.equal(app.$('#exportButton').disabled, true);
  assert.equal(app.$('#optionalStatus').textContent, 'Reading optional local checks…');
  assert.equal(app.fact('permission-camera').querySelector('.fact-status').dataset.status, 'pending');
  current.resolve({ state: 'denied' });
  await app.optionalReady();
  assert.equal(app.$('#exportButton').disabled, false);
  assert.equal(app.fact('permission-camera').querySelector('.datum').textContent, 'Denied');
  assert.equal(app.all('#optionalResults .fact').length, 4);
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
