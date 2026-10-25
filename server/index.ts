import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { policy, selectedDatabase, QueryRejected } from './policy.js';
import { dataMode, executeQuery } from './query-executor.js';
import { draftQuery, chooseChart, type Context } from './text-to-sql.js';
const app=express(),port=Number(process.env.PORT??3000),token=process.env.APP_TOKEN??'';
selectedDatabase();
if(dataMode==='sqlserver'&&token.length<24)throw new Error('SQL Server mode requires APP_TOKEN of at least 24 characters.');
const sessions=new Map<string,{context:Context;time:number}>();
setInterval(()=>{for(const [id,s] of sessions)if(Date.now()-s.time>3600000)sessions.delete(id)},60000).unref();
await mkdir('logs',{recursive:true});
const audit=(record:unknown)=>appendFile('logs/audit.jsonl',JSON.stringify(record)+'\n');
app.use(helmet({contentSecurityPolicy:{directives:{"script-src":["'self'"],"style-src":["'self'","'unsafe-inline'"]}}}));
app.use(express.json({limit:'8kb'}));
app.get('/api/health',(_req,res)=>res.json({ok:true,version:'2.0.0',dataMode,engine:process.env.LLM_API_KEY?'Text-to-SQL':'规则解析（无模型）',authRequired:!!token,readOnly:true}));
app.use('/api',rateLimit({windowMs:60000,limit:30,standardHeaders:true,legacyHeaders:false}));
app.use('/api',(req,res,next)=>{
 if(!token)return next();
 const supplied=Buffer.from(req.headers.authorization?.replace(/^Bearer /,'')??''),expected=Buffer.from(token);
 if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return res.status(401).json({error:'访问凭证无效，请在连接设置中输入 APP_TOKEN。'});
 next();
});
app.get('/api/policy',(_req,res)=>res.json({...policy,database:selectedDatabase(),
 allowedFunctions:['SUM','COUNT','AVG','MIN','MAX','NULLIF','ABS','ROUND'],
 scope:'仅单条 SELECT、单张本地物理表；不允许 JOIN、CTE、子查询、UNION、EXEC、SELECT INTO 或跨库查询。'}));
const input=z.object({message:z.string().trim().min(1).max(1000),sessionId:z.string().uuid().optional()}).strict();
app.post('/api/chat',async(req,res)=>{
 const parsed=input.safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:'问题不能为空且不能超过 1000 字；请求只接受 message 和 sessionId。'});
 const requestId=randomUUID(),sessionId=parsed.data.sessionId??randomUUID(),started=Date.now();
 try{
  const existing=sessions.get(sessionId);
  if(parsed.data.sessionId&&!existing)return res.status(409).json({error:'会话已过期或服务已重启，请新建分析后重新描述完整问题。'});
  const resolved=await draftQuery(parsed.data.message,existing?.context);
  if(!resolved.draft){await audit({requestId,status:'clarification',at:new Date().toISOString()});return res.json({clarification:resolved.clarification,engine:resolved.engine,requestId});}
  const draft=resolved.draft,now=new Date();
  const current=await executeQuery(draft.sql,draft.plan,now);
  const comparison=draft.plan.compare?await executeQuery(draft.sql,{...draft.plan,offset:draft.plan.offset+draft.plan.days},now):null;
  const visual=await chooseChart(current.records,current.columns,draft.title);
  const noData=current.records.length===0||current.records.every(r=>Object.values(r).every(v=>v===null));
  const summary=noData?'当前条件下没有可展示的有效结果。':
    '查询返回 '+current.records.length+' 行、'+current.columns.length+' 列。'+
    (visual.chart.type==='metric'?' '+visual.chart.y+' = '+Number(current.records[0][visual.chart.y!]).toLocaleString('zh-CN',{maximumFractionDigits:2})+'。':'')+
    (current.truncated?'结果已截断，不能当作完整分布或总量。':'')+
    (comparison?'已附前一期独立结果，请在明细中核查对比。':'');
  const result={version:2,requestId,sessionId,engine:resolved.engine,dataMode,title:draft.title,summary,noData,plan:draft.plan,
   records:current.records,columns:current.columns,chart:current.truncated?{type:'table',x:null,y:null,title:draft.title}:visual.chart,
   chartSource:current.truncated?'截断结果使用表格':visual.source,truncated:current.truncated,userLimit:current.userLimit,security:current.security,
   comparison:comparison?{records:comparison.records,columns:comparison.columns,window:comparison.window,truncated:comparison.truncated}:null,
   evidence:{...current.window,timezone:'UTC',definition:draft.description,source:dataMode==='demo'?'内存 SQLite 执行同一受限 AST；数据为模拟电商聚合':'SQL Server · '+current.security.database+'.'+current.security.table,
    queriedAt:current.queriedAt,originalSql:current.originalSql,sql:current.sql,parameters:current.parameters,
    comparison:comparison?{sql:comparison.sql,parameters:comparison.parameters}:null,
    limitations:['日期按 UTC 且不含今天；时间与设备范围由后端强制限制。','通过安全检查不代表业务口径正确，请核查生成 SQL 与指标定义。','模型仅获取结构与问题，图表选择只发送列类型和行数，不发送结果值。','当前仅单工作区凭证，未实现多用户权限或租户隔离。',dataMode==='demo'?'演示 SQL 使用 SQLite 执行；T-SQL 在真实 SQL Server 上仍需集成验收。':'查询时间不等于数据更新时间；需在业务 ETL 中核查数据新鲜度。']},
   changed:existing?Object.keys(draft.plan).filter(k=>draft.plan[k as keyof typeof draft.plan]!==existing.context.plan[k as keyof typeof draft.plan]):[]};
  await audit({requestId,sessionId,at:now.toISOString(),status:'success',engine:resolved.engine,dataMode,security:current.security,sql:current.sql,plan:draft.plan,
   rowCount:current.records.length,truncated:current.truncated,durationMs:Date.now()-started,comparison:comparison?{sql:comparison.sql,window:comparison.window}:null});
  if(sessions.size>=500&&!sessions.has(sessionId))sessions.delete(sessions.keys().next().value!);
  sessions.set(sessionId,{context:{plan:draft.plan,sql:draft.sql,title:draft.title},time:Date.now()});
  res.json(result);
 }catch(error){
  const denied=error instanceof QueryRejected;
  await audit({requestId,at:new Date().toISOString(),status:denied?'blocked':'error',code:denied?error.code:'SERVICE_ERROR',durationMs:Date.now()-started}).catch(()=>{});
  res.status(denied?422:503).json({error:denied?'查询已被拦截：'+error.message:'分析服务暂时不可用，请检查数据库或模型配置。没有返回替代数据。',code:denied?error.code:'SERVICE_ERROR',requestId});
 }
});
app.use('/api',(_req,res)=>res.status(404).json({error:'接口不存在'}));
const client=path.resolve('dist/client/browser');app.use(express.static(client));app.get('/',(_req,res)=>res.sendFile(path.join(client,'index.html')));
app.use((_error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(400).json({error:'请求格式无效或内容过大。'}));
app.listen(port,'127.0.0.1',()=>console.log('Lens v2 running at http://127.0.0.1:'+port+' · '+dataMode));
