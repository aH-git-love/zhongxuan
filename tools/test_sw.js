const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

async function main(){
  const source = fs.readFileSync('sw.js', 'utf8');
  const listeners = {};
  const currentCache = /const CACHE = '([^']+)'/.exec(source)[1];
  const state = { keys:['unrelated-app-cache','zhongxuan-old-test',currentCache], deleted:[], matched:[] };
  const home = new Response('<html>home</html>', { status:200, headers:{'content-type':'text/html'} });
  const appHome = new Response('<html>app</html>', { status:200, headers:{'content-type':'text/html'} });
  const caches = {
    keys:async()=>state.keys.slice(),
    delete:async key=>{state.deleted.push(key);return true;},
    match:async req=>{const key=typeof req==='string'?req:(req.url||'');state.matched.push(key);return key.includes('app.html')?appHome:key.includes('index.html')?home:null;},
    open:async()=>({put:async()=>{}})
  };
  let fetchImpl=async()=>{throw new TypeError('offline')};
  let precached=[],skipped=0;
  caches.open=async()=>({put:async()=>{},addAll:async list=>{precached=list}});
  const context={self:{registration:{scope:'https://app.test/zhongxuan/'},addEventListener:(name,fn)=>listeners[name]=fn,skipWaiting:async()=>{skipped++},clients:{claim:async()=>{}}},caches,fetch:(...a)=>fetchImpl(...a),Promise,Response,Request,URL,console};
  vm.runInNewContext(source,context,{filename:'sw.js'});
  assert.equal(typeof listeners.fetch,'function','fetch listener registered');
  let installed; listeners.install({waitUntil:p=>installed=p}); await installed;
  assert(precached.length>20 && precached.every(r=>r.cache==='reload' && r.url.startsWith('https://app.test/zhongxuan/')));
  assert.equal(skipped,1); console.log('PASS installation refreshes all app resources within deployment scope');
  listeners.message({data:{type:'SKIP_WAITING'}}); assert.equal(skipped,2); console.log('PASS explicit update activation message');
  let apiIntercepted=false;
  listeners.fetch({request:{method:'GET',url:'https://app.test/api/brain/state',mode:'cors'},respondWith:()=>{apiIntercepted=true}});
  assert.equal(apiIntercepted,false);console.log('PASS authenticated brain API bypasses static offline cache');
  let responsePromise;
  listeners.fetch({request:{method:'GET',url:'https://app.test/js/missing.js',mode:'cors'},respondWith:p=>responsePromise=p});
  const asset=await responsePromise;
  assert.equal(asset.type,'error','offline missing asset must fail, not receive index.html');
  console.log('PASS offline missing JS returns Response.error');
  listeners.fetch({request:{method:'GET',url:'https://app.test/virtual-route',mode:'navigate'},respondWith:p=>responsePromise=p});
  const nav=await responsePromise;
  assert.equal(await nav.text(),'<html>home</html>','navigation fallback is cached index');
  console.log('PASS offline navigation falls back to cached index');
  listeners.fetch({request:{method:'GET',url:'https://app.test/app.html?sys=tarot&new-query=1',mode:'navigate'},respondWith:p=>responsePromise=p});
  assert.equal(await (await responsePromise).text(),'<html>app</html>');
  assert.equal(precached.filter(r=>/assets\/tarot\/rws\/[MCWSP]\d{2}\.webp$/.test(new URL(r.url).pathname)).length,78);
  console.log('PASS all 78 real cards precached and offline app queries stay in the app');
  fetchImpl=async()=>new Response('404 page',{status:404});
  listeners.fetch({request:{method:'GET',url:'https://app.test/js/missing.js',mode:'cors'},respondWith:p=>responsePromise=p});
  const notFound=await responsePromise;
  assert.equal(notFound.status,404,'HTTP 404 is preserved, not converted into home html');
  console.log('PASS online HTTP 404 remains 404');
  let activation;
  listeners.activate({waitUntil:p=>activation=p}); await activation;
  assert.deepEqual(state.deleted,['zhongxuan-old-test'],'only old zhongxuan cache removed');
  console.log('PASS activation keeps unrelated caches and deletes only old zhongxuan cache');
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
