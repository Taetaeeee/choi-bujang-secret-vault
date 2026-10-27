import {getText} from './providers.mjs';
import {plain,normalize,dateOnly} from './policy.mjs';
import {inferredRegionIds} from './regions.mjs';
import {analyzeSections,classifyJobSections,explicitSections,isSectionHeading} from './job-sections.mjs';
export {explicitSections} from './job-sections.mjs';

const HOSTS={saramin:'https://www.saramin.co.kr',jobkorea:'https://www.jobkorea.co.kr'};
const VOID=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const BLOCK=new Set(['p','div','section','article','main','h1','h2','h3','h4','h5','h6','ul','ol','li','dl','dt','dd','table','tr','th','td']);
const unique=items=>[...new Set(items.filter(Boolean))];
const cls=(node,name)=>(node.attrs?.class||'').split(/\s+/).includes(name);
function all(node,predicate){const out=[];function visit(n){if(typeof n!=='object')return;if(predicate(n))out.push(n);for(const c of n.children??[])visit(c);}visit(node);return out;}
function text(node){
 function visit(n){if(typeof n==='string')return n;if(['script','style','button','noscript','svg'].includes(n.tag)||n.attrs?.hidden!==undefined||/display\s*:\s*none/i.test(n.attrs?.style||''))return '';const value=(n.children??[]).map(visit).join('');return n.tag==='br'?'\n':BLOCK.has(n.tag)||(['strong','b','span'].includes(n.tag)&&isSectionHeading(plain(value)))?'\n'+value+'\n':value;}
 return plain(visit(node)).replace(/\n{3,}/g,'\n\n').trim();
}
// HTMLRewriter decodes no JavaScript and loads no resources. Document text runs once per chunk.
async function tree(html){
 const root={tag:'root',attrs:{},children:[]},stack=[root];let nodes=0;
 const rewriter=new HTMLRewriter().on('*',{element(e){
  if(++nodes>60000)throw new Error('상세 문서 구조가 처리 상한을 초과했습니다.');
  const node={tag:e.tagName,attrs:Object.fromEntries(e.attributes),children:[]};stack.at(-1).children.push(node);
  if(!VOID.has(e.tagName)){try{e.onEndTag(()=>{const at=stack.lastIndexOf(node);if(at>0)stack.length=at;});stack.push(node);}catch{/* Self-closing SVG elements have no end tag. */}}
 }}).onDocument({text(chunk){stack.at(-1).children.push(chunk.text);}});
 await new Response(rewriter.transform(new Response(html)).body).text();return root;
}
function parts(content){const parsed=analyzeSections(content);return {...explicitSections(content),ambiguous:parsed.ambiguous};}
const companyKey=s=>normalize(s).replace(/주식회사|\(주\)|㈜|\s/g,'').toLowerCase();
const titleKey=s=>normalize(s).replace(/[\s\u00a0]+/g,' ').trim();
function meta(root,name){return all(root,n=>n.tag==='meta'&&(n.attrs.property===name||n.attrs.name===name))[0]?.attrs.content||'';}
function canonical(root){return all(root,n=>n.tag==='link'&&n.attrs.rel==='canonical')[0]?.attrs.href||meta(root,'og:url');}
export function frameUrl(value,provider,id){
 try{
  const u=new URL(plain(value),HOSTS[provider]);if(u.origin!==HOSTS[provider]||u.username||u.password||u.hash)return '';
  if(provider==='saramin'&&u.pathname==='/zf_user/jobs/relay/view-detail'&&u.searchParams.get('rec_idx')===String(id)&&/^\d{1,3}$/.test(u.searchParams.get('rec_seq')||''))return `${u.origin}${u.pathname}?rec_idx=${id}&rec_seq=${u.searchParams.get('rec_seq')}`;
  if(provider==='jobkorea'&&u.pathname==='/Recruit/GI_Read_Comt_Ifrm'&&u.searchParams.get('Gno')===String(id)){
   const out=new URL(u.origin+u.pathname);out.searchParams.set('Gno',String(id));for(const k of ['isHiringCenter','hideMapView'])if(['true','false'].includes(u.searchParams.get(k)))out.searchParams.set(k,u.searchParams.get(k));return out.href;
  }
 }catch{}return '';
}
export function detailImageUrl(value,provider){
 try{
  const u=new URL(plain(value),HOSTS[provider]);if(u.protocol!=='https:'||u.username||u.password||u.port)return '';
  if(provider==='jobkorea'&&u.hostname==='file2.jobkorea.co.kr'&&u.pathname==='/Net/Mng/DownImage/CorpEditor'&&/^\d{1,18}$/.test(u.searchParams.get('file_No')||''))return `${u.origin}${u.pathname}?file_No=${u.searchParams.get('file_No')}`;
  if(provider==='saramin'&&['www.saraminimage.co.kr','saraminimage.co.kr'].includes(u.hostname)&&!/(?:template|toptype|logo|icon|talent|designed)/i.test(u.pathname))return u.href;
 }catch{}return '';
}
function images(root,provider,now){return unique(all(root,n=>n.tag==='img').map(n=>detailImageUrl(n.attrs.src||n.attrs['data-src'],provider))).slice(0,4).map(url=>({url,fetchedAt:now}));}
function frames(root,html,provider,id){
 const links=all(root,n=>n.tag==='iframe').map(n=>n.attrs.src||'');
 if(provider==='jobkorea'){
  // Read URL strings from public React payloads without evaluating those scripts.
  const source=html.replace(/\\+u0026/gi,'&').replace(/\\\//g,'/');
  links.push(...(source.match(/\/Recruit\/GI_Read_Comt_Ifrm\?[^\\\s"'<>]+/g)||[]));
 }
 return unique(links.map(value=>frameUrl(value,provider,id)));
}
function identity(root,job){
 const provider=job.provider,id=job.id.split(':')[1],raw=canonical(root);let url;
 try{url=new URL(plain(raw));}catch{throw new Error('상세 공고의 공식 주소를 확인하지 못했습니다.');}
 const valid=url.origin===HOSTS[provider]&&!url.username&&!url.password&&(provider==='saramin'?['/zf_user/jobs/view','/zf_user/jobs/relay/view'].includes(url.pathname)&&url.searchParams.get('rec_idx')===id:url.pathname==='/Recruit/GI_Read/'+id);
 const title=titleKey(plain(meta(root,'og:title')));
 if(!valid||!title.includes(titleKey(job.title))||!companyKey(title).includes(companyKey(job.company)))throw new Error('상세 공고번호·회사·제목이 목록과 일치하지 않습니다.');
}
function tableSections(root){
 const candidates=[];
 for(const table of all(root,n=>n.tag==='table')){
  const rows=[];function scan(n){for(const c of n.children??[]){if(typeof c!=='object'||c.tag==='table')continue;if(c.tag==='tr')rows.push(c);else scan(c);}}scan(table);
  const cells=row=>(row.children??[]).filter(n=>typeof n==='object'&&['td','th'].includes(n.tag));
  const index=rows.findIndex(row=>cells(row).some(c=>/^(담당\s*업무|주요\s*업무)$/.test(normalize(text(c)))));if(index<0)continue;
  const headers=cells(rows[index]).map(c=>normalize(text(c))),data=rows.slice(index+1).filter(row=>cells(row).length===headers.length);
  if(data.length!==1)continue;const out={duties:'',requirements:'',preferred:''};
  cells(data[0]).forEach((cell,i)=>{
   const label=headers[i],value=text(cell),inner=explicitSections(value),p=Object.values(inner).some(Boolean)?inner:explicitSections(label+'\n'+value);
   if(/^(담당\s*업무|주요\s*업무)$/.test(label))p.duties=value;
   for(const key of ['duties','requirements','preferred'])if(p[key])out[key]=[out[key],p[key]].filter(Boolean).join('\n');
  });
  candidates.push(out);
 }
 return candidates.length===1?candidates[0]:{duties:'',requirements:'',preferred:''};
}
function bodyResult(job,root,sourceUrl,now){
 const body=text(root).slice(0,40000),imageList=images(root,job.provider,now),section=parts(body),table=section.ambiguous?{}:tableSections(root);
 const fields={duties:table.duties||section.duties,requirements:table.requirements||section.requirements,preferred:table.preferred||section.preferred};
 const usable=body.length>=20,status=usable?'text':imageList.length?'image':'metadata';
 return {...job,bodyText:usable?body:'',detailImages:imageList,detailSourceUrl:sourceUrl,detailAttemptedAt:now,
  ...(usable||imageList.length?{detailFetchedAt:now}:{}),detailStatus:status,detailRetained:false,
  bodySectionFields:table,detailCoverage:Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,Boolean(v)])),
  duties:fields.duties|| (usable?'본문 수집 완료 · 담당업무 항목 분리 확인 필요':job.duties),
  requirements:fields.requirements|| (usable?'본문 수집 완료 · 필수요건 항목 분리 확인 필요':job.requirements),
  preferred:fields.preferred||(usable?'본문에서 별도 우대사항을 확인하지 못했습니다.':job.preferred),
  detailMessage:section.ambiguous?'여러 모집분야의 본문입니다. 직무별 조건을 분리해 확인해 주세요.':status==='text'?'실제 본문 텍스트 수집 · 최종 지원요건 확인 필요':status==='image'?'이미지형 상세 공고 · 원본 이미지 확인 필요':'상세 화면 식별 완료 · 본문 미확인',
  verification:'summary',detailError:status==='metadata'?'상세 본문 텍스트·이미지를 확인하지 못했습니다.':undefined};
}
function saraminSummary(root){
 const section=all(root,n=>cls(n,'jv_cont')&&cls(n,'jv_summary'))[0],out={};
 if(!section)return out;
 for(const dl of all(section,n=>n.tag==='dl')){
  const label=all(dl,n=>n.tag==='dt')[0],value=all(dl,n=>n.tag==='dd')[0];
  if(label&&value)out[normalize(text(label))]=normalize(text(value));
 }
 return out;
}
export async function inspectSaraminDetail(html,job,now=new Date().toISOString()){
 const root=await tree(html);identity(root,job);
 const facts=saraminSummary(root),qualificationText=[facts['경력']&&'경력: '+facts['경력'],facts['학력']&&'학력: '+facts['학력']].filter(Boolean).join('\n');
 job={...job,experience:facts['경력']||job.experience,education:facts['학력']||job.education,employment:facts['근무형태']||job.employment,detailFacts:facts,qualificationText};
 const content=all(root,n=>cls(n,'user_content'))[0],body=content&&(all(content,n=>cls(n,'job-content'))[0]||content);
 let result=body?bodyResult(job,body,HOSTS.saramin+'/zf_user/jobs/view?rec_idx='+job.id.split(':')[1],now):{...job,detailStatus:'metadata',detailAttemptedAt:now,detailMessage:'공고 식별 완료 · iframe 본문 확인 필요',detailError:'상세 본문 미확인'};
 const description=plain(meta(root,'description')),deadline=dateOnly(description.match(/마감일\s*[:：]\s*([^,]+)/)?.[1]);
 if(deadline)result.deadline=deadline;
 return classifyJobSections({...result,metadataFetchedAt:now,detailFrames:frames(root,html,'saramin',job.id.split(':')[1]),note:'사람인 공개 상세 수집 · 명시된 항목만 표시하며 접수 상태·모집 직무별 조건은 추가 확인합니다.'});
}
function sectionRows(root,name){
 const section=all(root,n=>n.attrs?.['data-jobview-section']===name)[0];if(!section)return {};
 const labels=new Set(['모집분야','모집인원','고용형태','급여','근무시간','근무지주소','경력','학력','스킬','우대조건','자격증']),out={};
 function visit(n){
  if(typeof n!=='object')return;
  const children=(n.children??[]).filter(c=>typeof c==='object'),first=children[0],label=first&&normalize(text(first));
  if(labels.has(label)&&children.length>1){const value=children.slice(1).map(text).join('\n').replace(/지도보기/g,'').trim();if(value)out[label]=value;return;}
  for(const c of children)visit(c);
 }visit(section);return out;
}
function jobposting(root,job){
 const records=[];function walk(v){if(!v||typeof v!=='object')return;if(v['@type']==='JobPosting')records.push(v);for(const x of Object.values(v))if(x&&typeof x==='object')Array.isArray(x)?x.forEach(walk):walk(x);}
 for(const n of all(root,n=>n.tag==='script'&&n.attrs.type==='application/ld+json'))try{walk(JSON.parse(n.children.filter(c=>typeof c==='string').join('')));}catch{}
 return records.find(p=>titleKey(p.title)===titleKey(job.title)&&companyKey(p.hiringOrganization?.name)===companyKey(job.company));
}
export async function inspectJobkoreaDetail(html,job,now=new Date().toISOString()){
 const root=await tree(html);identity(root,job);
 const qualification=sectionRows(root,'qualification'),recruitment=sectionRows(root,'recruitment_info'),p=jobposting(root,job);
 const requirements=[qualification['경력']&&'경력: '+normalize(qualification['경력']),qualification['학력']&&'학력: '+normalize(qualification['학력'])].filter(Boolean).join('\n');
 const pref=qualification['우대조건']?.split('\n').filter(line=>!['자격증','외국어','전공'].includes(line.trim())).join('\n').replace(/^기본우대(?=\S)/,'기본우대: ');
 const body=all(root,n=>n.attrs?.id==='detail-content')[0];
 const baseline={...job,requirements:requirements||job.requirements,preferred:pref||job.preferred,
  experience:normalize(qualification['경력'])||job.experience,education:normalize(qualification['학력'])||job.education,
  employment:normalize(recruitment['고용형태'])||job.employment,salary:normalize(recruitment['급여'])||job.salary,
  ...(recruitment['근무지주소']?{location:normalize(recruitment['근무지주소']),regionIds:inferredRegionIds(recruitment['근무지주소'])}:{}),
  ...(p?.validThrough&&dateOnly(p.validThrough)?{deadline:dateOnly(p.validThrough)}:{}),
  qualificationText:requirements,qualificationPreferred:pref||'',detailFacts:{...recruitment,...qualification},metadataFetchedAt:now,
  detailAttemptedAt:now,detailStatus:'metadata',detailMessage:'지원자격·모집요강 수집 · 상세 본문은 별도 확인',
  detailFrames:frames(root,html,'jobkorea',job.id.split(':')[1]),verification:'summary',detailError:'상세 본문 미확인',
  note:'잡코리아 지원자격·모집요강과 본문을 구분합니다. 자격증의 필수·우대 여부를 추측하지 않습니다.'};
 // A generic JSON-LD description is not the employer's full description.
 return body?mergeQualification(bodyResult(baseline,body,job.sourceUrl,now)):classifyJobSections(baseline);
}
function mergeQualification(job){
 return classifyJobSections({...job,requirements:unique([job.qualificationText,job.detailCoverage?.requirements?job.requirements:'']).join('\n')||job.requirements,
  preferred:unique([job.qualificationPreferred,job.detailCoverage?.preferred?job.preferred:'']).join('\n')||job.preferred});
}
export async function inspectFrame(html,job,url,now=new Date().toISOString()){
 if(!frameUrl(url,job.provider,job.id.split(':')[1]))throw new Error('본문 프레임 주소·공고번호가 일치하지 않습니다.');
 const root=await tree(html),content=all(root,n=>job.provider==='saramin'?cls(n,'user_content'):n.attrs?.id==='detail-content')[0];
 if(!content)throw new Error('본문 프레임의 구조를 확인하지 못했습니다.');
 const body=job.provider==='saramin'?(all(content,n=>cls(n,'job-content'))[0]||content):content;
 return mergeQualification(bodyResult(job,body,url,now));
}
export function detailFailure(job,error,now=new Date().toISOString()){
 const message=error instanceof Error?error.message:'',http=message.match(/HTTP (\d{3})/)?.[1];
 const kind=/일치|식별|공식 주소/.test(message)?'identity-mismatch':http==='401'||http==='403'?'blocked':http?'http-error':/robots/.test(message)?'blocked':/상한/.test(message)?'budget':'error';
 return {...job,detailStatus:job.detailStatus==='metadata'?'partial':kind,detailAttemptedAt:now,detailIssueCode:kind,
  detailError:http?'본문 요청 HTTP '+http+' · 확보한 정보만 표시':kind==='blocked'?'본문 접근 제한 · 확보한 정보만 표시':kind==='identity-mismatch'?'공고 식별 불일치 · 새 본문을 저장하지 않았습니다.':kind==='budget'?'상세 요청 상한 · 목록 정보만 표시':'본문 요청 실패·시간 초과 또는 구조 변경 · 확보한 정보만 표시'};
}
export async function collectDetails(input,provider,allowed){
 // Four Saramin / three Jobkorea candidates, at most two requests per candidate.
 const limit=provider==='saramin'?4:3,result=[];let requests=0,failed=0,frameBudget=provider==='saramin'?4:2;
 for(const original of input){
  if(original.detailSkip){const copy={...original};delete copy.detailSkip;result.push(copy);continue;}
  if(result.length>=limit){result.push({...original,detailStatus:'budget',detailError:'상세 조회 건수 상한 · 목록 정보만 표시',detailAttemptedAt:new Date().toISOString()});failed++;continue;}
  let job={...original,detailRetained:false};const id=job.id.split(':')[1];
  try{
   if(!/^\d{1,18}$/.test(id))throw new Error('공고 식별 정보 불일치');
   const url=provider==='saramin'?HOSTS.saramin+'/zf_user/jobs/view?rec_idx='+id:HOSTS.jobkorea+'/Recruit/GI_Read/'+id;
   if(!allowed(url))throw new Error('robots 접근 제한');requests++;
   const html=await getText(url);job=provider==='saramin'?await inspectSaraminDetail(html,job):await inspectJobkoreaDetail(html,job);
   const frame=job.detailFrames?.[0];
   if(!['text','image'].includes(job.detailStatus)&&frame){
    if(!allowed(frame))throw new Error('robots 본문 접근 제한');if(frameBudget<=0)throw new Error('본문 프레임 요청 상한');frameBudget--;requests++;
    job=await inspectFrame(await getText(frame,{headers:{Referer:url}}),job,frame);
   }
  }catch(error){job=detailFailure(job,error);}
  delete job.detailFrames;
  const bodyReady=job.detailStatus==='text';if(!bodyReady)failed++;
  job.rawText=[original.rawText,job.detailFacts&&'상세 표준 정보:\n'+JSON.stringify(job.detailFacts,null,2),job.bodyText&&'실제 상세 본문:\n'+job.bodyText].filter(Boolean).join('\n\n').slice(0,60000);
  if(job.detailStatus==='image')job.detailMessage='이미지형 본문 · 원본 이미지에 있는 추가 필수요건을 확인해 주세요. OCR은 실행하지 않았습니다.';
  result.push(job);
 }
 result.collection={mode:input[0]?.collectionMode||'temporary',detailFailed:failed,detailPending:result.filter(j=>!j.bodyText&&!j.detailImages?.length&&!j.detailAttemptedAt).length,detailText:result.filter(j=>j.detailStatus==='text').length,detailImages:result.filter(j=>j.detailStatus==='image').length,requests};return result;
}

// Refreshing a list must never silently erase the last successfully captured employer body.
export function retainPreviousDetail(incoming,previous){
 if(!previous||!['saramin','jobkorea'].includes(incoming.provider)||incoming.id!==previous.id)return incoming;
 if(incoming.bodyText)return incoming;
 const old=previous.detailRetained&&previous.previousDetail?previous.previousDetail:previous.bodyText||previous.detailImages?.length?{
  bodyText:previous.bodyText||'',detailImages:previous.detailImages||[],detailFetchedAt:previous.detailFetchedAt,
  detailSourceUrl:previous.detailSourceUrl,duties:previous.duties,requirements:previous.requirements,preferred:previous.preferred
 }:previous.previousDetail;
 if(!old)return incoming;
 // Old employer conditions never overwrite or get mixed with a freshly read qualification panel.
 return {...incoming,previousDetail:old,detailRetained:true,verification:'summary'};
}
