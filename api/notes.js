import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from '../src/verify-login.mjs';

// 3단계 제작 3: 서버에서 검증한 신원만 사용합니다.
// 4단계에서 개별 메모 GET/PUT/DELETE에 owner_id 검사를 추가할 예정입니다.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
let verifyLogin;

function validNoteFields(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
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
      // 목록만 로그인한 사람의 owner_id로 제한합니다.
      const [owned, samples] = await Promise.all([
        db.from('vault_user_notes').select('id,title,body')
          .eq('owner_id', identity.userId).order('created_at', { ascending: false }),
        // 이전 2단계의 가상 메모 4건은 읽기 전용 예시로 유지합니다.
        db.from('vault_notes').select('id,title,content').is('owner_id', null)
          .in('id', [1, 2, 3, 4]).order('id', { ascending: true }),
      ]);
      if (owned.error || samples.error || !Array.isArray(owned.data)
          || !Array.isArray(samples.data) || samples.data.length !== 4) {
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
      const fields = validNoteFields(payload);
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
      // 3단계 의도된 허점: 한 건 조회에는 소유자 필터가 없습니다.
      const { data, error } = await db.from('vault_user_notes').select('id,title,body')
        .eq('id', rawId).maybeSingle();
      if (error) return response.status(502).json({ error: 'DATA_UNAVAILABLE' });
      if (!data) return response.status(404).json({ error: 'NOT_FOUND' });
      return response.status(200).json(data);
    }

    if (request.method === 'PUT') {
      const fields = validNoteFields(parseBody(request));
      if (!fields) return response.status(400).json({ error: 'INVALID_NOTE' });
      // 4단계에서 반드시 owner_id = identity.userId 조건을 추가해야 합니다.
      const { data, error } = await db.from('vault_user_notes').update(fields)
        .eq('id', rawId).select('id,title,body').maybeSingle();
      if (error) return response.status(502).json({ error: 'DATA_UNAVAILABLE' });
      if (!data) return response.status(404).json({ error: 'NOT_FOUND' });
      return response.status(200).json(data);
    }

    // DELETE 또한 3단계에서는 owner_id를 확인하지 않습니다.
    const { data, error } = await db.from('vault_user_notes').delete()
      .eq('id', rawId).select('id').maybeSingle();
    if (error) return response.status(502).json({ error: 'DATA_UNAVAILABLE' });
    if (!data) return response.status(404).json({ error: 'NOT_FOUND' });
    return response.status(200).json({ id: data.id });
  } catch {
    return response.status(502).json({ error: 'DATA_UNAVAILABLE' });
  }
}
