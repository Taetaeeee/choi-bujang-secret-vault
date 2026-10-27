import test from 'node:test';import assert from 'node:assert/strict';
import {collectionKey} from '../lib/collection-key.mjs';
import {readApiResponse} from '../lib/api-response.mjs';
test('personal qualifications do not trigger external collection',()=>{
 const p={keywords:'전산',regions:['전국']};
 assert.equal(collectionKey(p),collectionKey({...p,name:'변경',education:'고졸',relevantExperienceYears:0,skills:[{name:'Linux'}]}));
 assert.notEqual(collectionKey(p),collectionKey({...p,keywords:'회계'}));
});
test('HTML 503 has safe actionable message without exposing returned page',async()=>{
 await assert.rejects(readApiResponse(new Response('<!DOCTYPE html>private error',{status:503}),'refresh'),e=>/HTTP 503/.test(e.message)&&!e.message.includes('private'));
 assert.deepEqual(await readApiResponse(Response.json({saved:true}),'profile'),{saved:true});
});
