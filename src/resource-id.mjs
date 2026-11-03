// 8단계 제작 1: 기존 URL과 DB ID를 바꾸지 않고 서버 내부 자원 구역을 구분합니다.
// 이 ID는 자원 식별용이며 접근 권한이나 강사 역할을 증명하지 않습니다.
export const RESOURCE_ZONES = Object.freeze({
  PERSONAL_NOTE: 'personal-note',
  INSTRUCTOR_NOTICE: 'instructor-notice',
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const NOTICE_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/iu;

export function resourceIdFor(zone, itemId = null) {
  if (!Object.values(RESOURCE_ZONES).includes(zone)) return null;
  if (itemId === null) return `${zone}:collection`;
  if (typeof itemId !== 'string') return null;

  if (zone === RESOURCE_ZONES.PERSONAL_NOTE && !UUID.test(itemId)) return null;
  if (zone === RESOURCE_ZONES.INSTRUCTOR_NOTICE && !NOTICE_ID.test(itemId)) return null;
  return `${zone}:${itemId.toLowerCase()}`;
}

// Vercel은 기존 /api/notes/:id 를 /api/notes?noteId=:id 로 전달합니다.
// 호출자가 자원 구역을 정하도록 두지 않고 서버에서 고정합니다.
export function personalNoteRequestResourceId(rawNoteId) {
  return resourceIdFor(RESOURCE_ZONES.PERSONAL_NOTE,
    rawNoteId === undefined ? null : rawNoteId);
}
