#!/usr/bin/env node
// 사용법: node scripts/stage10-note.mjs prepare|plan|post|verify
// post는 127.0.0.1에서 시험용 B 신원으로 POST 핸들러를 호출하며, 운영 DB에 접근하지 않습니다.
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import {
  createVirtualNoteRestoreHandler, planVirtualNoteRestore, prepareVirtualBNote,
  RESTORE_NOTE_ID, RESTORE_ROUTE, RESTORE_SERVICE, TEST_B_ID, verifyRestoredVirtualBNote,
} from '../src/stage10-note-restore.mjs';

const root = resolve(import.meta.dirname, '..');
const action = process.argv[2];
const allowed = ['prepare', 'plan', 'post', 'verify'];
const print = result => {
  console.log(`  서비스·경로: ${RESTORE_SERVICE} · ${RESTORE_ROUTE}`);
  console.log(`  복원 대상 ID: ${result.id}`);
  console.log(`  소유자(가상 시험 B): ${result.owner ?? TEST_B_ID}`);
  console.log(`  내용 SHA-256: ${result.contentSha256}`);
};

async function runLocalPost() {
  const token = randomBytes(32).toString('hex'); // 콘솔·파일에는 저장하지 않습니다.
  const verifyIdentity = authorization => {
    const candidate = typeof authorization === 'string' ? authorization : '';
    const received = Buffer.from(candidate, 'utf8');
    const expected = Buffer.from(`Bearer ${token}`, 'utf8');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    return { kind: 'student', userId: TEST_B_ID };
  };
  const handler = createVirtualNoteRestoreHandler({ root, verifyIdentity });
  const server = createServer(async (request, response) => {
    const json = (status, body) => {
      response.statusCode = status;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(body));
    };
    response.status = status => ({ json: data => json(status, data) });
    if (request.url !== '/api/restore') return json(404, { error: 'NOT_FOUND' });
    let body = '';
    for await (const chunk of request) {
      body += chunk.toString('utf8');
      if (body.length > 2048) return json(413, { error: 'INVALID_REQUEST' });
    }
    request.body = body;
    await handler(request, response);
  });
  await new Promise((ok, bad) => {
    server.once('error', bad);
    server.listen(0, '127.0.0.1', ok);
  });
  try {
    const address = server.address();
    const result = await fetch(`http://127.0.0.1:${address.port}/api/restore`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: RESTORE_NOTE_ID }),
    });
    const response = await result.json();
    if (result.status !== 200 || response.restored !== true) {
      throw new Error(`virtual_post_failed_${result.status}_${response.error ?? 'unknown'}`);
    }
    return response;
  } finally { await new Promise(ok => server.close(ok)); }
}

try {
  if (!allowed.includes(action) || process.argv.length !== 3) {
    throw new Error('usage: node scripts/stage10-note.mjs prepare|plan|post|verify');
  }
  if (action === 'prepare') {
    console.log('사전 확인 · 비공개 가상 메모 1건 백업 + 시험 사본 생성');
    console.log(`  대상: ${RESTORE_NOTE_ID} · 소유자 B: ${TEST_B_ID}`);
    console.log('  변경: artifacts/stage10/private/ 및 drill/virtual-notes.json 새 파일만');
    console.log('  보존: 기존 감사 기록·다른 메모·운영 Supabase DB·실제 정책');
    const result = prepareVirtualBNote(root);
    print(result);
    console.log(`백업 자체 SHA-256: ${result.backupSha256}`);
  } else if (action === 'plan') {
    console.log('복원 실행 전 확인 · 아직 변경하지 않음');
    const plan = planVirtualNoteRestore(root);
    print({ id: plan.id, owner: plan.owner, contentSha256: plan.afterSha256 });
    console.log(`  기준 커밋: ${plan.sourceCommit}`);
    console.log(`  사본 SHA-256: ${plan.backupSha256}`);
    console.log(`  변조 메모 해시: ${plan.beforeSha256}`);
    console.log(`  복원 대상: ${plan.target} (ID 한 건)`);
    console.log(`  보존: 다른 메모 ${plan.otherNotes}건 · 기존 ${plan.audit}`);
    console.log('  실행: node scripts/stage10-note.mjs post');
  } else if (action === 'post') {
    const plan = planVirtualNoteRestore(root);
    console.log('로컬 POST 복원 사전 확인');
    print({ id: plan.id, owner: plan.owner, contentSha256: plan.afterSha256 });
    console.log(`  변경 범위: ${plan.target}의 B 대상 한 건 · 다른 메모 ${plan.otherNotes}건 보존`);
    console.log('  운영 Supabase DB 변경 없음 / 127.0.0.1에서 시험용 B 인증만 사용');
    const result = await runLocalPost();
    const verified = verifyRestoredVirtualBNote(root);
    if (result.contentSha256 !== verified.contentSha256 || result.id !== verified.id
        || result.owner !== verified.owner) throw new Error('post_restore_verification_failed');
    console.log('POST 200 · 복원 완료 · ID·소유자·내용 SHA-256 일치');
    console.log(`다른 가상 메모 ${verified.otherNotesPreserved}건 및 감사 이력 보존`);
  } else {
    const result = verifyRestoredVirtualBNote(root);
    print(result);
    console.log(`복원 검증 통과 · 다른 가상 메모 ${result.otherNotesPreserved}건`);
  }
} catch (error) {
  console.error(`10단계 제작 3 중단 · 첫 오류: ${error.message}`);
  process.exitCode = 1;
}
