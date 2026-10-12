import assert from 'node:assert/strict';
import test from 'node:test';
import { STATUS, checks, permissionChecks, detailChecks } from '../../browser-info.js';
import { formatBytes, formatValue } from '../../display-format.js';

const available = (value, format) => ({ status: 'available', value, ...(format ? { format } : {}) });

test('byte formatting uses binary units, preserves zero, and rounds to one fractional digit', () => {
  for (const [bytes, expected] of [
    [0, '0 B'], [-0, '0 B'], [1, '1 B'], [0.5, '0.5 B'],
    [1023, '1,023 B'], [1024, '1 KiB'], [1536, '1.5 KiB'],
    [1600, '1.6 KiB'], [1024 ** 2, '1 MiB'], [1024 ** 3, '1 GiB'],
    [1024 ** 4, '1 TiB'], [1024 ** 5, '1,024 TiB'], [-1024, '-1 KiB']
  ]) {
    assert.equal(formatBytes(bytes), expected, String(bytes));
    assert.equal(formatBytes(bytes, 'en'), expected, `${bytes} in English`);
    assert.equal(formatBytes(bytes, 'zh'), expected, `${bytes} in Chinese`);
  }
});

test('invalid byte values display an unavailable mark instead of NaN or fake zero', () => {
  for (const value of [undefined, null, NaN, Infinity, -Infinity, '1024', '', false, {}, []]) {
    assert.equal(formatBytes(value, 'en'), '—');
    assert.equal(formatBytes(value, 'zh'), '—');
  }
});

test('every nonavailable status has the correct English and Chinese display text', () => {
  for (const status of Object.keys(STATUS).filter(value => value !== 'available')) {
    // Even a malformed stale value must not be inspected when the status says
    // the check is blocked, missing, pending, or failed.
    const record = {
      status, format: 'battery',
      get value() { assert.fail(`The value of a ${status} fact must not be read`); }
    };
    assert.equal(formatValue(record), STATUS[status].en, status);
    assert.equal(formatValue(record, 'en'), STATUS[status].en, status);
    assert.equal(formatValue(record, 'zh'), STATUS[status].zh, status);
  }
  assert.equal(formatValue({ status: 'future-status', value: 'private stale value' }), '—');
  assert.equal(formatValue({ status: 'future-status' }, 'zh'), '—');
});

test('plain values preserve zero and localize boolean values', () => {
  for (const [value, en, zh] of [
    [0, '0', '0'], [1.25, '1.25', '1.25'],
    [false, 'No', '否'], [true, 'Yes', '是'],
    ['Browser/1.0', 'Browser/1.0', 'Browser/1.0'],
    ['Asia/Shanghai', 'Asia/Shanghai', 'Asia/Shanghai']
  ]) {
    assert.equal(formatValue(available(value)), en);
    assert.equal(formatValue(available(value), 'zh'), zh);
  }
});

test('API presence is localized independently from permission and general boolean wording', () => {
  assert.equal(formatValue(available(true, 'support')), 'Present');
  assert.equal(formatValue(available(false, 'support')), 'Absent');
  assert.equal(formatValue(available(true, 'support'), 'zh'), '存在');
  assert.equal(formatValue(available(false, 'support'), 'zh'), '不存在');
});

test('permission values localize all states without confusing denied with an API read failure', () => {
  for (const [state, en, zh] of [
    ['granted', 'Granted', '已允许'], ['denied', 'Denied', '已拒绝'], ['prompt', 'Prompt', '需询问']
  ]) {
    assert.equal(formatValue(available(state, 'permission')), en);
    assert.equal(formatValue(available(state, 'permission'), 'zh'), zh);
  }
  assert.equal(formatValue(available('future-permission-state', 'permission')), 'future-permission-state');
  assert.equal(formatValue(available('future-permission-state', 'permission'), 'zh'), 'future-permission-state');
});

test('storage wording identifies approximate usage and origin quota in both languages', () => {
  const record = available({ usageBytes: 0, quotaBytes: 2 * 1024 ** 3 }, 'storage');
  assert.equal(formatValue(record), 'About 0 B used / 2 GiB quota');
  assert.equal(formatValue(record, 'zh'), '使用约 0 B / 配额约 2 GiB');
  assert.equal(formatValue(available({ usageBytes: 1536, quotaBytes: NaN }, 'storage')), 'About 1.5 KiB used / — quota');
});

test('battery formatting preserves zero charge and translates both charging states', () => {
  assert.equal(formatValue(available({ levelPercent: 0, charging: false }, 'battery')), '0% · Not charging');
  assert.equal(formatValue(available({ levelPercent: 0, charging: false }, 'battery'), 'zh'), '0% · 未充电');
  assert.equal(formatValue(available({ levelPercent: 100, charging: true }, 'battery')), '100% · Charging');
  assert.equal(formatValue(available({ levelPercent: 100, charging: true }, 'battery'), 'zh'), '100% · 正在充电');
});

test('graphics formatting presents reported names without exposing debug-extension machinery', () => {
  const value = { vendor: 'Vendor', renderer: 'Renderer', unmaskedExtension: true };
  assert.equal(formatValue(available(value, 'graphics')), 'Vendor · Renderer');
  assert.equal(formatValue(available(value, 'graphics'), 'zh'), 'Vendor · Renderer');
  value.unmaskedExtension = false;
  assert.equal(formatValue(available(value, 'graphics')), 'Vendor · Renderer');
  assert.equal(formatValue(available(value, 'graphics'), 'zh'), 'Vendor · Renderer');
});

test('array observations show all matches and distinguish an empty observation from unsupported', () => {
  for (const format of [undefined, 'queries', 'fonts']) {
    assert.equal(formatValue(available([], format)), 'No match');
    assert.equal(formatValue(available([], format), 'zh'), '未匹配');
    assert.equal(formatValue(available(['first', 'second'], format)), 'first · second');
    assert.equal(formatValue(available(['first', 'second'], format), 'zh'), 'first · second');
    assert.equal(formatValue({ status: 'unsupported', value: [], format }), STATUS.unsupported.en);
  }
});

test('every format used by a fact has a nonempty display string in both supported languages', () => {
  const examples = {
    text: 'example', queries: ['(pointer: fine)'], fonts: ['Arial'],
    support: false, permission: 'denied',
    storage: { usageBytes: 0, quotaBytes: 1024 },
    battery: { levelPercent: 0, charging: false },
    graphics: { vendor: 'Vendor', renderer: 'Renderer', unmaskedExtension: false }
  };
  for (const definition of [...checks, ...permissionChecks, ...detailChecks]) {
    const format = definition.format ?? 'text';
    assert.ok(Object.hasOwn(examples, format), `${definition.id}: add a formatter test for ${format}`);
    for (const language of ['en', 'zh']) {
      const text = formatValue(available(examples[format], definition.format), language);
      assert.equal(typeof text, 'string', `${definition.id} in ${language}`);
      assert.ok(text.trim(), `${definition.id} in ${language}`);
      assert.doesNotMatch(text, /\[object Object\]|undefined|NaN/);
    }
  }
});

test('formatting is a pure string transformation and does not mutate recorded values', () => {
  const values = Object.freeze(['Arial', 'Menlo']);
  const record = Object.freeze(available(values, 'fonts'));
  assert.equal(formatValue(record), 'Arial · Menlo');
  assert.deepEqual(values, ['Arial', 'Menlo']);
  const hostileText = '<img src="https://example.invalid/" onerror="alert(1)">';
  assert.equal(formatValue(available(hostileText)), hostileText, 'The UI must render this returned string using textContent');
});
