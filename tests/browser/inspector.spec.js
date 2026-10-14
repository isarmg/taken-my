import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const fact = (page, id) => page.locator(`[data-fact-id="${id}"]`);
const observation = (page, id) => page.locator(`#portrait [data-observation="${id}"]`);
const ready = page => expect(page.locator('#inspector')).toHaveAttribute('aria-busy', 'false');
const optionalReady = page => expect(page.locator('#optionalResults')).toHaveAttribute('aria-busy', 'false');

async function openFacts(page) {
  await page.locator('#allFacts > summary').click();
  await expect(page.locator('#allFacts')).toHaveJSProperty('open', true);
}

async function expectUndisclosed(page, id) {
  await expect(fact(page, id)).toBeHidden();
  await expect(fact(page, id)).toHaveText('');
  await expect(observation(page, id)).toHaveCount(0);
}

async function downloadPortrait(page) {
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportButton').click();
  const download = await downloadPromise;
  const text = await readFile(await download.path(), 'utf8');
  return { text, snapshot: JSON.parse(text) };
}

async function shownFacts(page) {
  return page.locator('#observations .fact:not([hidden]), #optionalResults .fact:not([hidden])').evaluateAll(rows =>
    rows.map(row => ({ label: row.querySelector('.fact-label').textContent, value: row.querySelector('.datum').textContent })));
}

// Fixed local graphics/font responses make the UI checks independent of host fonts
// and GPU availability. Non-probe layout measurements retain their real behavior.
async function stubOptionalProbes(page, { empty = false } = {}) {
  await page.addInitScript(({ empty }) => {
    window.optionalProbeCalls = [];
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: () => {
      window.optionalProbeCalls.push('permission');
      throw new Error('Permission reads are not part of the portrait');
    } } });
    window.queryLocalFonts = () => {
      window.optionalProbeCalls.push('local-font-access');
      throw new Error('Local Font Access must not be requested');
    };
    const originalContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (kind !== 'webgl') return originalContext.call(this, kind, ...args);
      window.optionalProbeCalls.push('graphics');
      if (empty) return null;
      return {
        VENDOR: 0x1f00, RENDERER: 0x1f01,
        getExtension(name) {
          if (name === 'WEBGL_debug_renderer_info') return { UNMASKED_VENDOR_WEBGL: 0x9245, UNMASKED_RENDERER_WEBGL: 0x9246 };
          if (name === 'WEBGL_lose_context') return { loseContext: () => window.optionalProbeCalls.push('release-graphics') };
          return null;
        },
        getParameter(parameter) { return [0x1f00, 0x9245].includes(parameter) ? 'Fixture Vendor' : 'Fixture Renderer'; }
      };
    };
    const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get() {
      if (this.tagName !== 'SPAN' || this.style.left !== '-9999px') return width.get.call(this);
      window.optionalProbeCalls.push('font-width');
      return !empty && this.style.fontFamily.includes('Arial') ? 120 : 100;
    } });
  }, { empty });
}

// Only the asynchronous-generation regression uses source modules. Serve the
// current font startup at the entry bundle URL and application source at its
// import URL, then defer the two real detail readers. This preserves the font
// preparation and visibility gate while the test releases stale results.
async function deferOptionalChecks(page) {
  const names = ['font-startup.js', 'app.js', 'browser-info.js', 'display-format.js', 'portrait.js'];
  const modules = new Map(await Promise.all(names.map(async name => [name, await readFile(new URL(`../../${name}`, import.meta.url), 'utf8')])));
  modules.set('browser-info.js', `${modules.get('browser-info.js')}
    window.pendingOptionalReads = [];
    for (const check of detailChecks) {
      const originalRead = check.read;
      check.read = environment => new Promise((resolve, reject) => {
        window.pendingOptionalReads.push(() => Promise.resolve().then(() => originalRead(environment)).then(resolve, reject));
      });
    }
    const originalCollectFactsForFixture = collectFacts;
    collectFacts = options => originalCollectFactsForFixture(options?.selected === detailChecks
      ? { ...options, timeoutMs: 60000 } : options);
  `);
  await page.route('**/*.js', route => {
    const path = new URL(route.request().url()).pathname;
    const name = path.split('/').at(-1);
    const source = modules.get(name) || (/^\/assets\/index-[^/]+\.js$/.test(path) ? modules.get('font-startup.js') : undefined);
    return source === undefined ? route.continue() : route.fulfill({ contentType: 'text/javascript', body: source });
  });
}

