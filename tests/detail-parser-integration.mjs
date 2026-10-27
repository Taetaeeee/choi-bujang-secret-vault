import {createRequire} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json'));
const {build}=wr('esbuild'),{Miniflare,createFetchMock}=wr('miniflare');
const bundle=await build({stdin:{contents:`import {inspectSaraminDetail,inspectJobkoreaDetail,inspectFrame,collectDetails} from './lib/job-detail.mjs';export default {async fetch(r){try{const p=await r.json();const v=p.action==='collect'?await collectDetails(p.jobs,p.provider,url=>!url.includes('blocked')):p.action==='frame'?await inspectFrame(p.html,p.job,p.url,p.now):p.job.provider==='saramin'?await inspectSaraminDetail(p.html,p.job,p.now):await inspectJobkoreaDetail(p.html,p.job,p.now);return Response.json({value:v,collection:v.collection});}catch(e){return Response.json({error:e.message},{status:400});}}};`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',write:false});
const mock=createFetchMock();mock.disableNetConnect();
const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',fetchMock:mock});
const now='2026-10-26T03:00:00Z';
const job=(provider='saramin',id='1')=>({id:provider+':'+id,provider,collectionMode:'temporary',company:'테스트 기업',title:'전산 운영',sourceUrl:provider==='saramin'?'https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx='+id:'https://www.jobkorea.co.kr/Recruit/GI_Read/'+id,duties:'담당업무 원문에서 확인 불가',requirements:'필수요건 원문에서 확인 불가',preferred:'우대사항 원문에서 확인 불가',rawText:'목록 근거',fetchedAt:now});
const identity=j=>`<meta property="og:title" content="[${j.company}] ${j.title}"><link rel="canonical" href="${j.sourceUrl}">`;
const body='<div class="user_content"><main class="job-posting job-posting--list"><div class="job-content"><div class="info-block"><p class="info-block__title">📋 주요업무</p><div class="info-block__list"><p>서버 운영</p><p>장애 분석</p></div></div><div class="info-block"><p class="info-block__title">📋 자격요건</p><div class="info-block__list">TCP/IP 지식</div></div><div class="info-block"><p class="info-block__title">📋 우대사항</p><div class="info-block__list">네트워크관리사 2급</div></div><p>🏠 근무조건</p><p>식대 제공</p></div></main></div>';
const jkSections='<div data-jobview-section="qualification"><div><span>경력</span><div><span>경력</span><span>(3년이상)</span></div></div><div><span>학력</span><div>학력무관</div></div><div><span>우대조건</span><div><span>기본우대</span><span>정보처리기사, 관련 전공자</span></div></div></div><div data-jobview-section="recruitment_info"><div><div><span>모집분야</span></div><div>전산</div></div><div><span>고용형태</span><div>계약직(협의)</div></div><div><span>급여</span><span>면접 후 결정</span></div><div><span>근무지주소</span><div>세종 국세청로 8-14<button>지도보기</button></div></div></div>';
async function call(p){const r=await mf.dispatchFetch('https://parser.test',{method:'POST',body:JSON.stringify({now,...p})});return {status:r.status,...await r.json()};}
try{
 const s=job(),j=job('jobkorea');
 let summary=await call({html:identity(s)+'<div class="jv_cont jv_summary"><dl><dt>경력</dt><dd><strong>경력</strong></dd></dl><dl><dt>학력</dt><dd><strong>학력무관</strong></dd></dl><dl><dt>근무형태</dt><dd>계약직</dd></dl></div>',job:s});
 assert.equal(summary.value.experience,'경력');assert.equal(summary.value.education,'학력무관');assert.equal(summary.value.employment,'계약직');assert.match(summary.value.requirements,/경력/);
 let r=await call({html:identity(s)+body,job:s});assert.equal(r.status,200,JSON.stringify(r));assert.match(r.value.duties,/서버 운영\n.*장애 분석/);assert.equal(r.value.requirements,'TCP/IP 지식');assert.equal(r.value.preferred,'네트워크관리사 2급');assert.equal(r.value.detailStatus,'text');assert.equal(r.value.verification,'summary');assert.ok(!r.value.requirements.includes('네트워크관리사'));assert.ok(!r.value.preferred.includes('식대'));
 r=await call({html:identity(s)+body.replace('job-posting--list','job-posting--table'),job:s});assert.equal(r.value.detailStatus,'text');
 r=await call({html:identity(s)+'<div class="user_content"><strong>[담당업무]</strong><span>서버 운영과 장애 대응</span><b>필수조건</b><span>TCP/IP 이해</span><span>우대조건</span><span>CCNA</span></div>',job:s});assert.equal(r.value.requirements,'TCP/IP 이해');assert.equal(r.value.preferred,'CCNA');assert.match(r.value.duties,/서버 운영/);assert.equal(r.value.sectionAnalysis.sections.requirements.items[0].source,'body');
 assert.equal((await call({html:identity({...s,title:'다른 공고'})+body,job:s})).status,400);
 assert.equal((await call({html:identity({...s,sourceUrl:'https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=2'})+body,job:s})).status,400);
 const main=identity(s)+'<div class="jv_cont jv_detail"><iframe class="iframe_content" src="/zf_user/jobs/relay/view-detail?rec_idx=1&amp;rec_seq=0&amp;t_ref=tracking"></iframe></div>';
 r=await call({html:main,job:s});assert.equal(r.value.detailFrames[0],'https://www.saramin.co.kr/zf_user/jobs/relay/view-detail?rec_idx=1&rec_seq=0');assert.ok(!r.value.detailFetchedAt);
 const frame=await call({action:'frame',html:body,job:r.value,url:r.value.detailFrames[0]});assert.equal(frame.value.detailStatus,'text');
 assert.equal((await call({action:'frame',html:body,job:s,url:'https://evil.test/?rec_idx=1'})).status,400);
 r=await call({html:identity(s)+'<div class="user_content"><table><tr><th>모집직무</th><th>담당업무</th><th>자격요건 및 우대사항</th></tr><tr><td>전산</td><td>서버 운영<br>PC 점검</td><td>자격요건<br>운전 가능자<br>우대사항<br>Linux</td></tr></table></div>',job:s});assert.match(r.value.duties,/서버 운영/);assert.equal(r.value.requirements,'운전 가능자');assert.equal(r.value.preferred,'Linux');
 r=await call({html:identity(j)+jkSections+'<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:j.title,hiringOrganization:{name:j.company},description:'회사·지역·고용형태에 관한 짧은 요약입니다.'})+'</script>',job:j});assert.equal(r.status,200,JSON.stringify(r));assert.match(r.value.requirements,/경력.*3년이상/);assert.match(r.value.requirements,/학력무관/);assert.ok(!r.value.requirements.includes('정보처리기사'));assert.match(r.value.preferred,/정보처리기사/);assert.equal(r.value.employment,'계약직(협의)');assert.equal(r.value.location,'세종 국세청로 8-14');assert.equal(r.value.detailStatus,'metadata');assert.ok(!r.value.detailFetchedAt);
 const jkMeta=r.value;
 r=await call({action:'frame',html:'<div id="detail-content"><article><h3>담당업무</h3><p>방화벽 운영</p><h3>자격요건</h3><p>TCP/IP</p><h3>우대사항</h3><p>Linux</p></article></div>',job:jkMeta,url:'https://www.jobkorea.co.kr/Recruit/GI_Read_Comt_Ifrm?Gno=1'});assert.equal(r.value.detailStatus,'text');assert.match(r.value.requirements,/3년이상/);assert.match(r.value.requirements,/TCP\/IP/);assert.ok(!r.value.requirements.includes('정보처리기사'));assert.match(r.value.preferred,/Linux/);
 const image='<div id="detail-content"><article><img src="//file2.jobkorea.co.kr/Net/Mng/DownImage/CorpEditor?file_No=1887703"></article></div>';
 r=await call({action:'frame',html:image,job:jkMeta,url:'https://www.jobkorea.co.kr/Recruit/GI_Read_Comt_Ifrm?Gno=1'});assert.equal(r.value.detailStatus,'image');assert.equal(r.value.bodyText,'');assert.equal(r.value.detailImages[0].url,'https://file2.jobkorea.co.kr/Net/Mng/DownImage/CorpEditor?file_No=1887703');assert.match(r.value.requirements,/3년이상/);
 // Public React payload URL strings are parsed as data and never executed.
 r=await call({html:identity(j)+jkSections+'<script>self.__next_f.push(["src:\\"/Recruit/GI_Read_Comt_Ifrm?Gno=1\\u0026hideMapView=false\\""])</script>',job:j});assert.ok(r.value.detailFrames[0].includes('Gno=1'),JSON.stringify(r));
 mock.get('https://www.saramin.co.kr').intercept({path:'/zf_user/jobs/view?rec_idx=1'}).reply(200,main);
 mock.get('https://www.saramin.co.kr').intercept({path:'/zf_user/jobs/relay/view-detail?rec_idx=1&rec_seq=0'}).reply(200,body);
 r=await call({action:'collect',jobs:[s],provider:'saramin'});assert.equal(r.value[0].detailStatus,'text');assert.equal(r.collection.requests,2);assert.equal(r.collection.detailFailed,0);
 mock.get('https://www.jobkorea.co.kr').intercept({path:'/Recruit/GI_Read/1'}).reply(200,identity(j)+jkSections+'<iframe src="/Recruit/GI_Read_Comt_Ifrm?Gno=1"></iframe>');
 mock.get('https://www.jobkorea.co.kr').intercept({path:'/Recruit/GI_Read_Comt_Ifrm?Gno=1'}).reply(503,'private error body');
 r=await call({action:'collect',jobs:[j],provider:'jobkorea'});assert.match(r.value[0].requirements,/3년이상/);assert.equal(r.value[0].detailStatus,'partial');assert.match(r.value[0].detailError,/503/);assert.ok(!JSON.stringify(r).includes('private error body'));
 for(const provider of ['saramin','jobkorea']){
  const n=provider==='saramin'?4:3;
  const jobs=Array.from({length:6},(_,i)=>job(provider,String(100+i)));
  for(const item of jobs.slice(0,n)){
   const id=item.id.split(':')[1];const host=provider==='saramin'?'https://www.saramin.co.kr':'https://www.jobkorea.co.kr';
   const outer=provider==='saramin'?'/zf_user/jobs/view?rec_idx='+id:'/Recruit/GI_Read/'+id;
   const frame=provider==='saramin'?'/zf_user/jobs/relay/view-detail?rec_idx='+id+'&rec_seq=0':'/Recruit/GI_Read_Comt_Ifrm?Gno='+id;
   mock.get(host).intercept({path:outer}).reply(200,identity(item)+'<iframe src="'+frame+'"></iframe>');
   if(provider==='saramin'||+id<102)mock.get(host).intercept({path:frame}).reply(200,provider==='saramin'?body:'<div id="detail-content"><p>담당업무</p><p>서버 운영과 장애 대응 담당</p></div>');
  }
  const result=await call({action:'collect',jobs,provider});assert.equal(result.status,200);assert.equal(result.value.length,6);assert.equal(result.collection.requests,provider==='saramin'?8:5);assert.equal(result.value.at(-1).detailStatus,'budget');
 }
 console.log('PASS native detail parser: Saramin list/table/iframe + identity + explicit sections; Jobkorea qualification/recruitment + text/image frames + React URL + partial HTTP failure + no preference promotion');
 if(process.argv[2]){
  const dir=process.argv[2];
  if(existsSync(dir+'/saramin-55356243-iframe.html')){const original={...s,id:'saramin:55356243'};const result=await call({action:'frame',html:readFileSync(dir+'/saramin-55356243-iframe.html','utf8'),job:original,url:'https://www.saramin.co.kr/zf_user/jobs/relay/view-detail?rec_idx=55356243&rec_seq=0'});assert.equal(result.status,200,JSON.stringify(result));assert.match(result.value.duties,/PC/);assert.match(result.value.requirements,/신입/);assert.ok(!result.value.preferred.includes('필수'));console.log('PASS saved user-supplied public iframe: PC duties and explicit requirements');}

  for(const [file,real] of [
   ['saramin-body.html',{...s,id:'saramin:55374528',company:'대신네트웍스(주)',title:'대전 공공기관 정보통신실 유지보수 (네트워크/보안)',sourceUrl:'https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=55374528'}],
   ['saramin-other.html',{...s,id:'saramin:55014505',company:'(주)폴라리스에이아이',title:'[폴라리스AI] 금융사업부, 전산 및 네트워크 유지보수 채용-대전',sourceUrl:'https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=55014505'}],
   ['jobkorea-main-50154945.html',{...j,id:'jobkorea:50154945',company:'㈜티와이엘',title:'[티와이엘] 공공 전산시스템 유지관리 인력 모집(세종)',sourceUrl:'https://www.jobkorea.co.kr/Recruit/GI_Read/50154945'}]
  ])if(existsSync(dir+'/'+file)){const d=await call({html:readFileSync(dir+'/'+file,'utf8'),job:real});assert.equal(d.status,200,JSON.stringify(d));assert.ok(d.value.requirements&&!d.value.requirements.includes('항목 분리'),JSON.stringify(d));if(file==='saramin-other.html')assert.match(d.value.duties,/네트워크장비 유지관리/);console.log('PASS saved public HTML',file,JSON.stringify({status:d.value.detailStatus,duties:d.value.duties,requirements:d.value.requirements,preferred:d.value.preferred}));}
 }
}finally{await mf.dispose();}
