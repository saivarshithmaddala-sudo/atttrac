import React from 'react'
import { format } from 'date-fns'

type Props = {
  candidate: any
  summary: any
  month: number
  year: number
  attendanceDetails: any[]
  onBack: () => void
}

export default function PayslipPreview({ candidate, summary, month, year, attendanceDetails, onBack }: Props) {
  const handlePrint = () => {
    const originalTitle = document.title
    const monthName = format(new Date(year, month - 1), 'MMM_yyyy')
    document.title = `Payslip_${candidate.name.replace(/\s+/g, '_')}_${monthName}`
    
    window.print()
    
    setTimeout(() => {
      document.title = originalTitle
    }, 1000)
  }

  return (
    <div className="w-full bg-white relative">
      {/* Non-printable controls */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <button 
          onClick={onBack}
          className="text-sm font-medium text-slate-500 hover:text-slate-800 flex items-center gap-2 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back to Dashboard
        </button>
        <button 
          onClick={handlePrint}
          className="py-2 px-4 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2 shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
          Print / Download PDF
        </button>
      </div>

      {/* Printable Payslip */}
      <div className="print:m-0 print:p-0 print:shadow-none border border-slate-200 rounded-xl p-8 max-w-3xl mx-auto printable-payslip">
        <div className="text-center border-b-2 border-slate-800 pb-6 mb-8">
          <h1 className="text-3xl font-bold tracking-widest uppercase text-slate-800">Your Company Name</h1>
          <p className="text-slate-500 mt-2 text-lg">Payslip for the month of {format(new Date(year, month - 1), 'MMMM yyyy')}</p>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Employee Details</h3>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2"><span className="font-medium text-slate-600">Name:</span> <span className="text-slate-900">{candidate.name}</span></div>
              <div className="grid grid-cols-2"><span className="font-medium text-slate-600">Employee ID:</span> <span className="text-slate-900">{candidate.aeId}</span></div>
              <div className="grid grid-cols-2"><span className="font-medium text-slate-600">Designation:</span> <span className="text-slate-900">{candidate.type === 'FULL_TIME' ? 'Full-Time Employee' : 'Intern'}</span></div>
              <div className="grid grid-cols-2"><span className="font-medium text-slate-600">Date of Joining:</span> <span className="text-slate-900">{format(new Date(candidate.joiningDate), 'dd MMM yyyy')}</span></div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Attendance Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2"><span className="font-medium text-slate-600">Total Leaves Quota:</span> <span className="text-slate-900">{summary.balance.monthlyQuota + summary.balance.carriedForward}</span></div>
              <div className="grid grid-cols-2"><span className="font-medium text-slate-600">Days Present:</span> <span className="text-slate-900">{summary.payslip.daysPresent}</span></div>
              <div className="grid grid-cols-2"><span className="font-medium text-slate-600">Leave Taken:</span> <span className="text-slate-900">{summary.payslip.daysOnLeave}</span></div>
              <div className="grid grid-cols-2"><span className="font-medium text-slate-600">Loss Of Pay (LOP):</span> <span className="text-slate-900">{summary.payslip.lopDays} Days</span></div>
              <div className="grid grid-cols-2"><span className="font-medium text-slate-600">Leave Balance Remaining:</span> <span className="text-slate-900">{summary.balance.nextCarryForward}</span></div>
              <div className="grid grid-cols-2">
                <span className="font-semibold text-slate-700">Salary Days Paid:</span> 
                <span className="text-slate-900 font-bold">
                  {(() => {
                    const now = new Date()
                    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
                    const halfDaysCount = attendanceDetails.filter(d => d.status === 'HALF_DAY').length
                    return isCurrentMonth 
                      ? `${summary.payslip.daysPresent + halfDaysCount * 0.5} Days`
                      : `${24 - summary.payslip.lopDays} Days`
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Earnings & Deductions</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-300 py-2 px-4 text-left">Earnings</th>
                <th className="border border-slate-300 py-2 px-4 text-right">Amount</th>
                <th className="border border-slate-300 py-2 px-4 text-left">Deductions</th>
                <th className="border border-slate-300 py-2 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-300 py-3 px-4">Basic Gross Salary</td>
                <td className="border border-slate-300 py-3 px-4 text-right">₹{summary.payslip.grossMonthly.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                <td className="border border-slate-300 py-3 px-4">LOP Deduction ({summary.payslip.lopDays} days)</td>
                <td className="border border-slate-300 py-3 px-4 text-right text-red-600">{summary.payslip.lopDeduction > 0 ? `-₹${summary.payslip.lopDeduction.toLocaleString(undefined, {maximumFractionDigits: 0})}` : '₹0'}</td>
              </tr>
              {/* Empty padding rows for structural aesthetics */}
              <tr>
                <td className="border border-slate-300 py-6 px-4"></td>
                <td className="border border-slate-300 py-6 px-4 text-right"></td>
                <td className="border border-slate-300 py-6 px-4"></td>
                <td className="border border-slate-300 py-6 px-4 text-right"></td>
              </tr>
              <tr className="bg-slate-50 font-bold text-slate-800">
                <td className="border border-slate-300 py-3 px-4">Total Earnings</td>
                <td className="border border-slate-300 py-3 px-4 text-right">₹{summary.payslip.grossMonthly.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                <td className="border border-slate-300 py-3 px-4">Total Deductions</td>
                <td className="border border-slate-300 py-3 px-4 text-right text-red-600">{summary.payslip.lopDeduction > 0 ? `-₹${summary.payslip.lopDeduction.toLocaleString(undefined, {maximumFractionDigits: 0})}` : '₹0'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Daily Attendance Log</h3>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-300 py-2 px-3 text-left">Date</th>
                <th className="border border-slate-300 py-2 px-3 text-left">Check-In</th>
                <th className="border border-slate-300 py-2 px-3 text-left">Check-Out</th>
                <th className="border border-slate-300 py-2 px-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {attendanceDetails.filter(d => d.status !== 'WEEKEND_OFF' || d.log).map((d) => {
                let statusLabel = ''
                if (d.status === 'FULL_DAY_PRESENT') statusLabel = 'Present'
                else if (d.status === 'FULL_DAY_PRESENT_LATE') statusLabel = 'Late Login'
                else if (d.status === 'HALF_DAY') statusLabel = 'Half Day'
                else if (d.status === 'FULL_DAY_LEAVE') statusLabel = 'Leave / Absent'
                else if (d.status === 'WEEKEND_OFF') statusLabel = 'Weekend'
                else if (d.status === 'HOLIDAY') statusLabel = 'Holiday'

                return (
                  <tr key={d.date.toISOString()}>
                    <td className="border border-slate-300 py-1.5 px-3 text-slate-800">{format(d.date, 'dd MMM yyyy')}</td>
                    <td className="border border-slate-300 py-1.5 px-3 text-slate-600">{d.log?.loginTime ? format(new Date(d.log.loginTime), 'hh:mm a') : '---'}</td>
                    <td className="border border-slate-300 py-1.5 px-3 text-slate-600">{d.log?.logoutTime ? format(new Date(d.log.logoutTime), 'hh:mm a') : '---'}</td>
                    <td className={`border border-slate-300 py-1.5 px-3 font-medium ${d.status === 'FULL_DAY_LEAVE' ? 'text-red-600' : d.status === 'HALF_DAY' || d.status === 'FULL_DAY_PRESENT_LATE' ? 'text-orange-600' : 'text-slate-800'}`}>
                      {statusLabel}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-10">
          <div className="w-1/2 bg-slate-800 text-white p-4 rounded-xl flex justify-between items-center shadow-lg">
            <div>
              <span className="text-lg font-medium block">Net Payable Salary</span>
              {(() => {
                const now = new Date()
                const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
                
                const halfDaysCount = attendanceDetails.filter(d => d.status === 'HALF_DAY').length
                const paidDays = isCurrentMonth 
                  ? (summary.payslip.daysPresent + halfDaysCount * 0.5)
                  : (24 - summary.payslip.lopDays)

                return (
                  <div className="flex flex-col gap-1 mt-1">
                    {isCurrentMonth && (
                      <span className="text-[10px] font-semibold bg-blue-500 text-white rounded-full px-2 py-0.5 inline-block w-fit">
                        Till {format(now, 'dd MMM yyyy')}
                      </span>
                    )}
                    <span className="text-xs text-white/80 block font-medium">
                      Calculated for: {paidDays} {paidDays === 1 ? 'working day' : 'working days'}
                    </span>
                  </div>
                )
              })()}
            </div>
            <span className="text-2xl font-bold">
              ₹{(() => {
                const now = new Date()
                const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
                const val = isCurrentMonth && summary.netPayTillDate !== undefined
                  ? summary.netPayTillDate
                  : summary.payslip.netPay
                return val.toLocaleString(undefined, { maximumFractionDigits: 0 })
              })()}
            </span>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-200 text-center text-xs text-slate-400">
          <p>This is a computer-generated document. No signature is required.</p>
        </div>
      </div>
    </div>
  )
}
