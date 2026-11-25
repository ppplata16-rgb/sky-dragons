const API_URL = import.meta.env.VITE_API_URL || ''

export function getToken() {
  return localStorage.getItem('sky_dragons_token')
}

export async function apiRequest(path, options = {}) {
  const token = getToken()
  const { responseType, ...requestOptions } = options
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  let response
  try {
    response = await fetch(`${API_URL}${path}`, { ...requestOptions, headers })
  } catch {
    throw new Error(`No se puede conectar con la API (${API_URL || window.location.origin}). Revisa que el servidor esté activo y que VITE_API_URL apunte al backend.`)
  }
  const contentType = response.headers.get('content-type') || ''
  const body = response.status === 204 ? null : response.ok && responseType === 'blob'
    ? await response.blob()
    : contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : null

  if (!response.ok) {
    throw new Error(body?.error || `La API respondió HTTP ${response.status} sin un error JSON. Revisa la URL del backend y que la ruta ${path} esté publicada.`)
  }
  if (body === null && responseType !== 'blob') throw new Error(`La ruta ${path} respondió correctamente, pero no devolvió JSON. Revisa que VITE_API_URL apunte a la API y no al frontend.`)

  return body
}

export const authApi = {
  login: (email, password) => apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),
  me: () => apiRequest('/api/auth/me'),
}
