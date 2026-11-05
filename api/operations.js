// 12단계 제작 1: 승인 기기만 조회할 수 있는 읽기 전용 요약 API.
// 판정 실행·회수·복구를 수행하지 않으며 원본 메모/신원/토큰을 읽거나 응답에 포함하지 않습니다.
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { authorizeVault } from '../src/vault-session.mjs';
import { getDeviceApproval } from '../src/device-approval.mjs';
import { operationsSummary } from '../src/operations-summary.mjs';

export async function operationsHandler(request, response, {
  authorize = authorizeVault, makeDb = createClient,
  deviceLookup = getDeviceApproval, makeSummary = operationsSummary,
} = {}) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Vary', 'Cookie, Authorization');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  const observedAt = new Date().toISOString();
  response.setHeader('X-Request-ID', randomUUID());
  response.setHeader('X-Observed-At', observedAt);
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const auth = await authorize(request, response);
    if (!auth?.identity) {
      return response.status(auth?.status ?? 401).json({ error: auth?.error ?? 'UNAUTHORIZED' });
    }
    if (auth.identity.kind !== 'student') {
      return response.status(403).json({ error: 'FORBIDDEN' });
    }
    const db = makeDb(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const approval = await deviceLookup(db, request, auth.identity);
    if (approval?.status === 'unavailable') {
      return response.status(503).json({ error: 'DEVICE_APPROVAL_UNAVAILABLE' });
    }
    if (approval?.status !== 'approved') {
      return response.status(403).json({ error: 'DEVICE_NOT_APPROVED' });
    }
    return response.status(200).json(makeSummary({ observedAt }));
  } catch {
    // 외부 오류·DB 메시지·토큰을 오류 응답으로 반사하지 않습니다.
    return response.status(503).json({ error: 'OPERATIONS_UNAVAILABLE' });
  }
}

export default function handler(request, response) {
  return operationsHandler(request, response);
}
