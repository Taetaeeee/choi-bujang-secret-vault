import { createClient } from '@supabase/supabase-js';
import { authorizeVault, clearSessionCookie, sameOrigin, setSessionCookie,
  sessionConfigured } from '../src/vault-session.mjs';

function reply(res, status, error) { return res.status(status).json({ error }); }
function parseBody(req) {
  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch { return null; }
}
function isText(value, max) {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}
function createAuthClient(env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Vary', 'Cookie');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return reply(response, 405, 'METHOD_NOT_ALLOWED');
  }
  if (!sameOrigin(request)) return reply(response, 403, 'ORIGIN_FORBIDDEN');
  const body = parseBody(request);
  if (!body || !['login', 'status', 'logout'].includes(body.action)) {
    return reply(response, 400, 'INVALID_REQUEST');
  }
  const env = process.env;
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY || !sessionConfigured(env)) {
    return reply(response, 503, 'SESSION_CONFIG_UNAVAILABLE');
  }

  if (body.action === 'status') {
    const auth = await authorizeVault(request, response);
    if (!auth.identity || auth.identity.kind !== 'student') {
      if (auth.status === 503) return reply(response, 503, auth.error);
      return response.status(200).json({ authenticated: false });
    }
    return response.status(200).json({ authenticated: true, user: {
      id: auth.identity.userId, email: auth.session?.user?.email ?? null,
    } });
  }

  if (body.action === 'logout') {
    const auth = await authorizeVault(request, response);
    clearSessionCookie(response);
    if (auth.session) {
      try {
        const supabase = createAuthClient(env);
        const { error: setError } = await supabase.auth.setSession({
          access_token: auth.session.access_token,
          refresh_token: auth.session.refresh_token,
        });
        if (!setError) await supabase.auth.signOut({ scope: 'local' });
      } catch { /* 브라우저 쿠키는 지웠으므로 서버 로그아웃 실패를 자료 노출로 바꾸지 않습니다. */ }
    }
    return response.status(200).json({ ok: true });
  }

  if (!isText(body.email, 254) || !isText(body.password, 1024)) {
    return reply(response, 400, 'INVALID_CREDENTIALS');
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/u.test(env.SUPABASE_PUBLISHABLE_KEY ?? '')) {
    return reply(response, 503, 'AUTH_UNAVAILABLE');
  }
  try {
    const { data, error } = await createAuthClient(env).auth.signInWithPassword({
      email: body.email.trim(), password: body.password,
    });
    const session = data?.session;
    const user = data?.user;
    if (error || !session || !user) return reply(response, 401, 'LOGIN_FAILED');
    setSessionCookie(response, { access_token: session.access_token,
      refresh_token: session.refresh_token, expires_at: session.expires_at,
      user: { id: user.id, email: user.email ?? null } });
    return response.status(200).json({ authenticated: true,
      user: { id: user.id, email: user.email ?? null } });
  } catch {
    return reply(response, 502, 'AUTH_REQUEST_FAILED');
  }
}
