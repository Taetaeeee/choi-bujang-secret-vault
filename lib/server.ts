import {hasApplicationRecord} from './bookmarks.mjs';
import {collectionKey} from './collection-key.mjs';
import {searchScope} from './eligibility.mjs';
import { env } from 'cloudflare:workers';
import {getAccessUser} from './access-auth';
import {alioConnection,fetchAlio,probeAlio} from './alio.mjs';
import { defaultProfile,historyJobs,sourceCatalog,Profile } from './catalog';
import { fetchJobaram,fetchWork24,getText } from './providers.mjs';
import { z } from 'zod';
import {validRegions,normalizeRegions,regionMatch} from './regions.mjs';
import {fetchSaraminTemporary,fetchSaraminWithDetails,fetchJobkoreaTemporary,robotsAllowed,CRAWLER_AGENT} from './crawling.mjs';
import {fetchWork24Temporary} from './work24-crawling.mjs';
import {fetchCompany,normalizeCompanyBoards} from './company.mjs';
import {retainPreviousDetail,collectDetails,detailFailure} from './job-detail.mjs';
import {classifyJobSections} from './job-sections.mjs';
const E=()=>env as unknown as {DB:D1Database;APP_ENCRYPTION_KEY?:string;ALIO_API_KEY?:string};
export const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function auth(request:Request,write=false){if(write&&request.headers.get('origin')!==new URL(request.url).origin)throw new Error('ORIGIN');const u=await getAccessUser();if(!u)throw new Error('AUTH');return u.userId;}
export function failure(e:unknown){const s=e instanceof Error?e.message:'';return reply({error:s==='AUTH'?'로그인이 필요합니다.':s==='ORIGIN'?'허용되지 않은 요청입니다.':s==='JOB'?'저장된 사람인·잡코리아 공고인지 확인해 주세요.':'요청을 처리하지 못했습니다. 입력을 확인하거나 다시 시도해 주세요.'},s==='AUTH'?401:s==='ORIGIN'?403:400);}
export async function readProfile(owner:string):Promise<Profile>{const r=await E().DB.prepare('SELECT data FROM profiles WHERE owner=?').bind(owner).first<{data:string}>();return r?{...structuredClone(defaultProfile),...JSON.parse(r.data)}:{...structuredClone(defaultProfile),...(owner.startsWith('member:')?{regions:[],keywords:'',desiredRole:''}:{})};}
export const profileSchema=z.object({includeUnknownExperience:z.boolean().optional(),allowBroadRegion:z.boolean().optional(),desiredRole:z.string().max(200).optional(),relevantExperienceYears:z.number().min(0).max(60).optional(),showMismatch:z.boolean().optional(),name:z.string().max(80),education:z.enum(['확인 필요','고졸','전문대 졸업','학사 졸업','학사 졸업예정','석사 이상']),major:z.string().max(120),career:z.string().max(6000),projects:z.string().max(12000),regions:z.array(z.string().max(80)).min(1).max(40).refine(validRegions).transform(normalizeRegions),saraminMode:z.enum(['auto','temporary','api']).default('auto'),work24Mode:z.enum(['auto','temporary','api']).default('auto'),companyBoards:z.array(z.object({name:z.string().min(1).max(80),url:z.string().max(600)})).max(2).transform(normalizeCompanyBoards).optional(),keywords:z.string().min(1).max(500),allowContract:z.boolean(),allowShift:z.boolean(),certificates:z.array(z.object({name:z.string().max(120),status:z.enum(['취득 완료','준비 중','취득 여부 확인 필요'])})).max(40),skills:z.array(z.object({name:z.string().max(120),level:z.enum(['학습 중','프로젝트 경험','실무 경험'])})).max(50)});
export const credentialSchema=z.object({provider:z.enum(['saramin','work24']),key:z.string().max(1000),remove:z.boolean().optional()}).refine(v=>v.remove||v.key.trim().length>=5);
export const applicationSchema=z.object({id:z.string().min(1).max(180),status:z.enum(['관심','준비 중','지원 완료','면접','합격','불합격','보류']),note:z.string().max(3000).default('')});
export const detailRefreshSchema=z.object({id:z.string().regex(/^(saramin|jobkorea):[0-9]{1,18}$/)}).strict();
async function rows(table:string,owner:string){if(!['jobs','applications','runs'].includes(table))throw new Error('TABLE');const r=await E().DB.prepare(`SELECT data FROM ${table} WHERE owner=?`).bind(owner).all<{data:string}>();return r.results.map(x=>JSON.parse(x.data));}
export async function getState(owner:string){const [profile,jobs,applications,runRecords,creds]=await Promise.all([readProfile(owner),rows('jobs',owner),rows('applications',owner),rows('runs',owner),E().DB.prepare('SELECT key FROM credentials WHERE owner=?').bind(owner).all<{key:string}>()]);const alioCheck=runRecords.find(r=>r.provider==='alio-check'),runs=runRecords.filter(r=>r.provider!=='alio-check'&&r.kind!=='job-detail');const saved=new Map(historyJobs.filter(j=>owner==='personal-owner'&&j.provider!=='wanted'&&!String(j.id).startsWith('wanted:')).map(j=>[j.id,j]));for(const j of jobs.filter(j=>j.provider!=='wanted'&&!String(j.id).startsWith('wanted:'))){const run=runs.find(r=>r.provider===j.provider);saved.set(j.id,{...classifyJobSections(j),locationMatch:regionMatch(j,profile.regions),refreshFailed:(j.provider==='company'&&!(profile.companyBoards??[]).some(b=>b.url===j.boardUrl))||(run?.status==='error'&&(!j.fetchedAt||run.attemptedAt>=j.fetchedAt))||(['alio','saramin','jobkorea','work24','company'].includes(j.provider)&&['success','partial'].includes(run?.status)&&(!j.fetchedAt||run.attemptedAt>j.fetchedAt))});}return {profile,jobs:[...saved.values()],applications:applications.filter(a=>!String(a.id).startsWith('wanted:')&&hasApplicationRecord(a)),runs:runs.filter(r=>r.provider!=='wanted'),sources:sourceCatalog.map(s=>s.id==='alio'?({...s,...alioConnection(owner==='personal-owner'?E():{...E(),ALIO_API_KEY:undefined}),connectionCheck:alioCheck??null}):({...s,configured:(s.id==='company'&&(profile.companyBoards?.length??0)>0)||s.mode==='public'||s.mode==='temporary'||(['saramin','work24'].includes(s.id)&&profile[s.id==='saramin'?'saraminMode':'work24Mode']!=='api')||creds.results.some(c=>c.key===owner+':'+s.id),hasCredential:creds.results.some(c=>c.key===owner+':'+s.id)})),serverTime:new Date().toISOString()};}
export async function saveProfile(owner:string,p:Profile){if(p.companyBoards===undefined)p={...p,companyBoards:(await readProfile(owner)).companyBoards??[]};await E().DB.prepare('INSERT INTO profiles(owner,data,updated_at) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind(owner,JSON.stringify(p),new Date().toISOString()).run();}
async function encryptionKey(){const k=E().APP_ENCRYPTION_KEY;if(!k)throw new Error('키 보관 설정이 준비되지 않았습니다.');return crypto.subtle.importKey('raw',Uint8Array.from(atob(k),c=>c.charCodeAt(0)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function saveKey(owner:string,provider:string,value:string){const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(owner+':'+provider)},await encryptionKey(),new TextEncoder().encode(value));const blob=JSON.stringify({iv:btoa(String.fromCharCode(...iv)),data:btoa(String.fromCharCode(...new Uint8Array(cipher)))});await E().DB.prepare('INSERT INTO credentials(key,owner,cipher) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET cipher=excluded.cipher').bind(owner+':'+provider,owner,blob).run();}
export async function removeKey(owner:string,provider:string){await E().DB.prepare('DELETE FROM credentials WHERE key=? AND owner=?').bind(owner+':'+provider,owner).run();}
async function getKey(owner:string,provider:string){const r=await E().DB.prepare('SELECT cipher FROM credentials WHERE key=? AND owner=?').bind(owner+':'+provider,owner).first<{cipher:string}>();if(!r)return null;const c=JSON.parse(r.cipher);return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(atob(c.iv),x=>x.charCodeAt(0)),additionalData:new TextEncoder().encode(owner+':'+provider)},await encryptionKey(),Uint8Array.from(atob(c.data),x=>x.charCodeAt(0))));}
export async function saveApplication(owner:string,id:string,status:string,note:string){const data={id,status,note,bookmarked:true,updatedAt:new Date().toISOString()};await E().DB.prepare('INSERT INTO applications(key,owner,data) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET data=json_set(excluded.data, \'$.bookmarked\', json(CASE WHEN json_extract(applications.data, \'$.bookmarked\')=0 THEN \'false\' ELSE \'true\' END))').bind(owner+':'+id,owner,JSON.stringify(data)).run();return data;}
// Selected saved vacancies may be absent from the newest capped search list.
// Reserve one owner-wide slot per minute; no arbitrary URLs, keys, retries or list requests.
export async function refreshJobDetail(owner:string,id:string){
 detailRefreshSchema.parse({id});
 const stored=await E().DB.prepare('SELECT data FROM jobs WHERE key=? AND owner=?').bind(owner+':'+id,owner).first<{data:string}>();
 if(!stored)throw new Error('JOB');const previous=JSON.parse(stored.data),provider=id.split(':')[0];
 if(previous.id!==id||previous.provider!==provider||!previous.company||!previous.title)throw new Error('JOB');
 const recordKey=owner+':job-detail',cutoff=new Date(Date.now()-60000).toISOString();
 const priorRow=await E().DB.prepare('SELECT data FROM runs WHERE key=? AND owner=?').bind(recordKey,owner).first<{data:string}>(),prior=priorRow?JSON.parse(priorRow.data):null;
 const retry=(record:any)=>Math.max(1,Math.ceil((Date.parse(record?.attemptedAt||'')+60000-Date.now())/1000)||60);
 if(prior?.attemptedAt&&prior.attemptedAt>=cutoff)return {cached:true,status:prior.status,jobId:prior.jobId,retryAfter:retry(prior),message:'개별 상세 조회는 1분 간격입니다. 잠시 후 다시 시도해 주세요.'};
 const attemptedAt=new Date().toISOString(),lock={provider:'job-detail',kind:'job-detail',jobId:id,status:'running',attemptedAt};
 const reserved=await E().DB.prepare('INSERT INTO runs(key,owner,data) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data WHERE json_extract(runs.data,\'$.attemptedAt\') < ?').bind(recordKey,owner,JSON.stringify(lock),cutoff).run();
 if(!reserved.meta.changes)return {cached:true,status:'running',jobId:id,retryAfter:60,message:'다른 개별 상세 조회가 진행 중이거나 조회 간격을 기다리고 있습니다.'};
 const seed:any={...previous,listingFetchedAt:previous.listingFetchedAt||previous.fetchedAt,duties:'담당업무 원문 확인 대기',requirements:'필수요건 원문 확인 대기',preferred:'우대사항 원문 확인 대기',verification:'summary',note:'선택한 공고의 공개 상세 페이지 확인',rawText:`이전 목록 확인: ${previous.listingFetchedAt||previous.fetchedAt||'확인 기록 없음'}\n회사: ${previous.company}\n제목: ${previous.title}`};
 for(const key of ['bodyText','bodySectionFields','sectionAnalysis','detailImages','detailStatus','detailFetchedAt','detailSourceUrl','detailFrames','detailError','detailCoverage','qualificationText','qualificationPreferred','detailFacts','metadataFetchedAt','previousDetail','detailRetained','detailIssueCode','detailMessage','detailAttemptedAt','lastDetailRefresh','refreshFailed'])delete seed[key];
 let incoming:any;
 try{
  const host=provider==='saramin'?'https://www.saramin.co.kr':'https://www.jobkorea.co.kr';
  let robots;try{robots=await getText(host+'/robots.txt',{headers:{'User-Agent':CRAWLER_AGENT}});}catch{throw new Error('robots 접근 정책 확인 실패');}
  [incoming]=await collectDetails([seed],provider,(url:string)=>robotsAllowed(robots,url));
 }catch(error){incoming=detailFailure(seed,error,attemptedAt);}
 // Only a newly identified employer page may advance the main evidence date.
 if(incoming.metadataFetchedAt)incoming.fetchedAt=incoming.metadataFetchedAt;
 const status=incoming.bodyText?'success':incoming.metadataFetchedAt?'partial':'error';
 const message=status==='success'?'선택한 공고의 본문을 수집하고 항목을 분류했습니다.':status==='partial'?'공고 표준 정보 확인 · 본문 또는 이미지 내용은 추가 확인이 필요합니다.':'개별 상세 확인 실패 · 이전 확인 자료와 시각을 보존했습니다.';
 const run={...lock,status,completedAt:new Date().toISOString(),message};
 const data=retainPreviousDetail({...incoming,lastDetailRefresh:run},previous);
 const changes=await E().DB.batch([
  E().DB.prepare('UPDATE jobs SET data=? WHERE key=? AND owner=? AND data=?').bind(JSON.stringify(data),owner+':'+id,owner,stored.data),
  E().DB.prepare('UPDATE runs SET data=? WHERE key=? AND owner=?').bind(JSON.stringify(run),recordKey,owner)
 ]);
 if(!changes[0].meta.changes){const newer={...run,status:'superseded',message:'다른 조회에서 공고 정보가 변경되어 최신 저장 자료를 유지했습니다.'};await E().DB.prepare('UPDATE runs SET data=? WHERE key=? AND owner=?').bind(JSON.stringify(newer),recordKey,owner).run();return {...newer,cached:false,retryAfter:60};}
 return {...run,cached:false,retryAfter:60};
}

