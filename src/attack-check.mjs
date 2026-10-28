// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (![1, 2, 3].includes(config.step)) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
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
  if (config.step === 3) {
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
        stepMatches = data?.step === 3;
        repoMatches = data?.repoUrl === config.repoUrl;
      } catch { /* 잘못된 JSON */ }
    }
    return [
      { attackId: 'static_note_read',
        expected: '비로그인 /data.json에서 가상 메모가 노출되지 않음',
        observed: `HTTP ${staticResponse.status}; 정적 메모 노출 ${exposed}` },
      { attackId: 'anonymous_api_note_read',
        expected: '비로그인 GET /api/notes는 401 JSON 오류, 메모 없음',
        observed: `HTTP ${apiResponse.status}; UNAUTHORIZED ${denied}; 메모 노출 ${apiExposed}` },
      { attackId: 'deployment_identity_read',
        expected: '/aleph.json 단계 3과 저장소 주소 일치',
        observed: `HTTP ${deploymentResponse.status}; 단계 일치 ${stepMatches}; 저장소 일치 ${repoMatches}` },
      { attackId: 'security_header_read',
        expected: '화면 응답 헤더 X-Content-Type-Options: nosniff',
        observed: `HTTP ${pageResponse.status}; nosniff ${pageResponse.headers.get('x-content-type-options') === 'nosniff'}` },
    ];
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
