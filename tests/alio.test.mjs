import test from 'node:test';
import assert from 'node:assert/strict';
import {ALIO_REGIONS,alioDate,alioUrl,alioEnvelope,parseAlioDetail,fetchAlio} from '../lib/alio.mjs';
import {currentState} from '../lib/policy.mjs';

const now='2026-10-23T03:00:00Z';
const profile={regions:['대전','세종','충남','충북'],keywords:'전산, 정보보안, 네트워크, IT 인프라, 시스템 운영, 서버'};
// Synthetic records based on documented fields; never real vacancies.
const row=(id=1,extra={})=>({recrutPblntSn:id,instNm:'테스트 기관',recrutPbancTtl:'전산 담당 채용',
 workRgnLst:'R3012',workRgnNmLst:'대전',ncsCdLst:'R600020',recrutSe:'R2010',
 pbancBgngYmd:'20261001',pbancEndYmd:'20261030',ongoingYn:'Y',
 aplyQlfcCn:'정보처리기사 필수',prefCn:'네트워크관리사 우대',hireTypeLst:'R1010',
 acbgCondLst:'R7050',srcUrl:'https://example.test/jobs/1',...extra});
const envelope=result=>({resultCode:0,resultMsg:'정상',result,totalCount:result.length});
async function withMock(fn,callback){const old=globalThis.fetch;globalThis.fetch=fn;try{return await callback();}finally{globalThis.fetch=old;}}

