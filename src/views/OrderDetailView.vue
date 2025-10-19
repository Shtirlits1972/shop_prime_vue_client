<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import PrimeButton from 'primevue/button'
import PrimeDatePicker from 'primevue/datepicker'
import PrimeColumn from 'primevue/column'
import type { ColumnFilterMatchModeOptions } from 'primevue/column'
import PrimeDataTable, { type DataTableCellEditCompleteEvent } from 'primevue/datatable'
import PrimeDialog from 'primevue/dialog'
import PrimeConfirmDialog from 'primevue/confirmdialog'
import PrimeInputNumber from 'primevue/inputnumber'
import PrimeInputText from 'primevue/inputtext'
import PrimeMultiSelect from 'primevue/multiselect'
import PrimeSelect from 'primevue/select'
import PrimeToast from 'primevue/toast'
import type { DataTableFilterMeta } from 'primevue/datatable'
import { FilterMatchMode, FilterOperator } from '@primevue/core/api'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'

import { BASE_URL } from '../config/env'
import { NUMBER_FILTER_MATCH_MODES } from '../scripts/filter'
import '@/styles/data-page.css'
import '@/styles/data-table.css'

defineOptions({ name: 'OrderDetailView' })

const API_BASE = (BASE_URL ?? '').replace(/\/$/, '')

const router = useRouter()
const toast = useToast()
const confirm = useConfirm()

const props = defineProps<{
  OrderId: number
}>()

interface OrderHeadModel {
  id: number
  orderNumber: string
  orderDate: Date | null
  userId?: number | null
  usersName?: string
  totalPrice?: number | null
}

interface OrderDetailRow {
  id: number
  orderId: number
  productId: number
  productName: string
  qty: number
  price: number
  rowSum: number
}

interface ProductOption {
  id: number
  label: string
  price: number
}

const order = ref<OrderHeadModel | null>(null)
const details = ref<OrderDetailRow[]>([])
const loading = ref(false)
const errorMessage = ref('')

function createDetailFilters(): DataTableFilterMeta {
  return {
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    id: {
      operator: FilterOperator.AND,
      constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }],
    },
    productName: {
      operator: FilterOperator.AND,
      constraints: [{ value: [] as string[], matchMode: FilterMatchMode.IN }],
    },
    qty: {
      operator: FilterOperator.AND,
      constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }],
    },
    price: {
      operator: FilterOperator.AND,
      constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }],
    },
    rowSum: {
      operator: FilterOperator.AND,
      constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }],
    },
  }
}

const detailFilters = ref<DataTableFilterMeta>(createDetailFilters())
const DETAIL_FILTERS_DEFAULT_SNAPSHOT = JSON.stringify(detailFilters.value)
const canResetDetailFilters = computed(
  () => JSON.stringify(detailFilters.value) !== DETAIL_FILTERS_DEFAULT_SNAPSHOT,
)
const numberFilterOptions: ColumnFilterMatchModeOptions[] = NUMBER_FILTER_MATCH_MODES.map(
  ({ label, value }) =>
    ({
      label,
      value,
    }) as ColumnFilterMatchModeOptions,
)
const productFilterOptions = computed(() => {
  const map = new Map<string, string>()

  for (const option of productOptions.value) {
    const label = option.label?.trim()
    if (label) {
      map.set(label, label)
    }
  }

  for (const detail of details.value) {
    const label = detail.productName?.trim()
    if (label) {
      map.set(label, label)
    }
  }

  return Array.from(map.values())
    .sort((a, b) => a.localeCompare(b, 'ru'))
    .map((label) => ({ label, value: label }))
})

const formOrderNumber = ref('')
const formOrderDate = ref<Date | null>(null)
const isSaving = ref(false)
const detailDialogVisible = ref(false)
const detailDialogSaving = ref(false)
const detailDialogQty = ref<number>(1)
const dialogMode = ref<'create' | 'edit'>('create')
const productOptions = ref<ProductOption[]>([])
const productOptionsLoading = ref(false)
const productOptionsLoaded = ref(false)
const selectedProductId = ref<number | null>(null)
const selectedDetail = ref<OrderDetailRow | null>(null)
const editingDetail = ref<OrderDetailRow | null>(null)
const deletingDetail = ref(false)
let orderCreationPromise: Promise<boolean> | null = null


const calendarLocale = Object.freeze({
  firstDayOfWeek: 1,
  dayNames: [
    'Воскресенье',
    'Понедельник',
    'Вторник',
    'Среда',
    'Четверг',
    'Пятница',
    'Суббота',
  ],
  dayNamesShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  dayNamesMin: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  monthNames: [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
  ],
  monthNamesShort: [
    'Янв',
    'Фев',
    'Мар',
    'Апр',
    'Май',
    'Июн',
    'Июл',
    'Авг',
    'Сен',
    'Окт',
    'Ноя',
    'Дек',
  ],
  today: 'Сегодня',
  clear: 'Очистить',
})

const normalizedOrderNumber = computed(() => formOrderNumber.value.trim())

