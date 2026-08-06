import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Save, Printer, AlertTriangle } from 'lucide-react'
import { courses, groups, students } from '../data/mockData'
import ConfirmDialog from '../components/ui/ConfirmDialog'

function generateToken() {
  const id = Math.floor(Math.random() * 90000) + 10000
  return `STD-2026-${id.toString().padStart(5, '0')}`
}

function QRPlaceholder({ token }: { token: string }) {
  // Simple visual QR placeholder using CSS grid pattern
  const cells = Array.from({ length: 121 }, (_, i) => {
    const row = Math.floor(i / 11)
    const col = i % 11
    const isCorner = (row < 3 && col < 3) || (row < 3 && col > 7) || (row > 7 && col < 3)
    const isDark = isCorner || (Math.abs(token.charCodeAt(i % token.length) + row + col) % 3 === 0)
    return isDark
  })
  return (
    <div className="grid grid-cols-11 w-20 h-20 bg-white border border-slate-200 rounded p-1">
      {cells.map((dark, i) => (
        <div key={i} className={`${dark ? 'bg-slate-900' : 'bg-white'}`} />
      ))}
    </div>
  )
}

export default function StudentForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id && id !== 'new')
  const existing = isEdit ? students.find(s => s.id === id) : null

  const [token, setToken] = useState(existing?.token ?? generateToken())
  const [dirty, setDirty] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  const [form, setForm] = useState({
    firstName: existing?.firstName ?? '',
    lastName: existing?.lastName ?? '',
    dateOfBirth: existing?.dateOfBirth ?? '',
    gender: existing?.gender ?? 'male',
    phone: existing?.phone ?? '',
    address: existing?.address ?? '',
    guardianName: existing?.guardianName ?? '',
    guardianRelationship: existing?.guardianRelationship ?? 'Père',
    guardianPhone: existing?.guardianPhone ?? '',
    guardianPhone2: existing?.guardianPhone2 ?? '',
    courseId: existing?.courseId ?? '',
    groupId: existing?.groupId ?? '',
    registrationDate: existing?.registrationDate ?? new Date().toISOString().split('T')[0],
    monthlyFee: existing?.monthlyFee?.toString() ?? '',
    status: existing?.status ?? 'active',
  })

  const [errors, setErrors] = useState<Partial<typeof form>>({})

  const update = (field: keyof typeof form, value: string) => {
    setForm(f => ({ ...f, [field]: value }))
    setDirty(true)
    setErrors(e => ({ ...e, [field]: '' }))
  }

  const validate = () => {
    const e: Partial<typeof form> = {}
    if (!form.firstName) e.firstName = 'Prénom requis'
    if (!form.lastName) e.lastName = 'Nom requis'
    if (!form.guardianName) e.guardianName = 'Nom du tuteur requis'
    if (!form.guardianPhone) e.guardianPhone = 'Téléphone du tuteur requis'
    if (!form.courseId) e.courseId = 'Cours requis'
    if (!form.groupId) e.groupId = 'Groupe requis'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    navigate('/students')
  }

  const handleBack = () => {
    if (dirty) setShowLeaveConfirm(true)
    else navigate('/students')
  }

  const availableGroups = groups.filter(g => !form.courseId || g.courseId === form.courseId)

  const Field = ({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )

  const Input = ({ field, type = 'text', placeholder }: { field: keyof typeof form; type?: string; placeholder?: string }) => (
    <input
      type={type}
      value={form[field]}
      onChange={e => update(field, e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition-all bg-white ${errors[field] ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'}`}
    />
  )

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={handleBack} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"><ArrowLeft size={18} /></button>
        <h2 className="text-lg font-semibold text-slate-900">{isEdit ? 'Modifier l\'étudiant' : 'Ajouter un étudiant'}</h2>
        {dirty && (
          <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            <AlertTriangle size={11} /> Modifications non enregistrées
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Personal info */}
        <div className="col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-100">Informations personnelles</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Prénom *" error={errors.firstName}><Input field="firstName" placeholder="Meriem" /></Field>
              <Field label="Nom *" error={errors.lastName}><Input field="lastName" placeholder="Benhamouda" /></Field>
              <Field label="Date de naissance"><Input field="dateOfBirth" type="date" /></Field>
              <Field label="Genre">
                <select value={form.gender} onChange={e => update('gender', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white">
                  <option value="male">Masculin</option>
                  <option value="female">Féminin</option>
                </select>
              </Field>
              <Field label="Téléphone"><Input field="phone" type="tel" placeholder="0555 000 000" /></Field>
              <Field label="Adresse"><Input field="address" placeholder="Rue, Ville" /></Field>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-100">Informations du tuteur</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nom du tuteur *" error={errors.guardianName}><Input field="guardianName" placeholder="Mohamed Benhamouda" /></Field>
              <Field label="Lien de parenté">
                <select value={form.guardianRelationship} onChange={e => update('guardianRelationship', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white">
                  <option>Père</option><option>Mère</option><option>Frère</option><option>Sœur</option><option>Oncle</option><option>Autre</option>
                </select>
              </Field>
              <Field label="Téléphone principal *" error={errors.guardianPhone}><Input field="guardianPhone" type="tel" placeholder="0661 000 000" /></Field>
              <Field label="Téléphone secondaire"><Input field="guardianPhone2" type="tel" placeholder="0770 000 000" /></Field>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-100">Informations académiques</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cours *" error={errors.courseId}>
                <select value={form.courseId} onChange={e => { update('courseId', e.target.value); update('groupId', '') }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white">
                  <option value="">Sélectionner un cours</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Groupe *" error={errors.groupId}>
                <select value={form.groupId} onChange={e => update('groupId', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white">
                  <option value="">Sélectionner un groupe</option>
                  {availableGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </Field>
              <Field label="Date d'inscription"><Input field="registrationDate" type="date" /></Field>
              <Field label="Frais mensuel (DA)"><Input field="monthlyFee" type="number" placeholder="2500" /></Field>
              <Field label="Statut">
                <select value={form.status} onChange={e => update('status', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white">
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </Field>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-100">Photo étudiant</h3>
            <div className="flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                Cliquer pour télécharger
              </div>
              <p className="text-xs text-slate-400">JPG, PNG · Max 2MB</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 pb-3 border-b border-slate-100">Carte QR</h3>
            <div className="flex flex-col items-center gap-3">
              <QRPlaceholder token={token} />
              <p className="text-xs font-mono text-slate-600 text-center">{token}</p>
              <p className="text-xs text-slate-400 text-center">Le QR contient uniquement un identifiant sécurisé — aucune donnée personnelle.</p>
              <button onClick={() => { setToken(generateToken()); setDirty(true) }}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors">
                <RefreshCw size={12} /> Regénérer le token
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-2">
            <button onClick={handleSave} className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
              <Save size={15} /> Enregistrer
            </button>
            <button onClick={handleSave} className="flex items-center justify-center gap-2 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-lg transition-colors text-sm">
              <Printer size={15} /> Enregistrer & Imprimer carte
            </button>
            <button onClick={handleBack} className="w-full text-slate-500 hover:text-slate-700 py-2 text-sm transition-colors">Annuler</button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={() => navigate('/students')}
        title="Modifications non enregistrées"
        message="Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter sans sauvegarder?"
        confirmLabel="Quitter sans sauvegarder"
        danger
      />
    </div>
  )
}
