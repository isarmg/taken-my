import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { checks } from '../../browser-info.js';

const fact = (page, id) => page.locator(`[data-fact-id="${id}"]`);
const ready = page => expect(page.locator('#scanStatus')).toContainText(/Snapshot ready|快照已就绪/);

test('collects locally with sources, no external requests, writes, or sensor activation', async ({ page }) => {
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
  });
  await page.goto('/?lang=en');
  await page.locator('#skipButton').click();
  await ready(page);
  await expect(page.locator('#observations .fact')).toHaveCount(checks.length);
  await expect(page.locator('#observations .source-link')).toHaveCount(checks.length);
  expect(await page.evaluate(() => window.sensitiveCalls)).toEqual([]);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, '']);
  await expect(page.locator('#optionalResults .fact')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  expect(requests.length).toBeGreaterThan(2);
  expect(requests.every(request => request.url.startsWith('http://127.0.0.1:4173/') && request.method === 'GET' && ['document', 'script', 'stylesheet', 'font', 'other'].includes(request.type))).toBe(true);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("connect-src 'none'");
});

test('unsupported, blocked, and hanging APIs keep independent statuses and partial results', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'getBattery', { value: () => new Promise(() => {}), configurable: true });
    Object.defineProperty(navigator, 'storage', { value: { estimate: async () => { throw new DOMException('Blocked', 'NotAllowedError'); }, persisted: async () => false }, configurable: true });
    Object.defineProperty(navigator, 'connection', { value: undefined, configurable: true });
  });
  await page.goto('/?lang=en');
  await page.locator('#skipButton').click();
  await expect(fact(page, 'userAgent').locator('.fact-status')).toHaveText('Available');
  await expect(fact(page, 'battery').locator('.fact-status')).toHaveText('Reading');
  await expect(fact(page, 'storage').locator('.fact-status')).toHaveText('Blocked');
  await expect(fact(page, 'effectiveType').locator('.fact-status')).toHaveText('Not exposed');
  await expect(fact(page, 'battery').locator('.fact-status')).toHaveText('Timed out');
  await ready(page);
  await expect(page.locator('#exportButton')).toBeEnabled();
});

test('browser strings are text, never markup', async ({ page }) => {
  await page.addInitScript(() => {
    const value = '<img class="injected" src="https://invalid.example/x" onerror="window.injected=true">';
    Object.defineProperty(navigator, 'userAgent', { value, configurable: true });
    Object.defineProperty(navigator, 'languages', { value: [value], configurable: true });
  });
  await page.goto('/?lang=en');
  await ready(page);
  await expect(fact(page, 'userAgent').locator('.datum')).toContainText('<img class="injected"');
  await expect(page.locator('img.injected')).toHaveCount(0);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
});

test('switches language without recollecting and filters both language labels', async ({ page }) => {
  await page.goto('/?lang=en');
  await ready(page);
  const timestamp = await page.locator('#snapshotTime').textContent();
  await page.locator('#languageSwitch').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('#refreshButton')).toHaveText('重新检测');
  await expect(page.locator('#exportButton')).toHaveText('导出本地 JSON');
  await expect(page.locator('#permissionsButton')).toHaveText('读取权限状态');
  await page.locator('#filterInput').fill('电池');
  await expect(page.locator('#observations .fact:visible')).toHaveCount(1);
  await page.locator('#filterInput').fill('time zone');
  await expect(page.locator('#observations .fact:visible')).toHaveCount(1);
  await page.locator('#filterInput').fill('not-a-real-field');
  await expect(page.locator('#emptyResults')).toBeVisible();
  await page.locator('#filterInput').fill('');
  await page.locator('#availableOnly').check();
  expect(await page.locator('#observations .fact:visible .fact-status').allTextContents()).not.toContain('未提供');
  await page.locator('#languageSwitch').click();
  await expect(page.locator('#snapshotTime')).toHaveText(timestamp);
});

