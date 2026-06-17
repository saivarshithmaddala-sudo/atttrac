'use client'

import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'

type Props = {
  rows: Array<{
    candidateId: string
    aeId: string
    name: string
    type: string
    carriedForward: number
    freeQuota: number
    usedLeaves: number
    nextCarryForward: number
    lopDays: number
    salaryDeduction: number
  }>
  reportDateStr: string
  printTitle: string
}

export default function LeaveReport({ rows, reportDateStr, printTitle }: Props) {
  const [generatedAt, setGeneratedAt] = useState<string>('')

  useEffect(() => {
    setGeneratedAt(format(new Date(), 'dd MMM yyyy HH:mm'))
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 p-6 print:p-0 print:bg-white w-full">
      {/* Styles for print layout */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          body { background: white; color: black; }
          .printable-area { border: none !important; box-shadow: none !important; padding: 0 !important; }
          tr { page-break-inside: avoid; }
        }
      `}} />

      {/* Action Header (hidden in print) */}
      <div className="max-w-6xl mx-auto flex items-center justify-between mb-6 no-print">
        <Link
          href="/admin"
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Return to Admin Portal
        </Link>
        <button
          onClick={() => {
            const originalTitle = document.title
            document.title = printTitle
            window.print()
            setTimeout(() => { document.title = originalTitle }, 1000)
          }}
          className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors shadow-sm cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4" /></svg>
          Print / Download PDF Report
        </button>
      </div>

      {/* Report Box */}
      <div className="max-w-6xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 shadow-sm printable-area">
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b-2 border-slate-800 pb-6 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800 uppercase">Employee Leave & LOP Report</h1>
            <p className="text-sm text-slate-500 mt-1">Period: <span className="font-semibold text-slate-700">{reportDateStr}</span></p>
          </div>
          <div className="text-right mt-2 md:mt-0 text-xs text-slate-400">
            <p>Generated on: {generatedAt}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-semibold text-xs uppercase">
                <th className="py-2.5 px-3 border border-slate-300">AE ID</th>
                <th className="py-2.5 px-3 border border-slate-300">Name</th>
                <th className="py-2.5 px-3 border border-slate-300">Type</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center">Opening Bal</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center">Credit Quota</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center">Used Leaves</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center">Closing Bal</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center">LOP Days</th>
                <th className="py-2.5 px-3 border border-slate-300 text-right">Deduction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {rows.map(row => (
                <tr key={row.candidateId} className="hover:bg-slate-50/50">
                  <td className="py-2 px-3 border border-slate-300 font-mono font-medium text-slate-800">{row.aeId}</td>
                  <td className="py-2 px-3 border border-slate-300 font-medium text-slate-700">{row.name}</td>
                  <td className="py-2 px-3 border border-slate-300">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${row.type === 'FULL_TIME' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-purple-50 text-purple-700 border border-purple-100'}`}>
                      {row.type === 'FULL_TIME' ? 'Full-Time' : 'Intern'}
                    </span>
                  </td>
                  <td className="py-2 px-3 border border-slate-300 text-center font-mono">{row.carriedForward}</td>
                  <td className="py-2 px-3 border border-slate-300 text-center font-mono text-green-600 font-semibold">+{row.freeQuota}</td>
                  <td className="py-2 px-3 border border-slate-300 text-center font-mono text-orange-600">{row.usedLeaves}</td>
                  <td className="py-2 px-3 border border-slate-300 text-center font-mono text-blue-600 font-semibold">{row.nextCarryForward}</td>
                  <td className="py-2 px-3 border border-slate-300 text-center font-mono text-red-500 font-semibold">{row.lopDays}</td>
                  <td className="py-2 px-3 border border-slate-300 text-right font-mono font-semibold text-slate-900">
                    {row.salaryDeduction > 0 ? `₹${row.salaryDeduction.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '₹0'}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">No active employees found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
          <p>Confidential Document. This report compiles attendance metrics and Loss of Pay (LOP) calculations for payroll verification.</p>
        </div>
      </div>
    </div>
  )
}
