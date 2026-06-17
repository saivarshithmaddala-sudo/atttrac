'use client'

import { useState, useRef, useEffect } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { Upload, Plus, Save, AlertCircle, ArrowLeft, Search, Edit, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'candidate' | 'manual' | 'bulk' | 'leave'>('candidate')
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [allCandidates, setAllCandidates] = useState<any[]>([])
  const [tableCandidates, setTableCandidates] = useState<any[]>([])
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1
  })
  const [activeFilter, setActiveFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  // Candidate Form Modal
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [isFormSubmitting, setIsFormSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [candidateForm, setCandidateForm] = useState({
    id: '', aeId: '', name: '', type: 'FULL_TIME', workLocation: 'OFFICE', ctcAnnual: '', joiningDate: '', deviceUserId: '', workingSaturdays: ['1', '3'] as string[]
  })

  // Confirmation Modals
  const [deactivateConfirm, setDeactivateConfirm] = useState<{ isOpen: boolean; candidate: any } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    candidate: any;
    confirmName: string;
    hasHistory: boolean;
    historyMessage: string;
    force: boolean;
  } | null>(null)

  const fetchTableCandidates = async (page = currentPage, filter = activeFilter, search = searchTerm) => {
    setIsLoading(true)
    try {
      const url = `/api/candidates?page=${page}&limit=10&active=${filter}&search=${encodeURIComponent(search)}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setTableCandidates(data.candidates)
        setPagination(data.pagination)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAllCandidates = async () => {
    try {
      const res = await fetch('/api/candidates')
      if (res.ok) {
        const data = await res.json()
        setAllCandidates(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchAllCandidates()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTableCandidates(currentPage, activeFilter, searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [currentPage, activeFilter, searchTerm])

  const handleSearchChange = (val: string) => {
    setSearchTerm(val)
    setCurrentPage(1)
  }

  const handleFilterChange = (val: 'active' | 'inactive' | 'all') => {
    setActiveFilter(val)
    setCurrentPage(1)
  }

  const handleCandidateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsFormSubmitting(true)
    setFieldErrors({})
    try {
      const isEdit = !!candidateForm.id
      const url = isEdit ? `/api/candidates/${candidateForm.id}` : '/api/candidates'
      const method = isEdit ? 'PUT' : 'POST'

      const payload = {
        aeId: candidateForm.aeId.trim(),
        name: candidateForm.name.trim(),
        type: candidateForm.type,
        workLocation: candidateForm.workLocation,
        ctcAnnual: parseFloat(candidateForm.ctcAnnual),
        joiningDate: candidateForm.joiningDate,
        deviceUserId: (candidateForm.deviceUserId || candidateForm.aeId).trim()
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        setMessage({ type: 'success', text: `Candidate ${isEdit ? 'updated' : 'added'} successfully!` })
        setIsFormModalOpen(false)
        setCandidateForm({ id: '', aeId: '', name: '', type: 'FULL_TIME', workLocation: 'OFFICE', ctcAnnual: '', joiningDate: '', deviceUserId: '', workingSaturdays: ['1', '3'] })
        fetchTableCandidates(currentPage, activeFilter, searchTerm)
        fetchAllCandidates()
      } else {
        const errorData = await res.json()
        if (errorData.field) {
          setFieldErrors({ [errorData.field]: errorData.message })
        } else {
          setMessage({ type: 'error', text: errorData.error || `Failed to ${isEdit ? 'update' : 'add'} candidate.` })
        }
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'An unexpected error occurred.' })
    } finally {
      setIsFormSubmitting(false)
    }
  }

  const handleEditCandidate = (c: any) => {
    setCandidateForm({
      id: c.id,
      aeId: c.aeId,
      name: c.name,
      type: c.type,
      workLocation: c.workLocation || 'OFFICE',
      ctcAnnual: c.ctcAnnual ? c.ctcAnnual.toString() : '',
      joiningDate: new Date(c.joiningDate).toISOString().split('T')[0],
      deviceUserId: c.deviceUserId || c.aeId,
      workingSaturdays: c.workingSaturdays ? c.workingSaturdays.split(',').map((s: string) => s.trim()) : ['1', '3']
    })
    setFieldErrors({})
    setIsFormModalOpen(true)
  }

  const handleToggleStatus = (c: any) => {
    setDeactivateConfirm({ isOpen: true, candidate: c })
  }

  const confirmToggleStatus = async () => {
    if (!deactivateConfirm) return
    const { candidate } = deactivateConfirm
    const newActive = !candidate.active
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newActive })
      })
      if (res.ok) {
        setMessage({ type: 'success', text: `Candidate ${candidate.name} is now ${newActive ? 'Active' : 'Inactive'}.` })
        setDeactivateConfirm(null)
        fetchTableCandidates(currentPage, activeFilter, searchTerm)
        fetchAllCandidates()
      } else {
        throw new Error()
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update candidate status.' })
    }
  }

  const handleDeleteCandidate = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/candidates/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setMessage({ type: 'success', text: `Candidate ${name} deleted successfully!` })
        fetchTableCandidates(currentPage, activeFilter, searchTerm)
        fetchAllCandidates()
        if (candidateForm.id === id) {
          setCandidateForm({ id: '', aeId: '', name: '', type: 'FULL_TIME', workLocation: 'OFFICE', ctcAnnual: '', joiningDate: '', deviceUserId: '', workingSaturdays: ['1', '3'] })
        }
      } else if (res.status === 409) {
        const errorData = await res.json()
        if (errorData.error === 'HAS_HISTORY') {
          const candidate = tableCandidates.find(c => c.id === id) || allCandidates.find(c => c.id === id)
          setDeleteConfirm({
            isOpen: true,
            candidate,
            confirmName: '',
            hasHistory: true,
            historyMessage: errorData.message,
            force: true
          })
        }
      } else {
        throw new Error('Failed')
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to delete candidate.' })
    }
  }

  const confirmDeleteCandidate = async () => {
    if (!deleteConfirm) return
    const { candidate, force } = deleteConfirm
    try {
      const url = `/api/candidates/${candidate.id}${force ? '?force=true' : ''}`
      const res = await fetch(url, { method: 'DELETE' })
      if (res.ok) {
        setMessage({ type: 'success', text: `Candidate ${candidate.name} and all historical records deleted successfully!` })
        setDeleteConfirm(null)
        fetchTableCandidates(currentPage, activeFilter, searchTerm)
        fetchAllCandidates()
        if (candidateForm.id === candidate.id) {
          setCandidateForm({ id: '', aeId: '', name: '', type: 'FULL_TIME', workLocation: 'OFFICE', ctcAnnual: '', joiningDate: '', deviceUserId: '', workingSaturdays: ['1', '3'] })
        }
      } else {
        throw new Error()
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete candidate.' })
    }
  }

  // Manual Log Form
  const [logForm, setLogForm] = useState({
    candidateId: '', date: '', loginTime: '', logoutTime: '', status: 'AUTO'
  })

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Combine date and time
      const login = logForm.loginTime ? new Date(`${logForm.date}T${logForm.loginTime}`).toISOString() : null
      const logout = logForm.logoutTime ? new Date(`${logForm.date}T${logForm.logoutTime}`).toISOString() : null
      
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: logForm.candidateId,
          date: new Date(logForm.date).toISOString(),
          loginTime: login,
          logoutTime: logout,
          status: logForm.status
        })
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Log entry saved!' })
        setLogForm({ ...logForm, loginTime: '', logoutTime: '', status: 'AUTO' }) // keep candidate and date
      } else throw new Error('Failed')
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to save log entry.' })
    }
  }

  const handleRemoveLog = async () => {
    if (!logForm.candidateId || !logForm.date) {
      alert('Please select a candidate and date to remove attendance log.')
      return
    }
    
    const candidate = allCandidates.find(c => c.id === logForm.candidateId)
    if (!window.confirm(`Are you sure you want to permanently remove the attendance log for ${candidate?.name} on ${logForm.date}?`)) return
    
    try {
      const dateISO = new Date(logForm.date).toISOString()
      const res = await fetch(`/api/logs?candidateId=${logForm.candidateId}&date=${encodeURIComponent(dateISO)}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Attendance log entry removed successfully!' })
        setLogForm({ ...logForm, loginTime: '', logoutTime: '', status: 'AUTO' })
      } else {
        const err = await res.json().catch(() => ({}))
        setMessage({ type: 'error', text: err.error || 'Failed to remove log entry.' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to remove log entry.' })
    }
  }

  // Leave Management Form
  const [leaveForm, setLeaveForm] = useState({
    candidateId: '', date: '', credit: '', debit: '', description: ''
  })
  const [exportMonth, setExportMonth] = useState('')

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/leave/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: leaveForm.candidateId,
          date: leaveForm.date,
          credit: leaveForm.credit || '0',
          debit: leaveForm.debit || '0',
          description: leaveForm.description
        })
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Leave adjustment saved!' })
        setLeaveForm({ ...leaveForm, credit: '', debit: '', description: '' })
      } else throw new Error('Failed')
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to save leave adjustment.' })
    }
  }

  // CSV Import
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [csvErrors, setCsvErrors] = useState<string[]>([])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const getValue = (obj: any, keys: string[]) => {
      if (!obj) return undefined
      const lowerKeys = keys.map(k => k.toLowerCase().replace(/[\s_-]+/g, ''))
      for (const rawKey of Object.keys(obj)) {
        const normalizedKey = rawKey.toLowerCase().replace(/[\s_-]+/g, '')
        if (lowerKeys.includes(normalizedKey)) {
          return obj[rawKey]
        }
      }
      return undefined
    }

    const parseDateVal = (val: any) => {
      if (!val) return ''
      if (typeof val === 'number') {
        // Excel serial number date
        const date = new Date(Math.round((val - 25569) * 86400 * 1000))
        const y = date.getUTCFullYear()
        const m = String(date.getUTCMonth() + 1).padStart(2, '0')
        const d = String(date.getUTCDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
      }
      if (val instanceof Date) {
        const y = val.getUTCFullYear()
        const m = String(val.getUTCMonth() + 1).padStart(2, '0')
        const d = String(val.getUTCDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
      }
      let str = String(val).trim()
      // If matches MM/DD/YYYY, convert to YYYY-MM-DD
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
        const parts = str.split('/')
        const m = parts[0].padStart(2, '0')
        const d = parts[1].padStart(2, '0')
        const y = parts[2]
        return `${y}-${m}-${d}`
      }
      return str
    }

    const parseTimeVal = (val: any) => {
      if (!val) return null
      if (typeof val === 'number') {
        // Excel time serial (fraction of a day)
        const totalMinutes = Math.round(val * 24 * 60)
        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60
        const hh = String(hours).padStart(2, '0')
        const mm = String(minutes).padStart(2, '0')
        return `${hh}:${mm}`
      }
      if (val instanceof Date) {
        const hh = String(val.getUTCHours()).padStart(2, '0')
        const mm = String(val.getUTCMinutes()).padStart(2, '0')
        return `${hh}:${mm}`
      }
      let str = String(val).trim()
      // Match HH:MM or HH:MM:SS
      const match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
      if (match) {
        const hh = match[1].padStart(2, '0')
        const mm = match[2]
        return `${hh}:${mm}`
      }
      // AM/PM match
      const match12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
      if (match12) {
        let hh = parseInt(match12[1], 10)
        const mm = match12[2]
        const ampm = match12[3].toUpperCase()
        if (ampm === 'PM' && hh < 12) hh += 12
        if (ampm === 'AM' && hh === 12) hh = 0
        return `${String(hh).padStart(2, '0')}:${mm}`
      }
      return str
    }

    const processRows = async (rows: any[]) => {
      const errors: string[] = []
      const validLogs: any[] = []

      if (!rows || rows.length === 0) {
        setCsvErrors(['The file contains no data rows.'])
        setMessage({ type: 'error', text: 'No rows found in file.' })
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      // Check headers on first valid row
      const sampleRow = rows.find(r => r && Object.keys(r).length > 0)
      if (!sampleRow) {
        setCsvErrors(['The file contains no valid data rows with headers.'])
        setMessage({ type: 'error', text: 'Missing data headers.' })
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      const headers = Object.keys(sampleRow)
      const hasAeId = headers.some(h => ['ae_id', 'aeid', 'ae id', 'ae-id', 'employeeid', 'candidateid', 'empid', 'id', 'employeecode', 'userid', 'user_id'].includes(h.toLowerCase().replace(/[\s_-]+/g, '')))
      const hasDate = headers.some(h => ['date', 'date_val', 'attendance_date', 'day'].includes(h.toLowerCase().replace(/[\s_-]+/g, '')))

      if (!hasAeId || !hasDate) {
        setCsvErrors([
          `Required columns missing. Found headers: [${headers.join(', ')}]`,
          'Please ensure your sheet contains column headers for: "AE_ID" (or Employee ID) and "Date".'
        ])
        setMessage({ type: 'error', text: 'Missing required columns.' })
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      rows.forEach((row, i) => {
        try {
          const rawAeId = getValue(row, ['AE_ID', 'ae_id', 'aeId', 'AE ID', 'AE-ID', 'employeeid', 'candidateid', 'empid', 'id', 'employeecode', 'userid', 'user_id'])
          if (rawAeId === undefined || rawAeId === null || String(rawAeId).trim() === '') return // skip empty line silently

          const aeId = String(rawAeId).trim()
          const c = allCandidates.find(can => can.aeId === aeId)
          if (!c) {
            errors.push(`Row ${i + 1}: AE_ID "${aeId}" not found in candidate list.`)
            return
          }

          const rawDate = getValue(row, ['date', 'Date', 'DATE', 'date_val', 'attendance_date', 'day'])
          const dateStr = parseDateVal(rawDate)
          if (!dateStr) {
            errors.push(`Row ${i + 1} (${aeId}): Missing or invalid Date.`)
            return
          }

          // Validate date format YYYY-MM-DD
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            errors.push(`Row ${i + 1} (${aeId}): Invalid date format "${dateStr}". Expected YYYY-MM-DD`)
            return
          }

          const rawLogin = getValue(row, ['login_time', 'loginTime', 'login', 'in', 'in_time', 'intime', 'punch_in', 'check_in'])
          const rawLogout = getValue(row, ['logout_time', 'logoutTime', 'logout', 'out', 'out_time', 'outtime', 'punch_out', 'check_out'])

          const loginTimeStr = parseTimeVal(rawLogin)
          const logoutTimeStr = parseTimeVal(rawLogout)

          if (rawLogin && !loginTimeStr) {
            errors.push(`Row ${i + 1} (${aeId}): Invalid login_time format (${rawLogin}). Expected HH:mm`)
            return
          }
          if (rawLogout && !logoutTimeStr) {
            errors.push(`Row ${i + 1} (${aeId}): Invalid logout_time format (${rawLogout}). Expected HH:mm`)
            return
          }

          let login = null
          let logout = null

          if (loginTimeStr) {
            const loginDate = new Date(`${dateStr}T${loginTimeStr}`)
            if (isNaN(loginDate.getTime())) {
              errors.push(`Row ${i + 1} (${aeId}): Invalid login time combined value.`)
              return
            }
            login = loginDate.toISOString()
          }

          if (logoutTimeStr) {
            const logoutDate = new Date(`${dateStr}T${logoutTimeStr}`)
            if (isNaN(logoutDate.getTime())) {
              errors.push(`Row ${i + 1} (${aeId}): Invalid logout time combined value.`)
              return
            }
            logout = logoutDate.toISOString()
          }

          const dateObj = new Date(dateStr)
          if (isNaN(dateObj.getTime())) {
            errors.push(`Row ${i + 1} (${aeId}): Invalid date value.`)
            return
          }

          validLogs.push({
            candidateId: c.id,
            date: dateObj.toISOString(),
            loginTime: login,
            logoutTime: logout
          })
        } catch (err) {
          errors.push(`Row ${i + 1}: Unexpected error parsing row data.`)
        }
      })

      if (errors.length > 0) {
        setCsvErrors(errors)
        setMessage({ type: 'error', text: `Found ${errors.length} errors in file.` })
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      if (validLogs.length === 0) {
        setCsvErrors(['No valid logs were found in the uploaded file. Check headers and candidate AE_IDs.'])
        setMessage({ type: 'error', text: 'No logs imported.' })
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      try {
        const res = await fetch('/api/logs/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logs: validLogs })
        })
        if (res.ok) {
          setMessage({ type: 'success', text: `Successfully imported ${validLogs.length} logs!` })
          setCsvErrors([])
          if (fileInputRef.current) fileInputRef.current.value = ''
        } else throw new Error()
      } catch (e) {
        setMessage({ type: 'error', text: 'Failed to upload valid logs to server.' })
      }
    }

    if (file.name.toLowerCase().endsWith('.xml')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string
          const parser = new DOMParser()
          const xmlDoc = parser.parseFromString(text, 'text/xml')
          
          const parseError = xmlDoc.getElementsByTagName('parsererror')
          if (parseError.length > 0) {
            setCsvErrors(['Invalid XML format.'])
            setMessage({ type: 'error', text: 'Failed to parse XML file.' })
            return
          }

          const logNodes = xmlDoc.getElementsByTagName('Log')
          const rows: any[] = []
          
          for (let i = 0; i < logNodes.length; i++) {
            const node = logNodes[i]
            rows.push({
              AE_ID: node.getElementsByTagName('AE_ID')[0]?.textContent,
              date: node.getElementsByTagName('date')[0]?.textContent,
              login_time: node.getElementsByTagName('login_time')[0]?.textContent,
              logout_time: node.getElementsByTagName('logout_time')[0]?.textContent,
            })
          }
          
          processRows(rows)
        } catch (err) {
          setCsvErrors(['Could not read XML data.'])
          setMessage({ type: 'error', text: 'Failed to process XML file.' })
        }
      }
      reader.readAsText(file)
    } else if (file.name.toLowerCase().endsWith('.xls') || file.name.toLowerCase().endsWith('.xlsx')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array', cellDates: true })
          
          // Dynamic sheet scan: find the sheet containing relevant columns
          let worksheet = null
          let rawGrid: any[][] = []

          for (const sheetName of workbook.SheetNames) {
            const tempSheet = workbook.Sheets[sheetName]
            const tempGrid = XLSX.utils.sheet_to_json(tempSheet, { header: 1 }) as any[][]
            if (tempGrid.length > 0) {
              const hasHeaders = tempGrid.some(row => {
                if (!Array.isArray(row)) return false
                return row.some(cell => {
                  if (typeof cell !== 'string') return false
                  const norm = cell.toLowerCase().replace(/[\s_-]+/g, '')
                  return ['ae_id', 'aeid', 'employeeid', 'empid', 'userid', 'date'].includes(norm)
                })
              })
              if (hasHeaders) {
                worksheet = tempSheet
                rawGrid = tempGrid
                break
              }
            }
          }

          // Fallback to first sheet
          if (!worksheet) {
            const firstSheetName = workbook.SheetNames[0]
            worksheet = workbook.Sheets[firstSheetName]
            rawGrid = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
          }

          // Dynamic header scan: find the row index where headers are declared
          let headerRowIndex = -1
          for (let r = 0; r < rawGrid.length; r++) {
            const row = rawGrid[r]
            if (Array.isArray(row)) {
              const matches = row.some(cell => {
                if (typeof cell !== 'string') return false
                const norm = cell.toLowerCase().replace(/[\s_-]+/g, '')
                return ['ae_id', 'aeid', 'employeeid', 'empid', 'date'].includes(norm)
              })
              if (matches) {
                headerRowIndex = r
                break
              }
            }
          }

          let json: any[] = []
          if (headerRowIndex !== -1) {
            const headers = rawGrid[headerRowIndex].map(h => String(h || '').trim())
            for (let r = headerRowIndex + 1; r < rawGrid.length; r++) {
              const row = rawGrid[r]
              if (Array.isArray(row)) {
                const rowObj: any = {}
                headers.forEach((header, colIndex) => {
                  if (header) {
                    rowObj[header] = row[colIndex]
                  }
                })
                json.push(rowObj)
              }
            }
          } else {
            // Standard fallback
            json = XLSX.utils.sheet_to_json(worksheet)
          }

          processRows(json)
        } catch (err) {
          setCsvErrors(['Could not read Excel data.'])
          setMessage({ type: 'error', text: 'Failed to process Excel file.' })
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      // CSV file handling: dynamic header scanning
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const rawGrid = results.data as any[][]
            let headerRowIndex = -1
            for (let r = 0; r < rawGrid.length; r++) {
              const row = rawGrid[r]
              if (Array.isArray(row)) {
                const matches = row.some(cell => {
                  if (typeof cell !== 'string') return false
                  const norm = cell.toLowerCase().replace(/[\s_-]+/g, '')
                  return ['ae_id', 'aeid', 'employeeid', 'empid', 'date'].includes(norm)
                })
                if (matches) {
                  headerRowIndex = r
                  break
                }
              }
            }

            let json: any[] = []
            if (headerRowIndex !== -1) {
              const headers = rawGrid[headerRowIndex].map(h => String(h || '').trim())
              for (let r = headerRowIndex + 1; r < rawGrid.length; r++) {
                const row = rawGrid[r]
                if (Array.isArray(row)) {
                  const rowObj: any = {}
                  headers.forEach((header, colIndex) => {
                    if (header) {
                      rowObj[header] = row[colIndex]
                    }
                  })
                  json.push(rowObj)
                }
              }
            } else {
              // Fallback to Papa header: true
              Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (res) => {
                  processRows(res.data)
                }
              })
              return
            }
            processRows(json)
          } catch (err) {
            setCsvErrors(['Could not parse CSV data.'])
            setMessage({ type: 'error', text: 'Failed to process CSV file.' })
          }
        }
      })
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 w-full">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Admin Portal</h1>
        <Link href="/office" className="flex items-center gap-2 text-sm text-slate-500 hover:text-accent transition-colors">
          <ArrowLeft className="w-4 h-4" /> Return to Dashboard
        </Link>
      </div>

      {message && (
        <div className={`p-4 mb-6 rounded-xl flex items-start gap-3 ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">{message.text}</p>
            {csvErrors.length > 0 && (
              <ul className="mt-2 text-sm list-disc pl-5 space-y-1">
                {csvErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
          <button onClick={() => {setMessage(null); setCsvErrors([])}} className="opacity-50 hover:opacity-100">&times;</button>
        </div>
      )}

      <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
        <div className="flex border-b border-card-border bg-slate-50/50 ">
          <button onClick={() => setActiveTab('candidate')} className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'candidate' ? 'text-accent border-b-2 border-accent' : 'text-slate-500 hover:text-foreground'}`}>
            Manage Candidates
          </button>
          <button onClick={() => setActiveTab('manual')} className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'manual' ? 'text-accent border-b-2 border-accent' : 'text-slate-500 hover:text-foreground'}`}>
            Manual Entry
          </button>
          <button onClick={() => setActiveTab('bulk')} className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'bulk' ? 'text-accent border-b-2 border-accent' : 'text-slate-500 hover:text-foreground'}`}>
            CSV / XML / XLS Import
          </button>
          <button onClick={() => setActiveTab('leave')} className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'leave' ? 'text-accent border-b-2 border-accent' : 'text-slate-500 hover:text-foreground'}`}>
            Leave Management
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'candidate' && (
            <div className="space-y-6">
              {/* Actions row */}
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-80">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search by AE ID or name..."
                    value={searchTerm}
                    onChange={e => handleSearchChange(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-accent focus:bg-white transition-colors"
                  />
                </div>
                
                <div className="flex w-full md:w-auto items-center gap-3 justify-end">
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      onClick={() => handleFilterChange('active')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeFilter === 'active' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Active
                    </button>
                    <button
                      onClick={() => handleFilterChange('inactive')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeFilter === 'inactive' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Inactive
                    </button>
                    <button
                      onClick={() => handleFilterChange('all')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      All
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setCandidateForm({ id: '', aeId: '', name: '', type: 'FULL_TIME', workLocation: 'OFFICE', ctcAnnual: '', joiningDate: '', deviceUserId: '', workingSaturdays: ['1', '3'] });
                      setFieldErrors({});
                      setIsFormModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 bg-accent hover:bg-accent/90 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add Candidate
                  </button>
                </div>
              </div>

              {/* Table wrapper */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden relative min-h-[200px]">
                {isLoading && (
                  <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                    <span className="w-8 h-8 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
                  </div>
                )}
                
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100/50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">AE ID</th>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Location</th>
                      <th className="px-4 py-3 font-medium">CTC / Stipend</th>
                      <th className="px-4 py-3 font-medium">Joining Date</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {tableCandidates.map(c => (
                      <tr key={c.id} className="hover:bg-slate-100/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-700">{c.aeId}</td>
                        <td className="px-4 py-3 text-slate-600 font-medium">{c.name}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          <span className={`px-2 py-1 rounded-md font-medium ${c.type === 'INTERN' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                            {c.type === 'INTERN' ? 'Intern' : 'Full-Time'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs uppercase font-semibold">
                          {c.workLocation}
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-mono">
                          ₹{c.ctcAnnual?.toLocaleString()}/mo
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(c.joiningDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${c.active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${c.active ? 'bg-green-500' : 'bg-red-500'}`} />
                            {c.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs">
                          <button 
                            onClick={() => handleEditCandidate(c)} 
                            className="text-accent hover:text-accent/80 font-semibold mr-3 hover:underline"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleToggleStatus(c)} 
                            className={`${c.active ? 'text-slate-600 hover:text-slate-800' : 'text-green-600 hover:text-green-800'} font-semibold mr-3 hover:underline`}
                          >
                            {c.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button 
                            onClick={() => handleDeleteCandidate(c.id, c.name)} 
                            className="text-red-500 hover:text-red-600 font-semibold hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {tableCandidates.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">No candidates found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-sm text-slate-500">
                  <div>
                    Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(pagination.page * pagination.limit, pagination.total)}
                    </span>{' '}
                    of <span className="font-medium">{pagination.total}</span> candidates
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors disabled:hover:bg-transparent"
                    >
                      Previous
                    </button>
                    <span className="font-medium text-slate-700">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                      disabled={currentPage === pagination.totalPages}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors disabled:hover:bg-transparent"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'manual' && (
            <form onSubmit={handleLogSubmit} className="space-y-4">
              <h2 className="text-lg font-semibold mb-4">Manual Attendance Entry</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700  mb-1">Candidate</label>
                  <select required value={logForm.candidateId} onChange={e => setLogForm({...logForm, candidateId: e.target.value})} className="w-full px-3 py-2 bg-slate-50  border border-slate-200  rounded-lg focus:outline-none focus:border-accent">
                    <option value="" disabled>Select Candidate...</option>
                    {allCandidates.filter(c => c.active).map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.aeId})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700  mb-1">Date</label>
                  <input required type="date" value={logForm.date} onChange={e => setLogForm({...logForm, date: e.target.value})} className="w-full px-3 py-2 bg-slate-50  border border-slate-200  rounded-lg focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700  mb-1">Status Override (Force Status)</label>
                  <select value={logForm.status} onChange={e => setLogForm({...logForm, status: e.target.value})} className="w-full px-3 py-2 bg-slate-50  border border-slate-200  rounded-lg focus:outline-none focus:border-accent">
                    <option value="AUTO">Auto (calculate from times)</option>
                    <option value="FULL_DAY_PRESENT">Full Day Present</option>
                    <option value="FULL_DAY_PRESENT_LATE">Late Login</option>
                    <option value="HALF_DAY">Half Day</option>
                    <option value="FULL_DAY_LEAVE">Full Day Leave (Leave/Absent)</option>
                    <option value="HOLIDAY">Holiday</option>
                  </select>
                </div>
                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700  mb-1">Login Time</label>
                    <input type="time" value={logForm.loginTime} onChange={e => setLogForm({...logForm, loginTime: e.target.value})} className="w-full px-3 py-2 bg-slate-50  border border-slate-200  rounded-lg focus:outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700  mb-1">Logout Time</label>
                    <input type="time" value={logForm.logoutTime} onChange={e => setLogForm({...logForm, logoutTime: e.target.value})} className="w-full px-3 py-2 bg-slate-50  border border-slate-200  rounded-lg focus:outline-none focus:border-accent" />
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">Leave times blank for a missing punch (Half Day) if using Auto status.</p>
              <div className="flex gap-4 mt-6">
                <button type="submit" className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                  <Save className="w-4 h-4" /> Save Entry
                </button>
                <button 
                  type="button" 
                  onClick={handleRemoveLog}
                  className="flex items-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Remove/Clear Entry
                </button>
              </div>
            </form>
          )}

          {activeTab === 'bulk' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold mb-4">Bulk CSV / XML / XLS Import</h2>
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                <Upload className="w-10 h-10 text-slate-400 mb-4" />
                <p className="text-sm text-slate-600 mb-4">Upload a CSV, XML, or Excel file with attendance logs.<br/>Required columns/tags: <code className="bg-slate-100 px-1 rounded text-accent">AE_ID, date, login_time, logout_time</code></p>
                <input 
                  type="file" 
                  accept=".csv,.xml,.xls,.xlsx"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  className="block w-full max-w-xs text-sm text-slate-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-accent/10 file:text-accent
                    hover:file:bg-accent/20 cursor-pointer"
                />
              </div>
              <div className="bg-blue-50  p-4 rounded-xl text-sm text-blue-700 ">
                <strong>Format Info:</strong>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li><code>date</code> must be YYYY-MM-DD</li>
                  <li><code>login_time</code> and <code>logout_time</code> must be HH:mm (24-hour). Leave empty for missing punch.</li>
                  <li>Existing logs for the same AE_ID + date will be overwritten.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'leave' && (
            <div className="space-y-8">
              <form onSubmit={handleLeaveSubmit} className="space-y-4">
                <h2 className="text-lg font-semibold mb-4">Manual Leave Adjustment</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Candidate</label>
                    <select required value={leaveForm.candidateId} onChange={e => setLeaveForm({...leaveForm, candidateId: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-accent">
                      <option value="" disabled>Select Candidate...</option>
                      {allCandidates.filter(c => c.active).map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.aeId})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Effective Date</label>
                    <input required type="date" value={leaveForm.date} onChange={e => setLeaveForm({...leaveForm, date: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description / Reason</label>
                    <input required type="text" placeholder="e.g. Granted bonus leave" value={leaveForm.description} onChange={e => setLeaveForm({...leaveForm, description: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Credit Days (+)</label>
                    <input type="number" step="0.5" min="0" placeholder="0" value={leaveForm.credit} onChange={e => setLeaveForm({...leaveForm, credit: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Debit Days (-)</label>
                    <input type="number" step="0.5" min="0" placeholder="0" value={leaveForm.debit} onChange={e => setLeaveForm({...leaveForm, debit: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-accent" />
                  </div>
                </div>
                <button type="submit" className="mt-4 flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                  <Save className="w-4 h-4" /> Save Leave Adjustment
                </button>
              </form>

              <hr className="border-slate-200" />

              <div>
                <h2 className="text-lg font-semibold mb-4">Export Leave Reports</h2>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex-1 min-w-[200px] max-w-xs">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Select Month</label>
                    <input type="month" value={exportMonth} onChange={e => setExportMonth(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-accent" />
                  </div>
                  <button 
                    onClick={() => {
                      if (!exportMonth) return
                      const [year, month] = exportMonth.split('-')
                      window.open(`/admin/leave-report?month=${month}&year=${year}`, '_blank')
                    }} 
                    disabled={!exportMonth}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 shadow-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4" /></svg>
                    Print / Export PDF Report
                  </button>
                  <button 
                    onClick={() => {
                      if (!exportMonth) return
                      const [year, month] = exportMonth.split('-')
                      window.open(`/api/leave/export?month=${month}&year=${year}`, '_blank')
                    }} 
                    disabled={!exportMonth}
                    className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 shadow-sm"
                  >
                    <Upload className="w-4 h-4" /> Export CSV Report
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Candidate Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-card-border flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">
                {candidateForm.id ? 'Edit Candidate Details' : 'Add New Candidate'}
              </h2>
              <button 
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors text-2xl font-semibold leading-none"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCandidateSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">AE ID *</label>
                  <input 
                    required 
                    type="text" 
                    value={candidateForm.aeId} 
                    onChange={e => {
                      setCandidateForm({...candidateForm, aeId: e.target.value});
                      if (fieldErrors.aeId) setFieldErrors({...fieldErrors, aeId: ''});
                    }} 
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-lg focus:outline-none focus:border-accent ${fieldErrors.aeId ? 'border-red-500 bg-red-50/10' : 'border-slate-200'}`}
                    placeholder="e.g. AE18883" 
                  />
                  {fieldErrors.aeId && <p className="text-xs text-red-500 mt-1">{fieldErrors.aeId}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Device User ID</label>
                  <input 
                    type="text" 
                    value={candidateForm.deviceUserId} 
                    placeholder="Defaults to AE ID"
                    onChange={e => {
                      setCandidateForm({...candidateForm, deviceUserId: e.target.value});
                      if (fieldErrors.deviceUserId) setFieldErrors({...fieldErrors, deviceUserId: ''});
                    }} 
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-lg focus:outline-none focus:border-accent ${fieldErrors.deviceUserId ? 'border-red-500 bg-red-50/10' : 'border-slate-200'}`}
                  />
                  {fieldErrors.deviceUserId && <p className="text-xs text-red-500 mt-1">{fieldErrors.deviceUserId}</p>}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                  <input 
                    required 
                    type="text" 
                    value={candidateForm.name} 
                    onChange={e => {
                      setCandidateForm({...candidateForm, name: e.target.value});
                      if (fieldErrors.name) setFieldErrors({...fieldErrors, name: ''});
                    }} 
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-lg focus:outline-none focus:border-accent ${fieldErrors.name ? 'border-red-500 bg-red-50/10' : 'border-slate-200'}`}
                  />
                  {fieldErrors.name && <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
                  <select 
                    value={candidateForm.type} 
                    onChange={e => setCandidateForm({...candidateForm, type: e.target.value as 'FULL_TIME' | 'INTERN'})} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-accent"
                  >
                    <option value="FULL_TIME">Full-Time</option>
                    <option value="INTERN">Intern</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Work Location *</label>
                  <select 
                    value={candidateForm.workLocation} 
                    onChange={e => setCandidateForm({...candidateForm, workLocation: e.target.value as 'OFFICE' | 'FIELD'})} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-accent"
                  >
                    <option value="OFFICE">Office</option>
                    <option value="FIELD">Field</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {candidateForm.type === 'INTERN' ? 'Monthly Stipend (₹) *' : 'Monthly Salary (₹) *'}
                  </label>
                  <input 
                    required 
                    type="number" 
                    value={candidateForm.ctcAnnual} 
                    onChange={e => {
                      setCandidateForm({...candidateForm, ctcAnnual: e.target.value});
                      if (fieldErrors.ctcAnnual) setFieldErrors({...fieldErrors, ctcAnnual: ''});
                    }} 
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-lg focus:outline-none focus:border-accent ${fieldErrors.ctcAnnual ? 'border-red-500 bg-red-50/10' : 'border-slate-200'}`}
                  />
                  {fieldErrors.ctcAnnual && <p className="text-xs text-red-500 mt-1">{fieldErrors.ctcAnnual}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Joining Date *</label>
                  <input 
                    required 
                    type="date" 
                    value={candidateForm.joiningDate} 
                    onChange={e => {
                      setCandidateForm({...candidateForm, joiningDate: e.target.value});
                      if (fieldErrors.joiningDate) setFieldErrors({...fieldErrors, joiningDate: ''});
                    }} 
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-lg focus:outline-none focus:border-accent ${fieldErrors.joiningDate ? 'border-red-500 bg-red-50/10' : 'border-slate-200'}`}
                  />
                  {fieldErrors.joiningDate && <p className="text-xs text-red-500 mt-1">{fieldErrors.joiningDate}</p>}
                </div>
              </div>
              <div className="pt-4 border-t border-card-border flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsFormModalOpen(false)} 
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isFormSubmitting}
                  className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {isFormSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : candidateForm.id ? (
                    <Save className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )} 
                  {candidateForm.id ? 'Save Changes' : 'Create Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate/Reactivate Confirmation Modal */}
      {deactivateConfirm && deactivateConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Confirm Candidate Status Change
              </h3>
              <p className="text-sm text-slate-600 mb-6">
                Are you sure you want to {deactivateConfirm.candidate.active ? 'deactivate' : 'reactivate'} <strong>{deactivateConfirm.candidate.name}</strong> ({deactivateConfirm.candidate.aeId})? 
                {deactivateConfirm.candidate.active && " Deactivated candidates will not be listed for active daily logs or leave dropdown lists."}
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setDeactivateConfirm(null)} 
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmToggleStatus}
                  className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Double Confirmation Modal */}
      {deleteConfirm && deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Dangerous Action: Delete Candidate
              </h3>
              
              {deleteConfirm.hasHistory ? (
                <div className="mb-4">
                  <div className="bg-red-50 text-red-800 p-3 rounded-lg text-xs font-medium border border-red-100 mb-3">
                    {deleteConfirm.historyMessage}
                  </div>
                  <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                    Deleting this candidate will permanently erase their attendance logs, payslips, and leave records. This cannot be undone. Consider <strong>deactivating</strong> them instead.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-600 mb-4">
                  Are you sure you want to delete candidate <strong>{deleteConfirm.candidate.name}</strong> ({deleteConfirm.candidate.aeId})? This action cannot be undone.
                </p>
              )}

              <div className="mb-6">
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Type the candidate's AE ID <strong>({deleteConfirm.candidate.aeId})</strong> to confirm:
                </label>
                <input 
                  type="text" 
                  value={deleteConfirm.confirmName} 
                  onChange={e => setDeleteConfirm({ ...deleteConfirm, confirmName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-red-500 bg-slate-50 text-sm"
                  placeholder={deleteConfirm.candidate.aeId}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setDeleteConfirm(null)} 
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  disabled={deleteConfirm.confirmName.trim().toLowerCase() !== deleteConfirm.candidate.aeId.toLowerCase()}
                  onClick={confirmDeleteCandidate}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Confirm Permanent Deletion
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
