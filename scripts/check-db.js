require('dotenv').config();
const {Pool}=require('pg');
if(!process.env.DATABASE_URL){console.error('Falta DATABASE_URL');process.exit(1)}
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:false});
pool.query('SELECT now()').then(()=>console.log('Base de datos conectada')).catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>pool.end());
