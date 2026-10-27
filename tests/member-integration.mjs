import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare}=wr('miniflare');
const root=process.cwd()+'/dist/server';
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):/\.m?js$/.test(e.name)?[{type:'ESModule',path:d+'/'+e.name}]:[]);
const modules=walk(root);modules.sort((a,b)=>a.path===root+'/index.js'?-1:b.path===root+'/index.js'?1:0);
const mf=new Miniflare({modules,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{APP_LOGIN_PASSWORD:'existing-owner-password',APP_SESSION_SECRET:'member-integration-session-secret-01234567890123456789',ALIO_API_KEY:'private-owner-api-key'}});
const base='https://local.test';
try{
 const db=await mf.getD1Database('DB');for(const sql of readFileSync('drizzle/0000_nosy_justin_hammer.sql','utf8').split('--> statement-breakpoint'))if(sql.trim())await db.exec(sql.replace(/\n/g,' '));
 const post=(path,fields,origin=base)=>mf.dispatchFetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields).toString(),redirect:'manual'});
 assert.equal((await mf.dispatchFetch(base+'/register')).status,200);
 assert.equal((await post('/auth/register',{username:'alpha',password:'member-password-12345',confirm:'member-password-12345'},'https://evil.test')).status,403);
 const cookies=[];
 for(const username of ['alpha','bravo']){const r=await post('/auth/register',{username,password:'member-password-12345',confirm:'member-password-12345'});assert.equal(r.status,303);cookies.push(r.headers.get('set-cookie').split(';')[0]);}
 assert.equal((await post('/auth/register',{username:'alpha',password:'member-password-12345',confirm:'member-password-12345'})).status,400);
 const api=async(cookie,path,data)=>{const r=await mf.dispatchFetch(base+'/api/'+path,{method:data?'POST':'GET',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});assert.equal(r.status,200);return r.json();};
 const first=await api(cookies[0],'state');assert.equal(first.jobs.length,0);assert.equal(first.sources.find(s=>s.id==='alio').hasCredential,false);
 await api(cookies[0],'profile',{...first.profile,regions:['대전'],keywords:'전산',name:'Alpha private profile'});
 assert.notEqual((await api(cookies[1],'state')).profile.name,'Alpha private profile');
 await api(cookies[0],'application',{id:'saramin:123',status:'관심',note:'Private alpha note'});assert.equal((await api(cookies[1],'state')).applications.length,0);
 await api(cookies[0],'bookmark',{id:'saramin:123',bookmarked:false});
 let retained=(await api(cookies[0],'state')).applications.find(a=>a.id==='saramin:123');
 assert.equal(retained.bookmarked,false);assert.equal(retained.note,'Private alpha note');
 await api(cookies[0],'application',{id:'saramin:123',status:'지원 완료',note:'Kept note'});
 retained=(await api(cookies[0],'state')).applications.find(a=>a.id==='saramin:123');assert.equal(retained.bookmarked,false);
 await api(cookies[1],'bookmark',{id:'saramin:123',bookmarked:true});
 assert.equal((await api(cookies[0],'state')).applications.find(a=>a.id==='saramin:123').bookmarked,false);
 await api(cookies[1],'bookmark',{id:'saramin:123',bookmarked:false});assert.equal((await api(cookies[1],'state')).applications.length,0);
 await api(cookies[0],'bookmark',{id:'saramin:123',bookmarked:true});
 assert.equal((await api(cookies[0],'state')).applications.find(a=>a.id==='saramin:123').note,'Kept note');

 const stored=await db.prepare('SELECT hash,salt FROM members').all();assert.equal(stored.results.length,2);assert.notEqual(stored.results[0].hash,stored.results[1].hash);assert.ok(!JSON.stringify(stored).includes('member-password-12345'));
 assert.equal((await post('/auth/login',{username:'bravo',password:'wrong-password-12345'})).status,400);
 assert.equal((await post('/auth/login',{username:'bravo',password:'member-password-12345'})).status,303);
 assert.equal((await post('/auth/login',{password:'existing-owner-password'})).status,303);
 console.log('PASS signup/login, duplicate and CSRF checks, salted hashes, member isolation, owner login preservation and ALIO separation');
}finally{await mf.dispose();}
