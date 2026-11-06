// XDR-04 제작 4: 지속성 경보 대응 모듈.
// 기존 ZTNA 판정기는 수정하지 않고 거부 규칙 후보만 준비합니다.
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from './decide.mjs';

const MODULE_KEY = 'persistence';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SAFE_ALERT_ID = /^[a-zA-Z0-9_-]{1,64}$/u;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;

const BLOCK_PATTERNS = new Set([
  '서명 없는 신규 서비스 등록 또는 실행 파일 변경',
  '낯선 예약 작업을 통한 비정상 프로그램 실행',
  '평소 목록에 없는 시작 폴더 자동 실행 항목',
]);

export const RULE_TTL_MS = 15 * 60 * 1000;

function alertTime(alert) {
  if (typeof alert?.timestamp !== 'string' ||
      !ISO_TIME.test(alert.timestamp)) return null;

  const ms = Date.parse(alert.timestamp);
  return Number.isFinite(ms) ? ms : null;
}

function isBlockCandidate(alert, judgment) {
  return alert && typeof alert === 'object' &&
    !Array.isArray(alert) &&
    typeof alert.id === 'string' &&
    SAFE_ALERT_ID.test(alert.id) &&
    alertTime(alert) !== null &&
    typeof alert.data?.srcip === 'string' &&
    isIP(alert.data.srcip) !== 0 &&
    Number.isInteger(alert.rule?.level) &&
    alert.rule.level >= 10 &&
    alert.rule.level <= 16 &&
    Array.isArray(alert.rule?.mitre) &&
    alert.rule.mitre.some(tag =>
      typeof tag === 'string' &&
      /^(?:T1543|T1053|T1547(?:\.001)?)(?:\.|$)/u.test(tag)
    ) &&
    judgment?.action === 'block' &&
    Number.isFinite(judgment.confidence) &&
    judgment.confidence >= 0.85 &&
    judgment.confidence <= 1 &&
    BLOCK_PATTERNS.has(judgment.reason);
}

// 외부에서 전달한 판정도 실제 decide 결과와 대조합니다.
// 같은 IP에 정상 또는 불확실 경보가 있다면 거부 후보를 보류합니다.
export function buildDenyRules(alerts, decisions) {
  if (!Array.isArray(alerts)) {
    throw new TypeError('INVALID_ALERTS');
  }

  if (decisions !== undefined &&
      (!Array.isArray(decisions) ||
       decisions.length !== alerts.length)) {
    throw new TypeError('INVALID_DECISIONS');
  }

  const entries = alerts.map((alert, index) => {
    const verified = decide(alert);
    const provided = decisions?.[index];

    const consistent = !provided ||
      (provided.action === verified.action &&
       provided.confidence === verified.confidence &&
       provided.reason === verified.reason);

    return { alert, judgment: verified, consistent };
  });

  const protectedIps = new Set(
    entries.filter(({ alert, judgment, consistent }) =>
      typeof alert?.data?.srcip === 'string' &&
      isIP(alert.data.srcip) !== 0 &&
      (!consistent || !isBlockCandidate(alert, judgment))
    ).map(({ alert }) => alert.data.srcip)
  );

  const rules = [];
  const seenIds = new Set();

  for (const { alert, judgment, consistent } of entries) {
    if (!consistent ||
        !isBlockCandidate(alert, judgment) ||
        protectedIps.has(alert.data.srcip) ||
        seenIds.has(alert.id)) {
      continue;
    }

    seenIds.add(alert.id);
    const start = alertTime(alert);

    rules.push({
      ruleId: `xdr.persistence.${alert.id}`,
      action: 'deny',
      sourceIp: alert.data.srcip,
      activeFrom: new Date(start).toISOString(),
      expiresAt: new Date(start + RULE_TTL_MS).toISOString(),
      evidenceAlertIds: [alert.id],
      patternNames: [judgment.reason],
    });
  }

  return rules;
}

