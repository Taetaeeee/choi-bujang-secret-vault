// BYTE BACK XDR web-injection 대응 어댑터.
// decide.mjs는 판단만 담당하며, 이 파일에서 알림과 만료되는 임시 거부 규칙을 관리합니다.
// 현재 SDP 계약은 검증된 출발지 IP를 전달하지 않으므로 운영 ZTNA 차단 연동은 하지 않습니다.
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from './decide.mjs';

const MODULE_KEY = 'web-injection';
export const RULE_TTL_MS = 15 * 60 * 1000; // 학습용 만료 시간: 15분
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SAFE_ALERT_ID = /^[A-Za-z0-9_-]{1,64}$/u;
const ALLOWED_PATTERN_NAMES = new Set([
  '웹 요청 인자의 SQL 구문 주입 시도',
  '웹 요청 인자의 스크립트 태그 주입 시도',
  '상위 디렉터리 이동 표기의 반복 시도',
]);

function timestampMs(alert) {
  if (typeof alert?.timestamp !== 'string') return null;
  const n = Date.parse(alert.timestamp);
  return Number.isFinite(n) ? n : null;
}

function repeatCount(value) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value === 'string' && /^(?:0|[1-9][0-9]{0,6})$/u.test(value)) {
    return Number(value);
  }
  return null;
}

function validCandidate(alert, judgement) {
  return Boolean(alert) && typeof alert === 'object'
    && SAFE_ALERT_ID.test(alert.id ?? '')
    && timestampMs(alert) !== null
    && isIP(alert.data?.srcip ?? '') !== 0
    && typeof alert.data?.url === 'string'
    && alert.data.url.startsWith('/')
    && repeatCount(alert.data?.count) >= 8
    && Number.isInteger(alert.rule?.level)
    && alert.rule.level >= 10
    && Array.isArray(alert.rule?.mitre)
    && alert.rule.mitre.some(tag => typeof tag === 'string' && /^T1190(?:\.|$)/u.test(tag))
    && judgement?.action === 'block'
    && typeof judgement.confidence === 'number'
    && Number.isFinite(judgement.confidence)
    && judgement.confidence >= 0.85 && judgement.confidence <= 1
    && ALLOWED_PATTERN_NAMES.has(judgement.reason);
}

// 자동 IP 거부는 보수적으로 적용합니다. 같은 IP에 정상/애매한 이벤트가
// 근처 시각에 있으면 공유 IP 사용자 보호를 위해 규칙 생성을 보류합니다.
export function buildDenyRules(alerts, decisions) {
  if (!Array.isArray(alerts)) throw new TypeError('경보 목록이 올바르지 않습니다.');
  const outputs = decisions === undefined ? alerts.map(decide) : decisions;
  if (!Array.isArray(outputs) || alerts.length !== outputs.length) {
    throw new TypeError('경보 수와 판단 결과 수가 일치해야 합니다.');
  }

  const entries = alerts.map((alert, index) => ({ alert, judgement: outputs[index], at: timestampMs(alert) }));
  const candidates = entries.filter(({ alert, judgement }) => validCandidate(alert, judgement));
  const safeCandidates = candidates.filter(({ alert, at }) => !entries.some(other => (
    other.alert !== alert
    && other.judgement?.action !== 'block'
    && other.at !== null
    && other.alert?.data?.srcip === alert.data.srcip
    && Math.abs(other.at - at) <= RULE_TTL_MS
  )));

  // IP별 묶음은 서로 15분 이내인 사건만 묶어 규칙의 적용 기간을 늘리지 않습니다.
  const byIp = new Map();
  for (const entry of safeCandidates) {
    const ip = entry.alert.data.srcip;
    const list = byIp.get(ip) ?? [];
    list.push(entry);
    byIp.set(ip, list);
  }

  const rules = [];
  for (const [sourceIp, events] of byIp) {
    events.sort((a, b) => a.at - b.at);
    let group = null;
    function flush() {
      if (!group) return;
      rules.push({
        ruleId: `xdr.web-injection.${group.ids[0]}`,
        action: 'deny',
        sourceIp,
        activeFrom: new Date(group.firstAt).toISOString(),
        expiresAt: new Date(group.lastAt + RULE_TTL_MS).toISOString(),
        evidenceAlertIds: [...group.ids],
        patternNames: [...group.patterns],
      });
    }
    for (const entry of events) {
      if (!group || entry.at - group.lastAt > RULE_TTL_MS) {
        flush();
        group = { firstAt: entry.at, lastAt: entry.at, ids: [], patterns: new Set() };
      }
      group.lastAt = entry.at;
      group.ids.push(entry.alert.id);
      group.patterns.add(entry.judgement.reason);
    }
    flush();
  }
  return rules;
}

