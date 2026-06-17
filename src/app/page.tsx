import Link from 'next/link'
import { Building2, MapPin, ArrowRight, Lock } from 'lucide-react'

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 md:p-12 bg-[#fafafa] font-sans antialiased">
      {/* Top Navbar */}
      <div className="w-full max-w-5xl flex items-center justify-between py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center">
            <span className="text-white font-mono text-xs font-bold">A</span>
          </div>
          <span className="font-semibold text-sm tracking-tight text-slate-800">Attendance Suite</span>
        </div>
        <div>
          <Link 
            href="/admin" 
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <Lock className="w-3 h-3" />
            Admin Portal
          </Link>
        </div>
      </div>

      {/* Center Layout */}
      <div className="my-auto w-full max-w-4xl flex flex-col items-center py-12">
        {/* Hero Header */}
        <div className="text-center max-w-xl mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Workspace Directory</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-950">
            Select your workspace
          </h1>
          <p className="text-slate-500 text-sm mt-3 leading-relaxed">
            Choose your current duty station to record attendance, manage leave requests, and view monthly payslips.
          </p>
        </div>

        {/* Workspace Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          {/* Office Workspace */}
          <Link 
            href="/office"
            className="group flex flex-col bg-white border border-slate-200/80 rounded-2xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all duration-300 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-6 group-hover:bg-slate-900 group-hover:text-white transition-colors duration-300 text-slate-500">
              <Building2 className="w-5 h-5" />
            </div>
            
            <h2 className="text-lg font-medium text-slate-900 mb-2">Office Staff</h2>
            <p className="text-slate-500 text-xs leading-relaxed mb-8">
              Verify attendance logs, check biometric statuses, submit leave applications, and view generated payslips for headquarters and branch office personnel.
            </p>
            
            <div className="mt-auto flex items-center gap-1.5 text-xs font-semibold text-slate-900 group-hover:text-slate-600 transition-colors">
              Access Office Dashboard
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* Field Workspace */}
          <Link 
            href="/field"
            className="group flex flex-col bg-white border border-slate-200/80 rounded-2xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all duration-300 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-6 group-hover:bg-slate-900 group-hover:text-white transition-colors duration-300 text-slate-500">
              <MapPin className="w-5 h-5" />
            </div>
            
            <h2 className="text-lg font-medium text-slate-900 mb-2">Field Operations</h2>
            <p className="text-slate-500 text-xs leading-relaxed mb-8">
              Log daily site coordinates, record remote attendance, synchronize field activity, and access outdoor operations records.
            </p>
            
            <div className="mt-auto flex items-center gap-1.5 text-xs font-semibold text-slate-900 group-hover:text-slate-600 transition-colors">
              Access Field Dashboard
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-5xl flex justify-between py-6 border-t border-slate-200/60 text-[11px] text-slate-400">
        <p>&copy; {new Date().getFullYear()} Attendance Systems. All rights reserved.</p>
        <div className="flex gap-4">
          <span>Secure ADMS Connection</span>
          <span>CockroachDB</span>
        </div>
      </div>
    </main>
  )
}
