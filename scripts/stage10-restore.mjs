#!/usr/bin/env node
// 사용법: node scripts/stage10-restore.mjs plan|restore [--confirm]|retest
import { resolve } from 'node:path';
import { fixtureRequests } from './fixture-7.mjs';
import { planPolicyRestore, restorePolicyDrill, retestRestoredPolicy } from '../src/stage10-restore.mjs';

const root = resolve(import.meta.dirname, '..');
const action = process.argv[2];
function printPlan(plan) {
  console.log('복원 실행 전 확인');
  console.log(`  검증된 백업 버전: ${plan.sourceCommit}`);
  console.log(`  백업 SHA-256: ${plan.backupSha256}`);
  console.log(`  변경 대상(시험 사본만): ${plan.target}`);
  console.log(`  기존 해시: ${plan.beforeSha256}`);
  console.log(`  복원 후 해시: ${plan.afterSha256}`);
  console.log(`  바뀔 정책: ${plan.changedLines}줄`);
  console.log(`  - ${plan.beforeLine}`);
  console.log(`  + ${plan.afterLine}`);
  console.log(`  보존: 다른 서비스 규칙, allowedRoutes ${plan.allowedRoutes}개, 기존 감사 기록, 운영 코드·DB`);
  console.log(`  감사 기록(추가만): ${plan.audit}`);
  console.log(`  DB 정책: ${plan.dbPolicyStatus} (운영 DB 실측 아님)`);
}

try {
  if (action === 'plan') {
    if (process.argv.length !== 3) throw new Error('unknown_restore_argument');
    printPlan(planPolicyRestore(root));
    console.log('미변경 · 실제 복원하려면: node scripts/stage10-restore.mjs restore --confirm');
  } else if (action === 'restore') {
    if (process.argv.length !== 3 && !(process.argv.length === 4 && process.argv[3] === '--confirm')) {
      throw new Error('unknown_restore_argument');
    }
    printPlan(planPolicyRestore(root));
    if (process.argv[3] !== '--confirm') {
      console.log('미변경 · 실행하려면 --confirm을 명시해야 합니다.');
    } else {
      const restored = restorePolicyDrill(root, { confirm: true });
      console.log(`시험 정책 복원 완료 · ${restored.target}`);
      console.log(`재검증: SHA-256 ${restored.afterSha256} · 감사 이력은 append-only`);
      const result = await retestRestoredPolicy(root, fixtureRequests().normal);
      for (const item of result) console.log(`통과 · ${item.name}`);
      console.log('가상 신원·로컬 판정 연습이며 실제 운영 DB·세션 차단 증거가 아닙니다.');
    }
  } else if (action === 'retest') {
    if (process.argv.length !== 3) throw new Error('unknown_restore_argument');
    const result = await retestRestoredPolicy(root, fixtureRequests().normal);
    for (const item of result) console.log(`통과 · ${item.name}`);
    console.log('운영 DB·실제 로그인 계정의 A/B 검사가 아닌 로컬 가상 시험입니다.');
  } else {
    throw new Error('usage: node scripts/stage10-restore.mjs plan|restore [--confirm]|retest');
  }
} catch (error) {
  console.error(`10단계 제작 2 중단 · 첫 오류: ${error.message}`);
  process.exitCode = 1;
}
