import specification from '../config/alio.json' with {type:'json'};
import {plain, normalize, dateOnly} from './policy.mjs';
import {getText} from './providers.mjs';
import {providerRegions,alioRegionIds,regionMatch} from './regions.mjs';

// Codes: MOEF_NKOD_DB_05_CODE_DOC_v1.2, pp. 5–6. R2030 is NOT 경력무관.
export const ALIO_REGIONS = Object.freeze({'대전':'R3012','세종':'R3026','충남':'R3019','충북':'R3020'});
const EXPERIENCE = {'R2010':'신입','R2020':'경력','R2030':'신입+경력','R2040':'외국인 전형'};
const EDUCATION = {'R7010':'학력무관','R7020':'중졸이하','R7030':'고졸','R7040':'대졸(2~3년)','R7050':'대졸(4년)','R7060':'석사','R7070':'박사'};
const EMPLOYMENT = {'R1010':'정규직','R1020':'계약직','R1030':'무기계약직','R1040':'비정규직','R1050':'청년인턴','R1060':'청년인턴(체험형)','R1070':'청년인턴(채용형)'};
const REGION_NAMES = Object.fromEntries(Object.entries(ALIO_REGIONS).map(([name, code])=>[code,name]));
const text = value => typeof value==='string'||typeof value==='number' ? plain(String(value)) : '';
const codes = value => text(value).split(/[,|;\s]+/).filter(Boolean);
const codeNames = (value, dictionary) => codes(value).map(code=>dictionary[code]||`미확인 코드 ${code}`).join(', ');
// The provider documents both 0 (normal) and 200 (success); detail codes can be strings.
// A success code is only a first check. List/detail structure and identities are validated below.
const successCode = value => typeof value==='number' ? value===0||value===200 : typeof value==='string'&&/^(?:0+|200)$/.test(value.trim());
export function alioConnection(env){
 const hasCredential=Boolean(env.ALIO_API_KEY?.trim());
 return {hasCredential,configured:hasCredential&&specification.ready,ready:specification.ready,
  credentialPresent:hasCredential,message:hasCredential?'서버가 ALIO_API_KEY를 인식했습니다. 연결 확인으로 실제 API 조회를 시도해 인증·승인 상태를 점검할 수 있습니다.':'현재 실행 중인 서버에 ALIO_API_KEY가 전달되지 않았습니다. 실제 Worker의 Settings → Variables and Secrets에 Secret으로 등록하고 배포해 주세요. Builds 변수와 다릅니다.'};
}
export function alioDate(value){
 const s=text(value);return dateOnly(/^20\d{6}$/.test(s)?`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`:s);
}
export function alioUrl(value){
 try{const u=new URL(text(value));return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}
}
function apiError(code){
 code=String(Number(code));
 if(['7','20','30','31'].includes(code))return '알리오 인증·이용 승인을 확인해 주세요. data.go.kr의 해당 서비스 승인 인증키(Decoding)가 필요합니다.';
 if(['22','23'].includes(code))return '알리오 API 호출 한도에 도달했습니다. 기존 자료를 최신으로 처리하지 않았습니다.';
 return '알리오 API가 오류를 반환했습니다. 승인 상태와 공식 명세를 확인해 주세요.';
}
export function alioEnvelope(data){
 if(!data||typeof data!=='object'||!Object.hasOwn(data,'resultCode'))throw new Error('알리오 응답 형식이 공식 명세와 다릅니다. 기존 자료를 최신으로 처리하지 않았습니다.');
 if(!successCode(data.resultCode))throw new Error(apiError(data.resultCode));
 return data;
}
function listRows(data){
 const result=alioEnvelope(data).result;
 // Swagger describes array entries wrapped in item; JSON serializers may omit that wrapper.
 const rows=Array.isArray(result)?result:Array.isArray(result?.item)?result.item:null;
 if(!rows)throw new Error('알리오 목록 구조를 확인하지 못했습니다.');
 return rows.map(row=>row?.item??row);
}
function identity(row){
 const id=text(row?.recrutPblntSn);
 if(!/^\d{1,18}$/.test(id)||!text(row?.recrutPbancTtl)||!text(row?.instNm))throw new Error('알리오 공고 식별 정보가 누락되거나 변경되었습니다.');
 return id;
}
export function parseAlioDetail(data, expectedId, now=new Date().toISOString()){
 const row=alioEnvelope(data).result;
 const id=identity(row);
 if(id!==String(expectedId))throw new Error('알리오 상세 공고 번호가 요청과 달라 수집을 중단했습니다.');
 const startDate=alioDate(row.pbancBgngYmd),deadline=alioDate(row.pbancEndYmd);
 const experience=text(row.recrutSeNm)||codeNames(row.recrutSe,EXPERIENCE)||'원문 확인 필요';
 const education=text(row.acbgCondNmLst)||codeNames(row.acbgCondLst,EDUCATION)||'원문 확인 필요';
 const qualifications=text(row.aplyQlfcCn),preferred=[text(row.prefCn),text(row.prefCondCn)].filter(Boolean);
 const files=Array.isArray(row.files)?row.files:Array.isArray(row.files?.file)?row.files.file:[];
 const attachments=files.map(f=>f?.file??f).map(f=>({name:text(f.atchFileNm)||'첨부파일',type:text(f.atchFileType),url:alioUrl(f.url)})).filter(f=>f.url);
 const nowMs=Date.parse(now),started=startDate&&Date.parse(startDate+'T00:00:00+09:00')<=nowMs;
 const openStatus=row.ongoingYn==='N'||(deadline&&Date.parse(deadline+'T23:59:59+09:00')<nowMs)?'closed':row.ongoingYn==='Y'&&started&&deadline?'open':'unknown';
 // Keep only known public fields, never a raw response that could echo credentials.
 const evidence={};
 for(const key of ['recrutPblntSn','recrutPbancTtl','instNm','pbancBgngYmd','pbancEndYmd','ongoingYn','workRgnLst','workRgnNmLst','hireTypeLst','hireTypeNmLst','acbgCondLst','acbgCondNmLst','recrutSe','recrutSeNm','ncsCdLst','ncsCdNmLst','aplyQlfcCn','prefCn','prefCondCn','disqlfcRsn','scrnprcdrMthdExpln','srcUrl'])evidence[key]=text(row[key]);
 return {id:'alio:'+id,provider:'alio',collectionMode:'api',regionIds:alioRegionIds(row.workRgnLst),country:codes(row.workRgnLst).every(c=>c==='R3030')?'foreign':'domestic',company:text(row.instNm),title:text(row.recrutPbancTtl),
  location:text(row.workRgnNmLst)||codeNames(row.workRgnLst,REGION_NAMES)||'원문 확인 필요',
  employment:text(row.hireTypeNmLst)||codeNames(row.hireTypeLst,EMPLOYMENT)||'원문 확인 필요',
  experience,education,startDate,deadline,deadlinePrecision:'date',
  duties:'공식 API에 담당업무 전용 필드가 없습니다. 공고 원문·첨부 직무기술서를 확인해 주세요.',
  requirements:qualifications||'API 신청자격 내용 미기재 · 필수요건 원문 확인 필요',
  preferred:[...new Set(preferred)].join('\n')||'API 우대사항 미기재 · 원문 확인 필요',
  sourceUrl:alioUrl(row.srcUrl),attachments,fetchedAt:now,verification:'summary',openStatus,
  rawText:JSON.stringify({...evidence,files:attachments},null,2),
  note:'ALIO 공식 상세 API 수집 · 공고 단위 자격·우대 정보입니다. 모집 직무별 담당업무·근무지 배치·자격요건과 정확한 마감 시각은 원문·직무기술서에서 추가 확인해야 합니다.'};
}
async function request(path,key,params){
 const u=new URL(specification.baseUrl+path);
 for(const [name,value] of Object.entries({serviceKey:key,resultType:'json',...params}))u.searchParams.set(name,String(value));
 let raw;
 try{raw=await getText(u.href,{headers:{Accept:'application/json'}});}catch(e){
  const httpStatus=Number(e instanceof Error?e.message.match(/HTTP (\d{3})/)?.[1]:0)||null;
  throw Object.assign(new Error(httpStatus===401||httpStatus===403?'알리오 API가 인증·이용 권한을 거부했습니다. 발급처와 해당 서비스 승인 상태를 확인해 주세요.':'알리오 API에 연결하지 못했습니다. 시간 초과·네트워크·제공기관 상태를 확인해 주세요.'),{kind:httpStatus===401||httpStatus===403?'authorization':'transport',httpStatus});
 }
 let data;try{data=JSON.parse(raw);}catch{
  // Gateway errors can be XML even when resultType=json. Never reflect upstream messages/URLs.
  if(/SERVICE_KEY|SERVICE_ACCESS|PERMISSION_DENIED|DEADLINE_HAS_EXPIRED/.test(raw))throw Object.assign(new Error(apiError('20')),{kind:'authorization',code:'20'});
  if(/LIMITED_NUMBER/.test(raw))throw Object.assign(new Error(apiError('22')),{kind:'quota',code:'22'});
  throw Object.assign(new Error('알리오 JSON 응답을 읽지 못했습니다. 인증·권한 또는 제공기관 장애를 확인해 주세요.'),{kind:'format'});
 }
 if(data&&Object.hasOwn(data,'resultCode')&&!successCode(data.resultCode)){const code=/^\d{1,3}$/.test(String(data.resultCode))?String(Number(data.resultCode)):null;throw Object.assign(new Error(apiError(code)),{kind:['7','20','30','31'].includes(code)?'authorization':['22','23'].includes(code)?'quota':'upstream',code});}
 return alioEnvelope(data);
}
export async function probeAlio(key){
 const checkedAt=new Date().toISOString(),hasCredential=Boolean(key?.trim());
 if(!hasCredential)return {checkedAt,hasCredential:false,requestAttempted:false,authenticated:false,status:'missing-key',message:'현재 Worker가 ALIO_API_KEY를 읽지 못합니다. Worker Settings → Variables and Secrets → Secret에 등록·배포해 주세요.',action:'runtime-secret'};
 try{
  const data=await request('/list',key.trim(),{pageNo:1,numOfRows:1});for(const row of listRows(data))identity(row);
  return {checkedAt,hasCredential:true,requestAttempted:true,authenticated:true,status:'authenticated',code:String(Number(data.resultCode)),message:'공식 API가 인증정보를 받아들였습니다. 채용공고 수집·조건 일치 여부와는 별도입니다.',action:'refresh-jobs'};
 }catch(e){
  return {checkedAt,hasCredential:true,requestAttempted:true,authenticated:false,status:e?.kind||'format',httpStatus:e?.httpStatus??null,code:e?.code??null,message:e instanceof Error?e.message:'알리오 응답을 확인하지 못했습니다.',action:e?.kind==='authorization'?'check-issuer-approval':'check-response'};
 }
}
function relevant(row,profile){
 const inRegion=regionMatch({regionIds:alioRegionIds(row.workRgnLst),location:row.workRgnNmLst,country:codes(row.workRgnLst).every(c=>c==='R3030')?'foreign':'domestic'},profile.regions)!=='none';
 const haystack=normalize([row.recrutPbancTtl,row.aplyQlfcCn,row.prefCn,row.prefCondCn].map(text).join(' ')).toLowerCase();
 const terms=profile.keywords.split(',').map(normalize).filter(Boolean);
 return inRegion&&terms.some(t=>haystack.includes(t.toLowerCase()));
}
export async function fetchAlio(key,profile){
 if(!specification.ready)throw new Error('알리오 공식 명세 확인 전입니다.');
 if(!key?.trim())throw new Error('알리오 API 인증키가 설정되지 않았습니다.');
 const regions=providerRegions(profile.regions,'alio');
 const found=new Map();
 for(let page=1;page<=specification.maxPages;page++){
  const data=await request('/list',key.trim(),{pageNo:page,numOfRows:specification.pageSize,ongoingYn:'Y',...(regions.length?{workRgnLst:regions.join(',')}:{})});
  const rows=listRows(data);
  for(const row of rows){const id=identity(row);if(relevant(row,profile))found.set(id,row);}
  if(rows.length<specification.pageSize||(Number.isFinite(+data.totalCount)&&page*specification.pageSize>=+data.totalCount))break;
 }
 const candidates=[...found.values()].sort((a,b)=>{
  const priority=r=>r.recrutSe==='R2010'?0:r.recrutSe==='R2030'?1:2;
  return priority(a)-priority(b)||alioDate(a.pbancEndYmd).localeCompare(alioDate(b.pbancEndYmd));
 }).slice(0,specification.maxDetails);
 const jobs=[];
 for(let i=0;i<candidates.length;i+=2){
  const batch=await Promise.all(candidates.slice(i,i+2).map(async row=>{
   const id=identity(row),data=await request('/detail',key.trim(),{sn:id});
   // A changed region/role between list and detail must not be silently retained.
   const job=parseAlioDetail(data,id);return relevant(data.result,profile)?job:null;
  }));
  jobs.push(...batch.filter(Boolean));
 }
 return jobs;
}
