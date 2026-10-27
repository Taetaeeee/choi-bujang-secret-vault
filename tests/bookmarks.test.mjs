import test from 'node:test';import assert from 'node:assert/strict';
import {isBookmarked,hasApplicationRecord} from '../lib/bookmarks.mjs';
test('legacy bookmarks, removal and retained application history',()=>{
 assert.equal(isBookmarked(undefined),false);
 assert.equal(isBookmarked({status:'관심'}),true);
 assert.equal(hasApplicationRecord({bookmarked:false,status:'관심',note:''}),false);
 assert.equal(hasApplicationRecord({bookmarked:false,status:'관심',note:'확인할 내용'}),true);
 assert.equal(hasApplicationRecord({bookmarked:false,status:'지원 완료',note:''}),true);
});
