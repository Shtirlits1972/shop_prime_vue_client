<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import PrimeButton from 'primevue/button'
import PrimeColumn from 'primevue/column'
import PrimeConfirmDialog from 'primevue/confirmdialog'
import PrimeDataTable, {
  type DataTableCellEditCompleteEvent,
  type DataTableFilterMeta,
} from 'primevue/datatable'
import PrimeDialog from 'primevue/dialog'
import PrimeDatePicker from 'primevue/datepicker'
import PrimeInputNumber from 'primevue/inputnumber'
import PrimeInputText from 'primevue/inputtext'
import PrimeMultiSelect from 'primevue/multiselect'
import PrimeSelect from 'primevue/select'
import PrimeToast from 'primevue/toast'
import type { ColumnFilterMatchModeOptions } from 'primevue/column'
import { FilterMatchMode, FilterOperator } from '@primevue/core/api'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'

import { BASE_URL } from '../config/env'
import {
  NUMBER_FILTER_MATCH_MODES,
  TEXT_FILTER_MATCH_MODES,
} from '../scripts/filter'
import { useAuth } from '../stores/auth'
import '@/styles/data-page.css'
import '@/styles/data-table.css'

defineOptions({ name: 'OrderHeadView' })

const API_BASE = (BASE_URL ?? '').replace(/\/$/, '')

function buildApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return API_BASE ? `${API_BASE}${normalized}` : normalized
}

interface OrderRow {
  id: number
  userId: number | null
  usersName: string
  orderNumber: string
  orderDate: Date | null
  totalPrice: number
}

type RawOrderHead = Record<string, unknown>

interface UserOption {
  value: number
  label: string
}

const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const auth = useAuth()

const orders = ref<OrderRow[]>([])
const loading = ref(false)
const errorMessage = ref('')
const filters = ref<DataTableFilterMeta>(createFilters())
const defaultFiltersSnapshot = ref(JSON.stringify(filters.value))
const selectedOrder = ref<OrderRow | null>(null)
const deletingOrder = ref(false)

const users = ref<UserOption[]>([])
const usersLoading = ref(false)
const usersLoaded = ref(false)

const dateDialogVisible = ref(false)
const dateDialogSaving = ref(false)
const editingDateOrder = ref<OrderRow | null>(null)
const tempDateValue = ref<Date | null>(null)

const isAdmin = computed(() => auth.role.value === 'admin')
const hasActiveFilters = computed(
  () => JSON.stringify(filters.value) !== defaultFiltersSnapshot.value,
)
const currentEditingOrder = computed(() => editingDateOrder.value)

const textFilterOptions: ColumnFilterMatchModeOptions[] = TEXT_FILTER_MATCH_MODES.map(
  ({ label, value }) => ({ label, value }) as ColumnFilterMatchModeOptions,
)
const numberFilterOptions: ColumnFilterMatchModeOptions[] = NUMBER_FILTER_MATCH_MODES.map(
  ({ label, value }) => ({ label, value }) as ColumnFilterMatchModeOptions,
)

const userFilterOptions = computed(() => {
  const seen = new Set<string>()
  const options: { label: string; value: string }[] = []

  for (const order of orders.value) {
    const label = (order.usersName ?? '').trim()
    if (!label) {
      continue
    }
    if (seen.has(label)) {
      continue
    }
    seen.add(label)
    options.push({ label, value: label })
  }

  return options
})

const userSelectOptions = computed(() => {
  const map = new Map<number, string>()
  users.value.forEach((option) => {
    map.set(option.value, option.label)
  })

  for (const order of orders.value) {
    if (typeof order.userId === 'number' && Number.isFinite(order.userId)) {
      if (!map.has(order.userId)) {
        const label = (order.usersName ?? '').trim() || `ID ${order.userId}`
        map.set(order.userId, label)
      }
    }
  }

  return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
})

