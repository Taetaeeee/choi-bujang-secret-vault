import { createClient } from '@supabase/supabase-js';
import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from '../src/verify-login.mjs';

// 3단계: 검증된 Bearer 토큰이 있는 요청만 가상 메모를 읽습니다.
// 학생 신원과 심판 신원은 시작 틀의 검증 도우미가 확인합니다.
let verifyLogin;
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  // 요청 본문/쿼리의 userId·role 대신 Authorization 헤더만 검사합니다.
  const authorization = request.headers?.authorization;
  if (!authorization) {
    return response.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    return response.status(503).json({ error: 'SERVICE_UNAVAILABLE' });
  }

  let verifiedIdentity;
  try {
    verifyLogin ??= createLoginVerifier({ config, supabaseSecretKey: secretKey });
    verifiedIdentity = await verifyLogin(authorization);
  } catch {
    return response.status(401).json({ error: 'UNAUTHORIZED' });
  }
  if (!verifiedIdentity) {
    return response.status(401).json({ error: 'UNAUTHORIZED' });
  }

  try {
    const db = createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const { data, error } = await db
      .from('vault_notes')
      .select('id,title,content')
      .is('owner_id', null)
      .in('id', [1, 2, 3, 4])
      .order('id', { ascending: true });

    if (error || !Array.isArray(data) || data.length !== 4 || data.some(
      note => typeof note.title !== 'string' || typeof note.content !== 'string',
    )) {
      return response.status(502).json({ error: 'DATA_UNAVAILABLE' });
    }

    return response.status(200).json({
      sampleMarker: 'SAMPLE_NOTE_1',
      notes: data.map(({ title, content }) => ({ title, content })),
    });
  } catch {
    // SDK 오류/환경변수/키/DB 응답은 브라우저 응답 및 로그로 내보내지 않습니다.
    return response.status(502).json({ error: 'DATA_UNAVAILABLE' });
  }
}
