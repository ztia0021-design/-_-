import { z } from 'zod';
export const planSchema = z.object({
  metric: z.enum(['new_users','orders','revenue','activation_rate']).default('new_users'),
  view: z.enum(['total','trend','channel','device','funnel']).default('total'),
  days: z.number().int().min(1).max(90).default(30),
  offset: z.number().int().min(0).max(180).default(0),
  device: z.enum(['all','mobile','desktop']).default('all'),
  compare: z.boolean().default(false)
}).strict();
export type Plan = z.infer<typeof planSchema>;
export type Fact = { day:string; channel:string; device:string; newUsers:number; activatedUsers:number; paidUsers:number; orders:number; revenue:number };
export type Row = { label:string; value:number };
export const metrics = {
  new_users: {name:'新增用户',unit:'人',definition:'按 UTC 注册日期统计的去重用户数；渠道和设备取注册时的归属。'},
  orders: {name:'支付订单量',unit:'笔',definition:'按 UTC 支付日期统计的已支付订单数；不含未支付订单，未扣除后续退款。'},
  revenue: {name:'支付销售额',unit:'元',definition:'按 UTC 支付日期汇总的订单支付金额，币种 CNY，未扣除后续退款。'},
  activation_rate: {name:'当日激活率',unit:'%',definition:'注册当天完成核心操作的新用户数 ÷ 同期注册用户数；按 UTC 日界限。非跨日生命周期激活率。'}
};
export function range(plan:Plan, now=new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
  end.setUTCDate(end.getUTCDate()-plan.offset);
  const start = new Date(end); start.setUTCDate(start.getUTCDate()-plan.days);
  return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}
