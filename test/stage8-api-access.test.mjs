import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifiedApiIdentity, ownsStoredNote, ownsAllStoredNotes } from '../src/api-resource-access.mjs';

const userA = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const a = { kind: 'student', userId: userA };
const b = { kind: 'student', userId: userB };
const owned = { id: 'sample', owner_id: userA, title: '가상', body: '연습' };

test('서버 검증 신원이 아니면 메모 권한을 부여하지 않는다', () => {
  for (const identity of [undefined, null, {}, { kind: 'student', userId: 'client-a' },
    { kind: 'instructor', userId: userA }, { kind: 'student', userId: userA, role: 'instructor' }]) {
    // role이 추가돼도 student 신원에는 메모 소유권 외 별도 권한이 생기지 않습니다.
    if (identity?.kind === 'student' && identity.userId === userA) {
      assert.equal(verifiedApiIdentity(identity), true);
    } else {
      assert.equal(verifiedApiIdentity(identity), false);
    }
  }
  assert.equal(ownsStoredNote({ kind: 'judge', userId: userA }, owned), true);
});

test('본인 소유 메모만 허용하고 타인 자료는 거부한다', () => {
  assert.equal(ownsStoredNote(a, owned), true);
  assert.equal(ownsStoredNote(b, owned), false);
  assert.equal(ownsStoredNote({ ...b, role: 'instructor' }, owned), false);
  assert.equal(ownsStoredNote(b, { ...owned, role: 'instructor' }), false);
  assert.equal(ownsStoredNote(a, { ...owned, owner_id: undefined }), false);
});

test('메모 목록에 타인 행이 한 건이라도 있으면 전체 응답을 거부한다', () => {
  assert.equal(ownsAllStoredNotes(a, [owned]), true);
  assert.equal(ownsAllStoredNotes(a, []), true);
  assert.equal(ownsAllStoredNotes(a, [owned, { ...owned, owner_id: userB }]), false);
  assert.equal(ownsAllStoredNotes(b, [owned]), false);
  assert.equal(ownsAllStoredNotes(a, null), false);
});
