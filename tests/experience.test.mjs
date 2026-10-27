import test from 'node:test';import assert from 'node:assert/strict';import {experienceRule,newbieVisible} from '../lib/experience.mjs';
const novice={relevantExperienceYears:0};
test('newcomers see explicit newcomer and unrestricted career vacancies',()=>{for(const experience of ['신입','무관','경력무관','경력 무관','신입·경력','신입/경력','신입 및 경력','신입 지원 가능']){const j={experience};assert.equal(experienceRule(j).status,'allowed',experience);assert.equal(newbieVisible(j,novice),true);}});
test('required career is excluded even without years; preference never becomes mandatory',()=>{for(const experience of ['경력','경력직','경력자 모집','경력 3년 이상','경력(2년)','경력 6개월 이상','경력 1~3년','경력(연수무관)','신입 지원 불가'])assert.equal(newbieVisible({experience},novice),false,experience);assert.equal(newbieVisible({experience:'신입',requirements:'관련 경력 3년 이상 우대'},novice),true);assert.equal(experienceRule({requirements:'관련 경력 보유자 필수'}).status,'required');});
test('ambiguous experience needs explicit opt-in and never overrides required experience',()=>{const unknown={experience:'확인 불가'};assert.equal(newbieVisible(unknown,novice),false);assert.equal(newbieVisible(unknown,{...novice,includeUnknownExperience:true}),true);assert.equal(newbieVisible({experience:'경력직'},{...novice,includeUnknownExperience:true}),false);assert.equal(experienceRule({experience:'신입/경력',requirements:'경력 3년 이상 필수'}).status,'unknown');assert.equal(experienceRule({experience:'신입',sectionAnalysis:{ambiguous:true}}).status,'unknown');assert.equal(newbieVisible({experience:'경력직'},{...novice,showMismatch:true}),true);});

 test('structured career-only facts and experienced titles reject the reported postings',()=>{
 const p={relevantExperienceYears:0,education:'고졸',regions:['전국']};
 for(const j of [
 {title:'KB데이타시스템 IT경력직원 모집',experience:'경력2년↑',sectionAnalysis:{ambiguous:true}},
 {title:'(주)iM증권 IT 경력직 채용',detailFacts:{경력:'경력',학력:'학력무관'}},
 {title:'KB데이타시스템 IT경력직원 모집'},
 {detailFacts:{경력:'경력 (2년이상, 직무별 상이/상세요강 참조)'},sectionAnalysis:{ambiguous:true}}
 ]){assert.equal(experienceRule(j).status,'required');assert.equal(newbieVisible(j,p),false);}
 assert.equal(experienceRule({detailFacts:{경력:'신입·경력'}}).status,'allowed');
 });
