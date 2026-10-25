# Lens v2 — 受控 Text-to-SQL 产品分析助手

Angular + TypeScript / Node.js + TypeScript / SQL Server。
第二版支持模型生成 SQL、服务端校验并执行、模型推荐可视化。
默认仍可离线运行：未配置密钥时使用规则解析，不会冒充真实模型。

## 立即启动
双击 start.bat，等待 Lens v2 running 后打开 http://127.0.0.1:3000。
关闭旧版启动窗口后再启动，避免端口冲突。
仓库不包含依赖包和编译产物。首次启动会安装依赖并编译；修改源代码后运行 npm run build。
Node.js 24。首次缺少依赖时 start.bat 自动 npm ci。

## 第二版流程
用户提问
1. 模型读取授权表结构和指标说明，生成 SQL、分析时间/设备条件。
2. 后端解析 SQL Server 方言语法树，检查只读、库/表/字段/函数和复杂度。
3. 后端从已接受的 AST 重新生成 SQL，不直接执行模型原文。
4. 数据源子查询强制限制时间范围和设备；字符串值绑定参数。
5. SQL Server 模式：在同一事务连接上检查真实权限与表类型，再执行。
6. 图表模型只接收列名、类型和行数，输出受限图表 JSON。
7. 后端校验图表，Angular 绑定真实结果展示，保留原 SQL 和执行 SQL。

任何语句/权限校验失败返回 422，不执行模型 SQL。
数据库或模型服务错误返回 503，不回退模拟业务结果。
图表推荐失败或字段无效时保留查询结果并回退表格。

## 配置允许的语句、库和只读策略
编辑项目根目录 query-policy.json，重启服务生效。
该文件只由服务端读取。浏览器和模型不能修改策略。

    {
      "readOnly": true,
      "allowedStatements": ["SELECT"],
      "allowedDatabases": ["ProductAnalyticsDemo"],
      "allowedTables": ["analytics.DailyFacts"],
      "maxRows": 200,
      "queryTimeoutMs": 10000,
      "maxConcurrentQueries": 3
    }

- readOnly 必须为 true。改为 false 会拒绝启动，没有开放写入开关。
- allowedStatements 必须是 ["SELECT"]，不能添加 UPDATE/DELETE/EXEC。
- SQL_DATABASE 必须在 allowedDatabases 中；一次部署只连接 SQL_DATABASE。
- 允许同库三段名称，拒绝访问任何其他库，即便其他库列在允许列表中。
  切换允许列表中的库需管理员修改 SQL_DATABASE 并重启。
- allowedTables 限制 schema.table；当前目录固定为 DailyFacts 的字段结构。
  添加表名不是自动学习任意表：新增对象必须由管理员审查，并具有同样字段语义，
  或同时扩展 server/policy.ts 的目录、强制日期范围与测试。
- 只允许 SELECT、WHERE、GROUP BY、HAVING、ORDER BY 和有限 TOP。
- 仅一张本地物理表，不支持 JOIN、CTE、子查询、UNION、窗口函数。
- 禁止 SELECT INTO、SELECT *、跨库、链接服务器、系统表、外部数据源和查询提示。
- 标识符只允许 ASCII 字母、数字、下划线，输出列名不能重复。
- 允许函数：SUM、COUNT、AVG、MIN、MAX、NULLIF、ABS、ROUND。
- 查询超时最大 30 秒，返回行数最多 1000，可在策略范围内收紧。
  返回行数限制不会保证低扫描成本；生产环境仍需数据库资源治理。
- 连接设置页面点击“查看当前策略”，可查看已生效策略，不支持页面修改。
  配置 APP_TOKEN 后，该接口也需要鉴权。

## “只读”如何保证
有三层，不依赖模型自觉：
1. 查询层：仅接受白名单语法 AST，拒绝写入、EXEC、INTO 等结构。
2. 编译层：只生成已定义的 SELECT，所有值绑定参数，强制访问范围。
3. 数据库层：专用最小权限账号；每次执行检查 sys.fn_my_permissions，
   拒绝服务器/数据库管理权限、目标表写权限及可见对象上的写入等权限。
   检查 SELECT 权限、实际 DB_NAME，并拒绝视图、同义词、外部表和计算列。

此处只读指应用查询与账号权限，不是将整库 ALTER DATABASE 为 READ_ONLY。
数据库可继续由其他业务账号写入。
账号检查是针对当前连接/可见对象的保守检查，不是整台 SQL Server 的全面权限审计。
依然要求管理员使用专用账号并验收部署，不能依靠这些检查替代用户授权设计。
当前是共享工作区 APP_TOKEN，无企业 SSO、按人授权、行级权限或多租户隔离。

## 模型配置
复制 .env.example 为 .env：
- LLM_BASE_URL：兼容 /chat/completions 与 function tools 的接口基址。
- LLM_API_KEY：服务器侧密钥。
- LLM_MODEL：支持工具调用的模型名称。

填写后重启，页面解析方式显示 Text-to-SQL。
不填密钥时显示“规则解析（无模型）”，同样会生成 SQL 并经过安全检查。
模型没有自由执行工具，不能获得数据库凭证。
模型接收用户问题、授权目录和上一查询上下文。不要在问题中粘贴敏感数据。
图表阶段仅发送列元数据与行数，不发送查询结果值。
没有设置真实密钥，因此交付验证使用本地模拟模型接口，不等于验证了真实模型准确率。

