// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (!Number.isInteger(config.step) || config.step < 1 || config.step > 11) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (typeof config.sampleMarker !== 'string' || !config.sampleMarker) throw new Error('가상 메모의 확인 표시를 넣어 주세요.');
  if (config.step === 3 || config.step === 4 || config.step === 5 || config.step === 6 || config.step === 7 || config.step === 8 || config.step === 9 || config.step === 10 || config.step === 11) {
    // 공개 경로에 실제 비인증 요청을 보냅니다. 토큰과 본문은 기록하지 않습니다.
    const options = { redirect: 'error', signal: AbortSignal.timeout(10000), credentials: 'omit' };
    const [staticResponse, apiResponse, deploymentResponse, pageResponse] = await Promise.all([
      fetch(new URL('/data.json', app), options),
      fetch(new URL('/api/notes', app), options),
      fetch(new URL('/aleph.json', app), options),
      fetch(app, options),
    ]);
    let exposed = false;
    if (staticResponse.ok) {
      try {
        const data = await staticResponse.json();
        exposed = data?.sampleMarker === config.sampleMarker
          || (Array.isArray(data?.notes) && data.notes.length > 0);
      } catch { /* 공개 파일 내용을 기록하지 않습니다. */ }
    }
    let denied = false;
    let apiExposed = false;
    try {
      const data = await apiResponse.json();
      denied = data?.error === 'UNAUTHORIZED';
      apiExposed = Array.isArray(data?.notes) && data.notes.length > 0;
    } catch { /* 비JSON 응답은 성공으로 기록하지 않습니다. */ }
    let stepMatches = false;
    let repoMatches = false;
    if (deploymentResponse.ok) {
      try {
        const data = await deploymentResponse.json();
        stepMatches = data?.step === config.step;
        repoMatches = typeof data?.repoUrl === 'string'
          && data.repoUrl.toLowerCase() === config.repoUrl.toLowerCase();
      } catch { /* 잘못된 JSON */ }
    }
    const checks = [
      { attackId: 'static_note_read',
        expected: '비로그인 /data.json에서 가상 메모가 노출되지 않음',
        observed: `HTTP ${staticResponse.status}; 정적 메모 노출 ${exposed}` },
      { attackId: 'anonymous_api_note_read',
        expected: '비로그인 GET /api/notes는 401 JSON 오류, 메모 없음',
        observed: `HTTP ${apiResponse.status}; UNAUTHORIZED ${denied}; 메모 노출 ${apiExposed}` },
      { attackId: 'deployment_identity_read',
        expected: '/aleph.json 현재 단계와 저장소 주소 일치',
        observed: `HTTP ${deploymentResponse.status}; 단계 일치 ${stepMatches}; 저장소 일치 ${repoMatches}` },
      { attackId: 'security_header_read',
        expected: '화면 응답 헤더 X-Content-Type-Options: nosniff',
        observed: `HTTP ${pageResponse.status}; nosniff ${pageResponse.headers.get('x-content-type-options') === 'nosniff'}` },
    ];
    if (config.step === 6 || config.step === 7 || config.step === 8 || config.step === 9 || config.step === 10 || config.step === 11) {
      // 6단계 이후: 실제 운영 접근이 아닌 엔진 형식의 로컬 가상 요청 연습입니다.
      const { decide, RULE_IDS } = await import('./decider.mjs');
      const { fixtureRequests } = await import('../scripts/fixture-7.mjs');
      const { normal } = fixtureRequests();
      const registered = await decide(normal);
      const unregistered = await decide({ ...normal, deviceRegistered: false });
      checks.push({
        attackId: 'device_registration_local_fixture',
        expected: '로컬 가상 요청에서 등록 기기 allow / approved, 미등록 기기 deny / device_not_registered',
        observed: `등록 ${registered.decision} / ${registered.reasonCode}; 미등록 ${unregistered.decision} / ${unregistered.reasonCode}; 규칙 등록 ${RULE_IDS.includes('device_registered')}`,
      });
    }
    if (config.step === 7 || config.step === 8 || config.step === 9 || config.step === 10 || config.step === 11) {
      // 7단계 이후: 운영 로그인/실제 메모 차단이 아닌 로컬 가상 사건 판정입니다.
      const { decide, RULE_IDS } = await import('./decider.mjs');
      const { fixtureRequests } = await import('../scripts/fixture-7.mjs');
      const { normal, suspicious } = fixtureRequests();
      const ordinary = await decide(normal);
      const unusual = await decide(suspicious);
      const checked = await decide({ ...suspicious,
        stepUp: { verified: true, authAgeSeconds: 60 } });
      const expired = await decide({ ...suspicious,
        stepUp: { verified: true, authAgeSeconds: 301 } });
      checks.push({
        attackId: 'step_up_local_fixture',
        expected: '가상 정상 allow, 복합 이상 step_up, 60초 확인 allow, 301초 경과 step_up',
        observed: `정상 ${ordinary.decision}; 복합 ${unusual.decision}; 60초 ${checked.decision}; 301초 ${expired.decision}; 규칙 등록 ${RULE_IDS.includes('step_up_required')}`,
      });
      const forged = await decide({ ...normal,
        signals: { ...normal.signals, source: 'client' },
        headers: { 'x-forwarded-for': '127.0.0.1' } });
      checks.push({
        attackId: 'untrusted_context_local_fixture',
        expected: '가상 클라이언트 출처와 헤더를 신뢰하지 않고 deny',
        observed: `위조 출처 ${forged.decision} / ${forged.reasonCode}; 운영 헤더 검증 미실행`,
      });
    }
    if (config.step === 8 || config.step === 9 || config.step === 10 || config.step === 11) {
      // 8단계: 판정기 구역 정책과 서버 내부 권한 함수의 가상 검증만 기록합니다.
      // 타 계정 로그인·운영 데이터 접근은 수행하지 않았으므로 성공으로 적지 않습니다.
      const { decide, RULE_IDS } = await import('./decider.mjs');
      const { fixtureRequests } = await import('../scripts/fixture-7.mjs');
      const { normal } = fixtureRequests();
      const judge = async fields => (await decide({ ...normal, ...fields })).decision;
      const note = await judge({});
      const noteList = await judge({ path: '/notes', route: 'GET /notes' });
      const notice = await judge({ service: 'notices', path: '/notices', route: 'GET /notices' });
      const writes = await Promise.all(['POST', 'PUT', 'PATCH', 'DELETE'].map(method =>
        judge({ service: 'notices', method, path: '/notices/demo', route: `${method} /notices/:id` })));
      const instructor = await judge({ service: 'instructor_materials',
        path: '/instructor-materials/demo', route: 'GET /instructor-materials/:id' });
      const exportPath = await judge({ path: '/notes/export' });
      const queryBypass = await judge({ queryLength: 8 });
      checks.push({
        attackId: 'zone_policy_local_fixture',
        expected: '가상 단건 메모 allow, 목록 deny, 공지 GET allow, 공지 쓰기·강사 자료·기능경로·쿼리 우회 deny',
        observed: `단건 ${note}; 목록 ${noteList}; 공지 ${notice}; 공지 쓰기 전체 거부 ${writes.every(x => x === 'deny')}; 강사 ${instructor}; export ${exportPath}; 쿼리 ${queryBypass}; 규칙 등록 ${RULE_IDS.includes('personal_note_read') && RULE_IDS.includes('class_notice_read')}`,
      });

      const { RESOURCE_ZONES, resourceIdFor } = await import('./resource-id.mjs');
      const sampleId = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
      const noteId = resourceIdFor(RESOURCE_ZONES.PERSONAL_NOTE, sampleId);
      const noticeId = resourceIdFor(RESOURCE_ZONES.INSTRUCTOR_NOTICE, 'notice-001');
      checks.push({
        attackId: 'resource_id_local_fixture',
        expected: '가상 개인 메모/강사 공지 자원 ID가 구역별로 구별되며 임의 구역은 미허용',
        observed: `메모 구역 ${noteId?.startsWith('personal-note:') === true}; 공지 구역 ${noticeId?.startsWith('instructor-notice:') === true}; 구역 구분 ${noteId !== noticeId}; 임의 구역 ${resourceIdFor('unknown', sampleId) === null}`,
      });

      const { verifiedApiIdentity, ownsStoredNote, ownsAllStoredNotes } = await import('./api-resource-access.mjs');
      const a = { kind: 'student', userId: sampleId };
      const b = { kind: 'student', userId: 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb' };
      const owned = { owner_id: sampleId };
      checks.push({
        attackId: 'api_owner_local_fixture',
        expected: '서버 권한 함수의 가상 본인 허용, 타인 거부, 혼합 목록 거부; 운영 A/B 직접 시험 미실행',
        observed: `검증 신원 ${verifiedApiIdentity(a)}; 본인 ${ownsStoredNote(a, owned)}; 타인 ${ownsStoredNote(b, owned)}; 혼합 목록 ${ownsAllStoredNotes(a, [owned, { owner_id: b.userId }])}; 운영 A/B 미실행`,
      });

      // 원본 자료·토큰·메모 본문 없이 익명 단건 API의 HTTP 상태만 관측합니다.
      const direct = await fetch(new URL('/api/notes/aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', app), options);
      checks.push({
        attackId: 'anonymous_single_note_read',
        expected: '비인증 GET /api/notes/:id 401; 로그인 A/B 간 소유권 실측은 별도',
        observed: `HTTP ${direct.status}; 비인증 거부 ${direct.status === 401}; 실제 A/B 교차 접근 미실행`,
      });
    }
    if (config.step === 9 || config.step === 10 || config.step === 11) {
      // 9단계: 탐지기의 출력 계약을 가상 사건으로만 점검합니다.
      // 운영 엔진의 사건 전달·실제 세션 회수는 연동하지 않으며 성공으로 기록하지 않습니다.
      const { detect } = await import('./detect.mjs');
      const start = Date.UTC(2026, 9, 1);
      const reads = (count, { subject = 'reader_fixture', everyMs = 2000 } = {}) =>
        Array.from({ length: count }, (_, i) => ({
          at: new Date(start + i * everyMs).toISOString(),
          method: 'GET', identity: { sub: subject },
        }));
      const normal = detect(reads(30));
      const boundary = detect(reads(120));
      const suspicious = detect(reads(121));
      const burst = detect(reads(200));
      const exactKeys = Object.keys(suspicious).sort().join(',') === 'action,reasonCode,subject';
      checks.push({
        attackId: 'burst_read_threshold_local_fixture',
        expected: '가상 30·120건 observe, 10분 내 121·200건 propose_revocation / burst_read; 반환 키 정확히 3개',
        observed: `30 ${normal.action}; 120 ${boundary.action}; 121 ${suspicious.action}/${suspicious.reasonCode}; 200 ${burst.action}; 출력 키 일치 ${exactKeys}; 운영 회수 미실행`,
      });

      const mixed = detect([...reads(100), ...reads(100, { subject: 'another_fixture' })]);
      const slow = detect(reads(200, { everyMs: 7000 }));
      const nonGet = detect([
        ...reads(120),
        ...reads(80).map(event => ({ ...event, method: 'POST' })),
      ]);
      checks.push({
        attackId: 'burst_read_normal_local_fixture',
        expected: '가상 정상·서로 다른 사용자·10분 밖 분산·GET 아닌 요청은 observe; 다른 기기 권한 미변경',
        observed: `혼합 ${mixed.action}; 느린 조회 ${slow.action}; GET 이외 ${nonGet.action}; 정상 키 ${Object.keys(normal).join(',')}; 운영 기기 권한 미변경`,
      });
    }
    if (config.step === 10 || config.step === 11) {
      // 10단계: 로컬 사본이 실제로 있을 때만 검증하고, 없는 환경에서는 미실행을 기록합니다.
      // 검증된 가상 메모·감사 내용, 토큰 또는 사용자의 개인 자료는 출력하지 않습니다.
      const { resolve } = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
      const { verifyPolicyBackup, requireUntouchedSources, backupPaths } =
        await import('./stage10-policy.mjs');
      const { retestRestoredPolicy } = await import('./stage10-restore.mjs');
      const { verifyRestoredVirtualBNote } = await import('./stage10-note-restore.mjs');
      const { readFileSync } = await import('node:fs');
      const { createHash } = await import('node:crypto');
      const checksum = bytes => createHash('sha256').update(bytes).digest('hex');
      let manifest;
      let verified = false;
      try {
        const result = verifyPolicyBackup(root);
        manifest = result.manifest;
        requireUntouchedSources(root, manifest);
        verified = true;
      } catch { /* 누락·변조는 검사 성공으로 기록하지 않습니다. */ }
      checks.push({
        attackId: 'stage10_policy_backup_local',
        expected: '로컬 사전 백업·SHA-256 일치, 기존 규칙·허용 경로·README DB 기록 확인; 운영 RLS 미검증',
        observed: verified
          ? `백업 검증 ${verified}; 기준 ${manifest.sourceCommit.slice(0, 12)}; 허용 경로 ${manifest.allowedRoutes.values.length}개; DB 운영 현황 미검증`
          : '미실행 또는 확인 실패: 로컬 검증된 사본/해시 필요; 운영 DB 정책 미검증',
      });
      let restoredPolicy = '미실행';
      let access = '미실행';
      if (verified) {
        try {
          const { drill } = backupPaths(root);
          restoredPolicy = checksum(readFileSync(drill)) === manifest.decider.sha256;
          if (restoredPolicy) {
            const { normal } = (await import('../scripts/fixture-7.mjs')).fixtureRequests();
            const results = await retestRestoredPolicy(root, normal);
            access = results.every(result => result.passed) ? '가상 4항목 통과' : '가상 검증 실패';
          }
        } catch { access = '미실행 또는 복원 검증 실패'; }
      }
      checks.push({
        attackId: 'stage10_restored_policy_local',
        expected: '시험 정책 원본 해시로 복원; 가상 A 정상 허용·B의 A 자료 거부·미등록 기기/다른 서비스 거부',
        observed: `시험 사본 복원 해시 ${restoredPolicy}; ${access}; 실제 운영 A/B 접근 미실행`,
      });
      let restoredNote = '미실행';
      let otherCount = '미실행';
      if (verified) {
        try {
          const result = verifyRestoredVirtualBNote(root);
          restoredNote = result.id === 'bbbbbbbb-2222-4222-8222-000000000010'
            && result.owner === 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
            && /^[a-f0-9]{64}$/u.test(result.contentSha256);
          otherCount = result.otherNotesPreserved;
        } catch { /* 로컬 사본이 없거나 검증 실패 */ }
      }
      checks.push({
        attackId: 'stage10_virtual_note_local',
        expected: '가상 B 메모 1건 ID·소유자·내용 SHA-256 사본 일치, 다른 메모·감사 기록 보존; DB 실측 아님',
        observed: `가상 B 메모 복원 ${restoredNote}; 다른 가상 메모 ${otherCount === '미실행' ? otherCount : `${otherCount}건`}; 운영 DB 복원 미실행`,
      });
      // 토큰 없이 POST만 보내며 자료와 정책을 절대로 수정하지 않습니다.
      const restoreResponse = await fetch(new URL('/api/restore', app), {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
        credentials: 'omit', headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      checks.push({
        attackId: 'stage10_anonymous_restore_post',
        expected: '비로그인 POST /api/restore는 복원 불가(401 또는 사본 미배포 시 503); 운영 실제 복원 미실행',
        observed: `HTTP ${restoreResponse.status}; 비로그인 복원 불가 ${[401, 403, 503].includes(restoreResponse.status)}; 운영 데이터 복원 미실행`,
      });
    }
    if (config.step === 11) {
      // 설치 자료와 비로그인 기기 API만 실측합니다. 승인된 계정의 쿠키·개인 자료는 읽지 않습니다.
      const [manifestResponse, deviceResponse] = await Promise.all([
        fetch(new URL('/manifest.webmanifest', app), options),
        fetch(new URL('/api/device', app), options),
      ]);
      let manifestValid = false;
      if (manifestResponse.ok) {
        try {
          const manifest = await manifestResponse.json();
          const icons = Array.isArray(manifest?.icons) ? manifest.icons : [];
          manifestValid = manifest.name === 'BYTE BACK 내 자료실'
            && manifest.start_url === '/' && manifest.scope === '/'
            && manifest.display === 'standalone'
            && ['192x192', '512x512'].every(size => icons.some(icon =>
              icon.sizes === size && icon.type === 'image/png'));
        } catch { /* Manifest 형식 오류는 통과로 기록하지 않습니다. */ }
      }
      checks.push({
        attackId: 'stage11_public_manifest',
        expected: '배포 Manifest에 접속 앱 이름·독립 실행·192/512 아이콘 포함; 설치만으로 기기 승인하지 않음',
        observed: `HTTP ${manifestResponse.status}; Manifest 형식 일치 ${manifestValid}; 실제 설치·승인 별도`,
      });
      let deviceDenied = false;
      try {
        const data = await deviceResponse.json();
        deviceDenied = deviceResponse.status === 401 && data?.error === 'UNAUTHORIZED';
      } catch { /* 오류 본문을 출력하지 않습니다. */ }
      checks.push({
        attackId: 'stage11_unauthenticated_device',
        expected: '비로그인 GET /api/device는 401 UNAUTHORIZED; 승인 전후 실계정 요청은 별도 운영 확인',
        observed: `HTTP ${deviceResponse.status}; 비로그인 거부 ${deviceDenied}; 실제 A/B 교차 접근 자동 검사 미실행`,
      });
    }
    if (config.step === 5 || config.step === 6 || config.step === 7 || config.step === 8 || config.step === 9 || config.step === 10 || config.step === 11) {
      // 공개 키로 원본 Data API에 직접 접근하는 실제 비인증 요청입니다.
      // 키나 API 응답 본문은 제출 결과와 로그에 포함하지 않습니다.
      const original = new URL(config.originalApiUrl);
      const issuer = new URL(config.identityProvider?.issuer ?? '');
      if (original.protocol !== 'https:' || original.origin !== issuer.origin
          || original.pathname !== '/rest/v1/vault_user_notes'
          || original.search || original.hash || original.username || original.password) {
        throw new Error('originalApiUrl의 HTTPS 원본 자료 경로를 확인해 주세요.');
      }
      const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
      if (typeof publishable !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]+$/u.test(publishable)) {
        throw new Error('5단계 직접 점검에 사용할 Supabase 공개 키를 찾지 못했습니다.');
      }
      const originalResponse = await fetch(original, {
        redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { apikey: publishable },
      });
      checks.push({
        attackId: 'direct_original_api_read',
        expected: 'anon 공개 키로 원본 메모 API에 직접 요청 시 401 또는 403으로 거부됨',
        observed: `HTTP ${originalResponse.status}; 직접 접근 차단 ${[401, 403].includes(originalResponse.status)}`,
      });
    }
    return checks;
  }
  if (config.step === 2) {
    const staticResponse = await fetch(new URL('/data.json', app), {
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      credentials: 'omit',
    });

    let staticVisible = false;
    if (staticResponse.ok) {
      try {
        const data = await staticResponse.json();
        staticVisible = data?.sampleMarker === config.sampleMarker
          && Array.isArray(data.notes) && data.notes.length > 0;
      } catch {
        // Do not reveal response bodies.
      }
    }

    const apiResponse = await fetch(new URL('/api/notes', app), {
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      credentials: 'omit',
    });

    let noteCount = 0;
    let markerMatches = false;

    if (apiResponse.ok) {
      try {
        const data = await apiResponse.json();
        markerMatches = data?.sampleMarker === config.sampleMarker;
        noteCount = Array.isArray(data?.notes) ? data.notes.length : 0;
      } catch {
        // Do not reveal response bodies.
      }
    }

    return [
      {
        attackId: 'static_note_read',
        expected: '비로그인 정적 /data.json은 메모를 제공하지 않음',
        observed: `HTTP ${staticResponse.status}; 정적 메모 확인 표시 ${staticVisible ? '노출' : '없음'}`,
      },
      {
        attackId: 'anonymous_api_note_read',
        expected: '비로그인 /api/notes에서 가상 메모 4건을 읽을 수 있음',
        observed: `HTTP ${apiResponse.status}; 가상 메모 ${noteCount}건; 확인 표시 일치 ${markerMatches}`,
      },
    ];
  }

  const response = await fetch(new URL('/data.json', app), {
    redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  let visible = false;
  if (response.ok) {
    try {
      const data = await response.json();
      visible = data?.sampleMarker === config.sampleMarker && Array.isArray(data.notes)
        && data.notes.length > 0;
    } catch {
      // A non-JSON response is a failed check, not a successful deployment.
    }
  }
  return [{ attackId: 'anonymous_note_read', expected: '비로그인 화면에서 가상 메모를 확인',
    observed: visible ? '비로그인 요청에서 공개 가상 메모 확인 표시가 보임' : `비로그인 요청에서 확인 표시가 보이지 않음 (HTTP ${response.status})` }];
}