function createFilters(): DataTableFilterMeta {
  return {
    id: {
      operator: FilterOperator.AND,
      constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }],
    },
    orderNumber: {
      operator: FilterOperator.AND,
      constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }],
    },
    orderDate: {
      operator: FilterOperator.AND,
      constraints: [{ value: null, matchMode: FilterMatchMode.DATE_IS }],
    },
    usersName: {
      operator: FilterOperator.AND,
      constraints: [{ value: [], matchMode: FilterMatchMode.IN }],
    },
    totalPrice: {
      operator: FilterOperator.AND,
      constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }],
    },
  }
}

function resetFilters(): void {
  filters.value = createFilters()
  defaultFiltersSnapshot.value = JSON.stringify(filters.value)
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

function parseString(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString()
  }
  return ''
}

function parseDate(value: unknown): Date | null {
  if (!value) {
    return null
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }
  return null
}

function normalizeOrderHead(payload: unknown): OrderRow | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const record = payload as RawOrderHead

  const id = parseNumber(record.id ?? record.Id)
  if (!id) {
    return null
  }

  const userId = parseNumber(record.userId ?? record.UserId)
  const orderNumber = parseString(record.orderNumber ?? record.OrderNumber)
  const usersName = parseString(record.usersName ?? record.UsersName)
  const totalPrice = parseNumber(record.totalPrice ?? record.TotalPrice) ?? 0
  const orderDate = parseDate(
    record.orderDate ?? record.OrderDate ?? record.orderData ?? record.OrderData,
  )

  return {
    id,
    userId: userId ?? null,
    usersName,
    orderNumber,
    orderDate,
    totalPrice,
  }
}

function formatOrderDate(date: Date | null): string {
  if (!date) {
    return '—'
  }
  return new Intl.DateTimeFormat('ru-RU').format(date)
}

