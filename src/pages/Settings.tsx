import { useState } from 'react'
import { School, Settings as SettingsIcon, HardDrive, Shield, Save, FolderOpen, RotateCcw, Plus, Eye, EyeOff } from 'lucide-react'
import ConfirmDialog from '../components/ui/ConfirmDialog'

const TABS = [
  { id: 'school', label: 'Profil scolaire', icon: School },
  { id: 'app', label: 'Application', icon: SettingsIcon },
  { id: 'backup', label: 'Sauvegarde', icon: HardDrive },
  { id: 'security', label: 'Sécurité', icon: Shield },
]

const recentBackups = [
  { date: '2026-08-04 02:00', size: '4.2 MB', type: 'Auto' },
  { date: '2026-08-03 02:00', size: '4.1 MB', type: 'Auto' },
  { date: '2026-08-02 14:35', size: '4.0 MB', type: 'Manuel' },
  { date: '2026-08-01 02:00', size: '3.9 MB', type: 'Auto' },
]

export default function Settings() {
  const [tab, setTab] = useState('school')
  const [school, setSchool] = useState({ name: 'Edupilot DZ', phone: '+213 555 000 000', email: 'contact@edupilot.dz', address: 'Alger, Algérie', academicYear: '2025–2026' })
  const [app, setApp] = useState({ language: 'fr', dateFormat: 'DD/MM/YYYY', currency: 'DZD', lateThreshold: '10', receiptPrefix: 'RCP', studentPrefix: 'STD' })
  const [backup, setBackup] = useState({ location: 'C:\\EduPilot\\Backups', autoBackup: true, retainCount: '7' })
  const [showOldPw, setShowOldPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [backupConfirm, setBackupConfirm] = useState(false)
  const [restoreConfirm, setRestoreConfirm] = useState(false)
  const [pwForm, setPwForm] = useState({ old: '', new: '', confirm: '' })

  const InputRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
      <label className="text-sm text-slate-700 w-56 shrink-0">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  )

  const TextInput = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white" />
  )

  return (
    <div className="flex gap-5">
      {/* Sidebar */}
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

      {/* Content */}
      <div className="flex-1">
        {tab === 'school' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Profil scolaire</h2>
            <div className="divide-y divide-slate-50">
              <InputRow label="Nom de l'établissement"><TextInput value={school.name} onChange={v => setSchool(s => ({ ...s, name: v }))} /></InputRow>
              <InputRow label="Téléphone"><TextInput value={school.phone} onChange={v => setSchool(s => ({ ...s, phone: v }))} /></InputRow>
              <InputRow label="Email"><TextInput value={school.email} onChange={v => setSchool(s => ({ ...s, email: v }))} /></InputRow>
              <InputRow label="Adresse"><TextInput value={school.address} onChange={v => setSchool(s => ({ ...s, address: v }))} /></InputRow>
              <InputRow label="Année académique"><TextInput value={school.academicYear} onChange={v => setSchool(s => ({ ...s, academicYear: v }))} /></InputRow>
              <InputRow label="Logo">
                <button className="text-sm text-blue-600 hover:text-blue-800 border border-blue-200 bg-blue-50 rounded-lg px-3 py-1.5 transition-colors">Changer le logo</button>
              </InputRow>
            </div>
            <div className="mt-5 flex justify-end">
              <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                <Save size={14} /> Enregistrer
              </button>
            </div>
          </div>
        )}

        {tab === 'app' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Paramètres application</h2>
            <div className="divide-y divide-slate-50">
              <InputRow label="Langue">
                <select value={app.language} onChange={e => setApp(a => ({ ...a, language: e.target.value }))}
                  className="w-full max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white">
                  <option value="fr">Français</option>
                  <option value="ar">العربية</option>
                </select>
              </InputRow>
              <InputRow label="Format de date">
                <select value={app.dateFormat} onChange={e => setApp(a => ({ ...a, dateFormat: e.target.value }))}
                  className="w-full max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white">
                  <option>DD/MM/YYYY</option>
                  <option>YYYY-MM-DD</option>
                  <option>MM/DD/YYYY</option>
                </select>
              </InputRow>
              <InputRow label="Devise"><div className="text-sm text-slate-500 py-2">Dinar algérien (DA / DZD)</div></InputRow>
              <InputRow label="Seuil de retard (minutes)"><TextInput value={app.lateThreshold} onChange={v => setApp(a => ({ ...a, lateThreshold: v }))} /></InputRow>
              <InputRow label="Préfixe reçu"><TextInput value={app.receiptPrefix} onChange={v => setApp(a => ({ ...a, receiptPrefix: v }))} placeholder="RCP" /></InputRow>
              <InputRow label="Préfixe N° étudiant"><TextInput value={app.studentPrefix} onChange={v => setApp(a => ({ ...a, studentPrefix: v }))} placeholder="STD" /></InputRow>
            </div>
            <div className="mt-5 flex justify-end">
              <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                <Save size={14} /> Enregistrer
              </button>
            </div>
          </div>
        )}

        {tab === 'backup' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-4">Sauvegarde & Restauration</h2>
              <div className="divide-y divide-slate-50">
                <InputRow label="Dernière sauvegarde">
                  <span className="text-sm text-green-700 font-medium">Aujourd'hui à 02:00 · 4.2 MB</span>
                </InputRow>
                <InputRow label="Dossier de sauvegarde">
                  <div className="flex items-center gap-2">
                    <input type="text" value={backup.location} onChange={e => setBackup(b => ({ ...b, location: e.target.value }))}
                      className="flex-1 max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono text-xs" />
                    <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"><FolderOpen size={15} /></button>
                  </div>
                </InputRow>
                <InputRow label="Sauvegarde automatique quotidienne">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className={`relative w-10 h-5 rounded-full transition-colors ${backup.autoBackup ? 'bg-blue-600' : 'bg-slate-200'}`}
                      onClick={() => setBackup(b => ({ ...b, autoBackup: !b.autoBackup }))}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${backup.autoBackup ? 'translate-x-5' : ''}`} />
                    </div>
                    <span className="text-sm text-slate-600">{backup.autoBackup ? 'Activée' : 'Désactivée'}</span>
                  </label>
                </InputRow>
                <InputRow label="Sauvegardes à conserver"><TextInput value={backup.retainCount} onChange={v => setBackup(b => ({ ...b, retainCount: v }))} /></InputRow>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setBackupConfirm(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                  <Plus size={14} /> Créer une sauvegarde
                </button>
                <button onClick={() => setRestoreConfirm(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors">
                  <RotateCcw size={14} /> Restaurer
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-800">Sauvegardes récentes</h3>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50"><th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Date</th><th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Taille</th><th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Type</th><th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Action</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {recentBackups.map((b, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-xs text-slate-700">{b.date}</td>
                      <td className="px-5 py-3 text-slate-600">{b.size}</td>
                      <td className="px-5 py-3"><span className={`px-2 py-0.5 text-xs rounded-full border font-medium ${b.type === 'Auto' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{b.type}</span></td>
                      <td className="px-5 py-3"><button className="text-xs text-blue-600 hover:text-blue-800">Restaurer</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'security' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-4">Changer le mot de passe</h2>
              <div className="space-y-4 max-w-sm">
                {[
                  { label: 'Mot de passe actuel', field: 'old' as const, show: showOldPw, toggle: () => setShowOldPw(v => !v) },
                  { label: 'Nouveau mot de passe', field: 'new' as const, show: showNewPw, toggle: () => setShowNewPw(v => !v) },
                  { label: 'Confirmer le nouveau', field: 'confirm' as const, show: showNewPw, toggle: () => {} },
                ].map(f => (
                  <div key={f.field}>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">{f.label}</label>
                    <div className="relative">
                      <input type={f.show ? 'text' : 'password'} value={pwForm[f.field]}
                        onChange={e => setPwForm(p => ({ ...p, [f.field]: e.target.value }))}
                        className="w-full px-3 py-2 pr-10 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                      {f.toggle !== (() => {}) && (
                        <button type="button" onClick={f.toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {f.show ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                  <Save size={14} /> Mettre à jour
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-4">Paramètres de sécurité</h2>
              <div className="divide-y divide-slate-50">
                <InputRow label="Verrouillage automatique">
                  <select className="w-full max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white">
                    <option>Désactivé</option>
                    <option>Après 15 minutes</option>
                    <option>Après 30 minutes</option>
                    <option>Après 1 heure</option>
                  </select>
                </InputRow>
                <InputRow label="Journal des actions">
                  <button className="text-sm text-blue-600 hover:text-blue-800 border border-blue-200 bg-blue-50 rounded-lg px-3 py-1.5 transition-colors">Consulter le journal</button>
                </InputRow>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog open={backupConfirm} onClose={() => setBackupConfirm(false)} onConfirm={() => {}} title="Créer une sauvegarde" message="Une nouvelle sauvegarde sera créée dans le dossier configuré. Continuer?" confirmLabel="Créer" />
      <ConfirmDialog open={restoreConfirm} onClose={() => setRestoreConfirm(false)} onConfirm={() => {}} title="Restaurer une sauvegarde" message="La restauration remplacera toutes les données actuelles. Cette action est irréversible. Continuer?" confirmLabel="Restaurer" danger />
    </div>
  )
}
