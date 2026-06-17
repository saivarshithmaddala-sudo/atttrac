'use client'

import { useState, useEffect } from 'react'

interface BiometricStatus {
  total: number
  processed: number
  unprocessed: number
  exceptions: { deviceUserId: string; count: number; lastSeen: string; source: string }[]
  recentSyncs: { source: string; createdAt: string }[]
  machineConfig: { ip: string | null; port: string; admsUrl: string | null }
}

export default function BiometricSettingsPage() {
  const [status, setStatus] = useState<BiometricStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [machineIp, setMachineIp] = useState('')
  const [machinePort, setMachinePort] = useState('4370')
  const [commKey, setCommKey] = useState('0')
  const [activeTab, setActiveTab] = useState<'status' | 'sync' | 'adms' | 'mapping'>('status')

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/biometric/status')
      const data = await res.json()
      setStatus(data)
      if (data.machineConfig?.ip) setMachineIp(data.machineConfig.ip)
      if (data.machineConfig?.port) setMachinePort(data.machineConfig.port)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 15000) // refresh every 15s
    return () => clearInterval(interval)
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    setSyncError(null)
    try {
      const res = await fetch('/api/biometric/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: machineIp, port: parseInt(machinePort), commKey: parseInt(commKey) })
      })
      const data = await res.json()
      if (!res.ok) {
        setSyncError(data.error + (data.details ? '\n' + data.details : ''))
      } else {
        setSyncResult(`✅ ${data.message}`)
        await fetchStatus()
      }
    } catch (e: any) {
      setSyncError(e.message)
    } finally {
      setSyncing(false)
    }
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'http://YOUR_SERVER:3000'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900/80 backdrop-blur px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold">ESSL Biometric Integration</h1>
            <p className="text-slate-400 text-sm">Connect and sync attendance from your biometric machine</p>
          </div>
          <a href="/office" className="ml-auto text-sm text-slate-400 hover:text-white flex items-center gap-1">
            ← Back to Dashboard
          </a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 bg-slate-800/50 rounded-xl p-1">
          {[
            { key: 'status', label: '📊 Status' },
            { key: 'sync', label: '🔄 TCP Sync' },
            { key: 'adms', label: '📡 ADMS Push Setup' },
            { key: 'mapping', label: '🗂️ Device Mapping' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* STATUS TAB */}
        {activeTab === 'status' && (
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-20 text-slate-400">Loading...</div>
            ) : (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Total Raw Punches', value: status?.total ?? 0, color: 'blue' },
                    { label: 'Processed', value: status?.processed ?? 0, color: 'green' },
                    { label: 'Pending', value: status?.unprocessed ?? 0, color: 'orange' },
                  ].map(stat => (
                    <div key={stat.label} className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                      <p className="text-slate-400 text-sm">{stat.label}</p>
                      <p className={`text-3xl font-bold mt-1 ${
                        stat.color === 'green' ? 'text-green-400' :
                        stat.color === 'orange' ? 'text-orange-400' : 'text-blue-400'
                      }`}>{stat.value.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                {/* Machine Config */}
                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                  <h3 className="font-semibold mb-3 text-slate-200">Machine Configuration</h3>
                  {status?.machineConfig.ip ? (
                    <div className="flex gap-6 text-sm">
                      <div><span className="text-slate-400">IP:</span> <span className="text-white font-mono">{status.machineConfig.ip}</span></div>
                      <div><span className="text-slate-400">Port:</span> <span className="text-white font-mono">{status.machineConfig.port}</span></div>
                    </div>
                  ) : (
                    <p className="text-orange-400 text-sm">⚠️ Machine IP not configured in .env (BIOMETRIC_IP)</p>
                  )}
                </div>

                {/* Exceptions */}
                {status?.exceptions && status.exceptions.length > 0 && (
                  <div className="bg-slate-800 rounded-xl p-5 border border-red-800">
                    <h3 className="font-semibold mb-3 text-red-400">⚠️ Unmapped Device Users ({status.exceptions.length})</h3>
                    <p className="text-slate-400 text-xs mb-3">These device user IDs have punch records but are not linked to any candidate. Set their Device User ID in candidate settings.</p>
                    <div className="space-y-2">
                      {status.exceptions.map(ex => (
                        <div key={ex.deviceUserId} className="flex items-center justify-between bg-slate-900 rounded-lg px-4 py-2 text-sm">
                          <span className="font-mono text-red-300">ID: {ex.deviceUserId}</span>
                          <span className="text-slate-400">{ex.count} punch(es)</span>
                          <span className="text-slate-500 text-xs">{new Date(ex.lastSeen).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Syncs */}
                {status?.recentSyncs && status.recentSyncs.length > 0 && (
                  <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                    <h3 className="font-semibold mb-3 text-slate-200">Recent Sync Activity</h3>
                    <div className="space-y-1">
                      {status.recentSyncs.map((s, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="font-mono text-slate-400">{s.source}</span>
                          <span className="text-slate-500 text-xs">{new Date(s.createdAt).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TCP SYNC TAB */}
        {activeTab === 'sync' && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h2 className="text-lg font-semibold mb-1">Direct TCP Sync</h2>
              <p className="text-slate-400 text-sm mb-6">
                Connects directly to your ESSL machine over the network using the ZKTeco protocol (port 4370).
                Both the machine and this server must be on the same LAN, or the machine must be reachable via IP.
              </p>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Machine IP Address *</label>
                  <input
                    type="text"
                    value={machineIp}
                    onChange={e => setMachineIp(e.target.value)}
                    placeholder="192.168.1.100"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Port</label>
                  <input
                    type="number"
                    value={machinePort}
                    onChange={e => setMachinePort(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Comm Key (password)</label>
                  <input
                    type="number"
                    value={commKey}
                    onChange={e => setCommKey(e.target.value)}
                    placeholder="0 (none)"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleSync}
                disabled={syncing || !machineIp}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
              >
                {syncing ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    Connecting and syncing...
                  </>
                ) : (
                  '🔄 Pull Attendance from Machine Now'
                )}
              </button>

              {syncResult && (
                <div className="mt-4 bg-green-900/30 border border-green-700 rounded-lg p-4 text-green-300 text-sm">
                  {syncResult}
                </div>
              )}
              {syncError && (
                <div className="mt-4 bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 text-sm whitespace-pre-line">
                  ❌ {syncError}
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-600 text-sm space-y-2">
              <h3 className="font-semibold text-slate-200 mb-2">Prerequisites</h3>
              <ul className="text-slate-400 space-y-1 list-disc list-inside">
                <li>Machine and this computer must be on the <strong className="text-white">same LAN/network</strong></li>
                <li>Check the machine IP: <strong className="text-white">Menu → Communication → Ethernet → IP Address</strong></li>
                <li>Default port is <strong className="text-white">4370</strong> (TCP)</li>
                <li>Comm Key is usually <strong className="text-white">0</strong> unless you set a password</li>
                <li>Firewall must allow port 4370 on the machine's IP</li>
              </ul>
            </div>

            {/* Save to env hint */}
            <div className="bg-blue-900/20 rounded-xl p-5 border border-blue-800 text-sm">
              <h3 className="font-semibold text-blue-300 mb-2">💡 Save as default in .env</h3>
              <p className="text-slate-400 mb-2">Add these to your <code className="text-blue-300">.env</code> file so the IP is pre-filled:</p>
              <pre className="bg-slate-900 rounded-lg p-3 text-blue-200 font-mono text-xs">
{`BIOMETRIC_IP=${machineIp || '192.168.1.100'}
BIOMETRIC_PORT=${machinePort}
BIOMETRIC_COMM_KEY=${commKey}`}
              </pre>
            </div>
          </div>
        )}

        {/* ADMS PUSH SETUP TAB */}
        {activeTab === 'adms' && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h2 className="text-lg font-semibold mb-1">ADMS Auto-Push Setup</h2>
              <p className="text-slate-400 text-sm mb-6">
                Configure the biometric machine to <strong className="text-white">automatically push</strong> punch data to this server
                every time someone scans. No manual sync required.
              </p>

              <div className="bg-slate-900 rounded-xl p-5 border border-blue-800 mb-6">
                <p className="text-xs text-slate-400 mb-1">Your ADMS endpoint URL</p>
                <div className="flex items-center gap-3">
                  <code className="text-blue-300 text-sm font-mono flex-1 break-all">{appUrl}/api/biometric/adms</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(`${appUrl}/api/biometric/adms`)}
                    className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <h3 className="font-semibold text-slate-200 mb-3">Step-by-Step Machine Configuration</h3>
              <div className="space-y-4">
                {[
                  {
                    step: '1',
                    title: 'Access Communication Settings',
                    desc: 'On the machine, press Menu → Communication → ADMS (may also be called "Cloud Server" or "Server Settings")'
                  },
                  {
                    step: '2',
                    title: 'Enable ADMS',
                    desc: 'Set "Enable ADMS" or "HTTPS Push" to ON / Yes'
                  },
                  {
                    step: '3',
                    title: 'Set Server Address',
                    desc: `Enter your server IP or domain without http://. Example: YOUR_SERVER_IP:3000`
                  },
                  {
                    step: '4',
                    title: 'Set Server Path',
                    desc: 'Set the path to: /api/biometric/adms'
                  },
                  {
                    step: '5',
                    title: 'Set Port',
                    desc: 'Set to 3000 (or 80/443 if behind a proxy)'
                  },
                  {
                    step: '6',
                    title: 'Save & Test',
                    desc: 'Save settings. The machine will now push each punch to your server automatically.'
                  },
                ].map(item => (
                  <div key={item.step} className="flex gap-4">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                      {item.step}
                    </div>
                    <div>
                      <p className="font-medium text-slate-200">{item.title}</p>
                      <p className="text-slate-400 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-600 text-sm">
              <h3 className="font-semibold text-slate-200 mb-2">⚠️ Important Notes</h3>
              <ul className="text-slate-400 space-y-1 list-disc list-inside">
                <li>The machine must be able to reach this server over the network</li>
                <li>If this server only runs on <code className="text-white">localhost</code>, the machine cannot push to it unless you expose it via ngrok or deploy to a server</li>
                <li>For local network: use your computer's LAN IP (e.g. <code className="text-white">192.168.1.x</code>)</li>
                <li>For internet access: deploy to a cloud server or use ngrok</li>
              </ul>
            </div>
          </div>
        )}

        {/* DEVICE MAPPING TAB */}
        {activeTab === 'mapping' && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h2 className="text-lg font-semibold mb-1">Device User ID Mapping</h2>
              <p className="text-slate-400 text-sm mb-4">
                Each candidate must have a <strong className="text-white">Device User ID</strong> that matches their enrollment number on the biometric machine.
                Set this in the candidate profile (edit candidate on the dashboard).
              </p>

              <div className="bg-slate-900 rounded-xl p-5 text-sm space-y-3">
                <h3 className="font-semibold text-slate-200">How to find Device User IDs on machine</h3>
                <ol className="text-slate-400 space-y-1 list-decimal list-inside">
                  <li>Go to <strong className="text-white">Menu → User Management</strong></li>
                  <li>Each enrolled user has an <strong className="text-white">ID number</strong> (e.g. 1, 2, 3…)</li>
                  <li>That ID must match the <strong className="text-white">Device User ID</strong> field in the candidate profile</li>
                </ol>
              </div>

              {status?.exceptions && status.exceptions.length > 0 ? (
                <div className="mt-4">
                  <h3 className="font-semibold text-red-400 mb-2">Unrecognized Device IDs (need mapping)</h3>
                  <div className="space-y-2">
                    {status.exceptions.map(ex => (
                      <div key={ex.deviceUserId} className="flex items-center gap-3 bg-slate-900 rounded-lg px-4 py-3 text-sm">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span className="font-mono text-red-300 flex-1">Device ID: <strong>{ex.deviceUserId}</strong></span>
                        <span className="text-slate-400">{ex.count} punch record(s)</span>
                        <span className="text-slate-500 text-xs">Last: {new Date(ex.lastSeen).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-slate-400 text-xs">
                    → Go to Dashboard → Edit the matching candidate → Set "Device User ID" to one of the above IDs
                  </p>
                </div>
              ) : (
                <div className="mt-4 text-green-400 text-sm">✅ All device IDs are mapped to candidates.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
