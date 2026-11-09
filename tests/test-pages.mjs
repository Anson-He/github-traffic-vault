import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../web/github-pages/index.html',import.meta.url),'utf8');
assert.ok(!html.includes('/api/data'));
assert.ok(!html.includes('chatgpt.site'));
assert.ok(html.includes('connect-src https://api.github.com'));
assert.ok(!/sessionStorage/.test(html));
assert.ok(html.includes('id="private-app"'));
assert.ok(!html.includes('id="access-gate"'));
assert.ok(!html.includes('https://api.github.com/user'));
assert.ok(html.includes('Newsreader'));
assert.ok(html.includes('data-theme=dark'));
assert.ok(!/github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9]+/.test(html));
assert.ok(!html.includes('仅自己可见'));
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
// A small asynchronous IndexedDB adapter; WebCrypto uses the actual Node implementation.
const records=new Map(),localRecords=new Map();let initialized=false;
const idb={open(){const request={};queueMicrotask(()=>{
 request.result={createObjectStore(){},close(){},transaction(){
  const tx={objectStore(){return {
   get(key){return {result:structuredClone(records.get(key))}},
   put(value,key){records.set(key,structuredClone(value));return {result:key}},
   delete(key){records.delete(key);return {result:undefined}}
  }}};
  setTimeout(()=>tx.oncomplete?.(),0);return tx;
 }};
 if(!initialized){initialized=true;request.onupgradeneeded?.()}
 request.onsuccess?.();
});return request}};
const fixture={schema_version:1,generated_at:new Date().toISOString(),repositories:[{id:1,name:'owner/<untrusted>',views:[],clones:[],snapshots:[]}],errors:[]};
const settle=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setTimeout(r,0))};
function browser(){
 const elements=new Map(),calls=[],events={};let status=200,pending=null,login='Anson-He';
 const element=id=>{if(!elements.has(id))elements.set(id,{value:id==='#range'?'14':'',checked:false,innerHTML:'',textContent:'',querySelectorAll:()=>[],showModal(){},close(){},click(){}});return elements.get(id)};
 const ctx=vm.createContext({console,Date,Map,Set,URL,Blob,setTimeout,AbortSignal,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,indexedDB:idb,localStorage:{getItem:k=>localRecords.get(k),setItem:(k,v)=>localRecords.set(k,v),removeItem:k=>localRecords.delete(k)},matchMedia:()=>({matches:false}),
  document:{documentElement:{dataset:{}},querySelector:element,querySelectorAll:()=>[],createElement:()=>({click(){}})},
  window:{scrollTo(){},addEventListener(k,fn){events[k]=fn}},
  fetch:async(url,options)=>{calls.push({url,options});if(pending)return pending;return {ok:status===200,status,headers:new Headers(),json:async()=>url.endsWith('/user')?{login}:fixture}}});
 vm.runInContext(script,ctx);
 return {ctx,element,calls,events,setStatus(v){status=v},setLogin(v){login=v},setPending(v){pending=v}};
}
const first=browser();await settle();
assert.equal(first.calls.length,0,'No private API request before a connection exists');
first.element('#token').value='test-only';first.element('#remember-device').checked=true;
await first.element('#connect-form').onsubmit({preventDefault(){}});
assert.equal(first.calls.length,1);
assert.equal(first.calls[0].url,'https://api.github.com/repos/Anson-He/github-traffic-vault/contents/data/dashboard.json');
assert.equal(first.calls[0].options.headers.Authorization,'Bearer test-only');
assert.equal(first.calls[0].options.credentials,'omit');
assert.ok(first.element('#content').innerHTML.includes('&lt;untrusted&gt;'));
const saved=records.get('reader');
assert.equal(saved.key.extractable,false);
assert.equal(typeof saved.ciphertext.byteLength,'number');
assert.ok(!JSON.stringify(saved).includes('test-only'));
await assert.rejects(webcrypto.subtle.exportKey('raw',saved.key));
const second=browser();await settle();
assert.equal(second.calls.length,1,'Opening a remembered device fetches the private archive automatically');
assert.equal(vm.runInContext('remembered',second.ctx),true);
assert.equal(second.calls[0].options.headers.Authorization,'Bearer test-only');
second.setStatus(401);await vm.runInContext('load()',second.ctx);
assert.ok(second.element('#notice').textContent.includes('Token 无效或已过期'));
assert.equal(records.has('reader'),false,'Expired saved credentials are removed');
assert.ok(!second.element('#content').innerHTML.includes('&lt;untrusted&gt;'),'Revoked credentials must clear private data');
assert.equal(localRecords.has('github-traffic-owner'),false);
second.setStatus(200);
second.element('#token').value='test-only';second.element('#remember-device').checked=true;
await second.element('#connect-form').onsubmit({preventDefault(){}});
assert.equal(records.has('reader'),true);
let resolvePending;second.setPending(new Promise(r=>{resolvePending=r}));
const inFlight=vm.runInContext('load()',second.ctx);
await second.element('#disconnect').onclick();
resolvePending({ok:true,status:200,headers:new Headers(),json:async()=>fixture});await inFlight;
assert.equal(vm.runInContext('token',second.ctx),'');
assert.equal(vm.runInContext('data',second.ctx),null,'A late response cannot restore data after disconnect');
assert.equal(records.has('reader'),false);
const third=browser();await settle();assert.equal(third.calls.length,0,'Forgotten credentials never auto-connect');
third.element('#token').value='session-only';third.element('#remember-device').checked=false;
await third.element('#connect-form').onsubmit({preventDefault(){}});
assert.equal(records.has('reader'),false,'Unchecked remember option keeps credentials ephemeral');
vm.runInContext("token='temporary';data={repositories:[]}",third.ctx);third.events.pagehide();
assert.equal(vm.runInContext('token',third.ctx),'');assert.equal(vm.runInContext('data',third.ctx),null);
// The public interface never embeds archive data or requests it without credentials.
const visitor=browser();await settle();assert.equal(visitor.calls.length,0);
assert.ok(visitor.element('#content').innerHTML.includes('尚未连接私密档案'));
assert.ok(!visitor.element('#content').innerHTML.includes('&lt;untrusted&gt;'));
// File import is local-only and requires no extra account login.
await visitor.element('#file').onchange({target:{files:[{size:10,text:async()=>JSON.stringify(fixture)}]}});
assert.ok(visitor.element('#content').innerHTML.includes('&lt;untrusted&gt;'));
assert.equal(visitor.calls.length,0);
const layout=await readFile(new URL('../homepage/default.html',import.meta.url),'utf8');
assert.match(layout,/id="owner-analytics"/);
assert.doesNotMatch(layout,/id="owner-analytics"[^>]+hidden/);
console.log('Verified: encrypted opt-in persistence, automatic fresh reads after reload, expiry cleanup, forgetting, no late data restoration, and session-only mode.');
