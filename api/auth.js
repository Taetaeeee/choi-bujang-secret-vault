import { createClient } from '@supabase/supabase-js';

// BYTE BACK 5단계 추가 보너스: 로그인/갱신/로그아웃만 서버에서 처리합니다.
// 브라우저에 Supabase URL, publishable key 또는 서버 전용 키를 전달하지 않습니다.
// 메모 API와 src/verify-login.mjs의 토큰 검증 로직은 변경하지 않습니다.

function reply(res, status, error, message) {
  return res.status(status).json({ error, ...(message ? { message } : {}) });
}

function isPlainRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readBody(req) {
  try {
    const raw = req.body;
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return isPlainRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function isText(value, max) {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function sessionPayload(data) {
  const session = data?.session;
  const user = data?.user ?? session?.user;
  if (!isText(session?.access_token, 8192)
      || !isText(session?.refresh_token, 4096)
      || !isText(user?.id, 128)) return null;
  return {
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at ?? null,
    },
    user: { id: user.id, email: user.email ?? null },
  };
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return reply(response, 405, 'METHOD_NOT_ALLOWED');
  }

  const body = readBody(request);
  if (!body || !['login', 'refresh', 'logout'].includes(body.action)) {
    return reply(response, 400, 'INVALID_REQUEST');
  }
  const projectUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (typeof projectUrl !== 'string' || !projectUrl.startsWith('https://')
      || typeof publishableKey !== 'string'
      || !/^sb_publishable_[A-Za-z0-9_-]+$/u.test(publishableKey)) {
    return reply(response, 503, 'AUTH_UNAVAILABLE');
  }

  const supabase = createClient(projectUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  try {
    if (body.action === 'login') {
      if (!isText(body.email, 254) || !isText(body.password, 1024)) {
        return reply(response, 400, 'INVALID_CREDENTIALS');
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: body.email.trim(), password: body.password,
      });
      if (error) return reply(response, 401, 'LOGIN_FAILED', error.message);
      const payload = sessionPayload(data);
      if (!payload) return reply(response, 502, 'AUTH_RESPONSE_INVALID');
      return response.status(200).json(payload);
    }

    if (body.action === 'refresh') {
      if (!isText(body.refresh_token, 4096)) return reply(response, 400, 'INVALID_REQUEST');
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: body.refresh_token,
      });
      if (error) return reply(response, 401, 'SESSION_EXPIRED');
      const payload = sessionPayload(data);
      if (!payload) return reply(response, 502, 'AUTH_RESPONSE_INVALID');
      return response.status(200).json(payload);
    }

    if (!isText(body.access_token, 8192) || !isText(body.refresh_token, 4096)) {
      return reply(response, 400, 'INVALID_REQUEST');
    }
    // SDK가 세션의 유효성을 확인하고 현 세션의 refresh token을 폐기합니다.
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: body.access_token,
      refresh_token: body.refresh_token,
    });
    if (sessionError) return reply(response, 401, 'SESSION_EXPIRED');
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) return reply(response, 502, 'LOGOUT_FAILED');
    return response.status(200).json({ ok: true });
  } catch {
    // 요청의 비밀번호·JWT·갱신 토큰은 응답과 로그에 출력하지 않습니다.
    return reply(response, 502, 'AUTH_REQUEST_FAILED');
  }
}
