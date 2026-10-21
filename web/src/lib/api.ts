export type Role = 'patient' | 'researcher'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type FoodCategory = 'karbo' | 'gorengan' | 'manis' | 'sayur_buah' | 'protein' | 'minuman_manis' | 'lainnya'

export interface Me { code: string; role: Role; onboardingComplete: boolean; consentGiven: boolean; insightsEnabled: boolean }

export interface Meal {
  id: string
  entryDate: string
  mealType: MealType
  eatenAt: string
  foodName: string
  foodCategory: FoodCategory
  portionSize: string
  servings: number
  mindfulness: number | null
}
export type MealInput = Omit<Meal, 'id' | 'mindfulness'> & { mindfulness: number; fillSeconds?: number }

export interface Mood {
  id: string
  entryDate: string
  mood: number
  note: string | null
  isStressed: boolean
  stressCause: string | null
}
export type MoodInput = Omit<Mood, 'id'> & { fillSeconds?: number }

export interface Sleep { entryDate: string; durationHours: number; quality: number; obstacle: string | null; fillSeconds?: number }

export interface Profile {
  age: number
  sex: 'male' | 'female' | 'other' | 'prefer_not_to_say'
  weightKg: number
  heightCm: number
  education: string
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed' | 'other'
  occupation: string
  incomeGroup: 'lt_1m' | '1m_3m' | '3m_5m' | 'gt_5m' | 'prefer_not_to_say'
  diagnosisDurationMonths: number
  artStatus: 'not_started' | 'active' | 'stopped' | null
  artDurationMonths: number | null
  artRegimen: string | null
  adherence: 'good' | 'moderate' | 'poor' | null
  cd4Category: string | null
  viralLoadCategory: string | null
  smoking: 'never' | 'former' | 'current' | null
  alcohol: 'never' | 'occasionally' | 'regularly' | null
  hasComplications: boolean
  complications: string | null
  hasTreatmentSideEffects: boolean
  treatmentSideEffects: string | null
}

export interface DayData { meals: Meal[]; mood: Mood | null; sleep: Sleep | null; mealsComplete: boolean | null }

export interface History {
  meals: Array<{ entryDate: string; entries: Meal[] }>
  moods: Array<{ entryDate: string; entries: Mood[] }>
  sleep: Sleep[]
}

export interface Analytics {
  summary: { patientDays: number; fullyComplete: number; completionRate: number }
  completion: Array<{ patientCode: string; date: string; hasMeal: boolean; hasMood: boolean; hasSleep: boolean }>
  distributions: {
    mood: Array<{ mood: number; count: number }>
    sleepQuality: Array<{ quality: number; count: number }>
    mealType: Array<{ mealType: MealType; count: number }>
    foodCategory: Array<{ foodCategory: FoodCategory; count: number }>
    stressed: Array<{ isStressed: boolean; count: number }>
  }
  trend: Array<{
    date: string
    averageMood: number | null
    moodCheckins: number
    averageSleepQuality: number | null
    averageSleepHours: number | null
    stressedCheckins: number
  }>
}

export interface InsightDay {
  patientCode: string
  date: string
  mood: number | null
  stressed: boolean | null
  sleepHours: number | null
  sleepQuality: number | null
  categories: FoodCategory[]
  mindfulness: number | null
}

export type Predictor = { kind: 'stress' } | { kind: 'sleepHours' } | { kind: 'sleepQuality' } | { kind: 'mindfulness' } | { kind: 'category'; category: FoodCategory }
export type Verdict = 'higher' | 'lower' | 'unclear' | 'insufficient'
export interface Finding {
  id: string
  predictor: Predictor
  outcome: 'mood' | 'stressed'
  type: 'diff' | 'slope'
  lag: 0 | 1
  effect: number | null
  ciLow: number | null
  ciHigh: number | null
  p: number | null
  q: number | null
  nDays: number
  nPatients: number
  withMean: number | null
  withN: number
  withoutMean: number | null
  withoutN: number
  verdict: Verdict
}
export interface PersonalInsights { days: InsightDay[]; totalDays: number; findings: Finding[] }
export interface ResearchInsights { patients: number; observedDays: number; findings: Finding[]; days: InsightDay[] }

export type Barrier = 'lupa' | 'sibuk' | 'internet' | 'hp' | 'pertanyaan_sulit' | 'terlalu_lama' | 'privasi' | 'lainnya'
export interface Feedback { ease: number; barriers: Barrier[]; barriersOther: string | null; suggestion: string | null }
export interface FeedbackStatus { studyDay: number; eligible: boolean; feedback: Feedback | null }

export interface Feasibility {
  studyDays: number
  patientsTotal: number
  patientsStarted: number
  finishedComplete: number
  finishedActive: number
  inProgress: number
  perPatient: Array<{ code: string; completeDays: number; activeDays: number; elapsedDays: number }>
  fillTime: { patientDays: number; medianSeconds: number | null; p25Seconds: number | null; p75Seconds: number | null; meanSeconds: number | null }
  feedback: {
    responses: number
    easeMean: number | null
    ease: Array<{ ease: number; count: number }>
    barriers: Array<{ barrier: Barrier; count: number }>
    comments: Array<{ patientCode: string; barriersOther: string | null; suggestion: string | null }>
  }
}

