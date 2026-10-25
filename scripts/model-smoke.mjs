import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
let candidate="SELECT Channel AS channel, SUM(Revenue) AS sales FROM analytics.DailyFacts GROUP BY Channel ORDER BY sales DESC";
let chartFailure=false,providerFailure=false,badChart=false,requests=[];
const mock=createServer(async(req,res)=>{
 let raw='';for await(const chunk of req)raw+=chunk;
 const input=JSON.parse(raw);requests.push(input);
 const name=input.tools[0].function.name;
 if(providerFailure||name==='choose_chart'&&chartFailure){res.writeHead(503);res.end('{}');return;}
 const plan={metric:'revenue',view:'channel',days:7,offset:0,device:'all',compare:false};
 const args=name==='plan_query'?{action:'query',sql:candidate,plan,title:'渠道销售额',description:'各渠道支付销售额'}:
 {type:'bar',x:'channel',y:badChart?'secret':'sales',title:'渠道销售额'};
 res.setHeader('Content-Type','application/json');
 res.end(JSON.stringify({choices:[{message:{tool_calls:[{type:'function',function:{name,arguments:JSON.stringify(args)}}]}}]}));
});
await new Promise(r=>mock.listen(3025,'127.0.0.1',r));
const token='test-workspace-token-123456789';
const child=spawn(process.execPath,['dist/server/index.js'],{env:{...process.env,PORT:'3015',DATA_MODE:'demo',APP_TOKEN:token,SQL_DATABASE:'ProductAnalyticsDemo',LLM_API_KEY:'local-mock-only',LLM_MODEL:'test-model',LLM_BASE_URL:'http://127.0.0.1:3025/v1'},stdio:'pipe',windowsHide:true});
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('startup timeout')),10000);child.stdout.on('data',b=>{if(b.toString().includes('Lens v2 running')){clearTimeout(timer);resolve();}});child.on('exit',c=>{clearTimeout(timer);reject(new Error('exit '+c));});});
 const base='http://127.0.0.1:3015';
 const chat=async(body={message:'最近7天渠道销售额'},auth=token)=>{const r=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 assert.equal((await chat(undefined,'bad')).status,401);
 assert.equal((await fetch(base+'/api/policy')).status,401);
 assert.equal((await chat({message:'订单',readOnly:false})).status,400);
 const good=await chat();assert.equal(good.status,200);assert.equal(good.body.engine,'Text-to-SQL');assert.equal(good.body.records.length,4);assert.equal(good.body.chart.type,'bar');assert.equal(good.body.security.readOnly,true);assert.equal(good.body.security.accountVerified,false);
 const chartRequest=requests.find(r=>r.tools[0].function.name==='choose_chart');
 const chartInput=JSON.parse(chartRequest.messages[1].content);
 assert.deepEqual(Object.keys(chartInput).sort(),['columns','rowCount','title']);
 assert.equal(chartInput.records,undefined);
 await chat({message:'按设备看看',sessionId:good.body.sessionId});
 const lastPlan=requests.filter(r=>r.tools[0].function.name==='plan_query').at(-1);
 assert.ok(JSON.parse(lastPlan.messages[1].content).previous.sql);
 for(const sql of ['DELETE FROM analytics.DailyFacts','SELECT Revenue FROM master.analytics.DailyFacts','SELECT Revenue FROM analytics.DailyFacts; SELECT 1','SELECT Revenue INTO stolen FROM analytics.DailyFacts','SELECT name FROM sys.databases']){
  candidate=sql;const before=requests.length;const denied=await chat();assert.equal(denied.status,422,sql);assert.equal(denied.body.records,undefined);assert.equal(requests.length,before+1,'blocked SQL must not reach visualization');assert.ok(denied.body.code);
 }
 candidate="SELECT Channel AS channel, SUM(Revenue) AS sales FROM analytics.DailyFacts GROUP BY Channel ORDER BY sales DESC";
 chartFailure=true;assert.equal((await chat()).body.chart.type,'table');chartFailure=false;
 badChart=true;assert.equal((await chat()).body.chart.type,'table');badChart=false;
 providerFailure=true;const failure=await chat();assert.equal(failure.status,503);assert.equal(failure.body.records,undefined);
 console.log('PASS: mock model SQL generation -> AST guard -> actual demo SQL -> model chart; unauthorized requests and 5 unsafe outputs blocked; provider/chart failure handled; query results never sent to model.');
}finally{
 const stopped=new Promise(r=>child.once('exit',r));child.kill();await stopped;
 await new Promise(r=>mock.close(r));
}
