import { generatePin, hashPin } from '../src/pin.js';
import pg from 'pg';
import { z } from 'zod';

const args=z.object({code:z.string().min(1).max(50),role:z.enum(['patient','researcher']).default('patient')}).parse({code:process.argv[2],role:process.argv[3]??'patient'});
const url=process.env.MIGRATION_DATABASE_URL;
if(!url)throw new Error('MIGRATION_DATABASE_URL wajib diisi dengan koneksi role owner');
const pin=generatePin();
const pinHash=await hashPin(pin);
const client=new pg.Client({connectionString:url});
try{await client.connect();await client.query('insert into accounts(code,pin_hash,role) values($1,$2,$3)',[args.code.toUpperCase(),pinHash,args.role]);console.log(`Kode: ${args.code.toUpperCase()}\nPIN (tampilkan sekali): ${pin}`);}finally{await client.end();}
