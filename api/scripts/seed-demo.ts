/**
 * KHUSUS DEV/DEMO: mengisi 15 partisipan DEMO01-DEMO15 x 7 hari dengan pola yang ditanam
 * (skor mood thermometer 0-5, tinggi = emosi lebih berat: stres -> naik, gorengan -> hari berikutnya naik,
 *  tidur lebih lama -> turun, makan lebih penuh perhatian -> turun)
 * agar dashboard dan analisis hubungan bisa direview. Jangan dijalankan di server studi.
 *
 *   npm run seed-demo            # buat/isi ulang data demo
 *   npm run seed-demo -- --clear # hapus semua akun DEMO*
 */
import { hash } from '@node-rs/argon2';
import pg from 'pg';

if (process.env.NODE_ENV === 'production') throw new Error('seed-demo tidak boleh dijalankan di production');
const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error('MIGRATION_DATABASE_URL wajib diisi dengan koneksi role owner');

// Di server publik, set DEMO_PIN acak: PIN bawaan ini tertulis di repo.
const PIN = process.env.DEMO_PIN ?? '20262026';
if (!/^\d{6,12}$/.test(PIN)) throw new Error('DEMO_PIN harus 6-12 angka');
const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query('begin');
  await client.query(`delete from accounts where code like 'DEMO%'`);
  if (process.argv.includes('--clear')) {
    await client.query('commit');
    console.log('Akun DEMO* dan seluruh datanya dihapus.');
  } else {
    // mulberry32: undian berurutan tidak saling berkorelasi (LCG sederhana menimbulkan pola palsu).
    let seed = 7;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pickCats = (fried: boolean) => {
      const cats = ['karbo'];
      if (fried) cats.push('gorengan');
      if (rand() < 0.5) cats.push('sayur_buah');
      if (rand() < 0.6) cats.push('protein');
      if (rand() < 0.3) cats.push('minuman_manis');
      if (rand() < 0.25) cats.push('manis');
      return cats;
    };
    const foods: Record<string, string> = {
      karbo: 'Nasi putih', gorengan: 'Bakwan goreng', sayur_buah: 'Sayur bayam', protein: 'Tempe bacem',
      minuman_manis: 'Es teh manis', manis: 'Kue lapis',
    };
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const dayStr = (offset: number) => { const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - offset); return d.toISOString().slice(0, 10); };
    const pinHash = await hash(PIN, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const clamp = (v: number) => Math.min(5, Math.max(1, Math.round(v)));
    const secs = (min: number, max: number) => Math.round(min + rand() * (max - min));
    const clamp05 = (v: number) => Math.min(5, Math.max(0, Math.round(v)));

    for (let p = 1; p <= 15; p++) {
      const code = `DEMO${String(p).padStart(2, '0')}`;
      const { rows: [acc] } = await client.query<{ id: string }>('insert into accounts(code,pin_hash,role) values($1,$2,$3) returning id', [code, pinHash, 'patient']);
      await client.query(
        `insert into patient_profiles(patient_id,age,sex,weight_kg,height_cm,education,marital_status,occupation,income_group,diagnosis_duration_months,has_complications,has_treatment_side_effects)
         values($1,$2,$3,$4,$5,'SMA / sederajat','married','Wiraswasta','1m_3m',$6,false,false)`,
        [acc!.id, 22 + Math.floor(rand() * 30), rand() < 0.5 ? 'female' : 'male', 48 + Math.round(rand() * 30), 150 + Math.round(rand() * 25), 6 + Math.floor(rand() * 100)],
      );
      const baseline = 1 + rand() * 1.5;
      let friedYesterday = false;
      for (let offset = 6; offset >= 0; offset--) {
        const date = dayStr(offset);
        // ~10% hari tidak diisi sama sekali, agar kelengkapan realistis.
        if (rand() < 0.1) { friedYesterday = false; continue; }
        const stressed = rand() < 0.4;
        const sleepHours = Math.round((5 + rand() * 3.5) * 2) / 2;
        const fried = rand() < 0.45;
        const mindfulness = 1 + Math.floor(rand() * 5);
        const moodRaw = baseline + (stressed ? 1.2 : 0) + (friedYesterday ? 0.8 : 0) - 0.45 * (sleepHours - 7) - 0.3 * (mindfulness - 3) + (rand() - 0.5);
        await client.query(
          `insert into mood_entries(patient_id,entry_date,mood,note,is_stressed,stress_cause,fill_seconds) values($1,$2,$3,null,$4,$5,$6)`,
          [acc!.id, date, clamp05(moodRaw), stressed, stressed ? ['Pekerjaan', 'Keuangan', 'Keluarga', 'Kesehatan'][Math.floor(rand() * 4)] : null, secs(30, 120)],
        );
        await client.query(
          `insert into sleep_entries(patient_id,entry_date,duration_hours,quality,obstacle,fill_seconds) values($1,$2,$3,$4,$5,$6)`,
          [acc!.id, date, sleepHours, clamp(2 + (sleepHours - 5) * 0.8 + (rand() - 0.5)), sleepHours < 6 ? 'Sering terbangun' : null, secs(15, 60)],
        );
        const cats = pickCats(fried);
        const meals: Array<[string, string]> = [['breakfast', '07:00'], ['lunch', '12:30'], ['dinner', '19:00']];
        for (const [i, [type, time]] of meals.entries()) {
          const cat = cats[i % cats.length]!;
          await client.query(
            `insert into meal_entries(patient_id,entry_date,meal_type,eaten_at,food_name,food_category,portion_size,servings,mindfulness,fill_seconds) values($1,$2,$3,$4,$5,$6,'Sedang',1,$7,$8)`,
            [acc!.id, date, type, time, foods[cat] ?? 'Makanan', cat, mindfulness, secs(30, 90)],
          );
        }
        for (const cat of cats.slice(3)) {
          await client.query(
            `insert into meal_entries(patient_id,entry_date,meal_type,eaten_at,food_name,food_category,portion_size,servings,mindfulness,fill_seconds) values($1,$2,'snack','15:30',$3,$4,'Sedikit',1,$5,$6)`,
            [acc!.id, date, foods[cat] ?? 'Camilan', cat, mindfulness, secs(20, 60)],
          );
        }
        await client.query('insert into day_checks(patient_id,entry_date,meals_complete) values($1,$2,$3)', [acc!.id, date, rand() < 0.85]);
        friedYesterday = fried;
      }
      // 12 dari 15 partisipan mengisi kuesioner akhir.
      if (p <= 12) {
        const pool = ['lupa', 'sibuk', 'internet', 'hp', 'pertanyaan_sulit', 'terlalu_lama', 'privasi'];
        const barriers = pool.filter((b) => rand() < (b === 'lupa' ? 0.6 : b === 'sibuk' ? 0.4 : 0.15));
        await client.query(
          'insert into study_feedback(patient_id,ease,barriers,suggestion) values($1,$2,$3,$4)',
          [acc!.id, 3 + Math.floor(rand() * 3), barriers, rand() < 0.3 ? ['Tolong ada pengingat harian', 'Pilihan makanan ditambah', 'Sudah mudah dipakai'][Math.floor(rand() * 3)] : null],
        );
      }
    }
    await client.query('commit');
    console.log(`15 partisipan demo dibuat: DEMO01-DEMO15, PIN ${PIN}. Hapus dengan: npm run seed-demo -- --clear`);
  }
} catch (error) {
  await client.query('rollback');
  throw error;
} finally {
  await client.end();
}
