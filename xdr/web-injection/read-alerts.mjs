// BYTE BACK XDR web-injection: 경보 확인용 읽기 모듈.
// 판단(decide.mjs)과 독립적으로 실행하며 원본 경보를 변경하지 않습니다.
import { readFile } from 'node:fs/promises';
import { isIP } from 'node:net';

const FIXTURE_URL = new URL('../fixtures/web-injection.json', import.meta.url);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const SAFE_ACCOUNT = /^[A-Za-z0-9_.@-]{1,80}$/u;

// 로그 설명에 섞여 있을 수 있는 인증 정보는 값 자체를 출력하지 않습니다.
function redactSecrets(value) {
  if (typeof value !== 'string' || value.length > 2000) return null;
  return value
    .replace(/\b(?:authorization\s*[:=]\s*)?bearer\s+[A-Za-z0-9._~+/-]+=*/giu, '[REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, '[REDACTED]')
    .replace(/\b(?:sb_secret_|sb_publishable_|gh[pousr]_|sk-)[A-Za-z0-9_-]{8,}\b/gu, '[REDACTED]')
    .replace(/\b(password|passwd|pwd|passphrase|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|token|private[_-]?key|authorization)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;)}\]]+)/giu,
      '$1=[REDACTED]')
    .replace(/\r|\n/gu, ' ')
    .slice(0, 400);
}

function summarize(alert) {
  const timestamp = alert?.timestamp;
  const sourceIp = alert?.data?.srcip;
  const account = alert?.data?.srcuser;
  const ruleLevel = alert?.rule?.level;

  return {
    timestamp: typeof timestamp === 'string' && ISO_DATE.test(timestamp)
      && Number.isFinite(Date.parse(timestamp)) ? timestamp : null,
    sourceIp: typeof sourceIp === 'string' && isIP(sourceIp) !== 0 ? sourceIp : null,
    account: typeof account === 'string' && SAFE_ACCOUNT.test(account)
      && !/(?:password|passwd|secret|token|api[_-]?key|sb_secret_|sb_publishable_|gh[pousr]_)/iu.test(account)
      ? account : null,
    ruleLevel: Number.isInteger(ruleLevel) && ruleLevel >= 0 && ruleLevel <= 16
      ? ruleLevel : null,
    description: redactSecrets(alert?.rule?.description),
  };
}

export async function readAlerts() {
  const fixture = JSON.parse(await readFile(FIXTURE_URL, 'utf8'));
  if (fixture?.schema !== 'aleph.xdr.fixture.v1'
    || fixture.moduleKey !== 'web-injection'
    || !Array.isArray(fixture.alerts)) {
    throw new Error('경보 묶음 형식이 올바르지 않습니다.');
  }
  return fixture.alerts.map(summarize);
}

try {
  const rows = await readAlerts();
  for (const row of rows) console.log(JSON.stringify(row));
} catch {
  // 원본 데이터 또는 비밀값이 에러 메시지에 섞이지 않도록 합니다.
  console.error('경보 파일 읽기 또는 형식 확인에 실패했습니다.');
  process.exitCode = 1;
}
