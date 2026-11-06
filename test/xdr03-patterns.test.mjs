import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const patternUrl = new URL('../xdr/known-cve/patterns.json', import.meta.url);
const fixtureUrl = new URL('../xdr/fixtures/known-cve.json', import.meta.url);

async function load() {
  return JSON.parse(await readFile(patternUrl, 'utf8'));
}

test('CVE-2021-44228 및 T1190을 근거로 세 패턴만 기록한다', async () => {
  const data = await load();
  assert.equal(data.cve, 'CVE-2021-44228');
  assert.equal(data.technique, 'T1190');
  assert.equal(data.reference, 'https://attack.mitre.org/techniques/T1190/');
  assert.deepEqual(data.patterns.map(({ id }) => id), [
    'jndi-header-lookup', 'jndi-parameter-lookup', 'vulnerability-scan-trace',
  ]);
  assert.equal(new Set(data.patterns.map(({ id }) => id)).size, 3);
});

test('각 패턴의 이름·조건·근거가 있고 근거는 반드시 한 줄이다', async () => {
  const { patterns } = await load();
  for (const pattern of patterns) {
    for (const field of ['id', 'name', 'condition', 'evidence', 'reference']) {
      assert.equal(typeof pattern[field], 'string', `${pattern.id}: ${field}`);
      assert.ok(pattern[field].trim(), `${pattern.id}: ${field} empty`);
    }
    assert.doesNotMatch(pattern.evidence, /[\r\n\u2028\u2029]/u, `${pattern.id}: multi-line evidence`);
    assert.ok(pattern.evidence.length <= 240, `${pattern.id}: evidence too long`);
    assert.match(pattern.evidence, /(?:CVE-2021-44228|T1190)/u);
    assert.ok([
      'https://nvd.nist.gov/vuln/detail/CVE-2021-44228',
      'https://attack.mitre.org/techniques/T1190/',
    ].includes(pattern.reference), `${pattern.id}: source is not one of the declared official references`);
  }
});

test('경보의 실제 필드와 패턴 조건을 맞추고 점검 흔적만으로 차단하지 않는다', async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'));
  assert.equal(fixture.moduleKey, 'known-cve');
  assert.equal(fixture.alerts.length, 24);
  assert.ok(fixture.alerts.some(alert => typeof alert.data?.useragent === 'string'));
  assert.ok(fixture.alerts.some(alert => typeof alert.data?.url === 'string'));
  assert.ok(fixture.alerts.some(alert => /점검/u.test(alert.rule?.description ?? '')));
  const { patterns } = await load();
  assert.match(patterns[0].condition, /data\.useragent/u);
  assert.match(patterns[1].condition, /data\.url/u);
  assert.match(patterns[2].condition, /자동 차단하지 않는다/u);
});
