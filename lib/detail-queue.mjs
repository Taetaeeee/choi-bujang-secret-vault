// Rotate saved vacancies by their last detail attempt, retaining all discovered listings.
export function nextDetails(list,previous,limit,now=Date.now()){
 const provider=list[0]?.provider||previous.find(j=>['saramin','jobkorea'].includes(j.provider))?.provider;
 const old=new Map(previous.filter(j=>j.provider===provider).map(j=>[j.id,j]));
 const merged=new Map(old);
 for(const j of list){const prior=old.get(j.id);merged.set(j.id,{...prior,...j,detailStatus:prior?.detailStatus,detailAttemptedAt:prior?.detailAttemptedAt,detailFetchedAt:prior?.detailFetchedAt});}
 const eligible=[...merged.values()].filter(j=>j.openStatus!=='closed'&&(!j.deadline||Date.parse(j.deadline+'T23:59:59+09:00')>=now));
 eligible.sort((a,b)=>(Date.parse(a.detailAttemptedAt||'')||0)-(Date.parse(b.detailAttemptedAt||'')||0));
 const selected=new Set(eligible.filter(j=>!j.detailAttemptedAt||now-Date.parse(j.detailAttemptedAt)>=(j.detailStatus==='image'?86400000:21600000)).slice(0,limit).map(j=>j.id));
 const clear=j=>{const out={...j};for(const k of ['bodyText','detailImages','bodySectionFields','sectionAnalysis','detailStatus','detailFetchedAt','metadataFetchedAt','detailCoverage','qualificationText','qualificationPreferred','detailFacts','previousDetail'])delete out[k];return out;};
 return [...eligible.filter(j=>selected.has(j.id)).map(clear),...list.filter(j=>!selected.has(j.id)).map(j=>{const prior=old.get(j.id);return {...prior,...j,...(prior?.detailFacts?{detailFacts:prior.detailFacts,experience:prior.detailFacts['경력']||j.experience,education:prior.detailFacts['학력']||j.education,qualificationText:prior.qualificationText}:{}),detailSkip:true};})];
}
