const BASE="http://localhost:3100"; let cookie="";
async function req(p,o={}){const r=await fetch(BASE+p,{...o,redirect:"manual",headers:{"content-type":"application/json",...(o.headers||{}),...(cookie?{cookie}:{})}});
 for(const c of r.headers.getSetCookie?.()??[]) if(c.startsWith("fs_session=")) cookie=c.split(";")[0]; return r;}
let fails=0;
function ok(l,r,extra=""){const g=r.status<400; if(!g)fails++; console.log(`${g?"PASS":"FAIL"}  ${l}  [${r.status}] ${extra}`); return g;}
const li=await req("/api/auth/login",{method:"POST",body:JSON.stringify({email:"parent@example.com",password:"parent1234"})});
ok("parent login",li,cookie?"session set":"NO COOKIE");
const over=await req("/admin"); const h=await over.text();
ok("GET /admin",over,`${[...h.matchAll(/\/admin\/students\/([a-z0-9]{20,})/g)].length} student link(s)`);
const sid=[...new Set([...h.matchAll(/\/admin\/students\/([a-z0-9]{20,})/g)].map(m=>m[1]))][0];
if(!sid){console.log("FAIL no student links");process.exit(1);}
const sp=await req(`/admin/students/${sid}`); const sh=await sp.text();
ok("student overview",sp);
const lid=[...new Set([...sh.matchAll(/\/lessons\/([a-z0-9]{20,})/g)].map(m=>m[1]))][0];
if(lid){const insp=await req(`/admin/students/${sid}/lessons/${lid}`); const ih=await insp.text();
  ok("lesson inspection",insp,`${/Attempt|attempt/.test(ih)?"shows attempts":"NO ATTEMPTS"}, ${/answer|Answer/.test(ih)?"shows answers":"NO ANSWERS"}`);}
else console.log("      (no lesson link on the overview to inspect)");
for(const p of ["/admin/schedule","/admin/curriculum","/admin/reports","/admin/settings","/admin/students"]) ok(`GET ${p}`,await req(p));
console.log(fails?`\n${fails} FAILURE(S)`:"\nadmin side reachable end to end");
process.exitCode=fails?1:0;
