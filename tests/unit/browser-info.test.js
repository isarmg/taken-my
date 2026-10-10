import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STATUS, GROUPS, checks, permissionChecks, detailChecks, metadata, errorStatus,
  withTimeout, readCheck, collectFacts, cleanShareUrl, exportSnapshot
} from '../../browser-info.js';

// All browser APIs are local fixtures. These tests never contact a service,
// open a device, request a permission, or depend on the host's browser settings.
function browserEnv() {
  return {
    navigator: {
      userAgent: 'Test Browser/1.0',
      languages: ['en-US', 'zh-CN'],
      maxTouchPoints: 0,
      hardwareConcurrency: 8,
      deviceMemory: 4,
      onLine: false,
      connection: { effectiveType: '4g', downlink: 0, rtt: 0, saveData: false },
      storage: {
        estimate: async () => ({ usage: 0, quota: 1024 }),
        persisted: async () => false
      },
      getBattery: async () => ({ level: 0, charging: false }),
      cookieEnabled: false,
      doNotTrack: '1',
      globalPrivacyControl: false,
      geolocation: {},
      mediaDevices: {},
      clipboard: {},
      gpu: {},
      serviceWorker: {},
      permissions: { query: async () => ({ state: 'prompt' }) }
    },
    Intl: {
      DateTimeFormat: class {
        resolvedOptions() {
          return { locale: 'en-US', timeZone: 'Asia/Shanghai', calendar: 'gregory', numberingSystem: 'latn', hourCycle: 'h12' };
        }
      }
    },
    Date: class { getTimezoneOffset() { return -480; } },
    screen: { width: 1440, height: 900, availWidth: 1440, availHeight: 860, colorDepth: 24, orientation: { type: 'landscape-primary' } },
    innerWidth: 1280,
    innerHeight: 720,
    visualViewport: { width: 1279.6, height: 719.6 },
    devicePixelRatio: 2,
    matchMedia: query => ({ matches: ['(pointer: fine)', '(hover: hover)', '(color-gamut: srgb)', '(color-gamut: p3)'].includes(query) }),
    isSecureContext: true,
    crossOriginIsolated: false,
    document: { visibilityState: 'visible', hasFocus: () => false },
    WebAssembly: {},
    Notification: function Notification() {}
  };
}

function byId(id, selected = checks) {
  const check = selected.find(entry => entry.id === id);
  assert.ok(check, `A check named ${id} must exist`);
  return check;
}

function syntheticCheck(id, read, options = {}) {
  return {
    id, group: 'browser', label: { en: id, zh: '测试' },
    source: 'test.fixture', docs: 'https://developer.mozilla.org/en-US/docs/Web/API/Navigator',
    note: { en: 'Test fixture', zh: '测试数据' }, read, ...options
  };
}

