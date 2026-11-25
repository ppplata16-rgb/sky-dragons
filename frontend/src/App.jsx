import { useEffect, useRef, useState } from 'react'
import {
  LayoutDashboard, Users, CalendarDays, Trophy, WalletCards, Package, Activity,
  Settings, LogOut, Search, Bell, ChevronDown, Plus, ArrowUpRight,
  MoreHorizontal, Menu, Waves, Timer, Target, Medal, MapPin, Clock3, Dumbbell,
  Anchor, LifeBuoy, DollarSign, ReceiptText, CreditCard, ArrowDownRight,
  UserPlus, ShieldCheck, Trash2, Cake,
  Wrench, CalendarClock,
  Pencil, RefreshCw, Download, Share2, LockKeyhole, Image as ImageIcon, X, ChevronLeft, ChevronRight,
} from 'lucide-react'
import skyDragonsLogo from './assets/sky-dragons-logo.png'
import { authApi, apiRequest } from './api/client'
import { Capacitor } from '@capacitor/core'
import './App.css'

const members = []

const nav = [
  { label: 'Centro deportivo', icon: LayoutDashboard },
  { label: 'Integrantes', icon: Users },
  { label: 'Entrenamientos', icon: CalendarDays },
  { label: 'Concept2', icon: Waves },
  { label: 'Métricas', icon: Activity },
  { label: 'Competencias', icon: Trophy },
  { label: 'Finanzas', icon: WalletCards },
  { label: 'Inventario', icon: Package },
  { label: 'Flota y reservas', icon: Anchor },
  { label: 'Alineaciones', icon: Target },
  { label: 'Calendario', icon: CalendarDays },
  { label: 'Galería', icon: ImageIcon },
  { label: 'Reportes', icon: ArrowUpRight },
]

const categoryRosters = {
  'Open 1': [],
  'Open 2': [],
  Master: [],
  Femenino: [],
  Mixta: [],
  Rookie: [],
}

const pastCompetitions = []

const medalsByCategory = {
  'Open 1': { gold: 0, silver: 0, bronze: 0 },
  'Open 2': { gold: 0, silver: 0, bronze: 0 },
  Master: { gold: 0, silver: 0, bronze: 0 },
  Femenino: { gold: 0, silver: 0, bronze: 0 },
  Mixta: { gold: 0, silver: 0, bronze: 0 },
  Rookie: { gold: 0, silver: 0, bronze: 0 },
}

const inventoryItems = []

function useStoredState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue]
}

function formatRaceTime(value) {
  if (value === null || value === undefined || value === '') return '—'
  const totalMs = Math.round(Number(value) * 1000)
  if (!Number.isFinite(totalMs) || totalMs < 0) return '—'
  const minutes = Math.floor(totalMs / 60000)
  const seconds = Math.floor((totalMs % 60000) / 1000)
  const milliseconds = totalMs % 1000
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
}

function parseRaceTime(value) {
  const match = String(value || '').trim().match(/^(\d{1,3}):([0-5]\d)(?:\.(\d{1,3}))?$/)
  if (!match) return null
  const fraction = Number(`0.${match[3] || '0'}`)
  return Number(match[1]) * 60 + Number(match[2]) + fraction
}

