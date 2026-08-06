import { useState } from 'react'
import { Search, Plus, MoreHorizontal, Pencil, Eye, ToggleLeft } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { teachers as initialTeachers, courses, groups } from '../data/mockData'
import type { Teacher } from '../types'

export default function Teachers() {
  const [teachers, setTeachers] = useState(initialTeachers)
  const [search, setSearch] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', courseIds: [] as string[] })

  const filtered = teachers.filter(t => {
    const q = search.toLowerCase()
    return !q || `${t.firstName} ${t.lastName} ${t.email}`.toLowerCase().includes(q)
  })

  const getTeacherGroups = (t: Teacher) => groups.filter(g => g.teacherId === t.id)
  const getTeacherCourses = (t: Teacher) => courses.filter(c => t.courseIds.includes(c.id))

  const openAdd = () => {
    setEditing(null)
    setForm({ firstName: '', lastName: '', phone: '', email: '', courseIds: [] })
    setModalOpen(true)
  }

  const openEdit = (t: Teacher) => {
    setEditing(t)
    setForm({ firstName: t.firstName, lastName: t.lastName, phone: t.phone, email: t.email, courseIds: t.courseIds })
    setModalOpen(true)
    setOpenMenu(null)
  }

  const handleSave = () => {
    if (editing) {
      setTeachers(prev => prev.map(t => t.id === editing.id ? { ...t, ...form } : t))
    }
    setModalOpen(false)
  }

  const toggleStatus = (id: string) => {
    setTeachers(prev => prev.map(t => t.id === id ? { ...t, status: t.status === 'active' ? 'inactive' : 'active' } : t))
    setOpenMenu(null)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 flex-1">
          <Search size={14} className="text-slate-400" />
          <input type="text" placeholder="Rechercher un enseignant..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full text-slate-700 placeholder-slate-400" />
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
          <Plus size={14} /> Ajouter
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Photo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Nom</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Téléphone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Cours assignés</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Groupes</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Statut</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(t => (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3"><img src={t.photo} alt={t.firstName} className="w-9 h-9 rounded-full object-cover bg-slate-100" /></td>
                <td className="px-4 py-3 font-medium text-slate-900">{t.firstName} {t.lastName}</td>
                <td className="px-4 py-3 text-slate-600">{t.phone}</td>
                <td className="px-4 py-3 text-slate-600">{t.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {getTeacherCourses(t).map(c => <span key={c.id} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded-full border border-blue-200">{c.name}</span>)}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">{getTeacherGroups(t).length}</td>
                <td className="px-4 py-3"><Badge variant={t.status}>{t.status}</Badge></td>
                <td className="px-4 py-3">
                  <div className="relative">
                    <button onClick={() => setOpenMenu(openMenu === t.id ? null : t.id)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                      <MoreHorizontal size={16} />
                    </button>
                    {openMenu === t.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 w-44 overflow-hidden">
                        <button onClick={() => openEdit(t)} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><Pencil size={13} /> Modifier</button>
                        <button onClick={() => toggleStatus(t.id)} className={`flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-slate-50 ${t.status === 'active' ? 'text-amber-600' : 'text-green-600'}`}><ToggleLeft size={13} /> {t.status === 'active' ? 'Désactiver' : 'Activer'}</button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier l\'enseignant' : 'Ajouter un enseignant'} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Prénom</label>
              <input type="text" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Nom</label>
              <input type="text" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Téléphone</label>
            <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Cours assignés</label>
            <div className="space-y-2">
              {courses.map(c => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.courseIds.includes(c.id)}
                    onChange={e => setForm(f => ({ ...f, courseIds: e.target.checked ? [...f.courseIds, c.id] : f.courseIds.filter(id => id !== c.id) }))}
                    className="w-4 h-4 rounded accent-blue-600" />
                  <span className="text-sm text-slate-700">{c.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Annuler</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">Enregistrer</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
