import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { ZodError } from 'zod';
import { registerAuthRoutes, authenticate } from './auth.js';
import { loadConfig } from './config.js';
import { pool, withAccount } from './db.js';
import { exportRoutes } from './routes/export.js';
import { analyticsRoutes } from './routes/analytics.js';
import { insightRoutes } from './routes/insights.js';
import { feasibilityRoutes } from './routes/feasibility.js';
import { patientRoutes } from './routes/patients.js';
import { historyRoutes } from './routes/history.js';
import { mealRoutes } from './routes/meals.js';
import { moodRoutes } from './routes/moods.js';
import { profileRoutes } from './routes/profile.js';
import { sleepRoutes } from './routes/sleep.js';

const config=loadConfig();
export async function buildApp(){
  const app=Fastify({logger:{level:config.NODE_ENV==='production'?'info':'debug',redact:['req.headers.cookie','req.body.pin']},trustProxy:'127.0.0.1'});
  await app.register(cookie);
  app.addHook('onRequest',async(request,reply)=>{
    if(!['POST','PUT','PATCH','DELETE'].includes(request.method)||!config.APP_ORIGIN)return;
    if(request.headers.origin!==config.APP_ORIGIN)return reply.code(403).send({error:'Origin tidak diizinkan'});
  });
  app.setErrorHandler((error,_request,reply)=>{
    if(error instanceof ZodError)return reply.code(400).send({error:'Data tidak valid',issues:error.issues});
    const status=typeof error==='object'&&error!==null&&'statusCode' in error&&typeof error.statusCode==='number'?error.statusCode:500;
    if(status>=500)app.log.error(error);
    const message=error instanceof Error?error.message:'Permintaan tidak valid';
    return reply.code(status).send({error:status>=500?'Terjadi kesalahan pada server':message});
  });
  app.get('/api/health',async()=>{await pool.query('select 1');return {status:'ok'};});
  app.get('/api/me',{preHandler:authenticate},async(request)=>withAccount(request.account,async(c)=>{
    const r=await c.query(`select a.code,a.role,exists(select 1 from patient_profiles p where p.patient_id=a.id) as "onboardingComplete" from accounts a where a.id=$1`,[request.account.id]);return {...r.rows[0],insightsEnabled:config.PATIENT_INSIGHTS};
  }));
  await registerAuthRoutes(app); await profileRoutes(app); await mealRoutes(app); await moodRoutes(app); await sleepRoutes(app); await historyRoutes(app); await analyticsRoutes(app); await insightRoutes(app); await feasibilityRoutes(app); await patientRoutes(app); await exportRoutes(app);
  return app;
}

if(process.env.NODE_ENV!=='test'){
  const app=await buildApp();
  const close=async()=>{await app.close();await pool.end();process.exit(0);};
  process.on('SIGTERM',close);process.on('SIGINT',close);
  await app.listen({host:'127.0.0.1',port:config.PORT});
}
