<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'

import { FilterMatchMode, FilterOperator } from '@primevue/core/api'
import PrimeButton from 'primevue/button'
import PrimeColumn, { type ColumnFilterMatchModeOptions } from 'primevue/column'
import PrimeConfirmDialog from 'primevue/confirmdialog'
import PrimeDataTable, {
  type DataTableCellEditCompleteEvent,
  type DataTableFilterMeta,
} from 'primevue/datatable'
import PrimeDialog from 'primevue/dialog'
import PrimeInputNumber from 'primevue/inputnumber'
import PrimeInputText from 'primevue/inputtext'
import PrimeSelect from 'primevue/select'
import PrimeTag from 'primevue/tag'
import { useConfirm } from 'primevue/useconfirm'

import {
  BOOLEAN_FILTER_MATCH_MODES,
  NUMBER_FILTER_MATCH_MODES,
  TEXT_FILTER_MATCH_MODES,
} from '../scripts/filter'
import { BASE_URL } from '../config/env'
import { useAuth } from '../stores/auth'
import '@/styles/data-page.css'
import '@/styles/data-table.css'

defineOptions({ name: 'UsersView' })

interface User {
  id: number
  email: string
  password: string
  role: string
  usersName: string
  isAppruved: boolean
}

type ApiUser = Record<string, unknown>

interface DropdownOption<T> {
  label: string
  value: T
}

type RoleValue = 'user' | 'admin'
type BooleanOption = boolean
type EditableField = Exclude<keyof User, 'id'>

const API_BASE = (BASE_URL ?? '').replace(/\/$/, '')
const USERS_API_URL = API_BASE ? `${API_BASE}/api/Users` : '/api/Users'

const auth = useAuth()
const users = ref<User[]>([])
const loading = ref(false)
const errorMessage = ref('')
const filters = ref<DataTableFilterMeta>(createFilters())
const selectedUser = ref<User | null>(null)
const deletingUserId = ref<number | null>(null)
const confirm = useConfirm()
const createDialogVisible = ref(false)
const editDialogVisible = ref(false)
const creatingUser = ref(false)
const updatingUser = ref(false)
const inlineUpdatingIds = ref(new Set<number>())

const ROLE_OPTIONS: DropdownOption<RoleValue>[] = [
  { label: 'user', value: 'user' },
  { label: 'admin', value: 'admin' },
]

const APPROVED_SELECT_OPTIONS: DropdownOption<BooleanOption>[] = [
  { label: 'Да', value: true },
  { label: 'Нет', value: false },
]

const STRING_EDITABLE_FIELDS = new Set<EditableField>(['email', 'password', 'usersName'])

const createForm = reactive({
  email: '',
  password: '',
  role: ROLE_OPTIONS[0]?.value ?? 'user',
  usersName: '',
  isAppruved: true as BooleanOption,
})

const editForm = reactive({
  id: 0,
  email: '',
  password: '',
  role: ROLE_OPTIONS[0]?.value ?? 'user',
  usersName: '',
  isAppruved: true as BooleanOption,
})

const hasUsers = computed(() => users.value.length > 0)

const textFilterMatchModes: ColumnFilterMatchModeOptions[] =
  TEXT_FILTER_MATCH_MODES.map(({ label, value }) => ({ label, value }))
const numberFilterMatchModes: ColumnFilterMatchModeOptions[] =
  NUMBER_FILTER_MATCH_MODES.map(({ label, value }) => ({ label, value }))
const booleanFilterMatchModes: ColumnFilterMatchModeOptions[] =
  BOOLEAN_FILTER_MATCH_MODES.map(({ label, value }) => ({ label, value }))

const approvedFilterOptions: DropdownOption<boolean | null>[] = [
  { label: 'Все', value: null },
  { label: 'Да', value: true },
  { label: 'Нет', value: false },
]

const roleFilterOptions = computed<DropdownOption<string | null>[]>(() => {
  const uniqueRoles = new Map<string, string>()
  users.value.forEach((user) => {
    if (user.role && !uniqueRoles.has(user.role)) {
      uniqueRoles.set(user.role, user.role)
    }
  })
  const options: DropdownOption<string | null>[] = [
    { label: 'Все', value: null },
  ]
  uniqueRoles.forEach((label, value) => {
    options.push({ label, value })
  })
  return options
})

