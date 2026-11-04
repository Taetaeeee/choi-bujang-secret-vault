import { createClient } from '@supabase/supabase-js';
import { authorizeVault, sameOrigin } from '../src/vault-session.mjs';
import { getDeviceApproval, requestDeviceApproval } from '../src/device-approval.mjs';

function reply(res, code, error) { return res.status(code).json({ error }); }

export async function deviceHandler(request, response, {
  authorize = authorizeVault, makeDb = createClient,
  deviceLookup = getDeviceApproval, deviceRequest = requestDeviceApproval,
} = {}) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Vary', 'Cookie');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return reply(response, 405, 'METHOD_NOT_ALLOWED');
  }
  if (request.method === 'POST' && !sameOrigin(request)) {
    return reply(response, 403, 'ORIGIN_FORBIDDEN');
  }
  if (request.method === 'POST') {
    const body = typeof request.body === 'string' ? (() => {
      try { return JSON.parse(request.body); } catch { return null; }
    })() : request.body;
    if (!body || Object.keys(body).length !== 1 || body.action !== 'request') {
      return reply(response, 400, 'INVALID_REQUEST');
    }
  }
  const authorized = await authorize(request, response);
  if (!authorized.identity) return reply(response, authorized.status, authorized.error);
  if (authorized.identity.kind !== 'student') return reply(response, 403, 'DEVICE_APPROVAL_REQUIRED');
  const db = makeDb(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const result = request.method === 'GET'
    ? await deviceLookup(db, request, authorized.identity)
    : await deviceRequest(db, request, response, authorized.identity);
  if (result.status === 'unavailable') return reply(response, 503, 'DEVICE_APPROVAL_UNAVAILABLE');
  return response.status(200).json(result);
}

export default function handler(request, response) { return deviceHandler(request, response); }
