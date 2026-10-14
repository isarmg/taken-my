import assert from 'node:assert/strict';
import test from 'node:test';
import { visitorRecords, visitorLabel, visitorValue, createPortrait, exportPortrait, browserDescription } from '../../portrait.js';
import { checks, detailChecks, permissionChecks, metadata } from '../../browser-info.js';

const definitions = [...checks, ...detailChecks, ...permissionChecks];
function fact(id, value, status = 'available') {
  return { ...metadata(definitions.find(check => check.id === id)), status, value };
}

test('visitor selection is success-only, hides diagnostics, and preserves real false/zero facts', () => {
  const records = [fact('touchPoints', 0), fact('online', false), fact('saveData', false), fact('downlink', 0),
    fact('battery', null, 'blocked'), fact('screen', '100 × 100', 'pending'), fact('graphics', null, 'unsupported'),
    fact('languages', [], 'available'), fact('timeZone', 'stale', 'timeout'), fact('storage', null, 'error'),
    fact('api-geolocation', true), fact('api-webgpu', false), fact('secureContext', true),
    fact('permission-camera', 'granted'), fact('permission-geolocation', 'denied'), fact('permission-microphone', 'prompt')];
  assert.deepEqual(visitorRecords(records).map(record => record.id), ['touchPoints', 'online', 'saveData', 'downlink']);
  assert.equal(visitorValue(records[0], 'zh'), '0');
  assert.equal(visitorValue(records[1], 'en'), 'Offline');
  assert.equal(visitorValue(records[2], 'zh'), '关闭');
});

test('an empty or unsuccessful collection has no invented chapter, placeholder, or biography', () => {
  for (const language of ['en', 'zh']) {
    assert.deepEqual(createPortrait([], language), []);
    assert.deepEqual(createPortrait(checks.map(check => metadata(check, 'unsupported')), language), []);
    const records = [fact('battery', { levelPercent: 0, charging: false }, 'blocked'), fact('languages', [])];
    assert.deepEqual(createPortrait(records, language), []);
  }
});

test('each chapter is composed only of its successful observations; partial chapters stay honest', () => {
  const records = [fact('timeZone', 'Asia/Shanghai'), fact('screen', '0 × 0'),
    fact('languages', ['zh-CN', 'en-US']), fact('battery', { levelPercent: 0, charging: false }),
    fact('storage', null, 'timeout'), fact('colorScheme', ['(prefers-color-scheme: dark)'], 'pending')];
  for (const language of ['en', 'zh']) {
    const portrait = createPortrait(records, language);
    assert.deepEqual(portrait.map(chapter => chapter.id), ['arrival', 'device', 'languages', 'resources']);
    assert.deepEqual(portrait.flatMap(chapter => chapter.lines.map(line => line.id)), ['timeZone', 'screen', 'languages', 'battery']);
    assert.ok(portrait.every(chapter => chapter.title && chapter.prose && chapter.lines.length));
    assert.match(portrait.find(chapter => chapter.id === 'resources').lines[0].value, /^0%/);
    assert.doesNotMatch(JSON.stringify(portrait), /navigator\.|WebGL|端口|需询问|读取失败|not available|Not exposed/);
  }
});

test('display preference syntax becomes ordinary language in both languages', () => {
  const records = [fact('colorScheme', ['(prefers-color-scheme: dark)']), fact('reducedMotion', ['(prefers-reduced-motion: reduce)'])];
  records[0].format = records[1].format = 'queries';
  const zh = createPortrait(records, 'zh')[0];
  const en = createPortrait(records, 'en')[0];
  assert.deepEqual(zh.lines.map(line => line.value), ['深色', '减少动态效果']);
  assert.deepEqual(en.lines.map(line => line.value), ['Dark', 'Less motion']);
  assert.doesNotMatch(JSON.stringify([zh, en]), /prefers-|matchMedia/);
});