const hasChanges = computed(() => {
  if (!order.value) {
    return false
  }
  const baseNumber = (order.value.orderNumber ?? '').trim()
  const numberChanged = normalizedOrderNumber.value !== baseNumber

  const baseDateKey = toDateKey(order.value.orderDate)
  const formDateKey = toDateKey(formOrderDate.value)
  const dateChanged = baseDateKey !== formDateKey

  return numberChanged || dateChanged
})

const saveDisabled = computed(
  () =>
    !order.value || !normalizedOrderNumber.value || !hasChanges.value || isSaving.value,
)

const orderTitle = computed(() => {
  if (!order.value) {
    return 'Новый заказ'
  }
  if (normalizedOrderNumber.value) {
    return `Заказ №${normalizedOrderNumber.value}`
  }
  return `Заказ №${order.value.id}`
})

const selectedProductOption = computed(() => {
  if (selectedProductId.value === null) {
    return null
  }
  return productOptions.value.find((option) => option.id === selectedProductId.value) ?? null
})

const detailDialogCanSave = computed(() => {
  const qty = Number(detailDialogQty.value ?? 0)
  return (
    !detailDialogSaving.value &&
    selectedProductOption.value !== null &&
    Number.isFinite(qty) &&
    qty > 0
  )
})

const detailDialogTitle = computed(() =>
  dialogMode.value === 'edit' ? 'Редактировать позицию' : 'Добавить позицию',
)

const detailDialogSubmitLabel = computed(() =>
  dialogMode.value === 'edit' ? 'Обновить' : 'Сохранить',
)

watch(
  () => props.OrderId,
  async (next) => {
    selectedDetail.value = null
    resetDetailFilters()
    editingDetail.value = null
    if (!detailDialogVisible.value) {
      dialogMode.value = 'create'
    }
    await refreshDetails(next)
  },
  { immediate: true },
)

watch(
  order,
  (next) => {
    if (!next) {
      formOrderNumber.value = ''
      formOrderDate.value = null
      return
    }

    formOrderNumber.value = next.orderNumber
    formOrderDate.value = next.orderDate ? new Date(next.orderDate) : null
  },
  { immediate: true },
)

watch(detailDialogVisible, (visible) => {
  if (visible) {
    if (!productOptionsLoaded.value) {
      void ensureProductOptions()
    } else if (!selectedProductId.value && productOptions.value.length > 0) {
      selectedProductId.value = productOptions.value[0]!.id
    }
  } else {
    resetDetailDialogState()
  }
})

function buildApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return API_BASE ? `${API_BASE}${normalized}` : normalized
}

function parseOrderDateValue(source: unknown): Date | null {
  if (!source) {
    return null
  }

  if (source instanceof Date) {
    return Number.isNaN(source.getTime()) ? null : new Date(source)
  }

  if (typeof source === 'string') {
    const trimmed = source.trim()
    if (!trimmed) {
      return null
    }
    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  return null
}

function toDateKey(value: Date | null | undefined): string | null {
  if (!value) {
    return null
  }
  const year = value.getFullYear()
  const month = value.getMonth()
  const day = value.getDate()
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function normalizeOrderHead(payload: unknown): OrderHeadModel | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const record = payload as Record<string, unknown>
  const id = Number(record.id ?? record.Id ?? 0)
  const orderNumberRaw =
    typeof record.orderNumber === 'string'
      ? record.orderNumber
      : typeof record.OrderNumber === 'string'
        ? record.OrderNumber
        : ''
  const orderNumber = orderNumberRaw.trim()
  const orderDate =
    parseOrderDateValue(record.orderDate) ??
    parseOrderDateValue(record.OrderDate) ??
    parseOrderDateValue(record.orderData) ??
    parseOrderDateValue(record.OrderData)
  const userIdRaw = Number(record.userId ?? record.UserId ?? NaN)
  const usersName =
    typeof record.usersName === 'string'
      ? record.usersName
      : typeof record.UsersName === 'string'
        ? record.UsersName
        : ''
  const totalPriceRaw = record.totalPrice ?? record.TotalPrice ?? null
  const totalPrice =
    typeof totalPriceRaw === 'number'
      ? (Number.isFinite(totalPriceRaw) ? totalPriceRaw : null)
      : typeof totalPriceRaw === 'string'
        ? (() => {
          const parsed = Number.parseFloat(totalPriceRaw.replace(',', '.'))
          return Number.isFinite(parsed) ? parsed : null
        })()
        : null

  if (!Number.isFinite(id) || id < 0) {
    return null
  }
  return {
    id,
    orderNumber,
    orderDate,
    userId: Number.isFinite(userIdRaw) ? userIdRaw : null,
    usersName: usersName ?? '',
    totalPrice,
  }
}

function normalizeOrderDetail(payload: unknown): OrderDetailRow | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const record = payload as Record<string, unknown>

  const id = Number(record.id ?? record.Id ?? 0)
  const orderId = Number(record.orderId ?? record.OrderId ?? 0)
  const productId = Number(record.productId ?? record.ProductId ?? 0)
  const qty = Number(record.qty ?? record.Qty ?? 0)
  const price = Number(record.price ?? record.Price ?? 0)
  const rowSum = Number(record.rowSum ?? record.RowSum ?? qty * price)
  const productName =
    typeof record.productName === 'string'
      ? record.productName
      : typeof record.ProductName === 'string'
        ? record.ProductName
        : ''

  if (!Number.isFinite(id) || id < 0) {
    return null
  }

  return {
    id,
    orderId,
    productId,
    productName,
    qty: Number.isFinite(qty) ? qty : 0,
    price: Number.isFinite(price) ? price : 0,
    rowSum: Number.isFinite(rowSum) ? rowSum : 0,
  }
}