export async function refresh(owner:string){
 let profile=await readProfile(owner);const scope=searchScope(profile);if(!profile.regions.length||!profile.keywords.trim())return [{provider:'setup',status:'unconfigured',message:'희망 직무·검색 키워드·지역을 먼저 저장해 주세요.'}];profile={...profile,keywords:[profile.desiredRole,profile.keywords].filter(Boolean).join(',')};const profileKey=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(collectionKey(profile))))).map(x=>x.toString(16).padStart(2,'0')).join('');const results:Record<string,any>[]=[];
 for(const provider of ['alio','jobaram','saramin','jobkorea','work24','company']){
  const previous=await E().DB.prepare('SELECT data FROM runs WHERE key=?').bind(owner+':'+provider).first<{data:string}>(),prior=previous?JSON.parse(previous.data):null;
  if(prior?.attemptedAt&&(prior.profileKey===profileKey||Date.now()-Date.parse(prior.attemptedAt)<60000)&&Date.now()-Date.parse(prior.attemptedAt)<(provider==='jobaram'?60000:900000)){results.push({...prior,cached:true});continue;}
  let key:string|null=null;
  let mode=['jobaram','company'].includes(provider)?'public':provider==='jobkorea'?'temporary':'api';
  if(provider==='company'&&!profile.companyBoards?.length){results.push({provider,status:'unconfigured',message:'기업의 Greenhouse·Lever 공식 채용목록 URL을 등록해 주세요. 별도 API 인증 승인은 필요하지 않습니다.',attemptedAt:null,successAt:prior?.successAt??null});continue;}
  if(!['jobaram','jobkorea','company'].includes(provider)){
   const hybrid=['saramin','work24'].includes(provider),setting=provider==='saramin'?profile.saraminMode:profile.work24Mode;
   key=provider==='alio'?(owner==='personal-owner'?E().ALIO_API_KEY?.trim()??null:null):hybrid&&setting==='temporary'?null:await getKey(owner,provider);
   if(hybrid&&(setting==='temporary'||(setting!=='api'&&!key)))mode='temporary';
   if(!key&&mode!=='temporary'){results.push({provider,status:'unconfigured',message:provider==='alio'?alioConnection(owner==='personal-owner'?E():{...E(),ALIO_API_KEY:undefined}).message:'승인된 API 키 연결 대기',attemptedAt:null,successAt:prior?.successAt??null});continue;}
  }
  let run;const attemptedAt=new Date().toISOString(),lock={provider,mode,profileKey,status:'running',attemptedAt,successAt:prior?.successAt??null,message:'원문 확인 중'};
  const reserved=await E().DB.prepare('INSERT INTO runs(key,owner,data) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data WHERE json_extract(runs.data,\'$.attemptedAt\') < ? OR (COALESCE(json_extract(runs.data,\'$.profileKey\'),\'\') != ? AND json_extract(runs.data,\'$.attemptedAt\') < ?)').bind(owner+':'+provider,owner,JSON.stringify(lock),new Date(Date.now()-(provider==='jobaram'?60000:900000)).toISOString(),profileKey,new Date(Date.now()-60000).toISOString()).run();
  if(!reserved.meta.changes){results.push({...prior,cached:true});continue;}
  try{const backlog=(await rows('jobs',owner)).filter(j=>j.provider===provider&&j.searchScope===scope&&regionMatch(j,profile.regions)==='match');const fetched=provider==='company'?await fetchCompany(profile):provider==='alio'?await fetchAlio(key,profile):provider==='jobaram'?await fetchJobaram():provider==='jobkorea'?await fetchJobkoreaTemporary(profile,backlog):provider==='saramin'?(mode==='temporary'?await fetchSaraminTemporary(profile,backlog):await fetchSaraminWithDetails(key,profile,backlog)):mode==='temporary'?await fetchWork24Temporary(profile):await fetchWork24(key,profile);const terms=profile.keywords.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);const jobs=Object.assign(fetched.filter((j:any)=>terms.some(t=>[j.title,j.duties].join(' ').toLowerCase().includes(t))),{collection:(fetched as any).collection});if(jobs.length){const previousJobs=['saramin','jobkorea'].includes(provider)?new Map((await rows('jobs',owner)).filter(j=>j.provider===provider).map(j=>[j.id,j])):new Map();await E().DB.batch(jobs.map((job:any)=>{const data={...retainPreviousDetail(job,previousJobs.get(job.id)),searchScope:scope};return E().DB.prepare('INSERT INTO jobs(key,owner,data) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').bind(owner+':'+job.id,owner,JSON.stringify(data));}));}run={provider,mode,profileKey,status:(jobs as any).collection?.detailFailed?'partial':'success',attemptedAt,successAt:new Date().toISOString(),count:jobs.length,detailPending:(jobs as any).collection?.detailPending,detailText:(jobs as any).collection?.detailText,detailImages:(jobs as any).collection?.detailImages,boards:(jobs as any).collection?.boards??undefined,message:['saramin','jobkorea'].includes(provider)?`${jobs.length}건 ${mode==='api'?'API 목록':'임시 목록'} · 본문 텍스트 ${(jobs as any).collection?.detailText??0}건 · 이미지형 ${(jobs as any).collection?.detailImages??0}건 · 나머지 상세 확인 필요`:provider==='company'?`${jobs.length}건 조건 일치 · 등록 기업의 공개 채용목록 확인${(jobs as any).collection?.detailFailed?' · 일부 본문/기업 확인 필요':''}`:mode==='temporary'?`${jobs.length}건 임시 수집${provider==='work24'?' · 고용24 직접등록 공고만 대상':''} · 상세 본문 검증 대기${(jobs as any).collection?.detailFailed?' · 일부 상세 페이지 확인 실패':''}`:provider==='alio'?`${jobs.length}건 공식 상세 수집 · 담당업무·직무별 요건 추가 확인 필요 (목록 최대 100건·상세 최대 8건)`:provider==='saramin'?`${jobs.length}건 요약 수집 · 상세 검증 필요`:`${jobs.length}건 원문 수집 완료`};}
  catch(e){run={provider,mode,profileKey,status:'error',attemptedAt,successAt:prior?.successAt??null,message:e instanceof Error?e.message:'출처 확인 실패'};}
  await E().DB.prepare('UPDATE runs SET data=? WHERE key=? AND owner=?').bind(JSON.stringify(run),owner+':'+provider,owner).run();results.push(run);
 }
 return results;
}

