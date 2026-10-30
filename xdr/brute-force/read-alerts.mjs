import { readFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 제작 1: 수업용 Wazuh 경보에서 지정된 다섯 필드만 읽습니다.
// 원본을 변경하거나 공격 여부를 판정하지 않습니다.
const FIXTURE = new URL('../fixtures/brute-force.json', import.meta.url);
const MASKED = '[가림]';

const SECRET_LIKE = [
  /\b(?:password|passwd|pwd|secret|api[_-]?key|authorization|bearer|access[_-]?token|refresh[_-]?token)\b/iu,
  /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+\b/u,
  /\b(?:ghp_|gho_|ghu_|ghs_|ghr_|github_pat_|sk-)[A-Za-z0-9_-]{12,}\b/u,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/u,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/u,
  /-----BEGIN [A-Z ]*(?:PRIVATE KEY|OPENSSH PRIVATE KEY)-----/u,
  /[A-Za-z0-9+/_=-]{80,}/u,
];

function safeText(value, maxLength) {
  if (typeof value !== 'string') return null;
  if (value.length > maxLength || SECRET_LIKE.some(pattern => pattern.test(value))) return MASKED;
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ').trim();
}

function extract(alert) {
  const timestamp = safeText(alert?.timestamp, 50);
  const rawIp = safeText(alert?.data?.srcip, 45);
  const rawAccount = safeText(alert?.data?.srcuser, 64);
  const level = alert?.rule?.level;
  return {
    timestamp: timestamp && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/u.test(timestamp) ? timestamp : null,
    srcip: rawIp && isIP(rawIp) !== 0 ? rawIp : null,
    srcuser: rawAccount && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u.test(rawAccount) ? rawAccount : MASKED,
    level: Number.isInteger(level) && level >= 0 && level <= 16 ? level : null,
    description: safeText(alert?.rule?.description, 500),
  };
}

export async function readAlerts() {
  const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'));
  if (fixture?.schema !== 'aleph.xdr.fixture.v1'
      || fixture.moduleKey !== 'brute-force'
      || !Array.isArray(fixture.alerts)) {
    throw new Error('INVALID_FIXTURE');
  }
  // 필터링하지 않고 모든 입력 경보에 대해 출력 한 줄을 만듭니다.
  return fixture.alerts.map(extract);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    for (const row of await readAlerts()) process.stdout.write(`${JSON.stringify(row)}\n`);
  } catch {
    // 경보 원문이나 예외 메시지에 포함될 수 있는 비밀값은 출력하지 않습니다.
    console.error('경보 읽기 실패: 파일 위치 또는 JSON 형식을 확인해 주세요.');
    process.exitCode = 1;
  }
}
