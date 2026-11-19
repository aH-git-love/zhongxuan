/* Atomic website-only deployment. Inspect with no args; apply with --apply. */
const fs=require('fs'),https=require('https'),{spawnSync}=require('child_process');
const root='https://api.github.com/repos/aH-git-love/zhongxuan';
async function main(){
 const credential=spawnSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8'});
 const match=/password=(.+)/.exec(credential.stdout||''); if(!match)throw Error('GitHub credential missing');
 function api(method,path,body){return new Promise((resolve,reject)=>{const data=body?JSON.stringify(body):null;const r=https.request(root+path,{method,headers:{Authorization:'Bearer '+match[1].trim(),'User-Agent':'zhongxuan-web-publisher',Accept:'application/vnd.github+json','Content-Type':'application/json',...(data?{'Content-Length':Buffer.byteLength(data)}:{})},timeout:60000},res=>{let raw='';res.on('data',c=>raw+=c);res.on('end',()=>{let obj;try{obj=JSON.parse(raw)}catch{obj={}};if(res.statusCode>=300)reject(Error(method+' '+path+' '+res.statusCode+' '+(obj.message||'')));else resolve(obj)})});r.on('error',reject);r.on('timeout',()=>r.destroy(Error('HTTP timeout')));if(data)r.write(data);r.end()})}
 const ref=await api('GET','/git/ref/heads/main');const parent=await api('GET','/git/commits/'+ref.object.sha);const listing=await api('GET','/git/trees/'+parent.tree.sha+'?recursive=1');if(listing.truncated)throw Error('Remote tree truncated');
 const removed=listing.tree.filter(x=>x.type==='blob'&&/\.(apk|aab|zip)$/i.test(x.path));
 const selection=process.argv.find(a=>a.startsWith('--files='));
 const files=selection?selection.slice(8).split(','):['index.html','app.html','landing.html','css/app.css','css/landing.css','js/landing.js','manifest.webmanifest','art-credits.html','sw.js','README.md','js/brain.js','js/app.js','js/tarot.js','server.js','backend/brain-api.js','docs/brain-backend.md','tools/test_brain_core.js','tools/test_brain_api.js','tools/test_brain_browser.js','.gitignore'];
 if(process.argv.includes('--include-art')){
  const art=JSON.parse(fs.readFileSync('assets/tarot/rws/sources.json','utf8'));
  if(art.cards.length!==78)throw Error('Expected full 78-card image collection');
  for(const card of art.cards){if(!/^assets\/tarot\/rws\/[MCWSP]\d{2}\.webp$/.test(card.localImage))throw Error('Invalid art path');files.push(card.localImage)}
 }
 for(const file of files)fs.accessSync(file);
 const messageArg=process.argv.find(a=>a.startsWith('--message='));
 const message=messageArg?messageArg.slice(10):'Add rules-v2 brain backend, per-account feedback and offline-compatible client';
 console.log(JSON.stringify({parent:ref.object.sha,files,remove:removed.map(x=>x.path)},null,2));
 if(!process.argv.includes('--apply'))return;
 const tree=removed.map(x=>({path:x.path,mode:x.mode,type:'blob',sha:null}));
 for(const path of files){const blob=await api('POST','/git/blobs',{content:fs.readFileSync(path).toString('base64'),encoding:'base64'});tree.push({path,mode:'100644',type:'blob',sha:blob.sha})}
 const nextTree=await api('POST','/git/trees',{base_tree:parent.tree.sha,tree});const commit=await api('POST','/git/commits',{message,tree:nextTree.sha,parents:[ref.object.sha]});
 await api('PATCH','/git/refs/heads/main',{sha:commit.sha,force:false});console.log('PUBLISHED_COMMIT '+commit.sha);
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
