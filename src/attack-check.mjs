// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (config.step !== 1 && config.step !== 2) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
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
