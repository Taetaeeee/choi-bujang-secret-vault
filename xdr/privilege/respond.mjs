// XDR-05 제작 4: 권한 상승 경보의 보수적인 세션 거부 후보와 알림 기록.
// 이 파일만 입출력을 수행합니다. decide.mjs / 기존 ZTNA 정책은 변경하지 않습니다.
// 공식 ZTNA 요청에는 Wazuh srcuser와 subjectId의 검증된 연결 정보가 없습니다.
// 따라서 규칙은 staged_only이며 운영 세션을 실제 회수하지 않습니다.
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from './decide.mjs';

const MODULE_KEY = 'privilege';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ALERT_ID = /^pv-[0-9]{2,4}$/u;
const DEMO_ACCOUNT = /^user[0-9]{2,4}$/u;
const SUBJECT_ID = /^[A-Za-z0-9._:-]{8,256}$/u;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const BLOCK_PATTERNS = new Set([
  '갑작스러운 관리자 그룹 추가',
  '처음 보는 관리자 권한 명령',
  '업무 시간 밖 권한 사용',
]);

export const RULE_TTL_MS = 15 * 60 * 1000;

function eventMs(alert) {
  const value = alert?.timestamp;
  if (typeof value !== 'string' || !ISO_TIME.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function safeDemoAccount(alert) {
  const account = alert?.data?.srcuser;
  return typeof account === 'string' && DEMO_ACCOUNT.test(account) ? account : null;
}

function isBlockCandidate(alert, decision) {
  return typeof alert?.id === 'string' && ALERT_ID.test(alert.id)
    && eventMs(alert) !== null
    && safeDemoAccount(alert) !== null
    && Number.isInteger(alert.rule?.level)
    && alert.rule.level >= 10 && alert.rule.level <= 16
    && Array.isArray(alert.rule?.mitre)
    && alert.rule.mitre.some(id => id === 'T1068' || id === 'T1078')
    && decision?.action === 'block'
    && Number.isFinite(decision.confidence)
    && decision.confidence >= 0.85 && decision.confidence <= 1
    && BLOCK_PATTERNS.has(decision.reason);
}

// 동일 계정에서 정상·불확실 경보가 발생한 시간대에는 계정 전체 거부를 보류합니다.
// 정상 세션을 구분할 수 있는 sessionId가 경보에 없기 때문입니다.
// 외부에서 전달한 판단 결과는 반드시 실제 decide(alert) 결과와 일치해야 합니다.
export function buildDenyRules(alerts, decisions) {
  if (!Array.isArray(alerts)) throw new TypeError('INVALID_ALERTS');
  if (decisions !== undefined &&
      (!Array.isArray(decisions) || decisions.length !== alerts.length)) {
    throw new TypeError('INVALID_DECISIONS');
  }

  const entries = alerts.map((alert, index) => {
    const decision = decide(alert);
    const provided = decisions?.[index];
    const consistent = provided === undefined || (
      provided?.action === decision.action &&
      provided.confidence === decision.confidence &&
      provided.reason === decision.reason
    );
    return {
      alert, decision, consistent,
      account: safeDemoAccount(alert),
      at: eventMs(alert),
      candidate: consistent && isBlockCandidate(alert, decision),
    };
  });

  const idCounts = new Map();
  for (const { alert } of entries) {
    if (typeof alert?.id === 'string') {
      idCounts.set(alert.id, (idCounts.get(alert.id) || 0) + 1);
    }
  }

  const rules = [];
  for (const entry of entries) {
    if (!entry.candidate || idCounts.get(entry.alert.id) !== 1) continue;

    // 동일 계정의 조사·정상 이벤트가 해당 시각 ±15분 안에 있으면 보류.
    // 타임스탬프를 읽을 수 없는 동일 계정 이벤트도 안전하게 보류.
    const uncertainSameAccount = entries.some(other =>
      other !== entry && other.account === entry.account &&
      (!other.candidate || idCounts.get(other.alert?.id) !== 1) &&
      (other.at === null || Math.abs(other.at - entry.at) <= RULE_TTL_MS)
    );
    if (uncertainSameAccount) continue;

    rules.push({
      ruleId: `xdr.privilege.${entry.alert.id}`,
      action: 'deny',
      accountRef: entry.account, // 문서용 가상 계정, 운영 subjectId가 아닙니다.
      activeFrom: new Date(entry.at).toISOString(),
      expiresAt: new Date(entry.at + RULE_TTL_MS).toISOString(),
      evidenceAlertIds: [entry.alert.id],
      patternNames: [entry.decision.reason],
    });
  }
  return rules;
}

// 신뢰된 엔진 측 resolver가 경보 계정과 검증된 subjectId를 연결한 경우에만
// 모의 ZTNA 거부 규칙으로 변환합니다. 사용자 입력이나 브라우저 값을 연결에 쓰지 마세요.
// 이 함수는 실제 ZTNA 엔진에 설치된 훅이 아닙니다.
export function bindVerifiedSubjects(rules, resolveVerifiedSubjectId) {
  if (!Array.isArray(rules) || typeof resolveVerifiedSubjectId !== 'function') {
    throw new TypeError('INVALID_SUBJECT_BINDING');
  }
  const staged = [];
  const owners = new Map();
  for (const rule of rules) {
    if (rule?.action !== 'deny' || !DEMO_ACCOUNT.test(rule.accountRef ?? '') ||
        !ALERT_ID.test(rule.evidenceAlertIds?.[0] ?? '') ||
        rule.ruleId !== `xdr.privilege.${rule.evidenceAlertIds[0]}`) continue;

    const subjectId = resolveVerifiedSubjectId(rule.accountRef);
    if (typeof subjectId !== 'string' || !SUBJECT_ID.test(subjectId)) continue;
    // 여러 경보 계정이 하나의 주체로 연결되면 정상 사용자를 구별할 수 없으므로 보류.
    const prior = owners.get(subjectId);
    if (prior && prior !== rule.accountRef) {
      owners.set(subjectId, null);
      continue;
    }
    if (!owners.has(subjectId)) owners.set(subjectId, rule.accountRef);
    staged.push({
      ruleId: rule.ruleId,
      action: rule.action,
      verifiedSubjectId: subjectId,
      activeFrom: rule.activeFrom,
      expiresAt: rule.expiresAt,
      evidenceAlertIds: [...rule.evidenceAlertIds],
      patternNames: [...rule.patternNames],
    });
  }
  return staged.filter(rule => owners.get(rule.verifiedSubjectId) !== null);
}

// 요청의 verifiedSubjectId는 실제 운영 엔진이 이미 검증한 경우에만 신뢰합니다.
// 'continue'는 기존 src/decider.mjs의 정책 판정을 계속한다는 뜻이지 허용이 아닙니다.
export function checkVerifiedSubject({ verifiedSubjectId, at } = {}, rules = []) {
  if (typeof verifiedSubjectId !== 'string' || !SUBJECT_ID.test(verifiedSubjectId)
      || typeof at !== 'string' || !ISO_TIME.test(at)
      || !Array.isArray(rules)) {
    return { outcome: 'continue', matchedRuleId: null };
  }
  const now = Date.parse(at);
  if (!Number.isFinite(now)) return { outcome: 'continue', matchedRuleId: null };

  const match = rules.find(rule => {
    const start = Date.parse(rule?.activeFrom);
    const end = Date.parse(rule?.expiresAt);
    return rule?.action === 'deny'
      && typeof rule.ruleId === 'string'
      && /^xdr\.privilege\.pv-[0-9]{2,4}$/u.test(rule.ruleId)
      && rule.verifiedSubjectId === verifiedSubjectId
      && Number.isFinite(start) && Number.isFinite(end)
      && start <= now && now < end && end - start === RULE_TTL_MS
      && Array.isArray(rule.evidenceAlertIds)
      && rule.evidenceAlertIds.length === 1
      && rule.ruleId === `xdr.privilege.${rule.evidenceAlertIds[0]}`
      && Array.isArray(rule.patternNames)
      && rule.patternNames.length === 1
      && BLOCK_PATTERNS.has(rule.patternNames[0]);
  });
  return match ? {
    outcome: 'deny',
    matchedRuleId: match.ruleId,
    expiresAt: match.expiresAt,
    evidenceAlertIds: [...match.evidenceAlertIds],
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
    throw new Error('INVALID_PRIVILEGE_FIXTURE');
  }
  const decisions = fixture.alerts.map(decide);
  const rules = buildDenyRules(fixture.alerts, decisions);
  const stagedIds = new Set(rules.flatMap(rule => rule.evidenceAlertIds));
  const stamp = now.toISOString();

  // 경보 원문, 계정, IP, 자격 증명 및 비밀값은 알림 로그에 남기지 않습니다.
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
    note: '운영 ZTNA에는 자동 적용되지 않음. 계정-subjectId 신뢰 매핑 필요.',
    generatedAt: stamp,
    ttlSeconds: RULE_TTL_MS / 1000,
    rules,
  }, null, 2)}\n`, 'utf8');

  if (lines.length) {
    await appendFile(join(root, 'xdr', 'alerts.log'),
      `${lines.join('\n')}\n`, 'utf8');
  }
  return {
    totalAlerts: fixture.alerts.length,
    classifications: {
      block: decisions.filter(result => result.action === 'block').length,
      alert: decisions.filter(result => result.action === 'alert').length,
      record: decisions.filter(result => result.action === 'record').length,
    },
    stagedDenyRules: rules.length,
    heldBlockAlerts: decisions.filter((result, i) =>
      result.action === 'block' && !stagedIds.has(fixture.alerts[i]?.id)).length,
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
    // 예외에 포함된 계정명·민감정보가 출력되지 않도록 고정 오류만 보냅니다.
    console.error('XDR-05 대응 처리 실패: 경보 형식 또는 쓰기 권한을 확인하세요.');
    process.exitCode = 1;
  }
}
