// POST /api/restore: private virtual B memo only. No operational Supabase writes.
import { resolve } from 'node:path';
import config from '../aleph.config.json' with { type: 'json' };
import { createVirtualNoteRestoreHandler } from '../src/stage10-note-restore.mjs';

const root = resolve(import.meta.dirname, '..');
let verifier;
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  // 이 단계는 비공개 로컬 사본으로만 실습합니다. Vercel에 파일이 없으면 fail-closed.
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return response.status(503).json({ error: 'RESTORE_NOT_AVAILABLE' });
  try {
    if (!verifier) {
      const { createLoginVerifier } = await import('../src/verify-login.mjs');
      verifier = createLoginVerifier({ config, supabaseSecretKey: key });
    }
    return createVirtualNoteRestoreHandler({ root, verifyIdentity: verifier })(request, response);
  } catch {
    return response.status(503).json({ error: 'RESTORE_NOT_AVAILABLE' });
  }
}
