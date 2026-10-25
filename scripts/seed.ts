import 'dotenv/config';
import sql from 'mssql';
import { makeDemo } from '../server/analytics.js';
if(process.env.SQL_DATABASE!=='ProductAnalyticsDemo')throw new Error('Seed is restricted to ProductAnalyticsDemo.');
if(!process.env.SQL_SEED_USER||!process.env.SQL_SEED_PASSWORD)throw new Error('Set separate SQL_SEED_USER and SQL_SEED_PASSWORD.');
const pool=await sql.connect({server:process.env.SQL_SERVER??'localhost',port:Number(process.env.SQL_PORT??1433),database:'ProductAnalyticsDemo',
 user:process.env.SQL_SEED_USER,password:process.env.SQL_SEED_PASSWORD,
 options:{encrypt:process.env.SQL_ENCRYPT!=='false',trustServerCertificate:process.env.SQL_TRUST_CERT==='true'}});
const tx=new sql.Transaction(pool);
try{
 await tx.begin();
 const table=new sql.Table('analytics.DailyFacts');
 table.create=false;
 table.columns.add('Day',sql.Date,{nullable:false});
 table.columns.add('Channel',sql.NVarChar(40),{nullable:false});
 table.columns.add('Device',sql.NVarChar(16),{nullable:false});
 for(const key of ['NewUsers','ActivatedUsers','PaidUsers','Orders'])table.columns.add(key,sql.Int,{nullable:false});
 table.columns.add('Revenue',sql.Decimal(18,2),{nullable:false});
 table.columns.add('UpdatedAt',sql.DateTime2,{nullable:false});
 const existing=(await new sql.Request(tx).query('SELECT [Day],Channel,Device FROM analytics.DailyFacts')).recordset;
 const keys=new Set(existing.map(r=>r.Day.toISOString().slice(0,10)+'|'+r.Channel+'|'+r.Device));
 for(const r of makeDemo())if(!keys.has(r.day+'|'+r.channel+'|'+r.device))table.rows.add(new Date(r.day+'T00:00:00Z'),r.channel,r.device,r.newUsers,r.activatedUsers,r.paidUsers,r.orders,r.revenue,new Date());
 if(table.rows.length)await new sql.Request(tx).bulk(table);
 await tx.commit();console.log('Inserted '+table.rows.length+' demo fact rows (existing rows preserved).');
}catch(e){await tx.rollback();throw e}finally{await pool.close()}