function namedError(name, message = 'private information must not escape an exception') {
  return Object.assign(new Error(message), { name });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const nextTurn = () => new Promise(resolve => setImmediate(resolve));

test('all facts have unique IDs, bilingual labels/caveats, a known group, and API documentation', () => {
  const definitions = [...checks, ...permissionChecks, ...detailChecks];
  assert.ok(checks.length >= 40, 'The default collection should cover the advertised browser fact groups');
  assert.equal(new Set(definitions.map(check => check.id)).size, definitions.length);
  for (const check of definitions) {
    assert.match(check.id, /^[a-z][a-zA-Z0-9-]*$/, check.id);
    assert.ok(Object.hasOwn(GROUPS, check.group), check.id);
    assert.equal(typeof check.read, 'function', check.id);
    for (const key of ['label', 'note']) {
      for (const language of ['en', 'zh']) {
        assert.equal(typeof check[key][language], 'string', `${check.id}.${key}.${language}`);
        assert.ok(check[key][language].trim(), `${check.id}.${key}.${language}`);
      }
    }
    assert.ok(check.source.trim(), `${check.id}.source`);
    const docs = new URL(check.docs);
    assert.equal(docs.origin, 'https://developer.mozilla.org', check.id);
    assert.ok(docs.pathname.startsWith('/en-US/docs/'), check.id);
    assert.ok(['text', 'queries', 'storage', 'battery', 'support', 'permission', 'graphics', 'fonts'].includes(check.format ?? 'text'), `${check.id}.format`);
  }
  for (const translations of [...Object.values(STATUS), ...Object.values(GROUPS)]) {
    assert.ok(translations.en.trim());
    assert.ok(translations.zh.trim());
  }
});

test('metadata is read-only presentation data and starts pending with no value', () => {
  const check = syntheticCheck('example', () => 7, { secure: true });
  const result = metadata(check);
  assert.equal(result.status, 'pending');
  assert.equal(result.value, null);
  assert.equal(result.id, check.id);
  assert.deepEqual(result.label, check.label);
  assert.equal(Object.hasOwn(result, 'read'), false);
  assert.equal(Object.hasOwn(result, 'secure'), false);
  assert.equal(metadata(check, 'not-checked').status, 'not-checked');
  assert.equal(check.secure, true);
  assert.equal(typeof check.read, 'function');
  assert.equal(Object.hasOwn(check, 'status'), false);
});

test('available browser facts preserve their reported types and values', async () => {
  const env = browserEnv();
  const results = await collectFacts({ env });
  const actual = Object.fromEntries(results.map(result => [result.id, result.value]));
  assert.equal(results.length, checks.length);
  assert.ok(results.every(result => result.status === 'available'));
  assert.equal(actual.userAgent, 'Test Browser/1.0');
  assert.deepEqual(actual.languages, ['en-US', 'zh-CN']);
  assert.notEqual(actual.languages, env.navigator.languages, 'Copy the language list rather than exposing its original array');
  assert.equal(actual.timeZone, 'Asia/Shanghai');
  assert.equal(actual.utcOffset, 480);
  assert.equal(actual.screen, '1440 × 900');
  assert.equal(actual.availableScreen, '1440 × 860');
  assert.equal(actual.viewport, '1280 × 720');
  assert.equal(actual.visualViewport, '1280 × 720');
  assert.deepEqual(actual.storage, { quotaBytes: 1024, usageBytes: 0 });
  assert.deepEqual(actual.battery, { levelPercent: 0, charging: false });
  assert.deepEqual(actual.pointer, ['(pointer: fine)']);
  assert.deepEqual(actual.colorGamut, ['(color-gamut: srgb)', '(color-gamut: p3)']);
  assert.deepEqual(actual.reducedMotion, []);
});

test('zero and false remain available rather than being mistaken for missing values', async () => {
  const env = browserEnv();
  const expected = {
    touchPoints: 0, online: false, downlink: 0, rtt: 0, saveData: false,
    persisted: false, isolated: false, focused: false, cookies: false, gpc: false
  };
  for (const [id, value] of Object.entries(expected)) {
    const result = await readCheck(byId(id), env);
    assert.equal(result.status, 'available', id);
    assert.equal(result.value, value, id);
  }
  env.screen.width = 0;
  env.screen.height = 0;
  assert.equal((await readCheck(byId('screen'), env)).value, '0 × 0');
});

test('undefined, null, and empty reported properties are unsupported', async () => {
  for (const missing of [undefined, null, '']) {
    const env = browserEnv();
    env.navigator.userAgent = missing;
    const result = await readCheck(byId('userAgent'), env);
    assert.equal(result.status, 'unsupported');
    assert.equal(result.value, null);
  }
});

test('optional browser APIs missing from a normal environment are unsupported independently', async () => {
  const env = browserEnv();
  delete env.navigator.connection;
  delete env.navigator.storage;
  delete env.navigator.getBattery;
  delete env.visualViewport;
  delete env.matchMedia;
  delete env.screen.orientation;
  for (const id of ['effectiveType', 'downlink', 'rtt', 'saveData', 'storage', 'persisted', 'battery', 'visualViewport', 'pointer', 'orientation']) {
    const result = await readCheck(byId(id), env);
    assert.equal(result.status, 'unsupported', id);
    assert.equal(result.value, null, id);
  }
  assert.equal((await readCheck(byId('userAgent'), env)).status, 'available');
});

test('API absence is an available false capability hint rather than a permission decision', async () => {
  const env = browserEnv();
  for (const key of ['geolocation', 'mediaDevices', 'clipboard', 'gpu', 'serviceWorker', 'permissions']) delete env.navigator[key];
  delete env.WebAssembly;
  delete env.Notification;
  const results = await collectFacts({ env, selected: checks.filter(check => check.group === 'capabilities') });
  assert.ok(results.length > 0);
  for (const result of results) {
    assert.equal(result.status, 'available', result.id);
    assert.equal(result.value, false, result.id);
  }
});

test('insecure contexts block secure-only checks before invoking their API', async () => {
  let calls = 0;
  const check = syntheticCheck('secureOnly', () => { calls += 1; return true; }, { secure: true });
  const result = await readCheck(check, { isSecureContext: false });
  assert.equal(result.status, 'blocked');
  assert.equal(result.value, null);
  assert.equal(calls, 0);
  assert.equal((await readCheck(check, { isSecureContext: true })).status, 'available');
  assert.equal(calls, 1);
  const env = browserEnv();
  env.isSecureContext = false;
  for (const fact of [...checks, ...permissionChecks].filter(entry => entry.secure)) {
    assert.equal((await readCheck(fact, env)).status, 'blocked', fact.id);
  }
  assert.equal((await readCheck(byId('secureContext'), env)).value, false);
});

test('known browser exceptions map to specific statuses without exposing error messages', async t => {
  for (const [name, status] of [
    ['UnsupportedError', 'unsupported'], ['NotAllowedError', 'blocked'],
    ['SecurityError', 'blocked'], ['TimeoutError', 'timeout'],
    ['NotFoundError', 'unavailable'], ['TypeError', 'error'], ['Error', 'error']
  ]) {
    await t.test(name, async () => {
      const error = namedError(name);
      assert.equal(errorStatus(error), status);
      for (const read of [() => { throw error; }, () => Promise.reject(error)]) {
        const result = await readCheck(syntheticCheck('throwing', read));
        assert.equal(result.status, status);
        assert.equal(result.value, null);
        assert.equal(JSON.stringify(result).includes(error.message), false);
        assert.equal(Object.hasOwn(result, 'error'), false);
      }
    });
  }
  for (const unknown of [null, undefined, 'failure', 0, {}]) assert.equal(errorStatus(unknown), 'error');
});

test('throwing browser getters fail only their fact', async () => {
  const env = browserEnv();
  Object.defineProperty(env.navigator, 'userAgent', { get() { throw namedError('SecurityError'); } });
  const results = await collectFacts({ env, selected: [byId('userAgent'), byId('languages')] });
  assert.deepEqual(results.map(result => result.status), ['blocked', 'available']);
});

test('a completed check with no value is unavailable, while false and zero remain valid', async () => {
  for (const value of [null, undefined, false, 0, []]) {
    const result = await readCheck(syntheticCheck('returnedValue', () => value));
    assert.equal(result.status, value == null ? 'unavailable' : 'available');
    assert.deepEqual(result.value, value ?? null);
  }
});

test('withTimeout accepts immediate and promised results and preserves thrown failures', async () => {
  assert.equal(await withTimeout(() => 0), 0);
  assert.equal(await withTimeout(async () => false), false);
  const error = namedError('SecurityError');
  await assert.rejects(withTimeout(() => { throw error; }), actual => actual === error);
  await assert.rejects(withTimeout(() => Promise.reject(error)), actual => actual === error);
});

test('withTimeout bounds a stalled API call', async () => {
  await assert.rejects(withTimeout(() => new Promise(() => {}), 10), { name: 'TimeoutError' });
});

test('collectFacts publishes independent partial results and times out only the stalled fact', async () => {
  const hanging = deferred();
  const waiting = deferred();
  const fastPublished = deferred();
  const errorPublished = deferred();
  const started = [];
  const updates = [];
  const selected = [
    syntheticCheck('hanging', () => { started.push('hanging'); return hanging.promise; }),
    syntheticCheck('waiting', () => { started.push('waiting'); return waiting.promise; }),
    syntheticCheck('fast', () => { started.push('fast'); return 0; }),
    syntheticCheck('failed', () => { started.push('failed'); throw namedError('NotAllowedError'); })
  ];
  let finished = false;
  const collecting = collectFacts({
    selected, timeoutMs: 100,
    onResult: result => {
      updates.push(result);
      if (result.id === 'fast') fastPublished.resolve();
      if (result.id === 'failed') errorPublished.resolve();
    }
  }).then(results => { finished = true; return results; });
  await Promise.all([fastPublished.promise, errorPublished.promise]);
  assert.deepEqual(started, selected.map(check => check.id));
  assert.equal(finished, false, 'A hanging check must not prevent fast facts being rendered');
  assert.deepEqual(new Set(updates.map(result => result.id)), new Set(['fast', 'failed']));
  waiting.resolve(false);
  await nextTurn();
  assert.equal(updates.find(result => result.id === 'waiting')?.value, false);
  const results = await collecting;
  assert.deepEqual(results.map(result => result.id), selected.map(check => check.id), 'Final results retain definition order');
  assert.deepEqual(results.map(result => result.status), ['timeout', 'available', 'available', 'blocked']);
  assert.equal(updates.length, selected.length);
  hanging.resolve('too late');
  await nextTurn();
  assert.equal(updates.length, selected.length, 'Late API completion must not publish a second result');
  assert.equal(results[0].value, null);
});

test('empty and repeated collections are isolated', async () => {
  let notifications = 0;
  assert.deepEqual(await collectFacts({ selected: [], onResult: () => { notifications += 1; } }), []);
  assert.equal(notifications, 0);
  const env = browserEnv();
  const selected = [byId('online')];
  const first = await collectFacts({ env, selected });
  env.navigator.onLine = true;
  const second = await collectFacts({ env, selected });
  assert.equal(first[0].value, false);
  assert.equal(second[0].value, true);
  assert.notEqual(first[0], second[0]);
});

test('storage estimates accept zero but reject absent and nonfinite byte counts', async () => {
  const env = browserEnv();
  env.navigator.storage.estimate = async () => ({ quota: 0, usage: 0 });
  const zero = await readCheck(byId('storage'), env);
  assert.equal(zero.status, 'available');
  assert.deepEqual(zero.value, { quotaBytes: 0, usageBytes: 0 });
  for (const estimate of [{}, { quota: 1024 }, { usage: 0 }, { quota: Infinity, usage: 0 }, { quota: 1024, usage: NaN }, { quota: '1024', usage: 0 }]) {
    env.navigator.storage.estimate = async () => estimate;
    assert.equal((await readCheck(byId('storage'), env)).status, 'unsupported');
  }
});

test('battery snapshot is rounded and requires both level and charging state', async () => {
  const env = browserEnv();
  env.navigator.getBattery = async () => ({ level: 0.456, charging: true });
  assert.deepEqual((await readCheck(byId('battery'), env)).value, { levelPercent: 46, charging: true });
  for (const battery of [{ level: 0 }, { charging: false }]) {
    env.navigator.getBattery = async () => battery;
    assert.equal((await readCheck(byId('battery'), env)).status, 'unsupported');
  }
});

test('permission checks only query the four named states and preserve denied as a result', async () => {
  const env = browserEnv();
  const calls = [];
  const states = { geolocation: 'denied', camera: 'prompt', microphone: 'granted', notifications: 'denied' };
  env.navigator.permissions.query = async descriptor => {
    calls.push(descriptor);
    return { state: states[descriptor.name] };
  };
  const results = await collectFacts({ env, selected: permissionChecks });
  assert.deepEqual(calls, Object.keys(states).map(name => ({ name })));
  for (const result of results) {
    assert.equal(result.status, 'available');
    assert.equal(result.value, states[result.id.slice('permission-'.length)]);
  }
  assert.ok(permissionChecks.every(check => !checks.includes(check)), 'Permission queries must remain opt-in');
});

test('unsupported permission names and missing Permissions API are distinguished from denial', async () => {
  const env = browserEnv();
  env.navigator.permissions.query = async () => { throw new TypeError('Unsupported permission descriptor'); };
  for (const check of permissionChecks) assert.equal((await readCheck(check, env)).status, 'unsupported');
  delete env.navigator.permissions;
  assert.equal((await readCheck(permissionChecks[0], env)).status, 'unsupported');
  env.navigator.permissions = { query: async () => { throw namedError('NotAllowedError'); } };
  assert.equal((await readCheck(permissionChecks[0], env)).status, 'blocked');
  env.navigator.permissions.query = async () => { throw new Error('Unexpected failure'); };
  assert.equal((await readCheck(permissionChecks[0], env)).status, 'error');
});

test('optional graphics and font checks are never included in automatic collection', () => {
  assert.deepEqual(detailChecks.map(check => check.id), ['graphics', 'fontHints']);
  assert.ok(detailChecks.every(check => !checks.includes(check)));
  assert.ok(detailChecks.every(check => metadata(check, 'not-checked').status === 'not-checked'));
});

function graphicsEnv({ extensionAvailable = true, failRead = false } = {}) {
  const env = browserEnv();
  const calls = [];
  let released = 0;
  const extension = { UNMASKED_VENDOR_WEBGL: 37445, UNMASKED_RENDERER_WEBGL: 37446 };
  const values = { 37445: 'Test GPU vendor', 37446: 'Test GPU renderer', 7936: 'Masked vendor', 7937: 'Masked renderer' };
  const context = {
    VENDOR: 7936,
    RENDERER: 7937,
    getExtension(name) {
      calls.push(name);
      if (name === 'WEBGL_debug_renderer_info') return extensionAvailable ? extension : null;
      if (name === 'WEBGL_lose_context') return { loseContext() { released += 1; } };
      throw new Error(`Unexpected extension: ${name}`);
    },
    getParameter(name) {
      calls.push(name);
      if (failRead) throw namedError('SecurityError');
      assert.ok(Object.hasOwn(values, name));
      return values[name];
    }
  };
  env.document.createElement = tag => {
    assert.equal(tag, 'canvas');
    return {
      getContext(type) { assert.equal(type, 'webgl'); return context; },
      toDataURL() { assert.fail('Optional graphics observations must not extract an image'); }
    };
  };
  return { env, calls, released: () => released };
}

test('optional graphics reads reported renderer strings and releases its temporary context', async () => {
  const fixture = graphicsEnv();
  const result = await readCheck(byId('graphics', detailChecks), fixture.env);
  assert.equal(result.status, 'available');
  assert.deepEqual(result.value, { vendor: 'Test GPU vendor', renderer: 'Test GPU renderer', unmaskedExtension: true });
  assert.deepEqual(fixture.calls, ['WEBGL_debug_renderer_info', 37445, 37446, 'WEBGL_lose_context']);
  assert.equal(fixture.released(), 1);
});

test('optional graphics falls back to masked values when the debug extension is unavailable', async () => {
  const fixture = graphicsEnv({ extensionAvailable: false });
  const result = await readCheck(byId('graphics', detailChecks), fixture.env);
  assert.equal(result.status, 'available');
  assert.deepEqual(result.value, { vendor: 'Masked vendor', renderer: 'Masked renderer', unmaskedExtension: false });
  assert.equal(fixture.released(), 1);
});

test('optional graphics reports missing contexts and cleans up after blocked parameter reads', async () => {
  const env = browserEnv();
  env.document.createElement = () => ({ getContext: () => null });
  assert.equal((await readCheck(byId('graphics', detailChecks), env)).status, 'unsupported');
  const fixture = graphicsEnv({ failRead: true });
  assert.equal((await readCheck(byId('graphics', detailChecks), fixture.env)).status, 'blocked');
  assert.equal(fixture.released(), 1, 'Context release must run even if a parameter read throws');
});

function fontEnv({ failRead = false, matches = [] } = {}) {
  const env = browserEnv();
  let attached = false;
  let removed = 0;
  const families = [];
  const widths = { monospace: 200, 'sans-serif': 180, serif: 190 };
  const probe = {
    style: {}, textContent: '',
    get offsetWidth() {
      assert.equal(attached, true);
      if (failRead) throw namedError('SecurityError');
      const family = this.style.fontFamily;
      families.push(family);
      if (Object.hasOwn(widths, family)) return widths[family];
      const match = /^"([^"]+)", (monospace|sans-serif|serif)$/.exec(family);
      assert.ok(match, 'Only fixed candidate names and local fallback families are probed');
      return widths[match[2]] + (matches.includes(match[1]) ? 1 : 0);
    },
    remove() { assert.equal(attached, true); attached = false; removed += 1; }
  };
  env.document.createElement = tag => { assert.equal(tag, 'span'); return probe; };
  env.document.body = { appendChild(node) { assert.equal(node, probe); attached = true; } };
  env.queryLocalFonts = () => assert.fail('Font hints must not request installed-font enumeration');
  env.document.fonts = {
    check: () => assert.fail('Font hints must not use font-set membership as proof of installation'),
    load: () => assert.fail('Font hints must not load a font resource')
  };
  return { env, families, probe, attached: () => attached, removed: () => removed };
}

