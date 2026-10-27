import { createClient } from '@supabase/supabase-js';

// 2단계: 서버가 학습용 DB에서 가상 메모만 읽습니다.
// 로그인 검사는 3단계 과제로 남깁니다. 이 API는 누구나 요청할 수 있습니다.
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    return response.status(503).json({ error: 'SERVICE_UNAVAILABLE' });
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