function normalizeProductOption(payload: unknown): ProductOption | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const record = payload as Record<string, unknown>
  const id = Number(record.id ?? record.Id ?? 0)

  const name =
    typeof record.productName === 'string'
      ? record.productName
      : typeof record.ProductName === 'string'
        ? record.ProductName
        : ''

  const priceRaw = record.price ?? record.Price ?? null
  const price =
    typeof priceRaw === 'number'
      ? priceRaw
      : typeof priceRaw === 'string'
        ? Number.parseFloat(priceRaw.replace(',', '.'))
        : 0

  if (!Number.isFinite(id) || id < 0) {
    return null
  }

  const label = name.trim()

  return {
    id,
    label,
    price: Number.isFinite(price) ? price : 0,
  }
}

async function loadOrder(orderId: number): Promise<void> {
  const normalizedId = Number(orderId)

  if (!Number.isFinite(normalizedId) || normalizedId < 0) {
    order.value = null
    errorMessage.value = ''
    return
  }

  try {
    const response = await fetch(buildApiUrl(`/api/OrderHead/${normalizedId}`), {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json, text/plain' },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const payload = await parseJson(response)
    const normalized = normalizeOrderHead(payload)

    if (!normalized) {
      order.value = null
      errorMessage.value = 'Заказ не найден.'
      return
    }

    order.value = normalized
    errorMessage.value = ''

    if (!productOptionsLoaded.value) {
      void ensureProductOptions()
    }
  } catch (error) {
    order.value = null
    errorMessage.value =
      error instanceof Error ? error.message : 'Не удалось загрузить заказ.'
  }
}

async function loadOrderDetails(orderId: number): Promise<void> {
  if (!orderId) {
    details.value = []
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(buildApiUrl(`/api/OrderDetail/${orderId}`), {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json, text/plain' },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const payload = (await parseJson(response)) as unknown
    if (!Array.isArray(payload)) {
      throw new Error('Ответ сервера не содержит строки заказа.')
    }

    details.value = payload
      .map((item) => normalizeOrderDetail(item))
      .filter((item): item is OrderDetailRow => item !== null)

    if (selectedDetail.value) {
      const nextSelected = details.value.find((item) => item.id === selectedDetail.value?.id)
      selectedDetail.value = nextSelected ?? null
    }
  } catch (error) {
    details.value = []
    selectedDetail.value = null
    const message =
      error instanceof Error ? error.message : 'Не удалось загрузить строки заказа.'
    errorMessage.value = message
    toast.add({
      severity: 'error',
      summary: 'Ошибка загрузки',
      detail: message,
      life: 4000,
    })
  } finally {
    loading.value = false
  }
}

async function parseJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''
  const raw = await response.text()

  if (!raw) {
    return null
  }

  if (contentType.includes('application/json')) {
    return JSON.parse(raw)
  }

  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function resetDetailDialogState(): void {
  if (detailDialogSaving.value) {
    return
  }
  dialogMode.value = 'create'
  editingDetail.value = null
  detailDialogQty.value = 1
  selectedProductId.value = productOptions.value.length > 0 ? productOptions.value[0]!.id : null
}

function ensureCurrentProductInOptions(): void {
  if (selectedProductId.value === null) {
    return
  }

  if (productOptions.value.some((option) => option.id === selectedProductId.value)) {
    return
  }

  const fallback =
    editingDetail.value && editingDetail.value.productId === selectedProductId.value
      ? editingDetail.value
      : selectedDetail.value && selectedDetail.value.productId === selectedProductId.value
        ? selectedDetail.value
        : null

  if (!fallback) {
    return
  }

  productOptions.value = [
    ...productOptions.value,
    {
      id: fallback.productId,
      label: fallback.productName,
      price: fallback.price,
    },
  ]
}

function applyDetailRowPatch(
  rowId: number,
  patch: Partial<OrderDetailRow>,
): OrderDetailRow | null {
  const index = details.value.findIndex((item) => item.id === rowId)

  if (index === -1) {
    return null
  }

  const merged: OrderDetailRow = {
    ...details.value[index]!,
    ...patch,
  }

  const nextDetails = [...details.value]
  nextDetails[index] = merged
  details.value = nextDetails

  if (selectedDetail.value && selectedDetail.value.id === merged.id) {
    selectedDetail.value = { ...merged }
  }

  recalcOrderTotal()

  return merged
}

function recalcOrderTotal(): void {
  const currentOrder = order.value

  if (!currentOrder) {
    return
  }

  const total = details.value.reduce((accumulator, item) => {
    const value = Number(item.rowSum)
    return accumulator + (Number.isFinite(value) ? value : 0)
  }, 0)

  order.value = {
    ...currentOrder,
    totalPrice: total,
  }
}

function resetDetailFilters(): void {
  detailFilters.value = createDetailFilters()
}

async function ensureOrderCreated(): Promise<boolean> {
  if (!order.value || order.value.id > 0) {
    return false
  }

  if (orderCreationPromise) {
    try {
      await orderCreationPromise
    } catch {
      return false
    }
    return Boolean(order.value && order.value.id > 0)
  }

  const draft = order.value
  const orderDateValue = formOrderDate.value
    ? new Date(formOrderDate.value)
    : draft.orderDate instanceof Date
      ? new Date(draft.orderDate)
      : draft.orderDate
        ? new Date(draft.orderDate)
        : null

  const isoOrderDate =
    orderDateValue && !Number.isNaN(orderDateValue.getTime())
      ? orderDateValue.toISOString()
      : new Date().toISOString()

  const payload = {
    id: 0,
    userId:
      typeof draft.userId === 'number' && Number.isFinite(draft.userId) ? draft.userId : 0,
    usersName: (draft.usersName ?? '').trim(),
    orderNumber: normalizedOrderNumber.value || draft.orderNumber || '',
    orderData: isoOrderDate,
    totalPrice:
      typeof draft.totalPrice === 'number' && Number.isFinite(draft.totalPrice)
        ? draft.totalPrice
        : 0,
  }

  orderCreationPromise = (async () => {
    try {
      const response = await fetch(buildApiUrl('/api/OrderHead'), {
        method: 'POST',
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

      const raw = await parseJson(response)
      const normalized = normalizeOrderHead(raw)

      if (!normalized || normalized.id <= 0) {
        throw new Error('Сервер вернул некорректные данные заказа.')
      }

      order.value = normalized
      toast.add({
        severity: 'success',
        summary: 'Заказ создан',
        detail: `Заказ создан №${normalized.orderNumber || normalized.id}`,
        life: 3000,
      })

      const currentRoute = router.currentRoute.value
      const currentId = String(currentRoute.params?.OrderId ?? '')
      const nextId = String(normalized.id)

      if (currentId !== nextId) {
        await router.replace({
          name: 'OrderDetail',
          params: { OrderId: normalized.id },
          query: currentRoute.query,
        })
      }

      if (!productOptionsLoaded.value) {
        void ensureProductOptions()
      }

      return true
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось создать заказ.'
      toast.add({
        severity: 'error',
        summary: 'Ошибка создания',
        detail: message,
        life: 4000,
      })
      throw error
    } finally {
      orderCreationPromise = null
    }
  })()

  try {
    return await orderCreationPromise
  } catch {
    return false
  }
}

async function ensureProductOptions(): Promise<void> {
  if (productOptionsLoaded.value || productOptionsLoading.value) {
    return
  }

  productOptionsLoading.value = true

  try {
    const response = await fetch(buildApiUrl('/api/Product'), {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json, text/plain' },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const payload = await parseJson(response)

    if (!Array.isArray(payload)) {
      throw new Error('Ответ сервера не содержит список товаров.')
    }

    const options = payload
      .map((item) => normalizeProductOption(item))
      .filter((item): item is ProductOption => item !== null && Boolean(item.label))

    productOptions.value = options
    productOptionsLoaded.value = true
    ensureCurrentProductInOptions()

    if (!selectedProductId.value && options.length > 0) {
      selectedProductId.value = options[0]!.id
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Не удалось загрузить список товаров.'
    toast.add({
      severity: 'error',
      summary: 'Ошибка загрузки',
      detail: message,
      life: 4000,
    })
  } finally {
    productOptionsLoading.value = false
  }
}

function openCreateDetailDialog(): void {
  if (!order.value) {
    toast.add({
      severity: 'warn',
      summary: 'Заказ не выбран',
      detail: 'Сначала сохраните заказ, затем добавьте позицию.',
      life: 3000,
    })
    return
  }

  resetDetailDialogState()
  detailDialogVisible.value = true

  if (!productOptionsLoaded.value) {
    void ensureProductOptions()
  }
}

async function openEditDetailDialog(): Promise<void> {
  if (!order.value || !selectedDetail.value) {
    toast.add({
      severity: 'warn',
      summary: 'Строка не выбрана',
      detail: 'Выберите позицию, которую нужно изменить.',
      life: 3000,
    })
    return
  }

  const detail = selectedDetail.value
  dialogMode.value = 'edit'
  editingDetail.value = { ...detail }
  detailDialogQty.value = detail.qty
  selectedProductId.value = detail.productId
  detailDialogVisible.value = true

  if (!productOptionsLoaded.value) {
    await ensureProductOptions()
  } else {
    ensureCurrentProductInOptions()
  }
}

function cancelDetailDialog(): void {
  if (detailDialogSaving.value) {
    return
  }
  detailDialogVisible.value = false
}

async function handleSubmitDetail(): Promise<void> {
  if (!order.value) {
    return
  }

  const product = selectedProductOption.value
  const qty = Number(detailDialogQty.value ?? 0)
  const isEdit = dialogMode.value === 'edit'

  if ((!product || !product.label) && !(isEdit && editingDetail.value)) {
    toast.add({
      severity: 'warn',
      summary: 'Товар',
      detail: 'Выберите товар перед сохранением.',
      life: 3000,
    })
    return
  }

  if (!Number.isFinite(qty) || qty <= 0) {
    toast.add({
      severity: 'warn',
      summary: 'Количество',
      detail: 'Укажите количество больше нуля.',
      life: 3000,
    })
    return
  }

  try {
    await ensureOrderCreated()
    if (!order.value || order.value.id <= 0) {
      return
    }
  } catch {
    return
  }

  detailDialogSaving.value = true

  const effectiveProduct = product ?? {
    id: editingDetail.value!.productId,
    label: editingDetail.value!.productName,
    price: editingDetail.value!.price,
  }

  const price = effectiveProduct.price ?? 0
  const rowSum = price * qty

  const payload = {
    id: isEdit ? editingDetail.value!.id : 0,
    orderId: order.value.id,
    productId: effectiveProduct.id,
    qty,
    productName: effectiveProduct.label,
    price,
    rowSum,
  }

  const method = isEdit ? 'PUT' : 'POST'

  try {
    const response = await fetch(buildApiUrl('/api/OrderDetail'), {
      method,
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

    await loadOrderDetails(order.value.id)

    if (isEdit) {
      selectedDetail.value =
        details.value.find((item) => item.id === payload.id) ?? selectedDetail.value
    }

    toast.add({
      severity: 'success',
      summary: isEdit ? 'Позиция обновлена' : 'Позиция добавлена',
      detail: isEdit
        ? 'Изменения успешно сохранены.'
        : 'Товар успешно добавлен в заказ.',
      life: 3000,
    })

    detailDialogVisible.value = false
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : isEdit
          ? 'Не удалось обновить строку заказа.'
          : 'Не удалось добавить позицию в заказ.'
    toast.add({
      severity: 'error',
      summary: isEdit ? 'Ошибка обновления' : 'Ошибка сохранения',
      detail: message,
      life: 4000,
    })
  } finally {
    detailDialogSaving.value = false
    if (!detailDialogVisible.value) {
      resetDetailDialogState()
    }
  }
}

async function persistDetailRowUpdate(
  nextRow: OrderDetailRow,
  previousRow: OrderDetailRow,
): Promise<void> {
  const targetOrderId = Number(nextRow.orderId ?? order.value?.id ?? 0)

  if (!Number.isFinite(targetOrderId) || targetOrderId <= 0) {
    applyDetailRowPatch(previousRow.id, previousRow)
    return
  }

  const productId = Number(nextRow.productId)
  const qty = Number(nextRow.qty)
  const price = Number(nextRow.price ?? 0)
  const rawRowSum = Number(nextRow.rowSum)
  const rowSum = Number.isFinite(rawRowSum) ? rawRowSum : price * qty

  if (!Number.isFinite(productId) || productId <= 0 || !Number.isFinite(qty) || qty <= 0) {
    applyDetailRowPatch(previousRow.id, previousRow)
    return
  }

  applyDetailRowPatch(nextRow.id, {
    ...nextRow,
    orderId: targetOrderId,
    productId,
    qty,
    price,
    rowSum,
  })

  try {
    const response = await fetch(buildApiUrl('/api/OrderDetail'), {
      method: 'PUT',
      credentials: 'include',
      headers: {
        Accept: 'application/json, text/plain',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: nextRow.id,
        orderId: targetOrderId,
        productId,
        qty,
        productName: nextRow.productName,
        price,
        rowSum,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const payload = await parseJson(response)
    const normalized = normalizeOrderDetail(payload)

    if (normalized && normalized.id === nextRow.id) {
      applyDetailRowPatch(normalized.id, normalized)
    }
  } catch (error) {
    applyDetailRowPatch(previousRow.id, previousRow)

    const message =
      error instanceof Error ? error.message : 'Не удалось обновить строку заказа.'

    toast.add({
      severity: 'error',
      summary: 'Ошибка обновления',
      detail: message,
      life: 4000,
    })
  }
}

async function handleDetailCellEdit(
  event: DataTableCellEditCompleteEvent<OrderDetailRow>,
): Promise<void> {
  if (!order.value || order.value.id <= 0) {
    return
  }

  const affectedField = event.field
  if (affectedField !== 'productId' && affectedField !== 'qty') {
    return
  }

  const previousRow = normalizeOrderDetail(event.data) ?? null
  if (!previousRow) {
    return
  }

  const currentRow =
    details.value.find((item) => item.id === previousRow.id) ?? previousRow

  if (affectedField === 'productId') {
    const nextProductId = Number(event.newValue ?? currentRow.productId ?? 0)

    if (!Number.isFinite(nextProductId) || nextProductId <= 0) {
      applyDetailRowPatch(previousRow.id, previousRow)
      toast.add({
        severity: 'warn',
        summary: 'Товар',
        detail: 'Выберите товар из списка.',
        life: 3000,
      })
      return
    }

    if (!productOptionsLoaded.value) {
      await ensureProductOptions()
    }

    const option = productOptions.value.find((item) => item.id === nextProductId)

    if (!option) {
      applyDetailRowPatch(previousRow.id, previousRow)
      toast.add({
        severity: 'warn',
        summary: 'Товар',
        detail: 'Не удалось найти выбранный товар.',
        life: 3000,
      })
      return
    }

    const hasProductChanged =
      option.id !== previousRow.productId ||
      option.label !== previousRow.productName ||
      option.price !== previousRow.price

    const quantityValue = Number(currentRow.qty ?? previousRow.qty ?? 0)
    const safeQuantity = Number.isFinite(quantityValue) ? quantityValue : 0

    const nextRow: OrderDetailRow = {
      ...currentRow,
      productId: option.id,
      productName: option.label,
      price: option.price,
      rowSum: option.price * safeQuantity,
    }

    if (!hasProductChanged) {
      applyDetailRowPatch(nextRow.id, nextRow)
      return
    }

    await persistDetailRowUpdate(nextRow, previousRow)
    return
  }

  const nextQty = Number(event.newValue ?? currentRow.qty ?? previousRow.qty ?? 0)

  if (!Number.isFinite(nextQty) || nextQty <= 0) {
    applyDetailRowPatch(previousRow.id, previousRow)
    toast.add({
      severity: 'warn',
      summary: 'Количество',
      detail: 'Количество должно быть больше нуля.',
      life: 3000,
    })
    return
  }

  const hasQtyChanged = nextQty !== previousRow.qty
  const price = currentRow.price ?? previousRow.price ?? 0
  const nextRow: OrderDetailRow = {
    ...currentRow,
    qty: nextQty,
    rowSum: price * nextQty,
  }

  if (!hasQtyChanged) {
    applyDetailRowPatch(nextRow.id, nextRow)
    return
  }

  await persistDetailRowUpdate(nextRow, previousRow)
}

async function saveOrder(options: { redirect?: boolean } = {}): Promise<void> {
  if (!order.value) {
    return
  }

  if (!normalizedOrderNumber.value) {
    toast.add({
      severity: 'warn',
      summary: 'Номер заказа',
      detail: 'Укажите номер заказа перед сохранением.',
      life: 4000,
    })
    return
  }

  let justCreated = false
  try {
    justCreated = await ensureOrderCreated()
  } catch {
    return
  }

  if (justCreated) {
    if (options.redirect) {
      back()
    }
    return
  }

  if (!hasChanges.value) {
    if (options.redirect) {
      back()
    }
    return
  }

  const target = order.value
  if (!target || target.id <= 0) {
    return
  }

  isSaving.value = true

  const safeUserId =
    typeof target.userId === 'number' && Number.isFinite(target.userId)
      ? target.userId
      : 0
  const safeTotalPrice =
    typeof target.totalPrice === 'number' && Number.isFinite(target.totalPrice)
      ? target.totalPrice
      : 0

  const orderDateValue = formOrderDate.value
    ? new Date(formOrderDate.value)
    : target.orderDate instanceof Date
      ? new Date(target.orderDate)
      : target.orderDate
        ? new Date(target.orderDate)
        : null

  const payload = {
    id: target.id,
    userId: safeUserId,
    usersName: (target.usersName ?? '').trim(),
    orderNumber: normalizedOrderNumber.value,
    orderData: orderDateValue,
    totalPrice: safeTotalPrice,
  }

  try {
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

    await loadOrder(target.id)

    toast.add({
      severity: 'success',
      summary: 'Заказ обновлён',
      detail: 'Изменения успешно сохранены.',
      life: 3000,
    })

    if (options.redirect) {
      back()
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Не удалось сохранить заказ.'
    toast.add({
      severity: 'error',
      summary: 'Ошибка сохранения',
      detail: message,
      life: 4000,
    })
  } finally {
    isSaving.value = false
  }
}

function requestDeleteDetail(): void {
  if (!order.value || !selectedDetail.value) {
    toast.add({
      severity: 'warn',
      summary: 'Строка не выбрана',
      detail: 'Выберите позицию, которую нужно удалить.',
      life: 3000,
    })
    return
  }

  confirm.require({
    message: `Удалить позицию ${selectedDetail.value.productName || selectedDetail.value.id}?`,
    header: 'Подтвердите действие',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Удалить',
    rejectLabel: 'Отмена',
    rejectClass: 'p-button-secondary',
    acceptClass: 'p-button-danger',
    accept: () => {
      void performDeleteDetail()
    },
  })
}

async function performDeleteDetail(): Promise<void> {
  if (!order.value || !selectedDetail.value || deletingDetail.value) {
    return
  }

  deletingDetail.value = true
  const detailId = selectedDetail.value.id

  try {
    const response = await fetch(buildApiUrl(`/api/OrderDetail/${detailId}`), {
      method: 'DELETE',
      credentials: 'include',
      headers: { Accept: '*/*' },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    details.value = details.value.filter((item) => item.id !== detailId)
    selectedDetail.value = null

    toast.add({
      severity: 'success',
      summary: 'Позиция удалена',
      detail: 'Строка заказа успешно удалена.',
      life: 3000,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Не удалось удалить строку заказа.'
    toast.add({
      severity: 'error',
      summary: 'Ошибка удаления',
      detail: message,
      life: 4000,
    })
  } finally {
    deletingDetail.value = false
  }
}

async function refreshDetails(orderId: number = props.OrderId): Promise<void> {
  await loadOrder(orderId)
  await loadOrderDetails(orderId)
}

function productDisplay(row: OrderDetailRow | null | undefined): string {
  if (!row) {
    return 'Нет данных'
  }
  const trimmedName = row.productName.trim()
  if (trimmedName) {
    return trimmedName
  }
  if (row.productId) {
    return `ID ${row.productId}`
  }
  return 'Нет данных'
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0)
}

function back(): void {
  router.push({ name: 'orders' })
}
</script>

<template>
  <section class="data-page order-detail">
    <PrimeToast />
    <PrimeConfirmDialog />

    <header class="data-page__header">
      <div>
        <h1 class="data-page__title">{{ orderTitle }}</h1>
        <p class="data-page__subtitle">
          Управляйте параметрами заказа и его позициями.
        </p>
      </div>
    </header>

    <p v-if="errorMessage" class="data-page__error">
      {{ errorMessage }}
    </p>

    <div class="order-detail__form">
      <div class="order-detail__form-grid">
        <div class="order-detail__field">
          <label for="order-detail-number">Номер заказа</label>
          <PrimeInputText id="order-detail-number" v-model="formOrderNumber" class="w-full"
            placeholder="Введите номер заказа" :disabled="!order || isSaving" @keydown.enter.prevent="saveOrder()" />
        </div>
        <div class="order-detail__field">
          <label for="order-detail-date">Дата заказа</label>
          <PrimeDatePicker id="order-detail-date" v-model="formOrderDate" class="w-full" dateFormat="dd.mm.yy" showIcon
            showButtonBar :manualInput="false" :disabled="!order || isSaving" :locale="calendarLocale" appendTo="body"
            placeholder="Выберите дату" />
        </div>
      </div>
    </div>

    <PrimeDataTable v-model:filters="detailFilters" :value="details" :loading="loading"
      v-model:selection="selectedDetail" dataKey="id" editMode="cell" cellEditMode="dblclick"
      @cell-edit-complete="handleDetailCellEdit" stripedRows filterDisplay="menu" scrollable scrollHeight="420px"
      responsiveLayout="scroll" class="data-table" selectionMode="single" :metaKeySelection="false" :paginator="true"
      :rows="10" :rowsPerPageOptions="[5, 10, 20, 50]">
      <template #header>
        <div class="order-detail__table-header">
          <div class="order-detail__table-actions">
            <PrimeButton label="добавить" icon="pi pi-plus" severity="success"
              :disabled="!order || loading || detailDialogSaving" @click="openCreateDetailDialog" />
            <PrimeButton label="удалить" icon="pi pi-trash" severity="danger"
              :disabled="!selectedDetail || deletingDetail || loading || detailDialogSaving" :loading="deletingDetail"
              @click="requestDeleteDetail" />
            <PrimeButton label="Редактировать" icon="pi pi-pencil" severity="warning"
              :disabled="!selectedDetail || deletingDetail || loading || detailDialogSaving"
              :loading="detailDialogSaving && dialogMode === 'edit'" @click="openEditDetailDialog" />
          </div>
          <PrimeButton label="Сбросить фильтры" icon="pi pi-filter-slash" severity="secondary" outlined
            :disabled="!canResetDetailFilters" @click="resetDetailFilters" />
        </div>
      </template>

      <template #empty>
        <span v-if="loading">Загружаем строки заказа...</span>
        <span v-else>Позиции не найдены.</span>
      </template>

      <PrimeColumn field="id" header="ID" sortable filter dataType="numeric" showFilterMenu showClearButton
        showApplyButton :showFilterMatchModes="false" :filterMatchModeOptions="numberFilterOptions">
        <template #filter="{ filterModel }">
          <PrimeInputNumber v-model="filterModel.value" inputClass="w-full" :useGrouping="false" placeholder="ID"
            @keydown.enter.prevent />
        </template>
      </PrimeColumn>

      <PrimeColumn field="productId" header="Товар" sortable filter filterField="productName" showFilterMenu
        showClearButton showApplyButton :showFilterMatchModes="false" :filterMenuStyle="{ width: '18rem' }"
        :editable="true">
        <template #body="{ data }">
          {{ productDisplay(data) }}
        </template>
        <template #filter="{ filterModel }">
          <PrimeMultiSelect v-model="filterModel.value" :options="productFilterOptions" optionLabel="label"
            optionValue="value" placeholder="Выберите товар" display="chip" class="w-full" filter
            :loading="productOptionsLoading" :showToggleAll="false" />
        </template>
        <template #editor="{ data }">
          <PrimeSelect v-model="data.productId" :options="productOptions" optionLabel="label" optionValue="id"
            class="w-full" filter appendTo="body" :loading="productOptionsLoading" />
        </template>
      </PrimeColumn>


      <PrimeColumn field="qty" header="Количество" sortable filter dataType="numeric" showFilterMenu showClearButton
        showApplyButton :filterMatchModeOptions="numberFilterOptions" :editable="true">
        <template #filter="{ filterModel }">
          <PrimeInputNumber v-model="filterModel.value" inputClass="w-full" :useGrouping="false"
            placeholder="Количество" @keydown.enter.prevent />
        </template>
        <template #editor="{ data }">
          <PrimeInputNumber v-model="data.qty" inputClass="w-full" :min="1" :step="1" :useGrouping="false"
            placeholder="Количество" />
        </template>
      </PrimeColumn>

      <PrimeColumn field="price" header="Цена" sortable filter dataType="numeric" showFilterMenu showClearButton
        showApplyButton :filterMatchModeOptions="numberFilterOptions">
        <template #body="{ data }">
          {{ formatCurrency(data.price) }}
        </template>
        <template #filter="{ filterModel }">
          <PrimeInputNumber v-model="filterModel.value" inputClass="w-full" :useGrouping="false" placeholder="Цена"
            :minFractionDigits="0" :maxFractionDigits="2" @keydown.enter.prevent />
        </template>
      </PrimeColumn>

      <PrimeColumn field="rowSum" header="Сумма" sortable filter dataType="numeric" showFilterMenu showClearButton
        showApplyButton :filterMatchModeOptions="numberFilterOptions">
        <template #body="{ data }">
          {{ formatCurrency(data.rowSum) }}
        </template>
        <template #filter="{ filterModel }">
          <PrimeInputNumber v-model="filterModel.value" inputClass="w-full" :useGrouping="false" placeholder="Сумма"
            :minFractionDigits="0" :maxFractionDigits="2" @keydown.enter.prevent />
        </template>
      </PrimeColumn>
    </PrimeDataTable>
    <PrimeDialog v-model:visible="detailDialogVisible" :header="detailDialogTitle" modal :style="{ width: '26rem' }"
      :draggable="false" :closable="!detailDialogSaving" :breakpoints="{ '960px': '95vw', '640px': '100vw' }">
      <div class="order-detail__dialog-body">
        <div class="order-detail__field">
          <label for="order-detail-product">Товар</label>
          <PrimeSelect id="order-detail-product" v-model="selectedProductId" :options="productOptions"
            optionLabel="label" optionValue="id" placeholder="Выберите товар" class="w-full" appendTo="body" filter
            :disabled="detailDialogSaving || productOptionsLoading || !productOptions.length"
            :loading="productOptionsLoading">
            <template #option="{ option }">
              <div class="order-detail__product-option">
                <span>{{ option.label }}</span>
                <span class="order-detail__product-option-price">
                  {{ formatCurrency(option.price) }}
                </span>
              </div>
            </template>
            <template #empty>
              <span v-if="productOptionsLoading">Загружаем товары...</span>
              <span v-else>Товары не найдены.</span>
            </template>
          </PrimeSelect>
        </div>
        <div class="order-detail__field">
          <label for="order-detail-qty">Количество</label>
          <PrimeInputNumber id="order-detail-qty" v-model="detailDialogQty" inputClass="w-full" :useGrouping="false"
            :min="1" :step="1" :minFractionDigits="0" :maxFractionDigits="0" :disabled="detailDialogSaving" />
        </div>
      </div>
      <template #footer>
        <div class="order-detail__dialog-actions">
          <PrimeButton label="Отказаться" icon="pi pi-times" severity="secondary" outlined
            :disabled="detailDialogSaving" @click="cancelDetailDialog" />
          <PrimeButton :label="detailDialogSubmitLabel" icon="pi pi-save" severity="success"
            :disabled="!detailDialogCanSave" :loading="detailDialogSaving" @click="handleSubmitDetail" />
        </div>
      </template>
    </PrimeDialog>
    <div class="order-detail__actions order-detail__actions--footer">
      <PrimeButton label="Сохранить" icon="pi pi-save" severity="success" :disabled="saveDisabled" :loading="isSaving"
        @click="saveOrder()" />
      <PrimeButton label="Сохранить и вернуться" icon="pi pi-check" severity="primary" :disabled="saveDisabled"
        :loading="isSaving" @click="saveOrder({ redirect: true })" />
      <PrimeButton label="Вернуться" icon="pi pi-arrow-left" severity="secondary" :disabled="isSaving" @click="back" />
    </div>
  </section>
</template>

<style scoped>
.order-detail {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.order-detail__form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  border-radius: 1rem;
  border: 1px solid var(--surface-border, #d1d5db);
  background-color: var(--surface-card, #ffffff);
}

.order-detail__form-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.order-detail__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.order-detail__field label {
  font-weight: 600;
}

.order-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.order-detail__actions--footer {
  justify-content: flex-end;
  margin-top: 1rem;
}

.order-detail__table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.order-detail__table-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.order-detail__dialog-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.order-detail__dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.order-detail__product-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}

.order-detail__product-option-price {
  color: var(--text-color-secondary, #6b7280);
  font-size: 0.875rem;
}
</style>
