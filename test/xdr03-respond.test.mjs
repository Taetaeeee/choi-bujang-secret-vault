import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decide } from '../xdr/known-cve/decide.mjs';
import { buildDenyRules, checkTrustedSourceIp, respond, RULE_TTL_MS } from '../xdr/known-cve/respond.mjs';

const fixturePath = new URL('../xdr/fixtures/known-cve.json', import.meta.url);
async function fixture() { return JSON.parse(await readFile(fixturePath, 'utf8')); }

// 1) 공식 24개 경보를 재사용하되 원본은 변경하지 않습니다.
test('명확한 block 경보만 임시 IP 거부 후보로 등록하고 정상·경고 IP는 제외한다', async () => {
  const { alerts } = await fixture();
  const baseline = JSON.stringify(alerts);
  const results = alerts.map(decide);
  assert.deepEqual(results.reduce((counts, result) => ({
    ...counts, [result.action]: counts[result.action] + 1,
  }), { block: 0, alert: 0, record: 0 }), { block: 8, alert: 8, record: 8 });
  const rules = buildDenyRules(alerts, results);
  assert.equal(rules.length, 7, 'kc-01과 kc-02는 같은 IP의 하나의 임시 규칙으로 합칩니다.');
  const blocked = new Set(alerts.slice(0, 8).map(alert => alert.data.srcip));
  const nonBlocks = new Set(alerts.slice(8).map(alert => alert.data.srcip));
  for (const rule of rules) {
    assert.equal(rule.action, 'deny');
    assert.ok(blocked.has(rule.sourceIp));
    assert.equal(nonBlocks.has(rule.sourceIp), false);
    assert.ok(rule.evidenceAlertIds.length >= 1);
    assert.match(rule.ruleId, /^xdr\.known-cve\./u);
    assert.ok(Date.parse(rule.expiresAt) > Date.parse(rule.activeFrom));
  }
  const sameIpRule = rules.find(rule => rule.sourceIp === alerts[0].data.srcip);
  assert.deepEqual(sameIpRule.evidenceAlertIds, ['kc-01', 'kc-02']);
  assert.equal(Date.parse(sameIpRule.expiresAt), Date.parse(alerts[1].timestamp) + RULE_TTL_MS);
  assert.equal(JSON.stringify(alerts), baseline, '경보 원본 변경 금지');
});

test('명확한 악용은 deny, 정상은 continue, 시작 전·만료 후는 continue', async () => {
  const { alerts } = await fixture();
  const rules = buildDenyRules(alerts);
  const attack = alerts[0];
  const normal = alerts[16];
  const attackAt = new Date(Date.parse(attack.timestamp) + 60_000).toISOString();
  const rule = rules.find(item => item.sourceIp === attack.data.srcip);
  const hit = checkTrustedSourceIp({ verifiedSourceIp: attack.data.srcip, at: attackAt }, rules);
  assert.equal(hit.outcome, 'deny');
  assert.ok(hit.evidenceAlertIds.includes(attack.id));
  assert.equal(checkTrustedSourceIp({ verifiedSourceIp: normal.data.srcip, at: attackAt }, rules).outcome, 'continue');
  assert.equal(checkTrustedSourceIp({ verifiedSourceIp: attack.data.srcip, at: rule.expiresAt }, rules).outcome, 'continue');
  assert.equal(checkTrustedSourceIp({ verifiedSourceIp: attack.data.srcip, at: new Date(Date.parse(attack.timestamp) - 1000).toISOString() }, rules).outcome, 'continue');
  assert.equal(checkTrustedSourceIp({ verifiedSourceIp: attack.data.srcip }, rules).outcome, 'continue');
  assert.equal(checkTrustedSourceIp({ at: attackAt }, rules).outcome, 'continue');
  assert.equal(checkTrustedSourceIp({ verifiedSourceIp: 'invalid', at: attackAt }, rules).outcome, 'continue');
});