function createFilters(): DataTableFilterMeta {
  return {
    id: {
      operator: FilterOperator.AND,
      constraints: [
        {
          value: null,
          matchMode: FilterMatchMode.EQUALS,
        },
      ],
    },
    email: {
      operator: FilterOperator.AND,
      constraints: [
        {
          value: null,
          matchMode: FilterMatchMode.CONTAINS,
        },
      ],
    },
    password: {
      operator: FilterOperator.AND,
      constraints: [
        {
          value: null,
          matchMode: FilterMatchMode.CONTAINS,
        },
      ],
    },
    role: {
      operator: FilterOperator.AND,
      constraints: [
        {
          value: null,
          matchMode: FilterMatchMode.EQUALS,
        },
      ],
    },
    usersName: {
      operator: FilterOperator.AND,
      constraints: [
        {
          value: null,
          matchMode: FilterMatchMode.CONTAINS,
        },
      ],
    },
    isAppruved: {
      operator: FilterOperator.AND,
      constraints: [
        {
          value: null,
          matchMode: FilterMatchMode.EQUALS,
        },
      ],
    },
  }
}

function resetFilters() {
  filters.value = createFilters()
}

function resetCreateForm() {
  createForm.email = ''
  createForm.password = ''
  createForm.role = ROLE_OPTIONS[0]?.value ?? 'user'
  createForm.usersName = ''
  createForm.isAppruved = true
}

function resetEditForm() {
  editForm.id = 0
  editForm.email = ''
  editForm.password = ''
  editForm.role = ROLE_OPTIONS[0]?.value ?? 'user'
  editForm.usersName = ''
  editForm.isAppruved = true
}

function setInlineUpdating(userId: number, updating: boolean) {
  const next = new Set(inlineUpdatingIds.value)
  if (updating) {
    next.add(userId)
  } else {
    next.delete(userId)
  }
  inlineUpdatingIds.value = next
}

function isInlineUpdating(userId: number | null | undefined): boolean {
  if (typeof userId !== 'number') {
    return false
  }
  return inlineUpdatingIds.value.has(userId)
}

function isEditableField(field: keyof User): field is EditableField {
  return field !== 'id'
}

function isStringField(field: EditableField): field is 'email' | 'password' | 'usersName' {
  return STRING_EDITABLE_FIELDS.has(field)
}

function isRoleField(field: EditableField): field is 'role' {
  return field === 'role'
}

function isBooleanField(field: EditableField): field is 'isAppruved' {
  return field === 'isAppruved'
}

function setFieldValue(target: User, field: EditableField, value: User[EditableField]) {
  if (isStringField(field)) {
    if (field === 'email') {
      target.email = value as User['email']
    } else if (field === 'password') {
      target.password = value as User['password']
    } else {
      target.usersName = value as User['usersName']
    }
    return
  }

  if (isRoleField(field)) {
    target.role = value as User['role']
    return
  }

  if (isBooleanField(field)) {
    target.isAppruved = value as User['isAppruved']
  }
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true'
  }
  if (typeof value === 'number') {
    return value !== 0
  }
  return false
}

function normalizeRole(value: unknown): RoleValue {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'user' || normalized === 'admin') {
      return normalized as RoleValue
    }
  }
  return ROLE_OPTIONS[0]?.value ?? 'user'
}

function sanitizeNonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function parseUser(record: unknown): User | null {
  if (!record || typeof record !== 'object') {
    return null
  }
  const candidate = record as ApiUser
  const idValue = candidate.id
  const id =
    typeof idValue === 'number'
      ? idValue
      : Number.parseInt(typeof idValue === 'string' ? idValue : '', 10)

  if (!Number.isFinite(id)) {
    return null
  }

  const email = typeof candidate.email === 'string' ? candidate.email : ''
  const password =
    typeof candidate.password === 'string' ? candidate.password : ''
  const role = typeof candidate.role === 'string' ? candidate.role : ''
  const usersName =
    typeof candidate.usersName === 'string' ? candidate.usersName : ''
  const isAppruved = normalizeBoolean(candidate.isAppruved)

  return {
    id,
    email,
    password,
    role,
    usersName,
    isAppruved,
  }
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Не удалось загрузить пользователей'
}

