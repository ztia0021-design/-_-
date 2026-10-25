import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const token='test-only-workspace-token-12345678';
async function check(mode,port) {
 const child=spawn(process.execPath,['dist/server/index.js'],{env:{...process.env,PORT:String(port),DATA_MODE:mode,APP_TOKEN:token,LLM_API_KEY:'',SQL_USER:'',SQL_PASSWORD:''},stdio:'pipe',windowsHide:true});
 try{
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('Server startup timeout')),10000);
   child.stdout.on('data',buf=>{if(buf.toString().includes('Lens v2 running')){clearTimeout(timer);resolve()}});
   child.on('exit',code=>{clearTimeout(timer);reject(new Error('Early exit '+code))});
  });
  const send=authorization=>fetch('http://127.0.0.1:'+port+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',...(authorization?{Authorization:'Bearer '+authorization}:{})},body:JSON.stringify({message:'最近 7 天订单'})});
  assert.equal((await send()).status,401);
  assert.equal((await send('incorrect')).status,401);
  const response=await send(token);
  assert.equal(response.status,mode==='demo'?200:503);
  const body=await response.json();
  if(mode==='sqlserver'){assert.ok(body.error);assert.equal(body.rows,undefined);}
 }finally{child.kill();await new Promise(resolve=>child.once('exit',resolve));}
}
await check('demo',3011);await check('sqlserver',3012);
console.log('PASS: missing/wrong tokens rejected; valid token accepted; SQL failure never falls back to demo.');

