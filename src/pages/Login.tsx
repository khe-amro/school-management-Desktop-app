import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Wifi } from 'lucide-react'
import Logo from '../components/Logo'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) { setError('Veuillez remplir tous les champs.'); return }
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      navigate('/dashboard')
    }, 800)
  }

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] bg-[#0F172A] p-10 shrink-0">
        <Logo size={36} />
        <div>
          <h2 className="text-3xl font-bold text-white leading-snug mb-4">
            Gérez votre école.<br />
            <span className="text-[#14B8A6]">Simplement.</span>
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Edupilot DZ centralise la gestion des étudiants, des présences, des paiements et des rapports dans une interface locale fiable — sans connexion internet.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            {[
              { label: 'Étudiants', value: '18' },
              { label: 'Cours actifs', value: '5' },
              { label: 'Présences ce mois', value: '247' },
              { label: 'Revenus juillet', value: '38 500 DA' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Wifi size={13} />
          <span>Application locale – aucune connexion requise</span>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo size={36} />
          </div>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Connexion</h1>
            <p className="text-sm text-slate-500 mt-1">Administration scolaire</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom d'utilisateur</label>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError('') }}
                placeholder="admin"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-white outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 pr-10 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{error}</p>}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 accent-blue-600"
              />
              <label htmlFor="remember" className="text-sm text-slate-600">Se souvenir de la session</label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2563EB] hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-2 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-200">
            <Wifi size={12} />
            <span>L'application fonctionne localement sans internet</span>
          </div>
        </div>

        <p className="absolute bottom-6 text-xs text-slate-400">Edupilot DZ v1.0.0 – 2026</p>
      </div>
    </div>
  )
}