async function releaseOptionalChecks(page) {
  await page.evaluate(async () => {
    await Promise.all(window.pendingOptionalReads.splice(0).map(release => release()));
    // Let the collection callbacks run before inspecting the generation guards.
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

test('collects a local portrait without external requests, writes, permissions, or sensor activation', async ({ page }) => {
  const requests = [];
  const pageErrors = [];
  page.on('request', request => requests.push({ url: request.url(), method: request.method(), type: request.resourceType() }));
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.sensitiveCalls = [];
    const trap = name => () => { window.sensitiveCalls.push(name); throw new Error(name); };
    for (const [name, value] of Object.entries({
      geolocation: { getCurrentPosition: trap('location'), watchPosition: trap('watchLocation') },
      mediaDevices: { getUserMedia: trap('media'), enumerateDevices: trap('enumerate') },
      permissions: { query: trap('permissions') }
    })) Object.defineProperty(navigator, name, { configurable: true, value });
    for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'RTCPeerConnection', 'queryLocalFonts']) window[name] = trap(name);
    navigator.sendBeacon = trap('beacon');
    HTMLCanvasElement.prototype.getContext = trap('graphics');
  });
  await page.goto('/?lang=en');
  await ready(page);
  await expect(page).toHaveTitle('taken. — browser portrait');
  await expect(page.locator('#portrait .portrait-chapter').first()).toBeVisible();
  await expect(observation(page, 'timeZone')).toBeVisible();
  await expect(page.locator('#allFacts')).toHaveJSProperty('open', false);
  await expect(page.locator('#scanStatus')).toHaveText('');
  await expect(page.locator('#scanStatus')).toBeHidden();
  await expect(page.locator('.fact-status, .source-link, #availableOnly, #permissionsButton')).toHaveCount(0);
  await expect(page.locator('#observations a')).toHaveCount(0);
  await expect(page.locator('#optionalResults .fact')).toHaveCount(0);
  const chapters = await page.locator('#portrait .portrait-chapter').evaluateAll(items => items.map(item => item.querySelectorAll('[data-observation]').length));
  expect(chapters.every(count => count > 0)).toBe(true);
  await openFacts(page);
  expect(await page.locator('#observations .fact:visible').count()).toBeGreaterThan(0);
  expect(await page.locator('#observations .fact:visible .datum').allTextContents()).not.toContain('');
  expect(await page.evaluate(() => window.sensitiveCalls)).toEqual([]);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, '']);
  expect(pageErrors).toEqual([]);
  expect(requests.length).toBeGreaterThan(2);
  expect(requests.every(request => request.url.startsWith('http://127.0.0.1:4173/') && request.method === 'GET' && ['document', 'script', 'stylesheet', 'font', 'other'].includes(request.type))).toBe(true);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("connect-src 'none'");
});

test('pending, unsupported, blocked, and timed-out facts stay empty while successful observations appear', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'getBattery', { value: () => new Promise(() => {}), configurable: true });
    Object.defineProperty(navigator, 'storage', { value: { estimate: async () => { throw new DOMException('Blocked', 'NotAllowedError'); }, persisted: async () => false }, configurable: true });
    Object.defineProperty(navigator, 'connection', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'languages', { value: [], configurable: true });
  });
  await page.goto('/?lang=en');
  await expect(page.locator('#inspector')).toHaveAttribute('aria-busy', 'true');
  await expect(observation(page, 'timeZone').locator('dd')).not.toHaveText('');
  await expectUndisclosed(page, 'battery');
  await expectUndisclosed(page, 'storage');
  await expectUndisclosed(page, 'downlink');
  await expectUndisclosed(page, 'languages');
  await expect(page.locator('#exportButton')).toBeDisabled();
  await page.clock.runFor(2000);
  await ready(page);
  await expectUndisclosed(page, 'battery');
  await expect(page.locator('#portrait [data-chapter="resources"], #portrait [data-chapter="languages"]')).toHaveCount(0);
  await expect(page.locator('#scanStatus')).toHaveText('');
  await expect(page.locator('#exportButton')).toBeEnabled();
  await openFacts(page);
  await expect(fact(page, 'timeZone')).toBeVisible();
  await expect(page.locator('#observations')).not.toContainText(/Not exposed|Timed out|Blocked|Reading|Unavailable/);
});

