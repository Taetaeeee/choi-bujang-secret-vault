// XDR-06 제작 4: 명확한 자료 반출의 좁은 범위 거부 후보와 안전한 알림 기록.
// 이 파일만 파일 I/O를 수행하며 decide.mjs와 src/decider.mjs는 변경하지 않습니다.
// ZTNA 요청 계약에는 외부 목적지 IP가 없으므로 실제 정책 설치가 아닌 staged_only 모의 연결입니다.
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from './decide.mjs';

const MODULE_KEY = 'exfiltration';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ALERT_ID = /^ex-[0-9]{2,4}$/u;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const PATTERN_NAMES = new Set([
  '처음 보는 목적지로 대량 자료 반출',
  '업무 시간 밖 압축 파일 외부 반출',
  '명령 통로를 통한 대량·반복 전송',
]);
const BLOCK_MIN = 0.85;
const LARGE_BYTES = 50_000_000;
export const RULE_TTL_MS = 15 * 60 * 1000;

function validIpv4(value) {
  return typeof value === 'string' && value === value.trim() && isIP(value) === 4;
}

function timestampMs(value) {
  if (typeof value !== 'string' || !ISO_TIME.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function safeBytes(value) {
  if (typeof value === 'string' && /^\d{1,15}$/u.test(value)) {
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : null;
  }
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function candidate(alert, decision) {
  return typeof alert?.id === 'string' && ALERT_ID.test(alert.id)
    && timestampMs(alert?.timestamp) !== null
    && validIpv4(alert?.data?.srcip)
    && validIpv4(alert?.data?.dstip)
    && alert.data.srcip !== alert.data.dstip
    && Number.isInteger(alert?.rule?.level)
    && alert.rule.level >= 10 && alert.rule.level <= 16
    && Array.isArray(alert.rule?.mitre)
    && alert.rule.mitre.some(id => id === 'T1041' || id === 'T1048')
    && safeBytes(alert?.data?.bytes) >= LARGE_BYTES
    && decision?.action === 'block'
    && Number.isFinite(decision.confidence)
    && decision.confidence >= BLOCK_MIN && decision.confidence <= 1
    && PATTERN_NAMES.has(decision.reason);
}

// 판단값을 외부에서 주더라도 decide(alert)를 다시 실행해 위조/불일치는 거부 후보에서 제외합니다.
// 정상·조사 중인 사건과 출발지+목적지가 동일하면 IP 재사용/공유 가능성 때문에 보류합니다.
export function buildDenyRules(alerts, decisions) {
  if (!Array.isArray(alerts)) throw new TypeError('INVALID_ALERTS');
  if (decisions !== undefined &&
      (!Array.isArray(decisions) || decisions.length !== alerts.length)) {
    throw new TypeError('INVALID_DECISIONS');
  }

  const entries = alerts.map((alert, index) => {
    const decision = decide(alert);
    const given = decisions?.[index];
    const consistent = given === undefined || (
      given?.action === decision.action &&
      given.confidence === decision.confidence &&
      given.reason === decision.reason
    );
    return {
      alert,
      decision,
      time: timestampMs(alert?.timestamp),
      sourceIp: validIpv4(alert?.data?.srcip) ? alert.data.srcip : null,
      destinationIp: validIpv4(alert?.data?.dstip) ? alert.data.dstip : null,
      eligible: consistent && candidate(alert, decision),
    };
  });

  const idCounts = new Map();
  for (const entry of entries) {
    const id = entry.alert?.id;
    if (typeof id === 'string') idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }

  const rules = [];
  for (const entry of entries) {
    const id = entry.alert?.id;
    if (!entry.eligible || idCounts.get(id) !== 1) continue;
    // 같은 통신 흐름에 정상/불확실 경보가 있으면 자동 거부하지 않습니다.
    // 시간정보가 없는 경보도 안전하게 충돌로 취급합니다.
    const conflicting = entries.some(other => other !== entry
      && other.sourceIp === entry.sourceIp
      && other.destinationIp === entry.destinationIp
      && (!other.eligible || idCounts.get(other.alert?.id) !== 1)
      && (other.time === null || Math.abs(other.time - entry.time) <= RULE_TTL_MS));
    if (conflicting) continue;

    rules.push({
      ruleId: `xdr.exfiltration.${id}`,
      action: 'deny',
      scope: 'verified_network_flow',
      sourceIp: entry.sourceIp,
      destinationIp: entry.destinationIp,
      activeFrom: new Date(entry.time).toISOString(),
      expiresAt: new Date(entry.time + RULE_TTL_MS).toISOString(),
      evidenceAlertIds: [id],
      patternNames: [entry.decision.reason],
    });
  }
  return rules;
}

// 이 함수는 검증된 네트워크 관측값을 받는 *엔진 측* 어댑터용 모의 판정입니다.
// 브라우저 헤더/요청 파라미터에서 출발·목적지 IP를 얻어 전달하면 안 됩니다.
// 현재 ZTNA의 18개 요청 필드에는 destinationIp가 없어 운영 판정기에 자동 적용되지 않습니다.
// continue는 ZTNA 기존 정책을 그대로 계속 평가한다는 뜻이지 '허용'이 아닙니다.
export function checkVerifiedFlow({ sourceIp, destinationIp, at } = {}, rules = []) {
  if (!validIpv4(sourceIp) || !validIpv4(destinationIp)
      || timestampMs(at) === null || !Array.isArray(rules)) {
    return { outcome: 'continue', matchedRuleId: null };
  }
  const now = timestampMs(at);
  const matched = rules.find(rule => {
    const start = timestampMs(rule?.activeFrom);
    const end = timestampMs(rule?.expiresAt);
    const id = rule?.evidenceAlertIds?.[0];
    return rule?.action === 'deny' && rule.scope === 'verified_network_flow'
      && typeof id === 'string' && ALERT_ID.test(id)
      && rule.ruleId === `xdr.exfiltration.${id}`
      && Array.isArray(rule.evidenceAlertIds) && rule.evidenceAlertIds.length === 1
      && Array.isArray(rule.patternNames) && rule.patternNames.length === 1
      && PATTERN_NAMES.has(rule.patternNames[0])
      && rule.sourceIp === sourceIp && rule.destinationIp === destinationIp
      && start !== null && end !== null && start <= now && now < end
      && end - start === RULE_TTL_MS;
  });
  return matched ? {
    outcome: 'deny',
    matchedRuleId: matched.ruleId,
    expiresAt: matched.expiresAt,
    evidenceAlertIds: [...matched.evidenceAlertIds],
  } : { outcome: 'continue', matchedRuleId: null };
}

export async function respond({ root = ROOT, now = new Date() } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new TypeError('INVALID_NOW');
  }
  const fixture = JSON.parse(await readFile(
    join(root, 'xdr', 'fixtures', `${MODULE_KEY}.json`), 'utf8'
  ));
  if (fixture?.schema !== 'aleph.xdr.fixture.v1'
      || fixture.moduleKey !== MODULE_KEY
      || !Array.isArray(fixture.alerts)) {
    throw new Error('INVALID_EXFILTRATION_FIXTURE');
  }
  const decisions = fixture.alerts.map(decide);
  const rules = buildDenyRules(fixture.alerts, decisions);
  const stagedIds = new Set(rules.flatMap(rule => rule.evidenceAlertIds));
  const stamp = now.toISOString();

  // 비밀값과 경보 원문은 기록하지 않습니다. 검증된 경보 ID + 분류 + 응답만 로깅.
  const lines = decisions.flatMap((decision, index) => {
    if (decision.action === 'record') return [];
    const id = fixture.alerts[index]?.id;
    if (typeof id !== 'string' || !ALERT_ID.test(id)) return [];
    return [JSON.stringify({
      loggedAt: stamp,
      moduleKey: MODULE_KEY,
      alertId: id,
      classification: decision.action,
      response: decision.action === 'block'
        ? (stagedIds.has(id) ? 'rule_staged' : 'held_for_safety')
        : 'alert_only',
      confidence: decision.confidence,
    })];
  });

  const rulePath = join(root, 'xdr', MODULE_KEY, 'deny-rules.json');
  await mkdir(dirname(rulePath), { recursive: true });
  await writeFile(rulePath, `${JSON.stringify({
    schema: 'aleph.xdr.deny-rules.v1',
    moduleKey: MODULE_KEY,
    mode: 'staged_only',
    note: '운영 ZTNA는 목적지 IP를 받지 않음. 신뢰된 네트워크 관측/정책 연결이 필요.',
    generatedAt: stamp,
    ttlSeconds: RULE_TTL_MS / 1000,
    rules,
  }, null, 2)}\n`, 'utf8');

  if (lines.length) {
    await appendFile(join(root, 'xdr', 'alerts.log'), `${lines.join('\n')}\n`, 'utf8');
  }
  return {
    totalAlerts: fixture.alerts.length,
    classifications: {
      block: decisions.filter(item => item.action === 'block').length,
      alert: decisions.filter(item => item.action === 'alert').length,
      record: decisions.filter(item => item.action === 'record').length,
    },
    stagedDenyRules: rules.length,
    heldBlockAlerts: decisions.filter((item, i) =>
      item.action === 'block' && !stagedIds.has(fixture.alerts[i]?.id)).length,
    appendedLogLines: lines.length,
    operation: 'staged_only',
  };
}

const isMain = Boolean(process.argv[1]) &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    console.log(JSON.stringify(await respond()));
  } catch {
    // 오류에 개인정보나 비밀값이 들어가 출력되지 않도록 고정 메시지만 표시합니다.
    console.error('XDR-06 대응 처리 실패: 경보 형식 또는 파일 쓰기 권한을 확인하세요.');
    process.exitCode = 1;
  }
}
