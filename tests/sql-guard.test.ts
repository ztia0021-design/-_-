import test from 'node:test';
import assert from 'node:assert/strict';
import { approveSql } from '../server/sql-guard.js';
import { policySchema, policy } from '../server/policy.js';
import { executeQuery, assertReadOnlyPermissions } from '../server/query-executor.js';
import { planSchema, aggregate, makeDemo } from '../server/analytics.js';
import { validateChart } from '../server/text-to-sql.js';
const now=new Date('2026-10-24T04:00:00Z'),plan=planSchema.parse({days:7});
const valid='SELECT Channel AS label, SUM(Revenue) AS value FROM analytics.DailyFacts GROUP BY Channel ORDER BY value DESC';
test('read-only policy cannot be disabled or extended to writes',()=>{
 assert.equal(policySchema.safeParse({...policy,readOnly:false}).success,false);
 assert.equal(policySchema.safeParse({...policy,allowedStatements:['SELECT','UPDATE']}).success,false);
});
test('approved AST is rebuilt, literal values are bound and scope is forced',()=>{
 const query=approveSql("SELECT SUM(Revenue) AS value FROM analytics.DailyFacts WHERE Channel = N'付费广告' OR 1=1");
 assert.match(query.sql,/SELECT TOP \(201\)/);assert.match(query.sql,/\[ProductAnalyticsDemo\]\.\[analytics\]\.\[DailyFacts\]/);
 assert.match(query.sql,/\[Day\] >= @start/);assert.match(query.sql,/@lit0/);
 assert.doesNotMatch(query.sql,/付费广告/);assert.equal(query.bindings[0].value,'付费广告');
});
for(const [name,query] of Object.entries({
 update:'UPDATE analytics.DailyFacts SET Revenue=0',
 delete:'DELETE FROM analytics.DailyFacts',insert:'INSERT INTO analytics.DailyFacts (Revenue) VALUES (0)',
 drop:'DROP TABLE analytics.DailyFacts',exec:"EXEC('SELECT 1')",
 batch:valid+'; DELETE FROM analytics.DailyFacts',
 into:'SELECT Revenue INTO stolen FROM analytics.DailyFacts',
 otherDb:'SELECT Revenue FROM master.analytics.DailyFacts',
 otherSchema:'SELECT Revenue FROM dbo.DailyFacts',
 system:'SELECT name FROM sys.databases',
 wildcard:'SELECT * FROM analytics.DailyFacts',
 secretColumn:'SELECT Password FROM analytics.DailyFacts',
 userFunction:'SELECT dbo.steal(Revenue) AS value FROM analytics.DailyFacts',
 builtinFunction:'SELECT SUSER_SNAME() AS value FROM analytics.DailyFacts',
 subquery:'SELECT (SELECT SUM(Revenue) FROM analytics.DailyFacts) AS value FROM analytics.DailyFacts',
 union:valid+' UNION SELECT Channel,SUM(Revenue) FROM analytics.DailyFacts GROUP BY Channel',
 cte:'WITH a AS (SELECT Revenue FROM analytics.DailyFacts) SELECT Revenue FROM a',
 join:'SELECT a.Revenue FROM analytics.DailyFacts a JOIN analytics.DailyFacts b ON a.Day=b.Day',
 hint:'SELECT Revenue FROM analytics.DailyFacts WITH (NOLOCK)',
 global:'SELECT @@VERSION AS value FROM analytics.DailyFacts',
 unknownParameter:'SELECT Revenue FROM analytics.DailyFacts WHERE Revenue>@password',
 topPercent:'SELECT TOP 10 PERCENT Revenue FROM analytics.DailyFacts',
 hugeLimit:'SELECT TOP 999999 Revenue FROM analytics.DailyFacts',
 external:"SELECT Revenue FROM OPENROWSET('a','b','c')",
 fourPart:'SELECT Revenue FROM remote.ProductAnalyticsDemo.analytics.DailyFacts',
 malformed:'SELECT ???'
}))test('reject '+name,()=>assert.throws(()=>approveSql(query),name));
test('one authorized database may be fully qualified',()=>assert.ok(approveSql('SELECT SUM(Orders) AS value FROM ProductAnalyticsDemo.analytics.DailyFacts').sql));
test('unauthorized connection database is rejected',()=>assert.throws(()=>approveSql(valid,'master')));
test('demo executes actual approved query, including new filtering and ranking',async()=>{
 const result=await executeQuery("SELECT TOP 2 Channel AS label, SUM(Revenue) AS value FROM analytics.DailyFacts WHERE Device=N'mobile' GROUP BY Channel ORDER BY value DESC",plan,now);
 assert.equal(result.records.length,2);assert.ok(Number(result.records[0].value)>=Number(result.records[1].value));assert.equal(result.userLimit,true);
 const expected=aggregate(makeDemo(now),{...plan,metric:'revenue',device:'mobile',view:'channel'},now).rows.sort((a,b)=>b.value-a.value).slice(0,2);
 assert.equal(result.records[0].label,expected[0].label);assert.equal(result.records[0].value,expected[0].value);
});
test('OR 1=1 cannot bypass enforced time/device scope',async()=>{
 const result=await executeQuery('SELECT SUM(NewUsers) AS value FROM analytics.DailyFacts WHERE 1=1 OR 2=2',{...plan,device:'mobile'},now);
 assert.equal(result.records[0].value,aggregate(makeDemo(now),{...plan,device:'mobile'},now).total);
});
test('truncation explicitly flagged',async()=>{
 const r=await executeQuery('SELECT Day,Channel FROM analytics.DailyFacts',{...plan,days:90},now);
 assert.equal(r.records.length,200);assert.equal(r.truncated,true);
});
test('null denominator stays null and renders as table',async()=>{
 const r=await executeQuery('SELECT 100.0 * SUM(ActivatedUsers) / NULLIF(SUM(NewUsers),0) AS value FROM analytics.DailyFacts WHERE NewUsers < 0',plan,now);
 assert.equal(r.records[0].value,null);
 assert.equal(validateChart({type:'metric',x:null,y:'value',title:'test'},r.records,r.columns,'test').type,'table');
});
test('chart selection rejects invented fields, executable payloads and unsorted dates',()=>{
 const rows=[{Day:'2026-10-23',value:1},{Day:'2026-10-22',value:2}];
 assert.equal(validateChart({type:'line',x:'Day',y:'value',title:'test'},rows,['Day','value'],'test').type,'table');
 assert.equal(validateChart({type:'bar',x:'Day',y:'secret',title:'test'},rows,['Day','value'],'test').type,'table');
 assert.equal(validateChart({type:'bar',x:'Day',y:'value',title:'test',url:'https://bad'},rows,['Day','value'],'test').type,'table');
});
test('database permission checks deny elevated or writable accounts',()=>{
 assert.doesNotThrow(()=>assertReadOnlyPermissions(['CONNECT SQL','VIEW ANY DATABASE'],['CONNECT'],['SELECT'],0));
 assert.throws(()=>assertReadOnlyPermissions(['CONTROL SERVER'],['CONNECT'],['SELECT'],0));
 assert.throws(()=>assertReadOnlyPermissions(['CONNECT SQL'],['CONTROL'],['SELECT'],0));
 assert.throws(()=>assertReadOnlyPermissions(['CONNECT SQL'],['CONNECT'],['SELECT','UPDATE'],0));
 assert.throws(()=>assertReadOnlyPermissions(['CONNECT SQL'],['CONNECT'],['SELECT'],1));
 assert.throws(()=>assertReadOnlyPermissions(['CONNECT SQL'],['CONNECT'],[],0));
});