test('successful zero and false values remain, while capabilities and diagnostics stay undisclosed', async ({ page }) => {
  await page.addInitScript(() => {
    for (const [name, value] of Object.entries({
      maxTouchPoints: 0, onLine: false, cookieEnabled: true, doNotTrack: '1', globalPrivacyControl: true,
      connection: { effectiveType: '4g', downlink: 0, rtt: 0, saveData: false },
      getBattery: async () => ({ level: 0, charging: false }),
      storage: { estimate: async () => ({ quota: 0, usage: 0 }), persisted: async () => false },
      geolocation: {}, mediaDevices: {}, clipboard: {}, gpu: {}, serviceWorker: {},
      permissions: { query: () => { throw new Error('Permission queries must not run'); } }
    })) Object.defineProperty(navigator, name, { configurable: true, value });
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(window, 'crossOriginIsolated', { configurable: true, value: true });
    window.Notification = function () {};
  });
  await page.goto('/?lang=en');
  await ready(page);
  await expect(observation(page, 'touchPoints').locator('dd')).toHaveText('0');
  await expect(observation(page, 'online').locator('dd')).toHaveText('Offline');
  await expect(observation(page, 'saveData').locator('dd')).toHaveText('Off');
  await expect(observation(page, 'downlink').locator('dd')).toHaveText('0 Mbps');
  await expect(observation(page, 'battery').locator('dd')).toHaveText('0% · Not charging');
  await openFacts(page);
  await expect(fact(page, 'rtt').locator('.datum')).toHaveText('0');
  await expect(fact(page, 'storage').locator('.datum')).toContainText('0 B');
  const excluded = ['secureContext', 'isolated', 'cookies', 'dnt', 'gpc', 'api-geolocation', 'api-mediaDevices', 'api-clipboard', 'api-webgpu', 'api-serviceWorker', 'api-webAssembly', 'api-notifications', 'api-permissions'];
  for (const id of excluded) await expectUndisclosed(page, id);
  await expect(page.locator('#observations .fact-group:not([hidden]) [data-group="capabilities"]')).toHaveCount(0);
});

test('unknown user-agent strings disappear and browser language strings remain text, never markup', async ({ page }) => {
  const malicious = '<img class="injected" src="https://invalid.example/x" onerror="window.injected=true">';
  await page.addInitScript(value => {
    Object.defineProperty(navigator, 'userAgent', { value, configurable: true });
    Object.defineProperty(navigator, 'languages', { value: [value], configurable: true });
  }, malicious);
  await page.goto('/?lang=en');
  await ready(page);
  await expectUndisclosed(page, 'userAgent');
  await expect(observation(page, 'languages').locator('dd')).toHaveText(malicious);
  await openFacts(page);
  await expect(fact(page, 'languages').locator('.datum')).toHaveText(malicious);
  await expect(page.locator('img.injected')).toHaveCount(0);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
});

test('switches language without recollecting and filters human-readable labels in both languages', async ({ page }) => {
  await page.addInitScript(() => {
    window.batteryReads = 0;
    Object.defineProperty(navigator, 'getBattery', { configurable: true, value: async () => {
      window.batteryReads++;
      return { level: 0.5, charging: false };
    } });
  });
  await page.goto('/?lang=en');
  await ready(page);
  const timestamp = await page.locator('#snapshotTime').textContent();
  await page.locator('#languageSwitch').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page).toHaveTitle('taken. — 浏览器画像');
  await expect(page.locator('#refreshButton')).toHaveText('再看一眼');
  await expect(page.locator('#exportButton')).toHaveText('留一份副本');
  await expect(page.locator('#detailsButton')).toHaveText('再看看图形与字体');
  await openFacts(page);
  await page.locator('#filterInput').fill('电量');
  await expect(page.locator('#observations .fact:visible')).toHaveCount(1);
  await expect(fact(page, 'battery')).toBeVisible();
  await page.locator('#filterInput').fill('time zone');
  await expect(page.locator('#observations .fact:visible')).toHaveCount(1);
  await expect(fact(page, 'timeZone')).toBeVisible();
  await page.locator('#filterInput').fill('not-a-real-field');
  await expect(page.locator('#emptyResults')).toBeVisible();
  await expect(page.locator('#observations .fact-group:visible')).toHaveCount(0);
  await expect(observation(page, 'timeZone')).toBeVisible();
  await page.locator('#filterInput').fill('navigator.');
  await expect(page.locator('#observations .fact:visible')).toHaveCount(0);
  await page.locator('#filterInput').fill('');
  await expect(page.locator('#emptyResults')).toBeHidden();
  await page.locator('#languageSwitch').click();
  await expect(page.locator('#snapshotTime')).toHaveText(timestamp);
  expect(await page.evaluate(() => window.batteryReads)).toBe(1);
});