test('permission reads are explicit, denied is a value, and optional results can be cleared', async ({ page }) => {
  await page.addInitScript(() => {
    window.permissionReads = [];
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async ({ name }) => {
      window.permissionReads.push(name);
      if (name === 'camera') throw new TypeError('Unsupported permission');
      return { state: name === 'geolocation' ? 'denied' : 'prompt' };
    } } });
  });
  await page.goto('/?lang=en');
  await ready(page);
  expect(await page.evaluate(() => window.permissionReads)).toEqual([]);
  await page.locator('#permissionsButton').click();
  await expect(page.locator('#optionalStatus')).toContainText('finished');
  await expect(fact(page, 'permission-geolocation').locator('.datum')).toHaveText('Denied');
  await expect(fact(page, 'permission-camera').locator('.fact-status')).toHaveText('Not exposed');
  await expect(fact(page, 'permission-microphone').locator('.datum')).toHaveText('Prompt');
  expect(await page.evaluate(() => window.permissionReads)).toEqual(['geolocation', 'camera', 'microphone', 'notifications']);
  await page.locator('#clearOptionalButton').click();
  await expect(page.locator('#optionalResults .fact')).toHaveCount(0);
  await expect(page.locator('#permissionsButton')).toBeEnabled();
});

test('clearing and refreshing cannot resurrect old asynchronous optional results', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: () => new Promise(resolve => setTimeout(() => resolve({ state: 'granted' }), 600)) } });
  });
  await page.goto('/?lang=en');
  await ready(page);
  await page.locator('#permissionsButton').click();
  await page.locator('#clearOptionalButton').click();
  await page.waitForTimeout(750);
  await expect(page.locator('#optionalResults .fact')).toHaveCount(0);
  await expect(page.locator('#optionalStatus')).toContainText('cleared');
  await page.locator('#permissionsButton').click();
  await page.locator('#refreshButton').click();
  await ready(page);
  await page.waitForTimeout(750);
  await expect(page.locator('#optionalResults .fact')).toHaveCount(0);
  await expect(page.locator('#optionalStatus')).toHaveText('');
});

test('link copy strips query and fragment, with an honest clipboard fallback', async ({ page }) => {
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

test('local JSON contains statuses, excludes the page URL, and includes optional checks only after use', async ({ page }) => {
  await page.goto('/?lang=en&private=secret#profile');
  await ready(page);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportButton').click();
  const download = await downloadPromise;
  const text = await readFile(await download.path(), 'utf8');
  const snapshot = JSON.parse(text);
  expect(snapshot.schemaVersion).toBe(1);
  expect(snapshot.facts).toHaveLength(checks.length);
  expect(snapshot.facts.every(record => record.id && record.source && record.status && 'value' in record)).toBe(true);
  expect(text).not.toContain('private=secret');
  expect(text).not.toContain('#profile');
  expect(snapshot.facts.some(record => record.id.startsWith('permission-'))).toBe(false);
});

test('optional graphics and fonts remain bounded and leave no probe elements', async ({ page }) => {
  await page.goto('/?lang=en');
  await ready(page);
  await page.locator('#detailsButton').click();
  await expect(page.locator('#optionalStatus')).toContainText('finished');
  await expect(page.locator('#optionalResults .fact')).toHaveCount(2);
  await expect(fact(page, 'fontHints').locator('.fact-status')).toHaveText('Available');
  expect(await page.locator('body > span').count()).toBe(0);
  await page.locator('#refreshButton').click();
  await page.locator('#refreshButton').click();
  await ready(page);
  await expect(page.locator('#observations .fact')).toHaveCount(checks.length);
  await expect(page.locator('#optionalResults .fact')).toHaveCount(0);
});

test('mobile and reduced-motion layouts are immediately usable with accessible dialogs', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?lang=zh');
  await expect(page.locator('#inspector')).toBeVisible();
  await expect(page.locator('#skipButton')).toBeDisabled();
  await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('[data-open="sources"]').click();
  await expect(page.locator('#sourcesModal')).toBeVisible();
  await page.locator('#sourcesModal [data-close]').click();
  await expect(page.locator('[data-open="sources"]')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
