import parserPackage from 'node-sql-parser';
import { catalog, policy, reject, selectedDatabase } from './policy.js';
const parser=new parserPackage.Parser();
const dialect={database:'TransactSQL'};
type Binding={name:string;value:string};
export type ApprovedQuery={sql:string;demoSql:string;originalSql:string;table:string;database:string;columns:string[];bindings:Binding[];limit:number;userLimit:boolean;checks:string[]};
const id=(value:unknown)=>typeof value==='string'&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)?value:reject('IDENTIFIER_DENIED','标识符不受支持。');
const quote=(value:string)=>'['+id(value)+']';
const nonempty=(v:any)=>v!==undefined&&v!==null&&v!==false&&!(Array.isArray(v)&&v.length===0);
function keys(obj:any,allowed:string[]){
 for(const key of Object.keys(obj??{}))if(!allowed.includes(key)&&nonempty(obj[key]))reject('SYNTAX_DENIED','SQL 包含当前未开放的结构：'+key);
}
/** Recompile the accepted AST. Never execute the original model SQL. */
export function approveSql(input:string,database=selectedDatabase()):ApprovedQuery {
 if(!policy.allowedDatabases.some(x=>x.toLowerCase()===database.toLowerCase()))reject('DATABASE_DENIED','数据库未获授权。');
 if(typeof input!=='string'||input.length>12000||input.includes('\0'))reject('SQL_INVALID','SQL 长度或格式无效。');
 let ast:any;try{ast=parser.astify(input,dialect)}catch{reject('PARSE_FAILED','SQL 不能解析为受支持的 T-SQL。');}
 if(Array.isArray(ast)){if(ast.length!==1)reject('MULTI_STATEMENT','仅允许单条 SELECT，禁止多语句批次。');ast=ast[0];}
 if(ast?.type!=='select')reject('READ_ONLY','只读策略只允许 SELECT 查询。');
 keys(ast,['type','with','options','distinct','columns','into','from','for','where','groupby','having','top','orderby','limit']);
 if(ast.with||ast.options||ast.distinct||ast.for||ast.limit||ast.into?.position||ast.into?.expr)reject('SYNTAX_DENIED','不允许 CTE、SELECT INTO、查询提示或其他扩展子句。');
 if(!Array.isArray(ast.from)||ast.from.length!==1)reject('SOURCE_DENIED','当前仅允许单张授权分析表，禁止 JOIN 和子查询。');
 const source=ast.from[0];keys(source,['db','schema','table','as','table_hint','temporal_table','operator']);
 if(source.table_hint||source.temporal_table||source.operator)reject('SOURCE_DENIED','不允许表提示和外部数据源。');
 const table=id(source.table),schema=id(source.schema??source.db??'');
 if(source.schema&&String(source.db).toLowerCase()!==database.toLowerCase())reject('DATABASE_DENIED','禁止跨数据库访问。');
 const qualified=policy.allowedTables.find(x=>x.toLowerCase()===(schema+'.'+table).toLowerCase());
 if(!qualified)reject('TABLE_DENIED','表不在服务端允许列表中。');
 const alias=source.as?id(source.as):table;
 if(!Array.isArray(ast.columns)||!ast.columns.length||ast.columns.length>12)reject('COLUMNS_DENIED','查询须包含 1–12 个明确输出字段。');
 const bindings:Binding[]=[],names:string[]=[];
 let budget=0;
 function expr(e:any,context:'select'|'filter'|'group'|'order'='select',depth=0):string {
  if(!e||depth>16||++budget>350)reject('EXPRESSION_LIMIT','查询表达式过于复杂。');
  switch(e.type){
   case 'column_ref': {
    keys(e,['type','table','db','schema','column','collate']);
    if(e.collate||e.db||e.schema)reject('COLUMN_DENIED','不允许列级跨库限定或 COLLATE。');
    if(e.table&&String(e.table).toLowerCase()!==alias.toLowerCase())reject('COLUMN_DENIED','列引用了未授权来源。');
    const raw=String(e.column);
    if(raw.startsWith('@')){if(e.table||!['@start','@end','@device'].includes(raw))reject('PARAMETER_DENIED','仅允许 @start、@end、@device 参数。');return raw;}
    if(context==='order'&&names.some(n=>n.toLowerCase()===raw.toLowerCase()))return quote(names.find(n=>n.toLowerCase()===raw.toLowerCase())!);
    const col=Object.keys(catalog).find(c=>c.toLowerCase()===raw.toLowerCase());
    if(!col)reject('COLUMN_DENIED','字段不在授权目录中，禁止 SELECT *。');
    return '[facts].'+quote(col);
   }
   case 'number': {
    keys(e,['type','value']);const value=Number(e.value);
    if(!Number.isFinite(value)||Math.abs(value)>1e12)reject('LITERAL_DENIED','数字常量超出范围。');return String(value);
   }
   case 'single_quote_string':case 'var_string': {
    keys(e,['type','value']);if(typeof e.value!=='string'||e.value.length>256)reject('LITERAL_DENIED','字符串常量过长。');
    const name='lit'+bindings.length;bindings.push({name,value:e.value});return '@'+name;
   }
   case 'null':keys(e,['type','value']);return 'NULL';
   case 'binary_expr': {
    keys(e,['type','operator','left','right','parentheses']);
    const op=String(e.operator).toUpperCase();
    if(!['+','-','*','/','%','=','!=','<>','>','>=','<','<=','AND','OR','LIKE','NOT LIKE','IS','IS NOT','IN','NOT IN'].includes(op))reject('OPERATOR_DENIED','操作符不受支持。');
    return '('+expr(e.left,context,depth+1)+' '+op+' '+expr(e.right,context,depth+1)+')';
   }
   case 'expr_list':
    keys(e,['type','value']);if(!Array.isArray(e.value)||e.value.length>30)reject('EXPRESSION_LIMIT','列表过长。');
    return '('+e.value.map((x:any)=>expr(x,context,depth+1)).join(', ')+')';
   case 'aggr_func': {
    keys(e,['type','name','args','over']);keys(e.args,['expr','distinct']);
    const name=String(e.name).toUpperCase();
    if(context==='filter'||context==='group'||e.over||e.args?.distinct||!['SUM','COUNT','AVG','MIN','MAX'].includes(name))reject('FUNCTION_DENIED','聚合函数或窗口表达式不受支持。');
    const arg=e.args?.expr?.type==='star'&&name==='COUNT'?'*':expr(e.args?.expr,context,depth+1);
    return name+'('+arg+')';
   }
   case 'function': {
    keys(e,['type','name','args','within_group','over']);
    const parts=e.name?.name;const name=Array.isArray(parts)&&parts.length===1?String(parts[0].value).toUpperCase():'';
    if(e.over||e.within_group||!['NULLIF','ABS','ROUND'].includes(name))reject('FUNCTION_DENIED','只允许 NULLIF、ABS、ROUND 等列明函数。');
    const args=e.args?.value;if(e.args?.type!=='expr_list'||!Array.isArray(args)||args.length!==(name==='ABS'?1:2))reject('FUNCTION_DENIED','函数参数不受支持。');
    return name+'('+args.map((x:any)=>expr(x,context,depth+1)).join(', ')+')';
   }
   default:reject('EXPRESSION_DENIED','不支持的表达式：'+String(e.type));
  }
 }
 const columns=ast.columns.map((c:any,i:number)=>{
  keys(c,['expr','as']);const name=id(c.as??(c.expr?.type==='column_ref'?c.expr.column:'value'+(i+1)));
  if(names.some(n=>n.toLowerCase()===name.toLowerCase()))reject('DUPLICATE_COLUMN','输出列名必须唯一。');
  names.push(name);return expr(c.expr)+' AS '+quote(name);
 });
 const where=ast.where?' WHERE '+expr(ast.where,'filter'):'';
 if(ast.groupby)keys(ast.groupby,['columns']);
 const group=ast.groupby?' GROUP BY '+ast.groupby.columns.map((x:any)=>expr(x,'group')).join(', '):'';
 const having=ast.having?' HAVING '+expr(ast.having):'';
 const order=ast.orderby?' ORDER BY '+ast.orderby.map((x:any)=>{
  keys(x,['expr','type']);const direction=String(x.type??'ASC').toUpperCase();if(!['ASC','DESC'].includes(direction))reject('ORDER_DENIED','排序类型无效。');
  return expr(x.expr,'order')+' '+direction;
 }).join(', '):'';
 let limit=policy.maxRows+1,userLimit=false;
 if(ast.top){keys(ast.top,['value','percent']);if(ast.top.percent)reject('LIMIT_DENIED','不支持 TOP PERCENT。');const n=Number(ast.top.value);if(!Number.isInteger(n)||n<1||n>policy.maxRows)reject('LIMIT_DENIED','TOP 超过返回行数上限。');limit=n;userLimit=true;}
 const [safeSchema,safeTable]=qualified.split('.');
 // Server-enforced time/device scope cannot be widened by generated predicates.
 const inner=(sourceName:string)=>'(SELECT '+Object.keys(catalog).map(quote).join(', ')+' FROM '+sourceName+
 ' WHERE [Day] >= @start AND [Day] < @end AND (@device = '+ "'all'"+' OR [Device] = @device)) AS [facts]';
 const suffix=where+group+having+order;
 const sql='SELECT TOP ('+limit+') '+columns.join(', ')+' FROM '+inner(quote(database)+'.'+quote(safeSchema)+'.'+quote(safeTable))+suffix+';';
 const demoSql='SELECT '+columns.join(', ')+' FROM '+inner('[DailyFacts]')+suffix+' LIMIT '+limit+';';
 return {sql,demoSql,originalSql:input,table:qualified,database,columns:names,bindings,limit,userLimit,
 checks:['单条 SELECT','库/表/字段白名单','表达式白名单','服务端时间与设备范围','值参数绑定','返回行数上限','AST 重建后执行']};
}
