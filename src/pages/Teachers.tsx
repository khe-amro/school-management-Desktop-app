import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, MoreHorizontal, Pencil, Eye, ToggleLeft, Camera } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'

export default function Teachers() {
  const [teachers, setTeachers] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [openMenu, setOpenMenu] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  const [form, setForm] = useState({
    firstNameFr: '',
    lastNameFr: '',
    firstNameAr: '',
    lastNameAr: '',
    phone: '',
    email: '',
    specialty: '',
    hourlyRate: 1500,
  })

  const api = (window as any).schoolApp

  const loadData = useCallback(async () => {
    if (!api) return
    try {
      const [tRes, cRes, gRes] = await Promise.all([
        api.teachers.list(),
        api.courses.list(),
        api.groups.list()
      ])

      if (tRes.success && tRes.data) {
        // Enriched with photo URLs
        const enriched = await Promise.all(
          tRes.data.map(async (t: any) => {
            let pUrl = null
            if (t.photoPath) {
              const pRes = await api.media.getImageUrl(t.photoPath)
              if (pRes.success) pUrl = pRes.data.url
            }
            return { ...t, photoUrl: pUrl }
          })
        )
        setTeachers(enriched)
      }
      if (cRes.success && cRes.data) setCourses(cRes.data)
      if (gRes.success && gRes.data) setGroups(gRes.data)
    } catch (err) {
      console.error('Failed to load teachers:', err)
    }
  }, [api])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filtered = teachers.filter(t => {
    const q = search.toLowerCase()
    return !q || `${t.firstNameFr} ${t.lastNameFr} ${t.specialty || ''} ${t.email || ''}`.toLowerCase().includes(q)
  })

  const openAdd = () => {
    setEditing(null)
    setPhotoPath(null)
    setPhotoUrl(null)
    setForm({
      firstNameFr: '',
      lastNameFr: '',
      firstNameAr: '',
      lastNameAr: '',
      phone: '',
      email: '',
      specialty: '',
      hourlyRate: 1500,
    })
    setModalOpen(true)
  }

  const openEdit = (t: any) => {
    setEditing(t)
    setPhotoPath(t.photoPath)
    setPhotoUrl(t.photoUrl)
    setForm({
      firstNameFr: t.firstNameFr || '',
      lastNameFr: t.lastNameFr || '',
      firstNameAr: t.firstNameAr || '',
      lastNameAr: t.lastNameAr || '',
      phone: t.phone || '',
      email: t.email || '',
      specialty: t.specialty || '',
      hourlyRate: t.hourlyRate || 1500,
    })
    setModalOpen(true)
    setOpenMenu(null)
  }

  const handleSelectPhoto = async () => {
    if (!api) return
    try {
      const res = await api.media.selectImage('teacher', editing ? editing.id : 'temp')
      if (res.success && res.path) {
        setPhotoPath(res.path)
        const pRes = await api.media.getImageUrl(res.path)
        if (pRes.success) setPhotoUrl(pRes.data.url)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleSave = async () => {
    if (!api || !form.firstNameFr.trim() || !form.lastNameFr.trim()) {
      alert('Veuillez renseigner le nom et prénom de l\'enseignant.')
      return
    }

    try {
      if (editing) {
        await api.teachers.update(editing.id, {
          firstNameFr: form.firstNameFr,
          lastNameFr: form.lastNameFr,
          firstNameAr: form.firstNameAr || form.firstNameFr,
          lastNameAr: form.lastNameAr || form.lastNameFr,
          phone: form.phone || null,
          email: form.email || null,
          specialty: form.specialty || null,
          hourlyRate: Number(form.hourlyRate) || null,
        })
      } else {
        await api.teachers.create({
          firstNameFr: form.firstNameFr,
          lastNameFr: form.lastNameFr,
          firstNameAr: form.firstNameAr || form.firstNameFr,
          lastNameAr: form.lastNameAr || form.lastNameFr,
          phone: form.phone || null,
          email: form.email || null,
          specialty: form.specialty || null,
          hourlyRate: Number(form.hourlyRate) || null,
        })
      }

      setModalOpen(false)
      loadData()
    } catch (err) {
      console.error(err)
    }
  }

  const toggleStatus = async (t: any) => {
    if (!api) return
    try {
      const nextStatus = t.status === 'active' ? 'inactive' : 'active'
      await api.teachers.update(t.id, { status: nextStatus })
      setOpenMenu(null)
      loadData()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 flex-1">
          <Search size={14} className="text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un enseignant par nom, spécialité ou email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full text-slate-700 placeholder-slate-400"
          />
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
        >
          <Plus size={14} /> Ajouter
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Photo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Nom (FR / AR)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Spécialité</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Téléphone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Groupes</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Statut</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-400 text-sm">
                  Aucun enseignant trouvé
                </td>
              </tr>
            ) : (
              filtered.map(t => {
                const assignedGroups = groups.filter(g => g.teacherId === t.id)
                return (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      {t.photoUrl ? (
                        <img src={t.photoUrl} alt="" className="w-9 h-9 rounded-full object-cover bg-slate-100 border border-slate-200" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                          {t.firstNameFr?.charAt(0)}{t.lastNameFr?.charAt(0)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{t.firstNameFr} {t.lastNameFr}</p>
                      {t.firstNameAr && <p className="text-xs text-slate-400" dir="rtl">{t.lastNameAr} {t.firstNameAr}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{t.specialty || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{t.phone || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{t.email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded-full font-semibold">
                        {assignedGroups.length} groupe(s)
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={t.status}>{t.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative inline-block text-left">
                        <button
                          onClick={() => setOpenMenu(openMenu === t.id ? null : t.id)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        {openMenu === t.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 w-40 overflow-hidden text-left">
                            <button
                              onClick={() => openEdit(t)}
                              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <Pencil size={13} /> Modifier
                            </button>
                            <button
                              onClick={() => toggleStatus(t)}
                              className={`flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-slate-50 ${t.status === 'active' ? 'text-amber-600' : 'text-green-600'}`}
                            >
                              <ToggleLeft size={13} /> {t.status === 'active' ? 'Désactiver' : 'Activer'}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Teacher Form Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier l\'enseignant' : 'Ajouter un enseignant'} size="md">
        <div className="space-y-4">
          <div className="flex justify-center mb-2">
            <div
              onClick={handleSelectPhoto}
              className="w-20 h-20 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer overflow-hidden relative group hover:border-blue-500"
            >
              {photoUrl ? (
                <img src={photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Camera size={18} className="text-slate-400" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Prénom (FR) *</label>
              <input
                type="text"
                placeholder="Ex: Karim"
                value={form.firstNameFr}
                onChange={e => setForm(f => ({ ...f, firstNameFr: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nom (FR) *</label>
              <input
                type="text"
                placeholder="Ex: Mansouri"
                value={form.lastNameFr}
                onChange={e => setForm(f => ({ ...f, lastNameFr: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Prénom (AR)</label>
              <input
                type="text"
                placeholder="كريم"
                value={form.firstNameAr}
                onChange={e => setForm(f => ({ ...f, firstNameAr: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white text-right"
                dir="rtl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nom (AR)</label>
              <input
                type="text"
                placeholder="منصوري"
                value={form.lastNameAr}
                onChange={e => setForm(f => ({ ...f, lastNameAr: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white text-right"
                dir="rtl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Spécialité / Matière</label>
              <input
                type="text"
                placeholder="Ex: Mathématiques, Anglais..."
                value={form.specialty}
                onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tarif horaire (DA)</label>
              <input
                type="number"
                value={form.hourlyRate}
                onChange={e => setForm(f => ({ ...f, hourlyRate: Number(e.target.value) || 0 }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Téléphone</label>
              <input
                type="tel"
                placeholder="0550 000 000"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input
                type="email"
                placeholder="prof@ecole.dz"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Annuler</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">Enregistrer</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
