'use client'

import React, { useState } from 'react'
import { format } from 'date-fns'
import LeaveLedger from './LeaveLedger'
import { Calendar, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, User } from 'lucide-react'
import type { DayStatus } from '@/lib/engine'
import PayslipPreview from './PayslipPreview'

type Props = {
  candidate: any
  summary: any
  netPayTillDate?: number
  logs: any[]
  month: number
  year: number
}

const statusColors: Record<DayStatus, string> = {
  FULL_DAY_PRESENT: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  FULL_DAY_PRESENT_LATE: 'bg-amber-500 hover:bg-amber-600 text-white',
  HALF_DAY: 'bg-sky-400 hover:bg-sky-500 text-white',
  FULL_DAY_LEAVE: 'bg-rose-500 hover:bg-rose-600 text-white',
  WEEKEND_OFF: 'bg-slate-100 hover:bg-slate-200 text-slate-400 border border-slate-200/40',
  HOLIDAY: 'bg-violet-100 hover:bg-violet-200 text-violet-700 border border-violet-200/40',
}

export default function CandidateCard({ candidate, summary, logs, month, year }: Props) {
  const [tableFilter, setTableFilter] = useState('ALL')
  const [showPayslip, setShowPayslip] = useState(false)

  const now = new Date()
  const isCurrentMonth = (year === now.getFullYear() && month === now.getMonth() + 1)
  // netPayTillDate = days actually worked × per-day rate (live, updates daily)
  const netPayTillDate = summary.netPayTillDate ?? summary.payslip?.netPay ?? 0

  // Generate calendar cells
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  
  // Shift day index so Monday is 0, Sunday is 6
  const startOffset = firstDay === 0 ? 6 : firstDay - 1

  const cells = []
  for (let i = 0; i < startOffset; i++) {
    cells.push(<div key={`empty-${i}`} className="w-6 h-6 sm:w-8 sm:h-8" />)
  }

  const attendanceDetails: { date: Date, status: DayStatus, log: any }[] = []

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(Date.UTC(year, month - 1, d))
    const log = logs.find((l: any) => new Date(l.date).getUTCDate() === d)
    const dayOfWeek = date.getUTCDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    
    // Check if this is a mandatory Saturday under the flexible rules
    let isMandatorySat = false

    if (dayOfWeek === 6) {
      const sats = []
      for(let sd=1; sd<=daysInMonth; sd++) {
        if (new Date(Date.UTC(year, month - 1, sd)).getUTCDay() === 6) sats.push(sd)
      }
      
      const hasLogAt = (day: number) => logs.some((l: any) => new Date(l.date).getUTCDate() === day)

      if (sats[0] === d) {
        if (!hasLogAt(sats[1])) isMandatorySat = true
      } else if (sats[1] === d) {
        if (!hasLogAt(sats[0])) isMandatorySat = true
      } else if (sats[2] === d) {
        if (!hasLogAt(sats[3])) isMandatorySat = true
      } else if (sats[3] === d) {
        if (!hasLogAt(sats[2])) isMandatorySat = true
      }
    }

    // Simplistic visual classification for the grid
    let status: DayStatus = 'WEEKEND_OFF'
    
    const isBeforeJoining = date.getTime() < new Date(Date.UTC(new Date(candidate.joiningDate).getUTCFullYear(), new Date(candidate.joiningDate).getUTCMonth(), new Date(candidate.joiningDate).getUTCDate())).getTime()
    const now = new Date()
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const isFutureDate = date.getTime() > todayUTC.getTime()
    
    if (isBeforeJoining || (isFutureDate && !log)) {
      status = 'WEEKEND_OFF'
    } else if ((!isWeekend && !log) || (isMandatorySat && !log)) {
      status = 'FULL_DAY_LEAVE'
    } else if (log) {
       // Since the API doesn't return the exact status per day (only aggregate),
       // we re-run a simplified check or ideally we should have returned it from the API.
       // For the UI, we can just do a basic check based on hours if we don't want to re-import engine on client.
       // But wait, the prompt says "re-compute on the fly".
       // Let's just assume we pass down the exact status from the server or recompute if needed.
       // For this component, let's just determine status based on log.loginTime and log.logoutTime locally if possible.
       if (!log.loginTime || !log.logoutTime) status = 'HALF_DAY'
       else {
         const login = new Date(log.loginTime)
         const logout = new Date(log.logoutTime)
         const diff = (logout.getTime() - login.getTime()) / (1000 * 60 * 60)
         const istTime = new Date(login.getTime() + (5.5 * 60 * 60 * 1000))
         const istMins = istTime.getUTCHours() * 60 + istTime.getUTCMinutes()
         
         if (diff < 4) status = 'FULL_DAY_LEAVE'
         else if (diff < 7) status = 'HALF_DAY'
         else if (istMins > 11 * 60 + 30) status = 'HALF_DAY'
         else if (istMins > 10 * 60 + 30) status = 'FULL_DAY_PRESENT_LATE'
         else status = 'FULL_DAY_PRESENT'
       }
    }

    attendanceDetails.push({ date, status, log })

    cells.push(
      <div 
        key={d} 
        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${statusColors[status]} transition-all duration-200 hover:scale-105 cursor-help flex items-center justify-center text-[10px] font-semibold shadow-sm group relative`}
        title={log?.loginTime && log?.logoutTime ? `${format(new Date(log.loginTime), 'HH:mm')} - ${format(new Date(log.logoutTime), 'HH:mm')}` : 'No Log'}
      >
        {d}
      </div>
    )
  }

  if (showPayslip) {
    return <PayslipPreview candidate={candidate} summary={summary} month={month} year={year} attendanceDetails={attendanceDetails} onBack={() => setShowPayslip(false)} />
  }

  return (
    <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-100 shadow-[0_4px_30px_rgba(0,0,0,0.02)]">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-accent to-emerald-400 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
            {candidate.photoUrl ? (
              <img src={candidate.photoUrl} alt={candidate.name} className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full flex items-center justify-center text-white font-bold text-lg uppercase bg-gradient-to-br ${candidate.type === 'FULL_TIME' ? 'from-teal-600 to-emerald-400' : 'from-indigo-600 to-violet-400'}`}>
                {candidate.name.charAt(0)}
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-xl text-slate-800 tracking-tight">{candidate.name}</h3>
          <div className="flex gap-2 items-center text-sm mt-1.5">
            <span className="bg-slate-50 text-slate-500 px-2 py-0.5 rounded font-mono text-[10px] font-semibold border border-slate-200/60 tracking-wider">{candidate.aeId}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${candidate.type === 'FULL_TIME' ? 'bg-teal-50 text-teal-700 border-teal-200/40' : 'bg-violet-50 text-violet-700 border-violet-200/40'}`}>
              {candidate.type === 'FULL_TIME' ? 'Full-Time' : 'Intern'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Calendar Column */}
        <div className="lg:col-span-5 flex flex-col items-center sm:items-start">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent" />
            Monthly Grid Map
          </div>
          <div className="inline-grid grid-cols-7 gap-1.5 bg-slate-50/50 p-4 rounded-2xl border border-slate-200/50 w-full max-w-sm">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <div key={i} className="text-center text-[10px] font-bold text-slate-400 w-7 sm:w-8 mb-1.5">{d}</div>
            ))}
            {cells}
          </div>
        </div>

        {/* Stats Column */}
        <div className="lg:col-span-7 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-emerald-50/60 border border-emerald-100/50 p-4 rounded-2xl">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Present</div>
              <div className="text-xl font-bold text-emerald-700 mt-0.5">{summary.payslip.daysPresent}d</div>
            </div>
            <div className="bg-rose-50/60 border border-rose-100/50 p-4 rounded-2xl">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">On Leave</div>
              <div className="text-xl font-bold text-rose-700 mt-0.5">{summary.payslip.daysOnLeave}d</div>
            </div>
            <div className="bg-amber-50/60 border border-amber-100/50 p-4 rounded-2xl">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">LOP Days</div>
              <div className="text-xl font-bold text-amber-700 mt-0.5">{summary.balance.lopDays}d</div>
            </div>
            <div className="bg-sky-50/60 border border-sky-100/50 p-4 rounded-2xl">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Half Days</div>
              <div className="text-xl font-bold text-sky-700 mt-0.5">{attendanceDetails.filter(d => d.status === 'HALF_DAY').length}d</div>
            </div>
          </div>

          {/* Attendance Trend Graph */}
          <div className="bg-slate-50/60 border border-slate-200/60 rounded-2xl p-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Attendance Performance</h4>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-16 text-slate-500 text-xs font-semibold">Present</span>
                <span className="w-8 font-bold text-slate-800 text-xs text-right">{summary.payslip.daysPresent}d</span>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (summary.payslip.daysPresent / 24) * 100)}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-16 text-slate-500 text-xs font-semibold">LOP Days</span>
                <span className="w-8 font-bold text-slate-800 text-xs text-right">{summary.balance.lopDays}d</span>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(100, (summary.balance.lopDays / 24) * 100)}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-16 text-slate-500 text-xs font-semibold">Leaves</span>
                <span className="w-8 font-bold text-slate-800 text-xs text-right">{Math.max(0, summary.balance.usedLeaves - summary.balance.lopDays)}d</span>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500 rounded-full" style={{ width: `${Math.min(100, (Math.max(0, summary.balance.usedLeaves - summary.balance.lopDays) / 24) * 100)}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Payroll Summary */}
          <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm relative">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none" />
            <div className="bg-slate-50 px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-600 flex justify-between items-center border-b border-slate-200/80">
              <span>Payroll Breakdown — {format(new Date(year, month - 1), 'MMMM yyyy')}</span>
            </div>
            <div className="p-5 text-sm relative">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6">
                {/* Column 1: Attendance & Leaves */}
                <div className="space-y-2">
                  <div className="flex justify-between py-0.5 border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500 text-xs">Present Days:</span>
                    <span className="font-semibold text-slate-800">{summary.payslip.daysPresent}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500 text-xs">Absent Days:</span>
                    <span className="font-semibold text-slate-800">{summary.payslip.daysOnLeave}</span>
                  </div>
                  <div className="mt-4 pt-2 space-y-2">
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-500 text-xs">Monthly Quota:</span>
                      <span className="font-semibold text-blue-600">{summary.balance.monthlyQuota}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-500 text-xs">Carry Forward:</span>
                      <span className="font-semibold text-blue-600">{summary.balance.carriedForward}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-500 text-xs">Total Leave Balance:</span>
                      <span className="font-semibold text-blue-600">{summary.balance.availableLeaves}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-500 text-xs">Leaves Used:</span>
                      <span className="font-semibold text-rose-500">{summary.balance.usedLeaves}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-t border-slate-100 pt-2">
                      <span className="text-slate-500 text-xs font-semibold">Next Carry Forward:</span>
                      <span className="font-bold text-accent">{summary.balance.nextCarryForward}</span>
                    </div>
                  </div>
                </div>

                {/* Column 2: Salary Computation */}
                <div className="space-y-2 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between py-0.5 border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500 text-xs">{candidate.type === 'INTERN' ? 'Stipend Rate:' : 'Salary Rate:'}</span>
                      <span className="font-semibold text-slate-800">₹{candidate.ctcAnnual?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500 text-xs">Daily Rate:</span>
                      <span className="font-semibold text-slate-800">₹{summary.payslip.perDayRate.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                    </div>
                    <div className="flex justify-between py-0.5 text-rose-600 font-medium pt-2">
                      <span className="text-xs">Deductions ({summary.balance.lopDays} LOP):</span>
                      <span>-₹{summary.payslip.lopDeduction.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                    </div>
                  </div>
                  
                  {/* Net Pay Panel */}
                  {(() => {
                    const halfDaysCount = attendanceDetails.filter(d => d.status === 'HALF_DAY').length
                    const paidDaysTillDate = summary.payslip.daysPresent + halfDaysCount * 0.5
                    const projectedPaidDays = 24 - summary.balance.lopDays

                    return (
                      <div className="flex flex-col mt-4 pt-3 border-t-2 border-slate-100">
                        <div className="flex justify-between items-center bg-slate-900 text-white rounded-xl p-3.5 relative overflow-hidden shadow-sm">
                          <div className="absolute inset-0 bg-gradient-to-tr from-accent/20 to-transparent pointer-events-none" />
                          <div>
                            <span className="font-bold text-xs uppercase tracking-wider block text-slate-400">
                              Net Salary
                              {isCurrentMonth && ' (YTD)'}
                            </span>
                            <span className="text-[10px] text-slate-300 font-medium block mt-0.5">
                              Paid Days: {isCurrentMonth ? paidDaysTillDate : (24 - summary.payslip.lopDays)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-base block">
                              ₹{netPayTillDate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>
                        {isCurrentMonth && summary.payslip?.netPay !== undefined && (
                          <div className="flex justify-between items-center text-[10px] text-slate-400 mt-2 border-t border-slate-100 pt-2">
                            <span>Projected (End of Month)</span>
                            <span className="font-semibold text-slate-600">₹{summary.payslip.netPay.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({projectedPaidDays} days)</span>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  
                  <div className="mt-4">
                    <button 
                      onClick={() => setShowPayslip(true)}
                      className="w-full py-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                      Download Payslip Document
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Details Table */}
      <div className="mt-8 border-t border-slate-200/60 pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Attendance Log Ledger</h4>
          <div className="relative w-full sm:w-44">
            <select 
              value={tableFilter} 
              onChange={(e) => setTableFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-600 rounded-lg pl-3 pr-8 py-1.5 outline-none focus:border-accent focus:ring-1 focus:ring-accent appearance-none font-semibold cursor-pointer"
            >
              <option value="ALL">All Days</option>
              <option value="PRESENT">Present & Late</option>
              <option value="ABSENT">Leave / Absent</option>
              <option value="HALF_DAY">Half Days</option>
              <option value="MISSING">Missing Punches</option>
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left text-slate-600">
            <thead className="text-[10px] text-slate-400 bg-slate-50 border-b border-slate-200 uppercase font-bold tracking-wider">
              <tr>
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 font-semibold">Login Punch</th>
                <th className="px-5 py-3 font-semibold">Logout Punch</th>
                <th className="px-5 py-3 font-semibold">Hours Worked</th>
                <th className="px-5 py-3 font-semibold">Daily Status</th>
              </tr>
            </thead>
            <tbody>
              {attendanceDetails.filter(d => {
                if (d.status === 'WEEKEND_OFF' && !d.log) return false;
                if (tableFilter === 'ALL') return true;
                if (tableFilter === 'PRESENT') return d.status === 'FULL_DAY_PRESENT' || d.status === 'FULL_DAY_PRESENT_LATE';
                if (tableFilter === 'ABSENT') return d.status === 'FULL_DAY_LEAVE';
                if (tableFilter === 'HALF_DAY') return d.status === 'HALF_DAY';
                if (tableFilter === 'MISSING') return !d.log?.loginTime || !d.log?.logoutTime;
                return true;
              }).map((d, index) => {
                let durationStr = '----'
                if (d.log?.loginTime && d.log?.logoutTime) {
                  const diffMs = new Date(d.log.logoutTime).getTime() - new Date(d.log.loginTime).getTime()
                  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))
                  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                  durationStr = `${diffHrs}h ${diffMins.toString().padStart(2, '0')}m`
                }

                let statusLabel = ''
                if (d.status === 'FULL_DAY_PRESENT') statusLabel = 'Present'
                else if (d.status === 'FULL_DAY_PRESENT_LATE') statusLabel = 'Late Login'
                else if (d.status === 'HALF_DAY') statusLabel = 'Half Day'
                else if (d.status === 'FULL_DAY_LEAVE') statusLabel = 'Leave / Absent'
                else if (d.status === 'WEEKEND_OFF') statusLabel = 'Weekend'

                return (
                  <tr key={d.date.toISOString()} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                    <td className="px-5 py-3.5 font-bold text-slate-800">{format(d.date, 'dd-MMM')}</td>
                    <td className="px-5 py-3.5 text-slate-500 font-medium">{d.log?.loginTime ? format(new Date(d.log.loginTime), 'hh:mm a') : 'Missing'}</td>
                    <td className="px-5 py-3.5 text-slate-500 font-medium">{d.log?.logoutTime ? format(new Date(d.log.logoutTime), 'hh:mm a') : 'Missing'}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-600 font-semibold">{durationStr}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border shadow-[0_1px_2px_rgba(0,0,0,0.01)] ${
                        d.status === 'FULL_DAY_PRESENT' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/40' :
                        d.status === 'FULL_DAY_PRESENT_LATE' ? 'bg-amber-50 text-amber-700 border-amber-200/40' :
                        d.status === 'HALF_DAY' ? 'bg-sky-50 text-sky-700 border-sky-200/40' :
                        d.status === 'FULL_DAY_LEAVE' ? 'bg-rose-50 text-rose-700 border-rose-200/40' :
                        'bg-slate-50 text-slate-600 border-slate-200/40'
                      }`}>
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