test('ALIO codes and compact dates use the supplied definition without repairing invalid dates',()=>{
 assert.deepEqual(ALIO_REGIONS,{'대전':'R3012','세종':'R3026','충남':'R3019','충북':'R3020'});
 assert.equal(alioDate('20261030'),'2026-10-30');assert.equal(alioDate('20260231'),'');assert.equal(alioDate('채용시까지'),'');
 const j=parseAlioDetail(envelope(row(1,{recrutSe:'R2030'})),1,now);
 assert.equal(j.experience,'신입+경력');assert.ok(!j.experience.includes('무관'));
});
test('official detail preserves requirements but cannot claim duties or full verification',()=>{
 const j=parseAlioDetail(envelope(row(1,{files:[{file:{atchFileType:'C',atchFileNm:'직무기술서.pdf',url:'https://example.test/description.pdf'}}]})),1,now);
 assert.equal(j.requirements,'정보처리기사 필수');assert.equal(j.preferred,'네트워크관리사 우대');
 assert.equal(j.education,'대졸(4년)');assert.equal(j.deadline,'2026-10-30');assert.equal(j.openStatus,'open');
 assert.equal(j.verification,'summary');assert.equal(currentState(j,Date.parse(now)),'review');
 assert.match(j.duties,/전용 필드가 없습니다/);assert.equal(j.attachments[0].type,'C');
 assert.equal(parseAlioDetail(envelope(row(1,{ongoingYn:'N'})),1,now).openStatus,'closed');
 assert.equal(parseAlioDetail(envelope(row(1,{pbancBgngYmd:'20261101'})),1,now).openStatus,'unknown');
 assert.equal(parseAlioDetail(envelope(row(1,{pbancEndYmd:'20260231'})),1,now).deadline,'');
 assert.throws(()=>parseAlioDetail(envelope(row()),99,now),/번호/);
});
test('links reject executable schemes and credentials; missing requirements stay unknown',()=>{
 for(const link of ['javascript:alert(1)','data:text/html,hello','https://user:password@example.test/'])assert.equal(alioUrl(link),'');
 const j=parseAlioDetail(envelope(row(1,{aplyQlfcCn:'',srcUrl:'javascript:alert(1)',prefCn:'',files:[{url:'data:text/plain,test'}]})),1,now);
 assert.equal(j.sourceUrl,'');assert.equal(j.attachments.length,0);assert.match(j.requirements,/미기재/);assert.match(j.preferred,/미기재/);
 assert.throws(()=>alioEnvelope({}),/응답 형식/);
 assert.throws(()=>alioEnvelope({resultCode:30,resultMsg:'KEY-SECRET'}),e=>!e.message.includes('KEY-SECRET')&&/인증/.test(e.message));
});
test('list/detail use only documented routes and encode Decoding key once; junior first, duplicate removed',async()=>{
 const called=[],items=[row(2,{recrutSe:'R2020'}),row(1),row(1),row(3,{workRgnLst:'R3010'}),row(4,{recrutPbancTtl:'일반 행정',aplyQlfcCn:'',prefCn:''})];
 await withMock(async url=>{
  const u=new URL(url);called.push(u);
  assert.equal(u.origin,'https://apis.data.go.kr');assert.equal(u.searchParams.get('serviceKey'),'fake+/=key');
  if(u.pathname.endsWith('/list')){
   assert.equal(u.searchParams.get('ongoingYn'),'Y');assert.equal(u.searchParams.get('ncsCdLst'),null);
   assert.equal(u.searchParams.get('workRgnLst'),'R3012,R3026,R3019,R3020');
   return Response.json(envelope(items.map(item=>({item}))));
  }
  assert.equal(u.pathname,'/1051000/recruitment/detail');return Response.json(envelope(row(+u.searchParams.get('sn'))));
 },async()=>{
  const jobs=await fetchAlio('fake+/=key',profile);
  assert.deepEqual(jobs.map(j=>j.id),['alio:1','alio:2']);assert.equal(called.length,3);
  assert.ok(!JSON.stringify(jobs).includes('fake+/=key'));
 });
});
test('each refresh makes at most two list requests and eight details, even for many matches',async()=>{
 let lists=0,details=0;
 await withMock(async url=>{
  const u=new URL(url);
  if(u.pathname.endsWith('/list')){
   lists++;const start=(+u.searchParams.get('pageNo')-1)*50;
   return Response.json({...envelope(Array.from({length:50},(_,i)=>row(start+i+1))),totalCount:10000});
  }
  details++;return Response.json(envelope(row(+u.searchParams.get('sn'))));
 },async()=>{assert.equal((await fetchAlio('fake-key',profile)).length,8);assert.equal(lists,2);assert.equal(details,8);});
});
test('transport, XML authentication and malformed response failures never reflect a credential',async()=>{
 for(const mock of [async()=>{throw new Error('https://example.test/?serviceKey=secret-value');},
  async()=>new Response('<error>SERVICE_KEY_IS_NOT_REGISTERED_ERROR secret-value</error>'),
  async()=>Response.json({resultCode:30,resultMsg:'secret-value'}),
  async()=>Response.json({resultCode:0,result:'changed shape'})]){
  await withMock(mock,async()=>{await assert.rejects(()=>fetchAlio('secret-value',profile),e=>!e.message.includes('secret-value'));});
 }
});
test('failed or mismatched details abort the run instead of silently reporting partial success',async()=>{
 await withMock(async url=>{
  const u=new URL(url);return Response.json(u.pathname.endsWith('/list')?envelope([row()]):envelope(row(99)));
 },async()=>{await assert.rejects(()=>fetchAlio('fake-key',profile),/番号|번호/);});
});

test('documented success codes 200 and string 200 reach valid list/detail parsing without treating other 2xx as success',async()=>{
 for(const code of [200,'200',0,'00']){
  const data={...envelope(row()),resultCode:code};assert.equal(parseAlioDetail(data,1,now).id,'alio:1');
 }
 for(const code of [201,204,'200error',null,false,'',{},[],200.1])assert.throws(()=>alioEnvelope({resultCode:code,result:row()}));
 const calls=[];
 await withMock(async url=>{
  const u=new URL(url);calls.push(u.pathname);
  return Response.json(u.pathname.endsWith('/list')?{resultCode:200,result:[{item:row()}],totalCount:1}:{resultCode:'200',result:row()});
 },async()=>{const jobs=await fetchAlio('fixture-secret',profile);assert.equal(jobs.length,1);assert.equal(jobs[0].id,'alio:1');assert.equal(jobs[0].requirements,'정보처리기사 필수');assert.ok(!JSON.stringify(jobs).includes('fixture-secret'));});
 assert.deepEqual(calls,['/1051000/recruitment/list','/1051000/recruitment/detail']);
});
