import { useState, useEffect, useCallback } from 'react'
import { Plus, ChevronDown, ChevronRight, Users, BookOpen, Clock, Calendar, Trash2 } from 'lucide-react'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import type { Course, Group, Teacher } from '../types'

const WEEKDAYS = [
  { id: 0, label: 'Dimanche', short: 'Dim' },
  { id: 1, label: 'Lundi', short: 'Lun' },
  { id: 2, label: 'Mardi', short: 'Mar' },
  { id: 3, label: 'Mercredi', short: 'Mer' },
  { id: 4, label: 'Jeudi', short: 'Jeu' },
  { id: 5, label: 'Vendredi', short: 'Ven' },
  { id: 6, label: 'Samedi', short: 'Sam' },
]

function CapacityBar({ enrolled, capacity }: { enrolled: number; capacity: number }) {
  const pct = capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0
  const color = pct > 85 ? 'bg-red-500' : pct > 65 ? 'bg-amber-500' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 w-14 text-right">{enrolled}/{capacity}</span>
    </div>
  )
}

export default function Courses() {
  const [courses, setCourses] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const [courseModal, setCourseModal] = useState(false)
  const [groupModal, setGroupModal] = useState(false)
  const [slotModal, setSlotModal] = useState(false)
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

  const [courseForm, setCourseForm] = useState({ nameFr: '', nameAr: '', descriptionFr: '', defaultPrice: '2500' })
  const [groupForm, setGroupForm] = useState({
    name: '', teacherId: '', room: '', capacity: '25', monthlyPrice: '2500',
    startDate: new Date().toISOString().split('T')[0], endDate: ''
  })
  const [slotForm, setSlotForm] = useState({ weekday: 1, startTime: '08:00', endTime: '10:00', room: '' })

  const api = (window as any).schoolApp

  const loadData = useCallback(async () => {
    if (!api) return
    try {
      const [cRes, gRes, tRes, sRes] = await Promise.all([
        api.courses.list(),
        api.groups.list(),
        api.teachers.list(),
        api.schedules.list({ active: true })
      ])

      if (cRes.success && cRes.data) setCourses(cRes.data)
      if (gRes.success && gRes.data) setGroups(gRes.data)
      if (tRes.success && tRes.data) setTeachers(tRes.data)
      if (sRes.success && sRes.data) setSchedules(sRes.data)
    } catch (err) {
      console.error('Failed to load courses & groups:', err)
    }
  }, [api])

  useEffect(() => {
    loadData()
  }, [loadData])

  const toggleExpand = (id: number) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const getCourseGroups = (courseId: number) => groups.filter(g => g.courseId === courseId)
  const getGroupSlots = (groupId: number) => schedules.filter(s => s.groupId === groupId)

  const handleAddCourse = async () => {
    if (!api || !courseForm.nameFr) return
    try {
      const res = await api.courses.create({
        nameFr: courseForm.nameFr,
        nameAr: courseForm.nameAr || courseForm.nameFr,
        descriptionFr: courseForm.descriptionFr,
        defaultPrice: Number(courseForm.defaultPrice) || 0,
      })
      if (res.success) {
        setCourseModal(false)
        setCourseForm({ nameFr: '', nameAr: '', descriptionFr: '', defaultPrice: '2500' })
        loadData()
      } else {
        alert(res.error?.message || 'Erreur création cours')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleAddGroup = async () => {
    if (!api || !selectedCourseId || !groupForm.name || !groupForm.teacherId) {
      alert('Veuillez remplir les champs obligatoires (Nom, Enseignant)')
      return
    }
    try {
      const res = await api.groups.create({
        courseId: selectedCourseId,
        teacherId: Number(groupForm.teacherId),
        name: groupForm.name,
        room: groupForm.room || null,
        capacity: Number(groupForm.capacity) || 25,
        monthlyPrice: Number(groupForm.monthlyPrice) || 0,
        startDate: groupForm.startDate || new Date().toISOString().split('T')[0],
      })
      if (res.success) {
        setGroupModal(false)
        setGroupForm({ name: '', teacherId: '', room: '', capacity: '25', monthlyPrice: '2500', startDate: new Date().toISOString().split('T')[0], endDate: '' })
        loadData()
      } else {
        alert(res.error?.message || 'Erreur création groupe')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleAddSlot = async () => {
    if (!api || !selectedGroupId) return
    try {
      const res = await api.schedules.create({
        groupId: selectedGroupId,
        weekday: Number(slotForm.weekday),
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
        room: slotForm.room || undefined,
      })
      if (res.success) {
        setSlotModal(false)
        loadData()
      } else {
        alert(res.error?.message || 'Erreur ajout horaire')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteSlot = async (slotId: number) => {
    if (!api || !confirm('Supprimer ce créneau récurrent ?')) return
    try {
      const res = await api.schedules.delete(slotId)
      if (res.success) {
        loadData()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleGenerateSessions = async (groupId: number) => {
    if (!api) return
    const start = new Date().toISOString().split('T')[0]
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    try {
      const res = await api.sessions.generate(groupId, start, nextMonth)
      if (res.success) {
        alert(`${res.data.generated} séances générées avec succès pour les 30 prochains jours !`)
      } else {
        alert(res.error?.message || 'Erreur génération séances')
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Weekly schedule calculation from schedule slots
  const scheduleView = WEEKDAYS.map(({ id, short, label }) => {
    const slots = schedules.filter(s => s.weekday === id)
    return { day: short, fullDay: label, slots }
  })

  return (
    <div className="grid grid-cols-3 gap-5">
      {/* Course & Groups List */}
      <div className="col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Cours & Groupes ({courses.length})</h2>
          <button
            onClick={() => setCourseModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
          >
            <Plus size={14} /> Ajouter un cours
          </button>
        </div>

        {courses.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
            <BookOpen size={36} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucun cours enregistré</p>
            <button onClick={() => setCourseModal(true)} className="mt-3 text-xs text-blue-600 font-semibold hover:underline">
              + Créer le premier cours
            </button>
          </div>
        ) : (
          courses.map(course => {
            const courseGroups = getCourseGroups(course.id)
            const isOpen = expanded.has(course.id)
            return (
              <div key={course.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleExpand(course.id)}
                >
                  <button className="text-slate-400 shrink-0">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-slate-900">{course.nameFr || course.nameAr}</h3>
                      {course.nameAr && course.nameFr && (
                        <span className="text-xs text-slate-400 font-normal">({course.nameAr})</span>
                      )}
                      <Badge variant={course.status}>{course.status}</Badge>
                    </div>
                    {course.descriptionFr && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{course.descriptionFr}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-slate-800">{Number(course.defaultPrice).toLocaleString('fr-DZ')} DA/mois</p>
                    <p className="text-xs text-slate-400">{courseGroups.length} groupe{courseGroups.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/50">
                    <div className="px-5 py-3 flex items-center justify-between bg-slate-100/70">
                      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Groupes du cours</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedCourseId(course.id)
                          setGroupModal(true)
                        }}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                      >
                        <Plus size={12} /> Ajouter un groupe
                      </button>
                    </div>

                    {courseGroups.length === 0 ? (
                      <div className="px-5 py-5 text-xs text-slate-400 text-center">Aucun groupe pour ce cours</div>
                    ) : (
                      <div className="divide-y divide-slate-100 bg-white">
                        {courseGroups.map(g => {
                          const teacher = teachers.find(t => t.id === g.teacherId)
                          const slots = getGroupSlots(g.id)
                          return (
                            <div key={g.id} className="px-5 py-3.5 space-y-2.5">
                              <div className="grid grid-cols-4 gap-4 items-center">
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">{g.name}</p>
                                  <p className="text-xs text-slate-400">Salle: {g.room || 'Non assignée'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-700 font-medium">{teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Enseignant non assigné'}</p>
                                  <p className="text-xs text-slate-400">{slots.length} créneau{slots.length > 1 ? 'x' : ''}</p>
                                </div>
                                <CapacityBar enrolled={g.enrolledCount ?? 0} capacity={g.capacity} />
                                <div className="flex items-center justify-end gap-2">
                                  <span className="text-xs font-bold text-slate-700">{Number(g.monthlyPrice).toLocaleString('fr-DZ')} DA</span>
                                  <button
                                    onClick={() => handleGenerateSessions(g.id)}
                                    title="Générer les séances du mois"
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 text-xs flex items-center gap-1 border border-slate-200"
                                  >
                                    <Calendar size={12} /> Séances
                                  </button>
                                </div>
                              </div>

                              {/* Slots sub-list */}
                              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex flex-wrap items-center gap-2">
                                <span className="text-[11px] font-semibold text-slate-500">Horaires :</span>
                                {slots.length === 0 ? (
                                  <span className="text-[11px] text-slate-400">Aucun horaire récurrent défini</span>
                                ) : (
                                  slots.map(s => {
                                    const dayName = WEEKDAYS.find(w => w.id === s.weekday)?.short ?? ''
                                    return (
                                      <div key={s.id} className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-slate-200 text-xs">
                                        <span className="font-semibold text-blue-700">{dayName}</span>
                                        <span className="text-slate-600">{s.startTime}–{s.endTime}</span>
                                        <button
                                          onClick={() => handleDeleteSlot(s.id)}
                                          className="text-slate-300 hover:text-red-600 ml-1 transition-colors"
                                        >
                                          <Trash2 size={11} />
                                        </button>
                                      </div>
                                    )
                                  })
                                )}
                                <button
                                  onClick={() => {
                                    setSelectedGroupId(g.id)
                                    setSlotModal(true)
                                  }}
                                  className="text-[11px] text-blue-600 hover:text-blue-800 font-medium ml-auto flex items-center gap-1"
                                >
                                  <Plus size={11} /> Ajouter créneau
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Weekly Schedule Timetable */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">Planning hebdomadaire</h2>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {scheduleView.map(({ day, fullDay, slots }) => (
            <div key={day} className="border-b border-slate-100 last:border-0">
              <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">{fullDay}</span>
                <span className="text-[10px] text-slate-400">{slots.length} cours</span>
              </div>
              {slots.length === 0 ? (
                <div className="px-4 py-2.5 text-xs text-slate-300">Aucun cours</div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {slots.map(s => {
                    const group = groups.find(g => g.id === s.groupId)
                    const course = courses.find(c => c.id === group?.courseId)
                    const teacher = teachers.find(t => t.id === group?.teacherId)
                    return (
                      <div key={s.id} className="px-4 py-2.5 flex items-start gap-2.5 hover:bg-slate-50/60 transition-colors">
                        <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-800 truncate">{group?.name}</p>
                            <span className="text-[11px] font-mono font-medium text-blue-600">{s.startTime}–{s.endTime}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            {course?.nameFr || course?.nameAr} · {teacher?.firstName ? `${teacher.firstName} ${teacher.lastName}` : '—'}
                          </p>
                          {s.room && <p className="text-[10px] text-slate-400">Salle {s.room}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add Course Modal */}
      <Modal open={courseModal} onClose={() => setCourseModal(false)} title="Ajouter un cours" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Nom du cours (Français) *</label>
            <input
              type="text"
              placeholder="Ex: Français B1, Mathématiques..."
              value={courseForm.nameFr}
              onChange={e => setCourseForm(prev => ({ ...prev, nameFr: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Nom du cours (Arabe)</label>
            <input
              type="text"
              placeholder="Ex: الفرنسية B1..."
              value={courseForm.nameAr}
              onChange={e => setCourseForm(prev => ({ ...prev, nameAr: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-right"
              dir="rtl"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Description</label>
            <input
              type="text"
              placeholder="Description courte..."
              value={courseForm.descriptionFr}
              onChange={e => setCourseForm(prev => ({ ...prev, descriptionFr: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Frais mensuel par défaut (DA)</label>
            <input
              type="number"
              value={courseForm.defaultPrice}
              onChange={e => setCourseForm(prev => ({ ...prev, defaultPrice: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setCourseModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Annuler</button>
            <button onClick={handleAddCourse} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Enregistrer</button>
          </div>
        </div>
      </Modal>

      {/* Add Group Modal */}
      <Modal open={groupModal} onClose={() => setGroupModal(false)} title="Ajouter un groupe" size="md">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Nom du groupe *</label>
            <input
              type="text"
              placeholder="Ex: Groupe A1 Matin"
              value={groupForm.name}
              onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Enseignant *</label>
            <select
              value={groupForm.teacherId}
              onChange={e => setGroupForm(f => ({ ...f, teacherId: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
            >
              <option value="">Sélectionner un enseignant</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Salle</label>
            <input
              type="text"
              placeholder="Ex: Salle 101, Labo..."
              value={groupForm.room}
              onChange={e => setGroupForm(f => ({ ...f, room: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Capacité max</label>
            <input
              type="number"
              value={groupForm.capacity}
              onChange={e => setGroupForm(f => ({ ...f, capacity: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Frais mensuel (DA)</label>
            <input
              type="number"
              value={groupForm.monthlyPrice}
              onChange={e => setGroupForm(f => ({ ...f, monthlyPrice: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Date de début</label>
            <input
              type="date"
              value={groupForm.startDate}
              onChange={e => setGroupForm(f => ({ ...f, startDate: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setGroupModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Annuler</button>
          <button onClick={handleAddGroup} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Enregistrer</button>
        </div>
      </Modal>

      {/* Add Schedule Slot Modal */}
      <Modal open={slotModal} onClose={() => setSlotModal(false)} title="Ajouter un créneau récurrent" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Jour de la semaine</label>
            <select
              value={slotForm.weekday}
              onChange={e => setSlotForm(s => ({ ...s, weekday: Number(e.target.value) }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
            >
              {WEEKDAYS.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Heure début</label>
              <input
                type="time"
                value={slotForm.startTime}
                onChange={e => setSlotForm(s => ({ ...s, startTime: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Heure fin</label>
              <input
                type="time"
                value={slotForm.endTime}
                onChange={e => setSlotForm(s => ({ ...s, endTime: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Salle (optionnel)</label>
            <input
              type="text"
              placeholder="Salle spécifique pour ce créneau..."
              value={slotForm.room}
              onChange={e => setSlotForm(s => ({ ...s, room: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setSlotModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Annuler</button>
            <button onClick={handleAddSlot} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Ajouter créneau</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
