#!/usr/bin/env node
// node scripts/stage10-policy.mjs backup|verify|simulate|diff
import { resolve } from 'node:path';
import {
  backupPaths, comparePolicyDrill, createPolicyBackup, describeBackup,
  simulatePolicyTampering, verifyPolicyBackup,
} from '../src/stage10-policy.mjs';

const root = resolve(import.meta.dirname, '..');
const command = process.argv[2];
const printPlan = (manifest, target) => {
  console.log('실행 전 확인');
  console.log(`  복원 기준 버전: ${manifest.sourceCommit}`);
  console.log(`  정책 범위: src/decider.mjs, allowedRoutes ${manifest.allowedRoutes.values.length}개, DB 정책 README 기록`);
  console.log(`  변경 대상: ${target}`);
  console.log('  운영 코드·설정·Supabase DB: 변경하지 않음');
  console.log('  DB 정책 근거: 과거 README 기록만 확인, 실제 운영 DB 현재값 미검증');
};

try {
  if (command === 'backup') {
    const manifest = describeBackup(root);
    printPlan(manifest, 'artifacts/stage10/verified-policy.json + verified-policy.sha256 (새 파일)');
    const result = createPolicyBackup(root);
    console.log(`검증된 사본 생성: ${backupPaths(root).backup}`);
    console.log(`SHA-256: ${result.digest}`);
  } else if (command === 'verify') {
    const { manifest, digest } = verifyPolicyBackup(root);
    console.log(`사본 검증 통과 · 복원 기준: ${manifest.sourceCommit} · SHA-256: ${digest}`);
    console.log(`DB 정책: ${manifest.dbPolicy.status} (운영 DB 검증 아님)`);
  } else if (command === 'simulate') {
    const { manifest } = verifyPolicyBackup(root);
    printPlan(manifest, 'artifacts/stage10/drill/decider.mjs (시험용 사본 한 줄)');
    const diff = simulatePolicyTampering(root);
    console.log(`시험용 변조 생성: ${diff.target}`);
    console.log(`차이: ${diff.changedLines}줄 · 다음 명령: node scripts/stage10-policy.mjs diff`);
  } else if (command === 'diff') {
    const diff = comparePolicyDrill(root);
    console.log(`복원 기준: ${diff.commit}`);
    console.log(`변경 범위: ${diff.target} (원본과 운영 DB는 변경하지 않음)`);
    console.log(`- ${diff.removed}`);
    console.log(`+ ${diff.added}`);
    console.log(`변경 줄: ${diff.changedLines}`);
  } else {
    throw new Error('usage: node scripts/stage10-policy.mjs backup|verify|simulate|diff');
  }
} catch (error) {
  console.error(`10단계 제작 1 중단 · 첫 오류: ${error.message}`);
  process.exitCode = 1;
}
