// Read the posting's career field and required conditions; preference text is never mandatory.
export function experienceRule(job){
 const main=String(job.detailFacts?.['경력']||job.experience||'').replace(/\s+/g,' ').trim(),requirements=String(job.requirements||'').split('\n').filter(s=>/경력|신입/.test(s)&&!/우대|가점/.test(s));
 const text=[main,...requirements].join('\n');
 const allowed=/^(?:무관|신입|신입사원|신입직)$/.test(main)||/경력\s*(?:무관|제한\s*없|상관\s*없)|신입\s*(?:지원\s*)?(?:가능|환영)|신입\s*[/·ㆍ및,와과-]\s*경력|신입\s*$/.test(text);
 const years=[...text.matchAll(/(\d+(?:\.\d+)?)\s*년\s*(?:이상|부터|↑|[~～-])/g)].map(m=>Number(m[1]));
 years.push(...[...text.matchAll(/(\d+)\s*[~～-]\s*\d+\s*년/g)].map(m=>Number(m[1])));
 const months=[...text.matchAll(/(\d+)\s*개월\s*(?:이상|부터|↑|[~～-])/g)].map(m=>Number(m[1])/12);
 const direct=main.match(/^경력\s*[:：(]?\s*(\d+(?:\.\d+)?)\s*년\s*\)?$/);if(direct)years.push(Number(direct[1]));
 const minimum=Math.max(0,...years,...months);
 const experienced=/^경력\s*[(（].*(?:연수|년수|무관)/.test(main)||requirements.some(s=>/경력\s*(?:자|직|사원)(?:\s|$)/.test(s)&&!/아니|없어도|않아도/.test(s))||/신입\s*(?:지원\s*)?(?:불가|제외)/.test(text)||/^경력\s*(?:직|자|사원)?(?:\s*(?:채용|모집|필수))?$/.test(main)||requirements.some(s=>/경력\s*(?:자|직|사원).*(?:필수|모집|채용)|경력\s*(?:필수|보유자)|(?:관련|동종|유관).*경력.*(?:필수|보유자)/.test(s));
 // A structured career-only field is decisive even for multi-role postings.
 const mainAllows=/신입|경력\s*(?:무관|제한\s*없|상관\s*없)|^무관$/.test(main)&&!/신입\s*(?:지원\s*)?(?:불가|제외)/.test(main);
 const mainRequired=/경력/.test(main)&&!mainAllows;
 const titleRequired=/(?:IT\s*)?경력\s*(?:직원|직|사원|자)|경력\s*\d+\s*년/.test(String(job.title||''))&&!/신입|경력\s*무관/.test(String(job.title||''));
 if(mainRequired||(!mainAllows&&titleRequired))return {status:'required',minimum,reason:mainRequired?'핵심정보 경력 조건: '+main:'공고 제목에 경력직 모집이 명시됨'};
 if(job.sectionAnalysis?.ambiguous)return {status:'unknown',minimum,reason:'여러 모집분야의 신입·경력 조건 확인 필요'};
 if(allowed&&(minimum>0||experienced))return {status:'unknown',minimum,reason:'신입 허용 문구와 경력 필수조건이 함께 있어 모집분야 확인 필요'};
 if(minimum>0||experienced)return {status:'required',minimum,reason:minimum?'해당 직무 경력 '+(minimum<1?Math.round(minimum*12)+'개월':minimum+'년')+' 이상 필요':'경력직·경력자 지원조건'};
 if(allowed)return {status:'allowed',minimum:0,reason:'신입 또는 경력무관 지원이 명시됨'};
 return {status:'unknown',minimum:0,reason:'신입 지원 가능 여부 확인 필요'};
}
export function newbieVisible(job,p){if(p.relevantExperienceYears!==0||p.showMismatch)return true;const rule=experienceRule(job);return rule.status==='allowed'||(Boolean(p.includeUnknownExperience)&&rule.status==='unknown');}