test('optional font hints use a bounded local candidate list and remove their hidden probe', async () => {
  const fixture = fontEnv({ matches: ['Arial', 'Menlo'] });
  const result = await readCheck(byId('fontHints', detailChecks), fixture.env);
  assert.equal(result.status, 'available');
  assert.deepEqual(result.value, ['Arial', 'Menlo']);
  assert.equal(fixture.removed(), 1);
  assert.equal(fixture.attached(), false);
  assert.match(fixture.probe.style.cssText, /visibility:hidden/);
  assert.match(fixture.probe.style.cssText, /font-size:72px/);
  assert.ok(fixture.families.length <= 33, 'Only three baseline widths and at most ten × three candidate widths are read');
});

test('font no-match results stay an empty observation and font errors still remove their probe', async () => {
  const unmatched = fontEnv();
  const result = await readCheck(byId('fontHints', detailChecks), unmatched.env);
  assert.equal(result.status, 'available');
  assert.deepEqual(result.value, []);
  assert.equal(unmatched.removed(), 1);
  const failing = fontEnv({ failRead: true });
  assert.equal((await readCheck(byId('fontHints', detailChecks), failing.env)).status, 'blocked');
  assert.equal(failing.removed(), 1);
  assert.equal(failing.attached(), false);
});

test('cleanShareUrl removes query, hash, username, and password while preserving host/path', () => {
  for (const [input, expected] of [
    ['https://alice:secret@example.test:8443/browser/portrait?email=a%40b.test&token=secret#visitor-id', 'https://example.test:8443/browser/portrait'],
    ['http://user:p%40ss@localhost:5173/?lang=zh#details', 'http://localhost:5173/'],
    ['https://example.test/nested/space%20name/?x=1&x=2#top', 'https://example.test/nested/space%20name/'],
    ['https://example.test/', 'https://example.test/']
  ]) {
    assert.equal(cleanShareUrl(input), expected);
    const cleaned = new URL(cleanShareUrl(input));
    assert.equal(cleaned.search, '');
    assert.equal(cleaned.hash, '');
    assert.equal(cleaned.username, '');
    assert.equal(cleaned.password, '');
    assert.equal(cleanShareUrl(cleaned.href), expected, 'Sanitization is idempotent');
  }
  assert.throws(() => cleanShareUrl('not a URL'), TypeError);
});

