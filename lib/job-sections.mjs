// Deterministic extraction only: every item retains its employer text and location.
const KEYS=['duties','requirements','preferred'];
const aliases={duties:'담당\\s*업무|주요\\s*업무|업무\\s*내용|직무\\s*내용|수행\\s*업무',requirements:'자격\\s*요건|지원\\s*(?:자격|요건)|필수\\s*(?:요건|사항|조건|자격)|공통\\s*(?:자격|요건)|기본\\s*자격',preferred:'우대\\s*(?:사항|조건|요건|자격)|가점\\s*사항'};
const starts=Object.entries(aliases).map(([key,value])=>[key,new RegExp('^('+value+')(?=$|[\\s:：\\]】)）])\\s*[\\]】)）]*\\s*[:：]?\\s*(.*)$')]);
const label=s=>s.trim().replace(/^[\s\d\p{P}\p{S}\uFE0F\u200D]+/u,'').trim();
const compact=s=>s.replace(/\s/g,'');
function heading(line){
 const value=label(line);
 const all=Object.values(aliases).join('|');
 const combined=value.match(new RegExp('^((?:'+all+')\\s*(?:및|[&·ㆍ/＋+])\\s*(?:'+all+'))\\s*[\\]】)）]*\\s*[:：]?\\s*(.*)$'));
 if(combined)return {key:'combined',title:combined[1],rest:combined[2]};
 for(const [key,re] of starts){const m=value.match(re);if(m)return {key,title:m[1],rest:m[2]};}
 const short=value.match(/^(필수|우대)(?:\s*[:：]\s*|\s*[\]】)）]\s*|$)(.*)$/);
 if(short)return {key:short[1]==='필수'?'requirements':'preferred',title:short[1],rest:short[2]};
 return null;
}
export function isSectionHeading(value){const h=heading(value);return Boolean(h&&!h.rest);}
const other=/^(?:근무\s*(?:조건|형태|지역|장소|시간)|복리\s*후생|복지|접수\s*(?:기간|방법)|전형\s*(?:절차|방법)|제출\s*서류|채용\s*(?:절차|안내)|모집\s*(?:분야|부문|직무)|포지션|유의\s*사항|기타\s*사항|근무지|급여|회사\s*소개)(?:$|[\s:：\]】)）])/;
const preference=s=>!/(?:필수|우대\s*(?:아님|하지\s*않|없|하지는\s*않))/.test(s)&&/(?:우대(?:합니다|함)?|우대\s*대상)\s*[.!。)）\]]*$/.test(s);
const required=s=>!/(?:우대|필수\s*(?:아님|아니|없|하지\s*않))/.test(s)&&/(?:필수(?:입니다|임)?)\s*[.!。)）\]]*$/.test(s);
export function analyzeSections(content){
 const lines=String(content??'').slice(0,40000).split('\n'),items=Object.fromEntries(KEYS.map(k=>[k,[]])),unclassified=[],counts={duties:0,requirements:0,preferred:0};
 let section=null,title='',skip=false;
 const add=(key,value,quote,index,head)=>{if(value.trim())items[key].push({text:value.trim(),quote,heading:head,startLine:index+1,endLine:index+1,source:'body'});};
 for(let i=0;i<lines.length;i++){
  const raw=lines[i].trim();if(!raw)continue;const h=heading(raw);
  if(h){
   // A second explicit section of the same kind can belong to another vacancy.
   if(KEYS.includes(h.key))counts[h.key]++;
   section=h.key;title=h.title;skip=false;
   if(h.rest){if(section==='combined'||(section==='requirements'&&/우대/.test(h.rest)&&!preference(h.rest)))unclassified.push({text:h.rest,quote:raw,startLine:i+1,reason:'combined'});else add(section==='requirements'&&preference(h.rest)?'preferred':section,h.rest,raw,i,title);}
   continue;
  }
  if(other.test(label(raw))){section=null;skip=true;continue;}
  if(skip)continue;
  if(section==='combined'){
   if(preference(raw))add('preferred',raw,raw,i,'자격·우대 통합 항목의 명시적 우대 문구');
   else if(required(raw))add('requirements',raw,raw,i,'자격·우대 통합 항목의 명시적 필수 문구');
   else unclassified.push({text:raw,quote:raw,startLine:i+1,reason:'combined'});
  }else if(section==='requirements'&&/우대/.test(raw)&&!preference(raw)){
   unclassified.push({text:raw,quote:raw,startLine:i+1,reason:'combined'});
  }else if(section){
   // Explicit "우대" inside a qualification list must not become a required certificate.
   add(section==='requirements'&&preference(raw)?'preferred':section,raw,raw,i,title);
  }else unclassified.push({text:raw,quote:raw,startLine:i+1,reason:'no-heading'});
 }
 const ambiguous=Object.values(counts).some(n=>n>1);
 if(ambiguous){for(const key of KEYS){unclassified.push(...items[key].map(item=>({...item,reason:'multiple-roles'})));items[key]=[];}}
 for(const key of KEYS){const seen=new Set();items[key]=items[key].filter(item=>{const k=compact(item.text);if(seen.has(k))return false;seen.add(k);return true;});}
 unclassified.sort((a,b)=>a.startLine-b.startLine);
 return {items,unclassified,ambiguous};
}
export function explicitSections(content){const {items}=analyzeSections(content);return Object.fromEntries(KEYS.map(k=>[k,items[k].map(item=>item.text).join('\n').slice(0,12000)]));}

