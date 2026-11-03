// 8단계 제작 3: API 서버가 검증한 신원과 DB에서 읽은 소유자만 비교합니다.
// 본문/쿼리의 role, userId, owner_id나 화면 메뉴 상태는 인가 근거가 아닙니다.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function verifiedApiIdentity(identity) {
  return identity !== null && typeof identity === 'object'
    && !Array.isArray(identity)
    && (identity.kind === 'student' || identity.kind === 'judge')
    && typeof identity.userId === 'string' && UUID.test(identity.userId);
}

export function ownsStoredNote(identity, storedRow) {
  return verifiedApiIdentity(identity)
    && storedRow !== null && typeof storedRow === 'object'
    && !Array.isArray(storedRow)
    && typeof storedRow.owner_id === 'string' && UUID.test(storedRow.owner_id)
    && storedRow.owner_id.toLowerCase() === identity.userId.toLowerCase();
}

export function ownsAllStoredNotes(identity, rows) {
  return verifiedApiIdentity(identity) && Array.isArray(rows)
    && rows.every(row => ownsStoredNote(identity, row));
}

// 현재 API에는 서버가 검증할 수 있는 강사 권한 저장소나 공지 관리 경로가 없습니다.
// 강사 권한을 role 입력값만으로 주장하는 경우 새 권한을 부여하지 않습니다.
// 이 API는 개인 메모만 다루며 다른 구역은 서버에서도 기본적으로 미지원입니다.
