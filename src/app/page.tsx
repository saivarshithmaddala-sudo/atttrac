import Link from 'next/link'
import { Building2, MapPin, ArrowRight, Lock } from 'lucide-react'

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 md:p-12 bg-slate-50 bg-grid-pattern relative overflow-hidden font-sans antialiased">
      {/* Radial glows in the background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(15,118,110,0.08),transparent_50%)] pointer-events-none z-0" />
      <div className="absolute top-[20%] left-[20%] w-[300px] h-[300px] bg-teal-500/5 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[20%] right-[20%] w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Top Navbar */}
      <div className="w-full max-w-5xl flex items-center justify-between py-4 px-6 bg-white/60 backdrop-blur-md border border-slate-200/50 rounded-2xl shadow-sm z-10">
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
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-950 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all shadow-sm"
          >
            <Lock className="w-3 h-3 text-slate-300" />
            Admin Portal
          </Link>
        </div>
      </div>

      {/* Center Layout */}
      <div className="my-auto w-full max-w-4xl flex flex-col items-center py-12 z-10">
        {/* Hero Header */}
        <div className="text-center max-w-2xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 border border-teal-200/50 text-teal-700 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4 shadow-sm">
            <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse" />
            Systems Operational
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-950 leading-tight">
            Enterprise Attendance <br/>
            <span className="bg-gradient-to-r from-accent to-emerald-500 bg-clip-text text-transparent">Workspace Directory</span>
          </h1>
          <p className="text-slate-500 text-sm md:text-base mt-4 leading-relaxed max-w-xl mx-auto">
            Choose your current duty station to record attendance punches, request leave ledger entries, and view digital payslips.
          </p>
        </div>

        {/* Workspace Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          {/* Office Workspace */}
          <Link 
            href="/office"
            className="group flex flex-col bg-white border border-slate-200/80 rounded-3xl p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_50px_rgba(15,118,110,0.07)] hover:border-slate-300 transition-all duration-300 text-left relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-teal-500/5 to-transparent rounded-bl-full pointer-events-none" />
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center mb-6 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-all duration-300 shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            
            <h2 className="text-xl font-bold text-slate-900 mb-2">Office Dashboard</h2>
            <p className="text-slate-500 text-xs leading-relaxed mb-6">
              Verify biometric punch logs, review status records, submit leave applications, and download generated payslips for office personnel.
            </p>

            <div className="flex flex-wrap gap-2 mb-8">
              <span className="px-2.5 py-1 bg-slate-50 border border-slate-200/60 text-slate-500 rounded-lg text-[9px] font-bold uppercase tracking-wider">Biometric ADMS</span>
              <span className="px-2.5 py-1 bg-slate-50 border border-slate-200/60 text-slate-500 rounded-lg text-[9px] font-bold uppercase tracking-wider">Leave Ledger</span>
              <span className="px-2.5 py-1 bg-slate-50 border border-slate-200/60 text-slate-500 rounded-lg text-[9px] font-bold uppercase tracking-wider">Automated Payroll</span>
            </div>
            
            <div className="mt-auto flex items-center gap-1.5 text-xs font-bold text-slate-900 group-hover:text-accent transition-colors">
              Enter Office Workspace
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
            </div>
          </Link>

          {/* Field Workspace */}
          <Link 
            href="/field"
            className="group flex flex-col bg-white border border-slate-200/80 rounded-3xl p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_50px_rgba(15,118,110,0.07)] hover:border-slate-300 transition-all duration-300 text-left relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-500/5 to-transparent rounded-bl-full pointer-events-none" />
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-6 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-sm">
              <MapPin className="w-5 h-5" />
            </div>
            
            <h2 className="text-xl font-bold text-slate-900 mb-2">Field Dashboard</h2>
            <p className="text-slate-500 text-xs leading-relaxed mb-6">
              Log coordinates, register remote attendance check-ins, synchronize geo-location stamps, and access field records.
            </p>

            <div className="flex flex-wrap gap-2 mb-8">
              <span className="px-2.5 py-1 bg-slate-50 border border-slate-200/60 text-slate-500 rounded-lg text-[9px] font-bold uppercase tracking-wider">GPS Tracking</span>
              <span className="px-2.5 py-1 bg-slate-50 border border-slate-200/60 text-slate-500 rounded-lg text-[9px] font-bold uppercase tracking-wider">Online Sync</span>
              <span className="px-2.5 py-1 bg-slate-50 border border-slate-200/60 text-slate-500 rounded-lg text-[9px] font-bold uppercase tracking-wider">Site Locations</span>
            </div>
            
            <div className="mt-auto flex items-center gap-1.5 text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
              Enter Field Workspace
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
            </div>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-5xl flex flex-col sm:flex-row justify-between items-center gap-4 py-6 border-t border-slate-200/60 text-[10px] text-slate-400 z-10">
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