// Reclassifies already stored current bodies on read, without a network request or a new evidence date.
export function classifyJobSections(job){
 if(!['saramin','jobkorea'].includes(job.provider))return job;
 const body=String(job.bodyText||''),parsed=analyzeSections(body),items=parsed.items;
 for(const key of KEYS){
  const value=job.bodySectionFields?.[key];
  if(value&&!parsed.ambiguous&&body.includes(value))items[key]=value.split('\n').filter(Boolean).map(text=>({text,quote:text,heading:'본문 표의 '+({duties:'담당업무',requirements:'자격요건',preferred:'우대사항'}[key]),startLine:body.split('\n').indexOf(text)+1,source:'body'}));
  // Earlier versions already validated single-row tables; keep only verbatim body evidence.
  if(!items[key].length&&!parsed.ambiguous&&job.detailCoverage?.[key]&&job[key]&&body.includes(job[key])){
   const previous=key==='requirements'?analyzeSections('자격요건\n'+job[key]).items.requirements.map(x=>x.text):job[key].split('\n').filter(Boolean);
   items[key]=previous.map(text=>({text,quote:text,heading:'이전에 수집한 본문의 명시적 항목',source:'body'}));
  }
 }
 if(['saramin','jobkorea'].includes(job.provider)){
  for(const [key,value] of [['requirements',job.qualificationText],['preferred',job.qualificationPreferred]]){
   const metadata=String(value||'').split('\n').filter(Boolean).filter(line=>!items[key].some(x=>compact(x.text)===compact(line))).map(line=>{const field=key==='preferred'?'우대조건':line.startsWith('경력:')?'경력':'학력';return {text:line,quote:job.detailFacts?.[field]?field+'\n'+job.detailFacts[field]:line,heading:key==='requirements'?(job.provider==='saramin'?'핵심정보 · 경력/학력':'지원자격 · 경력/학력'):'지원자격 · 우대조건',source:'qualification'};});
   items[key]=[...metadata,...items[key]];
  }
 }
 const covered=new Set(KEYS.flatMap(key=>items[key].filter(x=>x.source==='body').map(x=>compact(x.text))));
 const unclassified=parsed.unclassified.filter(x=>!covered.has(compact(x.text)));
 const sections=Object.fromEntries(KEYS.map(key=>[key,{items:items[key],status:items[key].length?'extracted':body?'unconfirmed':'no-body'}]));
 const result={...job,sectionAnalysis:{version:1,sections,unclassified,ambiguous:parsed.ambiguous,imageUnverified:Boolean(job.detailImages?.length),bodyFetchedAt:job.detailFetchedAt||null}};
 for(const key of KEYS)result[key]=items[key].length?items[key].map(x=>x.text).join('\n').slice(0,12000):body?({duties:'담당업무',requirements:'필수요건·자격 정보',preferred:'우대사항'}[key])+' 구분을 원문에서 확인하지 못했습니다.':job[key];
 return result;
}