// verifiedSourceIp는 반드시 신뢰 가능한 게이트웨이/운영 엔진이 확인한 값이어야 합니다.
// 'continue'는 기존 ZTNA 판정을 그대로 진행한다는 뜻이지, 'allow'가 아닙니다.
export function checkTrustedSourceIp({ verifiedSourceIp, at } = {}, rules) {
  if (isIP(verifiedSourceIp ?? '') === 0 || !Array.isArray(rules)) {
    return { outcome: 'continue', matchedRuleId: null };
  }
  if (typeof at !== 'string') return { outcome: 'continue', matchedRuleId: null };
  const now = Date.parse(at);
  if (!Number.isFinite(now)) return { outcome: 'continue', matchedRuleId: null };
  const match = rules.find(rule => (
    rule?.action === 'deny'
    && rule.sourceIp === verifiedSourceIp
    && Number.isFinite(Date.parse(rule.activeFrom))
    && Number.isFinite(Date.parse(rule.expiresAt))
    && Date.parse(rule.activeFrom) <= now
    && now < Date.parse(rule.expiresAt)
    && Array.isArray(rule.evidenceAlertIds) && rule.evidenceAlertIds.length > 0
  ));
  return match
    ? { outcome: 'deny', matchedRuleId: match.ruleId, expiresAt: match.expiresAt,
        evidenceAlertIds: [...match.evidenceAlertIds] }
    : { outcome: 'continue', matchedRuleId: null };
}

export async function respond({ root = ROOT, now = new Date() } = {}) {
  const fixture = JSON.parse(await readFile(join(root, 'xdr', 'fixtures', `${MODULE_KEY}.json`), 'utf8'));
  if (fixture?.schema !== 'aleph.xdr.fixture.v1'
      || fixture.moduleKey !== MODULE_KEY || !Array.isArray(fixture.alerts)) {
    throw new Error('경보 묶음 형식이 올바르지 않습니다.');
  }
  const decisions = fixture.alerts.map(decide);
  const rules = buildDenyRules(fixture.alerts, decisions);
  const stamp = now instanceof Date && Number.isFinite(now.getTime())
    ? now.toISOString() : new Date().toISOString();

  // 원본 URL, IP, 계정, 요청 본문, 비밀값을 alerts.log에 출력하지 않습니다.
  const logLines = decisions.flatMap((judgement, index) => {
    if (judgement.action === 'record') return [];
    const id = fixture.alerts[index]?.id;
    if (!SAFE_ALERT_ID.test(id ?? '')) return [];
    const staged = rules.some(rule => rule.evidenceAlertIds.includes(id));
    return [JSON.stringify({
      loggedAt: stamp,
      moduleKey: MODULE_KEY,
      alertId: id,
      classification: judgement.action,
      response: judgement.action === 'block' && staged ? 'rule_staged' : 'alert_only',
      confidence: judgement.confidence,
    })];
  });

  const rulePath = join(root, 'xdr', MODULE_KEY, 'deny-rules.json');
  const logPath = join(root, 'xdr', 'alerts.log');
  const snapshot = {
    schema: 'aleph.xdr.deny-rules.v1',
    mode: 'staged_only', // 운영 ZTNA 판정기에 적용된 규칙은 아닙니다.
    moduleKey: MODULE_KEY,
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
      block: decisions.filter(r => r.action === 'block').length,
      alert: decisions.filter(r => r.action === 'alert').length,
      record: decisions.filter(r => r.action === 'record').length,
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
    // 오류 출력에 경보 원문이나 민감한 값이 섞이지 않도록 합니다.
    console.error('웹 주입 XDR 대응 처리에 실패했습니다. 입력 파일 및 권한을 확인하세요.');
    process.exitCode = 1;
  }
}