function getAge(birthDate) {
  if (!birthDate) return null
  const birth = new Date(`${birthDate}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1
  return age >= 0 ? age : null
}

function formatBirthDate(birthDate) {
  if (!birthDate) return 'Sin registrar'
  const date = new Date(`${birthDate}T12:00:00`)
  return Number.isNaN(date.getTime()) ? birthDate : date.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatErgDuration(value) {
  const tenths = Math.round(Number(value) * 10)
  if (!Number.isFinite(tenths) || tenths < 0) return '—'
  const totalSeconds = tenths / 10
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds - minutes * 60
  return `${minutes}:${seconds.toFixed(tenths % 10 ? 1 : 0).padStart(tenths % 10 ? 4 : 2, '0')}`
}

function formatErgPace(durationSeconds, distanceM) {
  const distance = Number(distanceM)
  const duration = Number(durationSeconds)
  if (!Number.isFinite(distance) || distance <= 0 || !Number.isFinite(duration) || duration <= 0) return 'Ritmo sin registrar'
  return `${formatErgDuration(duration * 500 / distance)} /500 m`
}

function formatConcept2WorkoutType(value) {
  const labels = {
    JustRow: 'Libre',
    FixedDistanceSplits: 'Intervalos por distancia',
    FixedTimeSplits: 'Intervalos por tiempo',
    FixedCalorie: 'Calorías',
    FixedWattMinute: 'Vatios por minuto',
    FixedTimeInterval: 'Intervalos por tiempo',
    FixedDistanceInterval: 'Intervalos por distancia',
    FixedCalorieInterval: 'Intervalos por calorías',
    FixedWattMinuteInterval: 'Intervalos por vatios',
    VariableInterval: 'Intervalos variables',
    VariableIntervalUndefinedRest: 'Intervalos variables',
    unknown: 'Tipo no especificado',
  }
  return labels[value] || value || 'Tipo no especificado'
}

async function fetchAllRows(path, pageSize = 500) {
  const rows = []
  let offset = 0
  let total = Number.POSITIVE_INFINITY
  while (offset < total) {
    const result = await apiRequest(`${path}?limit=${pageSize}&offset=${offset}`)
    const page = Array.isArray(result.data) ? result.data : []
    rows.push(...page)
    total = Number(result.total) || rows.length
    if (!page.length) break
    offset += page.length
  }
  return rows
}

function RosterView({ currentUser }) {
  const [selectedCategory, setSelectedCategory] = useStoredState('selectedCategory', 'Open 1')
  const [rosters, setRosters] = useState(categoryRosters)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedAthlete, setSelectedAthlete] = useState(null)
  const [editingMember, setEditingMember] = useState(null)
  const [savingMember, setSavingMember] = useState(false)
  const [memberEditForm, setMemberEditForm] = useState({})
  const [sportHistory, setSportHistory] = useState(null)
  const [concept2History, setConcept2History] = useState([])
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('')
  const [profilePhotoVersion, setProfilePhotoVersion] = useState(0)
  const [profilePhotoUploading, setProfilePhotoUploading] = useState(false)
  const [profilePhotoError, setProfilePhotoError] = useState('')
  const [progressDistance, setProgressDistance] = useState('')
  const [health, setHealth] = useState({ allergies: '', medicalNotes: '', medicalClearanceUntil: '' })
  const [healthSaving, setHealthSaving] = useState(false)
  const [healthMessage, setHealthMessage] = useState('')
  const [athlete, setAthlete] = useState({ name: '', role: 'Remero', side: 'Ambos', status: 'Titular', birthDate: '', weightKg: '', heightCm: '', emergencyContactName: '', emergencyContactPhone: '' })
  const roster = rosters[selectedCategory] || []

  const loadMembers = async () => {
    setLoading(true)
    try {
      const result = await apiRequest('/api/members?limit=500')
      const next = Object.fromEntries(Object.keys(categoryRosters).map((category) => [category, []]))
      result.data.forEach((member) => {
        const category = next[member.category] ? member.category : 'Open 1'
        const name = `${member.firstName} ${member.lastName}`.trim()
        next[category].push({
          id: member.id, firstName: member.firstName, lastName: member.lastName, name, role: member.role === 'suplente' ? 'Suplente' : member.role,
          side: member.rowingSide === 'izquierdo' ? 'Izquierdo' : member.rowingSide === 'derecho' ? 'Derecho' : 'Ambos',
          rawRole: member.role, rawStatus: member.status, status: member.status === 'inactivo' ? 'Inactivo' : member.role === 'suplente' ? 'Suplente' : 'Titular',
          number: member.jerseyNumber || String(member.id).padStart(2, '0'),
          birthDate: member.birthDate, weightKg: member.weightKg, heightCm: member.heightCm,
          biography: member.biography || '', palmares: member.palmares || '', rowingTeams: member.rowingTeams || '',
          emergencyContactName: member.emergencyContactName, emergencyContactPhone: member.emergencyContactPhone,
          email: member.email, phone: member.phone, category: member.category, documentId: member.documentId, uniformSize: member.uniformSize,
          availableDays: Array.isArray(member.availableDays) ? member.availableDays : [], unavailableFrom: member.unavailableFrom || '', unavailableUntil: member.unavailableUntil || '', availabilityNotes: member.availabilityNotes || '',
          initials: name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase(), color: '#75a7ff',
        })
      })
      setRosters(next)
      setError('')
      return next
    } catch (requestError) {
      setError(requestError.message)
    } finally { setLoading(false) }
  }

  useEffect(() => { loadMembers() }, [])

  useEffect(() => {
    setSportHistory(null)
    setProgressDistance('')
    if (!selectedAthlete) return
    let active = true
    apiRequest(`/api/reports/member-sport/${selectedAthlete.id}`).then((history) => { if (active) setSportHistory(history) }).catch(() => { if (active) setSportHistory(null) })
    return () => { active = false }
  }, [selectedAthlete])

  useEffect(() => {
    setConcept2History([])
    if (!selectedAthlete) return
    let active = true
    apiRequest(`/api/erg-scores?memberId=${selectedAthlete.id}&limit=500`)
      .then((result) => {
        if (active) setConcept2History(result.data.filter((score) => score.source === 'concept2').sort((a, b) => String(b.date).localeCompare(String(a.date))))
      })
      .catch(() => { if (active) setConcept2History([]) })
    return () => { active = false }
  }, [selectedAthlete])

  useEffect(() => {
    setProfilePhotoUrl('')
    if (!selectedAthlete) return
    let active = true
    let objectUrl = ''
    apiRequest(`/api/members/${selectedAthlete.id}/profile-photo`, { responseType: 'blob' })
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setProfilePhotoUrl(objectUrl)
      })
      .catch(() => { if (active) setProfilePhotoUrl('') })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [selectedAthlete, profilePhotoVersion])

  const uploadProfilePhoto = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setProfilePhotoError('Elige una foto JPG, PNG o WebP.'); return }
    if (file.size > 5 * 1024 * 1024) { setProfilePhotoError('La foto debe pesar menos de 5 MB.'); return }
    setProfilePhotoUploading(true); setProfilePhotoError('')
    try {
      await apiRequest(`/api/members/${selectedAthlete.id}/profile-photo`, { method: 'POST', headers: { 'Content-Type': file.type }, body: file })
      setProfilePhotoVersion((version) => version + 1)
    } catch (requestError) { setProfilePhotoError(requestError.message) }
    finally { setProfilePhotoUploading(false) }
  }

  const removeProfilePhoto = async () => {
    setProfilePhotoUploading(true); setProfilePhotoError('')
    try {
      await apiRequest(`/api/members/${selectedAthlete.id}/profile-photo`, { method: 'DELETE' })
      setProfilePhotoVersion((version) => version + 1)
    } catch (requestError) { setProfilePhotoError(requestError.message) }
    finally { setProfilePhotoUploading(false) }
  }

  useEffect(() => {
    setHealth({ allergies: '', medicalNotes: '', medicalClearanceUntil: '' }); setHealthMessage('')
    if (!selectedAthlete || !['admin', 'capitan'].includes(currentUser?.role)) return
    apiRequest(`/api/members/${selectedAthlete.id}/health`).then((data) => setHealth({ allergies: data.allergies || '', medicalNotes: data.medicalNotes || '', medicalClearanceUntil: data.medicalClearanceUntil || '' })).catch((requestError) => setHealthMessage(requestError.message))
  }, [selectedAthlete, currentUser])

  const saveHealth = async () => {
    setHealthSaving(true); setHealthMessage('')
    try { await apiRequest(`/api/members/${selectedAthlete.id}/health`, { method: 'PUT', body: JSON.stringify(health) }); setHealthMessage('Ficha médica guardada.') }
    catch (requestError) { setHealthMessage(requestError.message) }
    finally { setHealthSaving(false) }
  }

  const athleteRaces = sportHistory?.raceHistory || []
  const performanceDistances = [...new Set(athleteRaces.filter((race) => race.distanceM && race.timeSeconds).map((race) => String(race.distanceM)))].sort((a, b) => Number(a) - Number(b))
  const activeProgressDistance = performanceDistances.includes(progressDistance) ? progressDistance : performanceDistances[0] || ''
  const progressRecords = athleteRaces.filter((race) => String(race.distanceM) === activeProgressDistance && Number(race.timeSeconds) > 0).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
  const fastestTime = progressRecords.length ? Math.min(...progressRecords.map((race) => Number(race.timeSeconds))) : null
  const slowestTime = progressRecords.length ? Math.max(...progressRecords.map((race) => Number(race.timeSeconds))) : null
  const canManageProfilePhoto = ['admin', 'capitan'].includes(currentUser?.role) || Number(currentUser?.memberId) === Number(selectedAthlete?.id)

  const addAthlete = async (event) => {
    event.preventDefault()
    if (!athlete.name.trim()) return
    const [firstName, ...rest] = athlete.name.trim().split(/\s+/)
    const newAthlete = {
      firstName,
      lastName: rest.join(' '),
      category: selectedCategory,
      role: ({ Remero: 'remero', Timonel: 'timonel', Tamborilero: 'tamborilero', Suplente: 'suplente', Staff: 'staff' })[athlete.role] || 'remero',
      rowingSide: athlete.side === 'Izquierdo' ? 'izquierdo' : athlete.side === 'Derecho' ? 'derecho' : 'ambos',
      status: athlete.status === 'Suplente' || athlete.role === 'Suplente' ? 'inactivo' : 'activo',
      birthDate: athlete.birthDate || null,
      weightKg: athlete.weightKg ? Number(athlete.weightKg) : null,
      heightCm: athlete.heightCm ? Number(athlete.heightCm) : null,
      emergencyContactName: athlete.emergencyContactName || null,
      emergencyContactPhone: athlete.emergencyContactPhone || null,
    }

    setError('')
    try {
      await apiRequest('/api/members', {
        method: 'POST',
        body: JSON.stringify(newAthlete),
      })
      await loadMembers()
    } catch (requestError) {
      setError(requestError.message)
      return
    }
    setAthlete({ name: '', role: 'Remero', side: 'Ambos', status: 'Titular', birthDate: '', weightKg: '', heightCm: '', emergencyContactName: '', emergencyContactPhone: '' })
    setShowForm(false)
  }

  const deleteAthlete = async (person) => {
    if (!window.confirm(`¿Borrar el perfil de ${person.name}?`)) return
    setError('')
    try {
      await apiRequest(`/api/members/${person.id}`, { method: 'DELETE' })
      if (selectedAthlete?.id === person.id) setSelectedAthlete(null)
      await loadMembers()
    } catch (requestError) { setError(requestError.message) }
  }

  const openMemberEditor = (person) => {
    setMemberEditForm({
      firstName: person.firstName || '', lastName: person.lastName || '', category: person.category || selectedCategory,
      role: person.rawRole || 'remero', status: person.rawStatus || 'activo', rowingSide: person.side === 'Izquierdo' ? 'izquierdo' : person.side === 'Derecho' ? 'derecho' : 'ambos',
      birthDate: person.birthDate || '', weightKg: person.weightKg || '', heightCm: person.heightCm || '', email: person.email || '', phone: person.phone || '',
      biography: person.biography || '', palmares: person.palmares || '', rowingTeams: person.rowingTeams || '',
      documentId: person.documentId || '', uniformSize: person.uniformSize || '', emergencyContactName: person.emergencyContactName || '', emergencyContactPhone: person.emergencyContactPhone || '',
      availableDays: person.availableDays || [], unavailableFrom: person.unavailableFrom || '', unavailableUntil: person.unavailableUntil || '', availabilityNotes: person.availabilityNotes || '',
    })
    setEditingMember(person)
    setError('')
  }

  const saveMember = async (event) => {
    event.preventDefault(); setSavingMember(true); setError('')
    if (!memberEditForm.firstName.trim() || !memberEditForm.lastName.trim()) { setError('Escribe el nombre y apellido del integrante.'); setSavingMember(false); return }
    if (memberEditForm.unavailableFrom && memberEditForm.unavailableUntil && memberEditForm.unavailableUntil < memberEditForm.unavailableFrom) { setError('La fecha final de ausencia debe ser posterior a la inicial.'); setSavingMember(false); return }
    const payload = {
      ...memberEditForm,
      firstName: memberEditForm.firstName.trim(), lastName: memberEditForm.lastName.trim(),
      birthDate: memberEditForm.birthDate || null, weightKg: memberEditForm.weightKg ? Number(memberEditForm.weightKg) : null, heightCm: memberEditForm.heightCm ? Number(memberEditForm.heightCm) : null,
      documentId: memberEditForm.documentId || null, uniformSize: memberEditForm.uniformSize || null, email: memberEditForm.email || null, phone: memberEditForm.phone || null,
      emergencyContactName: memberEditForm.emergencyContactName || null, emergencyContactPhone: memberEditForm.emergencyContactPhone || null,
      biography: memberEditForm.biography?.trim() || null, palmares: memberEditForm.palmares?.trim() || null, rowingTeams: memberEditForm.rowingTeams?.trim() || null,
      availableDays: memberEditForm.availableDays, unavailableFrom: memberEditForm.unavailableFrom || null, unavailableUntil: memberEditForm.unavailableUntil || null, availabilityNotes: memberEditForm.availabilityNotes || null,
    }
    try {
      await apiRequest(`/api/members/${editingMember.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      const updatedRosters = await loadMembers()
      const updatedMember = Object.values(updatedRosters || {}).flat().find((person) => person.id === editingMember.id)
      if (updatedMember) setSelectedAthlete((current) => current?.id === updatedMember.id ? updatedMember : current)
      setEditingMember(null)
    } catch (requestError) { setError(requestError.message) }
    finally { setSavingMember(false) }
  }

  return (
    <div className="roster-view">
      <div className="category-tabs" role="tablist" aria-label="Categorías del equipo">
        {Object.keys(categoryRosters).map((category) => (
          <button
            key={category}
            role="tab"
            aria-selected={selectedCategory === category}
            className={selectedCategory === category ? 'category-tab active' : 'category-tab'}
            onClick={() => setSelectedCategory(category)}
          >
            <span>{category}</span>
            <strong>{rosters[category].length}</strong>
          </button>
        ))}
      </div>

      <article className="panel roster-panel">
        <div className="panel-header roster-header">
          <div><p className="roster-kicker">ROSTER 2026</p><h2>{selectedCategory}</h2></div>
          <button className="primary-button" onClick={() => setShowForm(true)}><Plus size={17} /> AGREGAR ATLETA</button>
        </div>

        {error && <p className="login-error" role="alert">{error}</p>}

        <div className="roster-summary">
          <div><span>Integrantes</span><strong>{roster.length}</strong></div>
          <div><span>Titulares</span><strong>{roster.filter((person) => person.rawStatus === 'activo' && person.rawRole !== 'suplente').length}</strong></div>
          <div><span>Suplentes</span><strong>{roster.filter((person) => person.rawRole === 'suplente' || person.rawStatus === 'inactivo').length}</strong></div>
        </div>

        <div className="roster-list">
          <div className="roster-list-head"><span>Atleta</span><span>Posición</span><span>Lado</span><span>Estado</span><span /></div>
          {loading ? <div className="no-roster-message"><p>Cargando integrantes…</p></div> : roster.length > 0 ? (
            roster.map((person) => (
              <div className="roster-row" key={person.id}>
                <div className="member-name">
                  <span className="roster-number">{person.number}</span>
                  <b style={{ background: person.color }}>{person.initials}</b>
                  <strong>{person.name}</strong>
                </div>
                <span className="roster-role">{person.role}</span>
                <span className="roster-side">{person.side || 'Ambos'}</span>
                <span className={person.status === 'Titular' ? 'roster-status' : 'roster-status reserve'}><i /> {person.status}</span>
                <div className="roster-actions"><button aria-label={`Editar ficha de ${person.name}`} title="Editar ficha y disponibilidad" onClick={() => openMemberEditor(person)}><Pencil size={15} /></button><button aria-label={`Ver perfil de ${person.name}`} title="Ver ficha deportiva" onClick={() => setSelectedAthlete(person)}><MoreHorizontal size={18} /></button><button className="icon-danger-button" aria-label={`Borrar ${person.name}`} title="Borrar integrante" onClick={() => deleteAthlete(person)}><Trash2 size={16} /></button></div>
              </div>
            ))
          ) : (
            <div className="no-roster-message">
              <p>No hay integrantes en esta categoría.</p>
            </div>
          )}
        </div>
      </article>

      {showForm && (
        <div className="athlete-form-overlay">
          <div className="athlete-form-panel">
            <div className="panel-header">
              <h2>Agregar atleta</h2>
              <button className="close-button" onClick={() => setShowForm(false)}>×</button>
            </div>

            <form className="athlete-form" onSubmit={addAthlete}>
              <label>
                <span>Nombre completo</span>
                <input type="text" value={athlete.name} onChange={(e) => setAthlete({ ...athlete, name: e.target.value })} required />
              </label>
              <label>
                <span>Posición</span>
                <select value={athlete.role} onChange={(e) => setAthlete({ ...athlete, role: e.target.value })}>
                  <option>Remero</option>
                  <option>Timonel</option>
                  <option>Tamborilero</option>
                  <option>Suplente</option>
                  <option>Staff</option>
                </select>
              </label>
              <label>
                <span>Lado de remada</span>
                <select value={athlete.side} onChange={(e) => setAthlete({ ...athlete, side: e.target.value })}>
                  <option>Ambos</option>
                  <option>Izquierdo</option>
                  <option>Derecho</option>
                </select>
              </label>
              <label>
                <span>Estado</span>
                <select value={athlete.status} onChange={(e) => setAthlete({ ...athlete, status: e.target.value })}>
                  <option>Titular</option>
                  <option>Suplente</option>
                </select>
              </label>
              <label>
                <span>Capitán</span>
                <input type="checkbox" checked={athlete.captain} onChange={(e) => setAthlete({ ...athlete, captain: e.target.checked })} />
              </label>
              <label><span>Fecha de nacimiento</span><input type="date" value={athlete.birthDate} onChange={(event) => setAthlete({ ...athlete, birthDate: event.target.value })} /></label>
              <label><span>Peso (kg)</span><input type="number" min="1" step="0.1" value={athlete.weightKg} onChange={(event) => setAthlete({ ...athlete, weightKg: event.target.value })} /></label>
              <label><span>Estatura (cm)</span><input type="number" min="1" value={athlete.heightCm} onChange={(event) => setAthlete({ ...athlete, heightCm: event.target.value })} /></label>
              <label><span>Contacto de emergencia</span><input value={athlete.emergencyContactName} onChange={(event) => setAthlete({ ...athlete, emergencyContactName: event.target.value })} /></label>
              <label><span>Telefono de emergencia</span><input type="tel" value={athlete.emergencyContactPhone} onChange={(event) => setAthlete({ ...athlete, emergencyContactPhone: event.target.value })} /></label>              <div className="form-actions">
                <button type="button" className="outline-button" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="primary-button">Agregar atleta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingMember && <div className="athlete-form-overlay" onClick={() => setEditingMember(null)}><div className="athlete-form-panel member-edit-panel" onClick={(event) => event.stopPropagation()}>
        <div className="panel-header"><div><p className="roster-kicker">PERFIL DEL EQUIPO</p><h2>Editar integrante</h2></div><button className="close-button" onClick={() => setEditingMember(null)}>×</button></div>
        {error && <p className="login-error" role="alert">{error}</p>}
        <form className="athlete-form" onSubmit={saveMember}>
          <label><span>Nombre</span><input required value={memberEditForm.firstName || ''} onChange={(event) => setMemberEditForm({ ...memberEditForm, firstName: event.target.value })} /></label>
          <label><span>Apellido</span><input required value={memberEditForm.lastName || ''} onChange={(event) => setMemberEditForm({ ...memberEditForm, lastName: event.target.value })} /></label>
          <label><span>Categoría</span><select value={memberEditForm.category || selectedCategory} onChange={(event) => setMemberEditForm({ ...memberEditForm, category: event.target.value })}>{Object.keys(categoryRosters).map((category) => <option key={category}>{category}</option>)}</select></label>
          <label><span>Posición</span><select value={memberEditForm.role || 'remero'} onChange={(event) => setMemberEditForm({ ...memberEditForm, role: event.target.value })}><option value="remero">Remero</option><option value="timonel">Timonel</option><option value="tamborilero">Tamborilero</option><option value="suplente">Suplente</option><option value="staff">Staff</option></select></label>
          <label><span>Lado de remada</span><select value={memberEditForm.rowingSide || 'ambos'} onChange={(event) => setMemberEditForm({ ...memberEditForm, rowingSide: event.target.value })}><option value="ambos">Ambos</option><option value="izquierdo">Izquierdo</option><option value="derecho">Derecho</option></select></label>
          <label><span>Estado</span><select value={memberEditForm.status || 'activo'} onChange={(event) => setMemberEditForm({ ...memberEditForm, status: event.target.value })}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></label>
          <label><span>Fecha de nacimiento</span><input type="date" value={memberEditForm.birthDate || ''} onChange={(event) => setMemberEditForm({ ...memberEditForm, birthDate: event.target.value })} /></label>
          <label><span>Peso (kg)</span><input type="number" min="1" step="0.1" value={memberEditForm.weightKg || ''} onChange={(event) => setMemberEditForm({ ...memberEditForm, weightKg: event.target.value })} /></label>
          <label><span>Estatura (cm)</span><input type="number" min="1" value={memberEditForm.heightCm || ''} onChange={(event) => setMemberEditForm({ ...memberEditForm, heightCm: event.target.value })} /></label>
          <label><span>Talla de uniforme</span><input value={memberEditForm.uniformSize || ''} onChange={(event) => setMemberEditForm({ ...memberEditForm, uniformSize: event.target.value })} /></label>
          <label><span>Documento</span><input value={memberEditForm.documentId || ''} onChange={(event) => setMemberEditForm({ ...memberEditForm, documentId: event.target.value })} /></label>
          <label><span>Correo</span><input type="email" value={memberEditForm.email || ''} onChange={(event) => setMemberEditForm({ ...memberEditForm, email: event.target.value })} /></label>
          <label><span>Teléfono</span><input type="tel" value={memberEditForm.phone || ''} onChange={(event) => setMemberEditForm({ ...memberEditForm, phone: event.target.value })} /></label>
          <label><span>Contacto de emergencia</span><input value={memberEditForm.emergencyContactName || ''} onChange={(event) => setMemberEditForm({ ...memberEditForm, emergencyContactName: event.target.value })} /></label>
          <label><span>Teléfono de emergencia</span><input type="tel" value={memberEditForm.emergencyContactPhone || ''} onChange={(event) => setMemberEditForm({ ...memberEditForm, emergencyContactPhone: event.target.value })} /></label>
          <label className="full-form-field"><span>Biografía breve</span><textarea maxLength={1000} rows={3} value={memberEditForm.biography || ''} onChange={(event) => setMemberEditForm({ ...memberEditForm, biography: event.target.value })} placeholder="Su trayectoria, motivación y experiencia en el remo" /></label>
          <label className="full-form-field"><span>Equipos donde ha remado</span><textarea maxLength={1000} rows={3} value={memberEditForm.rowingTeams || ''} onChange={(event) => setMemberEditForm({ ...memberEditForm, rowingTeams: event.target.value })} placeholder="Un club o equipo por línea" /></label>
          <label className="full-form-field"><span>Palmarés y logros</span><textarea maxLength={2000} rows={4} value={memberEditForm.palmares || ''} onChange={(event) => setMemberEditForm({ ...memberEditForm, palmares: event.target.value })} placeholder="Ej. Campeón nacional 2024 · 1.er lugar, categoría Open" /></label>
          <div className="available-day-picker full-form-field"><span>Días habituales disponibles</span><div>{['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((day) => <label key={day}><input type="checkbox" checked={(memberEditForm.availableDays || []).includes(day)} onChange={(event) => setMemberEditForm({ ...memberEditForm, availableDays: event.target.checked ? [...(memberEditForm.availableDays || []), day] : (memberEditForm.availableDays || []).filter((item) => item !== day) })} /><span>{day}</span></label>)}</div></div>
          <div className="availability-absence-title">Aviso de ausencia temporal</div>
          <label><span>Desde</span><input type="date" value={memberEditForm.unavailableFrom || ''} onChange={(event) => setMemberEditForm({ ...memberEditForm, unavailableFrom: event.target.value })} /></label>
          <label><span>Hasta</span><input type="date" min={memberEditForm.unavailableFrom || undefined} value={memberEditForm.unavailableUntil || ''} onChange={(event) => setMemberEditForm({ ...memberEditForm, unavailableUntil: event.target.value })} /></label>
          <label className="full-form-field"><span>Nota de disponibilidad o ausencia</span><textarea maxLength={255} value={memberEditForm.availabilityNotes || ''} onChange={(event) => setMemberEditForm({ ...memberEditForm, availabilityNotes: event.target.value })} placeholder="Ej. No disponible por viaje entre estas fechas" /></label>
          <div className="form-actions"><button type="button" className="outline-button" onClick={() => setEditingMember(null)}>Cancelar</button><button type="submit" className="primary-button" disabled={savingMember}>{savingMember ? 'Guardando…' : 'Guardar ficha'}</button></div>
        </form>
      </div></div>}

      {selectedAthlete && <div className="athlete-form-overlay" onClick={() => setSelectedAthlete(null)}><article className="athlete-form-panel athlete-profile-card" onClick={(event) => event.stopPropagation()}>
        <div className="sport-passport-book">
        <div className="sport-passport-topline"><div><Waves size={18} /><span>SKY DRAGONS <small>PASAPORTE DEPORTIVO</small></span></div><span className="sport-passport-season">TEMPORADA 2026</span></div>
        <div className="athlete-profile-titlebar"><div className="athlete-profile-identity"><div className="athlete-profile-photo">{profilePhotoUrl ? <img src={profilePhotoUrl} alt={`Foto de ${selectedAthlete.name}`} /> : <span>{selectedAthlete.initials}</span>}</div><div><p className="roster-kicker">IDENTIFICACIÓN DEL REMERO</p><h2>{selectedAthlete.name}</h2><span>{selectedAthlete.category || selectedCategory} · {selectedAthlete.side}</span></div></div><div className="athlete-profile-actions">{canManageProfilePhoto && <label className="profile-photo-upload">{profilePhotoUploading ? 'Subiendo…' : profilePhotoUrl ? 'Cambiar foto' : 'Agregar foto'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={profilePhotoUploading} onChange={uploadProfilePhoto} /></label>}{canManageProfilePhoto && profilePhotoUrl && <button className="profile-photo-remove" disabled={profilePhotoUploading} onClick={removeProfilePhoto}>Quitar</button>}<button className="profile-edit-button" onClick={() => openMemberEditor(selectedAthlete)}><Pencil size={14} /> EDITAR FICHA</button><button className="close-button" onClick={() => setSelectedAthlete(null)}>×</button></div></div>
        {profilePhotoError && <p className="profile-photo-error" role="alert">{profilePhotoError}</p>}
        <div className="sport-passport-number"><span>FICHA INTERNA</span><strong>{selectedAthlete.number || selectedAthlete.id}</strong></div>
        <div className="athlete-profile-grid sport-passport-grid">
          <div><span>Nombre</span><strong>{selectedAthlete.firstName || 'Sin registrar'}</strong></div><div><span>Apellido</span><strong>{selectedAthlete.lastName || 'Sin registrar'}</strong></div>
          <div><span>Edad</span><strong>{getAge(selectedAthlete.birthDate) == null ? 'Sin registrar' : `${getAge(selectedAthlete.birthDate)} años`}</strong></div><div><span>Fecha de nacimiento</span><strong>{formatBirthDate(selectedAthlete.birthDate)}</strong></div>
          <div><span>Categoría</span><strong>{selectedAthlete.category || selectedCategory}</strong></div><div><span>Posición</span><strong>{({ remero: 'Remero', timonel: 'Timonel', tamborilero: 'Tamborilero', suplente: 'Suplente', staff: 'Staff' })[selectedAthlete.rawRole] || selectedAthlete.role}</strong></div>
          <div><span>Lado de remada</span><strong>{selectedAthlete.side}</strong></div><div><span>Asistencia registrada</span><strong>{sportHistory?.attendancePercent == null ? 'Sin datos' : `${sportHistory.attendancePercent}% (${sportHistory.attendedTrainings}/${sportHistory.countedTrainings})`}</strong></div>
          <div><span>Peso</span><strong>{selectedAthlete.weightKg ? `${selectedAthlete.weightKg} kg` : 'Sin registrar'}</strong></div><div><span>Estatura</span><strong>{selectedAthlete.heightCm ? `${selectedAthlete.heightCm} cm` : 'Sin registrar'}</strong></div>
          <div><span>Estado</span><strong>{selectedAthlete.status}</strong></div>
          <div><span>Contacto de emergencia</span><strong>{selectedAthlete.emergencyContactName || 'Sin registrar'}</strong></div><div><span>Telefono de emergencia</span><strong>{selectedAthlete.emergencyContactPhone || 'Sin registrar'}</strong></div>
          <div><span>Correo</span><strong>{selectedAthlete.email || 'Sin registrar'}</strong></div><div><span>Telefono</span><strong>{selectedAthlete.phone || 'Sin registrar'}</strong></div>
        </div>
        <div className="sport-passport-notice">Documento deportivo interno del equipo. No es una identificación oficial.</div>
        </div>
        <section className="athlete-profile-section"><div className="athlete-section-heading"><div><p className="roster-kicker">PERFIL DEL REMERO</p><h3>Biografía</h3></div></div><p className="athlete-profile-text">{selectedAthlete.biography || 'Aún no se ha agregado una biografía.'}</p></section>
        <section className="athlete-profile-section"><div className="athlete-section-heading"><div><p className="roster-kicker">HISTORIAL DE CLUBES</p><h3>Equipos donde ha remado</h3></div><Users size={19} /></div><p className="athlete-profile-text">{selectedAthlete.rowingTeams || 'Aún no se han agregado equipos anteriores.'}</p></section>
        <section className="athlete-profile-section"><div className="athlete-section-heading"><div><p className="roster-kicker">TRAYECTORIA DEPORTIVA</p><h3>Palmarés</h3></div><Medal size={19} /></div><p className="athlete-profile-text">{selectedAthlete.palmares || 'Aún no se han registrado logros destacados.'}</p></section>
        <section className="athlete-availability"><div><p className="roster-kicker">ORGANIZACIÓN DE ENTRENAMIENTOS</p><h3>Disponibilidad</h3></div><div className="availability-days">{selectedAthlete.availableDays?.length ? selectedAthlete.availableDays.map((day) => <span key={day}>{day}</span>) : <span className="availability-unset">Días habituales sin informar</span>}</div>{selectedAthlete.unavailableFrom || selectedAthlete.unavailableUntil ? <div className="availability-notice"><strong>Aviso temporal</strong><span>{selectedAthlete.unavailableFrom || 'Inicio pendiente'} – {selectedAthlete.unavailableUntil || 'Sin fecha final'}</span>{selectedAthlete.availabilityNotes && <small>{selectedAthlete.availabilityNotes}</small>}</div> : selectedAthlete.availabilityNotes && <div className="availability-notice"><strong>Nota</strong><small>{selectedAthlete.availabilityNotes}</small></div>}</section>
        {['admin', 'capitan'].includes(currentUser?.role) && <section className="athlete-history-section"><div className="athlete-section-heading"><div><p className="roster-kicker">ACCESO RESTRINGIDO</p><h3>Salud y autorización</h3></div><ShieldCheck size={19} /></div><div className="training-form"><label className="full-field"><span>Alergias</span><textarea value={health.allergies} onChange={(event) => setHealth({ ...health, allergies: event.target.value })} /></label><label className="full-field"><span>Notas médicas relevantes</span><textarea value={health.medicalNotes} onChange={(event) => setHealth({ ...health, medicalNotes: event.target.value })} /></label><label><span>Autorización médica vigente hasta</span><input type="date" value={health.medicalClearanceUntil} onChange={(event) => setHealth({ ...health, medicalClearanceUntil: event.target.value })} /></label><button className="primary-button" disabled={healthSaving} onClick={saveHealth}>{healthSaving ? 'Guardando…' : 'Guardar ficha médica'}</button>{healthMessage && <small>{healthMessage}</small>}</div></section>}
        <section className="athlete-history-section">
          <div className="athlete-section-heading"><div><p className="roster-kicker">CONSTANCIA</p><h3>Asistencia a entrenamientos</h3></div><CalendarDays size={19} /></div>
          <div className="athlete-attendance-card"><div className="athlete-attendance-summary"><strong>{sportHistory?.attendancePercent == null ? '—' : `${sportHistory.attendancePercent}%`}</strong><div><b>Asistencia registrada</b><span>{sportHistory?.countedTrainings || 0} sesiones evaluables · {sportHistory?.justifiedTrainings || 0} justificadas</span></div></div><div className="athlete-attendance-meter"><i style={{ width: `${sportHistory?.attendancePercent ?? 0}%` }} /></div><div className="athlete-attendance-breakdown"><span className="present">{sportHistory?.attendedTrainings || 0} presentes</span><span className="absent">{sportHistory?.absentTrainings || 0} ausencias</span><span className="excused">{sportHistory?.justifiedTrainings || 0} justificadas</span></div></div>
          <div className="athlete-training-history"><h4>Sesiones recientes</h4>{sportHistory?.trainingHistory?.length ? sportHistory.trainingHistory.slice(0, 6).map((training) => <div className="athlete-training-row" key={training.trainingId}><div><strong>{training.date ? new Date(`${training.date}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sesión'}</strong><span>{({ agua: 'Agua', gimnasio: 'Gimnasio', fisico: 'Físico', otro: 'Otro' })[training.type] || 'Entrenamiento'}{training.location ? ` · ${training.location}` : ''}</span></div><span className={`attendance-status ${training.status}`}>{training.status === 'presente' ? 'Presente' : training.status === 'justificado' ? 'Justificada' : 'Ausente'}</span></div>) : <p className="athlete-history-empty">Aún no hay pases de lista registrados para este integrante.</p>}</div>
        </section>
        <section className="athlete-history-section">
          <div className="athlete-section-heading"><div><p className="roster-kicker">CONCEPT2 LOGBOOK / ERGDATA</p><h3>Marcas de ergómetro</h3></div><Waves size={19} /></div>
          {concept2History.length ? <div className="athlete-training-history">{concept2History.slice(0, 8).map((score) => <div className="athlete-training-row concept2-athlete-row" key={score.id}><div><strong>{score.distanceM ? `${Number(score.distanceM).toLocaleString('es')} m` : 'Sesión de remo'} · {formatErgDuration(score.durationSeconds)}</strong><span>{score.date}{score.averageWatts ? ` · ${Math.round(Number(score.averageWatts))} W` : ''}{score.averageHeartRate ? ` · ${score.averageHeartRate} lpm` : ''}</span></div><span className="concept2-result-badge">{formatErgPace(score.durationSeconds, score.distanceM)}</span></div>)}</div> : <p className="athlete-history-empty">Aún no hay marcas de Concept2 importadas para este integrante.</p>}
        </section>
        <section className="athlete-history-section athlete-progress-section">
          <div className="athlete-section-heading"><div><p className="roster-kicker">PROGRESO DEPORTIVO</p><h3>Evolución de marcas</h3></div><Medal size={19} /></div>
          {performanceDistances.length ? <><div className="athlete-progress-toolbar"><label><span>Distancia</span><select value={activeProgressDistance} onChange={(event) => setProgressDistance(event.target.value)}>{performanceDistances.map((distance) => <option key={distance} value={distance}>{Number(distance).toLocaleString('es')} m</option>)}</select></label><div className="personal-best"><span>Mejor marca</span><strong>{formatRaceTime(fastestTime)}</strong></div></div><div className="athlete-progress-chart" aria-label={`Evolución de marcas en ${activeProgressDistance} metros`}>{progressRecords.slice(-8).map((race, index) => { const time = Number(race.timeSeconds); const height = slowestTime === fastestTime ? 72 : 34 + ((slowestTime - time) / (slowestTime - fastestTime)) * 58; return <div className={`athlete-progress-point ${time === fastestTime ? 'best' : ''}`} key={`${race.competition}-${race.date}-${index}`}><strong>{formatRaceTime(time)}</strong><i style={{ height: `${height}%` }} /><span>{race.date ? new Date(`${race.date}T12:00:00`).toLocaleDateString('es', { month: 'short', year: '2-digit' }) : `#${index + 1}`}</span></div> })}</div></> : <p className="athlete-history-empty">Registra tiempos en carreras donde el atleta tenga una alineación para ver su evolución.</p>}
          <div className="athlete-race-history"><h4>Participación en regatas</h4>{athleteRaces.length ? athleteRaces.slice(0, 8).map((race, index) => <div className="athlete-race-row" key={`${race.lineupName}-${index}`}><strong>{race.competition || race.lineupName || 'Alineación'}</strong><span>{race.date || 'Fecha pendiente'} · {race.category || 'Sin categoría'} · {race.seatRole}</span><b>{race.distanceM ? `${race.distanceM} m` : 'Regata'}{race.timeSeconds ? ` · ${formatRaceTime(race.timeSeconds)}` : ''}{race.position ? ` · puesto ${race.position}` : ''}</b></div>) : <p className="athlete-history-empty">Aún no hay participaciones registradas en alineaciones con carrera.</p>}</div>
        </section>
      </article></div>}
    </div>
  )
}

function TrainingView({ currentUser }) {
  const [ergScores, setErgScores] = useState([])
  const [ergMembers, setErgMembers] = useState([])
  const [ergForm, setErgForm] = useState({ memberId: '', date: new Date().toISOString().slice(0, 10), distanceM: '2000', minutes: '', seconds: '', averageWatts: '', bodyWeightKg: '', contributionPercent: '', notes: '' })
  const [ergError, setErgError] = useState('')
  const [ergFilter, setErgFilter] = useState('')
  const [ergConnection, setErgConnection] = useState(null)
  const [ergSyncing, setErgSyncing] = useState(false)
  const [ergFeedback, setErgFeedback] = useState('')
  useEffect(() => {
    Promise.all([apiRequest('/api/erg-scores?limit=500'), apiRequest('/api/members?status=activo&limit=500')])
      .then(([scores, people]) => { setErgScores(scores.data); setErgMembers(people.data) })
      .catch((requestError) => setErgError(requestError.message))
  }, [])
  useEffect(() => {
    if (!ergForm.memberId) { setErgConnection(null); return }
    apiRequest(`/api/ergdata/status/${ergForm.memberId}`).then(setErgConnection).catch(() => setErgConnection(null))
  }, [ergForm.memberId])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.has('ergdata')) return
    setErgFeedback(params.get('ergdata') === 'connected' ? 'Concept2 Logbook conectado. Ya puedes importar las marcas.' : params.get('message') || 'No se pudo conectar con Concept2.')
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
  }, [])
  const connectErgData = async () => {
    if (!ergForm.memberId) { setErgFeedback('Selecciona primero al integrante que autorizará su cuenta.'); return }
    try {
      const response = await apiRequest(`/api/ergdata/connect/${ergForm.memberId}`, { method: 'POST' })
      window.location.assign(response.authorizationUrl)
    } catch (requestError) { setErgFeedback(requestError.message) }
  }
  const syncErgData = async () => {
    if (!ergForm.memberId) return
    setErgSyncing(true); setErgFeedback('')
    try {
      const result = await apiRequest(`/api/ergdata/sync/${ergForm.memberId}`, { method: 'POST' })
      const scores = await apiRequest('/api/erg-scores?limit=500')
      setErgScores(scores.data)
      setErgConnection(await apiRequest(`/api/ergdata/status/${ergForm.memberId}`))
      setErgFeedback(`${result.imported} marcas nuevas importadas de ${result.scanned} sesiones de Concept2.`)
    } catch (requestError) { setErgFeedback(requestError.message) }
    finally { setErgSyncing(false) }
  }
  const saveErgScore = async (event) => {
    event.preventDefault(); setErgError('')
    const durationSeconds = Number(ergForm.minutes || 0) * 60 + Number(ergForm.seconds || 0)
    if (!ergForm.memberId || !ergForm.date || !Number(ergForm.distanceM) || !durationSeconds) { setErgError('Completa atleta, fecha, distancia y tiempo.'); return }
    try {
      const record = await apiRequest('/api/erg-scores', { method: 'POST', body: JSON.stringify({ memberId: Number(ergForm.memberId), date: ergForm.date, distanceM: Number(ergForm.distanceM), durationSeconds, averageWatts: ergForm.averageWatts ? Number(ergForm.averageWatts) : null, bodyWeightKg: ergForm.bodyWeightKg ? Number(ergForm.bodyWeightKg) : null, contributionPercent: ergForm.contributionPercent ? Number(ergForm.contributionPercent) : null, notes: ergForm.notes || null }) })
      setErgScores((rows) => [record, ...rows]); setErgForm((form) => ({ ...form, minutes: '', seconds: '', averageWatts: '', notes: '' }))
    } catch (requestError) { setErgError(requestError.message) }
  }
  const deleteErgScore = async (record) => { try { await apiRequest(`/api/erg-scores/${record.id}`, { method: 'DELETE' }); setErgScores((rows) => rows.filter((row) => row.id !== record.id)) } catch (requestError) { setErgError(requestError.message) } }
  const [training, setTraining] = useState({
    date: '',
    startTime: '',
    location: '',
    category: 'Open 1',
    type: 'Agua',
    notes: '',
    distanceM: '',
    durationMinutes: '',
    strokeRate: '',
    waterConditions: '',
    safetyChecks: { boatReady: false, lifeVestsReady: false, crewCountReady: false, weatherChecked: false },
  })
  const [attendance, setAttendance] = useState([])
  const [trainingRecords, setTrainingRecords] = useState([])
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest(`/api/members?category=${encodeURIComponent(training.category)}&status=activo&limit=500`)
      .then((result) => setAttendance(result.data.map((member) => ({
        id: member.id, name: `${member.firstName} ${member.lastName}`.trim(), initials: `${member.firstName[0] || ''}${member.lastName[0] || ''}`.toUpperCase(), color: '#75a7ff', present: true,
      }))))
      .catch((requestError) => setError(requestError.message))
  }, [training.category])

  useEffect(() => {
    apiRequest('/api/trainings?limit=100').then((result) => setTrainingRecords(result.data)).catch((requestError) => setError(requestError.message))
  }, [])

  const present = attendance.filter((person) => person.present).length
  const attendanceLevel = attendance.length ? Math.round((present / attendance.length) * 100) : 0

  const updateTraining = (field, value) => {
    setTraining((current) => ({ ...current, [field]: value }))
    setSaved(false)
  }

  const saveTraining = async () => {
    if (!training.date) { setError('Selecciona la fecha del entrenamiento.'); return }
    setSaving(true)
    setError('')
    try {
      const created = await apiRequest('/api/trainings', {
        method: 'POST',
        body: JSON.stringify({ date: training.date, category: training.category, startTime: training.startTime || null, location: training.location, type: ({ Agua: 'agua', Gimnasio: 'gimnasio', 'Físico': 'fisico', Otro: 'otro' })[training.type] || 'otro', notes: training.notes, distanceM: training.distanceM ? Number(training.distanceM) : null, durationMinutes: training.durationMinutes ? Number(training.durationMinutes) : null, strokeRate: training.strokeRate ? Number(training.strokeRate) : null, waterConditions: training.waterConditions, safetyChecks: training.safetyChecks }),
      })
      setTrainingRecords((current) => [created, ...current])
      if (attendance.length) {
        await apiRequest(`/api/trainings/${created.id}/attendance`, {
          method: 'POST',
          body: JSON.stringify(attendance.map((person) => ({ memberId: person.id, status: person.present ? 'presente' : 'ausente' }))),
        })
      }
      setSaved(true)
    } catch (requestError) { setError(requestError.message) }
    finally { setSaving(false) }
  }

  const deleteTraining = async (record) => {
    if (!window.confirm('¿Borrar este entrenamiento y su lista de asistencia?')) return
    try {
      await apiRequest(`/api/trainings/${record.id}`, { method: 'DELETE' })
      setTrainingRecords((current) => current.filter((item) => item.id !== record.id))
      setError('')
    } catch (requestError) { setError(requestError.message) }
  }

  return (
    <div className="training-view">
      <div className="training-layout">
        {error && <p className="login-error" role="alert">{error}</p>}
        <article className="panel training-form-panel">
          <div className="panel-header">
            <div><p className="roster-kicker">NUEVO ENTRENAMIENTO</p><h2>Programar sesión</h2></div>
            {saved && <span className="saved-badge">Programado</span>}
          </div>

          <div className="training-form">
            <label><span>Distancia (m)</span><input type="number" min="0" value={training.distanceM} onChange={(event) => updateTraining('distanceM', event.target.value)} placeholder="Ej. 2000" /></label>
            <label><span>Duración (min)</span><input type="number" min="0" value={training.durationMinutes} onChange={(event) => updateTraining('durationMinutes', event.target.value)} placeholder="Ej. 60" /></label>
            <label><span>Ritmo (paladas/min)</span><input type="number" min="0" value={training.strokeRate} onChange={(event) => updateTraining('strokeRate', event.target.value)} placeholder="Ej. 70" /></label>
            <label><span>Condiciones del agua</span><input value={training.waterConditions} onChange={(event) => updateTraining('waterConditions', event.target.value)} placeholder="Calma, viento, oleaje..." /></label>
            {training.type === 'Agua' && <div className="safety-checklist"><strong>Preparacion para la sesion</strong><label><input type="checkbox" checked={training.safetyChecks.boatReady} onChange={(event) => updateTraining('safetyChecks', { ...training.safetyChecks, boatReady: event.target.checked })} /><span>Bote y equipo revisados</span></label><label><input type="checkbox" checked={training.safetyChecks.lifeVestsReady} onChange={(event) => updateTraining('safetyChecks', { ...training.safetyChecks, lifeVestsReady: event.target.checked })} /><span>Chalecos disponibles</span></label><label><input type="checkbox" checked={training.safetyChecks.crewCountReady} onChange={(event) => updateTraining('safetyChecks', { ...training.safetyChecks, crewCountReady: event.target.checked })} /><span>Tripulacion y contactos confirmados</span></label><label><input type="checkbox" checked={training.safetyChecks.weatherChecked} onChange={(event) => updateTraining('safetyChecks', { ...training.safetyChecks, weatherChecked: event.target.checked })} /><span>Clima y condiciones del agua revisados</span></label></div>}
            <label><span>Fecha</span><input type="date" value={training.date} onChange={(event) => updateTraining('date', event.target.value)} /></label>
            <label><span>Hora de inicio</span><input type="time" value={training.startTime} onChange={(event) => updateTraining('startTime', event.target.value)} /></label>
            <label><span>Categoría</span><select value={training.category} onChange={(event) => updateTraining('category', event.target.value)}>{Object.keys(categoryRosters).map((category) => <option key={category}>{category}</option>)}</select></label>
            <label><span>Tipo de sesión</span><select value={training.type} onChange={(event) => updateTraining('type', event.target.value)}><option>Agua</option><option>Gimnasio</option><option>Físico</option><option>Otro</option></select></label>
            <label className="full-field"><span>Lugar</span><div className="input-icon"><MapPin size={16} /><input value={training.location} onChange={(event) => updateTraining('location', event.target.value)} placeholder="Ej. Cinta Costera" /></div></label>
            <label className="full-field"><span>Plan de entrenamiento</span><textarea value={training.notes} onChange={(event) => updateTraining('notes', event.target.value)} placeholder="Escribe el calentamiento, ejercicios, series y objetivo de la sesión..." /></label>
          </div>

          <div className="training-form-actions">
            <button className="outline-button-light" onClick={() => setTraining({ date: '', startTime: '', location: '', category: 'Open 1', type: 'Agua', notes: '', distanceM: '', durationMinutes: '', strokeRate: '', waterConditions: '', safetyChecks: { boatReady: false, lifeVestsReady: false, crewCountReady: false, weatherChecked: false } })}>Limpiar</button>
            <button className="primary-button" onClick={saveTraining} disabled={saving}><CalendarDays size={17} /> {saving ? 'GUARDANDO…' : 'GUARDAR ENTRENAMIENTO'}</button>
          </div>
        </article>

        <article className="panel attendance-panel-card">
          <div className="panel-header">
            <div><p className="roster-kicker">CONTROL DE ASISTENCIA</p><h2>Nivel de asistencia</h2></div>
            <div className="attendance-percent">{attendanceLevel}%</div>
          </div>

          <div className="attendance-meter"><div style={{ width: `${attendanceLevel}%` }} /></div>
          <div className="attendance-count"><strong>{present}</strong><span>de {attendance.length} atletas confirmados</span></div>

          <div className="attendance-list">
            {attendance.map((person) => (
              <button
                key={person.id}
                className={person.present ? 'attendance-row present' : 'attendance-row'}
                onClick={() => setAttendance((current) => current.map((item) => item.id === person.id ? { ...item, present: !item.present } : item))}
              >
                <div className="member-name"><b style={{ background: person.color }}>{person.initials}</b><strong>{person.name}</strong></div>
                <span>{person.present ? 'Asiste' : 'Ausente'}</span>
              </button>
            ))}
          </div>
        </article>
      </div>

      <article className="panel training-history-panel">
        <div className="panel-header"><div><p className="roster-kicker">HISTORIAL</p><h2>Entrenamientos programados</h2></div><span className="inventory-count">{trainingRecords.length} sesiones</span></div>
        {trainingRecords.length ? trainingRecords.map((record) => <div className="training-history-row" key={record.id}><div><strong>{record.notes || 'Sesion deportiva'}</strong><span>{record.date} · {record.startTime || 'Hora pendiente'} · {record.location || 'Lugar pendiente'}</span></div><span>{record.type} · {record.distanceM ? `${record.distanceM} m` : 'Sin distancia'}</span><button className="icon-danger-button" aria-label="Borrar entrenamiento" title="Borrar entrenamiento" onClick={() => deleteTraining(record)}><Trash2 size={16} /></button></div>) : <p className="saved-lineups-empty">Aun no hay entrenamientos guardados.</p>}
      </article>

      {saved && (
        <article className="panel scheduled-preview">
          <div className="scheduled-icon"><Dumbbell size={22} /></div>
          <div className="scheduled-copy"><span>ENTRENAMIENTO PROGRAMADO</span><strong>{training.notes || 'Sesión deportiva'}</strong><small><Clock3 size={13} /> {training.startTime} · <MapPin size={13} /> {training.location}</small></div>
          <div className="scheduled-category">{training.category}</div>
        </article>
      )}
    </div>
  )
}

function Concept2View({ currentUser, onNavigate }) {
  const [trainings, setTrainings] = useState([])
  const [members, setMembers] = useState([])
  const [scores, setScores] = useState([])
  const [trainingId, setTrainingId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [connection, setConnection] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [analysisDistance, setAnalysisDistance] = useState('')

  const loadData = async () => {
    setLoadingData(true); setError('')
    try {
      const [trainingResult, memberResult, scoreRows] = await Promise.all([
      apiRequest('/api/trainings?limit=500'),
      apiRequest('/api/members?limit=500'),
      fetchAllRows('/api/erg-scores'),
      ])
      const sorted = [...trainingResult.data].sort((a, b) => String(b.date).localeCompare(String(a.date)))
      setTrainings(sorted); setMembers(memberResult.data); setScores(scoreRows)
      const returnedMember = new URLSearchParams(window.location.search).get('memberId')
      if (returnedMember && memberResult.data.some((member) => String(member.id) === returnedMember)) setMemberId(returnedMember)
      else if (memberResult.data.length) setMemberId(String(memberResult.data[0].id))
    } catch (requestError) {
      setError(requestError.message === 'fetch failed' ? 'No se pudo conectar con el servidor. Revisa que la API esté activa y vuelve a cargar.' : requestError.message)
    } finally { setLoadingData(false) }
  }
  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (!memberId) { setConnection(null); return }
    apiRequest(`/api/ergdata/status/${memberId}`).then(setConnection).catch(() => setConnection(null))
  }, [memberId])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.has('ergdata')) return
    setMessage(params.get('ergdata') === 'connected' ? 'Logbook conectado. Ya puedes recopilar los datos.' : params.get('message') || 'No se pudo conectar con Concept2.')
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
  }, [])

  const selectedTraining = trainings.find((training) => String(training.id) === trainingId)
  const categoryMembers = selectedTraining ? members.filter((member) => member.category === selectedTraining.category) : members
  useEffect(() => {
    if (selectedTraining && (!memberId || !categoryMembers.some((member) => String(member.id) === memberId))) setMemberId(categoryMembers.length ? String(categoryMembers[0].id) : '')
  }, [trainingId, members.length])
  const eligibleScores = selectedTraining ? scores.filter((score) => score.date === selectedTraining.date && categoryMembers.some((member) => Number(member.id) === Number(score.memberId))) : scores.filter((score) => categoryMembers.some((member) => Number(member.id) === Number(score.memberId)))
  const linkedScores = memberId ? eligibleScores.filter((score) => Number(score.memberId) === Number(memberId)) : eligibleScores
  const selectedMember = members.find((member) => String(member.id) === memberId)
  const categoryErgScores = scores.filter((score) => score.source === 'concept2' && categoryMembers.some((member) => Number(member.id) === Number(score.memberId)))
  const analysisMembers = memberId ? categoryMembers.filter((member) => String(member.id) === memberId) : categoryMembers
  const analysisScores = categoryErgScores.filter((score) => analysisMembers.some((member) => Number(member.id) === Number(score.memberId)))
  const availableDistances = [...new Set(analysisScores.map((score) => Number(score.distanceM)))].sort((a, b) => a - b)
  const selectedDistance = availableDistances.includes(Number(analysisDistance)) ? Number(analysisDistance) : availableDistances[0]
  const historySeries = memberId ? analysisScores.filter((score) => Number(score.memberId) === Number(memberId) && Number(score.distanceM) === selectedDistance).sort((a, b) => String(a.date).localeCompare(String(b.date))) : []
  const firstHistoryScore = historySeries[0]
  const latestHistoryScore = historySeries[historySeries.length - 1]
  const historyImprovement = firstHistoryScore && latestHistoryScore && firstHistoryScore.id !== latestHistoryScore.id
    ? ((Number(firstHistoryScore.durationSeconds) - Number(latestHistoryScore.durationSeconds)) / Number(firstHistoryScore.durationSeconds)) * 100
    : null
  const chartPoints = historySeries.length > 1 ? historySeries.map((score, index) => {
    const values = historySeries.map((item) => Number(item.durationSeconds))
    const min = Math.min(...values); const max = Math.max(...values); const range = max - min || 1
    const x = 10 + (index * 80) / (historySeries.length - 1)
    const y = 24 + ((Number(score.durationSeconds) - min) / range) * 60
    return { x, y, score }
  }) : []
  const distanceLeaders = selectedDistance ? analysisMembers.map((member) => {
    const series = categoryErgScores.filter((score) => Number(score.memberId) === Number(member.id) && Number(score.distanceM) === selectedDistance).sort((a, b) => String(a.date).localeCompare(String(b.date)))
    const latest = series[series.length - 1]
    const previous = series.length > 1 ? series[series.length - 2] : null
    const change = previous ? ((Number(previous.durationSeconds) - Number(latest.durationSeconds)) / Number(previous.durationSeconds)) * 100 : null
    return { member, latest, change }
  }).filter((row) => row.latest).sort((a, b) => Number(a.latest.durationSeconds) - Number(b.latest.durationSeconds)) : []
  const teamConcept2Scores = scores.filter((score) => score.source === 'concept2')
  const concept2ByMember = members.map((member) => {
    const memberScores = teamConcept2Scores.filter((score) => Number(score.memberId) === Number(member.id)).sort((a, b) => String(b.date).localeCompare(String(a.date)) || Number(b.id) - Number(a.id))
    return { member, count: memberScores.length, latest: memberScores[0] || null }
  }).sort((a, b) => `${a.member.firstName} ${a.member.lastName}`.localeCompare(`${b.member.firstName} ${b.member.lastName}`))
  const averageWatts = analysisScores.filter((score) => Number(score.averageWatts) > 0)
  const averageWattsValue = averageWatts.length ? Math.round(averageWatts.reduce((sum, score) => sum + Number(score.averageWatts), 0) / averageWatts.length) : null
  const canManageConcept2 = ['admin', 'capitan'].includes(currentUser?.role)
  const connectionGuidance = !canManageConcept2
    ? 'Tu perfil puede consultar los resultados. Un administrador o capitán debe conectar cuentas y recopilar datos.'
    : !memberId ? (selectedTraining ? 'Selecciona un integrante de la categoría del entrenamiento.' : 'Selecciona un integrante; puedes conectar su Logbook sin crear un entrenamiento primero.')
        : !connection?.connected ? 'El siguiente paso es conectar el Logbook del integrante.'
          : 'Logbook conectado. Ya puedes recopilar su historial de sesiones.'
  const connect = async () => {
    if (!memberId) { setError('Selecciona al integrante que autorizará su cuenta de Concept2.'); return }
    setError(''); setMessage('Abriendo la autorización segura de Concept2…'); setBusy(true)
    try {
      const result = await apiRequest(`/api/ergdata/connect/${memberId}`, { method: 'POST' })
      window.location.assign(result.authorizationUrl)
    } catch (requestError) { setMessage(''); setError(requestError.message); setBusy(false) }
  }
  const sync = async () => {
    if (!memberId) return
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await apiRequest(`/api/ergdata/sync/${memberId}`, { method: 'POST' })
      const [scoreRows, status] = await Promise.all([
        fetchAllRows('/api/erg-scores'), apiRequest(`/api/ergdata/status/${memberId}`),
      ])
      setScores(scoreRows); setConnection(status)
      setMessage(`${result.imported} marcas nuevas y ${result.updated || 0} actualizadas${result.moreAvailable ? '. Aún quedan páginas; pulsa Importar sesiones otra vez para continuar.' : '.'} ${selectedTraining ? `Aquí se muestran las de ${selectedTraining.date}.` : 'El historial queda disponible para analizar y filtrar por categoría.'}`)
    } catch (requestError) { setError(requestError.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="training-view concept2-view">
      {error && <div className="concept2-load-error" role="alert"><span>{error}</span><button className="outline-button" disabled={loadingData} onClick={loadData}><RefreshCw size={14} /> {loadingData ? 'CARGANDO…' : 'REINTENTAR'}</button></div>}
      <article className="panel">
        <div className="panel-header"><div><p className="roster-kicker">CONCEPT2 LOGBOOK + ERGDATA</p><h2>Trae tus sesiones de remo a Sky Dragons</h2></div><div className="concept2-header-status">{loadingData ? 'Cargando integrantes…' : error ? 'API sin conectar' : `${members.length} integrantes disponibles`}<Waves size={20} /></div></div>
        <div className="concept2-howto"><div><b>1</b><strong>Rema con ErgData</strong><span>Conecta la app ErgData al monitor y guarda la sesión en tu Concept2 Logbook.</span></div><div><b>2</b><strong>Vincula la cuenta</strong><span>El integrante autoriza su Logbook una sola vez desde Concept2.</span></div><div><b>3</b><strong>Importa y analiza</strong><span>Sincroniza sus resultados para ver tiempo, distancia y potencia aquí.</span></div></div>
        <p className="concept2-integration-note">La conexión se hace con Concept2 Logbook; no empareja el monitor por Bluetooth directamente. Los entrenamientos deben estar sincronizados en el Logbook para que aparezcan en Sky Dragons.</p>
        <div className="training-form concept2-selectors">
          <label className="full-field"><span>Entrenamiento (opcional)</span><select value={trainingId} onChange={(event) => setTrainingId(event.target.value)}><option value="">Sin filtrar por entrenamiento</option>{trainings.map((training) => <option key={training.id} value={training.id}>{training.date} · {training.category} · {training.type}{training.location ? ` · ${training.location}` : ''}</option>)}</select></label>
          <label><span>Ver datos de este integrante</span><select value={memberId} onChange={(event) => setMemberId(event.target.value)}><option value="">{loadingData ? 'Cargando integrantes…' : categoryMembers.length ? 'Todos los integrantes' : 'No hay integrantes activos'}</option>{categoryMembers.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}</select></label>
          <div className="concept2-session-detail"><strong>Filtro de resultados</strong><span>{selectedTraining ? `${selectedTraining.date} · ${selectedTraining.category} · ${selectedTraining.notes || selectedTraining.type}` : 'Sin filtro: se mostrará el historial importado del integrante.'}</span></div>
        </div>
        {!loadingData && members.length === 0 && <div className="concept2-no-members"><span>Primero registra al integrante en Sky Dragons; después podrá vincular su propia cuenta de Concept2.</span>{canManageConcept2 && <button className="outline-button" onClick={() => onNavigate('Integrantes')}>AGREGAR INTEGRANTE</button>}</div>}
        <div className="ergdata-connect"><div><strong>{connection?.connected ? `Concept2 Logbook vinculado${connection.username ? ` · ${connection.username}` : ''}` : 'Concept2 Logbook sin vincular'}</strong><span>{connection?.lastSyncedAt ? `Última importación: ${new Date(connection.lastSyncedAt).toLocaleString('es')}` : 'Al vincular, el atleta inicia sesión en Concept2 y autoriza esta app.'}</span></div>{canManageConcept2 && <div className="ergdata-actions"><button className="outline-button" disabled={!memberId || busy} onClick={connect}>{busy ? 'ESPERA…' : connection?.connected ? 'CAMBIAR CUENTA' : 'VINCULAR LOGBOOK'}</button><button className="primary-button" disabled={!memberId || !connection?.connected || busy} onClick={sync}>{busy ? 'IMPORTANDO…' : 'IMPORTAR SESIONES'}</button></div>}</div>
        <p className="concept2-action-hint" role="status">{connectionGuidance}</p>
        {message && <p className="ergdata-feedback" role="status">{message}</p>}
      </article>
      {currentUser?.role === 'admin' && <article className="panel concept2-admin-overview">
        <div className="panel-header"><div><p className="roster-kicker">VISTA DE ADMINISTRADOR</p><h2>ErgData por integrante</h2><p>Resumen de las cuentas y marcas importadas de todo el equipo.</p></div><span className="inventory-count">{teamConcept2Scores.length} marcas</span></div>
        <div className="concept2-admin-list">
          <div className="concept2-admin-row concept2-admin-head"><span>Integrante</span><span>Marcas</span><span>Última sesión</span><span>Resultado</span><span /></div>
          {concept2ByMember.map(({ member, count, latest }) => <div className="concept2-admin-row" key={member.id}>
            <div><strong>{member.firstName} {member.lastName}</strong><small>{member.category || 'Sin categoría'}{member.status === 'inactivo' ? ' · Inactivo' : ''}</small></div>
            <span>{count}</span>
            <span>{latest?.date || 'Sin importar'}</span>
            <span>{latest ? `${Number(latest.distanceM).toLocaleString('es')} m · ${formatErgDuration(latest.durationSeconds)}` : '—'}</span>
            <button className="concept2-admin-open" disabled={!count} onClick={() => { setTrainingId(''); setMemberId(String(member.id)) }}>{count ? 'VER DATOS' : 'SIN DATOS'}</button>
          </div>)}
          {!concept2ByMember.length && <p className="athlete-history-empty">No hay integrantes registrados.</p>}
        </div>
      </article>}
      <article className="panel">
        <div className="panel-header"><div><p className="roster-kicker">{selectedTraining ? 'DATOS DE LA SESIÓN' : 'HISTORIAL DE ERGÓMETRO'}</p><h2>{selectedTraining ? `Resultados · ${selectedTraining.date}` : selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'Resultados de integrantes'}</h2>{selectedMember && <p>Historial individual de Concept2</p>}</div><span className="inventory-count">{linkedScores.length} marcas</span></div>
        {linkedScores.length ? (
          <div className="concept2-result-list">
            {linkedScores.map((score) => {
              const member = members.find((item) => Number(item.id) === Number(score.memberId))
              const weightClass = score.weightClass === 'H' ? 'Hwt' : score.weightClass === 'L' ? 'Lwt' : null
              const metrics = [
                score.averageStrokeRate != null ? `${score.averageStrokeRate} paladas/min` : null,
                score.averageHeartRate != null ? `${score.averageHeartRate} lpm` : null,
                score.caloriesTotal != null ? `${score.caloriesTotal} kcal` : null,
                score.dragFactor != null ? `Factor ${score.dragFactor}` : null,
                score.deviceSource ? `Origen: ${score.deviceSource}` : null,
              ].filter(Boolean)
              return (
                <div className="concept2-result-row" key={score.id}>
                  <div className="concept2-result-copy">
                    <strong>{member ? `${member.firstName} ${member.lastName}` : `Integrante ${score.memberId}`} · {Number(score.distanceM).toLocaleString('es')} m</strong>
                    <span>{score.date} · {formatErgDuration(score.durationSeconds)} · {formatErgPace(score.durationSeconds, score.distanceM)} · {score.source === 'concept2' ? formatConcept2WorkoutType(score.workoutType) : 'Registro manual'}{weightClass ? ` · ${weightClass}` : ''}</span>
                    {score.comments && <small className="concept2-result-comment">{score.comments}</small>}
                    {metrics.length > 0 && <small className="concept2-result-metrics">{metrics.join(' · ')}</small>}
                  </div>
                  <div className="concept2-result-badge">{score.source === 'concept2' ? 'RowErg' : 'Manual'}</div>
                </div>
              )
            })}
          </div>
        ) : <div className="empty-state"><Timer size={24} /><p>{selectedTraining ? `No hay marcas de ${selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'integrantes'} para esta fecha. Sincroniza su Logbook para recopilar los resultados.` : selectedMember ? `Aún no hay marcas para ${selectedMember.firstName} ${selectedMember.lastName}. Conecta su Logbook y pulsa Importar sesiones.` : 'Aún no hay marcas. Selecciona un integrante, conecta su Logbook y recopila sus sesiones.'}</p></div>}
      </article>
      <article className="panel concept2-analysis">
        <div className="panel-header"><div><p className="roster-kicker">ANÁLISIS DE ERGDATA</p><h2>Progreso y comparación</h2><p>{selectedMember ? `Historial de ${selectedMember.firstName} ${selectedMember.lastName}` : selectedTraining ? `Historial Concept2 · ${selectedTraining.category}` : 'Elige un integrante arriba para ver sus datos'}</p></div><Timer size={21} /></div>
        <div className="concept2-analysis-toolbar"><label><span>Distancia para comparar</span><select value={selectedDistance || ''} onChange={(event) => setAnalysisDistance(event.target.value)}><option value="">Sin distancias importadas</option>{availableDistances.map((distance) => <option key={distance} value={distance}>{distance.toLocaleString('es')} m</option>)}</select></label><span>{memberId ? 'La curva muestra el progreso del atleta seleccionado.' : 'Selecciona un atleta arriba para ver su curva de evolución.'}</span></div>
        <div className="concept2-metrics"><div><span>Sesiones analizadas</span><strong>{analysisScores.length}</strong></div><div><span>Atletas con marcas</span><strong>{new Set(analysisScores.map((score) => score.memberId)).size}</strong></div><div><span>Potencia media</span><strong>{averageWattsValue ? `${averageWattsValue} W` : '—'}</strong></div><div><span>Cambio en {selectedDistance || '—'} m</span><strong className={historyImprovement == null ? '' : historyImprovement >= 0 ? 'positive' : 'negative'}>{historyImprovement == null ? '—' : `${historyImprovement > 0 ? '+' : ''}${historyImprovement.toFixed(1)}%`}</strong><small>{historyImprovement == null ? 'requiere 2 marcas' : historyImprovement >= 0 ? 'más rápido vs. primera marca' : 'más lento vs. primera marca'}</small></div></div>
        {memberId && historySeries.length > 1 ? <div className="concept2-chart"><div className="concept2-chart-title"><strong>{selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'Integrante'} · {selectedDistance} m</strong><span>Tiempo total · menor es mejor</span></div><svg viewBox="0 0 100 100" role="img" aria-label="Evolución del tiempo en ergómetro"><polyline points={chartPoints.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#087f7b" strokeWidth="2.5" />{chartPoints.map(({ x, y, score }) => <circle key={score.id} cx={x} cy={y} r="2.8" fill="#ff7048"><title>{`${score.date}: ${formatErgDuration(score.durationSeconds)}`}</title></circle>)}</svg><div className="erg-chart-labels"><span>{historySeries[0].date}</span><span>{historySeries[historySeries.length - 1].date}</span></div></div> : !analysisScores.length ? <div className="empty-state"><Timer size={22} /><p>{selectedMember ? `No hay historial Concept2 para ${selectedMember.firstName} ${selectedMember.lastName}.` : 'Sin datos importados de Concept2 para estos integrantes.'} Conecta y sincroniza el Logbook para recopilar resultados.</p></div> : memberId ? <p className="athlete-history-empty">Se necesitan al menos dos marcas de la misma distancia para mostrar la evolución.</p> : null}
        {distanceLeaders.length > 0 && <div className="concept2-leaderboard"><div className="concept2-table-heading"><strong>Mejor marca reciente · {selectedDistance} m</strong><span>Ordenado por menor tiempo</span></div>{distanceLeaders.map(({ member, latest, change }) => <div className="fleet-record-row" key={member.id}><div><strong>{member.firstName} {member.lastName}</strong><span>{latest.date} · {formatErgDuration(latest.durationSeconds)} · {latest.averageWatts ? `${latest.averageWatts} W` : 'Vatios sin registrar'}</span></div><span className="fleet-badge realizada">{change == null ? 'Marca inicial' : `${change > 0 ? '+' : ''}${change.toFixed(1)}% ${change >= 0 ? 'más rápido' : 'más lento'}`}</span></div>)}</div>}
      </article>
    </div>
  )
}

function PhysicalMetricsView({ currentUser }) {
  const [members, setMembers] = useState([])
  const [memberId, setMemberId] = useState('')
  const [metrics, setMetrics] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [metricName, setMetricName] = useState('Peso corporal')
  const [customName, setCustomName] = useState('')
  const [customUnit, setCustomUnit] = useState('')
  const [chartMetric, setChartMetric] = useState('')
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const [form, setForm] = useState({ date: today, value: '', notes: '' })
  const canEdit = ['admin', 'capitan'].includes(currentUser?.role)
  const metricChoices = ['Peso corporal', 'Porcentaje de grasa corporal', 'Frecuencia cardíaca en reposo', 'Flexibilidad', 'Salto vertical', 'Plancha', 'Flexiones', 'VO₂ máx', 'Perímetro de cintura', 'Otro']
  const metricUnits = { 'Peso corporal': 'kg', 'Porcentaje de grasa corporal': '%', 'Frecuencia cardíaca en reposo': 'lpm', Flexibilidad: 'cm', 'Salto vertical': 'cm', Plancha: 'seg', Flexiones: 'reps', 'VO₂ máx': 'ml/kg/min', 'Perímetro de cintura': 'cm' }

  useEffect(() => {
    apiRequest('/api/members?limit=500')
      .then((result) => {
        setMembers(result.data)
        if (result.data.length) setMemberId(String(result.data[0].id))
      })
      .catch((requestError) => setError(requestError.message))
  }, [])

  useEffect(() => {
    if (!memberId) { setMetrics([]); return }
    let active = true
    setLoading(true)
    setError('')
    apiRequest(`/api/physical-metrics?memberId=${encodeURIComponent(memberId)}&limit=500`)
      .then((result) => { if (active) setMetrics(result.data.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)) })
      .catch((requestError) => { if (active) setError(requestError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [memberId])

  const selectedMember = members.find((member) => String(member.id) === memberId)
  const chartMetrics = [...new Set(metrics.map((item) => item.metricName))]
  const activeChartMetric = chartMetrics.includes(chartMetric) ? chartMetric : chartMetrics[0] || ''
  const history = metrics.filter((item) => item.metricName === activeChartMetric).slice().sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
  const values = history.map((item) => Number(item.value))
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const valueRange = Math.max(0.01, maxValue - minValue)
  const chartPoints = history.map((item, index) => ({
    item,
    x: history.length === 1 ? 50 : 10 + (index * 80) / (history.length - 1),
    y: history.length === 1 ? 50 : 90 - ((Number(item.value) - minValue) / valueRange) * 70,
  }))
  const latestByMetric = [...new Map(metrics.map((item) => [item.metricName, item])).values()]

  const loadMetrics = async () => {
    if (!memberId) return
    setLoading(true)
    try {
      const result = await apiRequest(`/api/physical-metrics?memberId=${encodeURIComponent(memberId)}&limit=500`)
      setMetrics(result.data.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id))
    } catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }

  const saveMetric = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    const name = metricName === 'Otro' ? customName.trim() : metricName
    const unit = metricName === 'Otro' ? customUnit.trim() : metricUnits[metricName]
    if (!name || !unit) { setError('Escribe el nombre de la prueba y su unidad.'); return }
    setSaving(true)
    try {
      await apiRequest('/api/physical-metrics', { method: 'POST', body: JSON.stringify({ memberId: Number(memberId), date: form.date, metricName: name, value: Number(form.value), unit, notes: form.notes.trim() || null }) })
      setForm((current) => ({ ...current, value: '', notes: '' }))
      setMessage('Medición guardada correctamente.')
      await loadMetrics()
    } catch (requestError) { setError(requestError.message) }
    finally { setSaving(false) }
  }

  const deleteMetric = async (item) => {
    if (!window.confirm(`¿Eliminar la medición “${item.metricName}” del ${item.date}?`)) return
    try {
      await apiRequest(`/api/physical-metrics/${item.id}`, { method: 'DELETE' })
      setMetrics((current) => current.filter((row) => row.id !== item.id))
      setMessage('Medición eliminada correctamente.')
    } catch (requestError) { setError(requestError.message) }
  }

  return <div className="physical-metrics-view">
    <article className="panel physical-metrics-intro">
      <div className="physical-metrics-heading"><div><p className="roster-kicker">SEGUIMIENTO FÍSICO</p><h2>Métricas por remero</h2><p>Registra evaluaciones y revisa cómo evoluciona cada atleta a lo largo de la temporada.</p></div><Activity size={25} /></div>
      {error && <p className="login-error" role="alert">{error}</p>}
      {message && <p className="settings-message success" role="status">{message}</p>}
      <div className="physical-metrics-toolbar"><label><span>Selecciona un remero</span><select value={memberId} onChange={(event) => { setMemberId(event.target.value); setMessage('') }} disabled={!members.length}><option value="">{members.length ? 'Selecciona un remero' : 'No hay integrantes registrados'}</option>{members.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}</select></label>{selectedMember && <div className="physical-member-facts"><span>{selectedMember.category || 'Sin categoría'}</span>{selectedMember.weightKg && <span>Peso en ficha: {selectedMember.weightKg} kg</span>}{selectedMember.heightCm && <span>Estatura: {selectedMember.heightCm} cm</span>}</div>}</div>
    </article>

    {canEdit && <article className="panel physical-metric-form-panel"><div className="panel-header"><div><p className="roster-kicker">NUEVA EVALUACIÓN</p><h2>Registrar medición</h2></div></div>
      {members.length ? <form className="physical-metric-form" onSubmit={saveMetric}>
        <label><span>Prueba física</span><select value={metricName} onChange={(event) => setMetricName(event.target.value)}>{metricChoices.map((name) => <option key={name}>{name}</option>)}</select></label>
        {metricName === 'Otro' && <><label><span>Nombre de la prueba</span><input required maxLength="100" value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Ej. Press de banca" /></label><label><span>Unidad</span><input required maxLength="30" value={customUnit} onChange={(event) => setCustomUnit(event.target.value)} placeholder="kg, cm, segundos…" /></label></>}
        <label><span>Fecha</span><input type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
        <label><span>Resultado {metricName !== 'Otro' && `(${metricUnits[metricName]})`}</span><input type="number" step="0.01" required value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} /></label>
        <label className="physical-metric-notes"><span>Notas (opcional)</span><input maxLength="1000" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Condiciones, protocolo o comentarios" /></label>
        <button type="submit" className="primary-button" disabled={saving || !memberId}>{saving ? 'Guardando…' : 'Guardar medición'}</button>
      </form> : <p className="athlete-history-empty">Agrega primero a los remeros en Integrantes para registrar sus mediciones.</p>}
    </article>}
    {!canEdit && <p className="physical-metrics-readonly"><LockKeyhole size={15} /> Puedes consultar las mediciones. Solo el capitán o el administrador puede registrarlas y eliminarlas.</p>}

    <article className="panel physical-metric-summary"><div className="panel-header"><div><p className="roster-kicker">ÚLTIMOS RESULTADOS</p><h2>{selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'Selecciona un remero'}</h2></div><span className="inventory-count">{metrics.length} mediciones</span></div>
      {loading ? <p className="athlete-history-empty">Cargando historial…</p> : latestByMetric.length ? <div className="physical-metric-cards">{latestByMetric.map((item) => <div className="physical-metric-card" key={item.metricName}><span>{item.metricName}</span><strong>{Number(item.value).toLocaleString('es', { maximumFractionDigits: 2 })} <small>{item.unit}</small></strong><time>{item.date}</time></div>)}</div> : <div className="empty-state"><Activity size={24} /><p>Aún no hay mediciones para este remero. Registra su primera evaluación.</p></div>}
    </article>

    <article className="panel physical-metric-chart-panel"><div className="panel-header"><div><p className="roster-kicker">EVOLUCIÓN</p><h2>Progreso físico</h2></div>{chartMetrics.length > 0 && <select aria-label="Métrica del gráfico" value={activeChartMetric} onChange={(event) => setChartMetric(event.target.value)}>{chartMetrics.map((name) => <option key={name}>{name}</option>)}</select>}</div>
      {history.length > 1 ? <div className="physical-metric-chart"><div className="physical-metric-chart-head"><strong>{activeChartMetric}</strong><span>{history[0].unit} · {history.length} mediciones</span></div><svg viewBox="0 0 100 100" role="img" aria-label={`Evolución de ${activeChartMetric}`}><polyline points={chartPoints.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#087f7b" strokeWidth="2.5" />{chartPoints.map(({ item, x, y }) => <circle key={item.id} cx={x} cy={y} r="2.8" fill="#ff7048"><title>{`${item.date}: ${item.value} ${item.unit}`}</title></circle>)}</svg><div className="erg-chart-labels"><span>{history[0].date}</span><span>{history[history.length - 1].date}</span></div></div> : <p className="athlete-history-empty">{history.length ? 'Registra otra medición de este tipo para comparar el progreso.' : 'El gráfico aparecerá cuando registres evaluaciones.'}</p>}
    </article>

    <article className="panel physical-metric-history"><div className="panel-header"><div><p className="roster-kicker">HISTORIAL</p><h2>Mediciones registradas</h2></div></div>
      {metrics.length ? <div className="physical-metric-list">{metrics.map((item) => <div className="physical-metric-row" key={item.id}><time>{item.date}</time><strong>{item.metricName}</strong><span>{Number(item.value).toLocaleString('es', { maximumFractionDigits: 2 })} {item.unit}</span>{item.notes && <small>{item.notes}</small>}{canEdit && <button className="icon-danger-button" title="Eliminar medición" aria-label={`Eliminar ${item.metricName} del ${item.date}`} onClick={() => deleteMetric(item)}><Trash2 size={15} /></button>}</div>)}</div> : <p className="athlete-history-empty">No hay historial registrado.</p>}
    </article>
  </div>
}

function MedalGalleryPhoto({ race, onUpload, onDelete, uploading }) {
  const [photoUrl, setPhotoUrl] = useState('')
  useEffect(() => {
    let objectUrl = ''
    let active = true
    if (race.medalPhotoType) apiRequest(`/api/races/${race.id}/medal-photo`, { responseType: 'blob' }).then((blob) => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setPhotoUrl(objectUrl)
    }).catch(() => setPhotoUrl(''))
    else setPhotoUrl('')
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [race.id, race.medalPhotoType, race.updatedAt])

  return <>
    {photoUrl ? <div className="gallery-medal-photo"><img src={photoUrl} alt={`Foto de la medalla de ${race.eventName || 'la competencia'}`} /></div> : <div className="gallery-medal-art"><span className="medal-ribbon" /><span className="medal-ribbon second" /><div><Medal size={28} /><b>{race.position}</b></div></div>}
    <div className="gallery-photo-controls"><label className={uploading ? 'gallery-photo-upload disabled' : 'gallery-photo-upload'}>{uploading ? 'Subiendo…' : race.medalPhotoType ? 'Cambiar foto' : 'Subir foto'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(race.id, file); event.target.value = '' }} /></label>{race.medalPhotoType && <button type="button" className="gallery-photo-delete" disabled={uploading} onClick={() => onDelete(race)}>Quitar</button>}</div>
  </>
}

function GalleryPhotoCard({ photo, canManage, onOpen, onDelete }) {
  const [photoUrl, setPhotoUrl] = useState('')
  const [visible, setVisible] = useState(false)
  const cardRef = useRef(null)
  useEffect(() => {
    const node = cardRef.current
    if (!node) return undefined
    if (!('IntersectionObserver' in window)) { setVisible(true); return undefined }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect() }
    }, { rootMargin: '300px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    let active = true
    let objectUrl = ''
    if (!visible) return undefined
    apiRequest(`/api/gallery/${photo.id}/image`, { responseType: 'blob' }).then((blob) => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setPhotoUrl(objectUrl)
    }).catch(() => setPhotoUrl(''))
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [photo.id, visible])

  return <article className="team-gallery-card" ref={cardRef}>
    <button className="team-gallery-open" type="button" onClick={() => photoUrl && onOpen(photo, photoUrl)} disabled={!photoUrl} aria-label={`Ver foto: ${photo.title}`}>
      <span className="team-gallery-image">{photoUrl ? <img src={photoUrl} alt={photo.title} loading="lazy" /> : <ImageIcon size={28} />}</span>
      <span className="team-gallery-card-copy"><strong>{photo.title}</strong>{photo.photoDate && <time>{new Date(`${photo.photoDate}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}</time>}{photo.category && <small>{photo.category}</small>}{photo.description && <span>{photo.description}</span>}</span>
    </button>
    {canManage && <button className="team-gallery-delete" type="button" onClick={() => onDelete(photo)} aria-label={`Eliminar foto: ${photo.title}`} title="Eliminar foto"><Trash2 size={15} /></button>}
  </article>
}

function GalleryView({ currentUser }) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ title: '', description: '', category: '', photoDate: '' })
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const canManage = ['admin', 'capitan'].includes(currentUser?.role)

  const loadPhotos = async () => {
    setLoading(true)
    try {
      const result = await apiRequest('/api/gallery')
      setPhotos(Array.isArray(result.data) ? result.data : [])
      setError('')
    } catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadPhotos() }, [])
  useEffect(() => {
    if (!selectedPhoto) return undefined
    const closeOnEscape = (event) => { if (event.key === 'Escape') setSelectedPhoto(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedPhoto])

  const uploadPhoto = async (event) => {
    event.preventDefault()
    const input = event.currentTarget.elements.photo
    const file = input.files?.[0]
    if (!file) { setError('Selecciona una imagen para subir.'); return }
    if (!form.title.trim()) { setError('Escribe un título para la foto.'); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('La imagen debe estar en formato JPG, PNG o WebP.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('La imagen debe pesar menos de 5 MB.'); return }
    const params = new URLSearchParams({ title: form.title.trim(), description: form.description, category: form.category, photoDate: form.photoDate })
    setUploading(true); setError('')
    try {
      await apiRequest(`/api/gallery?${params}`, { method: 'POST', headers: { 'Content-Type': file.type }, body: file })
      setForm({ title: '', description: '', category: '', photoDate: '' })
      input.value = ''
      await loadPhotos()
    } catch (requestError) { setError(requestError.message) }
    finally { setUploading(false) }
  }

  const deletePhoto = async (photo) => {
    if (!window.confirm(`¿Eliminar la foto «${photo.title}» de la galería?`)) return
    try {
      await apiRequest(`/api/gallery/${photo.id}`, { method: 'DELETE' })
      setPhotos((current) => current.filter((item) => item.id !== photo.id))
      if (selectedPhoto?.photo.id === photo.id) setSelectedPhoto(null)
    } catch (requestError) { setError(requestError.message) }
  }

  return <div className="team-gallery-view">
    {error && <p className="login-error" role="alert">{error}</p>}
    {canManage && <article className="panel team-gallery-upload-panel">
      <div className="team-gallery-intro"><span className="gallery-eyebrow">MOMENTOS DEL EQUIPO</span><h2>Galería de imágenes</h2><p>Comparte fotos de entrenamientos, competencias y actividades del equipo.</p></div>
      <form className="team-gallery-form" onSubmit={uploadPhoto}>
        <label><span>Título</span><input name="title" maxLength="160" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ej. Regata de temporada" /></label>
        <label><span>Fecha</span><input name="photoDate" type="date" value={form.photoDate} onChange={(event) => setForm({ ...form, photoDate: event.target.value })} /></label>
        <label><span>Actividad o categoría</span><input name="category" maxLength="80" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Entrenamiento, competencia…" /></label>
        <label className="team-gallery-description"><span>Descripción</span><input name="description" maxLength="2000" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Añade un detalle si quieres" /></label>
        <label className={`team-gallery-file ${uploading ? 'disabled' : ''}`}><ImageIcon size={16} />{uploading ? 'Subiendo…' : 'Elegir imagen'}<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} /></label>
        <button className="primary-button" type="submit" disabled={uploading}>{uploading ? 'SUBIENDO…' : 'AGREGAR FOTO'}</button>
        <small className="team-gallery-limit">JPG, PNG o WebP · máximo 5 MB</small>
      </form>
    </article>}
    <article className="panel team-gallery-panel">
      <div className="panel-header"><div><p className="roster-kicker">ÁLBUM DEL CLUB</p><h2>Fotos del equipo</h2></div><span className="inventory-count">{photos.length} {photos.length === 1 ? 'foto' : 'fotos'}</span></div>
      {loading ? <p className="team-gallery-empty">Cargando galería…</p> : photos.length ? <div className="team-gallery-grid">{photos.map((photo) => <GalleryPhotoCard key={photo.id} photo={photo} canManage={canManage} onOpen={(item, url) => setSelectedPhoto({ photo: item, url })} onDelete={deletePhoto} />)}</div> : <div className="team-gallery-empty"><ImageIcon size={32} /><strong>Aún no hay fotos</strong><span>{canManage ? 'Sube la primera imagen para crear el álbum del equipo.' : 'Cuando se agreguen imágenes, aparecerán aquí.'}</span></div>}
    </article>
    {selectedPhoto && <div className="team-gallery-lightbox" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setSelectedPhoto(null) }}><section className="team-gallery-lightbox-content" role="dialog" aria-modal="true" aria-label={selectedPhoto.photo.title}><button className="team-gallery-lightbox-close" type="button" onClick={() => setSelectedPhoto(null)} aria-label="Cerrar foto"><X size={20} /></button><img src={selectedPhoto.url} alt={selectedPhoto.photo.title} /><div><h2>{selectedPhoto.photo.title}</h2>{selectedPhoto.photo.description && <p>{selectedPhoto.photo.description}</p>}{selectedPhoto.photo.photoDate && <time>{selectedPhoto.photo.photoDate}</time>}</div></section></div>}
  </div>
}

function raceCrewNames(race) {
  const lineups = race.Lineups || race.lineups || []
  return lineups.flatMap((lineup) => (lineup.seats || []).filter((seat) => seat.seatRole !== 'suplente').map((seat) => seat.Member ? `${seat.Member.firstName} ${seat.Member.lastName}`.trim() : null)).filter(Boolean)
}

function CompetitionsView() {
  const [selectedCategory, setSelectedCategory] = useState('Open 1')
  const [selectedMedal, setSelectedMedal] = useState('Todas')
  const [competitions, setCompetitions] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingRecognition, setEditingRecognition] = useState(null)
  const [recognitionForm, setRecognitionForm] = useState({ name: '', venue: '', scope: 'local', startDate: '', endDate: '', category: 'Open 1', distanceM: '', time: '', position: '', notes: '' })
  const [savingRecognition, setSavingRecognition] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(null)
  const [error, setError] = useState('')
  const [competition, setCompetition] = useState({ name: '', venue: '', date: '', endDate: '', scope: 'local', distanceM: '', timeSeconds: '', position: '', notes: '' })
  const loadCompetitions = async () => {
    const [competitionResult, raceResult] = await Promise.all([
      apiRequest('/api/competitions?limit=500'), apiRequest('/api/races?limit=500'),
    ])
    setCompetitions(competitionResult.data.map((item) => ({
      ...item,
      races: raceResult.data.filter((race) => Number(race.competitionId) === Number(item.id)),
    })))
  }
  useEffect(() => {
    loadCompetitions().catch((requestError) => setError(requestError.message))
  }, [])
  const allRaces = competitions.flatMap((event) => (event.races || []).map((race) => ({ ...race, eventId: event.id, eventName: event.name, venue: event.venue, date: event.startDate })))
  const categoryRaces = allRaces.filter((race) => race.category === selectedCategory)
  const medals = { gold: categoryRaces.filter((race) => Number(race.position) === 1).length, silver: categoryRaces.filter((race) => Number(race.position) === 2).length, bronze: categoryRaces.filter((race) => Number(race.position) === 3).length }
  const medalGallery = categoryRaces.filter((race) => Number(race.position) >= 1 && Number(race.position) <= 3)
    .filter((race) => selectedMedal === 'Todas' || Number(race.position) === ({ Oro: 1, Plata: 2, Bronce: 3 })[selectedMedal])
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  const addCompetition = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const parsedTime = competition.timeSeconds ? parseRaceTime(competition.timeSeconds) : null
    if (competition.timeSeconds && parsedTime === null) { setError('Escribe el tiempo como minutos:segundos, por ejemplo 1:23.450.'); setSaving(false); return }
    const resultStarted = Boolean(competition.distanceM || competition.timeSeconds || competition.position)
    if (resultStarted && (!Number(competition.distanceM) || !parsedTime || !Number(competition.position))) {
      setError('Para guardar un resultado, completa distancia, tiempo y puesto.'); setSaving(false); return
    }
    let savedCompetition = null
    try {
      savedCompetition = await apiRequest('/api/competitions', { method: 'POST', body: JSON.stringify({ name: competition.name.trim(), venue: competition.venue || null, startDate: competition.date || null, endDate: competition.endDate || null, scope: competition.scope, notes: competition.notes || null }) })
      if (resultStarted) await apiRequest('/api/races', { method: 'POST', body: JSON.stringify({ competitionId: savedCompetition.id, category: selectedCategory, distanceM: Number(competition.distanceM), timeSeconds: parsedTime, position: Number(competition.position), notes: competition.notes || null }) })
      await loadCompetitions()
      setCompetition({ name: '', venue: '', date: '', endDate: '', scope: 'local', distanceM: '', timeSeconds: '', position: '', notes: '' })
      setShowForm(false)
    } catch (requestError) {
      setError(savedCompetition ? `La competencia se guardó, pero falló el resultado: ${requestError.message}` : requestError.message)
      if (savedCompetition) await loadCompetitions().catch(() => {})
    }
    finally { setSaving(false) }
  }
  const deleteCompetition = async (item) => {
    if (!window.confirm(`¿Borrar ${item.name}, sus carreras y las alineaciones asociadas?`)) return
    try {
      await apiRequest(`/api/competitions/${item.id}`, { method: 'DELETE' })
      setCompetitions((current) => current.filter((entry) => entry.id !== item.id))
    } catch (requestError) { setError(requestError.message) }
  }
  const deleteRace = async (competitionId, race) => {
    if (!window.confirm(`¿Borrar el resultado de ${race.distanceM} m y sus alineaciones asociadas?`)) return
    try {
      await apiRequest(`/api/races/${race.id}`, { method: 'DELETE' })
      setCompetitions((current) => current.map((item) => item.id === competitionId ? { ...item, races: item.races.filter((entry) => entry.id !== race.id) } : item))
    } catch (requestError) { setError(requestError.message) }
  }
  const startEditingRecognition = (item, race = null) => {
    if (!item) return
    setEditingRecognition({ competitionId: item.id, raceId: race?.id || null })
    setRecognitionForm({ name: item.name || '', venue: item.venue || '', scope: item.scope || 'local', startDate: item.startDate || '', endDate: item.endDate || '', category: race?.category || selectedCategory, distanceM: race?.distanceM ?? '', time: race?.timeSeconds ? formatRaceTime(race.timeSeconds) : '', position: race?.position ?? '', notes: race?.notes || item.notes || '' })
    setError('')
  }
  const saveRecognition = async (event) => {
    event.preventDefault(); setSavingRecognition(true); setError('')
    const distanceM = recognitionForm.distanceM === '' ? null : Number(recognitionForm.distanceM)
    const timeSeconds = recognitionForm.time.trim() ? parseRaceTime(recognitionForm.time) : null
    const position = recognitionForm.position === '' ? null : Number(recognitionForm.position)
    const hasResult = Boolean(recognitionForm.distanceM || recognitionForm.time.trim() || recognitionForm.position)
    if (recognitionForm.startDate && recognitionForm.endDate && recognitionForm.endDate < recognitionForm.startDate) { setError('La fecha de fin debe ser igual o posterior a la fecha de inicio.'); setSavingRecognition(false); return }
    if (!recognitionForm.name.trim()) { setError('El reconocimiento debe tener un nombre.'); setSavingRecognition(false); return }
    if (distanceM !== null && (!Number.isFinite(distanceM) || distanceM <= 0)) { setError('La distancia debe ser mayor que cero.'); setSavingRecognition(false); return }
    if (recognitionForm.time.trim() && (!timeSeconds || timeSeconds <= 0)) { setError('Escribe el tiempo como minutos:segundos, por ejemplo 1:23.450.'); setSavingRecognition(false); return }
    if (position !== null && (!Number.isInteger(position) || position <= 0)) { setError('El puesto debe ser un entero mayor que cero.'); setSavingRecognition(false); return }
    if (!editingRecognition.raceId && hasResult && (!distanceM || !timeSeconds || !position)) { setError('Para agregar un resultado completa distancia, tiempo y puesto.'); setSavingRecognition(false); return }
    try {
      await apiRequest(`/api/competitions/${editingRecognition.competitionId}`, { method: 'PUT', body: JSON.stringify({ name: recognitionForm.name.trim(), venue: recognitionForm.venue || null, scope: recognitionForm.scope, startDate: recognitionForm.startDate || null, endDate: recognitionForm.endDate || null, notes: recognitionForm.notes || null }) })
      const resultPayload = { category: recognitionForm.category, distanceM, timeSeconds, position, notes: recognitionForm.notes || null }
      if (editingRecognition.raceId) await apiRequest(`/api/races/${editingRecognition.raceId}`, { method: 'PUT', body: JSON.stringify(resultPayload) })
      else if (hasResult) await apiRequest('/api/races', { method: 'POST', body: JSON.stringify({ ...resultPayload, competitionId: editingRecognition.competitionId }) })
      await loadCompetitions()
      setEditingRecognition(null)
    } catch (requestError) {
      setError(requestError.message)
      await loadCompetitions().catch(() => {})
    } finally { setSavingRecognition(false) }
  }
  const refreshCompetitions = loadCompetitions
  const uploadMedalPhoto = async (raceId, file) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('La foto debe estar en formato JPG, PNG o WebP.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('La foto debe pesar menos de 5 MB.'); return }
    setUploadingPhoto(raceId); setError('')
    try { await apiRequest(`/api/races/${raceId}/medal-photo`, { method: 'POST', headers: { 'Content-Type': file.type }, body: file }); await refreshCompetitions() }
    catch (requestError) { setError(requestError.message) }
    finally { setUploadingPhoto(null) }
  }
  const deleteMedalPhoto = async (race) => {
    if (!window.confirm('¿Quitar la foto de esta medalla?')) return
    setError('')
    try { await apiRequest(`/api/races/${race.id}/medal-photo`, { method: 'DELETE' }); await refreshCompetitions() }
    catch (requestError) { setError(requestError.message) }
  }
  return <div className="competitions-view">
    {error && <p className="login-error" role="alert">{error}</p>}
    <div className="category-tabs compact">{Object.keys(categoryRosters).map((category) => {
      const count = allRaces.filter((race) => race.category === category && Number(race.position) <= 3).length
      return <button key={category} className={selectedCategory === category ? 'category-tab active' : 'category-tab'} onClick={() => setSelectedCategory(category)}><span>{category}</span><strong>{count}</strong></button>
    })}</div>
    <div className="medals-layout">
      <article className="panel medal-panel"><div className="panel-header"><div><p className="roster-kicker">MEDALLERO · TEMPORADA</p><h2>{selectedCategory}</h2></div><Medal size={22} /></div>
        <div className="medals-grid">{['gold', 'silver', 'bronze'].map((type, index) => <div className={`medal-card ${type}`} key={type}><div className="medal-circle">{index + 1}</div><span>{type === 'gold' ? 'Oro' : type === 'silver' ? 'Plata' : 'Bronce'}</span><strong>{medals[type]}</strong></div>)}</div>
        <div className="medal-total"><span>Carreras registradas</span><strong>{categoryRaces.length}</strong></div>
      </article>
      <article className="panel competition-history"><div className="panel-header"><div><p className="roster-kicker">REGATAS Y RESULTADOS</p><h2>Historial de competencias</h2></div><button className="text-button" onClick={() => setShowForm(true)}><Plus size={15} /> REGISTRAR</button></div>
        <div className="competition-list">{competitions.length ? competitions.map((item) => <div className="competition-entry" key={item.id}>
          <div className="competition-row"><div className="competition-date"><CalendarDays size={17} /><strong>{item.startDate ? `${item.startDate}${item.endDate && item.endDate !== item.startDate ? ` – ${item.endDate}` : ''}` : 'Sin fecha'}</strong><button className="icon-edit-button" aria-label={`Editar reconocimiento ${item.name}`} title="Editar reconocimiento" onClick={() => startEditingRecognition(item, item.races?.[0])}><Pencil size={13} /></button></div><div className="competition-name"><strong>{item.name}</strong><span><MapPin size={12} /> {item.venue || 'Lugar por definir'}</span></div><span className="scope-badge">{item.scope}</span><div className="competition-medals"><Medal size={15} /><strong>{(item.races || []).filter((race) => Number(race.position) <= 3).length}</strong></div><button className="icon-danger-button" aria-label={`Borrar competencia ${item.name}`} title="Borrar competencia" onClick={() => deleteCompetition(item)}><Trash2 size={16} /></button></div>
          {(item.races || []).map((race) => <div className="race-result" key={race.id}><span>{race.category || 'Sin categoría'}</span><b>{race.distanceM ? `${race.distanceM} m` : '—'}</b><b>{race.timeSeconds ? formatRaceTime(race.timeSeconds) : '—'}</b><strong>{race.position ? `Puesto ${race.position}` : 'Sin puesto'}</strong><button className="icon-edit-button" aria-label="Editar reconocimiento completo" title="Editar reconocimiento completo" onClick={() => startEditingRecognition(item, race)}><Pencil size={14} /></button><button className="icon-danger-button" aria-label="Borrar resultado" title="Borrar resultado" onClick={() => deleteRace(item.id, race)}><Trash2 size={14} /></button></div>)}
        </div>) : <div className="empty-state"><Trophy size={30} /><p>Aun no hay competencias registradas.</p><button className="primary-button" onClick={() => setShowForm(true)}><Plus size={17} /> REGISTRAR COMPETENCIA</button></div>}</div>
      </article>
    </div>
    <article className="panel medal-gallery-panel">
      <div className="medal-gallery-heading"><div><p className="roster-kicker">LOGROS DEL EQUIPO</p><h2>Galería de medallas</h2><span>{medalGallery.length} {medalGallery.length === 1 ? 'medalla' : 'medallas'} · {selectedCategory}</span></div><div className="medal-gallery-filters" aria-label="Filtrar medallas">{['Todas', 'Oro', 'Plata', 'Bronce'].map((medalType) => <button key={medalType} className={selectedMedal === medalType ? 'active' : ''} onClick={() => setSelectedMedal(medalType)}>{medalType}</button>)}</div></div>
      {medalGallery.length ? <div className="medal-gallery-grid">{medalGallery.map((race) => {
        const medalType = Number(race.position) === 1 ? 'gold' : Number(race.position) === 2 ? 'silver' : 'bronze'
        const medalLabel = medalType === 'gold' ? 'Oro' : medalType === 'silver' ? 'Plata' : 'Bronce'
        const eventDate = race.date ? new Date(`${race.date}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Fecha pendiente'
        const eventItem = competitions.find((item) => Number(item.id) === Number(race.eventId))
        const crew = raceCrewNames(race)
        return <article className={`medal-gallery-card ${medalType}`} key={race.id}><MedalGalleryPhoto race={race} onUpload={uploadMedalPhoto} onDelete={deleteMedalPhoto} uploading={uploadingPhoto === race.id} /><div className="gallery-medal-copy"><span className={`gallery-medal-tag ${medalType}`}>{medalLabel}</span><h3>{race.eventName || 'Competencia'}</h3><p>{race.category || selectedCategory} · {race.distanceM ? `${race.distanceM} m` : 'Distancia pendiente'}</p><div><span>{eventDate}</span><strong>{formatRaceTime(race.timeSeconds)}</strong></div><small><MapPin size={12} /> {race.venue || 'Lugar por definir'}</small>{crew.length ? <small className="gallery-crew-list">Tripulación: {crew.join(', ')}</small> : <small className="gallery-crew-list">Sin alineación asociada</small>}<button className="gallery-edit-recognition" onClick={() => startEditingRecognition(eventItem, race)}><Pencil size={13} /> Editar reconocimiento</button></div></article>
      })}</div> : <div className="medal-gallery-empty"><div><Medal size={25} /></div><h3>{selectedMedal === 'Todas' ? 'Aquí aparecerán sus logros' : `Aún no hay medallas de ${selectedMedal.toLowerCase()}`}</h3><p>Registra el resultado de una competencia con puesto entre los tres primeros para agregar una medalla.</p><button className="text-button" onClick={() => setShowForm(true)}><Plus size={15} /> REGISTRAR RESULTADO</button></div>}
    </article>
    {showForm && <div className="athlete-form-overlay"><div className="athlete-form-panel"><div className="panel-header"><h2>Nueva competencia</h2><button className="close-button" onClick={() => setShowForm(false)}>×</button></div>
      <form className="athlete-form" onSubmit={addCompetition}>
        <label><span>Nombre</span><input required value={competition.name} onChange={(event) => setCompetition({ ...competition, name: event.target.value })} /></label>
        <label><span>Lugar</span><input value={competition.venue} onChange={(event) => setCompetition({ ...competition, venue: event.target.value })} /></label>
        <label><span>Fecha de inicio</span><input type="date" value={competition.date} onChange={(event) => setCompetition({ ...competition, date: event.target.value })} /></label>
        <label><span>Fecha de fin</span><input type="date" min={competition.date || undefined} value={competition.endDate} onChange={(event) => setCompetition({ ...competition, endDate: event.target.value })} /></label>
        <label><span>Alcance</span><select value={competition.scope} onChange={(event) => setCompetition({ ...competition, scope: event.target.value })}><option value="local">Local</option><option value="nacional">Nacional</option><option value="internacional">Internacional</option></select></label>
        <div className="race-fields-title">Resultado de una carrera (opcional)</div>
        <label><span>Categoria</span><select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>{Object.keys(categoryRosters).map((category) => <option key={category}>{category}</option>)}</select></label>
        <label><span>Distancia (m)</span><input type="number" min="1" value={competition.distanceM} onChange={(event) => setCompetition({ ...competition, distanceM: event.target.value })} placeholder="200" /></label>
        <label><span>Tiempo (min:seg)</span><input type="text" inputMode="text" value={competition.timeSeconds} onChange={(event) => setCompetition({ ...competition, timeSeconds: event.target.value })} placeholder="1:23.450" pattern="\d{1,3}:[0-5]\d(\.\d{1,3})?" title="Minutos:segundos, por ejemplo 1:23.450" /></label>
        <label><span>Puesto final</span><input type="number" min="1" value={competition.position} onChange={(event) => setCompetition({ ...competition, position: event.target.value })} placeholder="1" /></label>
        <label className="full-form-field"><span>Notas</span><textarea value={competition.notes} onChange={(event) => setCompetition({ ...competition, notes: event.target.value })} /></label>
        <div className="form-actions"><button type="button" className="outline-button" onClick={() => setShowForm(false)}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Guardando...' : 'Guardar competencia'}</button></div>
      </form>
    </div></div>}
    {editingRecognition && <div className="athlete-form-overlay"><div className="athlete-form-panel recognition-edit-panel"><div className="panel-header"><div><p className="roster-kicker">EDITAR LOGRO</p><h2>Reconocimiento completo</h2><span className="edit-date-event-name">Actualiza competencia, fechas y resultado de la medalla.</span></div><button className="close-button" onClick={() => setEditingRecognition(null)}>×</button></div>
      <form className="athlete-form" onSubmit={saveRecognition}>
        <label><span>Nombre de la competencia</span><input required value={recognitionForm.name} onChange={(event) => setRecognitionForm({ ...recognitionForm, name: event.target.value })} /></label>
        <label><span>Sede</span><input value={recognitionForm.venue} onChange={(event) => setRecognitionForm({ ...recognitionForm, venue: event.target.value })} /></label>
        <label><span>Fecha de inicio</span><input type="date" value={recognitionForm.startDate} onChange={(event) => setRecognitionForm({ ...recognitionForm, startDate: event.target.value })} /></label>
        <label><span>Fecha de fin</span><input type="date" min={recognitionForm.startDate || undefined} value={recognitionForm.endDate} onChange={(event) => setRecognitionForm({ ...recognitionForm, endDate: event.target.value })} /></label>
        <label><span>Alcance</span><select value={recognitionForm.scope} onChange={(event) => setRecognitionForm({ ...recognitionForm, scope: event.target.value })}><option value="local">Local</option><option value="nacional">Nacional</option><option value="internacional">Internacional</option></select></label>
        <div className="race-fields-title">Resultado y medalla {editingRecognition.raceId ? '' : '(opcional)'}</div>
        <label><span>Categoría</span><select value={recognitionForm.category} onChange={(event) => setRecognitionForm({ ...recognitionForm, category: event.target.value })}>{Object.keys(categoryRosters).map((category) => <option key={category}>{category}</option>)}</select></label>
        <label><span>Puesto final</span><input type="number" min="1" value={recognitionForm.position} onChange={(event) => setRecognitionForm({ ...recognitionForm, position: event.target.value })} placeholder="Sin puesto" /></label>
        <label><span>Distancia (m)</span><input type="number" min="1" value={recognitionForm.distanceM} onChange={(event) => setRecognitionForm({ ...recognitionForm, distanceM: event.target.value })} placeholder="Sin distancia" /></label>
        <label><span>Tiempo (min:seg)</span><input type="text" value={recognitionForm.time} onChange={(event) => setRecognitionForm({ ...recognitionForm, time: event.target.value })} placeholder="1:23.450" /></label>
        <label className="full-form-field"><span>Notas</span><textarea value={recognitionForm.notes} onChange={(event) => setRecognitionForm({ ...recognitionForm, notes: event.target.value })} /></label>
        <div className="form-actions"><button type="button" className="outline-button" onClick={() => setEditingRecognition(null)}>Cancelar</button><button type="submit" className="primary-button" disabled={savingRecognition}>{savingRecognition ? 'Guardando…' : 'Guardar reconocimiento'}</button></div>
      </form>
    </div></div>}
  </div>
}
function InventoryView() {
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [items, setItems] = useStoredState('sky-dragons-inventory', inventoryItems)
  const [showForm, setShowForm] = useState(false)
  const [item, setItem] = useState({ name: '', category: 'Botes', code: '', total: 0, available: 0, assigned: '', state: 'Disponible', color: '#75a7ff' })
  const categories = ['Todos', 'Botes', 'Remo', 'Seguridad', 'Batería', 'Navegación']
  const visibleItems = selectedCategory === 'Todos' ? items : items.filter((entry) => entry.category === selectedCategory)
  const totalUnits = items.reduce((sum, entry) => sum + Number(entry.total || 0), 0)
  const availableUnits = items.reduce((sum, entry) => sum + Number(entry.available || 0), 0)

  const addItem = (event) => {
    event.preventDefault()
    if (!item.name.trim()) return
    setItems((current) => [...current, {
      ...item,
      name: item.name.trim(),
      code: item.code.trim() || `IMP-${String(current.length + 1).padStart(3, '0')}`,
      total: Number(item.total),
      available: Number(item.available),
    }])
    setItem({ name: '', category: 'Botes', code: '', total: 0, available: 0, assigned: '', state: 'Disponible', color: '#75a7ff' })
    setShowForm(false)
  }
  const deleteItem = (entry) => {
    if (!window.confirm(`¿Quitar ${entry.name} del inventario?`)) return
    setItems((current) => current.filter((item) => item.code !== entry.code))
  }

  return (
    <div className="inventory-view">
      <div className="inventory-summary">
        <article><div className="stat-icon blue"><Package size={21} /></div><div><span>Implementos registrados</span><strong>{items.length}</strong></div></article>
        <article><div className="stat-icon aqua"><Dumbbell size={21} /></div><div><span>Unidades totales</span><strong>{totalUnits}</strong></div></article>
        <article><div className="stat-icon green"><Anchor size={21} /></div><div><span>Unidades disponibles</span><strong>{availableUnits}</strong></div></article>
      </div>

      <div className="inventory-toolbar">
        <div className="inventory-tabs">
          {categories.map((category) => (
            <button key={category} className={selectedCategory === category ? 'inventory-tab active' : 'inventory-tab'} onClick={() => setSelectedCategory(category)}>{category}</button>
          ))}
        </div>
        <button className="primary-button" onClick={() => setShowForm(true)}><Plus size={17} /> AGREGAR IMPLEMENTO</button>
      </div>

      <article className="panel inventory-panel">
        <div className="panel-header"><div><p className="roster-kicker">INVENTARIO DE EQUIPO</p><h2>{selectedCategory === 'Todos' ? 'Todos los implementos' : selectedCategory}</h2></div><span className="inventory-count">{visibleItems.length} registros</span></div>

        <div className="inventory-grid">
          {visibleItems.length ? visibleItems.map((entry) => (
            <article className="inventory-card" key={entry.code}>
              <div className="inventory-card-head">
                <div className="inventory-icon" style={{ background: `${entry.color}22`, color: entry.color }}>
                  {entry.category === 'Botes' ? <Anchor size={22} /> : entry.category === 'Remo' ? <Dumbbell size={22} /> : entry.category === 'Seguridad' ? <LifeBuoy size={22} /> : <Package size={22} />}
                </div>
                <button className="icon-danger-button" aria-label={`Borrar ${entry.name}`} title="Borrar implemento" onClick={() => deleteItem(entry)}><Trash2 size={16} /></button>
              </div>
              <span className="inventory-code">{entry.code}</span>
              <h3>{entry.name}</h3>
              <p>{entry.assigned || 'Sin asignación'}</p>
              <div className="inventory-stock"><div><span>Total</span><strong>{entry.total}</strong></div><div><span>Disponibles</span><strong>{entry.available}</strong></div><div><span>En uso</span><strong>{Math.max(entry.total - entry.available, 0)}</strong></div></div>
              <div className="inventory-status"><i className={entry.state === 'Disponible' ? '' : 'warning'} /> {entry.state}</div>
            </article>
          )) : <div className="empty-state"><Package size={30} /><p>No hay implementos registrados.</p><button className="primary-button" onClick={() => setShowForm(true)}><Plus size={17} /> AGREGAR IMPLEMENTO</button></div>}
        </div>
      </article>

      {showForm && (
        <div className="athlete-form-overlay"><div className="athlete-form-panel">
          <div className="panel-header"><h2>Agregar implemento</h2><button className="close-button" onClick={() => setShowForm(false)}>×</button></div>
          <form className="athlete-form" onSubmit={addItem}>
            <label><span>Nombre</span><input required value={item.name} onChange={(event) => setItem({ ...item, name: event.target.value })} /></label>
            <label><span>Código</span><input value={item.code} onChange={(event) => setItem({ ...item, code: event.target.value })} /></label>
            <label><span>Categoría</span><select value={item.category} onChange={(event) => setItem({ ...item, category: event.target.value })}>{categories.slice(1).map((category) => <option key={category}>{category}</option>)}</select></label>
            <label><span>Estado</span><select value={item.state} onChange={(event) => setItem({ ...item, state: event.target.value })}><option>Disponible</option><option>En uso</option><option>Reservado</option><option>Mantenimiento</option></select></label>
            <label><span>Cantidad total</span><input type="number" min="0" value={item.total} onChange={(event) => setItem({ ...item, total: event.target.value })} /></label>
            <label><span>Cantidad disponible</span><input type="number" min="0" value={item.available} onChange={(event) => setItem({ ...item, available: event.target.value })} /></label>
            <label className="full-form-field"><span>Asignado a</span><input value={item.assigned} onChange={(event) => setItem({ ...item, assigned: event.target.value })} /></label>
            <div className="form-actions"><button type="button" className="outline-button" onClick={() => setShowForm(false)}>Cancelar</button><button type="submit" className="primary-button">Guardar implemento</button></div>
          </form>
        </div></div>
      )}
      <article className="panel erg-panel">
        <div className="panel-header"><div><p className="roster-kicker">ERGÓMETRO · PROGRESO INDIVIDUAL</p><h2>Marcas por integrante</h2><p>Registra pruebas y compara cada distancia con la marca anterior.</p></div></div>
        <div className="ergdata-connect"><div><strong>{ergConnection?.connected ? `Concept2 conectado${ergConnection.username ? ` · ${ergConnection.username}` : ''}` : 'Concept2 Logbook / ErgData'}</strong><span>{ergConnection?.lastSyncedAt ? `Última sincronización: ${new Date(ergConnection.lastSyncedAt).toLocaleString('es')}` : 'Autoriza el Logbook del atleta para importar sus sesiones de remo.'}</span></div>{['admin', 'capitan'].includes(currentUser?.role) && <div className="ergdata-actions"><button className="outline-button" disabled={!ergForm.memberId} onClick={connectErgData}>{ergConnection?.connected ? 'VINCULAR OTRA CUENTA' : 'CONECTAR CONCEPT2'}</button><button className="primary-button" disabled={!ergForm.memberId || !ergConnection?.connected || ergSyncing} onClick={syncErgData}>{ergSyncing ? 'IMPORTANDO…' : 'SINCRONIZAR'}</button></div>}</div>{ergFeedback && <p className="ergdata-feedback" role="status">{ergFeedback}</p>}
        {ergError && <p className="login-error" role="alert">{ergError}</p>}
        <form className="training-form erg-form" onSubmit={saveErgScore}>
          <label><span>Integrante</span><select required value={ergForm.memberId} onChange={(e) => setErgForm({ ...ergForm, memberId: e.target.value })}><option value="">Seleccionar</option>{ergMembers.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}</select></label>
          <label><span>Fecha</span><input required type="date" value={ergForm.date} onChange={(e) => setErgForm({ ...ergForm, date: e.target.value })} /></label>
          <label><span>Distancia (m)</span><input required type="number" min="1" value={ergForm.distanceM} onChange={(e) => setErgForm({ ...ergForm, distanceM: e.target.value })} /></label>
          <label><span>Tiempo · minutos</span><input required type="number" min="0" value={ergForm.minutes} onChange={(e) => setErgForm({ ...ergForm, minutes: e.target.value })} /></label>
          <label><span>Segundos</span><input required type="number" min="0" max="59" value={ergForm.seconds} onChange={(e) => setErgForm({ ...ergForm, seconds: e.target.value })} /></label>
          <label><span>Potencia media (W)</span><input type="number" min="0" step="0.1" value={ergForm.averageWatts} onChange={(e) => setErgForm({ ...ergForm, averageWatts: e.target.value })} /></label>
          <label><span>Peso corporal (kg)</span><input type="number" min="1" step="0.1" value={ergForm.bodyWeightKg} onChange={(e) => setErgForm({ ...ergForm, bodyWeightKg: e.target.value })} /></label>
          <label><span>Aporte medido (%) · opcional</span><input type="number" min="0" max="100" step="0.1" value={ergForm.contributionPercent} onChange={(e) => setErgForm({ ...ergForm, contributionPercent: e.target.value })} /></label>
          <label className="full-field"><span>Notas</span><input value={ergForm.notes} onChange={(e) => setErgForm({ ...ergForm, notes: e.target.value })} placeholder="Protocolo, resistencia, sensaciones..." /></label>
          <button className="primary-button" type="submit"><Plus size={16} /> GUARDAR MARCA</button>
        </form>
        <div className="erg-history-heading"><h3>Historial y evolución</h3><select aria-label="Filtrar por integrante" value={ergFilter} onChange={(e) => setErgFilter(e.target.value)}><option value="">Todos los integrantes</option>{ergMembers.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}</select></div>
        {ergFilter && (() => { const series = ergScores.filter((r) => String(r.memberId) === ergFilter).sort((a, b) => a.date.localeCompare(b.date)); if (series.length < 2) return <p className="athlete-history-empty">Registra al menos dos marcas para ver el gráfico de progreso.</p>; const min = Math.min(...series.map((r) => Number(r.durationSeconds))); const max = Math.max(...series.map((r) => Number(r.durationSeconds))); const range = Math.max(1, max - min); const points = series.map((r, i) => `${series.length === 1 ? 50 : 10 + (i * 80) / (series.length - 1)},${90 - ((Number(r.durationSeconds) - min) / range) * 70}`).join(' '); return <div className="erg-chart"><p>Tiempo por prueba · menor es mejor</p><svg viewBox="0 0 100 100" role="img" aria-label="Gráfico de progreso ergómetro"><polyline points={points} fill="none" stroke="#087f7b" strokeWidth="2" />{series.map((r, i) => <circle key={r.id} cx={series.length === 1 ? 50 : 10 + (i * 80) / (series.length - 1)} cy={90 - ((Number(r.durationSeconds) - min) / range) * 70} r="2.5" fill="#ff7048" />)}</svg><div className="erg-chart-labels"><span>{series[0].date}</span><span>{series[series.length - 1].date}</span></div></div> })()}
        <div className="fleet-record-list">{ergScores.filter((row) => !ergFilter || String(row.memberId) === ergFilter).map((row) => { const previous = ergScores.filter((item) => Number(item.memberId) === Number(row.memberId) && item.distanceM === row.distanceM && item.date < row.date).sort((a, b) => b.date.localeCompare(a.date))[0]; const improvement = previous ? (Number(previous.durationSeconds) - Number(row.durationSeconds)) / Number(previous.durationSeconds) * 100 : null; return <div className="fleet-record-row" key={row.id}><div><strong>{row.Member?.firstName} {row.Member?.lastName} · {row.distanceM} m</strong><span>{row.date} · {formatErgDuration(row.durationSeconds)} · {row.averageWatts ? `${row.averageWatts} W` : 'Vatios sin registrar'}{row.source === 'concept2' ? ' · Concept2' : ''}</span></div><span className="fleet-badge realizada">{previous ? `${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}% ${improvement > 0 ? 'más rápido' : improvement < 0 ? 'más lento' : 'igual'}` : 'Marca inicial'}</span>{row.contributionPercent != null && <span>{row.contributionPercent}% aporte</span>}{['admin', 'capitan'].includes(currentUser?.role) && <button className="icon-danger-button" aria-label="Borrar marca" onClick={() => deleteErgScore(row)}><Trash2 size={14} /></button>}</div> })}{!ergScores.length && <div className="empty-state"><Timer size={24} /><p>Aún no hay marcas registradas.</p></div>}</div>
      </article>
    </div>
  )
}

function FleetView() {
  const today = new Date()
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const [assets, setAssets] = useState([])
  const [bookings, setBookings] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [members, setMembers] = useState([])
  const [modal, setModal] = useState('')
  const [message, setMessage] = useState('')
  const [assetForm, setAssetForm] = useState({ name: '', code: '', type: 'bote', status: 'disponible', notes: '' })
  const [bookingForm, setBookingForm] = useState({ assetId: '', memberId: '', date: todayString, startTime: '06:00', endTime: '08:00', purpose: '', notes: '' })
  const [maintenanceForm, setMaintenanceForm] = useState({ assetId: '', description: '', reportedAt: todayString, nextDue: '', status: 'pendiente', notes: '' })

  const load = async () => {
    try {
      const [assetResult, bookingResult, maintenanceResult, memberResult] = await Promise.all([
        apiRequest('/api/fleet-assets?limit=500'), apiRequest('/api/fleet-bookings'), apiRequest('/api/fleet-maintenance?limit=500'), apiRequest('/api/members?status=activo&limit=500'),
      ])
      setAssets(assetResult.data); setBookings(bookingResult); setMaintenance(maintenanceResult.data); setMembers(memberResult.data); setMessage('')
      if (!bookingForm.assetId && assetResult.data[0]) setBookingForm((current) => ({ ...current, assetId: String(assetResult.data[0].id) }))
      if (!maintenanceForm.assetId && assetResult.data[0]) setMaintenanceForm((current) => ({ ...current, assetId: String(assetResult.data[0].id) }))
    } catch (error) { setMessage(error.message) }
  }
  useEffect(() => { load() }, [])

  const addAsset = async (event) => {
    event.preventDefault(); setMessage('')
    try { await apiRequest('/api/fleet-assets', { method: 'POST', body: JSON.stringify(assetForm) }); setAssetForm({ name: '', code: '', type: 'bote', status: 'disponible', notes: '' }); setModal(''); await load() }
    catch (error) { setMessage(error.message) }
  }
  const addBooking = async (event) => {
    event.preventDefault(); setMessage('')
    try { await apiRequest('/api/fleet-bookings', { method: 'POST', body: JSON.stringify({ ...bookingForm, memberId: bookingForm.memberId || null }) }); setModal(''); setBookingForm((current) => ({ ...current, purpose: '', notes: '' })); await load() }
    catch (error) { setMessage(error.message) }
  }
  const addMaintenance = async (event) => {
    event.preventDefault(); setMessage('')
    try {
      await apiRequest('/api/fleet-maintenance', { method: 'POST', body: JSON.stringify({ ...maintenanceForm, nextDue: maintenanceForm.nextDue || null }) })
      const asset = assets.find((entry) => String(entry.id) === String(maintenanceForm.assetId))
      if (maintenanceForm.status !== 'completado' && asset) await apiRequest(`/api/fleet-assets/${asset.id}`, { method: 'PUT', body: JSON.stringify({ status: 'mantenimiento' }) })
      setModal(''); setMaintenanceForm((current) => ({ ...current, description: '', notes: '' })); await load()
    } catch (error) { setMessage(error.message) }
  }
  const updateAssetStatus = async (asset, status) => {
    try { await apiRequest(`/api/fleet-assets/${asset.id}`, { method: 'PUT', body: JSON.stringify({ status }) }); await load() }
    catch (error) { setMessage(error.message) }
  }
  const updateBooking = async (booking, status) => {
    try { await apiRequest(`/api/fleet-bookings/${booking.id}`, { method: 'PUT', body: JSON.stringify({ status }) }); await load() }
    catch (error) { setMessage(error.message) }
  }
  const updateMaintenanceStatus = async (entry, status) => {
    try {
      await apiRequest(`/api/fleet-maintenance/${entry.id}`, { method: 'PUT', body: JSON.stringify({ status }) })
      const stillOpen = maintenance.some((item) => item.id !== entry.id && item.assetId === entry.assetId && item.status !== 'completado')
      const asset = assets.find((item) => item.id === entry.assetId)
      if (asset && status !== 'completado' && asset.status === 'disponible') await apiRequest(`/api/fleet-assets/${asset.id}`, { method: 'PUT', body: JSON.stringify({ status: 'mantenimiento' }) })
      if (asset && status === 'completado' && !stillOpen && asset.status === 'mantenimiento') await apiRequest(`/api/fleet-assets/${asset.id}`, { method: 'PUT', body: JSON.stringify({ status: 'disponible' }) })
      await load()
    } catch (error) { setMessage(error.message) }
  }
  const removeBooking = async (booking) => {
    if (!window.confirm(`¿Borrar la reserva de ${booking.purpose}?`)) return
    try { await apiRequest(`/api/fleet-bookings/${booking.id}`, { method: 'DELETE' }); await load() }
    catch (error) { setMessage(error.message) }
  }
  const activeMaintenance = maintenance.filter((item) => item.status !== 'completado')
  const upcomingBookings = bookings.filter((item) => item.status !== 'cancelada' && item.date >= todayString)

  return <div className="fleet-view">
    {message && <p className="login-error" role="alert">{message}</p>}
    <div className="fleet-summary">
      <article><div className="stat-icon blue"><Anchor size={21} /></div><div><span>Recursos de flota</span><strong>{assets.length}</strong></div></article>
      <article><div className="stat-icon aqua"><CalendarClock size={21} /></div><div><span>Reservas próximas</span><strong>{upcomingBookings.length}</strong></div></article>
      <article><div className="stat-icon coral"><Wrench size={21} /></div><div><span>Revisiones abiertas</span><strong>{activeMaintenance.length}</strong></div></article>
    </div>
    <div className="fleet-toolbar"><div><p className="roster-kicker">OPERACIÓN DE FLOTA</p><h2>Embarcaciones, uso y mantenimiento</h2></div><div><button className="outline-button" onClick={() => setModal('asset')}><Plus size={15} /> RECURSO</button><button className="outline-button" onClick={() => setModal('maintenance')}><Wrench size={15} /> MANTENIMIENTO</button><button className="primary-button" onClick={() => { if (!assets.length) { setMessage('Primero registra una embarcación o ergómetro.'); return } setModal('booking') }}><CalendarClock size={16} /> RESERVAR</button></div></div>
    <article className="panel fleet-assets-panel"><div className="panel-header"><div><h2>Flota disponible</h2><p>Estado actual y disponibilidad de cada recurso</p></div><span className="inventory-count">{assets.length} recursos</span></div>
      {assets.length ? <div className="fleet-asset-list">{assets.map((asset) => <div className="fleet-asset-row" key={asset.id}><div className="fleet-asset-icon"><Anchor size={20} /></div><div className="fleet-asset-name"><strong>{asset.name}</strong><span>{asset.code} · {asset.type === 'ergometro' ? 'Ergómetro' : asset.type === 'bote' ? 'Embarcación' : 'Otro recurso'}</span></div><label className="fleet-status-control"><span>Estado</span><select value={asset.status} onChange={(event) => updateAssetStatus(asset, event.target.value)}><option value="disponible">Disponible</option><option value="mantenimiento">Mantenimiento</option><option value="fuera_servicio">Fuera de servicio</option></select></label></div>)}</div> : <div className="empty-state"><Anchor size={28} /><p>Registra los botes y ergómetros para reservarlos y llevar su bitácora.</p><button className="primary-button" onClick={() => setModal('asset')}><Plus size={16} /> AGREGAR RECURSO</button></div>}
    </article>
    <div className="fleet-lower-grid">
      <article className="panel fleet-bookings-panel"><div className="panel-header"><div><h2>Bitácora de uso y reservas</h2><p>Evita cruces y conserva el historial de cada recurso.</p></div></div>
        {bookings.length ? <div className="fleet-record-list">{[...bookings].reverse().map((booking) => <div className="fleet-record-row" key={booking.id}><div><strong>{booking.purpose}</strong><span>{booking.FleetAsset?.name || 'Recurso'}{booking.Member ? ` · ${booking.Member.firstName} ${booking.Member.lastName}` : ''}</span></div><div className="fleet-record-date"><strong>{new Date(`${booking.date}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short' })}</strong><span>{booking.startTime}–{booking.endTime}</span></div><span className={`fleet-badge ${booking.status}`}>{booking.status === 'realizada' ? 'Realizada' : booking.status === 'cancelada' ? 'Cancelada' : 'Reservada'}</span><div className="fleet-record-actions">{booking.status === 'reservada' && <button className="text-button" onClick={() => updateBooking(booking, 'realizada')}>REGISTRAR USO</button>}{booking.status === 'reservada' && <button className="icon-danger-button" aria-label="Cancelar reserva" onClick={() => updateBooking(booking, 'cancelada')}><Trash2 size={14} /></button>}{booking.status !== 'reservada' && <button className="icon-danger-button" aria-label="Borrar reserva" onClick={() => removeBooking(booking)}><Trash2 size={14} /></button>}</div></div>)}</div> : <div className="empty-state"><CalendarClock size={26} /><p>Aún no hay usos ni reservas programadas.</p></div>}
      </article>
      <article className="panel fleet-maintenance-panel"><div className="panel-header"><div><h2>Mantenimiento</h2><p>Reparaciones y próximas revisiones</p></div><button className="icon-button" aria-label="Agregar mantenimiento" onClick={() => assets.length ? setModal('maintenance') : setMessage('Primero registra un recurso.')}><Plus size={17} /></button></div>
        {maintenance.length ? <div className="fleet-record-list">{[...maintenance].reverse().map((entry) => <div className="fleet-maintenance-row" key={entry.id}><Wrench size={17} /><div><strong>{entry.description}</strong><span>{entry.FleetAsset?.name || 'Recurso'} · {entry.nextDue ? `Próxima revisión ${entry.nextDue}` : `Reportado ${entry.reportedAt}`}</span></div><select aria-label={`Estado del mantenimiento: ${entry.description}`} className={`fleet-maintenance-select ${entry.status}`} value={entry.status} onChange={(event) => updateMaintenanceStatus(entry, event.target.value)}><option value="pendiente">Pendiente</option><option value="en_proceso">En proceso</option><option value="completado">Completado</option></select></div>)}</div> : <div className="empty-state"><Wrench size={26} /><p>No hay mantenimientos registrados.</p></div>}
      </article>
    </div>
    {modal && <div className="athlete-form-overlay"><div className="athlete-form-panel"><div className="panel-header"><h2>{modal === 'asset' ? 'Registrar recurso de flota' : modal === 'booking' ? 'Reservar recurso' : 'Registrar mantenimiento'}</h2><button className="close-button" onClick={() => { setModal(''); setMessage('') }}>×</button></div>
      {modal === 'asset' ? <form className="athlete-form" onSubmit={addAsset}><label><span>Nombre</span><input required value={assetForm.name} onChange={(event) => setAssetForm({ ...assetForm, name: event.target.value })} placeholder="Ej. Bote Dragón 01" /></label><label><span>Código</span><input required value={assetForm.code} onChange={(event) => setAssetForm({ ...assetForm, code: event.target.value })} placeholder="Ej. BD-01" /></label><label><span>Tipo</span><select value={assetForm.type} onChange={(event) => setAssetForm({ ...assetForm, type: event.target.value })}><option value="bote">Embarcación</option><option value="ergometro">Ergómetro</option><option value="otro">Otro</option></select></label><label><span>Estado</span><select value={assetForm.status} onChange={(event) => setAssetForm({ ...assetForm, status: event.target.value })}><option value="disponible">Disponible</option><option value="mantenimiento">Mantenimiento</option><option value="fuera_servicio">Fuera de servicio</option></select></label><label className="full-form-field"><span>Notas</span><input value={assetForm.notes} onChange={(event) => setAssetForm({ ...assetForm, notes: event.target.value })} /></label><div className="form-actions"><button type="button" className="outline-button" onClick={() => setModal('')}>Cancelar</button><button className="primary-button">Guardar recurso</button></div></form>
      : modal === 'booking' ? <form className="athlete-form" onSubmit={addBooking}><label><span>Recurso</span><select required value={bookingForm.assetId} onChange={(event) => setBookingForm({ ...bookingForm, assetId: event.target.value })}>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.code}</option>)}</select></label><label><span>Responsable (opcional)</span><select value={bookingForm.memberId} onChange={(event) => setBookingForm({ ...bookingForm, memberId: event.target.value })}><option value="">Sin asignar</option>{members.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}</select></label><label><span>Fecha</span><input type="date" required value={bookingForm.date} onChange={(event) => setBookingForm({ ...bookingForm, date: event.target.value })} /></label><label><span>Propósito</span><input required value={bookingForm.purpose} onChange={(event) => setBookingForm({ ...bookingForm, purpose: event.target.value })} placeholder="Entrenamiento, regata..." /></label><label><span>Hora de inicio</span><input type="time" required value={bookingForm.startTime} onChange={(event) => setBookingForm({ ...bookingForm, startTime: event.target.value })} /></label><label><span>Hora de fin</span><input type="time" required value={bookingForm.endTime} onChange={(event) => setBookingForm({ ...bookingForm, endTime: event.target.value })} /></label><label className="full-form-field"><span>Notas de la bitácora</span><input value={bookingForm.notes} onChange={(event) => setBookingForm({ ...bookingForm, notes: event.target.value })} placeholder="Condición del bote, observaciones..." /></label><div className="form-actions"><button type="button" className="outline-button" onClick={() => setModal('')}>Cancelar</button><button className="primary-button">Confirmar reserva</button></div></form>
      : <form className="athlete-form" onSubmit={addMaintenance}><label><span>Recurso</span><select required value={maintenanceForm.assetId} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, assetId: event.target.value })}>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.code}</option>)}</select></label><label><span>Estado</span><select value={maintenanceForm.status} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, status: event.target.value })}><option value="pendiente">Pendiente</option><option value="en_proceso">En proceso</option><option value="completado">Completado</option></select></label><label className="full-form-field"><span>Revisión o reparación</span><input required value={maintenanceForm.description} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, description: event.target.value })} placeholder="Ej. Revisar casco y sistema de timón" /></label><label><span>Fecha reportada</span><input type="date" required value={maintenanceForm.reportedAt} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, reportedAt: event.target.value })} /></label><label><span>Próxima revisión</span><input type="date" value={maintenanceForm.nextDue} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, nextDue: event.target.value })} /></label><label className="full-form-field"><span>Notas</span><input value={maintenanceForm.notes} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, notes: event.target.value })} /></label><div className="form-actions"><button type="button" className="outline-button" onClick={() => setModal('')}>Cancelar</button><button className="primary-button">Guardar mantenimiento</button></div></form>}
    </div></div>}
  </div>
}

function FinanceView() {
  const [transactions, setTransactions] = useStoredState('sky-dragons-finance', [])
  const [showForm, setShowForm] = useState(false)
  const [transaction, setTransaction] = useState({ type: 'Ingreso', category: 'Cuota mensual', description: '', amount: '', date: '', method: 'Efectivo' })

  const addTransaction = (event) => {
    event.preventDefault()
    if (!transaction.amount || Number(transaction.amount) <= 0) return
    setTransactions((current) => [...current, { ...transaction, id: Date.now(), amount: Number(transaction.amount) }])
    setTransaction({ type: 'Ingreso', category: 'Cuota mensual', description: '', amount: '', date: '', method: 'Efectivo' })
    setShowForm(false)
  }
  const deleteTransaction = (entry) => {
    if (!window.confirm(`¿Borrar el movimiento “${entry.description || entry.category}” por $${Number(entry.amount).toFixed(2)}?`)) return
    setTransactions((current) => current.filter((item) => item.id !== entry.id))
  }

  const income = transactions.filter((entry) => entry.type === 'Ingreso').reduce((sum, entry) => sum + entry.amount, 0)
  const expenses = transactions.filter((entry) => entry.type === 'Gasto').reduce((sum, entry) => sum + entry.amount, 0)
  const balance = income - expenses

  return (
    <div className="finance-view">
      <div className="finance-summary">
        <article><div className="stat-icon aqua"><ArrowUpRight size={21} /></div><div><span>Total ingresos</span><strong>${income.toFixed(2)}</strong></div></article>
        <article><div className="stat-icon coral"><ArrowDownRight size={21} /></div><div><span>Total gastos</span><strong>${expenses.toFixed(2)}</strong></div></article>
        <article className="balance-card"><div className="stat-icon green"><DollarSign size={21} /></div><div><span>Balance disponible</span><strong>${balance.toFixed(2)}</strong></div></article>
      </div>

      <div className="finance-toolbar">
        <div><p className="roster-kicker">MOVIMIENTO FINANCIERO</p><h2>Pagos y gastos</h2></div>
        <button className="primary-button" onClick={() => setShowForm(true)}><Plus size={17} /> NUEVO MOVIMIENTO</button>
      </div>

      <article className="panel finance-panel">
        <div className="finance-table-head"><span>Concepto</span><span>Tipo</span><span>Método</span><span>Fecha</span><span>Monto</span></div>
        {transactions.length ? transactions.map((entry) => (
          <div className="finance-row" key={entry.id}>
            <div className="finance-concept"><div className={entry.type === 'Ingreso' ? 'finance-icon income' : 'finance-icon expense'}>{entry.type === 'Ingreso' ? <CreditCard size={17} /> : <ReceiptText size={17} />}</div><div><strong>{entry.description || entry.category}</strong><span>{entry.category}</span></div></div>
            <span className={entry.type === 'Ingreso' ? 'finance-kind income' : 'finance-kind expense'}>{entry.type}</span>
            <span>{entry.method}</span>
            <span>{entry.date || 'Sin fecha'}</span>
            <strong className={entry.type === 'Ingreso' ? 'amount income' : 'amount expense'}>{entry.type === 'Ingreso' ? '+' : '-'}${entry.amount.toFixed(2)}</strong>
            <button className="icon-danger-button" aria-label="Borrar movimiento financiero" title="Borrar movimiento" onClick={() => deleteTransaction(entry)}><Trash2 size={15} /></button>
          </div>
        )) : <div className="empty-state"><DollarSign size={30} /><p>No hay movimientos registrados.</p><button className="primary-button" onClick={() => setShowForm(true)}><Plus size={17} /> NUEVO MOVIMIENTO</button></div>}
      </article>

      <FeeControlPanel />

      {showForm && (
        <div className="athlete-form-overlay"><div className="athlete-form-panel">
          <div className="panel-header"><h2>Nuevo movimiento</h2><button className="close-button" onClick={() => setShowForm(false)}>×</button></div>
          <form className="athlete-form" onSubmit={addTransaction}>
            <label><span>Tipo</span><select value={transaction.type} onChange={(event) => setTransaction({ ...transaction, type: event.target.value })}><option>Ingreso</option><option>Gasto</option></select></label>
            <label><span>Categoría</span><select value={transaction.category} onChange={(event) => setTransaction({ ...transaction, category: event.target.value })}><option>Cuota mensual</option><option>Inscripción</option><option>Patrocinio</option><option>Equipamiento</option><option>Viaje</option><option>Alimentos</option><option>Otro</option></select></label>
            <label><span>Concepto</span><input value={transaction.description} onChange={(event) => setTransaction({ ...transaction, description: event.target.value })} placeholder="Ej. Pago de noviembre" /></label>
            <label><span>Monto</span><input type="number" min="0.01" step="0.01" required value={transaction.amount} onChange={(event) => setTransaction({ ...transaction, amount: event.target.value })} /></label>
            <label><span>Fecha</span><input type="date" value={transaction.date} onChange={(event) => setTransaction({ ...transaction, date: event.target.value })} /></label>
            <label><span>Método</span><select value={transaction.method} onChange={(event) => setTransaction({ ...transaction, method: event.target.value })}><option>Efectivo</option><option>Yappy</option><option>Transferencia</option><option>Tarjeta</option></select></label>
            <div className="form-actions"><button type="button" className="outline-button" onClick={() => setShowForm(false)}>Cancelar</button><button type="submit" className="primary-button">Guardar movimiento</button></div>
          </form>
        </div></div>
      )}
    </div>
  )
}

function FeeControlPanel() {
  const [members, setMembers] = useState([])
  const [plans, setPlans] = useState([])
  const [payments, setPayments] = useState([])
  const [form, setForm] = useState({ memberId: '', feePlanId: '', receiptUrl: '' })
  const [planForm, setPlanForm] = useState({ name: '', amount: '', dueDate: '' })
  const [error, setError] = useState('')
  const load = () => Promise.all([apiRequest('/api/members?limit=500'), apiRequest('/api/fee-plans?limit=500'), apiRequest('/api/payments?limit=500')]).then(([m, f, p]) => { setMembers(m.data); setPlans(f.data); setPayments(p.data) }).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])
  const createDue = async (event) => {
    event.preventDefault(); setError('')
    const plan = plans.find((item) => String(item.id) === form.feePlanId)
    if (!plan || !form.memberId) { setError('Selecciona integrante y cuota.'); return }
    try { const payment = await apiRequest('/api/payments', { method: 'POST', body: JSON.stringify({ memberId: Number(form.memberId), feePlanId: plan.id, amount: Number(plan.amount), status: 'pendiente', receiptUrl: form.receiptUrl || null }) }); setPayments((rows) => [payment, ...rows]); setForm({ memberId: '', feePlanId: '', receiptUrl: '' }) } catch (e) { setError(e.message) }
  }
  const markPaid = async (payment) => { try { await apiRequest(`/api/payments/${payment.id}`, { method: 'PUT', body: JSON.stringify({ status: 'pagado', paidAt: new Date().toISOString().slice(0, 10) }) }); await load() } catch (e) { setError(e.message) } }
  const createPlan = async (event) => { event.preventDefault(); try { const plan = await apiRequest('/api/fee-plans', { method: 'POST', body: JSON.stringify({ name: planForm.name, amount: Number(planForm.amount), dueDate: planForm.dueDate || null, type: 'mensualidad' }) }); setPlans((rows) => [plan, ...rows]); setPlanForm({ name: '', amount: '', dueDate: '' }) } catch (e) { setError(e.message) } }
  return <article className="panel fee-control-panel"><div className="panel-header"><div><p className="roster-kicker">CUOTAS POR INTEGRANTE</p><h2>Pagos, pendientes y recibos</h2></div></div>{error && <p className="login-error">{error}</p>}<form className="training-form fee-control-form" onSubmit={createPlan}><label><span>Nombre del plan de cuota</span><input required value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} placeholder="Cuota noviembre" /></label><label><span>Monto ($)</span><input required type="number" min="0.01" step="0.01" value={planForm.amount} onChange={(e) => setPlanForm({ ...planForm, amount: e.target.value })} /></label><label><span>Vence</span><input type="date" value={planForm.dueDate} onChange={(e) => setPlanForm({ ...planForm, dueDate: e.target.value })} /></label><button className="outline-button" type="submit">Crear plan de cuota</button></form><form className="training-form fee-control-form" onSubmit={createDue}><label><span>Integrante</span><select required value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })}><option value="">Seleccionar</option>{members.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}</select></label><label><span>Cuota / plan</span><select required value={form.feePlanId} onChange={(e) => setForm({ ...form, feePlanId: e.target.value })}><option value="">Seleccionar</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name} · ${p.amount}</option>)}</select></label><label><span>Enlace del recibo (opcional)</span><input type="url" value={form.receiptUrl} onChange={(e) => setForm({ ...form, receiptUrl: e.target.value })} placeholder="https://…" /></label><button className="primary-button" type="submit">Asignar cuota pendiente</button></form><div className="fleet-record-list">{payments.map((p) => <div className="fleet-record-row" key={p.id}><div><strong>{p.Member?.firstName} {p.Member?.lastName} · {p.FeePlan?.name || 'Cuota'}</strong><span>${Number(p.amount).toFixed(2)} · {p.paidAt || 'Pendiente de pago'}</span></div><span className={`fleet-badge ${p.status === 'pagado' ? 'realizada' : 'reservada'}`}>{p.status === 'pagado' ? 'Pagado' : 'Pendiente'}</span>{p.receiptUrl && <a href={p.receiptUrl} target="_blank" rel="noreferrer">Ver recibo</a>}{p.status !== 'pagado' && <button className="text-button" onClick={() => markPaid(p)}>REGISTRAR PAGO</button>}</div>)}</div></article>
}

function buildBoatSeats(boatType, rowerCount, previous = []) {
  const rowers = boatType === 'DB12' ? 10 : rowerCount
  const oldRowers = previous.filter((seat) => seat.role === 'Remero')
  const oldHelm = previous.find((seat) => seat.role === 'Timonel')
  const oldDrummer = previous.find((seat) => seat.role === 'Tamborilero')
  return [
    ...Array.from({ length: rowers }, (_, index) => ({
      id: index + 1, role: 'Remero', rowNumber: Math.floor(index / 2) + 1,
      side: index % 2 === 0 ? 'Izquierda' : 'Derecha', member: oldRowers[index]?.member || '',
    })),
    { id: rowers + 1, role: 'Timonel', rowNumber: null, side: 'Centro', member: oldHelm?.member || '' },
    { id: rowers + 2, role: 'Tamborilero', rowNumber: null, side: 'Centro', member: oldDrummer?.member || '' },
  ]
}

function LineupsView() {
  const [category, setCategory] = useState('Open 1')
  const [boatName, setBoatName] = useState('Alineacion principal')
  const [boatType, setBoatType] = useState('DB12')
  const [rowerCount, setRowerCount] = useState(20)
  const [raceId, setRaceId] = useState('')
  const [seats, setSeats] = useStoredState('sky-dragons-lineup', buildBoatSeats('DB12', 10))
  const [reserveValues, setReserveValues] = useStoredState('sky-dragons-lineup-reserves', ['', ''])
  const [members, setMembers] = useState([])
  const [savedLineups, setSavedLineups] = useState([])
  const [races, setRaces] = useState([])
  const [ergData, setErgData] = useState([])
  const [attendanceData, setAttendanceData] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const rowersNeeded = boatType === 'DB12' ? 10 : Number(rowerCount)

  useEffect(() => {
    apiRequest(`/api/members?category=${encodeURIComponent(category)}&limit=500`)
      .then((result) => {
        setMembers(result.data)
        setSeats((current) => current.map((seat) => {
          const member = result.data.find((item) => String(item.id) === String(seat.member) || `${item.firstName} ${item.lastName}`.trim() === seat.member)
          return member ? { ...seat, member: String(member.id) } : seat
        }))
      })
      .catch((requestError) => setError(requestError.message))
    apiRequest('/api/lineups?limit=30')
      .then((result) => setSavedLineups(result.data))
      .catch((requestError) => setError(requestError.message))
    apiRequest('/api/reports/history')
      .then((events) => setRaces(events.flatMap((event) => (event.races || []).map((race) => ({ ...race, eventName: event.name, eventDate: event.startDate })))))
      .catch((requestError) => setError(requestError.message))
    apiRequest('/api/erg-scores?limit=500').then((result) => setErgData(result.data)).catch(() => setErgData([]))
    apiRequest('/api/reports/attendance').then((result) => setAttendanceData(result.integrantes)).catch(() => setAttendanceData([]))
  }, [category])

  useEffect(() => {
    setSeats((previous) => buildBoatSeats(boatType, rowerCount, previous))
    const reserveLimit = boatType === 'DB12' ? 2 : 4
    setReserveValues((current) => Array.from({ length: reserveLimit }, (_, index) => current[index] || ''))
    setSaved(false)
  }, [boatType, rowerCount, setSeats, setReserveValues])

  const assignMember = (seatId, member) => {
    setSeats((current) => current.map((seat) => seat.id === seatId ? { ...seat, member } : seat))
    setSaved(false)
  }
  const assignReserve = (index, memberId) => {
    setReserveValues((current) => current.map((value, reserveIndex) => reserveIndex === index ? memberId : value))
    setSaved(false)
  }
  const memberForValue = (value) => members.find((member) => String(member.id) === String(value) || `${member.firstName} ${member.lastName}`.trim() === value)
  const availabilityLabel = (member) => {
    const plannedDate = races.find((race) => String(race.id) === String(raceId))?.eventDate
    const today = new Date()
    const targetDate = plannedDate || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const unavailable = Boolean((member.unavailableFrom && targetDate >= member.unavailableFrom && (!member.unavailableUntil || targetDate <= member.unavailableUntil)) || (!member.unavailableFrom && member.unavailableUntil && targetDate <= member.unavailableUntil))
    const weekday = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date(`${targetDate}T12:00:00`).getDay()]
    if (unavailable) return ` · NO DISPONIBLE${member.availabilityNotes ? `: ${member.availabilityNotes}` : ''}`
    if (member.availableDays?.length && !member.availableDays.includes(weekday)) return ` · No suele estar ${weekday.toLowerCase()}`
    if (member.availableDays?.length) return ` · Disponible: ${member.availableDays.map((day) => day.slice(0, 3)).join('/')}`
    return ''
  }
  const eligibleMembers = (seat) => members.filter((member) => {
    const role = member.role || 'remero'
    const roleOk = seat.role === 'Remero' ? role === 'remero' && member.status === 'activo' : seat.role === 'Timonel' ? role === 'timonel' && member.status === 'activo' : role === 'tamborilero' && member.status === 'activo'
    const side = seat.side === 'Izquierda' ? 'izquierdo' : 'derecho'
    const sideOk = seat.role !== 'Remero' || !member.rowingSide || member.rowingSide === 'ambos' || member.rowingSide === side
    return roleOk && sideOk
  })
  const reserveMembers = members.filter((member) => ['remero', 'suplente'].includes(member.role) && (member.role === 'suplente' || member.status === 'activo'))
  const assignedValues = seats.map((seat) => seat.member).filter(Boolean)
  const allAssignedValues = [...assignedValues, ...reserveValues.filter(Boolean)]
  const uniqueAssigned = new Set(allAssignedValues).size === allAssignedValues.length
  const complete = seats.length === rowersNeeded + 2 && seats.every((seat) => seat.member) && uniqueAssigned
  const assignedRowers = seats.filter((seat) => seat.role === 'Remero').map((seat) => ({ seat, member: memberForValue(seat.member) })).filter((item) => item.member)
  const sideWeight = { Izquierda: 0, Derecha: 0 }
  const sideWatts = { Izquierda: [], Derecha: [] }
  assignedRowers.forEach(({ seat, member }) => {
    sideWeight[seat.side] += Number(member.weightKg || 0)
    const latest = ergData.filter((entry) => Number(entry.memberId) === Number(member.id) && Number(entry.averageWatts) > 0).sort((a, b) => b.date.localeCompare(a.date))[0]
    if (latest) sideWatts[seat.side].push(Number(latest.averageWatts))
  })
  const assignedAttendance = assignedRowers.map(({ member }) => attendanceData.find((entry) => Number(entry.memberId) === Number(member.id))?.porcentaje).filter(Number.isFinite)
  const attendanceAverage = assignedAttendance.length ? Math.round(assignedAttendance.reduce((a, b) => a + b, 0) / assignedAttendance.length) : null
  const avgWatts = (values) => values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null
  const balanceFlexibleSides = () => {
    const rowers = seats.filter((seat) => seat.role === 'Remero')
    const assigned = rowers.map((seat) => ({ seat, member: memberForValue(seat.member) })).filter(({ member }) => member)
    const fixed = assigned.filter(({ member }) => member.rowingSide !== 'ambos')
    const flexible = assigned.filter(({ member }) => member.rowingSide === 'ambos').map(({ member }) => member).sort((a, b) => Number(b.weightKg || 0) - Number(a.weightKg || 0))
    const totals = { Izquierda: fixed.filter((x) => x.seat.side === 'Izquierda').reduce((sum, x) => sum + Number(x.member.weightKg || 0), 0), Derecha: fixed.filter((x) => x.seat.side === 'Derecha').reduce((sum, x) => sum + Number(x.member.weightKg || 0), 0) }
    const targetIds = { Izquierda: [], Derecha: [] }
    flexible.forEach((member) => { const side = totals.Izquierda <= totals.Derecha ? 'Izquierda' : 'Derecha'; targetIds[side].push(String(member.id)); totals[side] += Number(member.weightKg || 0) })
    const used = new Set()
    setSeats((current) => current.map((seat) => {
      if (seat.role !== 'Remero' || memberForValue(seat.member)?.rowingSide !== 'ambos') return seat
      const memberId = targetIds[seat.side].find((id) => !used.has(id))
      if (memberId) used.add(memberId)
      return memberId ? { ...seat, member: memberId } : seat
    }))
    setSaved(false)
  }

  const saveLineup = async () => {
    if (!complete) {
      setError(uniqueAssigned ? 'Completa todos los puestos antes de guardar.' : 'Un atleta no puede ocupar dos puestos. Cambia una de las asignaciones.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: boatName.trim() || 'Alineacion principal',
        category,
        boatType,
        raceId: raceId || null,
        rowerCount: rowersNeeded,
        seats: [...seats.map((seat) => ({
          memberId: Number(memberForValue(seat.member)?.id),
          rowNumber: seat.rowNumber,
          side: seat.side === 'Izquierda' ? 'izquierda' : seat.side === 'Derecha' ? 'derecha' : 'centro',
          seatRole: seat.role === 'Remero' ? 'remero' : seat.role === 'Timonel' ? 'timonel' : 'tamborilero',
        })), ...reserveValues.filter(Boolean).map((value) => ({ memberId: Number(memberForValue(value)?.id), rowNumber: null, side: 'centro', seatRole: 'suplente' }))],
      }
      const created = await apiRequest('/api/lineups', { method: 'POST', body: JSON.stringify(payload) })
      setSavedLineups((current) => [created, ...current])
      setSaved(true)
    } catch (requestError) { setError(requestError.message) }
    finally { setSaving(false) }
  }
  const deleteLineup = async (lineup) => {
    if (!window.confirm(`¿Borrar la alineacion “${lineup.name}” y sus puestos?`)) return
    try {
      await apiRequest(`/api/lineups/${lineup.id}`, { method: 'DELETE' })
      setSavedLineups((current) => current.filter((item) => item.id !== lineup.id))
    } catch (requestError) { setError(requestError.message) }
  }

  return (
    <div className="lineups-view">
      <div className="lineups-toolbar">
        <div className="lineup-fields">
          <label><span>Nombre de alineacion</span><input value={boatName} onChange={(event) => setBoatName(event.target.value)} /></label>
          <label><span>Categoria</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{Object.keys(categoryRosters).map((name) => <option key={name}>{name}</option>)}</select></label>
          <label><span>Carrera (opcional)</span><select value={raceId} onChange={(event) => setRaceId(event.target.value)}><option value="">Entrenamiento / sin carrera</option>{races.filter((race) => !race.category || race.category === category).map((race) => <option key={race.id} value={race.id}>{race.eventName} · {race.category} · {race.distanceM} m</option>)}</select></label>
          <label><span>Tipo de bote</span><select value={boatType} onChange={(event) => setBoatType(event.target.value)}><option value="DB12">DB12 · bote pequeno</option><option value="DB22">DB22 · bote estandar</option></select></label>
          {boatType === 'DB22' && <label><span>Palistas titulares</span><select value={rowerCount} onChange={(event) => setRowerCount(Number(event.target.value))}><option value={18}>18 palistas</option><option value={19}>19 palistas</option><option value={20}>20 palistas</option></select></label>}
        </div>
        <button className="primary-button" onClick={saveLineup} disabled={saving || !complete}><Plus size={17} /> {saving ? 'GUARDANDO...' : saved ? 'ALINEACION GUARDADA' : 'GUARDAR ALINEACION'}</button>
      </div>
      {error && <p className="login-error" role="alert">{error}</p>}
      <article className="panel lineup-panel">
        <div className="panel-header"><div><p className="roster-kicker">ALINEACION DE REGATA</p><h2>{boatName || 'Alineacion principal'}</h2></div><span className="inventory-count">{boatType} · {rowersNeeded} palistas · {reserveValues.filter(Boolean).length}/{reserveValues.length} suplentes</span></div>
        <div className="lineup-readiness"><span>{assignedValues.length} de {seats.length} titulares asignados</span><div><i style={{ width: `${seats.length ? (assignedValues.length / seats.length) * 100 : 0}%` }} /></div><b>{!uniqueAssigned ? 'Atleta duplicado' : complete ? 'Lista para competir' : 'Alineacion incompleta'}</b></div>
        <div className="boat-layout">
          <div className="boat-axis"><span>PROA</span><i /><span>POPA</span></div>
          <div className="boat-seats">
            {seats.filter((seat) => seat.role === 'Remero').map((seat) => (
              <div className="boat-seat" key={seat.id}>
                <span className="seat-number">{String(seat.rowNumber).padStart(2, '0')}</span>
                <select value={seat.member} onChange={(event) => assignMember(seat.id, event.target.value)} aria-label={`Fila ${seat.rowNumber}, lado ${seat.side}`}>
                  <option value="">Seleccionar atleta</option>
                  {eligibleMembers(seat).map((member) => <option key={member.id} value={String(member.id)}>{member.firstName} {member.lastName}{availabilityLabel(member)}</option>)}
                </select>
                <span className={seat.side === 'Izquierda' ? 'side left' : 'side right'}>{seat.side}</span>
              </div>
            ))}
          </div>
          <div className="special-seats">
            {seats.filter((seat) => seat.role !== 'Remero').map((seat) => (
              <div className="special-seat" key={seat.id}>
                <span>{seat.role}</span>
                <select value={seat.member} onChange={(event) => assignMember(seat.id, event.target.value)} aria-label={seat.role}>
                  <option value="">Seleccionar</option>
                  {eligibleMembers(seat).map((member) => <option key={member.id} value={String(member.id)}>{member.firstName} {member.lastName}{availabilityLabel(member)}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      </article>
      <article className="panel crew-simulator-panel"><div className="panel-header"><div><p className="roster-kicker">SIMULADOR DE TRIPULACIÓN</p><h2>Prueba el equilibrio del bote</h2><p>Compara peso por lado, potencia registrada y constancia de asistencia.</p></div><button className="outline-button" onClick={balanceFlexibleSides} disabled={!assignedRowers.length}>SUGERIR BALANCE</button></div><div className="crew-side-comparison"><div><strong>Izquierda</strong><span>{sideWeight.Izquierda.toFixed(1)} kg · {avgWatts(sideWatts.Izquierda) ?? '—'} W promedio</span></div><div className="crew-balance-difference"><span>Diferencia de peso</span><b>{Math.abs(sideWeight.Izquierda - sideWeight.Derecha).toFixed(1)} kg</b></div><div><strong>Derecha</strong><span>{sideWeight.Derecha.toFixed(1)} kg · {avgWatts(sideWatts.Derecha) ?? '—'} W promedio</span></div></div><div className="crew-simulator-summary"><span>{assignedRowers.length} palistas asignados</span><span>Asistencia histórica media: {attendanceAverage == null ? 'Sin datos' : `${attendanceAverage}%`}</span><small>La sugerencia solo reorganiza atletas que pueden remar en ambos lados. Úsala como punto de partida para probar la tripulación en el agua; no predice el tiempo de carrera.</small></div></article>
      <article className="panel lineup-reserves-panel">
        <div className="panel-header"><div><p className="roster-kicker">BANCA DE REEMPLAZO</p><h2>Suplentes disponibles</h2></div><span className="inventory-count">Maximo {reserveValues.length} para {boatType}</span></div>
        <div className="lineup-reserves-grid">{reserveValues.map((value, index) => <label className="lineup-reserve-slot" key={index}><span>Suplente {index + 1}</span><select value={value} onChange={(event) => assignReserve(index, event.target.value)}><option value="">Seleccionar suplente</option>{reserveMembers.map((member) => <option key={member.id} value={String(member.id)}>{member.firstName} {member.lastName}</option>)}</select></label>)}</div>
        <p className="lineup-reserves-note">Los suplentes no cuentan como puestos titulares y no pueden estar asignados dos veces en la misma tripulacion.</p>
      </article>
      <article className="panel saved-lineups-panel">
        <div className="panel-header"><div><p className="roster-kicker">HISTORIAL</p><h2>Alineaciones guardadas</h2></div></div>
        {savedLineups.length ? savedLineups.slice(0, 5).map((lineup) => <div className="saved-lineup-row" key={lineup.id}><strong>{lineup.name}</strong><span>{lineup.category} · {lineup.boatType || 'DB12'}</span><small>{lineup.seats?.filter((seat) => seat.seatRole !== 'suplente').length || 0} titulares · {lineup.seats?.filter((seat) => seat.seatRole === 'suplente').length || 0} suplentes</small><button className="icon-danger-button" aria-label={`Borrar alineacion ${lineup.name}`} title="Borrar alineacion" onClick={() => deleteLineup(lineup)}><Trash2 size={15} /></button></div>) : <p className="saved-lineups-empty">Las alineaciones guardadas apareceran aqui.</p>}
      </article>
    </div>
  )
}
function CalendarView() {
  const [events, setEvents] = useStoredState('sky-dragons-calendar', [])
  const [members, setMembers] = useState([])
  const [trainingEvents, setTrainingEvents] = useState([])
  const [selectedTraining, setSelectedTraining] = useState(null)
  const [attendanceRoster, setAttendanceRoster] = useState([])
  const [attendanceSaving, setAttendanceSaving] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [monthOffset, setMonthOffset] = useState(0)
  const [eventDraft, setEventDraft] = useState({ title: '', date: '', time: '06:30', type: 'Entrenamiento', location: '' })
  const baseDate = new Date()
  const displayedDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthOffset, 1)
  const year = displayedDate.getFullYear()
  const month = displayedDate.getMonth()
  const monthName = displayedDate.toLocaleDateString('es', { month: 'long', year: 'numeric' })
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: 42 }, (_, index) => index - firstDay + 1)

  useEffect(() => {
    Promise.all([apiRequest('/api/members?limit=500'), apiRequest('/api/trainings?limit=500')])
      .then(([memberResult, trainingResult]) => {
        setMembers(memberResult.data)
        setTrainingEvents(trainingResult.data.map((training) => ({
          id: `training-${training.id}`, trainingId: training.id, date: training.date,
          title: training.notes?.trim() || `Entrenamiento ${({ agua: 'en agua', gimnasio: 'de gimnasio', fisico: 'físico', otro: '' })[training.type] || ''}`.trim(),
          type: 'Entrenamiento', time: training.startTime || '', location: training.location || '', isTraining: true,
        })))
      })
      .catch((requestError) => setError(requestError.message))
  }, [])

  const addEvent = (event) => {
    event.preventDefault()
    if (!eventDraft.title.trim() || !eventDraft.date) return
    setEvents((current) => [...current, { ...eventDraft, id: Date.now(), title: eventDraft.title.trim() }])
    setEventDraft({ title: '', date: '', time: '06:30', type: 'Entrenamiento', location: '' })
    setShowForm(false)
  }
  const deleteEvent = (entry) => {
    if (!window.confirm(`¿Borrar el evento “${entry.title}” del calendario?`)) return
    setEvents((current) => current.filter((item) => item.id !== entry.id))
  }
  const openTrainingAttendance = async (trainingId) => {
    try {
      const [session, rosterResult, attendanceResult] = await Promise.all([
        apiRequest(`/api/trainings/${trainingId}`),
        apiRequest('/api/members?status=activo&limit=500'),
        apiRequest(`/api/attendances?trainingId=${trainingId}&limit=500`),
      ])
      const savedByMember = new Map(attendanceResult.data.map((item) => [item.memberId, item]))
      const attendees = rosterResult.data.filter((m) => !session.category || m.category === session.category).map((m) => ({ memberId: m.id, name: `${m.firstName} ${m.lastName}`, status: savedByMember.get(m.id)?.status || 'presente' }))
      setAttendanceRoster(attendees); setSelectedTraining(session)
    } catch (requestError) { setError(requestError.message) }
  }
  const saveCalendarAttendance = async () => {
    setAttendanceSaving(true)
    try {
      await apiRequest(`/api/trainings/${selectedTraining.id}/attendance`, { method: 'POST', body: JSON.stringify(attendanceRoster) })
      setSelectedTraining(null); setError('')
    } catch (requestError) { setError(requestError.message) }
    finally { setAttendanceSaving(false) }
  }

  return (
    <div className="calendar-view">
      {error && <p className="login-error" role="alert">No se pudieron cargar los cumpleaños: {error}</p>}
      <div className="calendar-toolbar">
        <div className="calendar-controls"><button onClick={() => setMonthOffset((value) => value - 1)}>‹</button><h2>{monthName}</h2><button onClick={() => setMonthOffset((value) => value + 1)}>›</button></div>
        <button className="primary-button" onClick={() => setShowForm(true)}><Plus size={17} /> NUEVO EVENTO</button>
      </div>

      <article className="panel calendar-panel">
        <div className="calendar-weekdays"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span></div>
        <div className="calendar-grid">
          {cells.map((day, index) => {
            const valid = day > 0 && day <= daysInMonth
            const dateKey = valid ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : ''
            const birthdayEvents = valid ? members.filter((member) => {
              if (!member.birthDate) return false
              const birthMonth = Number(String(member.birthDate).slice(5, 7)) - 1
              let birthDay = Number(String(member.birthDate).slice(8, 10))
              if (birthMonth === 1 && birthDay === 29 && new Date(year, 1, 29).getMonth() !== 1) birthDay = 28
              return birthMonth === month && birthDay === day
            }).map((member) => ({ id: `birthday-${member.id}-${year}`, date: dateKey, title: `Cumpleaños: ${member.firstName} ${member.lastName}`.trim(), type: 'cumpleanos', time: '', isBirthday: true })) : []
            const calendarEvents = [...trainingEvents, ...events]
            const dayEvents = valid ? [...birthdayEvents, ...calendarEvents.filter((entry) => entry.date === dateKey)].slice(0, 3) : []
            const totalDayEvents = valid ? birthdayEvents.length + calendarEvents.filter((entry) => entry.date === dateKey).length : 0
            const isToday = valid && day === baseDate.getDate() && month === baseDate.getMonth() && year === baseDate.getFullYear()
            return (
              <div key={`${month}-${index}`} role="button" tabIndex={valid ? 0 : -1} className={valid ? `calendar-day ${isToday ? 'today' : ''}` : 'calendar-day outside'} onClick={() => { if (valid) { setEventDraft((current) => ({ ...current, date: dateKey })); setShowForm(true) } }} onKeyDown={(event) => { if (valid && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setEventDraft((current) => ({ ...current, date: dateKey })); setShowForm(true) } }}>
                {valid && <span className="day-number">{day}</span>}
                {dayEvents.map((entry) => <span key={entry.id} className={`calendar-event ${entry.type.toLowerCase()}`} title={`${entry.time ? `${entry.time} · ` : ''}${entry.location || ''}`} onClick={(event) => { if (entry.isBirthday || entry.isTraining) event.stopPropagation(); if (entry.isTraining) openTrainingAttendance(entry.trainingId) }}>{entry.isBirthday ? <Cake size={11} /> : <b>{entry.time}</b>}<span className="calendar-event-title">{entry.title}</span>{!entry.isBirthday && !entry.isTraining && <button className="calendar-event-delete" aria-label={`Borrar ${entry.title}`} title="Borrar evento" onClick={(event) => { event.stopPropagation(); deleteEvent(entry) }} onKeyDown={(event) => event.stopPropagation()}><Trash2 size={11} /></button>}</span>)}
                {valid && totalDayEvents > dayEvents.length && <span className="calendar-more-events">+{totalDayEvents - dayEvents.length} más</span>}
              </div>
            )
          })}
        </div>
      </article>

      {showForm && (
        <div className="athlete-form-overlay"><div className="athlete-form-panel">
          <div className="panel-header"><h2>Nuevo evento deportivo</h2><button className="close-button" onClick={() => setShowForm(false)}>×</button></div>
          <form className="athlete-form" onSubmit={addEvent}>
            <label><span>Título</span><input required value={eventDraft.title} onChange={(event) => setEventDraft({ ...eventDraft, title: event.target.value })} placeholder="Ej. Entrenamiento técnico" /></label>
            <label><span>Tipo</span><select value={eventDraft.type} onChange={(event) => setEventDraft({ ...eventDraft, type: event.target.value })}><option>Competencia</option><option>Viaje</option><option>Reunión</option><option>Otro</option></select></label>
            <label><span>Fecha</span><input type="date" required value={eventDraft.date} onChange={(event) => setEventDraft({ ...eventDraft, date: event.target.value })} /></label>
            <label><span>Hora</span><input type="time" value={eventDraft.time} onChange={(event) => setEventDraft({ ...eventDraft, time: event.target.value })} /></label>
            <label className="full-form-field"><span>Lugar</span><input value={eventDraft.location} onChange={(event) => setEventDraft({ ...eventDraft, location: event.target.value })} placeholder="Ej. Cinta Costera" /></label>
            <div className="form-actions"><button type="button" className="outline-button" onClick={() => setShowForm(false)}>Cancelar</button><button type="submit" className="primary-button">Guardar evento</button></div>
          </form>
        </div></div>
      )}
      {selectedTraining && <div className="athlete-form-overlay" onClick={() => setSelectedTraining(null)}><article className="athlete-form-panel" onClick={(event) => event.stopPropagation()}><div className="panel-header"><div><p className="roster-kicker">ASISTENCIA · {selectedTraining.date}</p><h2>{selectedTraining.notes || 'Entrenamiento'}</h2></div><button className="close-button" onClick={() => setSelectedTraining(null)}>×</button></div><div className="attendance-list">{attendanceRoster.map((person) => <label className="attendance-row" key={person.memberId}><strong>{person.name}</strong><select value={person.status} onChange={(event) => setAttendanceRoster((rows) => rows.map((row) => row.memberId === person.memberId ? { ...row, status: event.target.value } : row))}><option value="presente">Presente</option><option value="ausente">Ausente</option><option value="justificado">Justificado</option></select></label>)}</div><div className="form-actions"><button className="primary-button" disabled={attendanceSaving} onClick={saveCalendarAttendance}>{attendanceSaving ? 'Guardando…' : 'Guardar asistencia'}</button></div></article></div>}
    </div>
  )
}

function ReportsView() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    Promise.all([apiRequest('/api/reports/attendance'), apiRequest('/api/members?status=activo&limit=500'), apiRequest('/api/trainings?limit=500'), apiRequest('/api/races?limit=500'), apiRequest('/api/erg-scores?limit=500')])
      .then(([attendance, members, trainings, races, erg]) => setData({ attendance, members: members.data, trainings: trainings.data, races: races.data, erg: erg.data }))
      .catch((requestError) => setError(requestError.message))
  }, [])
  const downloadCsv = (name, headers, rows) => {
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const csv = [headers, ...rows].map((row) => row.map(quote).join(',')).join('\r\n')
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })); link.download = name; link.click(); URL.revokeObjectURL(link.href)
  }
  const categories = data ? [...new Set(data.members.map((member) => member.category || 'Sin categoría'))].map((category) => {
    const people = data.members.filter((member) => (member.category || 'Sin categoría') === category)
    const memberIds = new Set(people.map((member) => member.id))
    const attendance = data.attendance.integrantes.filter((row) => memberIds.has(row.memberId))
    const races = data.races.filter((race) => race.category === category)
    const trainings = data.trainings.filter((training) => training.category === category)
    return { category, count: people.length, avgAttendance: attendance.length ? Math.round(attendance.reduce((sum, row) => sum + (row.porcentaje || 0), 0) / attendance.length) : null, races: races.length, trainings: trainings.length }
  }) : []
  return <div className="reports-view">{error && <p className="login-error">{error}</p>}<article className="panel"><div className="panel-header"><div><p className="roster-kicker">TEMPORADA</p><h2>Reportes del equipo</h2><p>Asistencia, participación por categoría y descarga de datos.</p></div></div>
    {data ? <><div className="stats-grid"><div className="stat-card"><div className="stat-copy"><span>Entrenamientos</span><strong>{data.trainings.length}</strong></div></div><div className="stat-card"><div className="stat-copy"><span>Atletas activos</span><strong>{data.members.length}</strong></div></div><div className="stat-card"><div className="stat-copy"><span>Resultados</span><strong>{data.races.length}</strong></div></div><div className="stat-card"><div className="stat-copy"><span>Marcas ergómetro</span><strong>{data.erg.length}</strong></div></div></div>
    <div className="report-table"><div className="report-row report-head"><b>Categoría</b><b>Atletas</b><b>Asistencia media</b><b>Entrenamientos</b><b>Resultados</b></div>{categories.map((item) => <div className="report-row" key={item.category}><strong>{item.category}</strong><span>{item.count}</span><span>{item.avgAttendance == null ? 'Sin datos' : `${item.avgAttendance}%`}</span><span>{item.trainings}</span><span>{item.races}</span></div>)}</div>
    <h3>Exportar datos CSV</h3><div className="form-actions"><button className="outline-button" onClick={() => downloadCsv('asistencia.csv', ['Integrante', 'Presentes', 'Justificados', 'Porcentaje'], data.attendance.integrantes.map((r) => [r.nombre, r.presentes, r.justificados, r.porcentaje]))}>Asistencia</button><button className="outline-button" onClick={() => downloadCsv('entrenamientos.csv', ['Fecha', 'Categoría', 'Tipo', 'Hora', 'Lugar', 'Distancia'], data.trainings.map((r) => [r.date, r.category, r.type, r.startTime, r.location, r.distanceM]))}>Entrenamientos</button><button className="outline-button" onClick={() => downloadCsv('resultados.csv', ['Competencia', 'Categoría', 'Distancia', 'Tiempo', 'Puesto'], data.races.map((r) => [r.Competition?.name, r.category, r.distanceM, r.timeSeconds, r.position]))}>Resultados</button><button className="outline-button" onClick={() => downloadCsv('ergometro.csv', ['Atleta', 'Fecha', 'Distancia', 'Segundos', 'Vatios'], data.erg.map((r) => [`${r.Member?.firstName || ''} ${r.Member?.lastName || ''}`, r.date, r.distanceM, r.durationSeconds, r.averageWatts]))}>Ergómetro</button></div></> : !error && <p>Cargando reportes…</p>}
  </article></div>
}

function LoginView({ onLogin }) {
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [signup, setSignup] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.has('resetToken') ? 'reset' : params.has('registro') ? 'signup' : 'login'
  })
  const [resetPassword, setResetPassword] = useState({ password: '', confirm: '' })
  const resetToken = new URLSearchParams(window.location.search).get('resetToken') || ''

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await authApi.login(credentials.email, credentials.password)
      localStorage.setItem('sky_dragons_token', result.token)
      onLogin(result.user)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  const requestReset = async (event) => {
    event.preventDefault(); setError(''); setNotice(''); setLoading(true)
    try {
      const result = await apiRequest('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: credentials.email }) })
      setNotice(result.message)
    } catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }

  const submitSignup = async (event) => {
    event.preventDefault(); setError(''); setNotice('')
    if (signup.password !== signup.confirm) { setError('Las contraseñas no coinciden.'); return }
    setLoading(true)
    try {
      const result = await apiRequest('/api/auth/signup', { method: 'POST', body: JSON.stringify({ name: signup.name, email: signup.email, password: signup.password }) })
      setCredentials({ email: signup.email, password: '' }); setSignup({ name: '', email: '', password: '', confirm: '' })
      setMode('login'); setNotice(result.message)
    } catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }

  const submitReset = async (event) => {
    event.preventDefault(); setError(''); setNotice('')
    if (resetPassword.password !== resetPassword.confirm) { setError('Las contraseñas no coinciden.'); return }
    setLoading(true)
    try {
      const result = await apiRequest('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: resetToken, password: resetPassword.password }) })
      window.history.replaceState({}, '', window.location.pathname)
      setMode('login'); setNotice(result.message); setCredentials((current) => ({ ...current, password: '' }))
    } catch (requestError) { setError(requestError.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="login-screen">
      {mode === 'login' && <form className="login-card" onSubmit={submit}>
        <img src={skyDragonsLogo} alt="Sky Dragons" />
        <p className="roster-kicker">CENTRO DEPORTIVO</p>
        <h1>Iniciar sesión</h1>
        {error && <div className="login-error">{error}</div>}
        {notice && <div className="reset-notice" role="status">{notice}</div>}
        <label><span>Correo electrónico</span><input type="email" required value={credentials.email} onChange={(event) => setCredentials({ ...credentials, email: event.target.value })} placeholder="usuario@skydragons.pa" /></label>
        <label><span>Contraseña</span><input type="password" required value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} /></label>
        <button className="primary-button login-button" disabled={loading}>{loading ? 'Ingresando...' : 'INGRESAR'}</button>
        <div className="login-options"><button type="button" className="login-text-button" onClick={() => { setMode('signup'); setError(''); setNotice('') }}>Crear una cuenta</button><button type="button" className="login-text-button" onClick={() => { setMode('forgot'); setError(''); setNotice('') }}>¿Olvidaste tu contraseña?</button></div>
      </form>}
      {mode === 'signup' && <form className="login-card" onSubmit={submitSignup}>
        <img src={skyDragonsLogo} alt="Sky Dragons" /><p className="roster-kicker">NUEVA CUENTA</p><h1>Regístrate</h1>
        <p className="reset-description">Crea tu acceso. El administrador revisará y aprobará tu registro.</p>
        {error && <div className="login-error" role="alert">{error}</div>}
        <label><span>Nombre completo</span><input required minLength="2" maxLength="120" autoComplete="name" value={signup.name} onChange={(event) => setSignup({ ...signup, name: event.target.value })} /></label>
        <label><span>Correo electrónico</span><input type="email" required autoComplete="email" value={signup.email} onChange={(event) => setSignup({ ...signup, email: event.target.value })} placeholder="usuario@skydragons.pa" /></label>
        <label><span>Contraseña (12 caracteres mínimo)</span><input type="password" required minLength="12" maxLength="72" autoComplete="new-password" value={signup.password} onChange={(event) => setSignup({ ...signup, password: event.target.value })} /></label>
        <label><span>Confirma la contraseña</span><input type="password" required minLength="12" maxLength="72" autoComplete="new-password" value={signup.confirm} onChange={(event) => setSignup({ ...signup, confirm: event.target.value })} /></label>
        <button className="primary-button login-button" disabled={loading}>{loading ? 'Enviando…' : 'SOLICITAR CUENTA'}</button>
        <button type="button" className="login-text-button" onClick={() => { setMode('login'); setError('') }}>Volver a iniciar sesión</button>
      </form>}
      {mode === 'forgot' && <form className="login-card" onSubmit={requestReset}>
        <img src={skyDragonsLogo} alt="Sky Dragons" /><p className="roster-kicker">RECUPERAR ACCESO</p><h1>Restablecer contraseña</h1>
        <p className="reset-description">Escribe el correo asociado a tu cuenta. Si existe, te enviaremos un enlace seguro.</p>
        {error && <div className="login-error" role="alert">{error}</div>}{notice && <div className="reset-notice" role="status">{notice}</div>}
        <label><span>Correo electrónico</span><input type="email" required autoComplete="email" value={credentials.email} onChange={(event) => setCredentials({ ...credentials, email: event.target.value })} placeholder="usuario@skydragons.pa" /></label>
        <button className="primary-button login-button" disabled={loading}>{loading ? 'Enviando…' : 'ENVIAR ENLACE'}</button>
        <button type="button" className="login-text-button" onClick={() => { setMode('login'); setError(''); setNotice('') }}>Volver a iniciar sesión</button>
      </form>}
      {mode === 'reset' && <form className="login-card" onSubmit={submitReset}>
        <img src={skyDragonsLogo} alt="Sky Dragons" /><p className="roster-kicker">NUEVA CONTRASEÑA</p><h1>Restablecer acceso</h1>
        {error && <div className="login-error" role="alert">{error}</div>}
        {!resetToken && <div className="login-error">El enlace no contiene un token. Solicita un enlace nuevo.</div>}
        <label><span>Nueva contraseña (12 caracteres mínimo)</span><input type="password" required minLength="12" autoComplete="new-password" value={resetPassword.password} onChange={(event) => setResetPassword({ ...resetPassword, password: event.target.value })} /></label>
        <label><span>Confirma la contraseña</span><input type="password" required minLength="12" autoComplete="new-password" value={resetPassword.confirm} onChange={(event) => setResetPassword({ ...resetPassword, confirm: event.target.value })} /></label>
        <button className="primary-button login-button" disabled={loading || !resetToken}>{loading ? 'Guardando…' : 'GUARDAR CONTRASEÑA'}</button>
        <button type="button" className="login-text-button" onClick={() => { window.history.replaceState({}, '', window.location.pathname); setMode('login'); setError('') }}>Volver a iniciar sesión</button>
      </form>}
    </div>
  )
}

function DashboardGallerySlide({ photo }) {
  const [photoUrl, setPhotoUrl] = useState('')
  useEffect(() => {
    let active = true
    let objectUrl = ''
    setPhotoUrl('')
    apiRequest(`/api/gallery/${photo.id}/image`, { responseType: 'blob' }).then((blob) => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setPhotoUrl(objectUrl)
    }).catch(() => setPhotoUrl(''))
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [photo.id])
  return photoUrl ? <img className="dashboard-gallery-image" src={photoUrl} alt={photo.title} /> : <div className="dashboard-gallery-loading"><ImageIcon size={28} /><span>Cargando imagen…</span></div>
}

function DashboardGallerySlideshow({ onNavigate }) {
  const [photos, setPhotos] = useState([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    let active = true
    apiRequest('/api/gallery').then((result) => {
      if (active) setPhotos((Array.isArray(result.data) ? result.data : []).slice(0, 8))
    }).catch(() => { if (active) setPhotos([]) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (paused || photos.length < 2) return undefined
    const timer = window.setInterval(() => setActiveIndex((index) => (index + 1) % photos.length), 6000)
    return () => window.clearInterval(timer)
  }, [photos.length, paused])

  const move = (amount) => setActiveIndex((index) => (index + amount + photos.length) % photos.length)
  const currentPhoto = photos[activeIndex]
  return <article className="panel dashboard-gallery-panel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false) }}>
    <div className="panel-header"><div><p className="roster-kicker">MOMENTOS DEL EQUIPO</p><h2>Galería</h2></div><button className="text-button" onClick={() => onNavigate('Galería')}>VER TODAS LAS FOTOS <ArrowUpRight size={15} /></button></div>
    {currentPhoto ? <div className="dashboard-gallery-frame"><DashboardGallerySlide key={currentPhoto.id} photo={currentPhoto} /><div className="dashboard-gallery-shade" /><div className="dashboard-gallery-caption"><span>{currentPhoto.category || 'SKY DRAGONS'}</span><h3>{currentPhoto.title}</h3>{currentPhoto.photoDate && <time>{new Date(`${currentPhoto.photoDate}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}</time>}</div>
      {photos.length > 1 && <><button className="dashboard-gallery-arrow previous" aria-label="Foto anterior" onClick={() => move(-1)}><ChevronLeft size={22} /></button><button className="dashboard-gallery-arrow next" aria-label="Foto siguiente" onClick={() => move(1)}><ChevronRight size={22} /></button><div className="dashboard-gallery-dots" aria-label="Diapositivas">{photos.map((photo, index) => <button key={photo.id} className={index === activeIndex ? 'active' : ''} aria-label={`Ver foto ${index + 1}: ${photo.title}`} aria-current={index === activeIndex ? 'true' : undefined} onClick={() => setActiveIndex(index)} />)}</div></>}
    </div> : <div className="dashboard-gallery-empty"><ImageIcon size={30} /><strong>{loading ? 'Cargando galería…' : 'Aún no hay fotos'}</strong><span>{loading ? 'Las imágenes del equipo aparecerán aquí.' : 'Sube fotos desde la galería y se mostrarán en estas diapositivas.'}</span><button className="outline-button" onClick={() => onNavigate('Galería')}>ABRIR GALERÍA</button></div>}
  </article>
}

function DashboardView({ onNavigate, demoEnabled, setDemoEnabled }) {
  const [summary, setSummary] = useState(null)
  const [members, setMembers] = useState([])
  const [trainings, setTrainings] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    Promise.all([apiRequest('/api/members?status=activo&limit=500'), apiRequest('/api/trainings?limit=500'), apiRequest('/api/competitions?limit=500'), apiRequest('/api/races?limit=500')])
      .then(([memberResult, trainingResult, competitionResult, raceResult]) => {
        const todayDate = new Date()
        const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`
        const demoMembers = demoEnabled ? [
          { id: 'demo-1', firstName: 'Alex', lastName: 'Rivera', role: 'remero' },
          { id: 'demo-2', firstName: 'Sofía', lastName: 'Méndez', role: 'remero' },
          { id: 'demo-3', firstName: 'Luis', lastName: 'Castillo', role: 'timonel' },
        ] : []
        const demoTrainings = demoEnabled ? Array.from({ length: 6 }, (_, index) => {
          const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - (5 - index)); date.setDate(12)
          return { id: `demo-training-${index}`, date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, startTime: '06:00', location: 'Calzada de Amador', notes: 'DEMO · Técnica y resistencia' }
        }).concat([{ id: 'demo-training-next', date: today, startTime: '06:00', location: 'Calzada de Amador', notes: 'DEMO · Entrenamiento en agua' }]) : []
        const demoCompetitions = demoEnabled ? [{ id: 'demo-competition', name: 'DEMO · Regata de temporada', venue: 'Ciudad de Panamá', startDate: `${new Date().getFullYear()}-12-12` }] : []
        const demoRaces = demoEnabled ? [{ id: 999999, competitionId: 'demo-competition', position: 2 }] : []
        const trainings = [...trainingResult.data, ...demoTrainings]
        const competitions = [...competitionResult.data, ...demoCompetitions]
        const races = [...raceResult.data, ...demoRaces]
        const nextTraining = [...trainings].filter((item) => item.date >= today).sort((a, b) => `${a.date}${a.startTime || ''}`.localeCompare(`${b.date}${b.startTime || ''}`))[0] || null
        const upcomingCompetition = [...competitions].filter((item) => item.startDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0] || null
        const latestRace = [...races].sort((a, b) => b.id - a.id)[0] || null
        setSummary({ activeMembers: memberResult.total + demoMembers.length, totalTrainings: trainings.length, completedTrainings: trainings.filter((item) => item.date < today).length, nextTraining, upcomingCompetition, totalCompetitions: competitions.length, latestRace, totalRaces: races.length })
        setMembers([...memberResult.data, ...demoMembers])
        setTrainings(trainings)
      })
      .catch((requestError) => setError(requestError.message))
  }, [demoEnabled])
  const recentTrainingCounts = Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date()
    monthDate.setDate(1)
    monthDate.setMonth(monthDate.getMonth() - (5 - index))
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
    return { label: monthDate.toLocaleDateString('es', { month: 'short' }), count: trainings.filter((training) => String(training.date || '').startsWith(key)).length }
  })
  const maximum = Math.max(1, ...recentTrainingCounts.map((month) => month.count))
  const latestRace = summary?.latestRace
  const nextItem = summary?.nextTraining || summary?.upcomingCompetition
  const nextDate = summary?.nextTraining?.date || summary?.upcomingCompetition?.startDate
  const firstSteps = [
    { label: 'Agrega integrantes', done: members.length > 0, page: 'Integrantes' },
    { label: 'Programa un entrenamiento', done: trainings.length > 0, page: 'Entrenamientos' },
    { label: 'Registra una competencia', done: Boolean(summary?.totalCompetitions), page: 'Competencias' },
  ]
  const setupComplete = firstSteps.every((step) => step.done)
  return <>
    {error && <p className="login-error" role="alert">{error}</p>}
    {demoEnabled && <div className="demo-notice">Vista de demostración · estos ejemplos solo se muestran en el tablero y no se guardan en el equipo.</div>}
    {!setupComplete && <article className="panel onboarding-panel">
      <div className="onboarding-copy"><span className="onboarding-kicker">TU TEMPORADA EMPIEZA AQUÍ</span><h2>Primeros pasos</h2><p>Completa estas acciones para poner en marcha el equipo.</p></div>
      <div className="onboarding-steps">{firstSteps.map((step, index) => <button key={step.label} className={`onboarding-step ${step.done ? 'done' : ''}`} onClick={() => onNavigate(step.page)}><span>{step.done ? '✓' : index + 1}</span>{step.label}<ArrowUpRight size={14} /></button>)}</div>
    </article>}
    <div className="stats-grid">
      <article className="stat-card"><div className="stat-icon coral"><Users size={22} /></div><div className="stat-copy"><span>Atletas activos</span><strong>{summary?.activeMembers ?? '—'}</strong></div></article>
      <article className="stat-card"><div className="stat-icon aqua"><Timer size={22} /></div><div className="stat-copy"><span>Sesiones completadas</span><strong>{summary?.completedTrainings ?? '—'}</strong></div></article>
      <article className="stat-card"><div className="stat-icon yellow"><Medal size={22} /></div><div className="stat-copy"><span>Último resultado</span><strong>{latestRace?.position ? `#${latestRace.position}` : '—'}</strong></div></article>
      <article className="stat-card"><div className="stat-icon blue"><Trophy size={22} /></div><div className="stat-copy"><span>Próxima competencia</span><strong>{summary?.upcomingCompetition?.startDate ? new Date(`${summary.upcomingCompetition.startDate}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '—'}</strong></div></article>
    </div>
    <div className="dashboard-grid">
      <article className="panel performance-panel"><div className="panel-header"><div><h2>Ritmo del equipo</h2><p>Sesiones registradas · últimos seis meses</p></div><span className="inventory-count">{summary?.totalTrainings ?? 0} sesiones</span></div>
        <div className="performance-content"><div className="performance-score"><span>Sesiones realizadas</span><strong>{summary?.completedTrainings ?? 0}</strong><small>Entrenamientos anteriores a hoy</small></div>
          <div className="chart-area"><div className="bar-grid"><i /><i /><i /><i /></div><div className="bars" aria-label="Entrenamientos por mes">{recentTrainingCounts.map((month) => <div className="bar-column" key={month.label}><b style={{ height: `${Math.max(5, month.count / maximum * 100)}%` }}><span>{month.count}</span></b><small>{month.label}</small></div>)}</div></div>
        </div>
      </article>
      <article className="panel next-event-panel"><div className="event-top"><span>{summary?.nextTraining ? 'PROXIMO ENTRENAMIENTO' : 'PROXIMA ACTIVIDAD'}</span><Waves size={22} /></div>
        <div className="event-body"><div className="event-date"><strong>{nextDate ? new Date(`${nextDate}T12:00:00`).getDate() : '—'}</strong><span>{nextDate ? new Date(`${nextDate}T12:00:00`).toLocaleDateString('es', { month: 'short' }).toUpperCase() : 'FECHA'}</span></div><div><h2>{nextItem?.notes || nextItem?.name || 'Sin actividad próxima'}</h2><p>{nextItem?.location || (nextItem ? 'Actividad del equipo' : 'Programa un entrenamiento')}</p></div></div>
        <button className="event-action" onClick={() => onNavigate(summary?.nextTraining ? 'Entrenamientos' : 'Calendario')}>VER AGENDA <ArrowUpRight size={15} /></button>
      </article>
    </div>
    <DashboardGallerySlideshow onNavigate={onNavigate} />
    <div className="bottom-grid">
      <article className="panel team-panel"><div className="panel-header"><div><h2>Plantilla activa</h2><p>{members.length} atletas en el equipo</p></div><button className="text-button" onClick={() => onNavigate('Integrantes')}>VER PLANTILLA <ArrowUpRight size={15} /></button></div>
        <div className="member-table">{members.slice(0, 4).map((member) => { const fullName = `${member.firstName} ${member.lastName}`.trim(); const initials = fullName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(); return <div className="member-row" key={member.id}><div className="member-name"><b>{initials}</b><div><strong>{fullName}</strong><span>{member.role}</span></div></div><span className="status"><i /> Activo</span></div> })}{members.length === 0 && <div className="empty-state"><Users size={24} /><p>Agrega integrantes para ver la plantilla.</p></div>}</div>
      </article>
      <article className="panel goals-panel"><div className="panel-header"><div><h2>Temporada</h2><p>Actividad deportiva registrada</p></div><Target size={20} /></div>
        <div className="season-summary"><strong>{summary?.totalRaces ?? 0}</strong><span>carreras registradas</span><strong>{summary?.totalTrainings ?? 0}</strong><span>entrenamientos programados</span><button className="text-button" onClick={() => onNavigate('Competencias')}>VER RESULTADOS <ArrowUpRight size={15} /></button></div>
      </article>
    </div>
  </>
}
function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const [isInstalled, setIsInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true)
  const [isIOS] = useState(() => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

  useEffect(() => {
    const handleInstallPrompt = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    const handleInstalled = () => { setInstallPrompt(null); setIsInstalled(true) }
    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  if (Capacitor.isNativePlatform() || isInstalled || (!installPrompt && !isIOS)) return null

  const install = async () => {
    if (!installPrompt) { setShowInstructions(true); return }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') setIsInstalled(true)
    setInstallPrompt(null)
  }

  return <>
    <button className="install-app-button" onClick={install}><Download size={16} /><span>Instalar app</span></button>
    {showInstructions && <div className="install-help-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setShowInstructions(false) }}>
      <section className="install-help" role="dialog" aria-modal="true" aria-labelledby="install-help-title">
        <button className="install-help-close" aria-label="Cerrar" onClick={() => setShowInstructions(false)}>×</button>
        <p className="roster-kicker">APP PARA IPHONE Y IPAD</p>
        <h2 id="install-help-title">Agrega Sky Dragons a tu inicio</h2>
        <ol><li>Abre esta página en Safari.</li><li>Toca <strong>Compartir</strong> <span aria-label="compartir">↑</span>.</li><li>Elige <strong>Agregar a pantalla de inicio</strong> y confirma.</li></ol>
        <button className="primary-button" onClick={() => setShowInstructions(false)}>Entendido</button>
      </section>
    </div>}
  </>
}

function App() {
  const [active, setActive] = useState(() => new URLSearchParams(window.location.search).has('ergdata') ? 'Concept2' : 'Centro deportivo')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [demoEnabled, setDemoEnabled] = useStoredState('sky_dragons_dashboard_demo', false)
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const handleLogin = (userData) => {
    setUser(userData)
    setActive('Integrantes')
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('sky_dragons_token')
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('resetToken')) return
    if (!localStorage.getItem('sky_dragons_token')) return
    authApi.me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('sky_dragons_token')
        setUser(null)
      })
  }, [])

  useEffect(() => {
    const query = searchText.trim()
    if (query.length < 2 || !user) { setSearchResults([]); setSearching(false); return }
    let cancelled = false
    setSearching(true)
    const timer = window.setTimeout(async () => {
      try {
        const [memberResult, trainingResult, competitionResult] = await Promise.all([
          apiRequest('/api/members?limit=500'), apiRequest('/api/trainings?limit=500'), apiRequest('/api/competitions?limit=500'),
        ])
        if (cancelled) return
        const term = query.toLocaleLowerCase()
        const results = [
          ...memberResult.data.map((item) => ({ type: 'Integrantes', title: `${item.firstName} ${item.lastName}`.trim(), detail: `${item.category || 'Equipo'} · ${item.role || 'Integrante'}` })),
          ...trainingResult.data.map((item) => ({ type: 'Entrenamientos', title: item.notes || 'Entrenamiento', detail: `${item.date || ''} · ${item.location || 'Sin ubicación'}` })),
          ...competitionResult.data.map((item) => ({ type: 'Competencias', title: item.name, detail: `${item.startDate || 'Fecha pendiente'} · ${item.venue || 'Lugar pendiente'}` })),
        ].filter((item) => `${item.title} ${item.detail}`.toLocaleLowerCase().includes(term))
        setSearchResults(results.slice(0, 8))
      } catch { if (!cancelled) setSearchResults([]) }
      finally { if (!cancelled) setSearching(false) }
    }, 220)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [searchText, user])

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        document.querySelector('.search-box input')?.focus()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') { setSearchOpen(false); setNotificationsOpen(false); setProfileOpen(false) }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  if (!user || new URLSearchParams(window.location.search).has('resetToken')) return <LoginView onLogin={handleLogin} />

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="brand">
          <img className="brand-logo" src={skyDragonsLogo} alt="Sky Dragons" />
          <div><strong>SKY DRAGONS</strong><span>TEAM 2026</span></div>
        </div>
        <nav className="nav-list">
          {nav.map(({ label, icon: Icon }) => {
            const locked = label === 'Finanzas' && !['admin', 'tesorero'].includes(user.role)
            return locked ? (
              <button key={label} className="nav-item locked" type="button" disabled title="No tienes permiso para entrar a este módulo." aria-label={`${label}. Restringido para tu rol.`}>
                <Icon size={20} strokeWidth={2.2} /><span>{label}<small>Módulo restringido</small></span><LockKeyhole className="nav-lock-icon" size={15} />
              </button>
            ) : (
              <button key={label} className={active === label ? 'nav-item active' : 'nav-item'} onClick={() => { setActive(label); setMobileOpen(false) }}>
                <Icon size={20} strokeWidth={2.2} /><span>{label}</span>
              </button>
            )
          })}
        </nav>
        <div className="sidebar-bottom">
          {user.role === 'admin' && <button className="nav-item" onClick={() => { setActive('Configuración'); setMobileOpen(false) }}><Settings size={20} /><span>Configuración</span></button>}
          {user.role !== 'admin' && <button className="nav-item locked" type="button" disabled title="Solo el administrador puede entrar a Configuración." aria-label="Configuración. Solo disponible para el administrador."><Settings size={20} /><span>Configuración<small>Solo administrador</small></span><LockKeyhole className="nav-lock-icon" size={15} /></button>}
          <button className="nav-item" onClick={handleLogout}><LogOut size={20} /><span>Cerrar sesión</span></button>
        </div>
      </aside>

      {mobileOpen && <button className="overlay" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Abrir menú"><Menu size={22} /></button>
          <div className="search-box"><Search size={18} /><input aria-label="Buscar" placeholder="Buscar en el equipo..." value={searchText} onFocus={() => setSearchOpen(true)} onChange={(event) => { setSearchText(event.target.value); setSearchOpen(true) }} onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false) }} /><kbd>⌘ K</kbd>
            {searchOpen && searchText.trim().length >= 2 && <div className="global-search-results" role="listbox">{searching ? <p>Buscando…</p> : searchResults.length ? searchResults.map((item, index) => <button key={`${item.type}-${index}`} onClick={() => { setActive(item.type); setSearchOpen(false); setSearchText('') }}><span>{item.title}</span><small>{item.type} · {item.detail}</small></button>) : <p>No hay resultados para “{searchText.trim()}”.</p>}</div>}
          </div>
          <div className="topbar-actions">
            <InstallAppButton />
            <div className="topbar-popover-anchor"><button className="icon-button notification" aria-label="Notificaciones" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen((open) => !open); setProfileOpen(false) }}><Bell size={20} /><span /></button>{notificationsOpen && <div className="topbar-popover"><strong>Notificaciones</strong><p>No tienes notificaciones pendientes.</p><button onClick={() => { setNotificationsOpen(false); setActive('Calendario') }}>Abrir calendario</button></div>}</div>
            <div className="topbar-popover-anchor"><button className="profile profile-button" aria-expanded={profileOpen} onClick={() => { setProfileOpen((open) => !open); setNotificationsOpen(false) }}><div className="avatar">{(user.name || 'AD').split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()}</div><div className="profile-copy"><strong>{user.name || 'Usuario'}</strong><span>{user.role || 'Usuario'}</span></div><ChevronDown size={16} /></button>{profileOpen && <div className="topbar-popover profile-popover"><strong>{user.email || user.name}</strong><span>Rol: {user.role || 'lector'}</span>{user.role === 'admin' && <button onClick={() => { setProfileOpen(false); setActive('Configuración') }}>Configuración</button>}<button onClick={handleLogout}>Cerrar sesión</button></div>}</div>
          </div>
        </header>

        <section className="page">
          <div className="page-heading">
            <div><p className="eyebrow">TEMPORADA 2026 · SIN DATOS</p><h1>{active === 'Integrantes' ? 'Categorías y roster' : active === 'Entrenamientos' ? 'Programación de entrenamientos' : active === 'Concept2' ? 'Datos de ergómetro por sesión' : active === 'Métricas' ? 'Seguimiento físico por remero' : active === 'Competencias' ? 'Competiciones y medallero' : active === 'Inventario' ? 'Inventario del equipo' : active === 'Flota y reservas' ? 'Bitácora de flota y reservas' : active === 'Finanzas' ? 'Administración financiera' : active === 'Alineaciones' ? 'Alineación del bote' : active === 'Calendario' ? 'Calendario deportivo' : active === 'Galería' ? 'Galería de imágenes del equipo' : active === 'Reportes' ? 'Reportes de temporada' : active === 'Configuración' ? 'Configuración y usuarios' : 'Centro deportivo'}</h1></div>
            <div className="heading-actions">{active === 'Centro deportivo' && <button className="demo-toggle" onClick={() => setDemoEnabled((current) => !current)}>{demoEnabled ? 'Quitar datos demo' : 'Cargar demo'}</button>}{!['Métricas', 'Galería'].includes(active) && <button className="primary-button" onClick={() => setActive('Entrenamientos')}><Plus size={18} /> NUEVA ACTIVIDAD</button>}</div>
          </div>

          {user ? (
            active === 'Integrantes' ? (
              <RosterView currentUser={user} />
            ) : active === 'Entrenamientos' ? (
              <TrainingView currentUser={user} />
            ) : active === 'Concept2' ? (
            <Concept2View currentUser={user} onNavigate={setActive} />
            ) : active === 'Métricas' ? (
              <PhysicalMetricsView currentUser={user} />
            ) : active === 'Competencias' ? (
              <CompetitionsView />
            ) : active === 'Inventario' ? (
              <InventoryView />
            ) : active === 'Flota y reservas' ? (
              <FleetView />
            ) : active === 'Finanzas' ? (
              <FinanceView />
            ) : active === 'Alineaciones' ? (
              <LineupsView />
            ) : active === 'Calendario' ? (
              <CalendarView />
            ) : active === 'Galería' ? (
              <GalleryView currentUser={user} />
            ) : active === 'Reportes' ? (
              <ReportsView />
            ) : active === 'Configuración' ? (
              <SettingsView currentUser={user} />
            ) : (
              <DashboardView onNavigate={setActive} demoEnabled={demoEnabled} setDemoEnabled={setDemoEnabled} />
            )
          ) : (
            <LoginView onLogin={handleLogin} />
          )}
        </section>
      </main>
    </div>
  )
}

function SettingsView({ currentUser }) {
  const [users, setUsers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'lector', memberId: '' })
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (currentUser?.role !== 'admin') return
    apiRequest('/api/auth/users').then((result) => setUsers(result.filter((item) => item.id !== currentUser.id))).catch((error) => setMessage(error.message))
  }, [currentUser])

  const createUser = async (event) => {
    event.preventDefault()
    setMessage('')
    try {
      const created = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          memberId: form.memberId ? Number(form.memberId) : null,
        }),
      })
      setUsers((current) => [...current, created])
      setForm({ name: '', email: '', password: '', role: 'lector', memberId: '' })
      setShowForm(false)
      setMessage('Usuario creado correctamente')
    } catch (error) {
      setMessage(error.message)
    }
  }

  const deleteUser = async (item) => {
    if (!window.confirm(`¿Borrar el acceso de ${item.name} (${item.email})?`)) return
    try {
      await apiRequest(`/api/auth/users/${item.id}`, { method: 'DELETE' })
      setUsers((current) => current.filter((userItem) => userItem.id !== item.id))
      setMessage('Usuario eliminado correctamente')
    } catch (error) { setMessage(error.message) }
  }

  const toggleUserApproval = async (item) => {
    const isApproved = !item.isApproved
    try {
      const updated = await apiRequest(`/api/auth/users/${item.id}/approval`, { method: 'PUT', body: JSON.stringify({ isApproved }) })
      setUsers((current) => current.map((userItem) => userItem.id === item.id ? updated : userItem))
      setMessage(isApproved ? 'Cuenta aprobada correctamente' : 'Acceso suspendido correctamente')
    } catch (error) { setMessage(error.message) }
  }

  const inviteUsers = async () => {
    const inviteUrl = new URL(window.location.href)
    inviteUrl.search = ''
    inviteUrl.hash = ''
    inviteUrl.searchParams.set('registro', '1')
    const shareData = {
      title: 'Únete a Sky Dragons',
      text: 'Crea tu acceso a Sky Dragons desde este enlace.',
      url: inviteUrl.toString(),
    }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
        setMessage('Invitación compartida correctamente.')
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url)
        setMessage('Enlace copiado correctamente. Ya puedes enviarlo por WhatsApp.')
      } else {
        window.prompt('Copia este enlace para invitar al equipo:', shareData.url)
        setMessage('Copia el enlace y envíalo por WhatsApp.')
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setMessage('No se pudo compartir el enlace. Inténtalo de nuevo.')
    }
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="settings-view">
        <article className="panel access-panel"><ShieldCheck size={32} /><h2>Acceso restringido</h2><p>Solo un administrador puede crear usuarios.</p></article>
      </div>
    )
  }

  return (
    <div className="settings-view">
      <div className="settings-toolbar">
        <div><p className="roster-kicker">ACCESOS DEL SISTEMA</p><h2>Usuarios y permisos</h2></div>
        <div className="form-actions"><button className="outline-button" onClick={inviteUsers}><Share2 size={16} /> INVITAR AL EQUIPO</button><button className="primary-button" onClick={() => setShowForm(true)}><UserPlus size={17} /> CREAR USUARIO</button></div>
      </div>

      {message && <div className={message.includes('correctamente') ? 'settings-message success' : 'settings-message error'}>{message}</div>}

      <article className="panel users-panel">
        <div className="users-table-head"><span>Usuario</span><span>Correo</span><span>Rol</span><span>Estado</span><span>Acciones</span></div>
        <div className="users-table-row"><div className="member-name"><b style={{ background: '#ff6b3d' }}>{(currentUser.name || 'AD').split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()}</b><strong>{currentUser.name || 'Administrador'}</strong></div><span>{currentUser.email || 'Sesión actual'}</span><span className="role-badge admin">Administrador</span><span className="roster-status"><i /> Activo</span><span>Sesión actual</span></div>
        {users.map((item) => (
          <div className="users-table-row" key={item.id}><div className="member-name"><b style={{ background: '#75a7ff' }}>{item.name?.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()}</b><strong>{item.name}</strong></div><span>{item.email}</span><span className={`role-badge ${item.role}`}>{item.role}</span><span className={item.isApproved ? 'roster-status' : 'account-pending'}><i /> {item.isApproved ? 'Activo' : 'Pendiente'}</span><div className="user-actions">{item.role !== 'admin' && <button className={item.isApproved ? 'user-approval-button suspend' : 'user-approval-button'} onClick={() => toggleUserApproval(item)}>{item.isApproved ? 'Suspender' : 'Aprobar'}</button>}<button className="icon-danger-button" aria-label={`Borrar usuario ${item.name}`} title="Borrar usuario" onClick={() => deleteUser(item)}><Trash2 size={15} /></button></div></div>
        ))}
      </article>

      {showForm && (
        <div className="athlete-form-overlay"><div className="athlete-form-panel">
          <div className="panel-header"><h2>Crear usuario</h2><button className="close-button" onClick={() => setShowForm(false)}>×</button></div>
          <form className="athlete-form" onSubmit={createUser}>
            <label><span>Nombre</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label><span>Correo electrónico</span><input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label><span>Contraseña temporal</span><input type="password" minLength="8" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
            <label><span>Rol</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="admin">Administrador</option><option value="capitan">Capitán</option><option value="tesorero">Tesorero</option><option value="lector">Lector</option></select></label>
            <label className="full-form-field"><span>ID de integrante (opcional)</span><input type="number" min="1" value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })} /></label>
            <div className="form-actions"><button type="button" className="outline-button" onClick={() => setShowForm(false)}>Cancelar</button><button type="submit" className="primary-button">Crear usuario</button></div>
          </form>
        </div></div>
      )}
    </div>
  )
}

export default App
