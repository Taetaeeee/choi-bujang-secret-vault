// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
export function createStudentView() {
  return {
    renderIdentity({ me, devices, sessions } = {}) {
      const root = document.createElement('div');

      const deviceLabels = {
        compliant: '보안 기준 충족',
        noncompliant: '보안 기준 미충족',
        unknown: '확인 불가',
      };
      const sessionLabels = {
        active: '활성',
        expired: '만료',
        revoked: '철회됨',
        unknown: '확인 불가',
      };
      const modeLabels = {
        demo: '예제 자료',
        disconnected: '연결 없음',
        unknown: '확인 불가',
      };

      function valueOrUnknown(value) {
        return (typeof value === 'string' && value.trim()) || typeof value === 'number'
          ? String(value)
          : '확인 불가';
      }

      function addText(parent, tag, value) {
        const node = document.createElement(tag);
        node.textContent = value;
        parent.appendChild(node);
        return node;
      }

      function addFields(parent, fields) {
        const list = document.createElement('dl');
        list.className = 'kv';
        for (const [label, value] of fields) {
          addText(list, 'dt', label);
          addText(list, 'dd', value);
        }
        parent.appendChild(list);
      }

      function showResource(title, resource, showData) {
        const section = document.createElement('section');
        addText(section, 'h3', title);
        const mode = resource?.mode;
        if (Object.hasOwn(modeLabels, mode)) {
          addText(section, 'p', `연결 상태: ${modeLabels[mode]}`);
        }
        if (resource?.status === 'loading') {
          addText(section, 'p', '불러오는 중');
        } else if (resource?.status === 'error') {
          const message = valueOrUnknown(resource.error?.message);
          addText(section, 'p', `연결 실패: ${message}`);
        } else if (resource?.status === 'ok') {
          showData(section, resource.data);
        } else {
          addText(section, 'p', '확인 불가');
        }
        root.appendChild(section);
      }

      showResource('현재 계정·기기·세션', me, (section, data) => {
        addFields(section, [
          ['사용자 이름', valueOrUnknown(data?.user?.label)],
          ['사용자 ID', valueOrUnknown(data?.user?.id)],
          ['현재 기기 이름', valueOrUnknown(data?.device?.label)],
          ['현재 기기 ID', valueOrUnknown(data?.device?.id)],
          ['현재 기기 보안 상태', deviceLabels[data?.device?.status] ?? deviceLabels.unknown],
          ['현재 세션 ID', valueOrUnknown(data?.session?.id)],
          ['현재 세션 상태', sessionLabels[data?.session?.status] ?? sessionLabels.unknown],
        ]);
      });

      showResource('기기 목록', devices, (section, data) => {
        if (!Array.isArray(data) || data.length === 0) {
          addText(section, 'p', '표시할 기기 정보가 없습니다.');
          return;
        }
        const list = document.createElement('ul');
        for (const device of data) {
          const item = document.createElement('li');
          addFields(item, [
            ['기기 이름', valueOrUnknown(device?.label)],
            ['기기 ID', valueOrUnknown(device?.id)],
            ['기기 보안 상태', deviceLabels[device?.status] ?? deviceLabels.unknown],
          ]);
          list.appendChild(item);
        }
        section.appendChild(list);
      });

      showResource('로그인 세션 목록', sessions, (section, data) => {
        if (!Array.isArray(data) || data.length === 0) {
          addText(section, 'p', '표시할 로그인 세션 정보가 없습니다.');
          return;
        }
        const list = document.createElement('ul');
        for (const session of data) {
          const item = document.createElement('li');
          addFields(item, [
            ['세션 ID', valueOrUnknown(session?.id)],
            ['세션 상태', sessionLabels[session?.status] ?? sessionLabels.unknown],
          ]);
          list.appendChild(item);
        }
        section.appendChild(list);
      });

      return root;
    },
    renderDecision({ status, mode, data, error, appId } = {}) {
      const root = document.createElement('div');
      const labels = {
        allow: '접근 허용',
        deny: '접근 거부',
        challenge: '추가 확인 필요',
        unknown: '판정 확인 불가',
      };
      const modes = {
        demo: '예제 자료',
        disconnected: '연결 없음',
        unknown: '확인 불가',
      };

      function displayValue(value) {
        if (typeof value === 'string' && value.trim()) return value;
        if (typeof value === 'number' && Number.isFinite(value)) return String(value);
        return '확인 불가';
      }

      function addText(parent, tag, message) {
        const element = document.createElement(tag);
        element.textContent = message;
        parent.appendChild(element);
        return element;
      }

      addText(root, 'h3', '업무 앱 접근 판정');
      if (Object.hasOwn(modes, mode)) {
        addText(root, 'p', `연결 상태: ${modes[mode]}`);
      }

      if (status === 'idle') {
        addText(root, 'p', '앱을 골라 접속을 요청하세요.');
        return root;
      }

      const requestedAppId = status === 'ok' ? data?.appId ?? appId : appId;
      addText(root, 'p', `업무 앱 ID: ${displayValue(requestedAppId)}`);

      if (status === 'loading') {
        addText(root, 'p', '판정 확인 중');
        return root;
      }

      if (status === 'error') {
        addText(root, 'p', `요청 실패: ${displayValue(error?.message)}`);
        addText(root, 'p', '요청 실패는 서버의 접근 거부(deny) 판정이 아닙니다.');
        return root;
      }

      if (status !== 'ok') {
        addText(root, 'p', '판정 확인 불가(unknown) — 접근 허용으로 간주하지 않습니다.');
        return root;
      }

      const code = typeof data?.decision === 'string' && Object.hasOwn(labels, data.decision)
        ? data.decision
        : 'unknown';
      addText(root, 'p', `접근 판정: ${labels[code]}(${code})`);

      if (code === 'allow') {
        addText(root, 'p', '정책상 접근 허용이며 실제 업무 앱 접속 성공을 보장하지 않습니다.');
      } else if (code === 'challenge') {
        addText(root, 'p', '추가 인증 또는 확인이 필요합니다. 케셰브는 이 확인 절차를 대신 수행하지 않습니다.');
      } else if (code === 'unknown') {
        addText(root, 'p', '판정을 확인할 수 없으므로 접근 허용으로 간주하지 않습니다.');
      }

      const details = document.createElement('dl');
      details.className = 'kv';
      addText(details, 'dt', '판정 이유');
      addText(details, 'dd', displayValue(data?.reason));
      addText(details, 'dt', '판정 시각');
      addText(details, 'dd', displayValue(data?.checkedAt));
      root.appendChild(details);
      return root;
    },
    renderEvents({ status, mode, data, error } = {}) {
      const root = document.createElement('div');
      const modeLabels = {
        demo: '예제 자료',
        disconnected: '연결 없음',
        unknown: '확인 불가',
      };
      const kindLabels = { access: '접속 기록', xdr: 'XDR 경보' };
      const stateLabels = {
        access: { allowed: '접근 허용', denied: '접근 거부', unknown: '확인 불가' },
        session: { active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가' },
        device: { compliant: '보안 기준 충족', noncompliant: '보안 기준 미충족', unknown: '확인 불가' },
      };

      function addText(parent, tag, value) {
        const element = document.createElement(tag);
        element.textContent = value;
        parent.appendChild(element);
        return element;
      }

      function displayValue(value, fallback = '확인 불가') {
        return typeof value === 'string' && value.trim() ? value : fallback;
      }

      function stateText(category, raw) {
        const labels = stateLabels[category];
        const code = typeof raw === 'string' && Object.hasOwn(labels, raw) ? raw : 'unknown';
        return `${labels[code]}(${code})`;
      }

      function appendDetailList(parent, title, entries) {
        const block = document.createElement('section');
        addText(block, 'h5', title);
        if (!Array.isArray(entries) || entries.length === 0) {
          addText(block, 'p', '없음');
        } else {
          const list = document.createElement('ul');
          for (const entry of entries) {
            addText(list, 'li', `${displayValue(entry?.id)} — ${displayValue(entry?.text, '내용 없음')}`);
          }
          block.appendChild(list);
        }
        parent.appendChild(block);
      }

      function buildDetail(event) {
        const detail = document.createElement('section');
        detail.setAttribute('data-student-event-detail', event.id);
        addText(detail, 'h4', `${event.id} 상세`);
        const fields = document.createElement('dl');
        fields.className = 'kv';
        const pairs = [
          ['사건 ID', event.id],
          ['업무 앱 ID', displayValue(event.appId, '앱 확인 불가')],
          ['접속 상태', stateText('access', event.state?.access)],
          ['세션 상태', stateText('session', event.state?.session)],
          ['기기 상태', stateText('device', event.state?.device)],
        ];
        for (const [label, value] of pairs) {
          addText(fields, 'dt', label);
          addText(fields, 'dd', value);
        }
        detail.appendChild(fields);
        appendDetailList(detail, '근거(evidence)', event.evidence);
        appendDetailList(detail, '규칙(rules)', event.rules);
        // 원천에서 조치 식별자를 전달한 경우에만 안내한다. 이 버튼은 절대 요청하지 않는다.
        if (Array.isArray(event.supportedActions) && event.supportedActions.length > 0) {
          const unsupported = document.createElement('section');
          addText(unsupported, 'h5', '미지원 조치');
          for (const action of event.supportedActions) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = `${action} 미지원`;
            button.disabled = true;
            unsupported.appendChild(button);
          }
          addText(unsupported, 'p', '조치 실행 연결은 준비 중입니다. 이 버튼은 비활성 상태이며 조치 요청을 전송하지 않습니다.');
          detail.appendChild(unsupported);
        }
        return detail;
      }

      addText(root, 'h3', '내 접속 기록·XDR 경보');
      if (Object.hasOwn(modeLabels, mode)) {
        addText(root, 'p', `연결 상태: ${modeLabels[mode]}`);
      }
      if (status === 'loading') {
        addText(root, 'p', '보안 기록 불러오는 중');
        return root;
      }
      if (status === 'error') {
        if (error?.code === 'CONTRACT_MISMATCH') {
          addText(root, 'p', '기록 확인 불가: 서버 응답 형식이 일치하지 않습니다.');
        }
        addText(root, 'p', `기록을 불러오지 못했습니다: ${displayValue(error?.message)}`);
        return root;
      }
      if (status !== 'ok' || !Array.isArray(data)) {
        addText(root, 'p', '기록 확인 불가: 응답을 확인할 수 없습니다.');
        return root;
      }

      // 받은 배열과 행을 수정하지 않고 사본만 정렬·필터링한다.
      const records = [...data].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      if (records.length === 0) {
        addText(root, 'p', '표시할 기록이 없습니다.');
        return root;
      }
      addText(root, 'p', '현재 등록 정보와 대조된 본인의 최근 기록(최대 40건)만 표시합니다. XDR 경보는 기존에 저장된 사건이며 새 탐지를 수행하지 않습니다.');

      const filters = { kind: 'all', appId: 'all', access: 'all' };
      const filterArea = document.createElement('div');
      const results = document.createElement('div');
      root.appendChild(filterArea);
      root.appendChild(results);

      function addFilter(title, key, values, describe) {
        const label = document.createElement('label');
        label.textContent = `${title} `;
        const select = document.createElement('select');
        select.setAttribute('aria-label', title);
        const all = document.createElement('option');
        all.value = 'all';
        all.textContent = '전체';
        select.appendChild(all);
        for (const raw of values) {
          const option = document.createElement('option');
          option.value = raw;
          option.textContent = describe(raw);
          select.appendChild(option);
        }
        select.value = 'all';
        select.addEventListener('change', () => {
          filters[key] = select.value;
          renderRows();
        });
        label.appendChild(select);
        filterArea.appendChild(label);
      }

      // appId가 없는 옛 사건은 '전체' 목록에 남긴다. 필터 값으로 가짜 앱 ID를 만들지 않는다.
      const kinds = [...new Set(records.map((event) => event.kind))];
      const apps = [...new Set(records.map((event) => event.appId).filter((value) => typeof value === 'string' && value.length > 0))];
      const accesses = [...new Set(records.map((event) => event.state?.access).filter((value) => typeof value === 'string'))];
      addFilter('기록 종류', 'kind', kinds, (raw) => `${kindLabels[raw] ?? '확인 불가'}(${raw})`);
      addFilter('업무 앱', 'appId', apps, (raw) => raw);
      addFilter('접속 상태', 'access', accesses, (raw) => stateText('access', raw));

      function renderRows() {
        // 필터 적용 또는 새 자료 렌더링 때 이전 상세 선택도 지운다.
        results.replaceChildren();
        const matches = records.filter((event) =>
          (filters.kind === 'all' || event.kind === filters.kind)
          && (filters.appId === 'all' || event.appId === filters.appId)
          && (filters.access === 'all' || event.state?.access === filters.access));
        addText(results, 'p', `필터 결과 ${matches.length}건 / 현재 받은 기록 ${records.length}건`);
        if (matches.length === 0) {
          addText(results, 'p', '선택한 조건에 해당하는 기록이 없습니다.');
          return;
        }
        const list = document.createElement('ul');
        let openedButton = null;
        let openedDetail = null;
        for (const event of matches) {
          const item = document.createElement('li');
          item.setAttribute('data-student-event-id', event.id);
          addText(item, 'p', `사건 ID: ${event.id}`);
          addText(item, 'p', `발생 시각: ${event.at}`);
          addText(item, 'p', `종류: ${kindLabels[event.kind] ?? '확인 불가'}(${displayValue(event.kind)})`);
          addText(item, 'p', `업무 앱: ${displayValue(event.appId, '앱 확인 불가')}`);
          addText(item, 'p', `요약: ${displayValue(event.summary, '요약 없음')}`);
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = `${event.id} 상세`;
          button.setAttribute('aria-expanded', 'false');
          button.addEventListener('click', () => {
            const alreadyOpen = openedButton === button;
            if (openedDetail !== null) openedDetail.remove();
            if (openedButton !== null) openedButton.setAttribute('aria-expanded', 'false');
            openedButton = null;
            openedDetail = null;
            if (!alreadyOpen) {
              const detail = buildDetail(event);
              item.appendChild(detail);
              button.setAttribute('aria-expanded', 'true');
              openedButton = button;
              openedDetail = detail;
            }
          });
          item.appendChild(button);
          list.appendChild(item);
        }
        results.appendChild(list);
      }

      renderRows();
      return root;
    },
    renderStatus({ devices, sessions, notifications, diagnostics, mode } = {}) {
      const root = document.createElement('div');
      const modeLabels = {
        connected: '연결됨', demo: '예제 자료', disconnected: '연결 없음', unknown: '확인 불가',
      };
      const deviceLabels = {
        compliant: '보안 기준 충족', noncompliant: '보안 기준 미충족', unknown: '확인 불가',
      };
      const sessionLabels = {
        active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가',
      };
      const secretPattern = /(?:Bearer\s+\S+|sk-(?:proj-|ant-|svcacct-)?[A-Za-z0-9_-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_ -]?key|authorization|password|비밀번호|토큰)\s*[:=]\s*\S+)/i;

      function safeValue(value) {
        if (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))) return '확인 불가';
        const result = String(value).trim();
        if (!result) return '확인 불가';
        if (result.length > 200 || secretPattern.test(result)) return '민감 정보 제외';
        return result;
      }

      function addText(parent, tag, value) {
        const element = document.createElement(tag);
        element.textContent = value;
        parent.appendChild(element);
        return element;
      }

      function statusText(labels, raw) {
        const code = typeof raw === 'string' && Object.hasOwn(labels, raw) ? raw : 'unknown';
        return `${labels[code]}(${code})`;
      }

      function retryMessage(section) {
        addText(section, 'p', '다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요. 자동 재요청은 하지 않습니다.');
      }

      function renderCollection(title, resource, emptyMessage, labels, idKey) {
        const section = document.createElement('section');
        addText(section, 'h4', title);
        root.appendChild(section);
        if (resource?.status === 'loading') {
          addText(section, 'p', `${title} 불러오는 중`);
          return;
        }
        if (resource?.status === 'error') {
          const code = safeValue(resource.error?.code);
          const message = safeValue(resource.error?.message);
          const timedOut = /(?:time.?out|timed[\s_-]*out|시간\s*초과)/i.test(`${code} ${message}`);
          addText(section, 'p', `${title} 불러오지 못했습니다${timedOut ? ' (시간 초과)' : ''}: ${message}`);
          retryMessage(section);
          return;
        }
        if (resource?.status !== 'ok') {
          addText(section, 'p', `${title} 아직 확인하지 않았습니다.`);
          return;
        }
        if (!Array.isArray(resource.data)) {
          addText(section, 'p', `${title} 확인 불가: 응답 형식을 확인할 수 없습니다.`);
          return;
        }
        if (resource.data.length === 0) {
          addText(section, 'p', emptyMessage);
          return;
        }
        const list = document.createElement('ul');
        for (const entry of resource.data) {
          const value = safeValue(entry?.[idKey]);
          const state = statusText(labels, entry?.status);
          addText(list, 'li', `${idKey === 'label' ? '기기 이름' : '세션 ID'}: ${value} · 상태: ${state}`);
        }
        section.appendChild(list);
      }

      addText(root, 'h3', '기기·세션·알림·도움정보');
      if (Object.hasOwn(modeLabels, mode)) addText(root, 'p', `연결 상태: ${modeLabels[mode]}`);
      addText(root, 'p', '기기는 본인 명의 등록 기기 최대 100개까지, 세션은 현재 검증된 연결 한 개만 확인합니다. 과거 세션 전체 이력이 아닙니다.');

      renderCollection('기기 정보', devices, '등록된 기기가 없습니다.', deviceLabels, 'label');
      renderCollection('현재 세션', sessions, '현재 연결이 없습니다.', sessionLabels, 'id');

      const notices = document.createElement('section');
      addText(notices, 'h4', '주의 알림');
      if (!Array.isArray(notifications) || notifications.length === 0) {
        addText(notices, 'p', '주의할 알림이 없습니다.');
      } else {
        const list = document.createElement('ul');
        for (const item of notifications) {
          addText(list, 'li', `자료(resource): ${safeValue(item?.resource)} · 코드(code): ${safeValue(item?.code)} · 내용(message): ${safeValue(item?.message)}`);
        }
        notices.appendChild(list);
      }
      root.appendChild(notices);

      const help = document.createElement('section');
      addText(help, 'h4', '도움정보·진단 결과');
      root.appendChild(help);
      const labels = [
        ['requestId', diagnostics?.data?.requestId],
        ['component', diagnostics?.data?.component],
        ['version', diagnostics?.data?.version],
        ['checkedAt', diagnostics?.data?.checkedAt],
        ['engine.mode', diagnostics?.data?.engine?.mode],
        ['engine.code', diagnostics?.data?.engine?.code],
      ];
      const safeDetails = labels.map(([key, value]) => [key, safeValue(value)]);

      if (diagnostics?.status === 'loading') {
        addText(help, 'p', '진단 정보 불러오는 중');
      } else if (diagnostics?.status === 'error') {
        const code = safeValue(diagnostics.error?.code);
        const message = safeValue(diagnostics.error?.message);
        const timedOut = /(?:time.?out|timed[\s_-]*out|시간\s*초과)/i.test(`${code} ${message}`);
        addText(help, 'p', `진단 정보를 불러오지 못했습니다${timedOut ? ' (시간 초과)' : ''}: ${message}`);
        addText(help, 'p', '다시 시도는 제공 화면의 도움정보 불러오기 버튼을 직접 누르세요.');
      } else if (diagnostics?.status === 'ok') {
        const list = document.createElement('dl');
        list.className = 'kv';
        for (const [key, value] of safeDetails) {
          addText(list, 'dt', key);
          addText(list, 'dd', value);
        }
        help.appendChild(list);
      } else {
        addText(help, 'p', '진단 정보는 아직 불러오지 않았습니다. 제공 화면의 도움정보 불러오기 버튼을 직접 누르세요.');
      }

      addText(help, 'p', '도움 요청에 사용할 비밀 없는 진단 항목만 복사합니다. 사용자가 버튼을 눌러야 복사합니다.');
      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.textContent = '도움정보 복사';
      copyButton.disabled = diagnostics?.status !== 'ok';
      const copyResult = addText(help, 'p', diagnostics?.status === 'ok' ? '복사 전' : '진단 결과를 확인한 후 복사할 수 있습니다.');
      copyButton.addEventListener('click', async () => {
        if (diagnostics?.status !== 'ok') return;
        const detailObject = {
          requestId: safeDetails[0][1],
          component: safeDetails[1][1],
          version: safeDetails[2][1],
          checkedAt: safeDetails[3][1],
          engine: { mode: safeDetails[4][1], code: safeDetails[5][1] },
        };
        try {
          await navigator.clipboard.writeText(JSON.stringify(detailObject, null, 2));
          copyResult.textContent = '도움정보를 클립보드에 복사했습니다.';
        } catch {
          copyResult.textContent = '자동 복사에 실패했습니다. 브라우저의 클립보드 권한을 확인하세요.';
        }
      });
      help.appendChild(copyButton);
      return root;
    },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection({ status, mode, data, error, checkedAt, explanationAccepted } = {}) {
      const root = document.createElement('section');
      const modeLabels = {
        connected: '연결됨', demo: '예제 자료', disconnected: '연결 없음', unknown: '확인 불가',
      };
      // 서버가 전달한 오류는 안전한 코드와 설명만 표시한다. 인증 열쇠·원문 응답은 취급하지 않는다.
      const secretPattern = /(?:Bearer\s+\S+|sk-(?:proj-|ant-|svcacct-)?[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_ -]?key|authorization|password|비밀번호|토큰)\s*[:=]\s*\S+)/i;

      function addText(parent, tag, value) {
        const node = document.createElement(tag);
        node.textContent = value;
        parent.appendChild(node);
        return node;
      }

      function safeCode(value) {
        return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_:-]{0,79}$/.test(value) && !secretPattern.test(value)
          ? value : 'AI_REQUEST_UNVERIFIED';
      }

      function safeMessage(value) {
        return typeof value === 'string' && value.trim() && value.length <= 500
          && !secretPattern.test(value) && !/[\u0000-\u001f\u007f]/.test(value)
          ? value : '오류 상세 내용을 안전하게 확인할 수 없습니다.';
      }

      function errorAdvice(code) {
        const c = code.toUpperCase();
        if (/(?:CANCEL|ABORT)/.test(c)) {
          return '요청이 취소됐습니다. 이전 점검 결과는 현재 결과가 아닙니다. 필요하면 직접 다시 점검하세요.';
        }
        if (/(?:MODEL.*(?:EMPTY|NONE|NOT_CONFIGURED|UNAVAILABLE)|NO_MODEL)/.test(c)) {
          return '현재 사용할 수 있는 AI 모델이 없습니다. 담당자에게 모델 허용 설정을 확인하세요.';
        }
        if (/(?:COHORT.*BUDGET|QUOTA|BUDGET|LIMIT_REACHED|EXHAUSTED|USAGE_LIMIT)/.test(c)) {
          return '수업용 AI 사용량 또는 이용 한도에 도달했습니다. 담당자에게 확인하세요.';
        }
        if (/(?:SESSION_CLOSED|TIME_WINDOW|OUTSIDE_HOURS|USAGE_HOURS|SESSION_NOT_OPEN)/.test(c)) {
          return '현재 AI 이용 시간이 아닙니다. 허용된 이용 시간을 확인하세요.';
        }
        if (/(?:RATE_LIMIT|TOO_MANY_REQUESTS|TIMEOUT|TIMED_OUT|NETWORK|UNAVAILABLE|CONNECTION_ERROR|REQUEST_FAILED)/.test(c)) {
          return '요청 제한·시간 초과 또는 네트워크 문제입니다. 연결 상태를 확인하고 잠시 뒤 버튼을 직접 눌러 다시 점검하세요.';
        }
        if (/(?:AUTH_REQUIRED|UNAUTHORIZED|AUTHENTICATION|INVALID_CREDENTIAL|HTTP_401|AUTH_FAILED)/.test(c)) {
          return 'AI 인증을 확인하지 못했습니다. 현재 계정 연결을 다시 확인하고 담당자에게 문의하세요.';
        }
        if (/(?:ACCESS_BLOCKED|ACCESS_DENIED|FORBIDDEN|HTTP_403|PERMISSION_DENIED)/.test(c)) {
          return '앱 AI 이용이 제한되어 있습니다. 운영 중지 상태와 앱 이용 권한을 담당자에게 확인하세요.';
        }
        if (/(?:PROVISION|UNVERIFIED|UNKNOWN|AUTHORIZATION_CHANGED|NATIVE_HOST_DISABLED|NOT_MOUNTED|NOT_CONNECTED)/.test(c)) {
          return '계정 연결 또는 앱 권한을 확인할 수 없습니다. 담당자에게 권한 준비 상태를 문의하세요. 이전 시작 틀로 인한 오류라면 공식 0.2.21 업데이트 안내를 확인하세요.';
        }
        return 'AI 연결 상태를 확인할 수 없습니다. 계정 연결과 이용 권한을 담당자에게 확인하세요.';
      }

      addText(root, 'h3', '수업용 AI 연결 점검');
      if (Object.hasOwn(modeLabels, mode)) addText(root, 'p', `연결 상태: ${modeLabels[mode]}(${mode})`);

      if (status === 'idle') {
        addText(root, 'p', 'AI 연결 점검 전입니다. 이전 점검 결과는 현재 결과가 아닙니다.');
      } else if (status === 'loading') {
        addText(root, 'p', 'AI 연결 점검 중입니다. 현재 결과가 확정되지 않았습니다.');
      } else if (status === 'error') {
        const code = safeCode(error?.code);
        addText(root, 'p', `AI 연결 점검 실패 · 오류 코드: ${code}`);
        addText(root, 'p', `오류 안내: ${safeMessage(error?.message)}`);
        addText(root, 'p', errorAdvice(code));
        addText(root, 'p', '점검에 실패했으므로 앱 권한 확인이나 사건 설명 성공으로 간주하지 않습니다.');
      } else if (status === 'ok') {
        const authorized = data?.audienceAuthorization;
        if (data?.transportChecked !== true || !['test', 'verified'].includes(authorized)) {
          addText(root, 'p', 'AI 연결 점검 결과 확인 불가: 응답 형식 또는 인증 상태를 확인할 수 없습니다.');
        } else {
          addText(root, 'p', authorized === 'test'
            ? '시험 연결 점검(test) · 실제 앱 AI 이용 권한 검증은 아닙니다.'
            : '앱 권한 확인 후 점검(verified) · 해당 점검 시각 기준의 결과입니다.');
          const fields = document.createElement('dl');
          fields.className = 'kv';
          addText(fields, 'dt', 'audienceAuthorization');
          addText(fields, 'dd', authorized);
          addText(fields, 'dt', '응답 모델 수(modelCount)');
          addText(fields, 'dd', Number.isInteger(data.modelCount) && data.modelCount >= 0
            ? String(data.modelCount) : '확인 불가');
          addText(fields, 'dt', '점검 시각(checkedAt)');
          addText(fields, 'dd', typeof checkedAt === 'string' && checkedAt.trim() ? checkedAt : '확인 불가');
          root.appendChild(fields);
          if (mode === 'demo') addText(root, 'p', '예제 자료(demo)이며 실제 앱 AI 권한 확인으로 인정하지 않습니다.');
          if (data.modelCount === 0) addText(root, 'p', '응답 모델 수가 0개입니다. 담당자에게 모델 허용 설정을 확인하세요.');
          addText(root, 'p', 'AI 연결 및 모델 목록만 점검했습니다. 사건 설명은 아직 실행하지 않았습니다.');
          addText(root, 'p', '실제 사건 설명은 보안 기록에서 사건을 선택한 뒤 별도로 요청하고 결과를 확인해야 합니다.');
        }
      } else {
        addText(root, 'p', 'AI 연결 점검 상태를 확인할 수 없습니다.');
      }
      // explanationAccepted는 이 함수에서 사건 설명 성공을 확정하는 값이 아니다.
      void explanationAccepted;
      addText(root, 'p', '자동 재점검하지 않습니다. 재점검은 제공 화면의 현재 API 연결 점검 버튼을 직접 누르세요.');
      return root;
    },
    renderExplanation({ event, explanation, checkedAt } = {}) {
      const root = document.createElement('section');
      const secretPattern = /(?:Bearer\s+\S+|sk-(?:proj-|ant-|svcacct-)?[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_ -]?key|authorization|password|비밀번호|토큰)\s*[:=]\s*\S+)/i;

      function addText(parent, tag, value) {
        const node = document.createElement(tag);
        node.textContent = value;
        parent.appendChild(node);
        return node;
      }

      function safeErrorCode(value) {
        return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_:-]{0,79}$/.test(value) && !secretPattern.test(value)
          ? value : 'AI_REQUEST_UNVERIFIED';
      }

      function safeErrorMessage(value) {
        return typeof value === 'string' && value.trim() && value.length <= 500
          && !secretPattern.test(value) && !/[\u0000-\u001f\u007f]/.test(value)
          ? value : '오류 상세 내용을 안전하게 확인할 수 없습니다.';
      }

      addText(root, 'h3', 'AI 사건 설명(참고용)');
      // 18단계 확인 1: 사건을 선택하지 않았더라도 AI 오류를 먼저 안내한다.
      if (explanation?.status === 'error') {
        const code = safeErrorCode(explanation.error?.code);
        addText(root, 'p', `AI 설명 실패 · 오류 코드: ${code}`);
        addText(root, 'p', `오류 안내: ${safeErrorMessage(explanation.error?.message)}`);
        if (/(?:EVIDENCE|INSUFFICIENT|INVALID_OUTPUT)/.test(code.toUpperCase())) {
          addText(root, 'p', '근거 부족·불일치 또는 AI 응답 형식 문제로 설명을 확인하지 못했습니다. 원래 사건의 근거를 직접 확인하세요.');
        }
        addText(root, 'p', '원래 보안 기록은 그대로입니다. AI 설명 실패를 기록 손실이나 보안 조치 성공으로 표시하지 않습니다.');
        return root;
      }
      if (!event || typeof event.id !== 'string' || !event.id.trim()) {
        addText(root, 'p', '보안 기록에서 사건을 먼저 선택하세요. 연결 점검만으로 사건 설명이 실행되지는 않습니다.');
        return root;
      }
      if (explanation?.status === 'loading') {
        addText(root, 'p', `사건 ${event.id} · AI 설명 요청 중입니다.`);
        return root;
      }
      if (explanation?.status !== 'ok') {
        addText(root, 'p', '사건 설명을 아직 요청하지 않았습니다.');
        return root;
      }
      const summary = explanation.data?.summary;
      if (typeof summary !== 'string' || !summary.trim() || summary.length > 1500 || secretPattern.test(summary)) {
        addText(root, 'p', 'AI 사건 설명 확인 불가: 안전한 요약 내용을 확인할 수 없습니다.');
        return root;
      }

      // 18단계 확인 3: 인용 ID는 현재 선택한 사건의 근거와만 연결한다.
      const evidence = event.evidence;
      const citedIds = explanation.data?.evidenceIds;
      const validEntry = (entry) => entry && typeof entry.id === 'string' && entry.id.trim()
        && typeof entry.text === 'string' && entry.text.trim() && !secretPattern.test(entry.text);
      const validEvidence = Array.isArray(evidence) && evidence.length > 0 && evidence.every(validEntry);
      const evidenceById = new Map(validEvidence ? evidence.map((entry) => [entry.id, entry.text]) : []);
      const matchesEvidence = validEvidence && evidenceById.size === evidence.length
        && Array.isArray(citedIds) && citedIds.length === evidence.length
        && new Set(citedIds).size === citedIds.length
        && citedIds.every((id) => typeof id === 'string' && evidenceById.has(id));
      if (!matchesEvidence) {
        addText(root, 'p', 'AI 사건 설명 확인 불가: 인용한 근거 ID가 현재 사건의 근거와 일치하지 않습니다. 없는 근거는 만들어 표시하지 않습니다.');
        if (explanation.error?.code) addText(root, 'p', `오류 코드: ${safeErrorCode(explanation.error.code)}`);
        return root;
      }

      const rules = event.rules;
      if (!Array.isArray(rules) || !rules.every(validEntry)
        || new Set(rules.map((rule) => rule.id)).size !== rules.length) {
        addText(root, 'p', 'AI 사건 설명 확인 불가: 현재 사건의 규칙 ID 또는 규칙 문장을 확인할 수 없습니다.');
        return root;
      }

      // 18단계 확인 4: 현재 사건의 상태가 검증 가능한 경우에만 AI 설명을 표시한다.
      const currentState = event.state;
      const statesValid = currentState && typeof currentState === 'object' && !Array.isArray(currentState)
        && ['allowed', 'denied', 'unknown'].includes(currentState.access)
        && ['active', 'expired', 'revoked', 'unknown'].includes(currentState.session)
        && ['compliant', 'noncompliant', 'unknown'].includes(currentState.device);
      if (!statesValid) {
        addText(root, 'p', 'AI 사건 설명 확인 불가: 접속·세션·기기의 현재 상태를 확인할 수 없습니다.');
        return root;
      }

      const response = explanation.data;
      if (response.executed !== false) {
        addText(root, 'p', 'AI 사건 설명 확인 불가: AI가 조치를 이미 실행했다고 주장하거나 미실행 여부가 확인되지 않았습니다. 설명을 사용할 수 없습니다.');
        return root;
      }
      if (response.requiresHumanConfirmation !== true) {
        addText(root, 'p', 'AI 사건 설명 확인 불가: 조치에 사람 확인이 필요하다는 조건을 확인할 수 없습니다.');
        return root;
      }

      const supportedActions = event.supportedActions;
      const proposals = response.proposals;
      const validActionId = (value) => typeof value === 'string'
        && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(value) && !secretPattern.test(value);
      const validProposal = (proposal) => proposal && typeof proposal === 'object' && !Array.isArray(proposal)
        && validActionId(proposal.action) && supportedActions.includes(proposal.action)
        && typeof proposal.reason === 'string' && proposal.reason.trim()
        && proposal.reason.length <= 500 && !secretPattern.test(proposal.reason)
        && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(proposal.reason)
        && Array.isArray(proposal.evidenceIds) && proposal.evidenceIds.length > 0
        && new Set(proposal.evidenceIds).size === proposal.evidenceIds.length
        && proposal.evidenceIds.every((id) => typeof id === 'string' && evidenceById.has(id));
      if (!Array.isArray(supportedActions) || !supportedActions.every(validActionId)
        || !Array.isArray(proposals) || proposals.length > 3
        || proposals.some((proposal) => !validProposal(proposal))) {
        addText(root, 'p', 'AI 사건 설명 확인 불가: 지원하지 않는 조치 또는 근거가 맞지 않는 제안이 포함돼 있습니다. 조치를 실행하지 않았습니다.');
        return root;
      }

      // 모든 검증을 통과한 설명에만 성공 속성을 붙인다.
      root.setAttribute('data-student-explanation-event', event.id);
      addText(root, 'p', `사건 ID: ${event.id}`);
      addText(root, 'p', `AI 요약: ${summary}`);
      if (typeof checkedAt === 'string' && checkedAt.trim()) addText(root, 'p', `설명 확인 시각: ${checkedAt}`);
      addText(root, 'h4', 'AI 설명이 인용한 근거');
      const evidenceList = document.createElement('ul');
      for (const id of citedIds) addText(evidenceList, 'li', `${id} — ${evidenceById.get(id)}`);
      root.appendChild(evidenceList);
      addText(root, 'h4', '현재 사건의 탐지 규칙');
      if (rules.length === 0) {
        addText(root, 'p', '표시할 규칙이 없습니다.');
      } else {
        const ruleList = document.createElement('ul');
        for (const rule of rules) addText(ruleList, 'li', `${rule.id} — ${rule.text}`);
        root.appendChild(ruleList);
      }

      addText(root, 'h4', '확인되지 않은 현재 상태');
      const unknownStates = [
        ['access', '접속'], ['session', '세션'], ['device', '기기'],
      ].filter(([key]) => currentState[key] === 'unknown');
      if (unknownStates.length === 0) {
        addText(root, 'p', '없음');
      } else {
        const unknownList = document.createElement('ul');
        for (const [, label] of unknownStates) addText(unknownList, 'li', `${label}: 확인 불가(unknown)`);
        root.appendChild(unknownList);
      }

      addText(root, 'h4', 'AI 조치 제안');
      if (proposals.length === 0) {
        addText(root, 'p', supportedActions.length === 0
          ? '연동 시스템이 지원하는 조치가 없어 제안이 없습니다(정상).'
          : 'AI가 현재 사건에 제안한 조치가 없습니다.');
      } else {
        const proposalList = document.createElement('ul');
        for (const proposal of proposals) {
          addText(proposalList, 'li', `${proposal.action} — ${proposal.reason} (근거: ${proposal.evidenceIds.join(', ')}) · 사람 확인이 필요하며 실행되지 않았습니다.`);
        }
        root.appendChild(proposalList);
      }
      addText(root, 'p', 'AI 설명과 제안은 참고 정보입니다. 사람이 확인해야 하며 AI는 보안 조치를 실행하지 않았습니다. 원본 사건과 탐지 규칙은 그대로입니다.');
      return root;
    },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
