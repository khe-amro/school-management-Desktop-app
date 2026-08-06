import { useState } from 'react'
import { Plus, ChevronDown, ChevronRight, Users, BookOpen } from 'lucide-react'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import { courses as initialCourses, groups as initialGroups, teachers } from '../data/mockData'
import type { Course, Group } from '../types'

function CapacityBar({ enrolled, capacity }: { enrolled: number; capacity: number }) {
  const pct = Math.round((enrolled / capacity) * 100)
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
  const [courses, setCourses] = useState(initialCourses)
  const [groups, setGroups] = useState(initialGroups)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [courseModal, setCourseModal] = useState(false)
  const [groupModal, setGroupModal] = useState(false)
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [courseForm, setCourseForm] = useState({ name: '', description: '', defaultMonthlyFee: '' })
  const [groupForm, setGroupForm] = useState({ name: '', teacherId: '', room: '', schedule: '', capacity: '', monthlyFee: '', startDate: '', endDate: '' })

  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const getCourseGroups = (courseId: string) => groups.filter(g => g.courseId === courseId)

  const addCourse = () => {
    setCourses(prev => [...prev, { id: `c${Date.now()}`, name: courseForm.name, description: courseForm.description, defaultMonthlyFee: Number(courseForm.defaultMonthlyFee), status: 'active' }])
    setCourseModal(false)
    setCourseForm({ name: '', description: '', defaultMonthlyFee: '' })
  }

  const addGroup = () => {
    setGroups(prev => [...prev, {
      id: `g${Date.now()}`,
      courseId: selectedCourseId,
      name: groupForm.name,
      teacherId: groupForm.teacherId,
      room: groupForm.room,
      schedule: groupForm.schedule,
      capacity: Number(groupForm.capacity) || 15,
      enrolledCount: 0,
      monthlyFee: Number(groupForm.monthlyFee) || 0,
      startDate: groupForm.startDate,
      endDate: groupForm.endDate,
    }])
    setGroupModal(false)
  }

  const scheduleView = [
    { day: 'Lun', slots: groups.filter(g => g.schedule.includes('Lun')) },
    { day: 'Mar', slots: groups.filter(g => g.schedule.includes('Mar')) },
    { day: 'Mer', slots: groups.filter(g => g.schedule.includes('Mer')) },
    { day: 'Jeu', slots: groups.filter(g => g.schedule.includes('Jeu')) },
    { day: 'Ven', slots: groups.filter(g => g.schedule.includes('Ven')) },
    { day: 'Sam', slots: groups.filter(g => g.schedule.includes('Sam')) },
    { day: 'Dim', slots: groups.filter(g => g.schedule.includes('Dim')) },
  ]

  return (
    <div className="grid grid-cols-3 gap-5">
      {/* Course list */}
      <div className="col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Cours ({courses.length})</h2>
          <button onClick={() => setCourseModal(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
            <Plus size={14} /> Ajouter un cours
          </button>
        </div>

        {courses.map(course => {
          const courseGroups = getCourseGroups(course.id)
          const isOpen = expanded.has(course.id)
          return (
            <div key={course.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => toggleExpand(course.id)}>
                <button className="text-slate-400 shrink-0">{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-slate-900">{course.name}</h3>
                    <Badge variant={course.status}>{course.status}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{course.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-slate-800">{course.defaultMonthlyFee.toLocaleString('fr-DZ')} DA/mois</p>
                  <p className="text-xs text-slate-400">{courseGroups.length} groupe{courseGroups.length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-slate-100">
                  <div className="px-5 py-3 flex items-center justify-between bg-slate-50">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Groupes</span>
                    <button
                      onClick={() => { setSelectedCourseId(course.id); setGroupModal(true) }}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                    >
                      <Plus size={11} /> Ajouter groupe
                    </button>
                  </div>
                  {courseGroups.length === 0 ? (
                    <div className="px-5 py-4 text-xs text-slate-400">Aucun groupe pour ce cours</div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {courseGroups.map(g => {
                        const teacher = teachers.find(t => t.id === g.teacherId)
                        return (
                          <div key={g.id} className="px-5 py-3 grid grid-cols-4 gap-4 items-center">
                            <div>
                              <p className="text-sm font-medium text-slate-800">{g.name}</p>
                              <p className="text-xs text-slate-400">{g.room}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600">{teacher ? `${teacher.firstName} ${teacher.lastName}` : '—'}</p>
                              <p className="text-xs text-slate-400">{g.schedule}</p>
                            </div>
                            <CapacityBar enrolled={g.enrolledCount} capacity={g.capacity} />
                            <p className="text-xs text-right font-semibold text-slate-700">{g.monthlyFee.toLocaleString('fr-DZ')} DA</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Weekly schedule */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">Planning hebdomadaire</h2>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {scheduleView.map(({ day, slots }) => (
            <div key={day} className="border-b border-slate-50 last:border-0">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-600">{day}</span>
              </div>
              {slots.length === 0 ? (
                <div className="px-4 py-2 text-xs text-slate-300">Aucun cours</div>
              ) : (
                slots.map(g => {
                  const course = courses.find(c => c.id === g.courseId)
                  const teacher = teachers.find(t => t.id === g.teacherId)
                  return (
                    <div key={g.id} className="px-4 py-2 flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-slate-800">{g.name}</p>
                        <p className="text-[11px] text-slate-400">{g.schedule.split(' ').slice(-1)} · {teacher?.firstName}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add course modal */}
      <Modal open={courseModal} onClose={() => setCourseModal(false)} title="Ajouter un cours" size="sm">
        <div className="space-y-4">
          {[
            { label: 'Nom du cours', field: 'name', placeholder: 'English A1' },
            { label: 'Description', field: 'description', placeholder: 'Description courte...' },
            { label: 'Frais mensuel par défaut (DA)', field: 'defaultMonthlyFee', placeholder: '2500' },
          ].map(f => (
            <div key={f.field}>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">{f.label}</label>
              <input type="text" placeholder={f.placeholder} value={courseForm[f.field as keyof typeof courseForm]}
                onChange={e => setCourseForm(prev => ({ ...prev, [f.field]: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setCourseModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Annuler</button>
            <button onClick={addCourse} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">Enregistrer</button>
          </div>
        </div>
      </Modal>

      {/* Add group modal */}
      <Modal open={groupModal} onClose={() => setGroupModal(false)} title="Ajouter un groupe" size="md">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Nom du groupe', field: 'name', placeholder: 'A1 Matin' },
            { label: 'Salle', field: 'room', placeholder: 'Room 101' },
            { label: 'Horaire', field: 'schedule', placeholder: 'Lun/Mer 08:00–10:00' },
            { label: 'Capacité', field: 'capacity', placeholder: '15' },
            { label: 'Frais mensuel (DA)', field: 'monthlyFee', placeholder: '2500' },
            { label: 'Date début', field: 'startDate', placeholder: '' },
            { label: 'Date fin', field: 'endDate', placeholder: '' },
          ].map(f => (
            <div key={f.field}>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">{f.label}</label>
              <input type={f.field.includes('Date') ? 'date' : 'text'} placeholder={f.placeholder}
                value={groupForm[f.field as keyof typeof groupForm]}
                onChange={e => setGroupForm(prev => ({ ...prev, [f.field]: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Enseignant</label>
            <select value={groupForm.teacherId} onChange={e => setGroupForm(f => ({ ...f, teacherId: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white">
              <option value="">Sélectionner</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setGroupModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Annuler</button>
          <button onClick={addGroup} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">Enregistrer</button>
        </div>
      </Modal>
    </div>
  )
}
