// BYTE BACK XDR brute-force 대응 어댑터.
// 판단(decide.mjs)과 분리: 알림 로그와 임시 IP 거부 규칙을 만든다.
// 주의: 운영 SDP 요청 계약에는 검증된 출발지 IP가 없어 실제 ZTNA 엔진에 자동 연결되지 않는다.
// 아래 규칙은 별도 신뢰 경계에서 검증한 IP를 받을 때 사용할 준비(staged) 자료이다.
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from './decide.mjs';

export const RULE_TTL_MS = 15 * 60 * 1000;
const MODULE_KEY = 'brute-force';
const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/u;

function eventTime(alert) {
  const value = Date.parse(alert?.timestamp);
  return Number.isFinite(value) ? value : null;
}

function validBlockCandidate(alert, decision) {
  return Boolean(alert)
    && typeof alert === 'object'
    && SAFE_ID.test(alert.id ?? '')
    && isIP(alert.data?.srcip ?? '') !== 0
    && typeof alert.data?.srcuser === 'string'
    && alert.data.srcuser.length > 0
    && eventTime(alert) !== null
    && Array.isArray(alert.rule?.mitre)
    && alert.rule.mitre.some(code => typeof code === 'string' && /^T1110(?:\.|$)/u.test(code))
    && Number.isInteger(alert.rule?.level)
    && alert.rule.level >= 10
    && decision?.action === 'block'
    && typeof decision.confidence === 'number'
    && Number.isFinite(decision.confidence)
    && decision.confidence >= 0.85
    && decision.confidence <= 1;
}

// 차단 후보를 안전한 임시 규칙으로 변환한다. 정상/애매한 경보가 같은 IP에서
// 같은 시간 구간에 관측되면 공유 IP의 정상 사용자 보호를 위해 자동 IP 차단을 보류한다.
// 이 보호는 '완전한 오탐 방지'가 아니라 보수적 학습용 가드다.
export function buildDenyRules(alerts, decisions = alerts.map(decide)) {
  if (!Array.isArray(alerts) || !Array.isArray(decisions) || alerts.length !== decisions.length) {
    throw new TypeError('경보와 판정 결과의 개수가 일치해야 합니다.');
  }

  const entries = alerts.map((alert, index) => ({ alert, decision: decisions[index], at: eventTime(alert) }));
  const eligible = entries.filter(({ alert, decision, at }) => at !== null && validBlockCandidate(alert, decision));

  const safe = eligible.filter(({ alert, at }) => !entries.some(other => (
    other.alert !== alert
    && other.decision?.action !== 'block'
    && other.at !== null
    && other.alert?.data?.srcip === alert.data.srcip
    && Math.abs(other.at - at) <= RULE_TTL_MS
  )));

  const grouped = new Map();
  for (const { alert, at } of safe) {
    const ip = alert.data.srcip;
    let group = grouped.get(ip);
    if (!group) {
      group = { sourceIp: ip, firstAt: at, lastAt: at, evidenceAlertIds: [], patternNames: new Set() };
      grouped.set(ip, group);
    }
    group.firstAt = Math.min(group.firstAt, at);
    group.lastAt = Math.max(group.lastAt, at);
    group.evidenceAlertIds.push(alert.id);
    const judgement = entries.find(item => item.alert === alert)?.decision;
    if (typeof judgement?.reason === 'string') group.patternNames.add(judgement.reason);
  }

  return [...grouped.values()].map((group) => ({
    ruleId: `xdr.brute-force.${group.evidenceAlertIds[0]}`,
    action: 'deny',
    sourceIp: group.sourceIp,
    activeFrom: new Date(group.firstAt).toISOString(),
    expiresAt: new Date(group.lastAt + RULE_TTL_MS).toISOString(),
    evidenceAlertIds: group.evidenceAlertIds,
    patternNames: [...group.patternNames],
  }));
}

