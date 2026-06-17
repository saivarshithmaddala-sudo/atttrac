import React from 'react'
import { format } from 'date-fns'

type Props = {
  summary: any
  attendanceDetails: any[]
  manualAdjustments: any[]
  month: number
  year: number
}

export default function LeaveLedger({ summary, attendanceDetails, manualAdjustments, month, year }: Props) {
  const ledger = []
  
  let currentBalance = summary.carried_forward || 0

  // 1. Opening Balance row
  ledger.push({
    id: 'opening',
    date: new Date(Date.UTC(year, month - 1, 1)),
    type: 'Opening Balance',
    credit: 0,
    debit: 0,
    balance: currentBalance,
    isNeutral: true
  })

  // 2. Monthly Credit
  if (summary.free_quota_this_month > 0) {
    currentBalance += summary.free_quota_this_month
    ledger.push({
      id: 'monthly-credit',
      date: new Date(Date.UTC(year, month - 1, 1)),
      type: 'Monthly Credit',
      credit: summary.free_quota_this_month,
      debit: 0,
      balance: currentBalance
    })
  }

  // 3. Manual Adjustments & Leaves (Chronological)
  // Combine them into a single array and sort by date
  const events: any[] = []

  // Add manual adjustments
  manualAdjustments?.forEach((m: any) => {
    events.push({
      id: `manual-${m.id}`,
      date: new Date(m.date),
      type: m.description || 'Manual Adjustment',
      credit: m.credit || 0,
      debit: m.debit || 0
    })
  })

  // Add leaves from attendanceDetails
  attendanceDetails?.forEach((d: any) => {
    if (d.status === 'WEEKEND_OFF' || d.status === 'FULL_DAY_PRESENT' || d.status === 'HOLIDAY') return

    let debit = 0
    let type = ''
    if (d.status === 'FULL_DAY_LEAVE') {
      debit = 1.0
      type = 'Leave Taken (Absent)'
    } else if (d.status === 'HALF_DAY') {
      debit = 0.5
      type = 'Half Day'
    } else if (d.status === 'FULL_DAY_PRESENT_LATE') {
      debit = 0.5
      type = 'Late Login Penalty'
    }

    if (debit > 0) {
      events.push({
        id: `leave-${d.date.toISOString()}`,
        date: d.date,
        type,
        credit: 0,
        debit
      })
    }
  })

  // Add missed mandatory saturdays
  summary.missed_saturdays?.forEach((sd: string) => {
    events.push({
      id: `sat-${sd}`,
      date: new Date(sd),
      type: 'Missed Mandatory Saturday',
      credit: 0,
      debit: 1.0
    })
  })

  events.sort((a, b) => a.date.getTime() - b.date.getTime())

  events.forEach(e => {
    currentBalance += e.credit
    currentBalance -= e.debit
    ledger.push({
      ...e,
      balance: currentBalance
    })
  })

  // End of Month Summary row
  ledger.push({
    id: 'closing',
    date: new Date(Date.UTC(year, month, 0)),
    type: 'Closing Balance',
    credit: 0,
    debit: 0,
    balance: currentBalance,
    isNeutral: true
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
        <h3 className="font-semibold text-slate-800">Monthly Leave Ledger</h3>
        <p className="text-xs text-slate-500 mt-1">Complete transaction history for {format(new Date(year, month - 1), 'MMMM yyyy')}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
            <tr>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Transaction Type</th>
              <th className="px-5 py-3 text-right text-green-600">Credit (+)</th>
              <th className="px-5 py-3 text-right text-red-600">Debit (-)</th>
              <th className="px-5 py-3 text-right font-bold text-slate-800">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ledger.map((row) => (
              <tr key={row.id} className={`hover:bg-slate-50/50 transition-colors ${row.isNeutral ? 'bg-slate-50/50 italic text-slate-500' : ''}`}>
                <td className="px-5 py-3 whitespace-nowrap">{format(row.date, 'dd MMM yyyy')}</td>
                <td className="px-5 py-3 text-slate-700">{row.type}</td>
                <td className="px-5 py-3 text-right text-green-600 font-medium">{row.credit > 0 ? `+${row.credit}` : '-'}</td>
                <td className="px-5 py-3 text-right text-red-500 font-medium">{row.debit > 0 ? `-${row.debit}` : '-'}</td>
                <td className="px-5 py-3 text-right font-bold text-slate-800">{row.balance.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
