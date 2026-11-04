// 11단계: 브라우저 JavaScript에는 인증 토큰을 반환하지 않습니다.
// 서버만 읽는 암호화 HttpOnly 세션 쿠키와 기존 JWT 검증기를 연결합니다.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from './verify-login.mjs';

export const SESSION_COOKIE = '__Host-byteback_session';
export const DEVICE_COOKIE = '__Host-byteback_device';
const KEY_RE = /^[0-9a-f]{64}$/iu;
const COOKIE_VALUE_RE = /^[A-Za-z0-9_.-]+$/u;
const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u;
const MAX_SESSION_LENGTH = 8192;
let cachedVerifier;

export function readCookie(request, name) {
  const source = request.headers?.cookie;
  if (typeof source !== 'string' || source.length > 12000) return null;
  const matches = source.split(';').map(part => part.trim())
    .filter(part => part.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(name.length + 1);
  return value.length > 0 && value.length <= MAX_SESSION_LENGTH && COOKIE_VALUE_RE.test(value)
    ? value : null;
}

function sessionKey(env = process.env) {
  if (!KEY_RE.test(env.VAULT_SESSION_KEY ?? '')) throw new Error('SESSION_CONFIG_UNAVAILABLE');
  return Buffer.from(env.VAULT_SESSION_KEY, 'hex');
}

function validSession(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && JWT_RE.test(value.access_token ?? '')
    && typeof value.refresh_token === 'string' && value.refresh_token.length > 0
    && value.refresh_token.length <= 4096
    && Number.isSafeInteger(Number(value.expires_at))
    && typeof value.user?.id === 'string'
    && /^[0-9a-f-]{36}$/iu.test(value.user.id));
}

export function sealSession(session, env = process.env) {
  if (!validSession(session)) throw new TypeError('INVALID_SESSION');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', sessionKey(env), iv);
  const contents = Buffer.from(JSON.stringify(session), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(contents), cipher.final()]);
  const value = ['v1', iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
  if (value.length > 3900) throw new TypeError('SESSION_TOO_LONG');
  return value;
}

export function openSession(request, env = process.env) {
  const value = readCookie(request, SESSION_COOKIE);
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[2], 'base64url');
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv('aes-256-gcm', sessionKey(env), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')),
      decipher.final()]);
    const session = JSON.parse(plain.toString('utf8'));
    return validSession(session) ? session : null;
  } catch {
    return null;
  }
}

function appendCookie(response, value) {
  const prior = response.getHeader?.('Set-Cookie');
  response.setHeader('Set-Cookie', [...(Array.isArray(prior) ? prior : prior ? [prior] : []), value]);
}

export function setSessionCookie(response, session, env = process.env) {
  appendCookie(response, `${SESSION_COOKIE}=${sealSession(session, env)}; Path=/; HttpOnly; Secure; SameSite=Strict`);
}

export function clearSessionCookie(response) {
  appendCookie(response, `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}

export function setDeviceCookie(response, value) {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(value)) throw new TypeError('INVALID_DEVICE_COOKIE');
  appendCookie(response, `${DEVICE_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`);
}

export function sameOrigin(request) {
  const expected = new URL(config.publicAppUrl).origin;
  const origin = request.headers?.origin;
  return origin === expected;
}

function verifier(secret) {
  cachedVerifier ??= createLoginVerifier({ config, supabaseSecretKey: secret });
  return cachedVerifier;
}

export function sessionConfigured(env = process.env) {
  return KEY_RE.test(env.VAULT_SESSION_KEY ?? '');
}

export async function authorizeVault(request, response, {
  env = process.env, verify = null, refresh = null,
} = {}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY || !sessionConfigured(env)) {
    return { error: 'SERVICE_UNAVAILABLE', status: 503 };
  }
  const bearer = request.headers?.authorization;
  const session = openSession(request, env);
  let token = session?.access_token;
  if (bearer !== undefined) {
    // 기존 시험/엔진 Bearer 형식도 지원하지만 기기 승인을 우회하지는 않습니다.
    if (typeof bearer !== 'string' || !bearer.startsWith('Bearer ')) {
      return { error: 'UNAUTHORIZED', status: 401 };
    }
    token = bearer.slice(7);
  }
  if (!token) return { error: 'UNAUTHORIZED', status: 401 };

  // 탭이 동시에 갱신 토큰을 소비하지 않도록, 브라우저 대신 서버에서 갱신합니다.
  if (session && bearer === undefined && Number(session.expires_at) <= Math.floor(Date.now() / 1000) + 30) {
    try {
      const result = refresh ? await refresh(session.refresh_token) :
        await createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        }).auth.refreshSession({ refresh_token: session.refresh_token });
      if (result.error || !result.data?.session) throw new Error('REFRESH_FAILED');
      const renewed = { access_token: result.data.session.access_token,
        refresh_token: result.data.session.refresh_token,
        expires_at: result.data.session.expires_at,
        user: session.user };
      setSessionCookie(response, renewed, env);
      token = renewed.access_token;
    } catch {
      clearSessionCookie(response);
      return { error: 'UNAUTHORIZED', status: 401 };
    }
  }
  let identity;
  try { identity = await (verify ?? verifier(env.SUPABASE_SECRET_KEY))(`Bearer ${token}`); }
  catch { identity = null; }
  if (!identity || (identity.kind !== 'student' && identity.kind !== 'judge')) {
    return { error: 'UNAUTHORIZED', status: 401 };
  }
  if (session && bearer === undefined && identity.userId !== session.user.id) {
    return { error: 'UNAUTHORIZED', status: 401 };
  }
  return { identity, session, status: 200 };
}