export interface PatientList {
  suggestedCode: string
  patients: Array<{ code: string; createdAt: string; pinResetAt: string | null; onboardingComplete: boolean; locked: boolean; lastEntryDate: string | null; activeDays: number }>
}
export interface PatientCredential { code: string; pin: string }

export const exportTables = ['daily_summary', 'patient_profiles', 'meal_entries', 'mood_entries', 'sleep_entries', 'study_feedback'] as const

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

/** Dipicu saat sesi berakhir agar App kembali ke halaman login. */
export const UNAUTHORIZED_EVENT = 'moodbite:unauthorized'

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch {
    throw new ApiError(0, 'Tidak dapat terhubung. Periksa koneksi internet lalu coba lagi.')
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    const custom = data.issues?.find((issue: { code?: string }) => issue.code === 'custom')?.message
    const message = custom ?? (data.issues ? 'Data belum lengkap atau tidak valid. Periksa kembali isianmu.' : data.error)
    throw new ApiError(res.status, message ?? 'Terjadi kesalahan. Coba lagi.')
  }
  return data as T
}

const num = (value: unknown) => (value === null || value === undefined ? null : Number(value))
const toMeal = (m: Meal): Meal => ({ ...m, servings: Number(m.servings), eatenAt: m.eatenAt.slice(0, 5) })
const toSleep = (s: Sleep): Sleep => ({ ...s, durationHours: Number(s.durationHours) })
const toProfile = (p: Profile): Profile => ({ ...p, weightKg: Number(p.weightKg), heightCm: Number(p.heightCm) })

export const api = {
  login: (code: string, pin: string) => request<{ role: Role }>('/auth/login', { method: 'POST', body: { code, pin } }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: () => request<Me>('/me'),
  giveConsent: () => request<unknown>('/consent', { method: 'POST', body: { researchConsent: true, dataConsent: true } }),

  async getProfile(): Promise<Profile | null> {
    try { return toProfile(await request<Profile>('/profile')) } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null
      throw error
    }
  },
  saveProfile: (profile: Profile) => request<unknown>('/profile', { method: 'PUT', body: profile }),

  async getDay(date: string): Promise<DayData> {
    const q = `?from=${date}&to=${date}`
    const [meals, moods, sleep, check] = await Promise.all([
      request<Meal[]>(`/meals${q}`),
      request<Mood[]>(`/moods${q}`),
      request<Sleep[]>(`/sleep${q}`),
      request<{ mealsComplete: boolean | null }>(`/day-check?date=${date}`),
    ])
    return {
      meals: meals.map(toMeal).sort((a, b) => a.eatenAt.localeCompare(b.eatenAt)),
      mood: moods[0] ?? null,
      sleep: sleep[0] ? toSleep(sleep[0]) : null,
      mealsComplete: check.mealsComplete,
    }
  },
  createMeal: (meal: MealInput) => request<unknown>('/meals', { method: 'POST', body: meal }),
  updateMeal: (id: string, meal: Omit<MealInput, 'entryDate'>) => request<unknown>(`/meals/${id}`, { method: 'PATCH', body: meal }),
  saveMood: (mood: MoodInput) => request<unknown>('/moods', { method: 'POST', body: mood }),
  saveSleep: (sleep: Sleep) => request<unknown>('/sleep', { method: 'PUT', body: sleep }),
  setMealsComplete: (entryDate: string, mealsComplete: boolean) => request<unknown>('/day-check', { method: 'PUT', body: { entryDate, mealsComplete } }),
  feedbackStatus: () => request<FeedbackStatus>('/feedback'),
  saveFeedback: (feedback: Feedback) => request<unknown>('/feedback', { method: 'PUT', body: feedback }),
  feasibility: () => request<Feasibility>('/admin/feasibility'),
  patients: () => request<PatientList>('/admin/patients'),
  createPatient: (code: string) => request<PatientCredential>('/admin/patients', { method: 'POST', body: { code } }),
  resetPatientPin: (code: string) => request<PatientCredential>(`/admin/patients/${encodeURIComponent(code)}/reset-pin`, { method: 'POST' }),

  async history(): Promise<History> {
    const h = await request<History>('/history')
    return {
      meals: h.meals.map((d) => ({ ...d, entries: d.entries.map(toMeal) })),
      moods: h.moods,
      sleep: h.sleep.map(toSleep),
    }
  },

  async analytics(from: string, to: string, patientCode?: string): Promise<Analytics> {
    const params = new URLSearchParams({ from, to })
    if (patientCode) params.set('patientCode', patientCode)
    const a = await request<Analytics>(`/admin/analytics?${params}`)
    return {
      ...a,
      trend: a.trend.map((t) => ({
        ...t,
        averageMood: num(t.averageMood),
        averageSleepQuality: num(t.averageSleepQuality),
        averageSleepHours: num(t.averageSleepHours),
      })),
    }
  },
  insights: () => request<PersonalInsights>('/insights'),
  adminInsights(from: string, to: string, patientCode: string | undefined, lag: 0 | 1) {
    const params = new URLSearchParams({ from, to, lag: String(lag) })
    if (patientCode) params.set('patientCode', patientCode)
    return request<ResearchInsights>(`/admin/insights?${params}`)
  },
  exportUrl: (table: (typeof exportTables)[number]) => `/api/admin/export/${table}.csv`,
}