test('browser descriptions are bounded hints, not raw user-agent dumps or guaranteed identities', () => {
  assert.equal(browserDescription('Mozilla/5.0 Windows NT 10.0 Chrome/130.0 Safari/537.36 Edg/130.0'), 'Edge · Windows');
  assert.equal(browserDescription('Mozilla/5.0 Android Chrome/130.0'), 'Chrome · Android');
  assert.equal(browserDescription('Mozilla/5.0 (Macintosh) Version/17.0 Safari/605.1.15'), 'Safari · macOS');
  assert.equal(browserDescription('<img onerror=alert(1)>'), '');
  assert.deepEqual(visitorRecords([fact('userAgent', '<img onerror=alert(1)>')]), []);
  assert.match(visitorLabel(fact('userAgent', 'Chrome/1.0'), 'en'), /reported/);
});

test('a malformed language tag remains plain text for the DOM to render safely', () => {
  const hostile = '<img src="https://example.invalid/" onerror="alert(1)">';
  const portrait = createPortrait([fact('languages', [hostile])]);
  assert.equal(portrait[0].lines[0].value, hostile);
});

test('visitor exports contain the same successful human-readable facts, without source/status/internal fields', () => {
  const records = [fact('battery', { levelPercent: 0, charging: false }), fact('online', false), fact('screen', null, 'unsupported'),
    fact('api-geolocation', true), fact('permission-camera', 'granted'), fact('fontHints', ['Arial']), fact('fontHints', [], 'available')];
  for (const language of ['en', 'zh']) {
    const result = exportPortrait(records, '2026-10-12T02:00:00Z', language);
    assert.equal(result.schemaVersion, 1);
    assert.equal(result.facts.length, 3);
    assert.deepEqual(result.facts, visitorRecords(records).map(record => ({ label: visitorLabel(record, language), value: visitorValue(record, language) })));
    assert.deepEqual(Object.keys(result.facts[0]).sort(), ['label', 'value']);
    assert.doesNotMatch(JSON.stringify(result), /source|status|navigator\.|permission-|api-|unsupported|granted/);
  }
});

test('time offset and ordinary display values are understandable and preserve zero', () => {
  const zone = fact('timeZone', 'America/New_York');
  assert.equal(visitorValue(zone), 'America/New_York');
  assert.equal(createPortrait([zone])[0].lines[0].value, 'America/New_York');
  assert.equal(exportPortrait([zone], '2026-10-12T02:00:00Z').facts[0].value, 'America/New_York');
  assert.equal(visitorValue(fact('utcOffset', 0)), 'UTC+00:00');
  assert.equal(visitorValue(fact('utcOffset', -330)), 'UTC−05:30');
  assert.equal(visitorValue(fact('orientation', 'portrait-primary'), 'zh'), '纵向');
  assert.equal(visitorValue(fact('visibility', 'hidden')), 'In the background');
  assert.equal(visitorValue(fact('focused', false), 'zh'), '否');
});


test('empty and whitespace-only observations disappear, while mixed lists are cleaned without mutation', () => {
  const records = [fact('timeZone', '   '), fact('languages', ['']), fact('fontHints', ['  ', '\t']), fact('downlink', NaN)];
  assert.deepEqual(visitorRecords(records), []);
  assert.deepEqual(createPortrait(records), []);
  assert.deepEqual(exportPortrait(records, 'now').facts, []);
  const mixed = fact('languages', ['  ', 'en-US', '']);
  assert.deepEqual(visitorRecords([mixed])[0].value, ['en-US']);
  assert.deepEqual(mixed.value, ['  ', 'en-US', '']);
  assert.equal(visitorRecords([fact('touchPoints', 0), fact('online', false)]).length, 2);
});

test('specific browser self-identification wins over compatibility tokens', () => {
  assert.equal(browserDescription('Mozilla/5.0 (Linux; Android 14) Chrome/125.0 Safari/537.36 SamsungBrowser/27.0'), 'Samsung Internet · Android');
  assert.equal(browserDescription('Mozilla/5.0 (iPhone) Version/17.0 Safari/605.1.15 OPiOS/4.0'), 'Opera · iOS');
});
