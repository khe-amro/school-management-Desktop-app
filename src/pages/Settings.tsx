import { useState, useEffect, useCallback } from 'react'
import {
  School, Settings as SettingsIcon, HardDrive, Shield, Save,
  FolderOpen, RotateCcw, Plus, Eye, EyeOff, User, History, Check, AlertTriangle
} from 'lucide-react'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'

const TABS = [
  { id: 'school', label: 'Profil scolaire', icon: School },
  { id: 'app', label: 'Application', icon: SettingsIcon },
  { id: 'admin', label: 'Profil Admin', icon: User },
  { id: 'backup', label: 'Sauvegarde', icon: HardDrive },
  { id: 'security', label: 'Sécurité & Logs', icon: Shield },
]

export default function Settings() {
  const [tab, setTab] = useState('school')
  const [loading, setLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // School settings
  const [school, setSchool] = useState({
    schoolNameFr: 'Edupilot DZ',
    schoolNameAr: 'إيدوبيلوت الجزائر',
    schoolNameEn: 'Edupilot DZ',
    phone: '+213 555 000 000',
    email: 'contact@edupilot.dz',
    address: 'Alger, Algérie',
    academicYear: '2025–2026',
    currency: 'DZD',
    defaultLanguage: 'fr' as 'ar' | 'fr' | 'en',
    backupDirectory: '',
    automaticBackupEnabled: true,
    backupsToRetain: 7,
  })

  // Admin profile
  const [adminProfile, setAdminProfile] = useState({
    id: 1,
    username: 'admin',
    fullName: 'Administrateur Principal',
    preferredLanguage: 'fr' as 'ar' | 'fr' | 'en',
    photoPath: null as string | null,
    photoUrl: null as string | null,
  })

  // Security / Password
  const [showOldPw, setShowOldPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [pwForm, setPwForm] = useState({ old: '', new: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Auto-lock
  const [autoLockMinutes, setAutoLockMinutes] = useState(0)

  // Backups
  const [backupsList, setBackupsList] = useState<any[]>([])
  const [backupConfirm, setBackupConfirm] = useState(false)
  const [restoreModal, setRestoreModal] = useState(false)
  const [restorePath, setRestorePath] = useState('')
  const [restorePassword, setRestorePassword] = useState('')

  // Audit logs
  const [auditLogsModal, setAuditLogsModal] = useState(false)
  const [auditLogs, setAuditLogs] = useState<any[]>([])

  const api = (window as any).schoolApp

  // Load all settings
  const loadSettings = useCallback(async () => {
    if (!api) return
    setLoading(true)
    try {
      const [sRes, aRes, bRes, lkRes] = await Promise.all([
        api.settings.get(),
        api.settings.getAdmin ? api.settings.getAdmin() : Promise.resolve({ success: false }),
        api.backups.list(),
        api.settings.getAutoLock ? api.settings.getAutoLock() : Promise.resolve({ success: false }),
      ])

      if (sRes.success && sRes.data) {
        setSchool(prev => ({ ...prev, ...sRes.data }))
      }

      if (aRes.success && aRes.data) {
        let photoUrl = null
        if (aRes.data.photoPath) {
          const pRes = await api.media.getImageUrl(aRes.data.photoPath)
          if (pRes.success) photoUrl = pRes.data.url
        }
        setAdminProfile({ ...aRes.data, photoUrl })
      }

      if (bRes.success && bRes.data) {
        setBackupsList(bRes.data)
      }

      if (lkRes.success && lkRes.data) {
        setAutoLockMinutes(lkRes.data.minutes || 0)
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Save school settings
  const handleSaveSchool = async () => {
    if (!api) return
    try {
      const res = await api.settings.update(school)
      if (res.success) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2500)
      } else {
        alert(res.error?.message || 'Erreur enregistrement')
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Save admin profile
  const handleSaveAdmin = async () => {
    if (!api) return
    try {
      const res = await api.settings.updateAdmin({
        fullName: adminProfile.fullName,
        preferredLanguage: adminProfile.preferredLanguage,
        photoPath: adminProfile.photoPath,
      })
      if (res.success) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2500)
      } else {
        alert(res.error?.message || 'Erreur mise à jour admin')
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Choose admin photo
  const handleSelectAdminPhoto = async () => {
    if (!api) return
    try {
      const res = await api.media.selectImage('admin', adminProfile.id)
      if (res.success && res.path) {
        setAdminProfile(p => ({ ...p, photoPath: res.path }))
        const pRes = await api.media.getImageUrl(res.path)
        if (pRes.success) setAdminProfile(p => ({ ...p, photoUrl: pRes.data.url }))
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Change password
  const handleChangePassword = async () => {
    if (!api) return
    if (!pwForm.old || !pwForm.new || !pwForm.confirm) {
      setPwMsg({ type: 'error', text: 'Veuillez remplir tous les champs du mot de passe.' })
      return
    }
    if (pwForm.new !== pwForm.confirm) {
      setPwMsg({ type: 'error', text: 'Les nouveaux mots de passe ne correspondent pas.' })
      return
    }
    try {
      const res = await api.auth.changePassword({
        currentPassword: pwForm.old,
        newPassword: pwForm.new,
        confirmPassword: pwForm.confirm,
      })
      if (res.success) {
        setPwMsg({ type: 'success', text: 'Mot de passe modifié avec succès !' })
        setPwForm({ old: '', new: '', confirm: '' })
      } else {
        setPwMsg({ type: 'error', text: res.error?.message || 'Mot de passe actuel incorrect.' })
      }
    } catch (err) {
      setPwMsg({ type: 'error', text: 'Erreur lors du changement de mot de passe.' })
    }
  }

  // Auto-lock change
  const handleAutoLockChange = async (minutes: number) => {
    setAutoLockMinutes(minutes)
    if (!api) return
    try {
      await api.settings.setAutoLock(minutes)
    } catch (err) {
      console.error(err)
    }
  }

  // Create backup
  const handleCreateBackup = async () => {
    if (!api) return
    try {
      const res = await api.backups.create()
      if (res.success) {
        alert('Sauvegarde créée avec succès !')
        loadSettings()
      } else {
        alert(res.error?.message || 'Erreur lors de la création de la sauvegarde')
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Choose backup destination directory
  const handleChooseBackupDir = async () => {
    if (!api) return
    try {
      const res = await api.app.showSaveDialog()
      if (res.success && res.path) {
        setSchool(s => ({ ...s, backupDirectory: res.path }))
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Restore backup
  const handleRestoreBackup = async () => {
    if (!api || !restorePath || !restorePassword) {
      alert('Veuillez sélectionner une sauvegarde et entrer votre mot de passe administrateur.')
      return
    }
    try {
      const res = await api.backups.restore({
        backupPath: restorePath,
        confirmPassword: restorePassword,
      })
      if (res.success) {
        alert('Base de données restaurée avec succès ! L\'application va recharger.')
        window.location.reload()
      } else {
        alert(res.error?.message || 'Mot de passe incorrect ou sauvegarde invalide')
      }
    } catch (err) {
      alert('Erreur restauration')
    }
  }

  // Load audit logs
  const handleOpenAuditLogs = async () => {
    setAuditLogsModal(true)
    if (!api) return
    try {
      const res = await api.settings.listAuditLogs({ limit: 100 })
      if (res.success && res.data) {
        setAuditLogs(res.data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const InputRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
      <label className="text-sm text-slate-700 w-56 shrink-0">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  )

  return (
    <div className="flex gap-5">
      {/* Sidebar navigation */}
      <div className="w-48 shrink-0">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-medium transition-colors border-b border-slate-50 last:border-0 ${tab === t.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1">
        {/* Tab 1: School Profile */}
        {tab === 'school' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">Profil scolaire de l'établissement</h2>
              {saveSuccess && (
                <span className="flex items-center gap-1 text-xs text-green-600 font-semibold bg-green-50 px-2.5 py-1 rounded-md border border-green-200">
                  <Check size={12} /> Enregistré !
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-50">
              <InputRow label="Nom de l'établissement (Français)">
                <input
                  type="text"
                  value={school.schoolNameFr}
                  onChange={e => setSchool(s => ({ ...s, schoolNameFr: e.target.value }))}
                  className="w-full max-w-sm px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                />
              </InputRow>
              <InputRow label="Nom de l'établissement (Arabe)">
                <input
                  type="text"
                  value={school.schoolNameAr}
                  onChange={e => setSchool(s => ({ ...s, schoolNameAr: e.target.value }))}
                  className="w-full max-w-sm px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white text-right"
                  dir="rtl"
                />
              </InputRow>
              <InputRow label="Téléphone">
                <input
                  type="tel"
                  value={school.phone || ''}
                  onChange={e => setSchool(s => ({ ...s, phone: e.target.value }))}
                  className="w-full max-w-sm px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
                />
              </InputRow>
              <InputRow label="Email de contact">
                <input
                  type="email"
                  value={school.email || ''}
                  onChange={e => setSchool(s => ({ ...s, email: e.target.value }))}
                  className="w-full max-w-sm px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                />
              </InputRow>
              <InputRow label="Adresse physique">
                <input
                  type="text"
                  value={school.address || ''}
                  onChange={e => setSchool(s => ({ ...s, address: e.target.value }))}
                  className="w-full max-w-sm px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                />
              </InputRow>
              <InputRow label="Année académique">
                <input
                  type="text"
                  value={school.academicYear}
                  onChange={e => setSchool(s => ({ ...s, academicYear: e.target.value }))}
                  className="w-full max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
                />
              </InputRow>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSaveSchool}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
              >
                <Save size={14} /> Enregistrer modifications
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: App Settings */}
        {tab === 'app' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Paramètres de l'application</h2>
            <div className="divide-y divide-slate-50">
              <InputRow label="Langue par défaut">
                <select
                  value={school.defaultLanguage}
                  onChange={e => setSchool(s => ({ ...s, defaultLanguage: e.target.value as any }))}
                  className="w-full max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                >
                  <option value="fr">Français</option>
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </InputRow>
              <InputRow label="Devise de facturation">
                <div className="text-sm text-slate-700 py-1 font-semibold">Dinar algérien (DZD / DA)</div>
              </InputRow>
              <InputRow label="Sauvegarde automatique">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={school.automaticBackupEnabled}
                    onChange={e => setSchool(s => ({ ...s, automaticBackupEnabled: e.target.checked }))}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <span className="text-sm text-slate-700 font-medium">Activer la sauvegarde automatique quotidienne</span>
                </label>
              </InputRow>
              <InputRow label="Nombre de sauvegardes à conserver">
                <input
                  type="number"
                  value={school.backupsToRetain}
                  onChange={e => setSchool(s => ({ ...s, backupsToRetain: Number(e.target.value) || 7 }))}
                  className="w-32 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white font-mono"
                />
              </InputRow>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSaveSchool}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
              >
                <Save size={14} /> Enregistrer
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Admin Profile */}
        {tab === 'admin' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Profil de l'administrateur</h2>
            <div className="divide-y divide-slate-50">
              <InputRow label="Photo de profil">
                <div className="flex items-center gap-4">
                  {adminProfile.photoUrl ? (
                    <img src={adminProfile.photoUrl} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-slate-200" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">
                      {adminProfile.fullName.charAt(0)}
                    </div>
                  )}
                  <button
                    onClick={handleSelectAdminPhoto}
                    className="px-3 py-1.5 text-xs text-blue-600 font-semibold bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                  >
                    Changer photo
                  </button>
                </div>
              </InputRow>
              <InputRow label="Nom complet">
                <input
                  type="text"
                  value={adminProfile.fullName}
                  onChange={e => setAdminProfile(p => ({ ...p, fullName: e.target.value }))}
                  className="w-full max-w-sm px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                />
              </InputRow>
              <InputRow label="Identifiant (Login)">
                <div className="font-mono text-sm text-slate-600 py-1">{adminProfile.username}</div>
              </InputRow>
              <InputRow label="Langue préférée">
                <select
                  value={adminProfile.preferredLanguage}
                  onChange={e => setAdminProfile(p => ({ ...p, preferredLanguage: e.target.value as any }))}
                  className="w-full max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                >
                  <option value="fr">Français</option>
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </InputRow>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSaveAdmin}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
              >
                <Save size={14} /> Mettre à jour profil
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Backup & Restore */}
        {tab === 'backup' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-4">Sauvegarde & Restauration</h2>
              <div className="divide-y divide-slate-50">
                <InputRow label="Dossier de destination">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={school.backupDirectory || 'Dossier par défaut (AppData/backups)'}
                      readOnly
                      className="flex-1 max-w-sm px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 font-mono text-slate-600"
                    />
                    <button
                      onClick={handleChooseBackupDir}
                      className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
                      title="Choisir dossier"
                    >
                      <FolderOpen size={15} />
                    </button>
                  </div>
                </InputRow>
              </div>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={handleCreateBackup}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                >
                  <Plus size={14} /> Créer une sauvegarde
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-800">Sauvegardes disponibles ({backupsList.length})</h3>
              </div>
              {backupsList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">Aucune sauvegarde trouvée</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                      <th className="px-5 py-2.5 text-left">Fichier / Date</th>
                      <th className="px-5 py-2.5 text-left">Taille</th>
                      <th className="px-5 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {backupsList.map((b, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-mono text-xs text-slate-700">{b.filename || b.path}</td>
                        <td className="px-5 py-3 text-xs text-slate-600 font-mono">{(b.sizeBytes / (1024 * 1024)).toFixed(2)} MB</td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => {
                              setRestorePath(b.path)
                              setRestoreModal(true)
                            }}
                            className="text-xs text-amber-700 font-semibold hover:underline"
                          >
                            Restaurer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Security, Auto-lock & Audit Logs */}
        {tab === 'security' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-4">Changer le mot de passe administrateur</h2>
              {pwMsg && (
                <div className={`p-3 mb-4 rounded-lg text-xs font-semibold ${pwMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                  {pwMsg.text}
                </div>
              )}
              <div className="space-y-4 max-w-sm">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Mot de passe actuel</label>
                  <div className="relative">
                    <input
                      type={showOldPw ? 'text' : 'password'}
                      value={pwForm.old}
                      onChange={e => setPwForm(p => ({ ...p, old: e.target.value }))}
                      className="w-full px-3 py-2 pr-10 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showOldPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Nouveau mot de passe</label>
                  <div className="relative">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      value={pwForm.new}
                      onChange={e => setPwForm(p => ({ ...p, new: e.target.value }))}
                      className="w-full px-3 py-2 pr-10 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Confirmer le nouveau mot de passe</label>
                  <input
                    type="password"
                    value={pwForm.confirm}
                    onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                  />
                </div>
                <button
                  onClick={handleChangePassword}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                >
                  <Save size={14} /> Mettre à jour le mot de passe
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-4">Paramètres de sécurité & Journal</h2>
              <div className="divide-y divide-slate-50">
                <InputRow label="Verrouillage automatique (inactivité)">
                  <select
                    value={autoLockMinutes}
                    onChange={e => handleAutoLockChange(Number(e.target.value))}
                    className="w-full max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                  >
                    <option value={0}>Désactivé</option>
                    <option value={5}>Après 5 minutes d'inactivité</option>
                    <option value={10}>Après 10 minutes d'inactivité</option>
                    <option value={15}>Après 15 minutes d'inactivité</option>
                    <option value={30}>Après 30 minutes d'inactivité</option>
                    <option value={60}>Après 1 heure d'inactivité</option>
                  </select>
                </InputRow>
                <InputRow label="Journal d'audit des actions">
                  <button
                    onClick={handleOpenAuditLogs}
                    className="text-sm text-blue-600 hover:text-blue-800 border border-blue-200 bg-blue-50 rounded-lg px-3 py-1.5 transition-colors font-medium flex items-center gap-1.5"
                  >
                    <History size={14} /> Consulter l'historique d'audit
                  </button>
                </InputRow>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Restore confirmation modal */}
      <Modal open={restoreModal} onClose={() => setRestoreModal(false)} title="Restaurer la base de données" size="sm">
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <span>Attention : Cette opération remplacera l'intégralité des données actuelles par la sauvegarde choisie.</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Mot de passe de confirmation administrateur</label>
            <input
              type="password"
              placeholder="Votre mot de passe actuel..."
              value={restorePassword}
              onChange={e => setRestorePassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setRestoreModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Annuler</button>
            <button onClick={handleRestoreBackup} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg">Confirmer restauration</button>
          </div>
        </div>
      </Modal>

      {/* Audit logs viewer modal */}
      <Modal open={auditLogsModal} onClose={() => setAuditLogsModal(false)} title="Journal d'audit administratif" size="lg">
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {auditLogs.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">Aucun événement d'audit enregistré</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 text-slate-500 font-semibold">
                  <th className="p-2 text-left">Date / Heure</th>
                  <th className="p-2 text-left">Action</th>
                  <th className="p-2 text-left">Entité</th>
                  <th className="p-2 text-left">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {auditLogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2 text-slate-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString('fr-DZ')}</td>
                    <td className="p-2 font-semibold text-slate-800">{log.action}</td>
                    <td className="p-2 text-slate-600">{log.entityType ? `${log.entityType} #${log.entityId}` : '—'}</td>
                    <td className="p-2 text-slate-500 truncate max-w-xs">{log.details ? JSON.stringify(log.details) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>
    </div>
  )
}
