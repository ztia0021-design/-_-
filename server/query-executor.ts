import sql from 'mssql';
import { DatabaseSync } from 'node:sqlite';
import { makeDemo, range, type Plan } from './analytics.js';
import { policy, reject, selectedDatabase } from './policy.js';
import { approveSql } from './sql-guard.js';
export const dataMode=process.env.DATA_MODE??'demo';
if(!['demo','sqlserver'].includes(dataMode))throw new Error('Invalid DATA_MODE');
type Cell=string|number|null;
export type RecordRow=Record<string,Cell>;
let pool:Promise<sql.ConnectionPool>|undefined;
let active=0;
function config():sql.config{
 if(!process.env.SQL_USER||!process.env.SQL_PASSWORD)throw new Error('SQL credentials required');
 return {server:process.env.SQL_SERVER??'localhost',port:Number(process.env.SQL_PORT??1433),database:selectedDatabase(),user:process.env.SQL_USER,password:process.env.SQL_PASSWORD,
  options:{encrypt:process.env.SQL_ENCRYPT!=='false',trustServerCertificate:process.env.SQL_TRUST_CERT==='true'},pool:{max:policy.maxConcurrentQueries,min:0,idleTimeoutMillis:30000},
  connectionTimeout:10000,requestTimeout:policy.queryTimeoutMs};
}
export function assertReadOnlyPermissions(server:string[],database:string[],object:string[],outsideWriteCount:number){
 const allowedServer=['CONNECT SQL','VIEW ANY DATABASE'],allowedDatabase=['CONNECT','VIEW DEFINITION','VIEW ANY COLUMN ENCRYPTION KEY DEFINITION','VIEW ANY COLUMN MASTER KEY DEFINITION'],allowedObject=['SELECT','VIEW DEFINITION'];
 if(server.some(p=>!allowedServer.includes(p))||database.some(p=>!allowedDatabase.includes(p))||
 object.some(p=>!allowedObject.includes(p))||!object.includes('SELECT')||outsideWriteCount>0)
  reject('ACCOUNT_NOT_READONLY','数据库账号未通过最小只读权限检查。请使用专用 SELECT 账号，不要使用管理员或写入账号。');
}
async function verifyConnection(tx:sql.Transaction,table:string){
 const database=selectedDatabase();
 const permission=await new sql.Request(tx).input('object',sql.NVarChar(256),table).query(
  "SELECT DB_NAME() AS DbName; SELECT permission_name FROM sys.fn_my_permissions(NULL,'SERVER'); "+
  "SELECT permission_name FROM sys.fn_my_permissions(NULL,'DATABASE'); "+
  "SELECT permission_name FROM sys.fn_my_permissions(@object,'OBJECT'); "+
  "SELECT COUNT(*) AS N FROM sys.objects o CROSS APPLY sys.fn_my_permissions(QUOTENAME(SCHEMA_NAME(o.schema_id))+'.'+QUOTENAME(o.name),'OBJECT') p "+
  "WHERE o.is_ms_shipped=0 AND p.permission_name NOT IN ('SELECT','VIEW DEFINITION');");
 const sets=permission.recordsets as sql.IRecordSet<any>[];
 if(String(sets[0]?.[0]?.DbName).toLowerCase()!==database.toLowerCase())reject('DATABASE_DENIED','实际数据库与授权连接不匹配。');
 assertReadOnlyPermissions(sets[1].map(r=>r.permission_name),sets[2].map(r=>r.permission_name),sets[3].map(r=>r.permission_name),Number(sets[4][0].N));
 // Only physical local tables are accepted. Views/synonyms could hide external access.
 const meta=await new sql.Request(tx).input('object',sql.NVarChar(256),table).query(
  "SELECT o.type, CASE WHEN EXISTS(SELECT 1 FROM sys.external_tables e WHERE e.object_id=o.object_id) THEN 1 ELSE 0 END AS ExternalTable FROM sys.objects o WHERE o.object_id=OBJECT_ID(@object);"+
  "SELECT name,is_computed FROM sys.columns WHERE object_id=OBJECT_ID(@object);");
 const metadata=meta.recordsets as sql.IRecordSet<any>[];
 if(metadata[0]?.[0]?.type!=='U'||metadata[0]?.[0]?.ExternalTable!==0||metadata[1].some(r=>r.is_computed))reject('OBJECT_TYPE_DENIED','当前只允许本地物理表，禁止视图、同义词、外部表和计算列。');
}
function normalize(records:Record<string,unknown>[]):RecordRow[]{
 return records.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v instanceof Date?v.toISOString().slice(0,10):v===null?null:typeof v==='number'?v:String(v)])));
}
export async function executeQuery(candidate:string,plan:Plan,now=new Date()){
 const approved=approveSql(candidate); // Revalidate at execution boundary.
 if(active>=policy.maxConcurrentQueries)reject('BUSY','查询并发已达上限，请稍后重试。');
 active++;
 const window=range(plan,now),params={start:window.start,end:window.end,device:plan.device};
 const started=Date.now();
 try{
 let records:RecordRow[],accountVerified=false;
 if(dataMode==='demo'){
  const db=new DatabaseSync(':memory:');
  try{
   db.exec('CREATE TABLE DailyFacts (Day TEXT, Channel TEXT, Device TEXT, NewUsers INTEGER, ActivatedUsers INTEGER, PaidUsers INTEGER, Orders INTEGER, Revenue REAL, UpdatedAt TEXT)');
   const insert=db.prepare('INSERT INTO DailyFacts VALUES (?,?,?,?,?,?,?,?,?)');
   for(const r of makeDemo(now))insert.run(r.day,r.channel,r.device,r.newUsers,r.activatedUsers,r.paidUsers,r.orders,r.revenue,now.toISOString());
   db.exec('PRAGMA query_only = ON');
   const stmt=db.prepare(approved.demoSql);stmt.setAllowUnknownNamedParameters(true);
   records=normalize(stmt.all({...params,...Object.fromEntries(approved.bindings.map(b=>[b.name,b.value]))}));
  }finally{db.close();}
 }else{
  pool??=new sql.ConnectionPool(config()).connect().catch(e=>{pool=undefined;throw e});
  const tx=new sql.Transaction(await pool);await tx.begin();
  try{
   await verifyConnection(tx,approved.table);accountVerified=true;
   const request=new sql.Request(tx).input('start',sql.Date,window.start).input('end',sql.Date,window.end).input('device',sql.NVarChar(16),plan.device);
   for(const p of approved.bindings)request.input(p.name,sql.NVarChar(256),p.value);
   const response=await request.query(approved.sql);records=normalize(response.recordset);
   await tx.commit();
  }catch(e){await tx.rollback().catch(()=>{});throw e;}
 }
 const truncated=records.length>policy.maxRows;
 records=records.slice(0,policy.maxRows);
 return {records,columns:approved.columns,window,parameters:{...params,...Object.fromEntries(approved.bindings.map(b=>[b.name,b.value]))},
   sql:approved.sql,originalSql:approved.originalSql,truncated,userLimit:approved.userLimit,durationMs:Date.now()-started,
   security:{status:'passed',readOnly:true,statement:'SELECT',database:approved.database,table:approved.table,
    checks:approved.checks,accountVerified,accountStatus:accountVerified?'已校验 SQL Server 实际权限':'演示引擎 query_only；未验证 SQL Server 账号'},
   queriedAt:now.toISOString()};
 }finally{active--;}
}