async function fetchUsers() {
  if (loading.value) {
    return
  }
  loading.value = true
  errorMessage.value = ''

  try {
    const headers: HeadersInit = {
      Accept: 'application/json',
    }

    const token = auth.token.value
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(USERS_API_URL, {
      method: 'GET',
      credentials: 'include',
      headers,
    })

    if (!response.ok) {
      throw new Error(`Ошибка загрузки пользователей: ${response.status}`)
    }

    const payload = await response.json()

    if (!Array.isArray(payload)) {
      throw new Error('Неожиданный формат данных от сервера')
    }

    const parsed = payload
      .map((item) => parseUser(item))
      .filter((item): item is User => item !== null)

    users.value = parsed
    inlineUpdatingIds.value = new Set<number>()
    if (selectedUser.value && !parsed.some((user) => user.id === selectedUser.value?.id)) {
      selectedUser.value = null
    }
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error)
    users.value = []
    console.error('Failed to load users', error)
  } finally {
    loading.value = false
  }
}

function handleRefreshClick() {
  fetchUsers().catch(() => {
    /* error already handled */
  })
}

function handleResetFiltersClick() {
  resetFilters()
}

function requestDeleteSelectedUser() {
  if (!selectedUser.value || deletingUserId.value !== null) {
    return
  }

  const target = { ...selectedUser.value }

  confirm.require({
    header: 'Удаление пользователя',
    message: 'Хотите удалить выбранного пользователя?',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Удалить',
    rejectLabel: 'Отмена',
    acceptClass: 'p-button-danger',
    accept: () => deleteUser(target),
  })
}

async function deleteUser(user: User) {
  deletingUserId.value = user.id
  try {
    const headers: HeadersInit = {
      Accept: '*/*',
    }
    const token = auth.token.value
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(
      `${USERS_API_URL}/${encodeURIComponent(String(user.id))}`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers,
      },
    )

    if (!response.ok) {
      throw new Error(`Ошибка удаления пользователя: ${response.status}`)
    }

    users.value = users.value.filter((item) => item.id !== user.id)
    if (selectedUser.value?.id === user.id) {
      selectedUser.value = null
    }
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error)
    console.error('Failed to delete user', error)
  } finally {
    deletingUserId.value = null
  }
}

function openCreateDialog() {
  if (creatingUser.value) {
    return
  }
  resetCreateForm()
  createDialogVisible.value = true
}