test('정상/경고 사건과 IP가 겹치면 공유 주소의 자동 거부를 보류한다', async () => {
  const { alerts } = await fixture();
  const copy = structuredClone(alerts);
  const normal = structuredClone(copy[16]);
  normal.id = 'kc-normal-same-ip';
  normal.data.srcip = copy[0].data.srcip;
  normal.timestamp = copy[0].timestamp;
  copy.push(normal);
  const rules = buildDenyRules(copy);
  assert.ok(rules.length < 7);
  assert.equal(rules.some(rule => rule.sourceIp === copy[0].data.srcip), false);
  // 경고/정상 결과를 공격이라고 속인 외부 판단은 규칙으로 받아들이지 않습니다.
  const fake = [{ ...decide(copy[16]), action: 'block', confidence: 0.99 }];
  assert.deepEqual(buildDenyRules([copy[16]], fake), []);
  assert.throws(() => buildDenyRules(copy, []), /개수가 일치/u);
});

test('응답은 임시 규칙 JSON과 개인정보 없는 알림 JSONL만 쓰고 원본 경보를 보존한다', async () => {
  const root = await mkdtemp(join(tmpdir(), 'xdr03-response-'));
  try {
    const fixtureText = await readFile(fixturePath, 'utf8');
    await mkdir(join(root, 'xdr', 'fixtures'), { recursive: true });
    await writeFile(join(root, 'xdr', 'fixtures', 'known-cve.json'), fixtureText);
    const initialLog = JSON.stringify({ preexisting: true }) + '\n';
    await writeFile(join(root, 'xdr', 'alerts.log'), initialLog);
    const summary = await respond({ root, now: new Date('2026-11-06T07:00:00Z') });
    assert.deepEqual(summary, {
      totalAlerts: 24, classifications: { block: 8, alert: 8, record: 8 },
      stagedDenyRules: 7, appendedLogLines: 16, operation: 'staged_only',
    });
    const rulesOutput = JSON.parse(await readFile(join(root, 'xdr', 'known-cve', 'deny-rules.json'), 'utf8'));
    assert.equal(rulesOutput.schema, 'aleph.xdr.deny-rules.v1');
    assert.equal(rulesOutput.mode, 'staged_only');
    assert.equal(rulesOutput.rules.length, 7);
    const logText = await readFile(join(root, 'xdr', 'alerts.log'), 'utf8');
    assert.ok(logText.startsWith(initialLog));
    const lines = logText.trimEnd().split('\n');
    assert.equal(lines.length, 17);
    const logged = lines.slice(1).map(JSON.parse);
    assert.equal(logged.filter(item => item.classification === 'block').length, 8);
    assert.equal(logged.filter(item => item.classification === 'alert').length, 8);
    assert.ok(logged.every(item => item.moduleKey === 'known-cve' && /^kc-\d{2}$/u.test(item.alertId)));
    assert.ok(logged.every(item => !('sourceIp' in item) && !('url' in item) && !('account' in item) && !('token' in item)));
    const { alerts } = await fixture();
    for (const item of alerts) {
      assert.ok(!logText.includes(item.data.srcip));
      if (item.data.url) assert.ok(!logText.includes(item.data.url));
      if (item.data.useragent) assert.ok(!logText.includes(item.data.useragent));
    }
    assert.equal(await readFile(join(root, 'xdr', 'fixtures', 'known-cve.json'), 'utf8'), fixtureText);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('알림 파일은 덮어쓰지 않고 재실행할 때 한 줄씩 누적한다', async () => {
  const root = await mkdtemp(join(tmpdir(), 'xdr03-append-'));
  try {
    await mkdir(join(root, 'xdr', 'fixtures'), { recursive: true });
    await writeFile(join(root, 'xdr', 'fixtures', 'known-cve.json'), await readFile(fixturePath));
    await respond({ root, now: new Date('2026-11-06T07:00:00Z') });
    await respond({ root, now: new Date('2026-11-06T07:01:00Z') });
    const lines = (await readFile(join(root, 'xdr', 'alerts.log'), 'utf8')).trimEnd().split('\n');
    assert.equal(lines.length, 32);
    assert.equal(lines.filter(line => JSON.parse(line).response === 'rule_staged').length, 16);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
