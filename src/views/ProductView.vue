<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

import PrimeButton from 'primevue/button'
import PrimeColumn from 'primevue/column'
import type { ColumnFilterMatchModeOptions } from 'primevue/column'
import PrimeConfirmDialog from 'primevue/confirmdialog'
import PrimeDataTable, {
  type DataTableCellEditCompleteEvent,
  type DataTableFilterMeta,
} from 'primevue/datatable'
import PrimeDialog from 'primevue/dialog'
import PrimeInputNumber from 'primevue/inputnumber'
import PrimeInputText from 'primevue/inputtext'
import PrimeMultiSelect from 'primevue/multiselect'
import PrimeSelect from 'primevue/select'
import PrimeToast from 'primevue/toast'

import { FilterMatchMode, FilterOperator } from '@primevue/core/api'
import { NUMBER_FILTER_MATCH_MODES, TEXT_FILTER_MATCH_MODES } from '../scripts/filter'
import '@/styles/data-page.css'
import '@/styles/data-table.css'
import '@/styles/dialog.css'
import '@/styles/product-view.css'

import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { BASE_URL } from '../config/env'

const API_BASE = (BASE_URL ?? '').replace(/\/$/, '')

const buildApiUrl = (path: string) => {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return API_BASE ? `${API_BASE}${normalized}` : normalized
}

const PRODUCTS_API_URL = buildApiUrl('/api/Product')
const CATEGORIES_API_URL = buildApiUrl('/api/Category')
const PRODUCT_IMAGE_BASE_URL = buildApiUrl('/images/product')
const PRODUCT_IMAGE_UPLOAD_URL = buildApiUrl('/api/Products/LoadImage')
const PRODUCT_IMAGE_DELETE_URL = buildApiUrl('/api/Products/DeleteImage')

interface CategoryOption {
  id: number
  categoryName: string
}

interface ProductRow {
  id: number
  productName: string
  price: number
  categoryId: number | null
  categoryName: string
  foto: string
}

interface ProductPayload {
  id: number
  productName: string
  price: number
  categoryId: number
  categoryName: string
  foto: string
}

type ApiProduct = Record<string, unknown>
type ApiCategory = Record<string, unknown>

const numberFilterOptions: ColumnFilterMatchModeOptions[] = NUMBER_FILTER_MATCH_MODES.map(
  ({ label, value }) =>
    ({
      label,
      value,
    }) as ColumnFilterMatchModeOptions,
)

const textFilterOptions: ColumnFilterMatchModeOptions[] = TEXT_FILTER_MATCH_MODES.map(
  ({ label, value }) =>
    ({
      label,
      value,
    }) as ColumnFilterMatchModeOptions,
)

const createFilters = (): DataTableFilterMeta => ({
  id: {
    operator: FilterOperator.AND,
    constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }],
  },
  productName: {
    operator: FilterOperator.AND,
    constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }],
  },
  price: {
    operator: FilterOperator.AND,
    constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }],
  },
  categoryName: {
    operator: FilterOperator.AND,
    constraints: [{ value: [] as string[], matchMode: FilterMatchMode.IN }],
  },
})

const toast = useToast()
const confirm = useConfirm()

const products = ref<ProductRow[]>([])
const loading = ref(false)
const errorMessage = ref('')
const filters = ref<DataTableFilterMeta>(createFilters())
const selectedProduct = ref<ProductRow | null>(null)

const categories = ref<CategoryOption[]>([])
const categoriesLoading = ref(false)

const productDialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const savingProduct = ref(false)

const form = reactive({
  id: 0,
  productName: '',
  price: 0,
  categoryId: null as number | null,
  foto: 'X',
})

const imageInputRef = ref<HTMLInputElement | null>(null)
const imageFile = ref<File | null>(null)
const imagePreviewUrl = ref('')
const hasExistingServerImage = ref(false)
const removeExistingImage = ref(false)

const imageEditorVisible = ref(false)
const imageEditorProduct = ref<ProductRow | null>(null)
const imageEditorFile = ref<File | null>(null)
const imageEditorPreview = ref('')
const imageEditorRemove = ref(false)
const imageEditorLoading = ref(false)
const imageEditorInputRef = ref<HTMLInputElement | null>(null)