test('export has a stable allowlist and drops presentation internals, URLs, and identifiers', () => {
  const capturedAt = '2026-10-10T12:00:00.000Z';
  const record = {
    ...metadata(byId('online')), status: 'available', value: false,
    url: 'https://private.example/?token=secret', referrer: 'https://private.example/from',
    visitorId: 'private-visitor-id', sessionId: 'private-session-id', read: () => true,
    error: 'private exception details'
  };
  const snapshot = exportSnapshot([record], capturedAt);
  assert.deepEqual(Object.keys(snapshot).sort(), ['capturedAt', 'facts', 'privacy', 'schemaVersion']);
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.capturedAt, capturedAt);
  assert.match(snapshot.privacy, /review before sharing/i);
  assert.deepEqual(snapshot.facts, [{ id: 'online', group: 'network', source: 'navigator.onLine', status: 'available', value: false }]);
  const serialized = JSON.stringify(snapshot);
  for (const secret of ['https://', 'private-visitor-id', 'private-session-id', 'private exception details', 'referrer']) {
    assert.equal(serialized.includes(secret), false, secret);
  }
  assert.equal(record.visitorId, 'private-visitor-id', 'Export must not mutate its input');
  assert.deepEqual(exportSnapshot([], capturedAt).facts, []);
});

