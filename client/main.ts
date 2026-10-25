import { Component, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
type Message={role:'user'|'assistant';text:string;result?:any;error?:boolean};
@Component({
 selector:'app-root',standalone:true,imports:[FormsModule],template:`
 <div class="layout">
  <aside class="sidebar">
   <a class="brand" href="/" aria-label="Lens 首页"><span class="brand-icon">◈</span> lens<span class="brand-dot">.</span></a>
   <div class="workspace"><span class="workspace-icon">P</span><div>Product workspace<small>产品分析工作区</small></div><span class="chevron">⌄</span></div>
   <button class="new-chat" (click)="reset()" [disabled]="busy()">＋ 新建分析 <span>↗</span></button>
   <div class="section-label">工作台</div>
   <button class="nav" [class.active]="tab()==='chat'" (click)="tab.set('chat')"><span>◫</span> 数据对话</button>
   <button class="nav" [class.active]="tab()==='metrics'" (click)="tab.set('metrics')"><span>▦</span> 指标字典</button>
   <button class="nav" [class.active]="tab()==='settings'" (click)="tab.set('settings')"><span>⚙</span> 连接设置</button>
   <div class="section-label recent-label">本次分析</div>
   @if(messages().length){<button class="history" (click)="tab.set('chat')">{{ firstQuestion() }}</button>}
   @else {<p class="empty-history">从一个业务问题开始，<br>让数据给出答案。</p>}
   <div class="sidebar-bottom"><div class="connection"><i></i>{{ health()?.dataMode==='sqlserver'?'SQL Server 模式':'演示数据工作区' }}</div><small>只读分析 · 查询可追溯</small><div class="profile"><span>PM</span><div>产品团队<small>受控 Text-to-SQL / v2.0</small></div></div></div>
  </aside>
  <main>
   <header><div><span class="breadcrumb">工作台 / </span>{{tab()==='chat'?'数据对话':tab()==='metrics'?'指标字典':'连接设置'}}</div><span class="mode">{{health()?.dataMode==='sqlserver'?'SQL SERVER':'DEMO'}}<span class="status-dot"></span></span></header>
   @if(tab()==='chat'){
    <div class="chat-scroll" id="chat-scroll">
    @if(!messages().length){
      <section class="welcome">
        <div class="eyebrow"><span></span> YOUR DATA, IN FOCUS</div>
        <h1>每一个好问题，<br>都值得一个<span>有依据的答案。</span></h1>
        <p class="intro">用自然语言探索产品表现。看清趋势，发现差异，<br class="desktop-only">从数据中找到下一步的方向。</p>
        <div class="capabilities"><span>✧ 自然语言分析</span><span>◷ 连续追问</span><span>☷ 数据依据可核查</span></div>
        <div class="prompt-title">从这里开始 <span>选择一个问题，立即探索</span></div>
        <div class="suggestion-grid">
         @for(item of prompts;track item.title){<button class="suggestion" (click)="ask(item.question)" [disabled]="busy()"><span class="suggestion-icon">{{item.icon}}</span><strong>{{item.title}}</strong><p>{{item.question}}</p><span class="arrow">↗</span></button>}
        </div>
        <div class="dataset-note"><span>ⓘ</span><div><strong>{{health()?.dataMode==='sqlserver'?'已选择 SQL Server 数据模式':'当前使用模拟电商数据'}}</strong><p>{{health()?.dataMode==='sqlserver'?'查询只访问已配置的聚合表；连接状态以查询结果为准。':'包含渠道、设备、注册与订单数据。模拟结果仅用于体验，不代表真实业务表现。'}}</p></div></div>
      </section>
    }
    @for(m of messages();track $index){
      <section class="message" [class.user]="m.role==='user'">
       <div class="avatar">{{m.role==='user'?'你':'◈'}}</div>
       <div class="message-content"><div class="message-author">{{m.role==='user'?'你':'Lens 分析助手'}} @if(m.result){<span>{{m.result.engine}}</span>}</div><p class="answer" [class.error]="m.error">{{m.text}}</p>
       @if(m.result;as r){
         <div class="result-card">
          <div class="result-heading"><div><span class="overline">{{r.title}}</span><div class="big-value">{{r.chart.type==='metric'?cell(r.records[0]?.[r.chart.y]):r.records.length}}<small>{{r.chart.type==='metric'?r.chart.y:'行查询结果'}}</small></div></div><span class="result-badge">{{r.dataMode==='demo'?'模拟数据':'SQL Server'}}</span></div>
          <div class="result-meta">{{r.evidence.start}} 至 {{r.evidence.end}}（不含） · UTC · {{device(r.plan.device)}}</div>
          <div class="safety-strip">✓ SQL 校验通过 · SELECT ONLY · {{r.security.database}}<br><small>{{r.security.accountStatus}}</small></div>
          <p class="chart-source">{{r.chartSource}} · {{r.chart.type}}</p>
          @if(r.truncated){<p class="warning">返回行数已达上限，当前结果不是完整数据。</p>}
          @if(r.userLimit){<p class="chart-source">SQL 包含 TOP 限定，仅展示指定数量记录。</p>}
          @if(!r.noData && r.chart.type==='line'){
           <div class="trend" role="img" aria-label="查询结果趋势图"><svg viewBox="0 0 660 160" preserveAspectRatio="none"><line x1="10" y1="140" x2="650" y2="140" stroke="#dce5e1"/><polyline [attr.points]="points(chartRows(r))" fill="none" stroke="#227653" stroke-width="3" vector-effect="non-scaling-stroke"/></svg><div class="axis"><span>{{chartRows(r)[0]?.label}}</span><span>{{chartRows(r)[r.records.length-1]?.label}}</span></div></div>
          } @else if(!r.noData && r.chart.type==='bar'){
           <div class="bars">@for(row of chartRows(r);track $index){<div class="bar-row"><span>{{row.label}}</span><div class="bar-track"><div [style.width.%]="width(row.value,chartRows(r))"></div></div><strong>{{number(row.value)}}</strong></div>}</div>
          }
          <details [open]="r.chart.type==='table'"><summary>查看明细数据 <span>{{r.records.length}} 行</span></summary><div class="table-wrap"><table><thead><tr>@for(c of r.columns;track c){<th>{{c}}</th>}</tr></thead><tbody>@for(row of r.records;track $index){<tr>@for(c of r.columns;track c){<td>{{cell(row[c])}}</td>}</tr>}</tbody></table></div><button class="text-button" (click)="download(r)">↓ 导出 CSV</button></details>
          @if(r.comparison){<details><summary>前一期结果（{{r.comparison.window.start}} 至 {{r.comparison.window.end}}）</summary>@if(r.comparison.truncated){<p class="warning">前一期结果已截断。</p>}<div class="table-wrap"><table><thead><tr>@for(c of r.comparison.columns;track c){<th>{{c}}</th>}</tr></thead><tbody>@for(row of r.comparison.records;track $index){<tr>@for(c of r.comparison.columns;track c){<td>{{cell(row[c])}}</td>}</tr>}</tbody></table></div></details>}
          <details class="evidence"><summary>◉ SQL 安全检查与查询依据</summary>
           <dl><dt>定义</dt><dd>{{r.evidence.definition}}</dd><dt>来源</dt><dd>{{r.evidence.source}}</dd><dt>查询时间</dt><dd>{{r.evidence.queriedAt}}（不代表数据更新时间）</dd><dt>读取对象</dt><dd>{{r.security.database}}.{{r.security.table}}</dd><dt>只读</dt><dd>{{r.security.readOnly?'是，只允许 SELECT':'否'}}</dd></dl>
           <ul>@for(check of r.security.checks;track check){<li>✓ {{check}}</li>}</ul>
           <p>{{r.engine==='Text-to-SQL'?'模型生成的 SQL':'规则模式生成的 SQL'}}</p><pre>{{r.evidence.originalSql}}</pre>
           <p>系统校验并重建后的 T-SQL（演示模式执行对应 SQLite SQL）</p><pre>{{r.evidence.sql}}</pre><p>参数</p><pre>{{json(r.evidence.parameters)}}</pre>
           @if(r.evidence.comparison){<p>前一期参数</p><pre>{{json(r.evidence.comparison.parameters)}}</pre>}
           <ul>@for(limit of r.evidence.limitations;track limit){<li>{{limit}}</li>}</ul><small>请求编号：{{r.requestId}}</small>
          </details>
         </div>
        @if(r.changed.length){<p class="changed">本次调整：{{changes(r.changed)}}</p>}
        <div class="followups">@for(q of followups;track q){<button (click)="ask(q)" [disabled]="busy()">{{q}} ↗</button>}</div>
       }
       </div>
      </section>
    }
    @if(busy()){<div class="loading"><span class="spinner"></span>正在确认口径并查询数据…</div>}
    </div>
    <footer class="composer-area"><form (ngSubmit)="submit()" class="composer"><textarea name="question" [(ngModel)]="draft" placeholder="问问你的数据，例如：最近 30 天新增用户趋势如何？" rows="2" maxlength="1000" (keydown)="onKey($event)" [disabled]="busy()" aria-label="输入数据分析问题"></textarea><div class="composer-bottom"><span>◈ {{health()?.engine||'正在连接服务'}} <span class="composer-separator">|</span> SELECT ONLY</span><button type="submit" [disabled]="busy()||!draft.trim()" aria-label="发送问题">↑</button></div></form><p class="composer-note">答案附带指标口径与查询依据 · Enter 发送 / Shift + Enter 换行</p></footer>
   } @else if(tab()==='metrics'){
    <section class="page"><div class="eyebrow">METRIC DICTIONARY</div><h2>先统一口径，再讨论数字。</h2><p>当前分析表提供以下指标口径；所有日期采用 UTC，默认不含今天。</p>
    @for(m of dictionary;track m.name){<article class="dictionary-card"><span>◫</span><div><h3>{{m.name}}</h3><p>{{m.description}}</p><code>{{m.formula}}</code></div></article>}
    <div class="dataset-note">漏斗按注册当天统计，不等同于注册后 7 日或 30 日转化。订单和销售额按支付日期统计。</div></section>
   } @else {
    <section class="page"><div class="eyebrow">CONNECTIONS</div><h2>连接你的分析工作区。</h2><p>数据库和模型密钥只在服务器的 .env 文件中配置，不会发往浏览器。</p><div class="settings-card"><h3>当前服务</h3><dl><dt>数据模式</dt><dd>{{health()?.dataMode||'服务未连接'}}</dd><dt>解析方式</dt><dd>{{health()?.engine||'未知'}}</dd><dt>访问保护</dt><dd>{{health()?.authRequired?'需要工作区凭证':'本机演示模式'}}</dd></dl><label for="token">工作区访问凭证（APP_TOKEN）</label><input id="token" type="password" [(ngModel)]="accessToken" placeholder="仅在配置 APP_TOKEN 后需要" autocomplete="off"><p class="helper">只在当前页面内存中使用，刷新后需要重新输入。</p><button class="primary-button" (click)="saveToken()">应用凭证</button><p role="status">{{settingsNotice()}}</p></div><div class="settings-card"><h3>服务端查询策略</h3><p>策略仅可在项目 query-policy.json 中修改，模型与浏览器不能放宽限制。</p><button class="primary-button" (click)="loadPolicy()">查看当前策略</button>@if(queryPolicy()){<pre>{{json(queryPolicy())}}</pre>}<h3>启用 SQL Server / 模型</h3><ol><li>按照项目 README 执行 SQL 初始化和导入演示数据。</li><li>复制 .env.example 为 .env，填写只读数据库账号。</li><li>配置 DATA_MODE=sqlserver 和 APP_TOKEN 后重启服务。</li><li>配置 LLM_API_KEY 与 LLM_MODEL，启用模型生成 SQL 和图表推荐。</li></ol><p>SQL Server 模式会核查实际只读账号权限。查询失败或被拦截不会退回模拟数据。</p></div></section>
   }
  </main>
 </div>`
})
class App {
 tab=signal('chat');messages=signal<Message[]>([]);busy=signal(false);health=signal<any>(null);settingsNotice=signal('');queryPolicy=signal<any>(null);
 draft='';accessToken='';private token='';private sessionId:string|undefined;
 prompts=[{icon:'↗',title:'追踪增长趋势',question:'最近 30 天新增用户趋势'},{icon:'▥',title:'比较渠道表现',question:'最近 7 天新增用户，按渠道拆分'},{icon:'◷',title:'观察收入变化',question:'最近 7 天销售额，与前一期对比'},{icon:'▽',title:'探索转化漏斗',question:'最近 30 天注册到当日付费漏斗'}];
 followups=['按渠道拆分','只看移动端','与前一期对比'];
 dictionary=[{name:'新增用户',description:'按注册日期去重，渠道与设备取注册时归属。',formula:'SUM(NewUsers)'},{name:'支付订单量',description:'按支付日期统计已支付订单，不含未支付订单，未扣除后续退款。',formula:'SUM(Orders)'},{name:'支付销售额',description:'支付订单金额之和，单位人民币元，未扣除后续退款。',formula:'SUM(Revenue)'},{name:'当日激活率',description:'注册当天完成核心操作的新用户占比。跨渠道汇总采用加权口径。',formula:'SUM(ActivatedUsers) / SUM(NewUsers) × 100%'}];
 constructor(){fetch('/api/health').then(r=>r.json()).then(h=>this.health.set(h)).catch(()=>this.settingsNotice.set('后端未连接，请先启动服务。'));}
 firstQuestion(){return this.messages().find(m=>m.role==='user')?.text??'';}
 reset(){if(this.busy())return;this.messages.set([]);this.sessionId=undefined;this.draft='';this.tab.set('chat');}
 saveToken(){this.token=this.accessToken.trim();this.accessToken='';this.settingsNotice.set('凭证已保存在当前页面内存，下次查询时验证。');}
 submit(){const q=this.draft.trim();if(q)this.ask(q);}
 onKey(event:KeyboardEvent){if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();this.submit();}}
 async ask(question:string){
  if(this.busy())return;
  this.tab.set('chat');this.draft='';this.messages.update(ms=>[...ms,{role:'user',text:question}]);this.busy.set(true);this.scroll();
  try{
   const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json',...(this.token?{Authorization:'Bearer '+this.token}:{})},body:JSON.stringify({message:question,sessionId:this.sessionId}),signal:AbortSignal.timeout(120000)});
   const body=await response.json();
   if(!response.ok)throw new Error(body.error??'请求失败，请稍后重试。');
   if(body.sessionId)this.sessionId=body.sessionId;
   this.messages.update(ms=>[...ms,{role:'assistant',text:body.clarification??body.summary,result:body.version===2?body:undefined}]);
  }catch(error){this.messages.update(ms=>[...ms,{role:'assistant',text:error instanceof Error?error.message:'服务暂时不可用。',error:true}]);}
  finally{this.busy.set(false);this.scroll();}
 }
 scroll(){setTimeout(()=>{const el=document.getElementById('chat-scroll');el?.scrollTo({top:el.scrollHeight,behavior:'smooth'});},100);}
 number(n:number){return Number(n).toLocaleString('zh-CN',{maximumFractionDigits:2});}
 json(value:any){return JSON.stringify(value,null,2);}
 device(d:string){return d==='all'?'全部设备':d==='mobile'?'移动端':'桌面端';}
 changes(keys:string[]){const names:Record<string,string>={metric:'指标',view:'分析维度',days:'时间跨度',offset:'日期范围',device:'设备筛选',compare:'对比基准'};return keys.map(k=>names[k]??k).join('、');}
 width(n:number,rows:any[]){return 100*n/Math.max(1,...rows.map(r=>r.value));}
 points(rows:any[]){const max=Math.max(1,...rows.map(r=>r.value));return rows.map((r,i)=>(rows.length===1?330:10+i*640/(rows.length-1))+','+(140-r.value/max*120)).join(' ');}
 cell(value:any){return value===null||value===undefined?'—':typeof value==='number'?this.number(value):String(value);}
 chartRows(r:any){return r.records.map((row:any)=>({label:String(row[r.chart.x]??r.title),value:Number(row[r.chart.y])}));}
 async loadPolicy(){try{const response=await fetch('/api/policy',{headers:this.token?{Authorization:'Bearer '+this.token}:{}});const body=await response.json();if(!response.ok)throw new Error(body.error);this.queryPolicy.set(body);}catch(e){this.settingsNotice.set(e instanceof Error?e.message:'策略加载失败');}}
 download(r:any){const escape=(v:any)=>'"'+String(v??'').replace(/^[=+\-@\t\r]/,"'").replace(/"/g,'""')+'"';const csv='\uFEFF'+[r.columns.map(escape).join(','),...r.records.map((row:any)=>r.columns.map((c:string)=>escape(row[c])).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='lens-analysis.csv';a.click();URL.revokeObjectURL(url);}
}
bootstrapApplication(App).catch(console.error);