## 数据库配置
1. 用 SSMS 管理员执行 sql/01-schema.sql。
2. 修改 sql/02-permissions.sql 密码占位符并运行，创建专用只读账号。
3. .env 填 SQL_SERVER、SQL_PORT、SQL_DATABASE、SQL_USER、SQL_PASSWORD。
4. .env 填 DATA_MODE=sqlserver，APP_TOKEN 至少 24 字符。
5. SQL_DATABASE 必须包含在 query-policy.json 的允许列表中。
6. 如需模拟数据，用独立写入账号配置 SQL_SEED_USER / SQL_SEED_PASSWORD 后执行 npm run seed。
   导入后删除这两个临时配置；应用不能使用写入账号。
7. 重启，在页面连接设置中输入 APP_TOKEN，再执行查询。
8. 管理员可运行 sql/03-verify-reader.sql，检查该账号权限。

SQL_SERVER 默认 localhost，SQL_PORT 默认 1433。
正常使用需开启 SQL 身份认证并提供可验证证书；本机开发自签名证书可设 SQL_TRUST_CERT=true。
本次未连接真实 SQL Server，权限 SQL 和实际 T-SQL 执行仍需在目标实例验收。

## 演示数据模式
DATA_MODE=demo 使用内存 SQLite 执行从同一受限 AST 编译的 SQL，开启 PRAGMA query_only。
这是真正执行 SQL 得到的模拟结果，不是忽略模型 SQL 后返回固定模板数据。
模拟数据覆盖 360 个完整 UTC 日，查询窗口默认最近 30 天、不含今天。
日期和设备范围由后端强制约束。
SQLite 和 SQL Server 的类型、排序和聚合细节可能不同，演示验证不能替代实库测试。
界面显示“SQL Server 账号未验证”，不伪造实际只读账号验收状态。

## 可以试的问题
无模型规则模式：
- 最近 30 天新增用户趋势
- 最近 7 天销售额，按渠道拆分
- 只看移动端
- 与前一期对比
- 最近 30 天注册到当日付费漏斗

启用模型后可尝试（支持能力取决于模型输出是否符合限制）：
- 最近 7 天销售额最高的两个渠道
- 最近 30 天付费广告渠道的订单量和销售额
- 最近 7 天按渠道展示新增用户和当日激活率
- 最近 7 天各设备平均每笔订单金额
  正确口径应为 SUM(Revenue)/NULLIF(SUM(Orders),0)，需人工核查。

不承诺任意自然语言都能回答。留存、因果归因等缺少必要数据时应澄清。
SQL 通过安全检查只说明允许执行，不代表业务口径正确。
前一期对比重复执行同一 SQL，只移动服务端窗口；不要在 SQL 中写死日期。

## 可视化与依据
模型选择 table/bar/line/metric，系统核查实际字段、类型、空值、日期顺序、重复标签和行数。
不接受任意 JS、HTML、远程 URL 或模型生成的数据。
截断结果用表格，明确提示不完整；NULL 显示为“—”，不伪装成 0。
支持明细、CSV、对比期明细、原始 SQL、重建 T-SQL、参数和安全检查结果。
演示模式执行对应 SQLite 版本，不表示展示的 T-SQL 已在 SQL Server 执行。
页面“查询时间”不等于数据更新时间。

## 开发与测试
    npm ci
    npm run dev
    npm run build
    npm test
    npm run check

开发页面 http://127.0.0.1:4200，代理 3000，开发时保留 PORT=3000。
端到端模拟模型测试（自动启动本地测试服务）：
    node scripts/model-smoke.mjs
访问凭证/SQL 模式失败测试：
    node scripts/security-smoke.mjs
浏览器测试（先 npm start，需要本机 Edge）：
    node scripts/smoke.mjs

运行日志在 logs/audit.jsonl，记录成功、blocked、error 和原因码。
拒绝响应含请求编号，日志不存模型密钥、结果数据或被拒绝的原始 SQL。
日志尚无防篡改、集中存储和轮转能力。

## 关键文件
query-policy.json          管理员维护的查询策略
server/sql-guard.ts         AST 校验与受限 SQL 编译
server/query-executor.ts    账号权限检查、只读执行与行数限制
server/text-to-sql.ts       模型 SQL 生成与图表选择
server/policy.ts            策略校验与数据目录
server/index.ts             API、鉴权、会话、审计
client/main.ts             Angular 界面与图表
tests/sql-guard.test.ts     安全与正确性测试
v1-source-backup.zip        升级前源代码备份
VALIDATION.md               实际验证记录

技术依据：
- T-SQL AST 解析器：https://github.com/taozhi8833998/node-sql-parser
- SQL Server 权限查询：https://learn.microsoft.com/en-us/sql/relational-databases/system-functions/sys-fn-my-permissions-transact-sql


## 从 GitHub 下载后运行

需要 Node.js 24，在项目根目录执行：

```sh
npm ci
npm run build
npm start
```

打开 http://127.0.0.1:3000。默认使用演示数据和规则解析。
Windows 用户也可双击 start.bat，自动安装缺失的依赖并编译。
如需真实模型或数据库，复制 .env.example 为 .env 并填写配置。不要提交 .env 或真实凭证。
package-lock.json 应保留，以便通过 npm ci 安装锁定版本。