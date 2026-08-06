import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, UserX, Filter } from 'lucide-react'
import type { PaginatedResult, Student } from '@shared/types/index'

const PAGE_SIZE = 20

export default function Students() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [result, setResult] = useState<PaginatedResult<Student> | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [loading, setLoading] = useState(true)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = async (p = 1, q = search, st = status) => {
    setLoading(true)
    try {
      const res = await window.schoolApp.students.list({ page: p, pageSize: PAGE_SIZE, search: q || undefined, status: st as 'active' | 'inactive' | 'archived' | 'all' })
      if (res.success && res.data) setResult(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(page) }, [page, status])

  const handleSearch = (v: string) => {
    setSearch(v)
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => { setPage(1); load(1, v, status) }, 350)
  }

  const total = result?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-50">
          <Search size={14} className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            placeholder={t('students.search')}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full ps-9 pe-3 py-2 border border-border rounded-lg text-sm bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
          />
        </div>

        {/* Status filter */}
        <div className="flex gap-1 border border-border rounded-lg p-1 bg-white">
          {(['active', 'inactive', 'archived', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); load(1, search, s) }}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                status === s ? 'bg-[#2563EB] text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {t(`students.${s}`)}
            </button>
          ))}
        </div>

        <button
          onClick={() => navigate('/students/new')}
          className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] transition-colors shrink-0"
        >
          <Plus size={15} />
          {t('students.add')}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && (!result?.items.length) && (
          <div className="text-center py-16 text-slate-400">
            <UserX size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">{t('students.noStudents')}</p>
            <p className="text-xs mt-1">{t('students.noStudentsDesc')}</p>
            <button
              onClick={() => navigate('/students/new')}
              className="mt-4 text-sm text-[#2563EB] hover:underline"
            >
              + {t('students.add')}
            </button>
          </div>
        )}

        {!loading && !!result?.items.length && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-slate-500 text-xs uppercase tracking-wide">
                <th className="text-start px-4 py-3 font-medium">{t('students.studentNumber')}</th>
                <th className="text-start px-4 py-3 font-medium">{t('students.lastNameAr')} / {t('students.firstNameAr')}</th>
                <th className="text-start px-4 py-3 font-medium hidden md:table-cell">{t('students.lastNameFr')}</th>
                <th className="text-start px-4 py-3 font-medium hidden sm:table-cell">{t('students.phone')}</th>
                <th className="text-start px-4 py-3 font-medium">{t('students.status')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {result.items.map((student) => (
                <tr
                  key={student.id}
                  onClick={() => navigate(`/students/${student.id}`)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{student.studentNumber}</td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-[#0F172A]">{student.lastNameAr} {student.firstNameAr}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{student.lastNameFr} {student.firstNameFr}</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{student.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                      student.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : student.status === 'inactive'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {t(`students.${student.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/students/${student.id}`) }}
                      className="text-xs text-[#2563EB] hover:underline"
                    >
                      {t('students.profile')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-slate-50">
            <p className="text-xs text-slate-500">
              {t('students.total')} <span className="font-semibold">{total}</span>
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs border border-border rounded-lg disabled:opacity-40 hover:bg-white transition-colors"
              >
                ‹
              </button>
              <span className="px-3 py-1.5 text-xs border border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] rounded-lg font-medium">
                {page}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs border border-border rounded-lg disabled:opacity-40 hover:bg-white transition-colors"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
