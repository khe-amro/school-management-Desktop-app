import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Filter, Download, MoreHorizontal, LayoutGrid, List, ChevronLeft, ChevronRight, Eye, Pencil, CreditCard, Archive, Printer, ClipboardList } from 'lucide-react'
import Badge from '../components/ui/Badge'
import { students as initialStudents, courses, groups } from '../data/mockData'
import type { Student, PaymentStatus } from '../types'

const ITEMS_PER_PAGE = 10

export default function Students() {
  const navigate = useNavigate()
  const [students, setStudents] = useState(initialStudents)
  const [search, setSearch] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return students.filter(s => {
      const q = search.toLowerCase()
      const matchSearch = !q || `${s.firstName} ${s.lastName} ${s.studentNumber}`.toLowerCase().includes(q)
      const matchGroup = !filterGroup || s.groupId === filterGroup
      const matchStatus = !filterStatus || s.status === filterStatus
      const matchPayment = !filterPayment || s.paymentStatus === filterPayment
      return matchSearch && matchGroup && matchStatus && matchPayment
    })
  }, [students, search, filterGroup, filterStatus, filterPayment])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === paginated.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(paginated.map(s => s.id)))
  }

  const getCourse = (s: Student) => courses.find(c => c.id === s.courseId)?.name ?? '—'
  const getGroup = (s: Student) => groups.find(g => g.id === s.groupId)?.name ?? '—'

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 flex-1 min-w-48">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom ou N° étudiant..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="bg-transparent text-sm outline-none w-full text-slate-700 placeholder-slate-400"
            />
          </div>
          <select value={filterGroup} onChange={e => { setFilterGroup(e.target.value); setPage(1) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white text-slate-700 hover:border-slate-300 transition-colors">
            <option value="">Tous les groupes</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white text-slate-700 hover:border-slate-300 transition-colors">
            <option value="">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="inactive">Inactif</option>
          </select>
          <select value={filterPayment} onChange={e => { setFilterPayment(e.target.value); setPage(1) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white text-slate-700 hover:border-slate-300 transition-colors">
            <option value="">Tous les paiements</option>
            <option value="paid">Payé</option>
            <option value="unpaid">Impayé</option>
            <option value="partial">Partiel</option>
            <option value="overdue">En retard</option>
          </select>
          <div className="flex items-center gap-1 ml-auto">
            <button onClick={() => setViewMode('table')} className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}><List size={16} /></button>
            <button onClick={() => setViewMode('card')} className={`p-2 rounded-lg transition-colors ${viewMode === 'card' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}><LayoutGrid size={16} /></button>
            <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors ml-1">
              <Download size={14} /> Exporter
            </button>
            <button onClick={() => navigate('/students/new')} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              <Plus size={14} /> Ajouter
            </button>
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-500">{filtered.length} étudiant{filtered.length !== 1 ? 's' : ''} trouvé{filtered.length !== 1 ? 's' : ''}{selectedIds.size > 0 ? ` · ${selectedIds.size} sélectionné${selectedIds.size !== 1 ? 's' : ''}` : ''}</div>
      </div>

      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="pl-4 pr-2 py-3 text-left"><input type="checkbox" checked={selectedIds.size === paginated.length && paginated.length > 0} onChange={selectAll} className="w-4 h-4 rounded accent-blue-600" /></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Photo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">N° / Nom</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Cours / Groupe</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Téléphone tuteur</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Inscrit le</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Paiement</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="pl-4 pr-2 py-3"><input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} className="w-4 h-4 rounded accent-blue-600" /></td>
                    <td className="px-4 py-3"><img src={s.photo} alt={s.firstName} className="w-8 h-8 rounded-full object-cover bg-slate-100" /></td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{s.firstName} {s.lastName}</p>
                      <p className="text-xs text-slate-400 font-mono">{s.studentNumber}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700">{getCourse(s)}</p>
                      <p className="text-xs text-slate-400">{getGroup(s)}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.guardianPhone}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(s.registrationDate).toLocaleDateString('fr-DZ')}</td>
                    <td className="px-4 py-3"><Badge variant={s.paymentStatus as PaymentStatus}>{s.paymentStatus}</Badge></td>
                    <td className="px-4 py-3"><Badge variant={s.status}>{s.status}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <button onClick={() => setOpenMenu(openMenu === s.id ? null : s.id)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                          <MoreHorizontal size={16} />
                        </button>
                        {openMenu === s.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 w-44 overflow-hidden">
                            <button onClick={() => { navigate(`/students/${s.id}`); setOpenMenu(null) }} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"><Eye size={13} /> Voir profil</button>
                            <button onClick={() => { navigate(`/students/${s.id}/edit`); setOpenMenu(null) }} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"><Pencil size={13} /> Modifier</button>
                            <button onClick={() => { navigate(`/students/${s.id}/card`); setOpenMenu(null) }} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"><Printer size={13} /> Imprimer carte</button>
                            <button className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"><ClipboardList size={13} /> Présences</button>
                            <button className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"><CreditCard size={13} /> Paiements</button>
                            <div className="border-t border-slate-100" />
                            <button className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"><Archive size={13} /> Archiver</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-500">Page {page} sur {totalPages || 1}</span>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-600">
                <ChevronLeft size={15} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 text-xs rounded-lg transition-colors ${page === p ? 'bg-blue-600 text-white' : 'hover:bg-slate-200 text-slate-600'}`}>{p}</button>
              ))}
              <button disabled={page === totalPages || totalPages === 0} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-600">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {paginated.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/students/${s.id}`)}>
              <div className="flex items-center gap-3 mb-3">
                <img src={s.photo} alt={s.firstName} className="w-12 h-12 rounded-full object-cover bg-slate-100" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{s.firstName} {s.lastName}</p>
                  <p className="text-xs text-slate-400 font-mono">{s.studentNumber}</p>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-slate-500">
                <p><span className="font-medium text-slate-700">Cours:</span> {getCourse(s)}</p>
                <p><span className="font-medium text-slate-700">Groupe:</span> {getGroup(s)}</p>
                <p><span className="font-medium text-slate-700">Tél:</span> {s.guardianPhone}</p>
              </div>
              <div className="flex gap-2 mt-3">
                <Badge variant={s.paymentStatus as PaymentStatus}>{s.paymentStatus}</Badge>
                <Badge variant={s.status}>{s.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
