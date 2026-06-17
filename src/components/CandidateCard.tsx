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
  FULL_DAY_PRESENT: 'bg-green-500 hover:bg-green-600',
  FULL_DAY_PRESENT_LATE: 'bg-orange-500 hover:bg-orange-600',
  HALF_DAY: 'bg-yellow-400 hover:bg-yellow-500',
  FULL_DAY_LEAVE: 'bg-red-500 hover:bg-red-600',
  WEEKEND_OFF: 'bg-slate-200 hover:bg-slate-300',
  HOLIDAY: 'bg-slate-300 hover:bg-slate-400',
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
        className={`w-6 h-6 sm:w-8 sm:h-8 rounded-sm ${statusColors[status]} transition-colors duration-200 cursor-help flex items-center justify-center text-[10px] text-white/50 group relative`}
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
    <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-slate-200  flex items-center justify-center overflow-hidden shrink-0">
          {candidate.photoUrl ? (
            <img src={candidate.photoUrl} alt={candidate.name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-6 h-6 text-slate-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg text-foreground truncate">{candidate.name}</h3>
          <div className="flex gap-2 items-center text-sm mt-1">
            <span className="bg-slate-100  text-slate-600  px-2 py-0.5 rounded font-mono text-xs border border-slate-200 ">{candidate.aeId}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${candidate.type === 'FULL_TIME' ? 'bg-accent/10 text-accent  ' : 'bg-purple-100 text-purple-700  '}`}>
              {candidate.type === 'FULL_TIME' ? 'Full-Time' : 'Intern'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar Column */}
        <div className="lg:col-span-5 flex flex-col items-center sm:items-start">
          <div className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Calendar
          </div>
          <div className="inline-grid grid-cols-7 gap-1 bg-slate-50/50  p-3 rounded-xl border border-slate-100 ">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <div key={i} className="text-center text-xs font-medium text-slate-400 w-6 sm:w-8 mb-1">{d}</div>
            ))}
            {cells}
          </div>
        </div>

        {/* Stats Column */}
        <div className="lg:col-span-7 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50  p-3 rounded-xl border border-slate-100 ">
              <div className="text-xs text-slate-500">Present</div>
              <div className="text-xl font-semibold text-green-600 ">{summary.payslip.daysPresent}</div>
            </div>
            <div className="bg-slate-50  p-3 rounded-xl border border-slate-100 ">
              <div className="text-xs text-slate-500">On Leave</div>
              <div className="text-xl font-semibold text-red-600 ">{summary.payslip.daysOnLeave}</div>
            </div>
            <div className="bg-slate-50  p-3 rounded-xl border border-slate-100 ">
              <div className="text-xs text-slate-500">LOP Days</div>
              <div className="text-xl font-semibold text-orange-500">{summary.balance.lopDays}</div>
            </div>
            <div className="bg-slate-50  p-3 rounded-xl border border-slate-100 ">
              <div className="text-xs text-slate-500">Half Days</div>
              <div className="text-xl font-semibold text-blue-500">{attendanceDetails.filter(d => d.status === 'HALF_DAY').length}</div>
            </div>
          </div>

          {/* Attendance Trend Graph */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Attendance Trend Graph</h4>
            <div className="font-mono text-sm space-y-2.5">
              <div className="flex items-center">
                <span className="w-20 font-sans text-slate-500 text-xs font-medium">Present</span>
                <span className="w-8 font-sans font-bold text-green-600 text-right mr-3">
                  {summary.payslip.daysPresent}
                </span>
                <span className="text-green-500 text-base tracking-[-0.05em] select-none break-all">
                  {(() => {
                    const full = Math.floor(summary.payslip.daysPresent)
                    const half = summary.payslip.daysPresent % 1 >= 0.5 ? '▌' : ''
                    return '█'.repeat(full) + half || '—'
                  })()}
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-20 font-sans text-slate-500 text-xs font-medium">Absent</span>
                <span className="w-8 font-sans font-bold text-red-600 text-right mr-3">
                  {summary.balance.lopDays}
                </span>
                <span className="text-red-500 text-base tracking-[-0.05em] select-none break-all">
                  {(() => {
                    const full = Math.floor(summary.balance.lopDays)
                    const half = summary.balance.lopDays % 1 >= 0.5 ? '▌' : ''
                    return '█'.repeat(full) + half || '—'
                  })()}
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-20 font-sans text-slate-500 text-xs font-medium">Leaves</span>
                <span className="w-8 font-sans font-bold text-blue-600 text-right mr-3">
                  {Math.max(0, summary.balance.usedLeaves - summary.balance.lopDays)}
                </span>
                <span className="text-blue-500 text-base tracking-[-0.05em] select-none break-all">
                  {(() => {
                    const leavesVal = Math.max(0, summary.balance.usedLeaves - summary.balance.lopDays)
                    const full = Math.floor(leavesVal)
                    const half = leavesVal % 1 >= 0.5 ? '▌' : ''
                    return '█'.repeat(full) + half || '—'
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* Payroll Summary */}
          <div className="border border-slate-200 rounded-xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none" />
            <div className="bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 flex justify-between items-center border-b border-slate-200">
              <span>Payroll Summary - {format(new Date(year, month - 1), 'MMMM yyyy')}</span>
            </div>
            <div className="p-5 text-sm relative">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6">
                  {/* Column 1: Attendance & Leaves */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Present Days:</span>
                      <span className="font-medium text-slate-700">{summary.payslip.daysPresent}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Absent Days:</span>
                      <span className="font-medium text-slate-700">{summary.payslip.daysOnLeave}</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5">
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Monthly Quota:</span>
                        <span className="font-medium text-blue-600">{summary.balance.monthlyQuota}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Carry Forward:</span>
                        <span className="font-medium text-blue-600">{summary.balance.carriedForward}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Total Leave Balance:</span>
                        <span className="font-medium text-blue-600">{summary.balance.availableLeaves}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Leaves Used:</span>
                        <span className="font-medium text-orange-600">{summary.balance.usedLeaves}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Next Carry Forward:</span>
                        <span className="font-medium text-accent">{summary.balance.nextCarryForward}</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Salary Computation */}
                  <div className="space-y-1.5 flex flex-col">
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">{candidate.type === 'INTERN' ? 'Monthly Stipend:' : 'Monthly Salary:'}</span>
                      <span className="font-medium text-slate-700">₹{candidate.ctcAnnual?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Per Day Rate:</span>
                      <span className="font-medium text-slate-700">₹{summary.payslip.perDayRate.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                    </div>
                    <div className="flex justify-between py-1 text-red-500 mt-3">
                      <span>Deductions ({summary.balance.lopDays} LOP days):</span>
                      <span className="font-medium">-₹{summary.payslip.lopDeduction.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                    </div>
                    
                    {/* Net Pay Till Date — updates every day */}
                    {(() => {
                      const halfDaysCount = attendanceDetails.filter(d => d.status === 'HALF_DAY').length
                      const paidDaysTillDate = summary.payslip.daysPresent + halfDaysCount * 0.5
                      const projectedPaidDays = 24 - summary.balance.lopDays

                      return (
                        <div className="flex flex-col mt-auto border-t-2 border-slate-200 pt-3">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-lg text-slate-800">
                              Net Pay
                              {isCurrentMonth && (
                                <span className="ml-2 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 align-middle">
                                  Till Today
                                </span>
                              )}
                            </span>
                            <div className="text-right">
                              <span className="font-bold text-xl text-accent block">
                                ₹{netPayTillDate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </span>
                              <span className="text-[10px] text-slate-400 block font-medium mt-0.5">
                                Paid Days: {isCurrentMonth ? paidDaysTillDate : (24 - summary.payslip.lopDays)} {(isCurrentMonth ? paidDaysTillDate : (24 - summary.payslip.lopDays)) === 1 ? 'day' : 'days'}
                              </span>
                            </div>
                          </div>
                          {isCurrentMonth && summary.payslip?.netPay !== undefined && (
                            <div className="flex justify-between text-xs text-slate-400 mt-2 border-t border-slate-100 pt-1.5">
                              <span>Projected end-of-month (after all deductions)</span>
                              <div className="text-right">
                                <span className="font-semibold block text-slate-600">₹{summary.payslip.netPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                <span className="text-[10px] block font-medium mt-0.5">Projected Paid: {projectedPaidDays} {projectedPaidDays === 1 ? 'day' : 'days'}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                    
                    <div className="mt-2 pt-2">
                      <button 
                        onClick={() => setShowPayslip(true)}
                        className="w-full py-2.5 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                        Download Payslip
                      </button>
                    </div>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Details Table */}
      <div className="mt-6 border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-700">Attendance Details</h4>
          <select 
            value={tableFilter} 
            onChange={(e) => setTableFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 text-slate-600 rounded-md px-2 py-1 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            <option value="ALL">All Days</option>
            <option value="PRESENT">Present & Late</option>
            <option value="ABSENT">Leave / Absent</option>
            <option value="HALF_DAY">Half Days</option>
            <option value="MISSING">Missing Punches</option>
          </select>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200 uppercase">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Login</th>
                <th className="px-4 py-2 font-medium">Logout</th>
                <th className="px-4 py-2 font-medium">Hours</th>
                <th className="px-4 py-2 font-medium">Status</th>
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
                  durationStr = `${diffHrs}:${diffMins.toString().padStart(2, '0')}`
                }

                let statusLabel = ''
                if (d.status === 'FULL_DAY_PRESENT') statusLabel = 'Present'
                else if (d.status === 'FULL_DAY_PRESENT_LATE') statusLabel = 'Late Login'
                else if (d.status === 'HALF_DAY') statusLabel = 'Half Day'
                else if (d.status === 'FULL_DAY_LEAVE') statusLabel = 'Leave / Absent'
                else if (d.status === 'WEEKEND_OFF') statusLabel = 'Weekend'

                return (
                  <tr key={d.date.toISOString()} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <td className="px-4 py-2 font-medium">{format(d.date, 'dd-MMM')}</td>
                    <td className="px-4 py-2">{d.log?.loginTime ? format(new Date(d.log.loginTime), 'hh:mm a') : 'Missing'}</td>
                    <td className="px-4 py-2">{d.log?.logoutTime ? format(new Date(d.log.logoutTime), 'hh:mm a') : 'Missing'}</td>
                    <td className="px-4 py-2 font-mono text-xs">{durationStr}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium text-white ${statusColors[d.status]}`}>
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
