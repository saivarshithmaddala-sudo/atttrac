'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, subMonths, addMonths } from 'date-fns'
import { Search, Filter, ChevronLeft, ChevronRight, Users, Trash2 } from 'lucide-react'
import { List } from 'react-window'
import CandidateCard from './CandidateCard'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Forced Turbopack rebuild
export default function Dashboard({ 
  initialData = [], 
  initialMonth, 
  initialYear,
  basePath = '/office',
  title = 'Attendance Dashboard'
}: { 
  initialData: any[], 
  initialMonth: number, 
  initialYear: number,
  basePath?: string,
  title?: string
}) {
  const router = useRouter()
  
  // We don't use 'loading' anymore because data is fetched by RSC before rendering!
  const [data, setData] = useState<any[]>(initialData)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'FULL_TIME' | 'INTERN'>('ALL')
  const [selectedData, setSelectedData] = useState<any | null>(null)
  const [columns, setColumns] = useState(5) // default for lg
  const [windowWidth, setWindowWidth] = useState(1200)

  useEffect(() => {
    setData(initialData)
  }, [initialData])

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
      if (window.innerWidth < 640) setColumns(2)
      else if (window.innerWidth < 768) setColumns(3)
      else if (window.innerWidth < 1024) setColumns(4)
      else setColumns(5)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const currentDate = new Date(initialYear, initialMonth - 1, 1)

  const handleMonthChange = (date: Date) => {
    const m = date.getMonth() + 1
    const y = date.getFullYear()
    router.push(`${basePath}?month=${m}&year=${y}`)
  }

  const handleDeleteCandidate = async (candidateId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete candidate ${name}?`)) return
    
    try {
      let res = await fetch(`/api/candidates/${candidateId}`, { method: 'DELETE' })
      
      if (res.status === 409) {
        const errorData = await res.json()
        if (errorData.error === 'HAS_HISTORY') {
          if (window.confirm(`${errorData.message}\n\nDo you want to permanently delete this candidate and all their historical records? This action cannot be undone.`)) {
            res = await fetch(`/api/candidates/${candidateId}?force=true`, { method: 'DELETE' })
          } else {
            return
          }
        }
      }

      if (res.ok) {
        setData(prev => prev.filter(d => d.candidate.id !== candidateId))
        router.refresh()
        if (selectedData?.candidate.id === candidateId) {
          setSelectedData(null)
        }
      } else {
        const errorData = await res.json().catch(() => ({}))
        alert(errorData.message || errorData.error || 'Failed to delete candidate')
      }
    } catch (e) {
      console.error('Failed to delete candidate', e)
      alert('An unexpected error occurred while deleting the candidate.')
    }
  }

  const filteredData = useMemo(() => {
    return data.filter(d => {
      const matchesSearch = d.candidate.name.toLowerCase().includes(search.toLowerCase()) || 
                            d.candidate.aeId.toLowerCase().includes(search.toLowerCase())
      const matchesType = typeFilter === 'ALL' || d.candidate.type === typeFilter
      return matchesSearch && matchesType
    })
  }, [data, search, typeFilter])

  const totalCandidates = data.length

  // Virtualized row component
  const Row = ({ index, style, items, columns }: { index: number, style: any, items: any[], columns: number }) => {
    const startIndex = index * columns
    const rowItems = items.slice(startIndex, startIndex + columns)

    return (
      <div style={style} className="flex gap-4 px-1 pb-4">
        {rowItems.map((d) => (
          <div 
            key={d.candidate.id} 
            style={{ width: `calc(${100 / columns}% - ${16 * (columns - 1) / columns}px)` }}
            className="bg-card border border-card-border p-4 rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-accent/50 flex flex-col items-center text-center gap-3 relative group"
          >
            <button 
              onClick={(e) => { e.stopPropagation(); handleDeleteCandidate(d.candidate.id, d.candidate.name); }}
              className="absolute top-2 right-2 p-1.5 bg-red-50 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"
              title="Delete Candidate"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {/* Status Badge */}
            <div className={`absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${d.status === 'Finalized' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {d.status}
            </div>

            <div className="w-full flex flex-col items-center mt-3" onClick={() => setSelectedData(d)}>
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 mt-2">
                {d.candidate.photoUrl ? (
                  <img src={d.candidate.photoUrl} alt={d.candidate.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-slate-600 uppercase">
                    {d.candidate.name.charAt(0)}
                  </span>
                )}
              </div>
              <div className="w-full">
                <h3 className="font-semibold text-foreground truncate w-full px-2 mt-2" title={d.candidate.name}>{d.candidate.name}</h3>
                <p className="text-xs text-slate-500 mt-1">{d.candidate.aeId}</p>
                <div className="mt-2 w-full flex justify-center">
                   <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${d.candidate.type === 'FULL_TIME' ? 'bg-accent/10 text-accent' : 'bg-purple-100 text-purple-700'}`}>
                    {d.candidate.type === 'FULL_TIME' ? 'Full-Time' : 'Intern'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const rowCount = Math.ceil(filteredData.length / columns)

  return (
    <>
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full relative ${selectedData ? 'print:hidden' : ''}`}>
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
              {title}
            </h1>
            <p className="text-slate-500 mt-1">Manage employee attendance and payslips</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <Link 
              href="/" 
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl font-semibold text-sm transition-colors shadow-sm flex items-center gap-2"
            >
              Return to Home Page
            </Link>
            <Link 
              href="/biometric" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-colors shadow-sm flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
              Biometric Settings
            </Link>
            <Link 
              href="/admin" 
              className="bg-slate-800 hover:bg-slate-950 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-colors shadow-sm flex items-center gap-2"
            >
              Go to Admin Portal
            </Link>
            
            <div className="flex items-center bg-card border border-card-border h-[38px] px-2 rounded-xl shadow-sm text-sm font-semibold text-slate-700">
              <Link 
                href={`${basePath}?month=${subMonths(currentDate, 1).getMonth() + 1}&year=${subMonths(currentDate, 1).getFullYear()}`}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4 text-slate-500" />
              </Link>
              <div className="w-28 text-center font-semibold text-slate-700">
                {format(currentDate, 'MMMM yyyy')}
              </div>
              <Link 
                href={`${basePath}?month=${addMonths(currentDate, 1).getMonth() + 1}&year=${addMonths(currentDate, 1).getFullYear()}`}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-center"
              >
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </Link>
            </div>
          </div>
        </header>

        {/* Summary Strip */}
        <div className="flex mb-8">
          <div className="bg-card border border-card-border p-5 rounded-2xl shadow-sm flex items-center gap-4 min-w-[250px]">
            <div className="w-12 h-12 bg-accent/10 text-accent rounded-xl flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Total Candidates</div>
              <div className="text-2xl font-bold">{totalCandidates}</div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or AE ID..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-card border border-card-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50 transition-shadow"
            />
          </div>
          <div className="relative w-full sm:w-48">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full pl-10 pr-4 py-2.5 bg-card border border-card-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50 transition-shadow appearance-none cursor-pointer"
            >
              <option value="ALL">All Types</option>
              <option value="FULL_TIME">Full-Time</option>
              <option value="INTERN">Intern</option>
            </select>
          </div>
        </div>

        {/* Cards Grid */}
        {filteredData.length > 0 ? (
          <div className="w-full" style={{ height: '600px' }}>
            <List
              rowCount={rowCount}
              rowHeight={220}
              rowComponent={Row as any}
              rowProps={{ items: filteredData, columns }}
              style={{ height: 600, width: '100%' }}
            />
          </div>
        ) : (
          <div className="text-center py-20 bg-card border border-card-border rounded-2xl shadow-sm">
            <p className="text-slate-500">No candidates found for the selected filters.</p>
          </div>
        )}
      </div>

      {/* Modal Overlay */}
      {selectedData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto print:static print:block print:bg-transparent print:p-0" onClick={(e) => {
          if (e.target === e.currentTarget) setSelectedData(null)
        }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in-95 duration-200 print:max-w-none print:shadow-none print:max-h-none print:overflow-visible">
            <button 
              onClick={() => setSelectedData(null)}
              className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors z-10 print:hidden"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            <div className="p-2 sm:p-6 print:p-0">
              <CandidateCard 
                candidate={selectedData.candidate} 
                summary={selectedData} 
                logs={selectedData.logs || []} 
                month={initialMonth}
                year={initialYear}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