// 기존 ZTNA 규칙을 수정하거나 'allow'를 반환하지 않는다.
// verifiedSourceIp는 반드시 신뢰하는 게이트웨이/운영 엔진이 확인한 값이어야 한다.
// 일치하지 않으면 'continue'로 기존 판정기에 결정을 맡긴다.
export function checkTrustedSourceIp({ verifiedSourceIp, at }, rules) {
  if (isIP(verifiedSourceIp ?? '') === 0 || !Array.isArray(rules)) {
    return { outcome: 'continue', matchedRuleId: null };
  }
  const now = Date.parse(at);
  if (!Number.isFinite(now)) return { outcome: 'continue', matchedRuleId: null };

  const match = rules.find(rule => (
    rule?.action === 'deny'
    && rule.sourceIp === verifiedSourceIp
    && Date.parse(rule.activeFrom) <= now
    && now < Date.parse(rule.expiresAt)
  ));
  return match
    ? { outcome: 'deny', matchedRuleId: match.ruleId, expiresAt: match.expiresAt,
        evidenceAlertIds: match.evidenceAlertIds }
    : { outcome: 'continue', matchedRuleId: null };
}

// 파일 쓰기는 여기에서만 수행한다. 로그에는 경보 원문/IP/계정/비밀값을 기록하지 않는다.
export async function respond({ root = DEFAULT_ROOT, now = new Date() } = {}) {
  const fixturePath = join(root, 'xdr', 'fixtures', `${MODULE_KEY}.json`);
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  if (fixture?.schema !== 'aleph.xdr.fixture.v1'
      || fixture.moduleKey !== MODULE_KEY || !Array.isArray(fixture.alerts)) {
    throw new Error('경보 묶음 형식이 아닙니다.');
  }

  const results = fixture.alerts.map(alert => decide(alert));
  const rules = buildDenyRules(fixture.alerts, results);
  const stamp = now instanceof Date && Number.isFinite(now.getTime())
    ? now.toISOString() : new Date().toISOString();

  const logLines = results.flatMap((result, index) => {
    if (result.action === 'record') return [];
    const alertId = fixture.alerts[index]?.id;
    if (!SAFE_ID.test(alertId ?? '')) return [];
    const staged = rules.some(rule => rule.evidenceAlertIds.includes(alertId));
    return [JSON.stringify({
      loggedAt: stamp,
      moduleKey: MODULE_KEY,
      alertId,
      classification: result.action,
      response: result.action === 'block' ? (staged ? 'rule_staged' : 'alert_only') : 'alert_only',
      confidence: result.confidence,
    })];
  });

  const rulePath = join(root, 'xdr', MODULE_KEY, 'deny-rules.json');
  const logPath = join(root, 'xdr', 'alerts.log');
  await mkdir(dirname(rulePath), { recursive: true });
  // 이 파일은 독립적인 연동 준비 자료이며 실제 ZTNA 운영 정책 파일이 아니다.
  const snapshot = {
    schema: 'aleph.xdr.deny-rules.v1',
    mode: 'staged_only',
    generatedAt: stamp,
    ttlSeconds: RULE_TTL_MS / 1000,
    rules,
  };
  await writeFile(rulePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  if (logLines.length > 0) await appendFile(logPath, `${logLines.join('\n')}\n`, 'utf8');

  return {
    totalAlerts: fixture.alerts.length,
    classifications: {
      block: results.filter(r => r.action === 'block').length,
      alert: results.filter(r => r.action === 'alert').length,
      record: results.filter(r => r.action === 'record').length,
    },
    stagedDenyRules: rules.length,
    appendedLogLines: logLines.length,
    rulePath,
    logPath,
  };
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    const summary = await respond();
    console.log(JSON.stringify({
      totalAlerts: summary.totalAlerts,
      classifications: summary.classifications,
      stagedDenyRules: summary.stagedDenyRules,
      appendedLogLines: summary.appendedLogLines,
      operation: 'staged_only',
    }));
  } catch {
    // 실패 시 입력 경보나 파일 내용 등 민감 데이터는 출력하지 않는다.
    console.error('XDR 대응 처리에 실패했습니다. 입력 파일과 권한을 확인하세요.');
    process.exitCode = 1;
  }
}