const canRemoveImage = computed(() => hasExistingServerImage.value || imageFile.value !== null)
const imageEditorCanSubmit = computed(() => Boolean(imageEditorFile.value || imageEditorRemove.value))

let currentObjectUrl: string | null = null
let editorObjectUrl: string | null = null

const dialogTitle = computed(() =>
  dialogMode.value === 'edit' ? 'Edit product' : 'New product',
)
const submitButtonLabel = computed(() => (dialogMode.value === 'edit' ? 'Save' : 'Create'))

const categoryOptions = computed(() => categories.value)
const categoryFilterOptions = computed(() =>
  categories.value.map((category) => ({
    label: category.categoryName,
    value: category.categoryName,
  })),
)

const categoryMap = computed<Map<number, CategoryOption>>(() => {
  const map = new Map<number, CategoryOption>()
  for (const category of categories.value) {
    map.set(category.id, category)
  }
  return map
})

function normalizeCategory(raw: ApiCategory): CategoryOption | null {
  const id = Number(raw.id ?? raw.Id ?? raw.categoryId ?? raw.CategoryId ?? NaN)
  const name = String(raw.categoryName ?? raw.CategoryName ?? '').trim()
  if (!Number.isFinite(id) || !name) {
    return null
  }
  return { id, categoryName: name }
}

function normalizeProduct(raw: ApiProduct): ProductRow {
  const id = Number(raw.id ?? raw.Id ?? 0)
  const categoryIdRaw = raw.categoryId ?? raw.CategoryId ?? null
  const categoryId =
    categoryIdRaw === null || categoryIdRaw === undefined ? null : Number(categoryIdRaw)

  return {
    id,
    productName: String(raw.productName ?? raw.ProductName ?? '').trim(),
    price: Number(raw.price ?? raw.Price ?? 0),
    categoryId: Number.isFinite(categoryId as number) ? (categoryId as number) : null,
    categoryName: String(raw.categoryName ?? raw.CategoryName ?? '').trim(),
    foto: String(raw.foto ?? raw.Foto ?? 'X').trim() || 'X',
  }
}

function buildProductImageUrl(productId: number, fotoName: string): string {
  if (!fotoName || fotoName.toUpperCase() === 'X') {
    return ''
  }
  return `${PRODUCT_IMAGE_BASE_URL}/${productId}/${fotoName}?t=${Date.now()}`
}

function clearObjectUrl() {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = null
  }
}

function clearImageInput() {
  const inputEl = imageInputRef.value
  if (inputEl) {
    inputEl.value = ''
  }
}

async function uploadProductImage(productId: number, file: File, isEdit: boolean): Promise<string> {
  const formData = new FormData()
  formData.append('foto', file, file.name)
  formData.append('strId', String(productId))
  formData.append('IsEdit', String(isEdit))

  const response = await fetch(PRODUCT_IMAGE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
    },
    credentials: 'include',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const result = (await response.json()) as { success?: boolean; fileName?: string }
  if (!result?.success) {
    throw new Error('Image upload failed on server.')
  }

  return result.fileName ?? 'X'
}

async function deleteProductImage(productId: number): Promise<void> {
  const formData = new FormData()
  formData.append('ProductId', String(productId))

  const response = await fetch(PRODUCT_IMAGE_DELETE_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
    },
    credentials: 'include',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
}

function buildPayloadFromRow(row: ProductRow): ProductPayload {
  const trimmedName = row.productName.trim()
  if (!trimmedName) {
    throw new Error('Product name is required.')
  }

  const priceValue = Number(row.price)
  if (!Number.isFinite(priceValue)) {
    throw new Error('Price must be a valid number.')
  }

  if (row.categoryId === null) {
    throw new Error('Select a category.')
  }

  const category = categoryMap.value.get(row.categoryId)
  if (!category) {
    throw new Error('Selected category was not found.')
  }

  return {
    id: row.id,
    productName: trimmedName,
    price: priceValue,
    categoryId: row.categoryId,
    categoryName: category.categoryName,
    foto: (row.foto ?? '').trim() || 'X',
  }
}