test('default collection does not access page URLs, identifiers, active sensors, storage writes, or network APIs', async () => {
  const env = browserEnv();
  const calls = [];
  const forbidden = name => function () { calls.push(name); throw new Error(`Unexpected active operation: ${name}`); };
  const forbidProperty = (target, key, name = key) => Object.defineProperty(target, key, {
    configurable: true, get: forbidden(`read ${name}`), set: forbidden(`write ${name}`)
  });
  for (const key of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'RTCPeerConnection', 'AudioContext', 'OfflineAudioContext', 'Worker', 'SharedWorker']) env[key] = forbidden(key);
  for (const key of ['location', 'localStorage', 'sessionStorage', 'name']) forbidProperty(env, key);
  for (const key of ['referrer', 'URL', 'documentURI', 'cookie']) forbidProperty(env.document, key, `document.${key}`);
  env.document.createElement = forbidden('document.createElement');
  env.document.fonts = { check: forbidden('document.fonts.check'), load: forbidden('document.fonts.load') };
  env.navigator.sendBeacon = forbidden('navigator.sendBeacon');
  env.navigator.geolocation = { getCurrentPosition: forbidden('geolocation.getCurrentPosition'), watchPosition: forbidden('geolocation.watchPosition') };
  env.navigator.mediaDevices = { getUserMedia: forbidden('mediaDevices.getUserMedia'), getDisplayMedia: forbidden('mediaDevices.getDisplayMedia'), enumerateDevices: forbidden('mediaDevices.enumerateDevices') };
  env.navigator.clipboard = { read: forbidden('clipboard.read'), readText: forbidden('clipboard.readText'), write: forbidden('clipboard.write'), writeText: forbidden('clipboard.writeText') };
  env.navigator.gpu = { requestAdapter: forbidden('gpu.requestAdapter') };
  env.navigator.serviceWorker = { register: forbidden('serviceWorker.register') };
  env.navigator.permissions = { query: forbidden('permissions.query'), request: forbidden('permissions.request') };
  env.navigator.storage.persist = forbidden('storage.persist');
  env.indexedDB = { open: forbidden('indexedDB.open'), deleteDatabase: forbidden('indexedDB.deleteDatabase') };
  env.crypto = { randomUUID: forbidden('crypto.randomUUID'), getRandomValues: forbidden('crypto.getRandomValues'), subtle: { digest: forbidden('crypto.subtle.digest') } };
  env.Notification = forbidden('Notification');
  env.Notification.requestPermission = forbidden('Notification.requestPermission');
  const battery = { level: 0, charging: false, addEventListener: forbidden('battery.addEventListener') };
  for (const key of ['onchargingchange', 'onlevelchange', 'onchargingtimechange', 'ondischargingtimechange']) forbidProperty(battery, key);
  env.navigator.getBattery = async () => battery;

  const results = await collectFacts({ env });
  assert.deepEqual(calls, [], 'Even caught forbidden API calls would violate passive collection');
  assert.ok(results.every(result => result.status === 'available'));
  const snapshot = exportSnapshot(results, '2026-10-10T12:00:00.000Z');
  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /https?:\/\/|referrer|visitorId|sessionId|fingerprintId|deviceId/);
  assert.deepEqual(calls, [], 'Export must be a pure transformation of already-collected results');
});
