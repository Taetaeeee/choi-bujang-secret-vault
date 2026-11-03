import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RESOURCE_ZONES, resourceIdFor, personalNoteRequestResourceId } from '../src/resource-id.mjs';

const uuid = 'a1b2c3d4-1111-4222-8333-123456789abc';

test('개인 메모 목록과 단건 요청을 서버가 서로 다른 ID로 구분한다', () => {
  assert.equal(personalNoteRequestResourceId(undefined), 'personal-note:collection');
  assert.equal(personalNoteRequestResourceId(uuid), `personal-note:${uuid}`);
  assert.equal(personalNoteRequestResourceId(uuid.toUpperCase()), `personal-note:${uuid}`);
});

test('같은 항목 ID라도 개인 메모와 강사 공지의 구역이 다르다', () => {
  const note = resourceIdFor(RESOURCE_ZONES.PERSONAL_NOTE, uuid);
  const notice = resourceIdFor(RESOURCE_ZONES.INSTRUCTOR_NOTICE, uuid);
  assert.equal(note, `personal-note:${uuid}`);
  assert.equal(notice, `instructor-notice:${uuid}`);
  assert.notEqual(note, notice);
  assert.equal(resourceIdFor(RESOURCE_ZONES.INSTRUCTOR_NOTICE), 'instructor-notice:collection');
});

test('요청자가 임의로 만든 구역과 위험한 ID를 허용하지 않는다', () => {
  assert.equal(resourceIdFor('administrator', uuid), null);
  assert.equal(personalNoteRequestResourceId(['a', 'b']), null);
  assert.equal(personalNoteRequestResourceId('notice-001'), null);
  assert.equal(resourceIdFor(RESOURCE_ZONES.INSTRUCTOR_NOTICE, 'a\r\nx-resource-id:fake'), null);
});
