import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ScanLine,
  CreditCard, BarChart3, Settings, ChevronLeft, ChevronRight,
  LogOut
} from 'lucide-react'
import Logo from '../Logo'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'لوحة التحكم' },
  { to: '/students', icon: Users, label: 'الطلاب' },
  { to: '/teachers', icon: GraduationCap, label: 'الأساتذة' },
  { to: '/courses', icon: BookOpen, label: 'المواد والأفواج' },
  { to: '/attendance', icon: ScanLine, label: 'تسجيل الحضور' },
  { to: '/payments', icon: CreditCard, label: 'المدفوعات' },
  { to: '/reports', icon: BarChart3, label: 'التقارير' },
  { to: '/settings', icon: Settings, label: 'الإعدادات' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const navigate = useNavigate()
  const api = (window as any).schoolApp
  const [adminUser, setAdminUser] = useState<{ fullName: string; photoUrl: string | null }>({
    fullName: 'مدير النظام',
    photoUrl: null,
  })

  useEffect(() => {
    let active = true
    const fetchAdmin = async () => {
      if (!api) return
      try {
        const res = await (api.settings?.getAdmin ? api.settings.getAdmin() : { success: false })
        if (!active) return
        if (res.success && res.data) {
          let photoUrl = null
          if (res.data.photoPath && api.media?.getImageUrl) {
            const pRes = await api.media.getImageUrl(res.data.photoPath)
            if (pRes.success) photoUrl = pRes.data.url
          }
          if (active) {
            setAdminUser({
              fullName: res.data.fullName || res.data.username || 'مدير النظام',
              photoUrl,
            })
          }
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchAdmin()
    return () => { active = false }
  }, [api])

  const handleLogout = () => {
    navigate('/login')
  }

  return (
    <aside className={`flex flex-col h-screen bg-[#0F172A] transition-all duration-200 shrink-0 ${collapsed ? 'w-15' : 'w-55'}`} dir="rtl">
      {/* Logo */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-white/10">
        <div className={`overflow-hidden transition-all ${collapsed ? 'w-0 opacity-0' : 'w-full opacity-100'}`}>
          <Logo collapsed={false} size={28} />
        </div>
        {collapsed && <Logo collapsed={true} size={28} />}
        <button
          onClick={onToggle}
          className="mr-auto p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          title={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
        >
          {collapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                isActive
                  ? 'bg-[#2563EB] text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`
            }
          >
            <Icon size={17} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-3">
        <div className={`flex items-center gap-2 mb-3 px-1 ${collapsed ? 'justify-center' : ''}`}>
          {adminUser.photoUrl ? (
            <img
              src={adminUser.photoUrl}
              alt={adminUser.fullName}
              className="w-7 h-7 rounded-full object-cover shrink-0 border border-white/20"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {adminUser.fullName.charAt(0)}
            </div>
          )}
          {!collapsed && (
            <div className="overflow-hidden text-right">
              <p className="text-xs font-semibold text-white truncate" title={adminUser.fullName}>{adminUser.fullName}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                <span className="text-[10px] text-slate-400 truncate">قاعدة البيانات متصلة</span>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          title="تسجيل الخروج"
          className={`flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={15} />
          {!collapsed && <span>تسجيل الخروج</span>}
        </button>
      </div>
    </aside>
  )
}
