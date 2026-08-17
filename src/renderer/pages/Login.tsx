import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Lock, User, WifiOff, Building2, ArrowRight, UserPlus, LogIn } from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { LANGUAGES, switchLanguage, type SupportedLanguage } from '../i18n/i18n'

type Mode = 'signin' | 'signup'

export default function Login() {
  const { t } = useTranslation()
  const { login, completeSetup } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('signin')
  const [dbStatus, setDbStatus] = useState<'checking' | 'healthy' | 'error'>('checking')

  // ── Sign-in state ───────────────────────────────────────────────────────────
  const [siUsername, setSiUsername] = useState('')
  const [siPassword, setSiPassword] = useState('')
  const [siShowPw, setSiShowPw] = useState(false)
  const [siError, setSiError] = useState('')
  const [siLoading, setSiLoading] = useState(false)

  // ── Sign-up state ───────────────────────────────────────────────────────────
  const [suStep, setSuStep] = useState(0)           // 0 = school info, 1 = admin account
  const [suError, setSuError] = useState('')
  const [suLoading, setSuLoading] = useState(false)
  const [suShowPw, setSuShowPw] = useState(false)
  const [suShowConfirm, setSuShowConfirm] = useState(false)
  const [suForm, setSuForm] = useState({
    schoolNameAr: '',
    schoolNameFr: '',
    academicYear: '2025-2026',
    phone: '',
    adminFullName: '',
    adminUsername: '',
    adminPassword: '',
    confirmPassword: '',
    preferredLanguage: 'ar' as SupportedLanguage,
  })

  // ── DB health check ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function checkHealth() {
      if (!window.schoolApp?.health) { setDbStatus('error'); return }
      try {
        const res = await window.schoolApp.health.check()
        setDbStatus(res.success && res.data?.sqliteOpen ? 'healthy' : 'error')
      } catch { setDbStatus('error') }
    }
    checkHealth()
  }, [])

  // Reset sub-step when switching modes
  const switchMode = (m: Mode) => {
    setSuStep(0)
    setSuError('')
    setSiError('')
    setMode(m)
  }

  // ── Sign-in submit ──────────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!siUsername.trim() || !siPassword.trim()) {
      setSiError(t('auth.fillAllFields'))
      return
    }
    setSiError('')
    setSiLoading(true)
    try {
      const result = await login(siUsername.trim(), siPassword)
      if (result.success) {
        navigate('/dashboard', { replace: true })
      } else {
        const code = result.error
        setSiError(
          code && t(`errors.${code}`, '') !== ''
            ? t(`errors.${code}`)
            : result.error ?? t('auth.invalidCredentials')
        )
      }
    } finally {
      setSiLoading(false)
    }
  }

  // ── Sign-up validation per step ─────────────────────────────────────────────
  const validateStep0 = () => {
    if (!suForm.schoolNameAr.trim() || !suForm.schoolNameFr.trim()) {
      setSuError('يرجى إدخال اسم المدرسة بالعربية والفرنسية')
      return false
    }
    return true
  }

  const validateStep1 = () => {
    if (!suForm.adminFullName.trim() || !suForm.adminUsername.trim() || !suForm.adminPassword) {
      setSuError('يرجى ملء جميع حقول الحساب')
      return false
    }
    if (suForm.adminPassword.length < 4) {
      setSuError('كلمة المرور يجب أن تكون 4 أحرف على الأقل')
      return false
    }
    if (suForm.adminPassword !== suForm.confirmPassword) {
      setSuError('كلمتا المرور غير متطابقتين')
      return false
    }
    return true
  }

  const handleSignUpNext = () => {
    setSuError('')
    if (suStep === 0 && validateStep0()) setSuStep(1)
  }

  const handleSignUpSubmit = async () => {
    setSuError('')
    if (!validateStep1()) return
    setSuLoading(true)
    try {
      const result = await completeSetup({
        schoolNameAr: suForm.schoolNameAr,
        schoolNameFr: suForm.schoolNameFr,
        academicYear: suForm.academicYear,
        phone: suForm.phone || undefined,
        adminFullName: suForm.adminFullName,
        adminUsername: suForm.adminUsername,
        adminPassword: suForm.adminPassword,
        preferredLanguage: suForm.preferredLanguage,
      })
      if (!result.success) {
        setSuError(result.error ?? 'حدث خطأ أثناء إنشاء الحساب')
      }
      // On success AuthContext transitions to 'authenticated' automatically
    } finally {
      setSuLoading(false)
    }
  }

  const setSu = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSuForm((f) => ({ ...f, [k]: e.target.value }))

  const inputCls =
    'w-full ps-9 pe-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all bg-white outline-none'
  const inputPlainCls =
    'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all bg-white outline-none'
  const labelCls = 'block text-sm font-medium text-[#0F172A] mb-1.5'

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex w-[44%] bg-[#0F172A] flex-col items-center justify-center p-12 relative overflow-hidden shrink-0">
        {/* Ambient glows */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-[#2563EB] opacity-20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-56 h-56 bg-teal-400 opacity-10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative text-center z-10">
          <div className="w-20 h-20 rounded-2xl bg-[#2563EB] flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <span className="text-white font-bold text-3xl">E</span>
          </div>
          <h1 className="text-white text-4xl font-bold mb-2 tracking-tight">
            Edupilot <span className="text-teal-400">DZ</span>
          </h1>
          <p className="text-slate-400 text-sm mt-3 leading-relaxed max-w-xs mx-auto">
            {t('app.tagline')}
          </p>

          <div className="mt-10 grid grid-cols-2 gap-3 text-left">
            {[
              { label: 'Gestion des étudiants', icon: '👨‍🎓' },
              { label: 'Suivi des présences', icon: '📋' },
              { label: 'Paiements & rapports', icon: '💰' },
              { label: 'Hors ligne – local', icon: '🔒' },
            ].map((f) => (
              <div key={f.label} className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="text-xl mb-1">{f.icon}</div>
                <p className="text-xs text-slate-300 leading-snug">{f.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex items-center justify-center gap-2 text-slate-500 text-xs">
            <WifiOff size={13} />
            <span>{t('app.offline')}</span>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
        {/* Language switcher */}
        <div className="absolute top-5 end-5 flex gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => switchLanguage(l.code as SupportedLanguage)}
              className="text-xs px-2.5 py-1.5 rounded font-medium text-slate-500 hover:bg-slate-100 transition-colors"
            >
              {l.code.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center">
              <span className="text-white font-bold text-lg">E</span>
            </div>
            <span className="text-[#0F172A] font-bold text-xl">
              Edupilot <span className="text-teal-500">DZ</span>
            </span>
          </div>

          {/* ── Mode toggle tabs ── */}
          <div className="flex bg-slate-100 rounded-xl p-1 mb-8 gap-1">
            <button
              onClick={() => switchMode('signin')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                mode === 'signin'
                  ? 'bg-white text-[#2563EB] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LogIn size={14} />
              {t('auth.login') || 'Se connecter'}
            </button>
            <button
              onClick={() => switchMode('signup')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                mode === 'signup'
                  ? 'bg-white text-[#2563EB] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <UserPlus size={14} />
              {t('auth.register') || "S'inscrire"}
            </button>
          </div>

          {/* ════════ SIGN IN ════════ */}
          {mode === 'signin' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-[#0F172A]">{t('auth.login') || 'Connexion'}</h2>
                <p className="text-slate-500 text-sm mt-1">{t('auth.schoolAdmin') || 'Administration scolaire'}</p>
              </div>

              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className={labelCls}>{t('auth.username') || "Nom d'utilisateur"}</label>
                  <div className="relative">
                    <User size={15} className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={siUsername}
                      onChange={(e) => { setSiUsername(e.target.value); setSiError('') }}
                      className={inputCls}
                      autoComplete="username"
                      disabled={siLoading}
                      dir="ltr"
                      placeholder="admin"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>{t('auth.password') || 'Mot de passe'}</label>
                  <div className="relative">
                    <Lock size={15} className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type={siShowPw ? 'text' : 'password'}
                      value={siPassword}
                      onChange={(e) => { setSiPassword(e.target.value); setSiError('') }}
                      className="w-full ps-9 pe-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all bg-white outline-none"
                      autoComplete="current-password"
                      disabled={siLoading}
                      dir="ltr"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setSiShowPw((v) => !v)}
                      className="absolute inset-e-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {siShowPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {siError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-lg">
                    {siError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={siLoading}
                  className="w-full bg-[#2563EB] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#1D4ED8] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                >
                  {siLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      {t('auth.loggingIn') || 'Connexion...'}
                    </>
                  ) : (
                    <>
                      {t('auth.loginButton') || 'Se connecter'}
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-xs text-slate-400 mt-6">
                {"Pas encore de compte ? "}
                <button
                  onClick={() => switchMode('signup')}
                  className="text-[#2563EB] font-medium hover:underline"
                >
                  {"Créer un compte"}
                </button>
              </p>
            </div>
          )}

          {/* ════════ SIGN UP ════════ */}
          {mode === 'signup' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-[#0F172A]">
                  {suStep === 0 ? 'Informations école' : 'Compte administrateur'}
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  Étape {suStep + 1} sur 2
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-slate-100 rounded-full mb-6 overflow-hidden">
                <div
                  className="h-full bg-[#2563EB] rounded-full transition-all duration-500"
                  style={{ width: suStep === 0 ? '50%' : '100%' }}
                />
              </div>

              {/* ── Step 0: School info ── */}
              {suStep === 0 && (
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>
                      <span className="flex items-center gap-1.5">
                        <Building2 size={13} className="text-[#2563EB]" />
                        اسم المدرسة بالعربية *
                      </span>
                    </label>
                    <input
                      className={inputPlainCls}
                      value={suForm.schoolNameAr}
                      onChange={setSu('schoolNameAr')}
                      dir="rtl"
                      placeholder="مدرسة الأمل"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Nom de l'école en français *</label>
                    <input
                      className={inputPlainCls}
                      value={suForm.schoolNameFr}
                      onChange={setSu('schoolNameFr')}
                      placeholder="École de l'Espoir"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Téléphone</label>
                      <input
                        className={inputPlainCls}
                        value={suForm.phone}
                        onChange={setSu('phone')}
                        placeholder="0550 123 456"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Année scolaire</label>
                      <input
                        className={inputPlainCls}
                        value={suForm.academicYear}
                        onChange={setSu('academicYear')}
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 1: Admin account ── */}
              {suStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Nom complet *</label>
                    <div className="relative">
                      <User size={15} className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        className={inputCls}
                        value={suForm.adminFullName}
                        onChange={setSu('adminFullName')}
                        placeholder="Mohamed Amine"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>{"Nom d'utilisateur *"}</label>
                    <div className="relative">
                      <User size={15} className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        className={inputCls}
                        value={suForm.adminUsername}
                        onChange={setSu('adminUsername')}
                        dir="ltr"
                        placeholder="admin"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Mot de passe *</label>
                    <div className="relative">
                      <Lock size={15} className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type={suShowPw ? 'text' : 'password'}
                        className="w-full ps-9 pe-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all bg-white outline-none"
                        value={suForm.adminPassword}
                        onChange={setSu('adminPassword')}
                        dir="ltr"
                        autoComplete="new-password"
                        placeholder="Min. 4 caractères"
                      />
                      <button
                        type="button"
                        onClick={() => setSuShowPw((v) => !v)}
                        className="absolute inset-e-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {suShowPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Confirmer le mot de passe *</label>
                    <div className="relative">
                      <Lock size={15} className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type={suShowConfirm ? 'text' : 'password'}
                        className="w-full ps-9 pe-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all bg-white outline-none"
                        value={suForm.confirmPassword}
                        onChange={setSu('confirmPassword')}
                        dir="ltr"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setSuShowConfirm((v) => !v)}
                        className="absolute inset-e-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {suShowConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {suError && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-lg">
                  {suError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                {suStep > 0 && (
                  <button
                    onClick={() => { setSuStep(0); setSuError('') }}
                    className="px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    ← Retour
                  </button>
                )}
                {suStep === 0 ? (
                  <button
                    onClick={handleSignUpNext}
                    className="flex-1 bg-[#2563EB] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#1D4ED8] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    Suivant <ArrowRight size={15} />
                  </button>
                ) : (
                  <button
                    onClick={handleSignUpSubmit}
                    disabled={suLoading}
                    className="flex-1 bg-teal-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-teal-700 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {suLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Création...
                      </>
                    ) : (
                      <>
                        <UserPlus size={15} />
                        Créer le compte
                      </>
                    )}
                  </button>
                )}
              </div>

              <p className="text-center text-xs text-slate-400 mt-4">
                {"Vous avez déjà un compte ? "}
                <button
                  onClick={() => switchMode('signin')}
                  className="text-[#2563EB] font-medium hover:underline"
                >
                  Se connecter
                </button>
              </p>
            </div>
          )}

          {/* DB status indicator */}
          <p className="text-center text-xs mt-8 flex items-center justify-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                dbStatus === 'healthy'
                  ? 'bg-green-500'
                  : dbStatus === 'checking'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-red-500'
              }`}
            />
            <span
              className={
                dbStatus === 'healthy'
                  ? 'text-slate-400'
                  : dbStatus === 'checking'
                  ? 'text-amber-600'
                  : 'text-red-600 font-medium'
              }
            >
              {dbStatus === 'healthy'
                ? t('common.localDatabase')
                : dbStatus === 'checking'
                ? 'Vérification de la base de données...'
                : 'Base de données locale indisponible'}
            </span>
          </p>
        </div>

        <p className="absolute bottom-5 text-xs text-slate-300">Edupilot DZ v1.0.0 – 2026</p>
      </div>
    </div>
  )
}
