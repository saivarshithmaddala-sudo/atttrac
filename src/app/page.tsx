import Link from 'next/link'
import { Building2, MapPin, ArrowRight, Lock } from 'lucide-react'

export default function LandingPage() {
  return (
    <main className="flex h-screen flex-col items-center justify-between p-4 md:p-8 bg-slate-50 bg-grid-pattern relative overflow-hidden font-sans antialiased">
      {/* Radial glows in the background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(15,118,110,0.06),transparent_50%)] pointer-events-none z-0" />
      <div className="absolute top-[10%] left-[20%] w-[250px] h-[250px] bg-teal-500/5 rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="absolute bottom-[25%] right-[20%] w-[250px] h-[250px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none z-0" />

      {/* Top Navbar */}
      <div className="w-full max-w-5xl flex items-center justify-between py-3 px-5 bg-white/60 backdrop-blur-md border border-slate-200/50 rounded-2xl shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-900 to-slate-800 flex items-center justify-center shadow-md">
            <span className="text-white font-mono text-sm font-bold">A</span>
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-slate-800 block">Attendance Suite</span>
            <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider block -mt-0.5">Enterprise Portal</span>
          </div>
        </div>
        <div>
          <Link 
            href="/admin" 
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-950 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all shadow-sm"
          >
            <Lock className="w-3 h-3 text-slate-300" />
            Admin Portal
          </Link>
        </div>
      </div>

      {/* Center Layout */}
      <div className="flex-1 w-full max-w-4xl flex flex-col items-center justify-center py-4 z-10">
        {/* Hero Header */}
        <div className="text-center max-w-2xl mb-8">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 bg-teal-50 border border-teal-200/50 text-teal-700 rounded-full text-[9px] font-bold uppercase tracking-wider mb-3 shadow-sm">
            <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse" />
            Systems Operational
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-950 leading-tight">
            Enterprise Attendance <br/>
            <span className="bg-gradient-to-r from-accent to-emerald-500 bg-clip-text text-transparent">Workspace Directory</span>
          </h1>
          <p className="text-slate-500 text-xs md:text-sm mt-3 leading-relaxed max-w-lg mx-auto">
            Choose your current duty station to record attendance punches, request leave ledger entries, and view digital payslips.
          </p>
        </div>

        {/* Workspace Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-3xl">
          {/* Office Workspace */}
          <Link 
            href="/office"
            className="group flex flex-col bg-white border border-slate-200/80 rounded-2xl p-6 hover:shadow-[0_15px_40px_rgba(15,118,110,0.06)] hover:border-slate-300 transition-all duration-300 text-left relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-teal-500/5 to-transparent rounded-bl-full pointer-events-none" />
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center mb-4 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-all duration-300 shadow-sm">
              <Building2 className="w-4.5 h-4.5" />
            </div>
            
            <h2 className="text-lg font-bold text-slate-900 mb-1">Office Dashboard</h2>
            <p className="text-slate-500 text-[11px] leading-relaxed mb-4">
              Verify punch logs, check status records, submit leave applications, and view generated payslips for office staff.
            </p>

            <div className="flex flex-wrap gap-1.5 mb-6">
              <span className="px-2 py-0.5 bg-slate-50 border border-slate-200/60 text-slate-500 rounded-md text-[8px] font-bold uppercase tracking-wider">ADMS Punch</span>
              <span className="px-2 py-0.5 bg-slate-50 border border-slate-200/60 text-slate-500 rounded-md text-[8px] font-bold uppercase tracking-wider">Leave Ledger</span>
              <span className="px-2 py-0.5 bg-slate-50 border border-slate-200/60 text-slate-500 rounded-md text-[8px] font-bold uppercase tracking-wider">Payroll</span>
            </div>
            
            <div className="mt-auto flex items-center gap-1.5 text-[11px] font-bold text-slate-900 group-hover:text-accent transition-colors">
              Enter Office Workspace
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-300" />
            </div>
          </Link>

          {/* Field Workspace */}
          <Link 
            href="/field"
            className="group flex flex-col bg-white border border-slate-200/80 rounded-2xl p-6 hover:shadow-[0_15px_40px_rgba(15,118,110,0.06)] hover:border-slate-300 transition-all duration-300 text-left relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500/5 to-transparent rounded-bl-full pointer-events-none" />
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-sm">
              <MapPin className="w-4.5 h-4.5" />
            </div>
            
            <h2 className="text-lg font-bold text-slate-900 mb-1">Field Dashboard</h2>
            <p className="text-slate-500 text-[11px] leading-relaxed mb-4">
              Log Coordinates, register remote attendance logs, check geo-location stamps, and synchronize off-site activities.
            </p>

            <div className="flex flex-wrap gap-1.5 mb-6">
              <span className="px-2 py-0.5 bg-slate-50 border border-slate-200/60 text-slate-500 rounded-md text-[8px] font-bold uppercase tracking-wider">GPS Logs</span>
              <span className="px-2 py-0.5 bg-slate-50 border border-slate-200/60 text-slate-500 rounded-md text-[8px] font-bold uppercase tracking-wider">Online Sync</span>
              <span className="px-2 py-0.5 bg-slate-50 border border-slate-200/60 text-slate-500 rounded-md text-[8px] font-bold uppercase tracking-wider">Map Sites</span>
            </div>
            
            <div className="mt-auto flex items-center gap-1.5 text-[11px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
              Enter Field Workspace
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-300" />
            </div>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-5xl flex flex-col sm:flex-row justify-between items-center gap-3 py-4 border-t border-slate-200/60 text-[9px] text-slate-400 z-10 shrink-0">
        <p>&copy; {new Date().getFullYear()} Attendance Systems. All rights reserved.</p>
        <div className="flex gap-4">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Secure ADMS Connection</span>
          <span>CockroachDB</span>
          <span>Vercel Optimized</span>
        </div>
      </div>
    </main>
  )
}
