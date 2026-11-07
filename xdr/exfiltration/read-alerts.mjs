// XDR-06 제작 1: 자료 유출 모의 Wazuh 경보의 읽기 전용 요약.
// 확인용 도구이며 xdr/exfiltration/decide.mjs 또는 ZTNA 판정기에서 import하지 않습니다.
import { readFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_URL = new URL('../fixtures/exfiltration.json', import.meta.url);
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const SAFE_ACCOUNT = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u;
const MASK = '[가림]';

function redactDescription(value) {
  if (typeof value !== 'string') return null;
  // 길이·제어문자 제한은 비정상 경보로부터 출력을 보호합니다.
  if (value.length > 2000) return MASK;

  return value
    .replace(/-----BEGIN [^-\r\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\r\n]*PRIVATE KEY-----/giu, MASK)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/giu, `Bearer ${MASK}`)
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/gu, MASK)
    .replace(/\b(?:sb_secret_|sb_publishable_|gh[pousr]_|github_pat_|sk_live_|sk_test_|sk-)[A-Za-z0-9_-]{8,}\b/gu, MASK)
    .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu, MASK)
    .replace(/\b(?:password|passwd|pwd|passphrase|secret|client[_-]?secret|api[_-]?key|access[_-]?token|refresh[_-]?token|session[_-]?token|token|private[_-]?key|authorization|cookie|set-cookie)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;)}\]]+)/giu, (item) => `${item.split(/\s*[:=]/u, 1)[0]}=${MASK}`)
    .replace(/\b(https?:\/\/)[^\s/@:]+:[^\s/@]+@/giu, (_, scheme) => `${scheme}${MASK}@`)
    .replace(/(?:[?&](?:token|api[_-]?key|secret|password|access[_-]?token)=)[^\s&#]+/giu, (match) => `${match.slice(0, match.indexOf('=') + 1)}${MASK}`)
    .replace(/[A-Za-z0-9+/_=-]{80,}/gu, MASK)
    .replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ')
    .trim();
}

export function extractAlert(alert) {
  const timestamp = alert?.timestamp;
  const srcip = alert?.data?.srcip;
  const account = alert?.data?.srcuser;
  const level = alert?.rule?.level;

  return {
    timestamp: typeof timestamp === 'string'
      && ISO_TIME.test(timestamp)
      && Number.isFinite(Date.parse(timestamp)) ? timestamp : null,
    sourceIp: typeof srcip === 'string' && isIP(srcip) !== 0 ? srcip : null,
    account: typeof account === 'string'
      && SAFE_ACCOUNT.test(account)
      && !/(?:password|passwd|secret|token|api[_-]?key|sb_secret_|gh[pousr]_)/iu.test(account)
      ? account : null,
    ruleLevel: Number.isInteger(level) && level >= 0 && level <= 16 ? level : null,
    description: redactDescription(alert?.rule?.description),
  };
}

export async function readAlerts() {
  const fixture = JSON.parse(await readFile(FIXTURE_URL, 'utf8'));
  if (fixture?.schema !== 'aleph.xdr.fixture.v1'
      || fixture.moduleKey !== 'exfiltration'
      || !Array.isArray(fixture.alerts)) {
    throw new Error('INVALID_EXFILTRATION_FIXTURE');
  }
  return fixture.alerts.map(extractAlert);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const alerts = await readAlerts();
    for (const item of alerts) {
      process.stdout.write(`${JSON.stringify(item)}\n`);
    }
  } catch {
    // 예외에 포함될 수 있는 원문·비밀값은 출력하지 않습니다.
    console.error('경보 파일 읽기 또는 형식 확인에 실패했습니다.');
    process.exitCode = 1;
  }
}
