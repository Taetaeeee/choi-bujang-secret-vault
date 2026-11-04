// 12단계 제작 1: 서버에서 확인한 최소 기록만 돌려줍니다.
// null은 0건이 아니라 운영 실행 기록이 연결되지 않았다는 뜻입니다.
import { RULE_IDS } from './decider.mjs';

// README 10단계 저장점의 과거 로컬 정책 백업 기준. 운영 복구 버전이 아닙니다.
export const DOCUMENTED_STAGE10_BACKUP_COMMIT = 'e6334b2060886d836e6b9da11609d1afa2fabbaf';

export function operationsSummary({ observedAt = new Date().toISOString() } = {}) {
  const ruleIds = [...RULE_IDS];
  // 화면 수치와 가린 서버 기록은 반드시 이 단일 record를 사용합니다.
  return {
    schema: 'aleph.operations.summary.v1',
    observedAt,
    redaction: 'private_fields_omitted',
    record: {
      deviceApproval: {
        status: 'observed', value: 'approved',
        source: 'Supabase vault_device_approvals (현재 요청 기기 서버 조회)',
      },
      decision: {
        source: 'student src/decider.mjs RULE_IDS',
        registeredRuleCount: ruleIds.length,
        registeredRuleIds: ruleIds,
        operationalDecision: 'not_observed',
      },
      detection: {
        source: 'student src/detect.mjs; 운영 사건 피드 미연결',
        operationalEvents: 'not_observed',
        operationalEventCount: null,
      },
      revocation: {
        source: '탐지기의 회수 제안과 실제 엔진 집행은 별개',
        operationalExecution: 'not_observed',
        completedCount: null,
      },
      recovery: {
        source: 'README 10단계 로컬 가상 정책 백업 기록',
        historicalBaselineCommit: DOCUMENTED_STAGE10_BACKUP_COMMIT,
        liveVerifiedVersion: null,
        operationalRestore: 'not_observed',
      },
    },
  };
}
