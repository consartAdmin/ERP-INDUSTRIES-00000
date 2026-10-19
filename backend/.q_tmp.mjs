import 'dotenv/config';
import pg from 'pg';
const c = new pg.Client({host:process.env.DB_HOST,port:5432,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASS,connectionTimeoutMillis:6000});
await c.connect();
const r = await c.query(process.argv[2]);
console.log(JSON.stringify(r.rows));
await c.end();
