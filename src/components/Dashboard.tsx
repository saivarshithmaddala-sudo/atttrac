'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, subMonths, addMonths } from 'date-fns'
import { Search, Filter, ChevronLeft, ChevronRight, Users, Trash2, Building2, Calendar, FileSpreadsheet, MapPin, Activity, CheckCircle, ChevronDown } from 'lucide-react'
import { List } from 'react-window'
import CandidateCard from './CandidateCard'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
  
  const [data, setData] = useState<any[]>(initialData)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'FULL_TIME' | 'INTERN'>('ALL')
  const [selectedData, setSelectedData] = useState<any | null>(null)
  const [columns, setColumns] = useState(5)
  const [windowWidth, setWindowWidth] = useState(1200)

  useEffect(() => {
    setData(initialData)
  }, [initialData])

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
      if (window.innerWidth < 640) setColumns(1)
      else if (window.innerWidth < 768) setColumns(2)
      else if (window.innerWidth < 1024) setColumns(3)
      else if (window.innerWidth < 1280) setColumns(4)
      else setColumns(5)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const currentDate = new Date(initialYear, initialMonth - 1, 1)

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

  // Advanced metrics calculation
  const totalCandidates = data.length
  const officeCount = data.filter(d => d.candidate.workLocation === 'OFFICE').length
  const fieldCount = data.filter(d => d.candidate.workLocation === 'FIELD').length
  const avgPresentDays = data.length > 0 
    ? (data.reduce((sum, d) => sum + (d.payslip?.daysPresent || 0), 0) / data.length)
    : 0
  const attendanceRate = data.length > 0 
    ? Math.min(100, Math.round((avgPresentDays / 24) * 100))
    : 0
  const totalLeaves = data.reduce((sum, d) => sum + (d.balance?.usedLeaves || 0), 0)

  // Virtualized row component
  const Row = ({ index, style, items, columns }: { index: number, style: any, items: any[], columns: number }) => {
    const startIndex = index * columns
    const rowItems = items.slice(startIndex, startIndex + columns)

    return (
      <div style={style} className="flex gap-4 px-1 pb-4">
        {rowItems.map((d) => {
          const isFullTime = d.candidate.type === 'FULL_TIME'
          const netPay = Math.round(d.netPayTillDate || d.payslip?.netPay || 0)

          return (
            <div 
              key={d.candidate.id} 
              style={{ width: `calc(${100 / columns}% - ${16 * (columns - 1) / columns}px)` }}
              className="bg-card border border-card-border p-5 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_50px_rgba(15,118,110,0.07)] hover:scale-[1.01] hover:-translate-y-0.5 cursor-pointer transition-all duration-300 hover:border-accent/40 flex flex-col items-center gap-4 relative group"
              onClick={() => setSelectedData(d)}
            >
              {/* Delete Button (visible on hover) */}
              <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteCandidate(d.candidate.id, d.candidate.name); }}
                className="absolute top-3 right-3 p-1.5 bg-red-50/80 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-100 shadow-sm"
                title="Delete Candidate"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Status Badge */}
              <div className={`absolute top-3 left-3 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm ${d.status === 'Finalized' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' : 'bg-amber-50 text-amber-700 border border-amber-200/50'}`}>
                {d.status}
              </div>

              {/* Avatar with gradient border/glow */}
              <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-accent to-emerald-400 shadow-sm flex items-center justify-center shrink-0 mt-3">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                  {d.candidate.photoUrl ? (
                    <img src={d.candidate.photoUrl} alt={d.candidate.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center text-white font-bold text-xl uppercase bg-gradient-to-br ${isFullTime ? 'from-teal-600 to-emerald-400' : 'from-indigo-600 to-violet-400'}`}>
                      {d.candidate.name.charAt(0)}
                    </div>
                  )}
                </div>
              </div>

              {/* Candidate Info */}
              <div className="w-full text-center">
                <h3 className="font-semibold text-slate-800 text-sm truncate px-1" title={d.candidate.name}>
                  {d.candidate.name}
                </h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5 tracking-wider">{d.candidate.aeId}</p>
                <div className="mt-2 flex justify-center">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wide border ${isFullTime ? 'bg-teal-50 text-teal-700 border-teal-200/40' : 'bg-violet-50 text-violet-700 border-violet-200/40'}`}>
                    {isFullTime ? 'Full-Time' : 'Intern'}
                  </span>
                </div>
              </div>

              {/* Subtle divider */}
              <div className="w-full h-[1px] bg-slate-100 mt-1" />

              {/* Mini Stats Panel */}
              <div className="w-full grid grid-cols-3 gap-1 text-[10px] text-slate-500 font-medium text-center">
                <div>
                  <div className="text-slate-400 text-[9px] font-normal">Present</div>
                  <div className="text-slate-700 font-bold mt-0.5">{d.payslip?.daysPresent || 0}d</div>
                </div>
                <div className="border-x border-slate-100">
                  <div className="text-slate-400 text-[9px] font-normal">Leaves</div>
                  <div className="text-slate-700 font-bold mt-0.5">{d.balance?.usedLeaves || 0}d</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[9px] font-normal">Net Pay</div>
                  <div className="text-accent font-bold mt-0.5">₹{netPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const rowCount = Math.ceil(filteredData.length / columns)

  return (
    <>
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full relative ${selectedData ? 'print:hidden' : ''}`}>
        
        {/* Modern Top Navbar Header */}
        <header className="mb-10 flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200/80 pb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-sm">
                <span className="text-white font-mono text-sm font-bold">A</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  {title}
                </h1>
                <p className="text-xs text-slate-400 font-medium">Enterprise Workspace Analytics</p>
              </div>
            </div>
            
            {/* Header Navigation Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <Link 
                href="/" 
                className="bg-white border border-slate-200/60 hover:bg-slate-50 hover:border-slate-300 text-slate-600 px-3.5 py-2 rounded-xl font-medium text-xs transition-all shadow-sm flex items-center gap-2"
              >
                Return to Home
              </Link>
              <Link 
                href="/biometric" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl font-medium text-xs transition-all shadow-sm flex items-center gap-2"
              >
                <Activity className="w-3.5 h-3.5" />
                Biometric Settings
              </Link>
              <Link 
                href="/admin" 
                className="bg-slate-900 hover:bg-slate-950 text-white px-3.5 py-2 rounded-xl font-medium text-xs transition-all shadow-sm flex items-center gap-2"
              >
                Go to Admin Portal
              </Link>
            </div>
          </div>

          {/* Month Navigation & Dashboard Title Hero */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Monthly Performance Overview</p>
              <h2 className="text-lg font-bold text-slate-800 mt-1">Workspace Summary</h2>
            </div>
            
            {/* Tactical Month Selector */}
            <div className="flex items-center bg-white border border-slate-200 p-1.5 rounded-xl shadow-sm text-xs font-semibold text-slate-700">
              <Link 
                href={`${basePath}?month=${subMonths(currentDate, 1).getMonth() + 1}&year=${subMonths(currentDate, 1).getFullYear()}`}
                className="p-1.5 hover:bg-slate-50 border border-transparent hover:border-slate-100 rounded-lg transition-all flex items-center justify-center text-slate-500 hover:text-slate-900"
              >
                <ChevronLeft className="w-4 h-4" />
              </Link>
              <div className="w-32 text-center font-bold text-slate-800 flex items-center justify-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-accent" />
                {format(currentDate, 'MMMM yyyy')}
              </div>
              <Link 
                href={`${basePath}?month=${addMonths(currentDate, 1).getMonth() + 1}&year=${addMonths(currentDate, 1).getFullYear()}`}
                className="p-1.5 hover:bg-slate-50 border border-transparent hover:border-slate-100 rounded-lg transition-all flex items-center justify-center text-slate-500 hover:text-slate-900"
              >
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </header>

        {/* Extended 4-Column Metrics Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          
          {/* Card 1: Total candidates */}
          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex items-center gap-4">
            <div className="w-11 h-11 bg-accent/10 text-accent rounded-xl flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Candidates</div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{totalCandidates}</div>
            </div>
          </div>

          {/* Card 2: Active Locations (Office / Field) */}
          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex items-center gap-4">
            <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Duty Stations</div>
              <div className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-2">
                <span className="bg-blue-50/60 px-2 py-0.5 rounded border border-blue-100 text-blue-700 font-mono text-xs">{officeCount} Office</span>
                <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-slate-600 font-mono text-xs">{fieldCount} Field</span>
              </div>
            </div>
          </div>

          {/* Card 3: Avg Attendance Rate */}
          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex items-center gap-4">
            <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Avg Attendance</div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5 flex items-baseline gap-1">
                {avgPresentDays.toFixed(1)}d
                <span className="text-xs text-emerald-500 font-semibold">({attendanceRate}%)</span>
              </div>
            </div>
          </div>

          {/* Card 4: Leaves Utilized */}
          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex items-center gap-4">
            <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Leaves</div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{totalLeaves.toFixed(1)}d</div>
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or AE ID..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all shadow-[0_1px_3px_rgba(0,0,0,0.01)] text-slate-700 text-sm"
            />
          </div>
          <div className="relative w-full sm:w-56">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full pl-11 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all shadow-[0_1px_3px_rgba(0,0,0,0.01)] appearance-none cursor-pointer text-slate-700 text-sm font-medium"
            >
              <option value="ALL">All Employment Types</option>
              <option value="FULL_TIME">Full-Time Staff</option>
              <option value="INTERN">Interns</option>
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Cards Grid */}
        {filteredData.length > 0 ? (
          <div className="w-full" style={{ height: '620px' }}>
            <List
              rowCount={rowCount}
              rowHeight={230}
              rowComponent={Row as any}
              rowProps={{ items: filteredData, columns }}
              style={{ height: 620, width: '100%' }}
            />
          </div>
        ) : (
          <div className="text-center py-24 bg-white border border-slate-200/80 rounded-2xl shadow-sm">
            <p className="text-slate-400 font-medium text-sm">No workspace candidates found matching your filters.</p>
          </div>
        )}
      </div>

      {/* Premium Glassmorphic Modal Overlay */}
      {selectedData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md overflow-y-auto print:static print:block print:bg-transparent print:p-0" onClick={(e) => {
          if (e.target === e.currentTarget) setSelectedData(null)
        }}>
          <div className="bg-white border border-slate-200/50 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto relative animate-in fade-in zoom-in-95 duration-200 print:max-w-none print:shadow-none print:max-h-none print:overflow-visible">
            <button 
              onClick={() => setSelectedData(null)}
              className="absolute top-4 right-4 p-2 bg-slate-50 border border-slate-200/60 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-800 transition-all z-10 shadow-sm print:hidden"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
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