// 검증된 출발 IP가 제공되는 환경에서만 사용합니다.
// 공식 ZTNA 요청 계약에는 해당 필드가 없으므로 운영 엔진에
// 직접 적용하지 않습니다.
// continue는 기존 ZTNA 판정을 계속한다는 뜻입니다.
export function checkTrustedSourceIp(
  { verifiedSourceIp, at } = {},
  rules = []
) {
  if (typeof verifiedSourceIp !== 'string' ||
      isIP(verifiedSourceIp) === 0 ||
      typeof at !== 'string' ||
      !ISO_TIME.test(at) ||
      !Array.isArray(rules)) {
    return { outcome: 'continue', matchedRuleId: null };
  }

  const now = Date.parse(at);
  if (!Number.isFinite(now)) {
    return { outcome: 'continue', matchedRuleId: null };
  }

  const match = rules.find(rule => {
    const start = Date.parse(rule?.activeFrom);
    const end = Date.parse(rule?.expiresAt);

    return rule?.action === 'deny' &&
      typeof rule.ruleId === 'string' &&
      /^xdr\.persistence\.[a-zA-Z0-9_-]{1,64}$/u.test(rule.ruleId) &&
      rule.sourceIp === verifiedSourceIp &&
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      start <= now &&
      now < end &&
      end - start <= RULE_TTL_MS &&
      Array.isArray(rule.evidenceAlertIds) &&
      rule.evidenceAlertIds.length > 0;
  });

  return match ? {
    outcome: 'deny',
    matchedRuleId: match.ruleId,
    expiresAt: match.expiresAt,
    evidenceAlertIds: [...match.evidenceAlertIds],
  } : {
    outcome: 'continue',
    matchedRuleId: null,
  };
}

// 원본 경보를 읽고 거부 후보를 저장하며 알림을 누적합니다.
export async function respond({
  root = ROOT,
  now = new Date()
} = {}) {
  if (!(now instanceof Date) ||
      !Number.isFinite(now.getTime())) {
    throw new TypeError('INVALID_NOW');
  }

  const fixture = JSON.parse(
    await readFile(
      join(root, 'xdr', 'fixtures', 'persistence.json'),
      'utf8'
    )
  );

  if (fixture?.schema !== 'aleph.xdr.fixture.v1' ||
      fixture.moduleKey !== MODULE_KEY ||
      !Array.isArray(fixture.alerts)) {
    throw new Error('INVALID_PERSISTENCE_FIXTURE');
  }

  const decisions = fixture.alerts.map(decide);
  const rules = buildDenyRules(fixture.alerts, decisions);

  const stagedIds = new Set(
    rules.flatMap(rule => rule.evidenceAlertIds)
  );

  const stamp = now.toISOString();

  // 경보 원문, 계정, IP 및 비밀값을 로그에 남기지 않습니다.
  const lines = decisions.flatMap((decision, index) => {
    const id = fixture.alerts[index]?.id;

    if (decision.action === 'record' ||
        typeof id !== 'string' ||
        !SAFE_ALERT_ID.test(id)) {
      return [];
    }

    return [JSON.stringify({
      loggedAt: stamp,
      moduleKey: MODULE_KEY,
      alertId: id,
      classification: decision.action,
      response: decision.action === 'block' && stagedIds.has(id)
        ? 'rule_staged' : 'alert_only',
      confidence: decision.confidence,
    })];
  });

  const rulePath = join(
    root, 'xdr', MODULE_KEY, 'deny-rules.json'
  );

  await mkdir(dirname(rulePath), { recursive: true });

  await writeFile(
    rulePath,
    `${JSON.stringify({
      schema: 'aleph.xdr.deny-rules.v1',
      moduleKey: MODULE_KEY,
      mode: 'staged_only',
      generatedAt: stamp,
      ttlSeconds: RULE_TTL_MS / 1000,
      rules,
    }, null, 2)}\n`,
    'utf8'
  );

  if (lines.length) {
    await appendFile(
      join(root, 'xdr', 'alerts.log'),
      `${lines.join('\n')}\n`,
      'utf8'
    );
  }

  return {
    totalAlerts: fixture.alerts.length,
    classifications: {
      block: decisions.filter(d => d.action === 'block').length,
      alert: decisions.filter(d => d.action === 'alert').length,
      record: decisions.filter(d => d.action === 'record').length,
    },
    stagedDenyRules: rules.length,
    appendedLogLines: lines.length,
    operation: 'staged_only',
  };
}

const isMain = Boolean(process.argv[1]) &&
  resolve(process.argv[1]) ===
  resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    console.log(JSON.stringify(await respond()));
  } catch {
    console.error(
      'XDR-04 대응 처리 실패: 경보 형식 또는 파일 권한을 확인하세요.'
    );
    process.exitCode = 1;
  }
}