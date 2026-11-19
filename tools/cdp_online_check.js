async function main(){
 const list=await(await fetch('http://127.0.0.1:9229/json/list')).json();
 const p=list.find(x=>x.type==='page'); if(!p) throw Error('no page');
 console.log('TARGET',p.url);
 const ws=new WebSocket(p.webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
 let id=0;const pending=new Map();const exceptions=[];
 ws.onmessage=e=>{const x=JSON.parse(e.data);if(x.method==='Runtime.exceptionThrown')exceptions.push(x.params.exceptionDetails.text);if(x.id&&pending.has(x.id)){const q=pending.get(x.id);pending.delete(x.id);q.resolve(x)}};
 const send=(method,params={},ms=5000)=>new Promise((resolve,reject)=>{const n=++id;const t=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout '+method))},ms);pending.set(n,{resolve:x=>{clearTimeout(t);resolve(x)}});ws.send(JSON.stringify({id:n,method,params}))});
 const ev=async s=>{const x=await send('Runtime.evaluate',{expression:s,returnByValue:true,awaitPromise:true});if(x.error)throw Error(x.error.message);return x.result.result.value};
 await send('Page.enable');await send('Runtime.enable');console.log('CDP_READY');
 const nav=await send('Page.navigate',{url:'https://ah-git-love.github.io/zhongxuan/app.html'},20000);console.log('NAV',JSON.stringify(nav));
 await new Promise(r=>setTimeout(r,6000));
 console.log('PAGE',JSON.stringify(await ev("(async()=>({title:document.title,sys:document.body.dataset.sys,sw:!!navigator.serviceWorker.controller,caches:await caches.keys(),tarot:!!window.TAROT,history:!!document.querySelector('#tr-history-list'),loaded:document.readyState,body:document.body.innerText.slice(0,120)}))()")));
 console.log('CLICK',await ev("document.querySelector('#sys-switch [data-sys=tarot]').click();document.querySelector('#tr-q').value='线上验证';document.querySelector('#tr-draw').click();true"));
 await new Promise(r=>setTimeout(r,400));
 console.log('RESULT',JSON.stringify(await ev("({sys:document.body.dataset.sys,cards:document.querySelectorAll('#tr-result .tr-card').length,reason:document.querySelectorAll('#tr-result .tr-reason-row').length,history:document.querySelectorAll('#tr-history-list .tr-history-row').length,verdict:document.querySelector('#tr-result .tr-synthesis')?.innerText})")));
 await send('Page.reload'); await new Promise(r=>setTimeout(r,2500));
 console.log('RELOAD',JSON.stringify(await ev("(async()=>({sys:document.body.dataset.sys,history:document.querySelectorAll('#tr-history-list .tr-history-row').length,cache:(await caches.keys()).filter(k=>k.includes('zhongxuan'))}))()")));
 console.log('EXCEPTIONS',JSON.stringify(exceptions));
 ws.close();setTimeout(()=>process.exit(0),100);
}
main().catch(e=>{console.error(e.stack||e);process.exit(1)});
