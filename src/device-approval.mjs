// 기기 승인 기록은 Supabase 서버 권한으로만 읽고 씁니다.
// 설치 여부, 사용자가 보낸 상태값, JWT의 존재만으로 승인을 만들지 않습니다.
import { createHash, randomBytes } from 'node:crypto';
import { DEVICE_COOKIE, readCookie, setDeviceCookie } from './vault-session.mjs';

const DEVICE_COOKIE_RE = /^[A-Za-z0-9_-]{43}$/u;
const VALID_STATES = ['pending', 'approved', 'revoked'];

export function deviceDigest(value) {
  return DEVICE_COOKIE_RE.test(value ?? '')
    ? createHash('sha256').update(value, 'utf8').digest('hex') : null;
}

async function findDevice(db, ownerId, digest) {
  const { data, error } = await db.from('vault_device_approvals')
    .select('id,owner_id,status').eq('owner_id', ownerId)
    .eq('device_digest', digest).maybeSingle();
  if (error) return { status: 'unavailable' };
  if (!data) return { status: 'not_requested' };
  if (data.owner_id !== ownerId || !VALID_STATES.includes(data.status)) return { status: 'unavailable' };
  return { status: data.status, requestId: data.id };
}

export async function getDeviceApproval(db, request, identity) {
  if (identity?.kind !== 'student') return { status: 'not_requested' };
  const digest = deviceDigest(readCookie(request, DEVICE_COOKIE));
  if (!digest) return { status: 'not_requested' };
  try { return await findDevice(db, identity.userId, digest); }
  catch { return { status: 'unavailable' }; }
}

export async function requestDeviceApproval(db, request, response, identity) {
  if (identity?.kind !== 'student') return { status: 'unavailable' };
  const current = readCookie(request, DEVICE_COOKIE);
  const token = deviceDigest(current) ? current : randomBytes(32).toString('base64url');
  const digest = deviceDigest(token);
  try {
    const prior = await findDevice(db, identity.userId, digest);
    if (prior.status !== 'not_requested') return prior;
    const { data, error } = await db.from('vault_device_approvals')
      .insert({ owner_id: identity.userId, device_digest: digest, status: 'pending' })
      .select('id,owner_id,status').single();
    if (error) {
      // 동일 기기의 동시에 들어온 승인 요청은 기존 행을 조회합니다.
      if (error.code === '23505') return await findDevice(db, identity.userId, digest);
      return { status: 'unavailable' };
    }
    if (!data || data.owner_id !== identity.userId || data.status !== 'pending') {
      return { status: 'unavailable' };
    }
    setDeviceCookie(response, token);
    return { status: 'pending', requestId: data.id };
  } catch {
    return { status: 'unavailable' };
  }
}
