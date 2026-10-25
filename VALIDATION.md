# Lens v2 验证记录

日期：2026-10-24（Australia/Sydney）
环境：Windows、Node.js 24.19.0、Angular 21、Microsoft Edge 无头浏览器。

## 已验证
- Angular 生产构建和后端 TypeScript 检查通过。
- npm test：43 项通过。
  - 原有指标计算、日期、上下文测试。
  - 策略不能允许写入或关闭 readonly。
  - 拒绝写入、DDL、EXEC、SELECT INTO、多语句、越权库/表/字段、
    子查询、UNION、CTE、JOIN、系统对象、危险函数、全局变量、外部源等。
  - AST 重建和参数绑定；OR 1=1 不能扩大服务端时间/设备范围。
  - 真实执行模拟 SQL，核对分组、筛选、排序和 TOP。
  - 行数截断、空分母 NULL、不可信图表字段和顺序。
  - 权限检查逻辑拒绝管理员、写入和缺失 SELECT 账号。
- scripts/model-smoke.mjs：
  本地模型协议模拟，完整验证 SQL 生成、校验、执行、图表选择。
  5 类危险模型输出返回 422，未进入图表阶段。
  API 认证与策略修改请求限制通过。
  模型服务失败返回 503，图表调用失败/错误字段回退表格。
  验证图表模型仅接收列元数据和行数，不含查询结果值。
- scripts/security-smoke.mjs：
  错误/缺失令牌拒绝；正确令牌允许。
  SQL Server 模式缺失凭证返回错误，不回退模拟结果。
- scripts/smoke.mjs：
  Edge 桌面 1440×1000 和移动 390×844。
  查询、追问、前一期结果、折线图、条形图、CSV、SQL 依据、
  策略查看均通过；无页面脚本与控制台错误，无横向溢出。
  已检查 screenshots/v2-policy.png、v2-mobile.png。

## 未验证
- 没有真实模型密钥：没有验证外部模型准确率、延迟或特定供应商兼容性。
- 没有真实 SQL Server 连接：没有验证实例上的 T-SQL 执行和权限查询结果。
- SQL Server 权限判断通过单元测试，不表示真实账号已验收。
- 没有企业用户试点、并发压测、真实多用户授权或生产部署验证。
- 当前支持的 SQL 是经过限制的单表 SELECT 子集，不是任意 SQL 分析系统。