function formatTotalPrice(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

async function fetchOrders(): Promise<void> {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(buildApiUrl('/api/OrderHead'), {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json, text/plain' },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const payload = (await response.json()) as unknown
    if (!Array.isArray(payload)) {
      throw new Error('Неправильный формат ответа сервера.')
    }

    const normalized = payload
      .map((item) => normalizeOrderHead(item))
      .filter((item): item is OrderRow => item !== null)

    orders.value = normalized

    if (selectedOrder.value) {
      const next = normalized.find((row) => row.id === selectedOrder.value?.id)
      selectedOrder.value = next ?? null
    }
  } catch (error) {
    orders.value = []
    selectedOrder.value = null
    errorMessage.value =
      error instanceof Error ? error.message : 'Не удалось получить список заказов.'
  } finally {
    loading.value = false
  }
}

async function ensureUsers(): Promise<void> {
  if (!isAdmin.value || usersLoaded.value || usersLoading.value) {
    return
  }
  usersLoading.value = true
  try {
    const response = await fetch(buildApiUrl('/api/Users'), {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json, text/plain' },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const payload = (await response.json()) as unknown
    if (!Array.isArray(payload)) {
      throw new Error('Невалидный формат списка пользователей.')
    }

    users.value = payload
      .map((item) => {
        const id = parseNumber((item as Record<string, unknown>).id)
        if (!id) {
          return null
        }
        const label = parseString((item as Record<string, unknown>).usersName)
        return {
          value: id,
          label: label.trim() || `ID ${id}`,
        }
      })
      .filter((item): item is UserOption => item !== null)

    usersLoaded.value = true
  } catch (error) {
    users.value = []
    usersLoaded.value = false
    const message = error instanceof Error ? error.message : 'Не удалось загрузить пользователей.'
    toast.add({
      severity: 'warn',
      summary: 'Ошибка загрузки пользователей',
      detail: message,
      life: 4000,
    })
  } finally {
    usersLoading.value = false
  }
}

function openDateDialog(row: OrderRow): void {
  editingDateOrder.value = { ...row }
  tempDateValue.value = row.orderDate ? new Date(row.orderDate) : null
  dateDialogVisible.value = true
}

function cancelDateEdit(): void {
  tempDateValue.value = null
  editingDateOrder.value = null
  dateDialogVisible.value = false
  dateDialogSaving.value = false
}

async function saveDateEdit(): Promise<void> {
  const target = editingDateOrder.value
  if (!target) {
    cancelDateEdit()
    return
  }

  dateDialogSaving.value = true
  try {
    const nextDate = tempDateValue.value
    const updated: OrderRow = {
      ...target,
      orderDate: nextDate ? new Date(nextDate) : null,
    }

    await updateOrder(updated)
    toast.add({
      severity: 'success',
      summary: 'Дата обновлена',
      detail: `Дата заказа ${updated.orderNumber || updated.id} обновлена.`,
      life: 3000,
    })
    cancelDateEdit()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось обновить дату заказа.'
    toast.add({
      severity: 'error',
      summary: 'Ошибка обновления',
      detail: message,
      life: 4000,
    })
    dateDialogSaving.value = false
  }
}

async function updateOrder(row: OrderRow): Promise<void> {
  const payload = {
    id: row.id,
    userId:
      typeof row.userId === 'number' && Number.isFinite(row.userId) ? row.userId : 0,
    usersName: (row.usersName ?? '').trim(),
    orderNumber: (row.orderNumber ?? '').trim(),
    orderData: row.orderDate ? row.orderDate.toISOString() : null,
    totalPrice: Number.isFinite(row.totalPrice) ? row.totalPrice : 0,
  }

  const response = await fetch(buildApiUrl('/api/OrderHead'), {
    method: 'PUT',
    credentials: 'include',
    headers: {
      Accept: 'application/json, text/plain',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  let normalized: OrderRow | null = null
  if (response.status !== 204) {
    try {
      const raw = await response.json()
      normalized = normalizeOrderHead(raw) ?? { ...row }
    } catch {
      normalized = { ...row }
    }
  } else {
    normalized = { ...row }
  }

  const index = orders.value.findIndex((item) => item.id === normalized.id)
  if (index >= 0) {
    orders.value.splice(index, 1, normalized)
  } else {
    orders.value.push(normalized)
  }
  selectedOrder.value = orders.value.find((item) => item.id === normalized.id) ?? null
}

async function handleCellEditComplete(
  event: DataTableCellEditCompleteEvent<OrderRow>,
): Promise<void> {
  if (!isAdmin.value) {
    return
  }
  const { data, field } = event
  if (!data || !field) {
    return
  }

  const row = orders.value.find((item) => item.id === data.id)
  if (!row) {
    return
  }

  try {
    if (field === 'orderNumber') {
      row.orderNumber = (data.orderNumber ?? '').trim()
    } else if (field === 'totalPrice') {
      row.totalPrice = Number.isFinite(data.totalPrice) ? data.totalPrice : row.totalPrice
    } else if (field === 'userId') {
      row.userId = data.userId
      const option = userSelectOptions.value.find((item) => item.value === data.userId)
      if (option) {
        row.usersName = option.label
      }
    }

    await updateOrder(row)
    toast.add({
      severity: 'success',
      summary: 'Заказ обновлён',
      detail: `Изменения для заказа ${row.orderNumber || row.id} сохранены.`,
      life: 2500,
    })
  } catch (error) {
    await fetchOrders()
    const message = error instanceof Error ? error.message : 'Не удалось сохранить изменения.'
    toast.add({
      severity: 'error',
      summary: 'Ошибка сохранения',
      detail: message,
      life: 4000,
    })
  }
}

function handleCreateOrder(): void {
  router.push({ name: 'OrderDetail' })
}

function handleEditSelectedOrder(): void {
  if (!selectedOrder.value) {
    return
  }
  openOrderDetail(selectedOrder.value.id)
}

function handleRowDoubleClick(event: { data?: OrderRow }): void {
  if (!event?.data) {
    return
  }
  openOrderDetail(event.data.id)
}

function openOrderDetail(orderId: number): void {
  router.push({
    name: 'OrderDetail',
    params: { OrderId: orderId },
  })
}

async function deleteOrder(orderId: number): Promise<void> {
  deletingOrder.value = true
  try {
    const response = await fetch(buildApiUrl(`/api/OrderHead/${orderId}`), {
      method: 'DELETE',
      credentials: 'include',
      headers: { Accept: 'application/json, text/plain' },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    orders.value = orders.value.filter((order) => order.id !== orderId)
    selectedOrder.value = null
    toast.add({
      severity: 'success',
      summary: 'Заказ удалён',
      detail: `Заказ ${orderId} удалён.`,
      life: 2500,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось удалить заказ.'
    toast.add({
      severity: 'error',
      summary: 'Ошибка удаления',
      detail: message,
      life: 4000,
    })
  } finally {
    deletingOrder.value = false
  }
}

function requestDeleteSelectedOrder(): void {
  if (!selectedOrder.value) {
    return
  }

  const target = selectedOrder.value
  confirm.require({
    header: 'Удаление заказа',
    message: `Удалить заказ ${target.orderNumber || target.id}?`,
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    rejectLabel: 'Отмена',
    acceptLabel: 'Удалить',
    accept: () => deleteOrder(target.id),
  })
}

function handleRefreshClick(): void {
  void fetchOrders()
}

function handleResetFiltersClick(): void {
  resetFilters()
}

onMounted(() => {
  void fetchOrders()
  void ensureUsers()
})

watch(
  () => isAdmin.value,
  (next) => {
    if (next) {
      void ensureUsers()
    }
  },
)
</script>

<template>
  <section class="order-head">
    <PrimeToast />
    <PrimeConfirmDialog />

    <header class="order-head__header">
      <div>
        <h1 class="order-head__title">Заказы</h1>
        <p class="order-head__subtitle">Управление заказами и назначение клиентов.</p>
      </div>

    </header>

    <PrimeDataTable v-model:filters="filters" v-model:selection="selectedOrder" :value="orders" :loading="loading"
      dataKey="id" paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]" selectionMode="single" filterDisplay="menu"
      :globalFilterFields="['orderNumber', 'usersName']" class="order-head__table" editMode="cell"
      responsiveLayout="scroll" @cell-edit-complete="handleCellEditComplete" @row-dblclick="handleRowDoubleClick">

      <template #header>
        <div class="order-head__header-actions">
          <PrimeButton label="Добавить" icon="pi pi-plus" severity="success" :disabled="loading"
            @click="handleCreateOrder" />
          <PrimeButton label="Удалить" icon="pi pi-trash" severity="danger" :disabled="!selectedOrder || deletingOrder"
            :loading="deletingOrder" @click="requestDeleteSelectedOrder" />
          <PrimeButton label="Редактировать" icon="pi pi-pencil" severity="info" :disabled="!selectedOrder"
            @click="handleEditSelectedOrder" />
          <PrimeButton label="Обновить" icon="pi pi-refresh" severity="secondary" :loading="loading"
            @click="handleRefreshClick" />
          <PrimeButton label="Сбросить фильтры" icon="pi pi-filter-slash" severity="secondary" text
            :disabled="!hasActiveFilters" @click="handleResetFiltersClick" />
        </div>
      </template>


      <template #empty>
        <span v-if="loading">Загрузка заказов...</span>
        <span v-else>Заказы не найдены.</span>
      </template>

      <PrimeColumn field="id" header="ID" sortable dataType="numeric" style="width: 6rem">
        <template #filter="{ filterModel }">
          <PrimeInputNumber v-model="filterModel.value" inputClass="w-full" :useGrouping="false" placeholder="ID"
            @keydown.enter.prevent />
        </template>
      </PrimeColumn>

      <PrimeColumn field="orderNumber" header="Номер заказа" sortable filter showFilterMenu showApplyButton
        showClearButton :filterMatchModeOptions="textFilterOptions" style="min-width: 14rem" :editable="isAdmin">
        <template #filter="{ filterModel }">
          <PrimeInputText v-model="filterModel.value" class="w-full" placeholder="Номер заказа"
            @keydown.enter.prevent />
        </template>
        <template #editor="{ data }">
          <PrimeInputText v-model.trim="data.orderNumber" class="w-full" />
        </template>
      </PrimeColumn>

      <PrimeColumn field="orderDate" header="Дата заказа" sortable dataType="date" filter showFilterMenu showApplyButton
        showClearButton style="min-width: 10rem">
        <template #body="{ data }">
          <button v-if="isAdmin" type="button" class="order-head__date-button" @click="openDateDialog(data)">
            {{ formatOrderDate(data.orderDate) }}
          </button>
          <span v-else>
            {{ formatOrderDate(data.orderDate) }}
          </span>
        </template>
        <template #filter="{ filterModel }">
          <PrimeDatePicker v-model="filterModel.value" showIcon dateFormat="dd.mm.yy" :manualInput="true"
            appendTo="body" placeholder="Выберите дату" class="w-full" />
        </template>
      </PrimeColumn>

      <PrimeColumn field="userId" header="пользователь" sortable filter filterField="usersName" sortField="usersName"
        :showFilterMatchModes="false" :showFilterOperators="false" style="min-width: 14rem">
        <template #body="{ data }">
          {{ data.usersName || '-' }}
        </template>
        <template #filter="{ filterModel }">
          <PrimeMultiSelect v-model="filterModel.value" :options="userFilterOptions" optionLabel="label"
            optionValue="value" display="chip" class="w-full" placeholder="выберите пользователя"
            :showToggleAll="false" />
        </template>

        <template #editor="{ data }">
          <PrimeSelect v-model="data.userId" :options="userSelectOptions" optionLabel="label" optionValue="value"
            class="w-full" :loading="usersLoading" :disabled="!isAdmin" />
        </template>
      </PrimeColumn>
      <PrimeColumn field="totalPrice" header="Сумма" sortable dataType="numeric" filter showFilterMenu showApplyButton
        showClearButton :filterMatchModeOptions="numberFilterOptions" style="min-width: 11rem" :editable="isAdmin">
        <template #body="{ data }">
          {{ formatTotalPrice(data.totalPrice) }}
        </template>
        <template #filter="{ filterModel }">
          <PrimeInputNumber v-model="filterModel.value" inputClass="w-full" mode="decimal" :useGrouping="false"
            :maxFractionDigits="2" placeholder="Сумма" @keydown.enter.prevent />
        </template>
        <template #editor="{ data }">
          <PrimeInputNumber v-model="data.totalPrice" mode="decimal" :useGrouping="false" :maxFractionDigits="2"
            class="w-full" />
        </template>
      </PrimeColumn>
    </PrimeDataTable>

    <p v-if="!loading && errorMessage" class="order-head__message order-head__message--error">
      {{ errorMessage }}
    </p>

    <PrimeDialog v-model:visible="dateDialogVisible" header="Редактирование даты заказа" modal
      :style="{ width: '26rem' }" :closable="false" class="order-head__date-dialog">
      <div class="order-head__date-dialog-body">
        <p class="order-head__date-dialog-info">
          Заказ: <strong>{{ currentEditingOrder?.orderNumber || currentEditingOrder?.id }}</strong>
        </p>
        <PrimeDatePicker v-model="tempDateValue" showIcon inputId="order-head-date" dateFormat="dd.mm.yy"
          :manualInput="true" appendTo="body" class="w-full" />
      </div>
      <template #footer>
        <PrimeButton label="Отмена" icon="pi pi-times" severity="secondary" text :disabled="dateDialogSaving"
          @click="cancelDateEdit" />
        <PrimeButton label="Сохранить" icon="pi pi-check" :loading="dateDialogSaving" @click="saveDateEdit" />
      </template>
    </PrimeDialog>
  </section>
</template>

<style scoped>
.order-head {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.order-head__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.order-head__title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  color: #0f172a;
}

.order-head__subtitle {
  margin: 0.25rem 0 0;
  color: #475569;
}

.order-head__header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.order-head__table {
  min-height: 28rem;
}

.order-head__message {
  margin: 0;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(226, 232, 240, 0.5);
  color: #0f172a;
}

.order-head__message--error {
  border-color: rgba(248, 113, 113, 0.4);
  background: rgba(254, 226, 226, 0.65);
  color: #b91c1c;
}

.order-head__date-button {
  appearance: none;
  border: none;
  padding: 0;
  background: transparent;
  color: #2563eb;
  text-decoration: underline;
  cursor: pointer;
}

.order-head__date-button:hover {
  color: #1d4ed8;
}

.order-head__date-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.order-head__date-dialog-info {
  margin: 0;
}
</style>
