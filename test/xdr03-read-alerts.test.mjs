import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractAlert, readAlerts } from '../xdr/known-cve/read-alerts.mjs';

const fixtureUrl = new URL('../xdr/fixtures/known-cve.json', import.meta.url);
const modulePath = fileURLToPath(new URL('../xdr/known-cve/read-alerts.mjs', import.meta.url));
const FIELDS = ['timestamp', 'sourceIp', 'account', 'ruleLevel', 'description'];

test('원본 경보 건수와 정규화한 줄 수는 같다 (원본 보존)', async () => {
  const before = await readFile(fixtureUrl);
  const parsed = JSON.parse(before.toString('utf8'));
  const rows = await readAlerts();
  const after = await readFile(fixtureUrl);
  assert.equal(parsed.schema, 'aleph.xdr.fixture.v1');
  assert.equal(parsed.moduleKey, 'known-cve');
  assert.equal(rows.length, parsed.alerts.length);
  assert.equal(rows.length, 24);
  assert.deepEqual(createHash('sha256').update(before).digest('hex'),
    createHash('sha256').update(after).digest('hex'));
  for (const row of rows) assert.deepEqual(Object.keys(row), FIELDS);
  assert.equal(rows[0].account, null);
  assert.equal(rows[16].account, 'user01');
});

test('실행 시 경보마다 JSON 한 줄만 출력한다', () => {
  const out = spawnSync(process.execPath, [modulePath], { encoding: 'utf8', timeout: 5000 });
  assert.equal(out.status, 0, out.stderr);
  assert.equal(out.stderr, '');
  const lines = out.stdout.trim().split(/\r?\n/u);
  assert.equal(lines.length, 24);
  for (const line of lines) assert.deepEqual(Object.keys(JSON.parse(line)), FIELDS);
});

test('설명 속 비밀값 유사 문자열은 가리고 나머지 필드만 남긴다', () => {
  const alert = {
    timestamp: '2026-09-27T09:14:02+09:00',
    data: { srcip: '203.0.113.10', srcuser: 'user01',
      url: '/do-not-output', useragent: 'do-not-output' },
    rule: { level: 12, description: '검사\npassword=example-credential Bearer example-opaque-value api_key=sample-value' },
  };
  const row = extractAlert(alert);
  const serialized = JSON.stringify(row);
  assert.deepEqual(Object.keys(row), FIELDS);
  for (const token of ['example-credential', 'example-opaque-value', 'sample-value',
    '/do-not-output', 'do-not-output', '\\n']) {
    assert.equal(serialized.includes(token), false, `노출 의심: ${token}`);
  }
  assert.ok(row.description.includes('[가림]'));
});

test('정보 누락과 잘못된 필드는 출력에서 null로 처리하고 예외를 던지지 않는다', () => {
  const row = extractAlert({ timestamp: 'invalid', rule: { level: 99 }, data: { srcip: 'invalid' } });
  assert.deepEqual(row, {
    timestamp: null, sourceIp: null, account: null, ruleLevel: null, description: null,
  });
  assert.deepEqual(Object.keys(extractAlert(null)), FIELDS);
});
