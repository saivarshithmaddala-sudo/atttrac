import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processPunches } from '@/lib/jobs/ingestionProcessor'

/**
 * ESSL/ZKTeco ADMS Push Endpoint
 *
 * The biometric machine is configured with this server's URL under:
 *   Communication > Cloud Settings > Server Address
 *
 * The machine sends HTTP GET/POST requests with query params or form body.
 * Common ADMS format:
 *   GET /api/biometric/adms?action=ping&SN=DEVICE123
 *   POST /api/biometric/adms  body: SN=DEVICE123&table=ATTLOG&Stamp=...
 *   ATTLOG row: "userId\tpunchTime\tpunchType\t..."
 *
 * This endpoint handles both GET (ping/handshake) and POST (data push).
 */

const ALLOWED_SERIAL = process.env.BIOMETRIC_DEVICE_SERIAL // optional allowlist

function parseATTLOG(body: string): Array<{ deviceUserId: string; timestamp: Date; punchType: string | null }> {
  const punches: Array<{ deviceUserId: string; timestamp: Date; punchType: string | null }> = []

  const lines = body.split('\n').map(l => l.trim()).filter(Boolean)
  for (const line of lines) {
    // Tab-separated: userId  datetime  status  verify  workCode  reserved
    const parts = line.split('\t')
    if (parts.length < 2) continue

    const deviceUserId = parts[0].trim()
    const rawTs = parts[1].trim()  // e.g. "2026-06-16 09:05:00"
    const statusCode = parts[2]?.trim() ?? null

    // Parse datetime (YYYY-MM-DD HH:MM:SS → ISO)
    let timestamp: Date
    try {
      // Convert "2026-06-16 09:05:00" to ISO 8601 in IST (UTC+5:30) then store as UTC
      const isoStr = rawTs.replace(' ', 'T') + '+05:30'
      timestamp = new Date(isoStr)
      if (isNaN(timestamp.getTime())) continue
    } catch {
      continue
    }

    // Status codes: 0=check-in, 1=check-out, 2=break-out, 3=break-in, 4=OT-in, 5=OT-out
    let punchType: string | null = null
    if (statusCode === '0') punchType = 'IN'
    else if (statusCode === '1') punchType = 'OUT'

    punches.push({ deviceUserId, timestamp, punchType })
  }

  return punches
}

// Handle GET — machine ping / handshake
export async function GET(request: Request) {
  const url = new URL(request.url)
  const action = url.searchParams.get('action')
  const sn = url.searchParams.get('SN') || url.searchParams.get('DeviceSN') || 'UNKNOWN'

  console.log(`[ADMS] GET ping from device SN=${sn} action=${action}`)

  // Respond with empty body — machine expects this to confirm server is alive
  return new Response('', { status: 200 })
}

// Handle POST — machine sends attendance data
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let body = await request.text()

    console.log(`[ADMS] POST received, content-type=${contentType}`)

    // Extract table type (ATTLOG, OPERLOG, etc.)
    // The body may start with "table=ATTLOG\n" or just be raw ATTLOG lines
    let table = 'ATTLOG'
    let sn = 'UNKNOWN'
    let attlogData = body

    // Try to parse header lines
    const headerMatch = body.match(/^SN=([^\n\r]+)/m)
    if (headerMatch) sn = headerMatch[1].trim()

    const tableMatch = body.match(/^table=([^\n\r]+)/m)
    if (tableMatch) {
      table = tableMatch[1].trim()
      // Remove header lines — data starts after empty line
      const dataStart = body.indexOf('\n\n')
      if (dataStart !== -1) {
        attlogData = body.substring(dataStart + 2)
      }
    }

    if (ALLOWED_SERIAL && sn !== ALLOWED_SERIAL) {
      console.warn(`[ADMS] Rejected unknown device SN=${sn}`)
      return new Response('', { status: 403 })
    }

    if (table !== 'ATTLOG') {
      // We only handle attendance logs
      return new Response('OK', { status: 200 })
    }

    const punches = parseATTLOG(attlogData)
    console.log(`[ADMS] Parsed ${punches.length} punch records from device ${sn}`)

    if (punches.length > 0) {
      await prisma.rawPunchLog.createMany({
        data: punches.map(p => ({
          deviceUserId: p.deviceUserId,
          timestamp: p.timestamp,
          punchType: p.punchType,
          source: `adms:${sn}`,
          processed: false
        })),
        skipDuplicates: true
      })

      processPunches().catch(console.error)
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('[ADMS] Error:', error)
    return new Response('ERROR', { status: 500 })
  }
}