test('graphics and fonts run only on request and successful optional details can be cleared', async ({ page }) => {
  await stubOptionalProbes(page);
  await page.goto('/?lang=en');
  await ready(page);
  expect(await page.evaluate(() => window.optionalProbeCalls)).toEqual([]);
  await expect(page.locator('#optionalResults .fact')).toHaveCount(0);
  await expect(page.locator('#clearOptionalButton')).toBeHidden();
  await page.locator('#detailsButton').click();
  await optionalReady(page);
  await expect(page.locator('#optionalResults .fact:visible')).toHaveCount(2);
  await expect(fact(page, 'graphics').locator('.datum')).toHaveText('Fixture Vendor · Fixture Renderer');
  await expect(fact(page, 'fontHints').locator('.datum')).toHaveText('Arial');
  await expect(page.locator('#optionalResults .fact-status, #optionalResults a')).toHaveCount(0);
  const probes = await page.evaluate(() => window.optionalProbeCalls);
  expect(probes.filter(call => call === 'graphics')).toHaveLength(1);
  expect(probes.filter(call => call === 'release-graphics')).toHaveLength(1);
  expect(probes.filter(call => call === 'font-width').length).toBeGreaterThan(0);
  expect(probes.filter(call => call === 'font-width').length).toBeLessThanOrEqual(33);
  expect(probes).not.toContain('permission');
  expect(probes).not.toContain('local-font-access');
  await expect(page.locator('body > span')).toHaveCount(0);
  await page.locator('#clearOptionalButton').click();
  await expect(page.locator('#optionalResults .fact')).toHaveCount(0);
  await expect(page.locator('#detailsButton')).toBeEnabled();
  await expect(page.locator('#clearOptionalButton')).toBeHidden();
  await optionalReady(page);
});

test('empty or unsupported optional checks show no failed facts or empty groups', async ({ page }) => {
  await stubOptionalProbes(page, { empty: true });
  await page.goto('/?lang=en');
  await ready(page);
  await page.locator('#detailsButton').click();
  await optionalReady(page);
  await expectUndisclosed(page, 'graphics');
  await expectUndisclosed(page, 'fontHints');
  await expect(page.locator('#optionalResults .fact:visible, #optionalResults .fact-group:visible')).toHaveCount(0);
  await expect(page.locator('#clearOptionalButton')).toBeHidden();
  await expect(page.locator('#detailsButton')).toBeEnabled();
  await expect(page.locator('body > span')).toHaveCount(0);
});

test('clearing and refreshing cannot resurrect stale asynchronous graphics or font results', async ({ page }) => {
  await stubOptionalProbes(page);
  await deferOptionalChecks(page);
  await page.goto('/?lang=en');
  await ready(page);
  await page.locator('#detailsButton').click();
  await expect(page.locator('#optionalResults')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#detailsButton')).toBeDisabled();
  await expect(page.locator('#exportButton')).toBeDisabled();
  await expectUndisclosed(page, 'graphics');
  await expectUndisclosed(page, 'fontHints');
  expect(await page.evaluate(() => window.pendingOptionalReads.length)).toBe(2);
  await page.locator('#clearOptionalButton').click();
  await optionalReady(page);
  await releaseOptionalChecks(page);
  await expect(page.locator('#optionalResults .fact')).toHaveCount(0);
  await expect(page.locator('#detailsButton')).toBeEnabled();
  await expect(page.locator('#clearOptionalButton')).toBeHidden();

  await page.locator('#detailsButton').click();
  await expect(page.locator('#optionalResults')).toHaveAttribute('aria-busy', 'true');
  await page.locator('#refreshButton').click();
  await ready(page);
  await releaseOptionalChecks(page);
  await expect(page.locator('#optionalResults .fact')).toHaveCount(0);
  await optionalReady(page);
  await expect(page.locator('#detailsButton')).toBeEnabled();
  await expect(page.locator('#scanStatus')).toHaveText('');

  // A fresh generation still works after both interrupted flows.
  await page.locator('#detailsButton').click();
  await expect(page.locator('#optionalResults')).toHaveAttribute('aria-busy', 'true');
  await releaseOptionalChecks(page);
  await optionalReady(page);
  await expect(page.locator('#optionalResults .fact:visible')).toHaveCount(2);
  await expect(page.locator('#exportButton')).toBeEnabled();
  await expect(page.locator('body > span')).toHaveCount(0);
});

test('link copy strips query and fragment, with an honest clipboard fallback and restored focus', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new DOMException('Denied', 'NotAllowedError'); } } });
  });
  await page.goto('/?lang=en&private=secret#profile');
  await page.locator('[data-open="share"]').click();
  await expect(page.locator('#shareUrl')).toHaveValue('http://127.0.0.1:4173/');
  await page.locator('#copyButton').click();
  await expect(page.locator('#copyStatus')).toHaveText('Clipboard unavailable. Select and copy the link above.');
  await expect(page.locator('#shareUrl')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#shareModal')).not.toBeVisible();
  await expect(page.locator('[data-open="share"]')).toBeFocused();
});

