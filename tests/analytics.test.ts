import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregate,makeDemo,parseRules,planSchema,range,buildQuery} from '../server/analytics.js';
const now=new Date('2026-10-22T15:30:00Z');
test('UTC full-day windows cross month boundaries',()=>{
 assert.deepEqual(range(planSchema.parse({days:30}),now),{start:'2026-09-22',end:'2026-10-22'});
 assert.deepEqual(range(planSchema.parse({days:1,offset:1}),now),{start:'2026-10-20',end:'2026-10-21'});
});
test('weighted activation rate, not mean of group rates',()=>{
 const facts=[{day:'2026-10-21',channel:'a',device:'mobile',newUsers:100,activatedUsers:50,paidUsers:10,orders:20,revenue:200},
 {day:'2026-10-21',channel:'b',device:'desktop',newUsers:900,activatedUsers:90,paidUsers:20,orders:40,revenue:400}];
 const result=aggregate(facts,planSchema.parse({metric:'activation_rate',view:'channel',days:1}),now);
 assert.ok(Math.abs(result.total-14)<1e-10);assert.deepEqual(result.rows.map(r=>r.value),[50,10]);
});
test('followups preserve date/metric and change filters',()=>{
 const p=parseRules('最近 7 天销售额趋势').plan!;
 const next=parseRules('只看移动端',p).plan!;
 assert.equal(next.days,7);assert.equal(next.metric,'revenue');assert.equal(next.view,'trend');assert.equal(next.device,'mobile');
 assert.equal(parseRules('与前一期对比',next).plan!.compare,true);
});
test('ambiguous, unsupported and excessive requests clarify',()=>{
 for(const q of ['转化率是多少','为什么订单下降','最近 999 天订单','7 日留存','上个月销售额','你好'])assert.ok(parseRules(q).clarification,q);
 assert.equal(planSchema.safeParse({view:'passwords'}).success,false);
 assert.equal(planSchema.safeParse({sql:'DROP TABLE users'}).success,false);
});
test('funnel stages ordered and device sums reconcile',()=>{
 const facts=makeDemo(now),p=planSchema.parse({days:30});
 const all=aggregate(facts,p,now).total;
 assert.equal(all,aggregate(facts,{...p,device:'mobile'},now).total+aggregate(facts,{...p,device:'desktop'},now).total);
 const f=aggregate(facts,{...p,view:'funnel'},now).rows;
 assert.ok(f[0].value>=f[1].value&&f[1].value>=f[2].value);
 assert.equal(aggregate(facts,{...p,view:'trend'},now).rows.length,30);
});
test('queries use parameter binding and approved object only',()=>{
 for(const view of ['total','trend','channel','device','funnel'] as const){
 const q=buildQuery(planSchema.parse({view}));
 assert.match(q,/analytics\.DailyFacts/);assert.match(q,/@start/);assert.match(q,/@device/);assert.doesNotMatch(q,/DELETE|UPDATE|INSERT/);
 }
});
test('empty range is distinguished from a measured zero',()=>assert.equal(aggregate([],planSchema.parse({}),now).count,0));

