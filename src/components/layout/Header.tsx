import { useState, useRef, useEffect } from 'react'
import { Search, Bell, ChevronDown, User, Settings, LogOut, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { students, teachers, courses } from '../../data/mockData'

interface HeaderProps {
  title: string
}

const today = new Date().toLocaleDateString('fr-DZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

const notifications = [
  { id: '1', title: '3 paiements en retard', message: 'Bilal M., Zakaria B., Nassim G.', time: "Il y a 1h", read: false },
  { id: '2', title: 'Session de présence terminée', message: 'English A1 Morning – 12/12 présents', time: "Il y a 2h", read: false },
  { id: '3', title: 'Sauvegarde automatique', message: 'Base de données sauvegardée avec succès', time: "Il y a 5h", read: true },
]

export default function Header({ title }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const searchResults = searchQuery.length > 1 ? [
    ...students.filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 3).map(s => ({ type: 'Étudiant', label: `${s.firstName} ${s.lastName}`, id: s.id, to: `/students/${s.id}` })),
    ...teachers.filter(t => `${t.firstName} ${t.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 2).map(t => ({ type: 'Enseignant', label: `${t.firstName} ${t.lastName}`, id: t.id, to: '/teachers' })),
    ...courses.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 2).map(c => ({ type: 'Cours', label: c.name, id: c.id, to: '/courses' })),
  ] : []

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-6 gap-4 shrink-0 z-20">
      <h1 className="text-base font-semibold text-slate-900 whitespace-nowrap">{title}</h1>
      <div className="flex-1" />

      {/* Search */}
      <div ref={searchRef} className="relative">
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5 w-56">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowSearch(true) }}
            onFocus={() => setShowSearch(true)}
            className="bg-transparent text-sm outline-none w-full text-slate-700 placeholder-slate-400"
          />
          {searchQuery && <button onClick={() => { setSearchQuery(''); setShowSearch(false) }}><X size={12} className="text-slate-400" /></button>}
        </div>
        {showSearch && searchResults.length > 0 && (
          <div className="absolute top-full mt-1 right-0 bg-white rounded-xl border border-slate-200 shadow-lg w-72 z-50 overflow-hidden">
            {searchResults.map(r => (
              <button
                key={r.id + r.type}
                className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-slate-50 text-left transition-colors"
                onClick={() => { navigate(r.to); setShowSearch(false); setSearchQuery('') }}
              >
                <span className="text-xs text-slate-400 w-16 shrink-0">{r.type}</span>
                <span className="text-sm text-slate-800 font-medium">{r.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Date */}
      <span className="text-xs text-slate-500 whitespace-nowrap hidden xl:block">{today}</span>

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => { setShowNotif(!showNotif); setShowProfile(false) }}
          className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        {showNotif && (
          <div className="absolute top-full mt-1 right-0 bg-white rounded-xl border border-slate-200 shadow-lg w-80 z-50">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
            </div>
            {notifications.map(n => (
              <div key={n.id} className={`px-4 py-3 border-b border-slate-50 ${!n.read ? 'bg-blue-50/50' : ''}`}>
                <p className="text-sm font-medium text-slate-800">{n.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                <p className="text-[11px] text-slate-400 mt-1">{n.time}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="relative">
        <button
          onClick={() => { setShowProfile(!showProfile); setShowNotif(false) }}
          className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-xs font-bold">A</div>
          <span className="text-sm font-medium text-slate-700 hidden sm:block">Admin</span>
          <ChevronDown size={13} className="text-slate-400" />
        </button>
        {showProfile && (
          <div className="absolute top-full mt-1 right-0 bg-white rounded-xl border border-slate-200 shadow-lg w-48 z-50 overflow-hidden">
            <button className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
              <User size={14} /> Mon profil
            </button>
            <button onClick={() => navigate('/settings')} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
              <Settings size={14} /> Paramètres
            </button>
            <div className="border-t border-slate-100" />
            <button onClick={() => navigate('/login')} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
              <LogOut size={14} /> Déconnexion
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