export function makeDemo(now=new Date()):Fact[] {
  const end = new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
  const rows:Fact[]=[];
  const channels=['自然搜索','付费广告','社交媒体','直接访问'];
  for(let ago=360;ago>=1;ago--) {
    const date=new Date(end);date.setUTCDate(date.getUTCDate()-ago);
    for(let c=0;c<4;c++) for(let d=0;d<2;d++) {
      const dayNumber=Math.floor(date.getTime()/86400000);
      const wave=1+0.15*Math.sin(dayNumber*0.6+c);
      const n=Math.round((72+c*19)*(d?0.65:1.25)*wave);
      const activated=Math.round(n*(0.52+c*.04-(ago<=7&&c===1?.13:0)));
      const paid=Math.round(activated*(.25+c*.025));
      const orders=paid+Math.round(n*.18);
      rows.push({day:date.toISOString().slice(0,10),channel:channels[c],device:d?'desktop':'mobile',newUsers:n,activatedUsers:activated,paidUsers:paid,orders,revenue:Math.round(orders*(105+c*31)*100)/100});
    }
  }
  return rows;
}
export function valueOf(rows:Fact[], metric:Plan['metric']) {
  const total=(field:keyof Fact)=>rows.reduce((s,r)=>s+Number(r[field]),0);
  if(metric==='activation_rate') return total('newUsers')?total('activatedUsers')/total('newUsers')*100:0;
  return total(metric==='new_users'?'newUsers':metric==='orders'?'orders':'revenue');
}
export function aggregate(facts:Fact[],plan:Plan, now=new Date()) {
  const window=range(plan,now);
  const filtered=facts.filter(r=>r.day>=window.start&&r.day<window.end&&(plan.device==='all'||r.device===plan.device));
  const total=valueOf(filtered,plan.metric);
  const rows:Row[]=[];
  if(plan.view==='funnel') {
    for(const [label,key] of [['注册','newUsers'],['当日激活','activatedUsers'],['当日付费','paidUsers']] as const)
      rows.push({label,value:filtered.reduce((s,r)=>s+r[key],0)});
  } else if(plan.view==='total') rows.push({label:metrics[plan.metric].name,value:total});
  else {
    const key=plan.view==='trend'?'day':plan.view;
    for(const label of [...new Set(filtered.map(r=>r[key]))].sort()) rows.push({label:label==='mobile'?'移动端':label==='desktop'?'桌面端':label,value:valueOf(filtered.filter(r=>r[key]===label),plan.metric)});
  }
  return {rows,total,window,count:filtered.length};
}
export function parseRules(message:string,previous?:Plan): {plan?:Plan;clarification?:string} {
  const p:Plan={...planSchema.parse(previous??{})};
  if(/今天|本日|渠道为|渠道是|只看.*渠道|删除|修改|DROP|DELETE|INSERT|UPDATE|留存|原因|为什么|因果|预测|成本|利润|退款|版本|月初|上个月|本月|这周|本周|上周|20\d\d[-年/]/.test(message))
    return {clarification:'当前规则模式支持最近 N 天、昨天或前天的新增用户、订单量、销售额、当日激活率和漏斗。日历周/月、留存及因果分析尚未支持。可以问“最近 7 天当日激活率，按渠道拆分，与前一期对比”。'};
  if(/转化率/.test(message)&& !/激活/.test(message)) return {clarification:'请明确转化口径。第一版支持“当日激活率”或“注册到当日付费漏斗”，不将它们当作跨日付费转化率。'};
  let recognized=false;
  for(const [regex,metric] of [[/新增|新用户|注册人数/,'new_users'],[/订单/,'orders'],[/销售额|收入|营收/,'revenue'],[/激活率/,'activation_rate']] as const)
    if(regex.test(message)){p.metric=metric;recognized=true;}
  const match=message.match(/(?:最近|过去|近)\s*(\d+)\s*天/);
  if(match){p.days=Number(match[1]);p.offset=0;recognized=true;}
  if(/昨天/.test(message)){p.days=1;p.offset=0;recognized=true;}
  if(/前天/.test(message)){p.days=1;p.offset=1;recognized=true;}
  if(/趋势|每天|每日|走势/.test(message)){p.view='trend';recognized=true;}
  if(/按渠道|各渠道|哪个渠道/.test(message)){p.view='channel';recognized=true;}
  if(/按设备|各设备/.test(message)){p.view='device';recognized=true;}
  if(/漏斗/.test(message)){p.view='funnel';p.metric='new_users';recognized=true;}
  if(/总计|总共|总量|汇总/.test(message)){p.view='total';recognized=true;}
  if(/移动端|手机/.test(message)){p.device='mobile';recognized=true;}
  if(/桌面端|电脑/.test(message)){p.device='desktop';recognized=true;}
  if(/全部设备|所有设备/.test(message)){p.device='all';recognized=true;}
  if(/对比|相比|前一期|环比/.test(message)){p.compare=true;recognized=true;}
  if(/不对比/.test(message))p.compare=false;
  if(!recognized)return {clarification:'我还不能可靠地理解这个问题。试试“最近 30 天新增用户趋势”“按渠道拆分”“只看移动端”或“注册到当日付费漏斗”。'};
  const result=planSchema.safeParse(p);
  return result.success?{plan:result.data}:{clarification:'单次分析支持 1–90 天，日期偏移最多 180 天，请缩小范围。'};
}
export function buildQuery(plan:Plan) {
  const value=plan.metric==='activation_rate'?'100.0 * SUM(ActivatedUsers) / NULLIF(SUM(NewUsers), 0)':
    'SUM('+({new_users:'NewUsers',orders:'Orders',revenue:'Revenue'} as const)[plan.metric]+')';
  const group=({trend:'CONVERT(char(10), [Day], 23)',channel:'Channel',device:'Device'} as Record<string,string>)[plan.view];
  const select=plan.view==='funnel'?'SUM(NewUsers) AS Registered, SUM(ActivatedUsers) AS Activated, SUM(PaidUsers) AS Paid':
    (group?group+" AS Label, ":"")+value+' AS Value';
  return 'SELECT '+select+' FROM analytics.DailyFacts WHERE [Day] >= @start AND [Day] < @end AND (@device = N\'all\' OR Device = @device)'+(group?' GROUP BY '+group+' ORDER BY '+group:'')+';';
}

