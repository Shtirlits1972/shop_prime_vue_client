import { computed, reactive } from 'vue'
import { BASE_URL } from '../config/env'

type ClaimRecord = Record<string, string | number | undefined>

export interface AuthUser {
  id: number
  email: string
  role: string
  usersName: string
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  loading: boolean
  error: string | null
  initialized: boolean
}

const TOKEN_STORAGE_KEY = 'auth_token'
const API_BASE_URL = BASE_URL || ''

const ROLE_CLAIM_KEYS = [
  'role',
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
]
const NAME_CLAIM_KEYS = [
  'displayName',
  'name',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
  'unique_name',
  'sub',
]
const EMAIL_CLAIM_KEYS = [
  'email',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
]
const ID_CLAIM_KEYS = ['id']

const state = reactive<AuthState>({
  token: loadStoredToken(),
  user: null,
  loading: false,
  error: null,
  initialized: false,
})

function loadStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

function persistToken(token: string | null) {
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    }
  } catch {
    // ignore storage errors (e.g. SSR or disabled storage)
  }
}

function normalizeBaseUrl(path: string) {
  if (path.startsWith('http') || path.startsWith('//')) {
    return path
  }
  if (API_BASE_URL.endsWith('/') && path.startsWith('/')) {
    return `${API_BASE_URL}${path.slice(1)}`
  }
  if (!API_BASE_URL.endsWith('/') && !path.startsWith('/')) {
    return `${API_BASE_URL}/${path}`
  }
  return `${API_BASE_URL}${path}`
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  if (typeof globalThis !== 'undefined' && typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(padded)
    if (typeof globalThis.TextDecoder === 'function') {
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i)
      }
      return new globalThis.TextDecoder('utf-8', { fatal: false }).decode(bytes)
    }
    try {
      const escaped = binary
        .split('')
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
      return decodeURIComponent(escaped)
    } catch {
      return binary
    }
  }
  const maybeBuffer = (globalThis as Record<string, unknown> | undefined)?.Buffer as
    | { from(data: string, encoding: string): { toString(encoding: string): string } }
    | undefined
  if (maybeBuffer) {
    return maybeBuffer.from(padded, 'base64').toString('utf-8')
  }
  throw new Error('Base64 decoder is not available in the current environment')
}

function decodeToken(token: string): ClaimRecord | null {
  if (!token) {
    return null
  }
  const segments = token.split('.')
  if (segments.length < 2) {
    return null
  }
  try {
    const payloadSegment = segments[1]
    if (!payloadSegment) {
      return null
    }
    const payload = decodeBase64Url(payloadSegment)
    return JSON.parse(payload) as ClaimRecord
  } catch {
    return null
  }
}

function resolveClaim(claims: ClaimRecord | null | undefined, keys: string[]): string {
  if (!claims) {
    return ''
  }
  for (const key of keys) {
    const value = claims[key]
    if (value !== undefined && value !== null) {
      return String(value)
    }
  }
  return ''
}

function extractUserFromClaims(claims: ClaimRecord | null): AuthUser | null {
  if (!claims) {
    return null
  }

  const idValue = resolveClaim(claims, ID_CLAIM_KEYS)
  const parsedId = Number.parseInt(idValue, 10)
  if (!Number.isFinite(parsedId)) {
    return null
  }

  const email = resolveClaim(claims, EMAIL_CLAIM_KEYS)
  const role = resolveClaim(claims, ROLE_CLAIM_KEYS)
  const usersName = resolveClaim(claims, NAME_CLAIM_KEYS)

  return {
    id: parsedId,
    email,
    role,
    usersName,
  }
}

function applyToken(token: string | null) {
  state.token = token
  persistToken(token)
  if (token) {
    const claims = decodeToken(token)
    state.user = extractUserFromClaims(claims)
  } else {
    state.user = null
  }
}

function buildHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init)
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (state.token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${state.token}`)
  }
  return headers
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json()
    if (typeof data === 'string') {
      return data
    }
    if (data?.message) {
      return data.message
    }
    return JSON.stringify(data)
  } catch {
    return response.statusText || 'Не удалось выполнить запрос'
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(normalizeBaseUrl(path), {
    credentials: 'include',
    ...init,
    headers: buildHeaders(init.headers as HeadersInit | undefined),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  const contentType = response.headers.get('Content-Type') ?? ''
  if (contentType.includes('application/json')) {
    return (await response.json()) as T
  }

  return (await response.text()) as unknown as T
}

async function loginInternal(email: string, password: string) {
  const token = await request<string>('/api/Auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  applyToken(token)
}

async function registerInternal(email: string, password: string, usersName: string) {
  const token = await request<string>('/api/Auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, usersName }),
  })
  applyToken(token)
}

// async function fetchCurrentUserInternal() {
//   try {
//     const user = await request<AuthUser>('/api/Auth/me', {
//       method: 'GET',
//     })
//     state.user = user
//   } catch (error) {
//     state.user = null
//     if (state.initialized) {
//       throw error
//     }
//   }
// }

async function logoutInternal() {
  try {
    await request('/api/Auth/logout', {
      method: 'POST',
    })
  } finally {
    applyToken(null)
  }
}

export function useAuth() {
  const isAuthenticated = computed(() => !!state.user)
  const userName = computed(() => state.user?.usersName ?? '')
  const role = computed(() => state.user?.role ?? '')

  async function login(email: string, password: string) {
    state.loading = true
    state.error = null
    try {
      await loginInternal(email, password)
    } catch (error) {
      applyToken(null)
      state.error = error instanceof Error ? error.message : 'Не удалось выполнить вход'
      throw error
    } finally {
      state.loading = false
      state.initialized = true
    }
  }

  async function register(email: string, password: string, usersName: string) {
    state.loading = true
    state.error = null
    try {
      await registerInternal(email, password, usersName)
    } catch (error) {
      applyToken(null)
      state.error = error instanceof Error ? error.message : 'Не удалось выполнить регистрацию'
      throw error
    } finally {
      state.loading = false
      state.initialized = true
    }
  }

  async function logout() {
    state.loading = true
    state.error = null
    try {
      await logoutInternal()
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Не удалось выйти'
      throw error
    } finally {
      state.loading = false
      state.initialized = true
    }
  }

  async function initialize() {
    if (state.initialized) {
      return
    }
    state.loading = true
    state.error = null
    try {
      if (state.token) {
        const claims = decodeToken(state.token)
        state.user = extractUserFromClaims(claims)
      }
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Не удалось загрузить пользователя'
    } finally {
      state.loading = false
      state.initialized = true
    }
  }

  function clearError() {
    state.error = null
  }

  return {
    state,
    token: computed(() => state.token),
    user: computed(() => state.user),
    isAuthenticated,
    userName,
    role,
    isLoading: computed(() => state.loading),
    error: computed(() => state.error),
    initialized: computed(() => state.initialized),
    login,
    register,
    logout,
    initialize,
    clearError,
  }
}
