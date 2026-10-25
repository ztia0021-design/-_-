import { readFileSync } from 'node:fs';
import { z } from 'zod';
const identifier=z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);
export const policySchema=z.object({
 readOnly:z.literal(true),allowedStatements:z.tuple([z.literal('SELECT')]),
 allowedDatabases:z.array(identifier).min(1).max(8),
 allowedTables:z.array(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/)).min(1).max(8),
 maxRows:z.number().int().min(1).max(1000),queryTimeoutMs:z.number().int().min(1000).max(30000),
 maxConcurrentQueries:z.number().int().min(1).max(5)
}).strict();
export const policy=policySchema.parse(JSON.parse(readFileSync('query-policy.json','utf8').replace(/^\uFEFF/,'')));
export const catalog={
 Day:'date',Channel:'string',Device:'string',NewUsers:'number',ActivatedUsers:'number',
 PaidUsers:'number',Orders:'number',Revenue:'number',UpdatedAt:'date'
} as const;
export class QueryRejected extends Error {
 constructor(public code:string,message:string){super(message);this.name='QueryRejected';}
}
export function reject(code:string,message:string):never {throw new QueryRejected(code,message);}
export function selectedDatabase(){
 const database=process.env.SQL_DATABASE??'ProductAnalyticsDemo';
 if(!policy.allowedDatabases.some(x=>x.toLowerCase()===database.toLowerCase()))
   reject('DATABASE_DENIED','连接数据库不在服务端允许列表中。');
 return database;
}