async function submitCreateUser() {
  if (creatingUser.value) {
    return
  }

  const payload = {
    email: createForm.email.trim(),
    password: createForm.password.trim(),
    role: createForm.role,
    usersName: createForm.usersName.trim(),
    isAppruved: createForm.isAppruved,
  }

  if (!payload.email || !payload.password || !payload.usersName) {
    errorMessage.value = 'Заполните Email, Имя и Пароль'
    return
  }

  creatingUser.value = true
  errorMessage.value = ''

  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
    const token = auth.token.value
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(USERS_API_URL, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Ошибка добавления пользователя: ${response.status}`)
    }

    let createdUser: User | null = null
    try {
      const responsePayload = await response.json()
      createdUser = parseUser({
        ...responsePayload,
        password: responsePayload?.password ?? payload.password,
      })
    } catch {
      // ignore parse errors, fall back to manual build
    }

    if (!createdUser) {
      createdUser = {
        id: Date.now(),
        email: payload.email,
        password: payload.password,
        role: payload.role,
        usersName: payload.usersName,
        isAppruved: payload.isAppruved,
      }
    }

    await fetchUsers()

    const matchingUser =
      users.value.find((user) => user.id === createdUser?.id) ??
      users.value.find((user) => user.email === createdUser?.email)

    selectedUser.value = matchingUser ?? null
    createDialogVisible.value = false
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error)
    console.error('Failed to create user', error)
  } finally {
    creatingUser.value = false
  }
}

const isCreateFormValid = computed(() => {
  return (
    createForm.email.trim().length > 0 &&
    createForm.password.trim().length > 0 &&
    createForm.usersName.trim().length > 0
  )
})

function handleCreateDialogHide() {
  if (!creatingUser.value) {
    resetCreateForm()
  }
}

function openEditDialog() {
  if (!selectedUser.value || updatingUser.value) {
    return
  }
  const source = selectedUser.value
  editForm.id = source.id
  editForm.email = source.email
  editForm.password = source.password
  editForm.role = (source.role as RoleValue) ?? ROLE_OPTIONS[0]?.value ?? 'user'
  editForm.usersName = source.usersName
  editForm.isAppruved = source.isAppruved
  errorMessage.value = ''
  editDialogVisible.value = true
}

const isEditFormValid = computed(() => {
  return (
    editForm.email.trim().length > 0 &&
    editForm.password.trim().length > 0 &&
    editForm.usersName.trim().length > 0
  )
})

async function submitEditUser() {
  if (updatingUser.value || !selectedUser.value) {
    return
  }

  const payload: User = {
    id: editForm.id,
    email: editForm.email.trim(),
    password: editForm.password.trim(),
    role: editForm.role,
    usersName: editForm.usersName.trim(),
    isAppruved: editForm.isAppruved,
  }

  if (!payload.email || !payload.password || !payload.usersName) {
    errorMessage.value = 'Заполните Email, Имя и Пароль'
    return
  }

  updatingUser.value = true
  errorMessage.value = ''

  try {
    await persistUserUpdate(payload)
    await fetchUsers()

    const updatedUser =
      users.value.find((user) => user.id === payload.id) ??
      users.value.find((user) => user.email === payload.email)

    selectedUser.value = updatedUser ?? null
    editDialogVisible.value = false
  } catch (error) {
    errorMessage.value = resolveErrorMessage(error)
    console.error('Failed to update user', error)
  } finally {
    updatingUser.value = false
  }
}

function handleEditDialogHide() {
  if (!updatingUser.value) {
    resetEditForm()
  }
}

async function persistUserUpdate(payload: User) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: '*/*',
  }
  const token = auth.token.value
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(
    `${USERS_API_URL}/${encodeURIComponent(String(payload.id))}`,
    {
      method: 'PUT',
      credentials: 'include',
      headers,
      body: JSON.stringify(payload),
    },
  )

  if (!response.ok) {
    throw new Error(`Ошибка обновления пользователя: ${response.status}`)
  }
}

async function handleCellEditComplete(event: DataTableCellEditCompleteEvent<User>) {
  const row = event.data
  if (!row || typeof row.id !== 'number') {
    return
  }

  const candidateField = event.field as keyof User
  if (!isEditableField(candidateField)) {
    return
  }

  const field: EditableField = candidateField
  let sanitizedValue: User[EditableField]
  let previousNormalized: User[EditableField]

  if (isRoleField(field)) {
    const previousRole = row[field] as User['role']
    const normalizedRole = normalizeRole(event.newValue)
    if (!ROLE_OPTIONS.some((option) => option.value === normalizedRole)) {
      setFieldValue(row, field, normalizeRole(previousRole) as User[EditableField])
      errorMessage.value = 'Выберите корректную роль'
      return
    }
    sanitizedValue = normalizedRole as User[EditableField]
    previousNormalized = normalizeRole(previousRole) as User[EditableField]
  } else if (isBooleanField(field)) {
    const previousBoolean = row[field] as User['isAppruved']
    sanitizedValue = normalizeBoolean(event.newValue) as User[EditableField]
    previousNormalized = normalizeBoolean(previousBoolean) as User[EditableField]
  } else if (isStringField(field)) {
    const previousStringValue = row[field] as string
    const normalizedString = sanitizeNonEmptyString(event.newValue)
    const previousString = sanitizeNonEmptyString(previousStringValue)
    if (!normalizedString) {
      setFieldValue(row, field, previousString as User[EditableField])
      errorMessage.value = 'Поле не может быть пустым'
      return
    }
    sanitizedValue = normalizedString as User[EditableField]
    previousNormalized = previousString as User[EditableField]
  } else {
    return
  }

  if (sanitizedValue === previousNormalized) {
    setFieldValue(row, field, previousNormalized)
    return
  }

  const updatedUser: User = {
    ...row,
    [field]: sanitizedValue,
  }

  setFieldValue(row, field, sanitizedValue)
  setInlineUpdating(row.id, true)
  errorMessage.value = ''

  try {
    await persistUserUpdate(updatedUser)
    const currentIndex = users.value.findIndex(({ id }) => id === row.id)
    if (currentIndex !== -1) {
      users.value.splice(currentIndex, 1, { ...updatedUser })
      const currentUser = users.value[currentIndex]
      if (selectedUser.value?.id === row.id) {
        selectedUser.value = currentUser ?? null
      }
    }
  } catch (error) {
    setFieldValue(row, field, previousNormalized)
    errorMessage.value = resolveErrorMessage(error)
    console.error('Failed to update user via cell edit', error)
  } finally {
    setInlineUpdating(row.id, false)
  }
}

onMounted(() => {
  if (auth.token.value) {
    fetchUsers().catch(() => {
      /* error already handled */
    })
  }
})

watch(
  () => auth.token.value,
  (token, previousToken) => {
    if (token && token !== previousToken) {
      fetchUsers().catch(() => {
        /* error already handled */
      })
    }
    if (!token) {
      users.value = []
      selectedUser.value = null
      resetFilters()
      createDialogVisible.value = false
      editDialogVisible.value = false
      resetCreateForm()
      resetEditForm()
      inlineUpdatingIds.value = new Set<number>()
    }
  },
)

watch(users, (current) => {
  const selected = selectedUser.value
  if (!selected) {
    return
  }
  const matched = current.find((user) => user.id === selected.id)
  if (!matched) {
    selectedUser.value = null
    return
  }
  if (matched !== selected) {
    selectedUser.value = matched
  }
})
</script>

<template>
  <section class="users-view data-page">
    <header class="data-page__header">
      <div>
        <h1 class="data-page__title">Users</h1>
        <p class="data-page__subtitle">Список зарегистрированных пользователей</p>
      </div>
    </header>

    <PrimeDataTable v-if="hasUsers || loading" v-model:filters="filters" v-model:selection="selectedUser"
      editMode="cell" filterDisplay="menu" :value="users" dataKey="id" class="users-view__table" paginator :rows="10"
      :rowsPerPageOptions="[5, 10, 20, 50]" :loading="loading" selectionMode="single" :metaKeySelection="false"
      @cell-edit-complete="handleCellEditComplete" sortMode="multiple" stripedRows showGridlines
      responsiveLayout="scroll" tableStyle="min-width: 60rem" size="small">
      <template #header>
        <div class="users-view__table-header">
          <PrimeButton
            class="users-view__button"
            label="Добавить"
            icon="pi pi-plus"
            severity="success"
            :disabled="loading || creatingUser"
            @click="openCreateDialog"
          />
          <PrimeButton
            class="users-view__button"
            label="Удалить"
            icon="pi pi-trash"
            severity="danger"
            :disabled="!selectedUser || deletingUserId !== null"
            :loading="deletingUserId !== null"
            @click="requestDeleteSelectedUser"
          />
          <PrimeButton
            class="users-view__button"
            label="Редактировать"
            icon="pi pi-pencil"
            severity="info"
            :disabled="!selectedUser || updatingUser || loading"
            @click="openEditDialog"
          />
          <PrimeButton
            class="users-view__button"
            label="Обновить"
            icon="pi pi-refresh"
            :loading="loading"
            @click="handleRefreshClick"
          />
          <PrimeButton
            class="users-view__button"
            label="Сбросить фильтры"
            icon="pi pi-filter-slash"
            severity="secondary"
            :disabled="loading"
            @click="handleResetFiltersClick"
          />
        </div>
      </template>

      <PrimeColumn field="id" header="ID" sortable filter dataType="numeric" showFilterMenu showClearButton
        showApplyButton :filterMatchModeOptions="numberFilterMatchModes" style="width: 6rem">
        <template #filter="{ filterModel }">
          <PrimeInputNumber v-model="filterModel.value" mode="decimal" :useGrouping="false" :minFractionDigits="0"
            inputClass="w-full" placeholder="ID" @keydown.enter.prevent />
        </template>
      </PrimeColumn>

      <PrimeColumn field="email" header="Email" sortable filter showFilterMenu showClearButton showApplyButton
        :filterMatchModeOptions="textFilterMatchModes" editable>
        <template #filter="{ filterModel }">
          <PrimeInputText v-model.trim="filterModel.value" class="w-full" placeholder="Email" @keydown.enter.prevent />
        </template>
        <template #editor="{ data, field }">
          <PrimeInputText v-model.trim="data[field]" class="w-full" :disabled="isInlineUpdating(data?.id)" autofocus />
        </template>
      </PrimeColumn>

      <PrimeColumn field="password" header="Password" sortable filter showFilterMenu showClearButton showApplyButton
        :filterMatchModeOptions="textFilterMatchModes" editable>
        <template #filter="{ filterModel }">
          <PrimeInputText v-model.trim="filterModel.value" class="w-full" placeholder="Пароль" @keydown.enter.prevent />
        </template>
        <template #editor="{ data, field }">
          <PrimeInputText v-model.trim="data[field]" class="w-full" :disabled="isInlineUpdating(data?.id)" autofocus />
        </template>
      </PrimeColumn>

      <PrimeColumn field="role" header="Role" sortable filter showFilterMenu showClearButton showApplyButton
        :filterMatchModeOptions="booleanFilterMatchModes" style="width: 10rem" editable>
        <template #filter="{ filterModel }">
          <PrimeSelect v-model="filterModel.value" :options="roleFilterOptions" optionLabel="label" optionValue="value"
            class="w-full" placeholder="Выберите роль" />
        </template>
        <template #body="{ data }">
          {{ data.role || '—' }}
        </template>
        <template #editor="{ data, field }">
          <PrimeSelect v-model="data[field]" :options="ROLE_OPTIONS" optionLabel="label" optionValue="value"
            class="w-full" :disabled="isInlineUpdating(data?.id)" autofocus />
        </template>
      </PrimeColumn>

      <PrimeColumn field="usersName" header="Name" sortable filter showFilterMenu showClearButton showApplyButton
        :filterMatchModeOptions="textFilterMatchModes" editable>
        <template #filter="{ filterModel }">
          <PrimeInputText v-model.trim="filterModel.value" class="w-full" placeholder="Имя" @keydown.enter.prevent />
        </template>
        <template #editor="{ data, field }">
          <PrimeInputText v-model.trim="data[field]" class="w-full" :disabled="isInlineUpdating(data?.id)" autofocus />
        </template>
      </PrimeColumn>

      <PrimeColumn field="isAppruved" header="Approved" sortable filter dataType="boolean" showFilterMenu
        showClearButton showApplyButton :filterMatchModeOptions="booleanFilterMatchModes" style="width: 9rem" editable>
        <template #body="{ data }">
          <PrimeTag :value="data.isAppruved ? 'Да' : 'Нет'" :severity="data.isAppruved ? 'success' : 'danger'" />
        </template>
        <template #filter="{ filterModel }">
          <PrimeSelect v-model="filterModel.value" :options="approvedFilterOptions" optionLabel="label"
            optionValue="value" class="w-full" placeholder="Статус" />
        </template>
        <template #editor="{ data, field }">
          <PrimeSelect v-model="data[field]" :options="APPROVED_SELECT_OPTIONS" optionLabel="label" optionValue="value"
            class="w-full" :disabled="isInlineUpdating(data?.id)" autofocus />
        </template>
      </PrimeColumn>
    </PrimeDataTable>
    <PrimeConfirmDialog />
    <PrimeDialog v-model:visible="createDialogVisible" header="Добавление пользователя" modal
      :style="{ width: '28rem' }" :closable="!creatingUser" class="users-view__dialog" @hide="handleCreateDialogHide">
      <form class="users-view__form" @submit.prevent="submitCreateUser">
        <div class="users-view__form-field">
          <label class="users-view__label" for="create-user-email">Email</label>
          <PrimeInputText id="create-user-email" v-model.trim="createForm.email" type="email" :disabled="creatingUser"
            placeholder="email@example.com" />
        </div>

        <div class="users-view__form-field">
          <label class="users-view__label" for="create-user-name">Имя</label>
          <PrimeInputText id="create-user-name" v-model.trim="createForm.usersName" :disabled="creatingUser"
            placeholder="Имя пользователя" />
        </div>

        <div class="users-view__form-field">
          <label class="users-view__label" for="create-user-password">Пароль</label>
          <PrimeInputText id="create-user-password" v-model.trim="createForm.password" type="password"
            :disabled="creatingUser" placeholder="Пароль" />
        </div>

        <div class="users-view__form-field">
          <label class="users-view__label" for="create-user-role">Роль</label>
          <PrimeSelect id="create-user-role" v-model="createForm.role" :options="ROLE_OPTIONS" optionLabel="label"
            optionValue="value" class="w-full" :disabled="creatingUser" />
        </div>

        <div class="users-view__form-field">
          <label class="users-view__label" for="create-user-approved">Статус</label>
          <PrimeSelect id="create-user-approved" v-model="createForm.isAppruved" :options="APPROVED_SELECT_OPTIONS"
            optionLabel="label" optionValue="value" class="w-full" :disabled="creatingUser" />
        </div>

        <div class="users-view__dialog-footer">
          <PrimeButton type="button" label="Отмена" icon="pi pi-times" text severity="secondary"
            :disabled="creatingUser" @click="createDialogVisible = false" />
          <PrimeButton type="submit" label="Добавить" icon="pi pi-check" :disabled="creatingUser || !isCreateFormValid"
            :loading="creatingUser" />
        </div>
      </form>
    </PrimeDialog>
    <PrimeDialog v-model:visible="editDialogVisible" header="Редактирование пользователя" modal
      :style="{ width: '28rem' }" :closable="!updatingUser" class="users-view__dialog" @hide="handleEditDialogHide">
      <form class="users-view__form" @submit.prevent="submitEditUser">
        <div class="users-view__form-field">
          <label class="users-view__label" for="edit-user-email">Email</label>
          <PrimeInputText id="edit-user-email" v-model.trim="editForm.email" type="email" :disabled="updatingUser"
            placeholder="email@example.com" />
        </div>

        <div class="users-view__form-field">
          <label class="users-view__label" for="edit-user-name">Имя</label>
          <PrimeInputText id="edit-user-name" v-model.trim="editForm.usersName" :disabled="updatingUser"
            placeholder="Имя пользователя" />
        </div>

        <div class="users-view__form-field">
          <label class="users-view__label" for="edit-user-password">Пароль</label>
          <PrimeInputText id="edit-user-password" v-model.trim="editForm.password" type="password"
            :disabled="updatingUser" placeholder="Пароль" />
        </div>

        <div class="users-view__form-field">
          <label class="users-view__label" for="edit-user-role">Роль</label>
          <PrimeSelect id="edit-user-role" v-model="editForm.role" :options="ROLE_OPTIONS" optionLabel="label"
            optionValue="value" class="w-full" :disabled="updatingUser" />
        </div>

        <div class="users-view__form-field">
          <label class="users-view__label" for="edit-user-approved">Статус</label>
          <PrimeSelect id="edit-user-approved" v-model="editForm.isAppruved" :options="APPROVED_SELECT_OPTIONS"
            optionLabel="label" optionValue="value" class="w-full" :disabled="updatingUser" />
        </div>

        <div class="users-view__dialog-footer">
          <PrimeButton type="button" label="Отмена" icon="pi pi-times" text severity="secondary"
            :disabled="updatingUser" @click="editDialogVisible = false" />
          <PrimeButton type="submit" label="Сохранить" icon="pi pi-check" :disabled="updatingUser || !isEditFormValid"
            :loading="updatingUser" />
        </div>
      </form>
    </PrimeDialog>

    <p v-if="!loading && !errorMessage && !hasUsers" class="users-view__message">
      Пользователи не найдены.
    </p>

    <p v-if="!loading && errorMessage" class="users-view__message users-view__message--error">
      {{ errorMessage }}
    </p>
  </section>
</template>

<style scoped>
.users-view__table {
  min-height: 24rem;
}

.users-view__table-header {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: flex-start;
  padding: 0.25rem 0;
}

.users-view__message {
  margin: 0;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(226, 232, 240, 0.5);
  color: #0f172a;
}

.users-view__message--error {
  border-color: rgba(248, 113, 113, 0.4);
  background: rgba(254, 226, 226, 0.65);
  color: #b91c1c;
}

.users-view__dialog {
  max-width: 100%;
}

.users-view__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.users-view__form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.users-view__label {
  font-weight: 600;
  color: #0f172a;
}

.users-view__dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
