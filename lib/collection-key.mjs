export function collectionKey(p){
 return JSON.stringify({role:p.desiredRole||'',keywords:p.keywords||'',regions:[...(p.regions||[])].sort(),broad:Boolean(p.allowBroadRegion),saramin:p.saraminMode||'auto',work24:p.work24Mode||'auto',boards:p.companyBoards||[]});
}
