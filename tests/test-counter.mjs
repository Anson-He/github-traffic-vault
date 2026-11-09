import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../homepage/academic.js',import.meta.url),'utf8');
function page(hostname='anson-he.github.io'){
 const events={},timers=[],created=[],stats={attributes:{},setAttribute(k,v){this.attributes[k]=v},removeAttribute(k){delete this.attributes[k]}};
 const values={busuanzi_value_site_pv:{textContent:'…'},busuanzi_value_site_uv:{textContent:'…'}};
 const context=vm.createContext({document:{documentElement:{dataset:{theme:'light'}},querySelectorAll:()=>[],querySelector:()=>stats,getElementById:id=>values[id],createElement(type){const frame={contentWindow:{},attributes:{},setAttribute(k,v){this.attributes[k]=v}};created.push({type,frame});return frame},body:{appendChild(){}}},localStorage:{getItem:()=> 'Anson-He'},location:{hostname},matchMedia:()=>({addEventListener(){}}),window:{addEventListener(k,v){events[k]=v},removeEventListener(k){delete events[k]}},setTimeout(fn){timers.push(fn)}});
 vm.runInContext(source,context);return {created,values,events,timers,stats};
}
const owner=page();assert.equal(owner.created.length,1,'Remembered owner devices must still load visitor counters');
const {frame,type}=owner.created[0];assert.equal(type,'iframe');assert.equal(frame.attributes.sandbox,'allow-scripts');assert.ok(!frame.attributes.sandbox.includes('allow-same-origin'));
assert.equal(frame.src,'/assets/visitor-counter.html');
const message=owner.events.message;
message({source:{},origin:'null',data:{type:'site-counter-result-v1',pv:'12',uv:'3'}});assert.equal(owner.values.busuanzi_value_site_pv.textContent,'…');
message({source:frame.contentWindow,origin:'https://attacker.invalid',data:{type:'site-counter-result-v1',pv:'12',uv:'3'}});assert.equal(owner.values.busuanzi_value_site_pv.textContent,'…');
message({source:frame.contentWindow,origin:'null',data:{type:'site-counter-result-v1',pv:'<img src=x>',uv:'3'}});assert.equal(owner.values.busuanzi_value_site_pv.textContent,'…');
message({source:frame.contentWindow,origin:'null',data:{type:'site-counter-result-v1',pv:'12',uv:'3'}});assert.equal(owner.values.busuanzi_value_site_pv.textContent,'12');assert.equal(owner.values.busuanzi_value_site_uv.textContent,'3');assert.equal(owner.stats.attributes['aria-busy'],'false');
owner.timers.forEach(fn=>fn());assert.equal(owner.values.busuanzi_value_site_pv.textContent,'12');
const unavailable=page();unavailable.timers.forEach(fn=>fn());assert.equal(unavailable.values.busuanzi_value_site_pv.textContent,'—');
const preview=page('localhost');assert.equal(preview.created.length,0);
const child=await readFile(new URL('../homepage/visitor-counter.html',import.meta.url),'utf8');assert.ok(child.includes("'https://anson-he.github.io'"));assert.ok(!/localStorage|indexedDB|sessionStorage/.test(child));
console.log('Verified owner counter loading, opaque-origin isolation, strict numeric messaging, timeout handling and local-preview exclusion.');