test('JSON contains only successful human-readable facts and includes optional details only after use', async ({ page }) => {
  await stubOptionalProbes(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'getBattery', { configurable: true, value: async () => { throw new DOMException('Blocked', 'NotAllowedError'); } });
  });
  await page.goto('/?lang=en&private=secret#profile');
  await ready(page);
  const initial = await downloadPortrait(page);
  expect(Object.keys(initial.snapshot).sort()).toEqual(['capturedAt', 'facts', 'privacy', 'schemaVersion']);
  expect(initial.snapshot.schemaVersion).toBe(1);
  expect(Number.isNaN(Date.parse(initial.snapshot.capturedAt))).toBe(false);
  expect(initial.snapshot.privacy).toEqual(expect.any(String));
  expect(initial.snapshot.facts.length).toBeGreaterThan(0);
  expect(initial.snapshot.facts).toEqual(await shownFacts(page));
  for (const record of initial.snapshot.facts) {
    expect(Object.keys(record).sort()).toEqual(['label', 'value']);
    expect(typeof record.label).toBe('string');
    expect(typeof record.value).toBe('string');
    expect(record.label.trim()).not.toBe('');
    expect(record.value.trim()).not.toBe('');
  }
  expect(initial.text).not.toMatch(/private=secret|#profile|127\.0\.0\.1|https?:\/\/|navigator\.|matchMedia\(|\(prefers-|\(pointer:|\(hover:|"source"|"status"|"capability"|"permission"/);
  expect(initial.snapshot.facts.some(record => /battery|graphics|renders your world|possible fonts|permission|API|secure context/i.test(record.label))).toBe(false);

  await page.locator('#detailsButton').click();
  await optionalReady(page);
  const withOptional = await downloadPortrait(page);
  expect(withOptional.snapshot.facts).toEqual(await shownFacts(page));
  expect(withOptional.snapshot.facts).toHaveLength(initial.snapshot.facts.length + 2);
  expect(withOptional.snapshot.facts.some(record => record.value === 'Fixture Vendor · Fixture Renderer')).toBe(true);
  expect(withOptional.snapshot.facts.some(record => record.value === 'Arial')).toBe(true);
  await page.locator('#clearOptionalButton').click();
  const cleared = await downloadPortrait(page);
  expect(cleared.snapshot.facts).toEqual(initial.snapshot.facts);
});

test('real optional checks remain bounded and refresh leaves no probe elements or old details', async ({ page }) => {
  await page.goto('/?lang=en');
  await ready(page);
  await page.locator('#detailsButton').click();
  await optionalReady(page);
  expect(await page.locator('#optionalResults .fact:visible').count()).toBeLessThanOrEqual(2);
  await expect(page.locator('body > span')).toHaveCount(0);
  await expect(page.locator('#detailsButton')).toBeEnabled();
  await page.locator('#refreshButton').click();
  await page.locator('#refreshButton').click();
  await ready(page);
  await expect(observation(page, 'timeZone')).toBeVisible();
  await expect(page.locator('#optionalResults .fact')).toHaveCount(0);
  await expect(page.locator('#scanStatus')).toHaveText('');
});

test('mobile and reduced-motion layouts are immediately usable with accessible dialogs', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?lang=zh');
  await expect(page.locator('#inspector')).toBeVisible();
  await expect(page.locator('#skipButton')).toBeDisabled();
  await ready(page);
  await expect(page.locator('#allFacts')).toHaveJSProperty('open', false);
  await expect(page.locator('#portrait .portrait-chapter').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await openFacts(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('[data-open="sources"]').click();
  await expect(page.locator('#sourcesModal')).toBeVisible();
  await page.locator('#sourcesModal [data-close]').click();
  await expect(page.locator('[data-open="sources"]')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
