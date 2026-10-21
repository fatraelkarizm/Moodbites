import { useState } from 'react'
import { ChevronRight, ShieldCheck } from 'lucide-react'
import { Notice, OnboardingSteps } from '../components'
import { api, ApiError } from '../lib/api'

/**
 * Langkah 1 onboarding: dua persetujuan terpisah (mengikuti prototype klien).
 * Teks sengaja netral, tanpa menyebut kondisi kesehatan tertentu. Versi final teks perlu
 * disesuaikan dengan dokumen informed consent yang disetujui komite etik.
 */
export function ConsentPage({ onDone }: { onDone: () => void }) {
  const [research, setResearch] = useState(false)
  const [data, setData] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError(''); setBusy(true)
    try {
      await api.giveConsent()
      window.scrollTo(0, 0)
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan persetujuan. Coba lagi.')
    } finally { setBusy(false) }
  }

  return (
    <div className="form-page">
      <OnboardingSteps current={1} />
      <section className="form-card intro-card">
        <span className="form-card-icon green"><ShieldCheck size={22} /></span>
        <div>
          <p className="step-label">LANGKAH 1 DARI 3</p>
          <h2>Persetujuan</h2>
          <p>Ada dua persetujuan yang perlu kamu berikan sebelum mulai. Kamu boleh menarik persetujuan kapan saja tanpa memengaruhi layanan kesehatan yang kamu terima.</p>
        </div>
      </section>

      <section className="form-card consent-block">
        <h3><b>1</b> Persetujuan ikut penelitian</h3>
        <p className="consent-sub">Untuk keikutsertaanmu dalam penelitian ini.</p>
        <ul>
          <li>Penelitian ini mempelajari hubungan antara pola makan dengan suasana hati, stres, dan tidur. Kamu akan mengisi profil singkat dan catatan harian (makan, perasaan, tidur) selama 7 hari.</li>
          <li>Datamu disimpan dengan kode partisipan, tanpa nama, NIK, atau nomor HP.</li>
          <li>Keikutsertaan bersifat sukarela. Kamu boleh berhenti kapan saja dengan menghubungi tim peneliti, tanpa memengaruhi layanan kesehatan yang kamu terima.</li>
          <li>Penelitian ini hanya melihat hubungan (asosiasi), bukan menyimpulkan bahwa makanan menyebabkan perubahan suasana hati.</li>
        </ul>
        <label className={`consent-check${research ? ' checked' : ''}`}>
          <input type="checkbox" checked={research} onChange={(e) => setResearch(e.target.checked)} />
          <span>Saya sudah membaca dan setuju ikut serta dalam penelitian ini.</span>
        </label>
      </section>

      <section className="form-card consent-block">
        <h3><b>2</b> Persetujuan perekaman data</h3>
        <p className="consent-sub">Untuk data yang kamu isi di aplikasi ini.</p>
        <ul>
          <li>Semua yang kamu isi di aplikasi ini (profil, makan, perasaan, stres, tidur) direkam dan disimpan secara aman di server penelitian.</li>
          <li>Data hanya dapat diakses olehmu dan tim peneliti, hanya digunakan untuk keperluan penelitian ini, dan dilaporkan tanpa identitas.</li>
        </ul>
        <label className={`consent-check${data ? ' checked' : ''}`}>
          <input type="checkbox" checked={data} onChange={(e) => setData(e.target.checked)} />
          <span>Saya setuju data yang saya isi di aplikasi ini direkam dan digunakan untuk keperluan penelitian.</span>
        </label>
      </section>

      <p className="consent-note">Untuk menarik persetujuan atau bertanya tentang penelitian, hubungi tim peneliti.</p>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="save-bar">
        <button className="primary-button" type="button" disabled={!research || !data || busy} onClick={submit}>
          {busy ? 'Menyimpan…' : !research || !data ? 'Centang kedua persetujuan untuk lanjut' : <>Setuju & lanjut <ChevronRight size={18} /></>}
        </button>
      </div>
    </div>
  )
}