async function updateProductPayload(payload: ProductPayload): Promise<void> {
  const response = await fetch(PRODUCTS_API_URL, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
}

async function updateProductRow(row: ProductRow): Promise<void> {
  console.log('Updating product row:', row);
  const payload = buildPayloadFromRow(row)
  await updateProductPayload(payload)
  row.productName = payload.productName
  row.price = payload.price
  row.categoryId = payload.categoryId
  row.categoryName = payload.categoryName
  row.foto = payload.foto
  console.log('Product row updated successfully.');
}

function resetImageState() {
  clearObjectUrl()
  imageFile.value = null
  imagePreviewUrl.value = ''
  removeExistingImage.value = false
  hasExistingServerImage.value = false
  clearImageInput()
}

function setExistingImagePreview(productId: number, fotoName: string) {
  clearObjectUrl()
  imagePreviewUrl.value = buildProductImageUrl(productId, fotoName)
}

function handleImageSelected(event: Event) {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.item(0)
  if (!file) {
    return
  }

  imageFile.value = file
  form.foto = file.name
  hasExistingServerImage.value = false
  removeExistingImage.value = false

  clearObjectUrl()
  currentObjectUrl = URL.createObjectURL(file)
  imagePreviewUrl.value = currentObjectUrl
}

function removeSelectedImage() {
  if (savingProduct.value) {
    return
  }

  const hadServerImage = hasExistingServerImage.value
  const hadLocalImage = imageFile.value !== null

  if (!hadServerImage && !hadLocalImage) {
    return
  }

  form.foto = 'X'
  imageFile.value = null
  clearObjectUrl()
  imagePreviewUrl.value = ''
  removeExistingImage.value = dialogMode.value === 'edit' && hadServerImage
  hasExistingServerImage.value = false
  clearImageInput()
}

function clearEditorObjectUrl() {
  if (editorObjectUrl) {
    URL.revokeObjectURL(editorObjectUrl)
    editorObjectUrl = null
  }
}

function resetImageEditorState() {
  clearEditorObjectUrl()
  imageEditorFile.value = null
  imageEditorPreview.value = ''
  imageEditorRemove.value = false
  imageEditorLoading.value = false
  imageEditorProduct.value = null
  if (imageEditorInputRef.value) {
    imageEditorInputRef.value.value = ''
  }
}

function openImageEditor(product: ProductRow) {
  resetImageEditorState()
  imageEditorProduct.value = { ...product }
  imageEditorPreview.value = resolveImageUrl(product)
  imageEditorVisible.value = true
}

function closeImageEditor() {
  imageEditorVisible.value = false
}

function handleImageEditorFileSelected(event: Event) {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.item(0) ?? null
  clearEditorObjectUrl()
  imageEditorFile.value = file

  if (file) {
    editorObjectUrl = URL.createObjectURL(file)
    imageEditorPreview.value = editorObjectUrl
    imageEditorRemove.value = false
    return
  }

  imageEditorPreview.value = imageEditorProduct.value ? resolveImageUrl(imageEditorProduct.value) : ''
}

function removeImageEditorImage() {
  imageEditorFile.value = null
  imageEditorRemove.value = true
  clearEditorObjectUrl()
  imageEditorPreview.value = ''
  if (imageEditorInputRef.value) {
    imageEditorInputRef.value.value = ''
  }
}

async function submitImageEditor() {
  if (!imageEditorProduct.value) {
    closeImageEditor()
    return
  }

  const product = imageEditorProduct.value
  imageEditorLoading.value = true

  try {
    let updated = false
    console.log('imageEditorFile.value:', imageEditorFile.value);
    if (imageEditorFile.value) {
      const newFileName = await uploadProductImage(product.id, imageEditorFile.value, true)
      console.log('Uploaded new image:', newFileName);
      const updatedRow: ProductRow = { ...product, foto: newFileName }
      await updateProductRow(updatedRow)
      updated = true
    } else if (imageEditorRemove.value) {
      await deleteProductImage(product.id)
      const updatedRow: ProductRow = { ...product, foto: 'X' }
      await updateProductRow(updatedRow)
      updated = true
    }

    if (updated) {
      const selectedId = selectedProduct.value?.id
      await loadProducts()
      if (selectedId !== undefined) {
        selectedProduct.value = products.value.find((item) => item.id === selectedId) ?? null
      }
      toast.add({
        severity: 'success',
        summary: 'Image updated',
        detail: imageEditorRemove.value ? 'Product image removed.' : 'Product image updated.',
        life: 4000,
      })
    }

    closeImageEditor()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update product image.'
    toast.add({
      severity: 'error',
      summary: 'Image update failed',
      detail: message,
      life: 5000,
    })
  } finally {
    imageEditorLoading.value = false
    resetImageEditorState()
  }
}

function resetFilters() {
  filters.value = createFilters()
}

function resetForm() {
  form.id = 0
  form.productName = ''
  form.price = 0
  form.categoryId = null
  form.foto = 'X'
  resetImageState()
}

function ensureCategoriesLoaded() {
  if (!categories.value.length && !categoriesLoading.value) {
    void loadCategories()
  }
}

function openCreateDialog() {
  dialogMode.value = 'create'
  resetForm()
  ensureCategoriesLoaded()
  productDialogVisible.value = true
}

function openEditDialog(product: ProductRow) {
  dialogMode.value = 'edit'
  ensureCategoriesLoaded()
  resetImageState()

  form.id = product.id
  form.productName = product.productName
  form.price = product.price
  form.categoryId = product.categoryId
  form.foto = product.foto || 'X'

  hasExistingServerImage.value = form.foto.toUpperCase() !== 'X'
  if (hasExistingServerImage.value) {
    setExistingImagePreview(product.id, form.foto)
  }

  productDialogVisible.value = true
}

function openEditSelected() {
  if (selectedProduct.value) {
    openEditDialog(selectedProduct.value)
  }
}

function requestDeleteSelected() {
  if (selectedProduct.value) {
    requestDeleteProduct(selectedProduct.value)
  }
}

function requestDeleteProduct(product: ProductRow) {
  confirm.require({
    header: 'Delete product',
    message: `Are you sure you want to delete "${product.productName}"?`,
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    rejectLabel: 'Cancel',
    acceptLabel: 'Delete',
    accept: () => deleteProduct(product),
  })
}

async function deleteProduct(product: ProductRow) {
  try {
    const response = await fetch(`${PRODUCTS_API_URL}/${product.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    toast.add({
      severity: 'success',
      summary: 'Deleted',
      detail: `Product "${product.productName}" removed.`,
      life: 4000,
    })

    selectedProduct.value = null
    await loadProducts()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete product.'
    toast.add({
      severity: 'error',
      summary: 'Delete failed',
      detail: message,
      life: 5000,
    })
  }
}

function resolveImageUrl(product: ProductRow) {
  if (!product.foto || product.foto.toUpperCase() === 'X') {
    return ''
  }
  const cacheBuster = Date.now()
  return `${PRODUCT_IMAGE_BASE_URL}/${product.id}/${product.foto}?t=${cacheBuster}`
}

function formatPrice(value: number) {
  if (!Number.isFinite(value)) {
    return value
  }
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  }).format(value)
}

function handleRowSelect(event: { data: ProductRow }) {
  selectedProduct.value = event.data
}

function handleRowUnselect() {
  selectedProduct.value = null
}

async function handleCellEditComplete(event: DataTableCellEditCompleteEvent<ProductRow>) {
  const { data, field, newValue } = event
  const product = data
  const snapshot: ProductRow = { ...product }

  try {
    if (field === 'productName') {
      product.productName = String(newValue ?? product.productName).trim()
    } else if (field === 'price') {
      product.price = Number(newValue ?? product.price)
    } else if (field === 'categoryId') {
      const nextCategoryId = newValue === null ? null : Number(newValue)
      product.categoryId = nextCategoryId
      const category = nextCategoryId !== null ? categoryMap.value.get(nextCategoryId) : undefined
      product.categoryName = category?.categoryName ?? ''
    } else {
      return
    }

    const selectedId = selectedProduct.value?.id
    await updateProductRow(product)
    await loadProducts()
    if (selectedId !== undefined) {
      selectedProduct.value = products.value.find((item) => item.id === selectedId) ?? null
    }
  } catch (error) {
    Object.assign(product, snapshot)
    const message = error instanceof Error ? error.message : 'Unable to update product.'
    toast.add({
      severity: 'error',
      summary: 'Update failed',
      detail: message,
      life: 5000,
    })
  }
}

function preparePayload(): ProductPayload {
  const trimmedName = form.productName.trim()
  const priceValue = Number(form.price)

  if (!trimmedName) {
    throw new Error('Product name is required.')
  }

  if (!Number.isFinite(priceValue)) {
    throw new Error('Price must be a valid number.')
  }

  if (form.categoryId === null) {
    throw new Error('Select a category.')
  }

  const category = categoryMap.value.get(form.categoryId)
  if (!category) {
    throw new Error('Selected category was not found.')
  }

  return {
    id: dialogMode.value === 'edit' ? form.id : 0,
    productName: trimmedName,
    price: priceValue,
    categoryId: form.categoryId,
    categoryName: category.categoryName,
    foto: form.foto.trim() || 'X',
  }
}

async function submitProduct() {
  try {
    const payload = preparePayload()
    savingProduct.value = true

    const isEdit = dialogMode.value === 'edit'
    const response = await fetch(PRODUCTS_API_URL, {
      method: isEdit ? 'PUT' : 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    let productId = form.id

    if (!isEdit) {
      let createdProduct: ApiProduct | null = null
      try {
        createdProduct = (await response.json()) as ApiProduct
      } catch {
        createdProduct = null
      }

      if (!createdProduct) {
        throw new Error('Unable to read the created product from the server.')
      }

      const normalized = normalizeProduct(createdProduct)
      productId = normalized.id
      form.id = normalized.id
      payload.id = normalized.id
    }

    await persistProductImage(productId, payload, isEdit)

    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: isEdit ? 'Product updated.' : 'Product created.',
      life: 4000,
    })

    productDialogVisible.value = false
    await loadProducts()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save product.'
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000,
    })
  } finally {
    savingProduct.value = false
  }
}

async function persistProductImage(
  productId: number,
  payload: ProductPayload,
  isEdit: boolean,
) {
  const hasNewFile = imageFile.value !== null
  const shouldRemoveImage = isEdit && removeExistingImage.value
  const shouldUpload = hasNewFile && imageFile.value !== null
  const shouldDelete = shouldRemoveImage || (!isEdit && !shouldUpload)

  if (!shouldUpload && !shouldDelete) {
    return
  }

  if (!productId) {
    throw new Error('Unable to resolve product identifier for image handling.')
  }

  if (shouldUpload && imageFile.value) {
    const newFileName = await uploadProductImage(productId, imageFile.value, isEdit)

    if (newFileName !== payload.foto) {
      payload.foto = newFileName
      if (isEdit) {
        await updateProductPayload(payload)
      }
    }

    form.foto = payload.foto
    hasExistingServerImage.value = payload.foto.toUpperCase() !== 'X'
    removeExistingImage.value = false

    imageFile.value = null
    clearObjectUrl()
    clearImageInput()

    imagePreviewUrl.value = hasExistingServerImage.value
      ? buildProductImageUrl(productId, payload.foto)
      : ''

    return
  }

  if (shouldDelete) {
    await deleteProductImage(productId)

    if (payload.foto.toUpperCase() !== 'X') {
      payload.foto = 'X'
      if (isEdit) {
        await updateProductPayload(payload)
      }
    }

    form.foto = 'X'
    hasExistingServerImage.value = false
    removeExistingImage.value = false
    imageFile.value = null
    clearObjectUrl()
    clearImageInput()
    imagePreviewUrl.value = ''
  }
}

async function loadProducts() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(PRODUCTS_API_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const payload = (await response.json()) as ApiProduct[] | unknown

    if (!Array.isArray(payload)) {
      throw new Error('Server returned an unexpected product format.')
    }

    products.value = payload.map(normalizeProduct)
    selectedProduct.value = null
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load products.'
    errorMessage.value = message
    toast.add({
      severity: 'error',
      summary: 'Error loading products',
      detail: message,
      life: 5000,
    })
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  if (categoriesLoading.value) {
    return
  }

  categoriesLoading.value = true

  try {
    const response = await fetch(CATEGORIES_API_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const payload = (await response.json()) as ApiCategory[] | unknown

    if (!Array.isArray(payload)) {
      throw new Error('Server returned an unexpected category format.')
    }

    categories.value = payload
      .map(normalizeCategory)
      .filter((item): item is CategoryOption => item !== null)
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load categories.'
    toast.add({
      severity: 'error',
      summary: 'Error loading categories',
      detail: message,
      life: 5000,
    })
  } finally {
    categoriesLoading.value = false
  }
}

watch(productDialogVisible, (visible) => {
  if (!visible) {
    resetImageState()
  }
})

onUnmounted(() => {
  resetImageState()
  resetImageEditorState()
})

onMounted(async () => {
  await Promise.all([loadCategories(), loadProducts()])
})
</script>

<template>
  <section class="product-view data-page">
    <PrimeToast />
    <PrimeConfirmDialog />

    <header class="data-page__header">
      <div>
        <h1 class="data-page__title">Products</h1>
      </div>
    </header>

    <PrimeDataTable v-model:filters="filters" v-model:selection="selectedProduct" :value="products" :loading="loading"
      dataKey="id" selectionMode="single" filterDisplay="menu" editMode="cell" stripedRows resizableColumns
      columnResizeMode="expand" paginator :rows="10" :rowsPerPageOptions="[5, 10, 20, 50]" scrollable
      scrollHeight="420px" class="product-view__table" @row-select="handleRowSelect" @row-unselect="handleRowUnselect"
      @cell-edit-complete="handleCellEditComplete">
      <template #header>
        <div class="product-view__table-header-actions data-table-header-actions">
          <PrimeButton class="data-table-header-button" label="Add" icon="pi pi-plus" severity="success"
            @click="openCreateDialog" />
          <PrimeButton class="data-table-header-button" label="Delete" icon="pi pi-trash" severity="danger"
            :disabled="!selectedProduct" @click="requestDeleteSelected" />
          <PrimeButton class="data-table-header-button" label="Edit" icon="pi pi-pencil" severity="warning"
            :disabled="!selectedProduct" @click="openEditSelected" />
          <PrimeButton class="data-table-header-button" label="Refresh" icon="pi pi-refresh" severity="secondary"
            :loading="loading" @click="loadProducts" />
          <PrimeButton class="data-table-header-button" label="Reset filters" icon="pi pi-filter-slash" text
            severity="secondary" @click="resetFilters" />
        </div>
      </template>

      <template #empty>
        <span v-if="loading">Loading products...</span>
        <span v-else>No products found.</span>
      </template>

      <PrimeColumn field="id" header="ID" sortable filter dataType="numeric" :editable="false" showFilterMenu
        showClearButton showApplyButton :filterMatchModeOptions="numberFilterOptions">
        <template #filter="{ filterModel }">
          <PrimeInputNumber v-model="filterModel.value" inputClass="w-full" :useGrouping="false" placeholder="ID"
            @keydown.enter.prevent />
        </template>
      </PrimeColumn>

      <PrimeColumn field="productName" header="Name" sortable filter showFilterMenu showClearButton showApplyButton
        :filterMatchModeOptions="textFilterOptions" editable>
        <template #editor="{ data, field }">
          <PrimeInputText v-model.trim="data[field]" class="w-full" autofocus />
        </template>
        <template #filter="{ filterModel }">
          <PrimeInputText v-model="filterModel.value" class="w-full" placeholder="Name" @keydown.enter.prevent />
        </template>
      </PrimeColumn>

      <PrimeColumn field="price" header="Price" sortable filter dataType="numeric" showFilterMenu showClearButton
        showApplyButton :filterMatchModeOptions="numberFilterOptions" style="width: 10rem" editable>
        <template #body="{ data }">
          {{ formatPrice(data.price) }}
        </template>
        <template #editor="{ data }">
          <PrimeInputNumber v-model="data.price" mode="decimal" :minFractionDigits="0" :maxFractionDigits="2"
            :useGrouping="false" inputClass="w-full" autofocus />
        </template>
        <template #filter="{ filterModel }">
          <PrimeInputNumber v-model="filterModel.value" inputClass="w-full" mode="decimal" :minFractionDigits="0"
            :maxFractionDigits="2" :useGrouping="false" placeholder="Price" @keydown.enter.prevent />
        </template>
      </PrimeColumn>

      <PrimeColumn field="categoryId" header="Category" sortable filter filterField="categoryName" showFilterMenu
        :showFilterMatchModes="false" :filterMenuStyle="{ width: '16rem' }" editable>
        <template #body="{ data }">
          {{ categoryMap.get(data.categoryId ?? -1)?.categoryName ?? 'None' }}
        </template>
        <template #editor="{ data }">
          <PrimeSelect v-model="data.categoryId" :options="categories" optionLabel="categoryName" optionValue="id"
            class="w-full" :loading="categoriesLoading" />
        </template>
        <template #filter="{ filterModel }">
          <PrimeMultiSelect v-model="filterModel.value" :options="categoryFilterOptions" optionLabel="label"
            optionValue="value" placeholder="Filter categories" display="chip" class="w-full" filter
            :loading="categoriesLoading" :showToggleAll="false" />
        </template>
      </PrimeColumn>

      <PrimeColumn field="foto" header="Image" :editable="false" style="width: 11rem">
        <template #body="{ data }">
          <figure class="product-photo product-photo--editable" role="button" tabindex="0"
            @dblclick="openImageEditor(data)" @keyup.enter="openImageEditor(data)">
            <img v-if="resolveImageUrl(data)" :src="resolveImageUrl(data)" :alt="data.productName" loading="lazy" />
            <span v-else class="product-photo--placeholder">No image</span>
          </figure>
        </template>
      </PrimeColumn>
    </PrimeDataTable>

    <p v-if="!loading && errorMessage" class="data-page__error">
      {{ errorMessage }}
    </p>

    <PrimeDialog v-model:visible="productDialogVisible" :header="dialogTitle" modal :style="{ width: '32rem' }"
      :closable="!savingProduct" class="create-product-dialog">
      <form class="dialog-form create-product-form" @submit.prevent="submitProduct">
        <div class="form-field">
          <label class="form-label" for="product-name">Name</label>
          <PrimeInputText id="product-name" v-model.trim="form.productName" :disabled="savingProduct" autofocus />
        </div>

        <div class="form-field">
          <label class="form-label" for="product-price">Price</label>
          <PrimeInputNumber id="product-price" v-model="form.price" mode="decimal" :minFractionDigits="0"
            :maxFractionDigits="2" :useGrouping="false" inputClass="w-full" :disabled="savingProduct"
            placeholder="Enter price" />
        </div>

        <div class="form-field">
          <label class="form-label" for="product-category">Category</label>
          <PrimeSelect id="product-category" v-model="form.categoryId" :options="categoryOptions"
            optionLabel="categoryName" optionValue="id" placeholder="Select a category" class="w-full"
            :loading="categoriesLoading" :disabled="savingProduct || categoriesLoading" />
        </div>

        <div class="form-field">
          <label class="form-label" for="product-foto">Image file</label>
          <div class="image-input">
            <input id="product-foto" ref="imageInputRef" type="file" accept="image/*" :disabled="savingProduct"
              @change="handleImageSelected" />
            <figure v-if="imagePreviewUrl" class="image-preview">
              <img :src="imagePreviewUrl" :alt="form.productName || 'Image preview'" />
            </figure>
            <span v-else class="image-placeholder">No image selected</span>
            <PrimeButton type="button" label="Remove image" icon="pi pi-trash" text severity="danger"
              :disabled="savingProduct || !canRemoveImage" @click="removeSelectedImage" />
          </div>
        </div>

        <div class="dialog-footer">
          <PrimeButton type="button" label="Cancel" icon="pi pi-times" text severity="secondary"
            :disabled="savingProduct" @click="productDialogVisible = false" />
          <PrimeButton type="submit" :label="submitButtonLabel" icon="pi pi-check" :loading="savingProduct" />
        </div>
      </form>
    </PrimeDialog>

    <PrimeDialog v-model:visible="imageEditorVisible" header="Edit image" modal :style="{ width: '28rem' }"
      :closable="!imageEditorLoading" class="product-image-dialog" @hide="resetImageEditorState">
      <div class="image-preview image-preview--dialog">
        <img v-if="imageEditorPreview" :src="imageEditorPreview" alt="Product image preview" />
        <span v-else class="image-placeholder">No image selected</span>
      </div>

      <div class="image-dialog-controls">
        <input ref="imageEditorInputRef" type="file" accept="image/*" :disabled="imageEditorLoading"
          @change="handleImageEditorFileSelected" />
        <PrimeButton type="button" label="Remove image" icon="pi pi-trash" text severity="danger"
          :disabled="imageEditorLoading" @click="removeImageEditorImage" />
      </div>

      <template #footer>
        <PrimeButton type="button" label="Cancel" icon="pi pi-times" text severity="secondary"
          :disabled="imageEditorLoading" @click="closeImageEditor" />
        <PrimeButton type="button" label="Save" icon="pi pi-check" :loading="imageEditorLoading"
          :disabled="!imageEditorCanSubmit" @click="submitImageEditor" />
      </template>
    </PrimeDialog>
  </section>
</template>
