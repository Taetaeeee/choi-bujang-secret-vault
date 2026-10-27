import {experienceRule} from './experience.mjs';
export function searchScope(p){return JSON.stringify([p.desiredRole||'',p.keywords||'',Boolean(p.allowBroadRegion),...(p.regions||[])]);}
const degree=s=>/博士|박사/.test(s)?5:/석사/.test(s)?4:/전문대|초대졸|2[~·/,]3년|2년제|3년제/.test(s)?2:/대졸|대학교|학사|4년제|4년/.test(s)?3:/고졸|고등학교/.test(s)?1:0;
export function eligibility(job,p){
 const failures=[],unknown=[],evidence=[];
 const req=String(job.requirements||''),lines=req.split('\n').filter(s=>!/(우대|가점)/.test(s)),academic=lines.filter(s=>/학력|대졸|전문대|(?:학사|석사|박사)(?:\s|학위|이상|졸업|$)|고졸|고등학교/.test(s));
 const ed=String(job.detailFacts?.['학력']||job.education||''),sources=[ed,...academic].filter(s=>s&&!/우대|가점/.test(s));
 const ranks=sources.map(degree),needed=Math.max(0,...ranks),held=degree(p.education||'');
 if(sources.some(s=>/고졸.*(?:또는|\/).*대졸|대졸.*(?:또는|\/).*고졸/.test(s)))unknown.push('복수 학력 모집분야 확인 필요');
 else if(/예정/.test(p.education||'')&&needed)unknown.push('졸업예정자의 지원 허용 여부 확인 필요');
 else if(needed&&held&&held<needed){if(/대체|동등|상응|또는.*경력/.test(academic.join(' ')))unknown.push('학력 대체 조건 확인 필요');else failures.push('필수 학력 미충족: '+sources.find(s=>degree(s)===needed));}
 else if(needed&&!held)unknown.push('본인 최종학력 확인 필요');
 else if(needed||sources.some(s=>/학력\s*무관|학력.*제한\s*없/.test(s)))evidence.push('명시된 학력조건 충돌 없음');else unknown.push('공고의 필수 학력 확인 필요');
 const career=experienceRule(job);
 if(career.status==='allowed')evidence.push(career.reason);
 else if(career.status==='unknown')unknown.push(career.reason);
 else if(p.relevantExperienceYears===undefined)unknown.push('본인 해당 직무 경력 연수 입력 필요');
 else if(p.relevantExperienceYears===0||(career.minimum>0&&p.relevantExperienceYears<career.minimum))failures.push(career.reason);
 else if(!career.minimum)unknown.push('경력직 최소 요구 연수 확인 필요');
 else evidence.push('입력한 직무 경력 연수 충족');
 if(!p.allowContract){if(/계약|인턴|파견|기간제/.test(job.employment||''))failures.push('희망 고용형태 불일치');else if(!/정규|무기계약/.test(job.employment||''))unknown.push('고용형태 확인 필요');}
 if(!p.allowShift){const work=[job.employment,...lines,...String(job.bodyText||'').split('\n').filter(s=>/교대/.test(s)&&!/우대|가점/.test(s))].join(' ');if(/교대/.test(work)&&!/교대(?:근무)?\s*(?:없|아님|미실시|하지\s*않)/.test(work))failures.push('교대근무 제외 조건');}
 if(!req||/확인 대기|확인 불가|구분을 원문에서/.test(req))unknown.push('필수요건 본문 확인 필요');
 if(job.detailImages?.length||job.sectionAnalysis?.imageUnverified)unknown.push('이미지 속 추가 지원조건 확인 필요');
 if(job.sectionAnalysis?.ambiguous)unknown.push('여러 모집직무 조건 분리 필요');
 for(const line of lines){if(!/필수|자격.*소지/.test(line))continue;const named=line.match(/정보처리기사|정보보안기사|네트워크관리사\s*[12]급|CCNA|사회복지사\s*[12]급|간호사\s*면허|운전면허\s*[12]종/g)||[];for(const cert of named)if(!(p.certificates||[]).some(c=>c.status==='취득 완료'&&c.name.replace(/\s/g,'')===cert.replace(/\s/g,'')))unknown.push(cert+' 필수 자격 취득 여부 확인');if(!named.length&&/자격|면허/.test(line))unknown.push('필수 자격·면허 조건 확인: '+line);}
 if(lines.some(line=>line.trim()&&!academic.includes(line)&&!/경력|신입|학력|교대|정규직|계약|원문|확인|정보처리기사|정보보안기사|네트워크관리사|CCNA|사회복지사|간호사.*면허|운전면허/.test(line)))unknown.push('그 밖의 필수 업무능력·조건은 원문과 추가 비교가 필요합니다.');
 return {group:failures.length?'mismatch':unknown.length?'unknown':'match',failures:[...new Set(failures)],unknown:[...new Set(unknown)],evidence};
}
