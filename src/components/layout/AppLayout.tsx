import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

const titles: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/students': 'Étudiants',
  '/teachers': 'Enseignants',
  '/courses': 'Cours & Groupes',
  '/attendance': 'Présence – Scanner QR',
  '/attendance/history': 'Historique des présences',
  '/payments': 'Paiements & Revenus',
  '/reports': 'Rapports',
  '/settings': 'Paramètres',
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  const getTitle = () => {
    const exact = titles[location.pathname]
    if (exact) return exact
    if (location.pathname.startsWith('/students/')) return 'Profil étudiant'
    return 'Edupilot DZ'
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title={getTitle()} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
