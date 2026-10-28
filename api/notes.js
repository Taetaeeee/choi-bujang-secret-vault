import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from '../src/verify-login.mjs';

// 4단계 제작 2: 검증된 사용자 ID와 DB owner_id가 일치할 때만 접근합니다.
// DB GRANT/RLS 정책 변경은 다음 제작 단계에서 진행합니다.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
let verifyLogin;

function validNoteFields(value, allowId = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  // POST는 id만 선택 입력, PUT은 title/body만 허용합니다.
  // 사용자 제공 owner_id, userId, role 등은 값에 관계없이 거부합니다.
  const allowed = allowId ? ['id', 'title', 'body'] : ['title', 'body'];
  if (Object.keys(value).some(key => !allowed.includes(key))) return null;
  if (typeof value.title !== 'string' || typeof value.body !== 'string') return null;
  const title = value.title.trim();
  const body = value.body.trim();
  if (!title || !body || title.length > 160 || body.length > 4000) return null;
  return { title, body };
}

function parseBody(request) {
  try {
    const value = request.body;
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  // Vercel rewrite: /api/notes/:id -> /api/notes?noteId=:id
  const rawId = request.query?.noteId;
  const hasId = rawId !== undefined;
  const methods = hasId ? ['GET', 'PUT', 'DELETE'] : ['GET', 'POST'];
  if (!methods.includes(request.method)) {
    response.setHeader('Allow', methods.join(', '));
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  // 브라우저가 제공하는 userId/role/owner_id는 신뢰하지 않습니다.
  const authorization = request.headers?.authorization;
  if (!authorization) return response.status(401).json({ error: 'UNAUTHORIZED' });

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) return response.status(503).json({ error: 'SERVICE_UNAVAILABLE' });

  let identity;
  try {
    verifyLogin ??= createLoginVerifier({ config, supabaseSecretKey: secretKey });
    identity = await verifyLogin(authorization);
  } catch {
    return response.status(401).json({ error: 'UNAUTHORIZED' });
  }
  if (!identity) return response.status(401).json({ error: 'UNAUTHORIZED' });

  if (hasId && (typeof rawId !== 'string' || !UUID.test(rawId))) {
    return response.status(400).json({ error: 'INVALID_ID' });
  }

  const db = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  try {
    if (!hasId && request.method === 'GET') {
      // 모든 목록 조회에서 서버가 검증한 소유자 ID로 제한합니다.
      const [owned, samples] = await Promise.all([
        db.from('vault_user_notes').select('id,title,body')
          .eq('owner_id', identity.userId).order('created_at', { ascending: false }),
        // 제작 1에서 A의 owner_id를 지정한 기존 네 건. B에게는 반환하지 않습니다.
        db.from('vault_notes').select('id,title,content')
          .eq('owner_id', identity.userId).in('id', [1, 2, 3, 4])
          .order('id', { ascending: true }),
      ]);
      if (owned.error || samples.error || !Array.isArray(owned.data)
          || !Array.isArray(samples.data)) {
        return response.status(502).json({ error: 'DATA_UNAVAILABLE' });
      }
      return response.status(200).json({
        notes: owned.data,
        sampleMarker: 'SAMPLE_NOTE_1',
        sampleNotes: samples.data.map(({ title, content }) => ({ title, content })),
      });
    }

    if (!hasId && request.method === 'POST') {
      const payload = parseBody(request);
      const fields = validNoteFields(payload, true);
      if (!fields) return response.status(400).json({ error: 'INVALID_NOTE' });
      const id = payload.id === undefined ? randomUUID() : payload.id;
      if (typeof id !== 'string' || !UUID.test(id)) {
        return response.status(400).json({ error: 'INVALID_ID' });
      }
      const { data, error } = await db.from('vault_user_notes')
        .insert({ id, ...fields, owner_id: identity.userId }).select('id').single();
      if (error) {
        if (error.code === '23505') return response.status(409).json({ error: 'NOTE_EXISTS' });
        return response.status(502).json({ error: 'DATA_UNAVAILABLE' });
      }
      return response.status(201).json({ id: data.id });
    }

    if (request.method === 'GET') {
      const { data, error } = await db.from('vault_user_notes')
        .select('id,title,body,owner_id')
        .eq('id', rawId).eq('owner_id', identity.userId).maybeSingle();
      if (error) return response.status(502).json({ error: 'DATA_UNAVAILABLE' });
      // 타인의 메모는 존재 여부도 알리지 않습니다.
      if (!data || data.owner_id !== identity.userId) {
        return response.status(404).json({ error: 'NOT_FOUND' });
      }
      return response.status(200).json({ id: data.id, title: data.title, body: data.body });
    }

    if (request.method === 'PUT') {
      // 수정은 { title, body }만 허용. owner_id는 요청으로 변경할 수 없습니다.
      const fields = validNoteFields(parseBody(request));
      if (!fields) return response.status(400).json({ error: 'INVALID_NOTE' });
      const { data: before, error: readError } = await db.from('vault_user_notes')
        .select('owner_id').eq('id', rawId).maybeSingle();
      if (readError) return response.status(502).json({ error: 'DATA_UNAVAILABLE' });
      if (!before || before.owner_id !== identity.userId) {
        return response.status(404).json({ error: 'NOT_FOUND' });
      }
      // WHERE owner_id 조건으로 이전 소유권을 재확인하고, title/body만 갱신해
      // 새 행의 owner_id를 보존합니다. 결과의 소유자도 다시 확인합니다.
      const { data, error } = await db.from('vault_user_notes').update(fields)
        .eq('id', rawId).eq('owner_id', identity.userId)
        .select('id,title,body,owner_id').maybeSingle();
      if (error) return response.status(502).json({ error: 'DATA_UNAVAILABLE' });
      if (!data || data.owner_id !== identity.userId) {
        return response.status(404).json({ error: 'NOT_FOUND' });
      }
      return response.status(200).json({ id: data.id, title: data.title, body: data.body });
    }

    // 삭제도 DB의 owner_id가 검증된 사용자와 같은 행만 대상으로 합니다.
    const { data, error } = await db.from('vault_user_notes').delete()
      .eq('id', rawId).eq('owner_id', identity.userId)
      .select('id,owner_id').maybeSingle();
    if (error) return response.status(502).json({ error: 'DATA_UNAVAILABLE' });
    if (!data || data.owner_id !== identity.userId) {
      return response.status(404).json({ error: 'NOT_FOUND' });
    }
    return response.status(200).json({ id: data.id });
  } catch {
    return response.status(502).json({ error: 'DATA_UNAVAILABLE' });
  }
}
