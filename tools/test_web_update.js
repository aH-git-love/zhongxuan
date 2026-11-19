const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 let phase='A',server,ws; const pending=new Map();let seq=0;
 const root=path.resolve('.');
 server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;const f=path.resolve(root,'.'+(p==='/'?'/index.html':p));if(!f.startsWith(root+path.sep)){res.writeHead(404);return res.end()};fs.readFile(f,(err,data)=>{if(err){res.writeHead(404);return res.end()};if(p==='/sw.js')data=Buffer.from(data.toString().replace(/zhongxuan-v\d+/,'zhongxuan-test-update-'+phase));res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.png')?'image/png':p.endsWith('.webmanifest')?'application/manifest+json':'text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(data)})});
 await new Promise(r=>server.listen(8777,'127.0.0.1',r));
 try{
 const pages=await(await fetch('http://127.0.0.1:9229/json/list')).json();const target=pages.find(p=>p.type==='page');ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const t=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},15000);pending.set(id,{resolve:r=>{clearTimeout(t);resolve(r)},reject:e=>{clearTimeout(t);reject(e)}});ws.send(JSON.stringify({id,method,params}))});
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 async function until(expression){for(let i=0;i<40;i++){if(await ev(expression))return;await wait(200)}throw Error('Timed out: '+expression)}
 await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url:'http://127.0.0.1:8777/app.html'});
 await until("document.readyState==='complete' && !!navigator.serviceWorker.controller");
  await until("Promise.all([navigator.serviceWorker.getRegistration(),caches.keys()]).then(([r,keys])=>r && r.active && r.active.state==='activated' && !r.installing && !r.waiting && keys.includes('zhongxuan-test-update-A') && keys.filter(k=>k.startsWith('zhongxuan-')).length===1)");
  await ev("document.querySelector('#update-later').click();true");
 assert(await ev("document.querySelectorAll('a[download],a[href$=\".apk\"]').length===0"));console.log('PASS website has no installer download links');
 await ev("localStorage.setItem('update-test-sentinel','preserved');true");
 phase='B';await ev("navigator.serviceWorker.getRegistration().then(r=>r.update()).then(()=>true)");
 await until("!document.querySelector('#update-notice').hidden");console.log('PASS real worker version change displays update notice');
 assert(await ev("localStorage.getItem('update-test-sentinel')==='preserved'"));
 await ev("document.querySelector('#update-later').click();true");assert(await ev("document.querySelector('#update-notice').hidden"));console.log('PASS postpone keeps current page and stored data');
 phase='C';await ev("navigator.serviceWorker.getRegistration().then(r=>r.update()).then(()=>true)");await until("!document.querySelector('#update-notice').hidden");
 await ev("document.querySelector('#update-now').click();true").catch(()=>{});await wait(1600);await until("document.readyState==='complete' && !!document.querySelector('#update-now')");
 assert(await ev("localStorage.getItem('update-test-sentinel')==='preserved'"));console.log('PASS apply update reloads page and preserves localStorage');
 assert(await ev("caches.keys().then(keys=>keys.includes('zhongxuan-test-update-C') && !keys.includes('zhongxuan-test-update-B'))"));console.log('PASS new worker cache replaces previous app version');
 for(const width of [320,390,900]){await send('Emulation.setDeviceMetricsOverride',{width,height:850,deviceScaleFactor:1,mobile:width<600});await wait(300);const layout=await ev("({width:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,id:e.id,cls:e.className,r:e.getBoundingClientRect().right,w:e.getBoundingClientRect().width})).filter(x=>x.r>"+width+"+1).slice(0,12)})");assert(layout.width<=width,JSON.stringify({viewport:width,...layout}));}console.log('PASS unique website footer fits 320/390/900px screens');
 server.closeAllConnections();await new Promise(r=>server.close(r));server=null;
 await send('Page.reload');await wait(1600);await until("document.readyState==='complete' && !!document.querySelector('#sys-switch')");console.log('PASS after update site opens offline with local server stopped');
 console.log('WEB_UPDATE_TOTAL 7 PASS 7 FAIL 0');
 }finally{if(ws)ws.close();if(server){server.closeAllConnections();server.close()}}
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack);process.exit(1)});