export async function checkAlioConnection(owner:string){
 const key=owner==='personal-owner'?E().ALIO_API_KEY?.trim()??'':'',recordKey=owner+':alio-check';
 const previous=await E().DB.prepare('SELECT data FROM runs WHERE key=?').bind(recordKey).first<{data:string}>(),prior=previous?JSON.parse(previous.data):null;
 if(prior?.attemptedAt&&Date.now()-Date.parse(prior.attemptedAt)<60000&&prior.hasCredential===Boolean(key))return {...prior,cached:true};
 const attemptedAt=new Date().toISOString(),lock={provider:'alio-check',attemptedAt,hasCredential:Boolean(key),status:'running'};
 const reserved=await E().DB.prepare('INSERT INTO runs(key,owner,data) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data WHERE json_extract(runs.data,\'$.attemptedAt\') < ? OR json_extract(runs.data,\'$.hasCredential\') != ?').bind(recordKey,owner,JSON.stringify(lock),new Date(Date.now()-60000).toISOString(),Number(Boolean(key))).run();
 if(!reserved.meta.changes)return {...prior,cached:true};
 const result={provider:'alio-check',attemptedAt,...await probeAlio(key)};
 await E().DB.prepare('UPDATE runs SET data=? WHERE key=? AND owner=?').bind(JSON.stringify(result),recordKey,owner).run();return result;
}

export async function setBookmark(owner:string,id:string,bookmarked:boolean){
 const data={id,status:'관심',note:'',bookmarked,updatedAt:new Date().toISOString()};
 await E().DB.prepare("INSERT INTO applications(key,owner,data) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET data=json_set(applications.data, '$.bookmarked', json(?))").bind(owner+':'+id,owner,JSON.stringify(data),JSON.stringify(bookmarked)).run();
 const row=await E().DB.prepare('SELECT data FROM applications WHERE key=? AND owner=?').bind(owner+':'+id,owner).first<{data:string}>();
 return JSON.parse(row!.data);
}
