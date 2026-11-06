// XDR-03 제작 4 — CVE-2021-44228 교육용 경보 대응 연결.
// decide.mjs는 판정만 담당합니다. 읽기/로그/임시 거부 규칙 쓰기는 이 파일만 수행합니다.
// 현재 ZTNA 요청 계약에는 신뢰된 출발 IP가 없으므로 운영 엔진에 자동 반영하지 않습니다.
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from './decide.mjs';

const MODULE_KEY = 'known-cve';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SAFE_ALERT_ID = /^[A-Za-z0-9_-]{1,64}$/u;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const BLOCK_PATTERN_NAMES = new Set([
  '요청 머리글에 포함된 원격 JNDI 조회 시도',
  'URL 인자에 포함된 원격 JNDI 조회 시도',
]);
export const RULE_TTL_MS = 15 * 60 * 1000; // 학습용 임시 규칙: 15분

function eventTime(alert) {
  const value = alert?.timestamp;
  if (typeof value !== 'string' || !ISO_TIME.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function isBlockCandidate(alert, judgment) {
  return alert && typeof alert === 'object' && !Array.isArray(alert)
    && SAFE_ALERT_ID.test(alert.id ?? '')
    && eventTime(alert) !== null
    && isIP(alert.data?.srcip ?? '') !== 0
    && Number.isInteger(alert.rule?.level) && alert.rule.level >= 10 && alert.rule.level <= 16
    && Array.isArray(alert.rule?.mitre)
    && alert.rule.mitre.some(tag => typeof tag === 'string' && /^T1190(?:\.|$)/u.test(tag))
    && judgment?.action === 'block'
    && typeof judgment.confidence === 'number'
    && Number.isFinite(judgment.confidence)
    && judgment.confidence >= 0.85 && judgment.confidence <= 1
    && BLOCK_PATTERN_NAMES.has(judgment.reason);
}

// 원본에 없던 임의의 'block' 판정 주입도 거부: 실제 decide(alert) 결과와 일치해야 합니다.
function matchingDecision(alert, judgment) {
  const verified = decide(alert);
  return verified.action === judgment?.action
    && verified.confidence === judgment?.confidence
    && verified.reason === judgment?.reason;
}

// 정상/애매한 경보가 같은 출발 IP의 앞뒤 15분 안에 있으면 자동 IP 거부를 보류합니다.
// 공유 IP의 다른 사용자를 전부 식별하는 것은 아니므로 오차단 위험이 0이 되지는 않습니다.
export function buildDenyRules(alerts, decisions) {
  if (!Array.isArray(alerts)) throw new TypeError('경보 목록이 올바르지 않습니다.');
  const judgments = decisions === undefined ? alerts.map(decide) : decisions;
  if (!Array.isArray(judgments) || judgments.length !== alerts.length) {
    throw new TypeError('경보와 판단 결과 개수가 일치해야 합니다.');
  }

  const entries = alerts.map((alert, index) => ({ alert, judgment: judgments[index], at: eventTime(alert) }));
  const eligible = entries.filter(({ alert, judgment, at }) =>
    at !== null && isBlockCandidate(alert, judgment) && matchingDecision(alert, judgment));
  const candidates = eligible.filter(({ alert, at }) => !entries.some(other =>
    other.alert !== alert
    && other.at !== null
    && other.judgment?.action !== 'block'
    && other.alert?.data?.srcip === alert.data.srcip
    && Math.abs(other.at - at) <= RULE_TTL_MS));

  const byIp = new Map();
  for (const entry of candidates) {
    const ip = entry.alert.data.srcip;
    if (!byIp.has(ip)) byIp.set(ip, []);
    byIp.get(ip).push(entry);
  }

  const rules = [];
  for (const [sourceIp, events] of byIp) {
    events.sort((a, b) => a.at - b.at);
    let group = null;
    const flush = () => {
      if (!group) return;
      rules.push({
        ruleId: `xdr.known-cve.${group.evidenceAlertIds[0]}`,
        action: 'deny',
        sourceIp,
        activeFrom: new Date(group.firstAt).toISOString(),
        expiresAt: new Date(group.lastAt + RULE_TTL_MS).toISOString(),
        evidenceAlertIds: [...group.evidenceAlertIds],
        patternNames: [...group.patternNames],
      });
    };
    for (const entry of events) {
      if (!group || entry.at - group.lastAt > RULE_TTL_MS) {
        flush();
        group = { firstAt: entry.at, lastAt: entry.at, evidenceAlertIds: [], patternNames: new Set() };
      }
      group.lastAt = entry.at;
      if (!group.evidenceAlertIds.includes(entry.alert.id)) {
        group.evidenceAlertIds.push(entry.alert.id);
      }
      group.patternNames.add(entry.judgment.reason);
    }
    flush();
  }
  return rules;
}

// 오직 신뢰된 게이트웨이/엔진에서 검증한 IP로만 조회해야 합니다.
// 이 함수는 실제 SDP 엔진에 등록된 훅이 아니라 격리된 연동 재현용 검사입니다.
// 'continue'는 기존 ZTNA 판정으로 넘긴다는 뜻이지 무조건 'allow'가 아닙니다.
export function checkTrustedSourceIp({ verifiedSourceIp, at } = {}, rules) {
  if (isIP(verifiedSourceIp ?? '') === 0 || !Array.isArray(rules)
      || typeof at !== 'string' || !ISO_TIME.test(at)) {
    return { outcome: 'continue', matchedRuleId: null };
  }
  const atMs = Date.parse(at);
  if (!Number.isFinite(atMs)) return { outcome: 'continue', matchedRuleId: null };
  const match = rules.find(rule => {
    const start = Date.parse(rule?.activeFrom);
    const end = Date.parse(rule?.expiresAt);
    return rule?.action === 'deny'
      && typeof rule.ruleId === 'string' && rule.ruleId.startsWith('xdr.known-cve.')
      && rule.sourceIp === verifiedSourceIp
      && Number.isFinite(start) && Number.isFinite(end)
      && start <= atMs && atMs < end
      && Array.isArray(rule.evidenceAlertIds) && rule.evidenceAlertIds.length > 0;
  });
  return match
    ? { outcome: 'deny', matchedRuleId: match.ruleId, expiresAt: match.expiresAt,
        evidenceAlertIds: [...match.evidenceAlertIds] }
    : { outcome: 'continue', matchedRuleId: null };
}

export async function respond({ root = ROOT, now = new Date() } = {}) {
  const fixture = JSON.parse(await readFile(join(root, 'xdr', 'fixtures', `${MODULE_KEY}.json`), 'utf8'));
  if (fixture?.schema !== 'aleph.xdr.fixture.v1'
      || fixture.moduleKey !== MODULE_KEY || !Array.isArray(fixture.alerts)) {
    throw new Error('INVALID_KNOWN_CVE_FIXTURE');
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('INVALID_LOG_TIME');
  const decisions = fixture.alerts.map(decide);
  const rules = buildDenyRules(fixture.alerts, decisions);
  const stamp = now.toISOString();
  const stagedIds = new Set(rules.flatMap(rule => rule.evidenceAlertIds));

  // 경보 원문·IP·계정·URL·비밀값은 알림 로그에 넣지 않습니다.
  const logLines = decisions.flatMap((judgment, index) => {
    if (judgment.action === 'record') return [];
    const alertId = fixture.alerts[index]?.id;
    if (!SAFE_ALERT_ID.test(alertId ?? '')) return [];
    return [JSON.stringify({
      loggedAt: stamp,
      moduleKey: MODULE_KEY,
      alertId,
      classification: judgment.action,
      response: judgment.action === 'block' && stagedIds.has(alertId) ? 'rule_staged' : 'alert_only',
      confidence: judgment.confidence,
    })];
  });

  const rulePath = join(root, 'xdr', MODULE_KEY, 'deny-rules.json');
  const logPath = join(root, 'xdr', 'alerts.log');
  const snapshot = {
    schema: 'aleph.xdr.deny-rules.v1',
    moduleKey: MODULE_KEY,
    mode: 'staged_only', // 기존 ZTNA 엔진에 등록·집행된 규칙은 아닙니다.
    generatedAt: stamp,
    ttlSeconds: RULE_TTL_MS / 1000,
    rules,
  };
  await mkdir(dirname(rulePath), { recursive: true });
  await writeFile(rulePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  if (logLines.length) await appendFile(logPath, `${logLines.join('\n')}\n`, 'utf8');
  return {
    totalAlerts: fixture.alerts.length,
    classifications: {
      block: decisions.filter(result => result.action === 'block').length,
      alert: decisions.filter(result => result.action === 'alert').length,
      record: decisions.filter(result => result.action === 'record').length,
    },
    stagedDenyRules: rules.length,
    appendedLogLines: logLines.length,
    operation: 'staged_only',
  };
}

const isMain = Boolean(process.argv[1])
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    console.log(JSON.stringify(await respond()));
  } catch {
    // 경보 원문·계정·토큰 등이 예외 메시지로 누출되지 않게 고정 오류만 출력합니다.
    console.error('XDR-03 대응 처리 실패: 입력 형식 또는 쓰기 권한을 확인하세요.');
    process.exitCode = 1;
  }
}
