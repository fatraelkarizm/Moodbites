import test from 'node:test';
import assert from 'node:assert/strict';
import { dayCheckSchema, feedbackSchema, patientCodeSchema, mealCreateSchema, moodCreateSchema, profileSchema, sleepSchema } from '../src/schemas.js';
import { jakartaDate, toCsv } from '../src/lib.js';
import { generatePin } from '../src/pin.js';

test('profile requires complication detail only when yes',()=>{
 const base={age:30,sex:'female',weightKg:60,heightCm:160,education:'S1',maritalStatus:'single',occupation:'Guru',incomeGroup:'3m_5m',diagnosisDurationMonths:12,hasComplications:false,hasTreatmentSideEffects:false};
 assert.equal(profileSchema.safeParse(base).success,true);
 assert.equal(profileSchema.safeParse({...base,hasComplications:true}).success,false);
});
test('stress cause is conditional',()=>{
 assert.equal(moodCreateSchema.safeParse({entryDate:'2026-10-19',mood:3,isStressed:true}).success,false);
 assert.equal(moodCreateSchema.safeParse({entryDate:'2026-10-19',mood:3,isStressed:true,stressCause:'Pekerjaan'}).success,true);
});
test('Jakarta date handles UTC boundary',()=>assert.equal(jakartaDate(new Date('2026-10-18T17:30:00Z')),'2026-10-19'));
test('CSV escapes commas, quotes and includes BOM',()=>assert.equal(toCsv([{a:'x,y',b:'a"b'}]),'\uFEFFa,b\r\n"x,y","a""b"\r\n'));
test('stress cause must be empty when not stressed',()=>{
 assert.equal(moodCreateSchema.safeParse({entryDate:'2026-10-19',mood:3,isStressed:false}).success,true);
 assert.equal(moodCreateSchema.safeParse({entryDate:'2026-10-19',mood:3,isStressed:false,stressCause:'Kerja'}).success,false);
});
test('meal requires a fixed food category',()=>{
 const meal={entryDate:'2026-10-19',mealType:'lunch',eatenAt:'12:00',foodName:'Nasi',portionSize:'sedang',servings:1,mindfulness:3};
 assert.equal(mealCreateSchema.safeParse(meal).success,false);
 assert.equal(mealCreateSchema.safeParse({...meal,foodCategory:'sayur_buah'}).success,true);
 assert.equal(mealCreateSchema.safeParse({...meal,foodCategory:'pizza'}).success,false);
});
test('mood thermometer 0-5 and mindful eating 1-5',()=>{
 assert.equal(moodCreateSchema.safeParse({entryDate:'2026-10-19',mood:0,isStressed:false}).success,true);
 assert.equal(moodCreateSchema.safeParse({entryDate:'2026-10-19',mood:6,isStressed:false}).success,false);
 const meal={entryDate:'2026-10-19',mealType:'lunch',eatenAt:'12:00',foodName:'Nasi',foodCategory:'karbo',portionSize:'sedang',servings:1};
 assert.equal(mealCreateSchema.safeParse(meal).success,false);
 assert.equal(mealCreateSchema.safeParse({...meal,mindfulness:5}).success,true);
 assert.equal(mealCreateSchema.safeParse({...meal,mindfulness:0}).success,false);
});
test('fill time is optional, non-negative and capped',()=>{
 const sleep={entryDate:'2026-10-19',durationHours:7,quality:4};
 assert.equal(sleepSchema.safeParse(sleep).success,true);
 assert.equal(sleepSchema.safeParse({...sleep,fillSeconds:95}).success,true);
 assert.equal(sleepSchema.safeParse({...sleep,fillSeconds:-1}).success,false);
 assert.equal(sleepSchema.safeParse({...sleep,fillSeconds:4000}).success,false);
});
test('day check and end-of-study feedback',()=>{
 assert.equal(dayCheckSchema.safeParse({entryDate:'2026-10-19',mealsComplete:true}).success,true);
 assert.equal(feedbackSchema.safeParse({ease:4,barriers:['lupa','internet']}).success,true);
 assert.equal(feedbackSchema.safeParse({ease:4,barriers:['lupa','lupa']}).success,false);
 assert.equal(feedbackSchema.safeParse({ease:4,barriers:['tidak_ada']}).success,false);
 assert.equal(feedbackSchema.safeParse({ease:4,barriers:['lainnya']}).success,false);
 assert.equal(feedbackSchema.safeParse({ease:4,barriers:['lainnya'],barriersOther:'Mata lelah'}).success,true);
});
test('patient code is normalised and validated',()=>{
 assert.equal(patientCodeSchema.parse(' p021 '),'P021');
 assert.equal(patientCodeSchema.safeParse('P 01').success,false);
 assert.equal(patientCodeSchema.safeParse("P1'; drop").success,false);
 assert.equal(patientCodeSchema.safeParse('X').success,false);
});
test('generated PIN is 8 digits',()=>{
 for(let i=0;i<50;i++) assert.match(generatePin(),/^\d{8}$/);
});
