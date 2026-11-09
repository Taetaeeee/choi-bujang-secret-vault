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
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
