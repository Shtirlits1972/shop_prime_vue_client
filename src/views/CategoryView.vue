<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { FilterMatchMode, FilterOperator } from '@primevue/core/api'
import type { ColumnFilterMatchModeOptions } from 'primevue/column'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'

import PrimeButton from 'primevue/button'
import PrimeColumn from 'primevue/column'
import PrimeConfirmDialog from 'primevue/confirmdialog'
import PrimeDataTable from 'primevue/datatable'
import PrimeDialog from 'primevue/dialog'
import PrimeInputNumber from 'primevue/inputnumber'
import PrimeInputText from 'primevue/inputtext'
import PrimeToast from 'primevue/toast'
import type { DataTableCellEditCompleteEvent } from 'primevue/datatable'

import { BASE_URL } from '../config/env'
import {
  NUMBER_FILTER_MATCH_MODES,
  TEXT_FILTER_MATCH_MODES,
} from '../scripts/filter'
import '@/styles/data-table.css'

defineOptions({ name: 'CategoryView' })

const API_BASE = (BASE_URL ?? '').replace(/\/$/, '')

function buildApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return API_BASE ? `${API_BASE}${normalized}` : normalized
}

const CATEGORY_API_URL = buildApiUrl('/api/Category')

interface Category {
  id: number
  categoryName: string
}

const toast = useToast()
const confirm = useConfirm()

const categories = ref<Category[]>([])
const loading = ref(false)
const errorMessage = ref('')
const selectedCategory = ref<Category | null>(null)

const createDialogVisible = ref(false)
const newCategoryName = ref('')
const savingCategory = ref(false)

const editDialogVisible = ref(false)
const editCategoryName = ref('')
const editingCategoryId = ref<number | null>(null)
const updatingCategory = ref(false)

const deletingCategoryId = ref<number | null>(null)
const inlineEditingId = ref<number | null>(null)

const TEXT_FILTER_OPTIONS = TEXT_FILTER_MATCH_MODES.map(
  (option) =>
    ({
      label: option.label,
      value: option.value,
    }) as ColumnFilterMatchModeOptions,
)

const NUMBER_FILTER_OPTIONS = NUMBER_FILTER_MATCH_MODES.map(
  (option) =>
    ({
      label: option.label,
      value: option.value,
    }) as ColumnFilterMatchModeOptions,
)

const datatablePassThrough = reactive({
  column: {
    bodycell: ({ state }: { state: Record<string, boolean> }) => ({
      class: [{ '!py-0': state['d_editing'] }],
    }),
  },
})

const filters = ref(createFilters())

const hasCategories = computed(() => categories.value.length > 0)

function isCategory(value: unknown): value is Category {
  if (!value || typeof value !== 'object') {
    return false
  }
  const record = value as Record<string, unknown>
  return typeof record.id === 'number' && typeof record.categoryName === 'string'
}

function createFilters() {
  return {
    id: {
      operator: FilterOperator.AND,
      constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }],
    },
    categoryName: {
      operator: FilterOperator.AND,
      constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }],
    },
  }
}

function resetFilters() {
  filters.value = createFilters()
}

function buildRequestInit(method: string, body?: unknown): RequestInit {
  const init: RequestInit = {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  }

  if (body !== undefined) {
    init.headers = {
      ...init.headers,
      'Content-Type': 'application/json',
    }
    init.body = JSON.stringify(body)
  }

  return init
}

async function fetchCategories() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(CATEGORY_API_URL, buildRequestInit('GET'))
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const payload = (await response.json()) as unknown

    if (!Array.isArray(payload)) {
      throw new Error('Некорректный формат ответа сервера')
    }

    categories.value = payload.filter(isCategory).map((item) => ({
      id: item.id,
      categoryName: item.categoryName,
    }))
    selectedCategory.value = null
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось загрузить категории'
    errorMessage.value = message
    toast.add({
      severity: 'error',
      summary: 'Ошибка загрузки',
      detail: message,
      life: 5000,
    })
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  newCategoryName.value = ''
  createDialogVisible.value = true
}

function cancelCreateDialog() {
  createDialogVisible.value = false
  newCategoryName.value = ''
}

async function saveCategory() {
  const trimmedName = newCategoryName.value.trim()
  if (!trimmedName) {
    toast.add({
      severity: 'warn',
      summary: 'Пустое поле',
      detail: 'Введите название категории.',
      life: 4000,
    })
    return
  }

  savingCategory.value = true

  try {
    const response = await fetch(
      CATEGORY_API_URL,
      buildRequestInit('POST', { categoryName: trimmedName }),
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const payload = (await response.json()) as unknown
    if (!isCategory(payload)) {
      throw new Error('Некорректный ответ сервера')
    }

    categories.value = [...categories.value, payload].sort((a, b) => a.id - b.id)
    selectedCategory.value = payload

    toast.add({
      severity: 'success',
      summary: 'Категория создана',
      detail: `«${payload.categoryName}» добавлена.`,
      life: 4000,
    })

    cancelCreateDialog()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось создать категорию'
    toast.add({
      severity: 'error',
      summary: 'Ошибка создания',
      detail: message,
      life: 5000,
    })
  } finally {
    savingCategory.value = false
  }
}

function openEditDialog() {
  if (!selectedCategory.value) {
    toast.add({
      severity: 'warn',
      summary: 'Не выбрана запись',
      detail: 'Выберите категорию для редактирования.',
      life: 4000,
    })
    return
  }

  editingCategoryId.value = selectedCategory.value.id
  editCategoryName.value = selectedCategory.value.categoryName ?? ''
  editDialogVisible.value = true
}

function cancelEditDialog() {
  editDialogVisible.value = false
  editCategoryName.value = ''
  editingCategoryId.value = null
}

async function persistCategoryName(id: number, name: string) {
  const response = await fetch(
    CATEGORY_API_URL,
    buildRequestInit('PUT', { id, categoryName: name }),
  )

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
}

function applyCategoryName(id: number, name: string) {
  categories.value = categories.value.map((category) =>
    category.id === id ? { ...category, categoryName: name } : category,
  )

  if (selectedCategory.value?.id === id) {
    selectedCategory.value = { id, categoryName: name }
  }
}

async function updateCategory() {
  const trimmedName = editCategoryName.value.trim()
  const categoryId = editingCategoryId.value

  if (!trimmedName || !categoryId) {
    toast.add({
      severity: 'warn',
      summary: 'Пустое поле',
      detail: 'Введите название категории.',
      life: 4000,
    })
    return
  }

  updatingCategory.value = true

  try {
    await persistCategoryName(categoryId, trimmedName)
    applyCategoryName(categoryId, trimmedName)
    toast.add({
      severity: 'success',
      summary: 'Категория обновлена',
      detail: `«${trimmedName}» сохранена.`,
      life: 4000,
    })

    cancelEditDialog()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось обновить категорию'
    toast.add({
      severity: 'error',
      summary: 'Ошибка сохранения',
      detail: message,
      life: 5000,
    })
  } finally {
    updatingCategory.value = false
  }
}

function requestDeleteCategory() {
  if (!selectedCategory.value) {
    toast.add({
      severity: 'warn',
      summary: 'Не выбрана запись',
      detail: 'Выберите категорию для удаления.',
      life: 4000,
    })
    return
  }

  const target = { ...selectedCategory.value }

  confirm.require({
    header: 'Удалить категорию',
    message: `Удалить «${target.categoryName}»?`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Удалить',
    rejectLabel: 'Отмена',
    acceptClass: 'p-button-danger',
    accept: () => deleteCategory(target),
  })
}

async function deleteCategory(category: Category) {
  deletingCategoryId.value = category.id

  try {
    const response = await fetch(
      `${CATEGORY_API_URL}/${encodeURIComponent(String(category.id))}`,
      buildRequestInit('DELETE'),
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    categories.value = categories.value.filter((item) => item.id !== category.id)

    if (selectedCategory.value?.id === category.id) {
      selectedCategory.value = null
    }

    toast.add({
      severity: 'success',
      summary: 'Категория удалена',
      detail: `«${category.categoryName}» удалена.`,
      life: 4000,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось удалить категорию'
    toast.add({
      severity: 'error',
      summary: 'Ошибка удаления',
      detail: message,
      life: 5000,
    })
  } finally {
    deletingCategoryId.value = null
  }
}

onMounted(fetchCategories)

async function handleCellEditComplete(event: DataTableCellEditCompleteEvent<Category>) {
  if (event.field !== 'categoryName') {
    return
  }

  const originalValue = typeof event.value === 'string' ? event.value.trim() : ''
  const proposedValue = typeof event.newValue === 'string' ? event.newValue.trim() : ''

  if (!proposedValue) {
    event.data.categoryName = originalValue
    toast.add({
      severity: 'warn',
      summary: 'Пустое значение',
      detail: 'Название категории не может быть пустым.',
      life: 4000,
    })
    return
  }

  if (originalValue === proposedValue) {
    event.data.categoryName = originalValue
    return
  }

  inlineEditingId.value = event.data.id

  try {
    await persistCategoryName(event.data.id, proposedValue)
    applyCategoryName(event.data.id, proposedValue)
    toast.add({
      severity: 'success',
      summary: 'Категория обновлена',
      detail: `«${proposedValue}» сохранена.`,
      life: 3000,
    })
  } catch (error) {
    event.data.categoryName = originalValue
    applyCategoryName(event.data.id, originalValue)
    const message = error instanceof Error ? error.message : 'Не удалось сохранить изменения'
    toast.add({
      severity: 'error',
      summary: 'Ошибка сохранения',
      detail: message,
      life: 5000,
    })
  } finally {
    inlineEditingId.value = null
  }
}
</script>

<template>
  <section class="category-view">
    <PrimeToast />
    <PrimeConfirmDialog />

    <header class="category-view__header">
      <div>
        <h1 class="category-view__title">Категории</h1>
        <p class="category-view__subtitle">Управление категориями товаров</p>
      </div>
    </header>

    <PrimeDataTable
      v-model:selection="selectedCategory"
      v-model:filters="filters"
      :value="categories"
      :loading="loading"
      dataKey="id"
      selectionMode="single"
      filterDisplay="menu"
      stripedRows
      resizableColumns
      columnResizeMode="expand"
      editMode="cell"
      :pt="datatablePassThrough"
      scrollable
      scrollHeight="420px"
      responsiveLayout="scroll"
      paginator
      :rows="10"
      :rowsPerPageOptions="[5, 10, 20, 50]"
      class="category-view__table"
      @cell-edit-complete="handleCellEditComplete"
    >
      <template #header>
        <div class="category-view__toolbar data-table-header-actions">
          <PrimeButton
            class="category-view__toolbar-btn data-table-header-button"
            label="Добавить"
            icon="pi pi-plus"
            severity="success"
            @click="openCreateDialog"
          />
          <PrimeButton
            class="category-view__toolbar-btn data-table-header-button"
            label="Удалить"
            icon="pi pi-trash"
            severity="danger"
            :disabled="!selectedCategory"
            :loading="!!deletingCategoryId"
            @click="requestDeleteCategory"
          />
          <PrimeButton
            class="category-view__toolbar-btn data-table-header-button"
            label="Редактировать"
            icon="pi pi-pencil"
            severity="warning"
            :disabled="!selectedCategory"
            @click="openEditDialog"
          />
          <PrimeButton
            class="category-view__toolbar-btn data-table-header-button"
            label="Обновить"
            icon="pi pi-refresh"
            severity="secondary"
            :disabled="loading"
            @click="fetchCategories"
          />
          <PrimeButton
            class="category-view__toolbar-btn data-table-header-button"
            label="Сбросить фильтры"
            icon="pi pi-filter-slash"
            text
            severity="secondary"
            @click="resetFilters"
          />
        </div>
      </template>

      <template #empty>
        <span v-if="loading">Загрузка категорий...</span>
        <span v-else>Категории не найдены.</span>
      </template>

      <PrimeColumn
        field="id"
        header="ID"
        sortable
        filter
        dataType="numeric"
        filterField="id"
        showFilterMenu
        showClearButton
        showApplyButton
        :filterMatchModeOptions="NUMBER_FILTER_OPTIONS"
      >
        <template #filter="{ filterModel }">
          <PrimeInputNumber
            v-model="filterModel.value"
            inputClass="w-full"
            :useGrouping="false"
            placeholder="Введите ID"
            @keydown.enter.prevent
          />
        </template>
      </PrimeColumn>

      <PrimeColumn
        field="categoryName"
        header="Название"
        sortable
        filter
        filterField="categoryName"
        dataType="text"
        showFilterMenu
        showClearButton
        showApplyButton
        :filterMatchModeOptions="TEXT_FILTER_OPTIONS"
        :editable="true"
      >
        <template #filter="{ filterModel }">
          <PrimeInputText
            v-model="filterModel.value"
            class="w-full"
            placeholder="Название категории"
            @keydown.enter.prevent
          />
        </template>
        <template #editor="{ data, field }">
          <PrimeInputText
            v-model="data[field]"
            class="w-full"
            :disabled="inlineEditingId !== null"
            autofocus
          />
        </template>
      </PrimeColumn>
    </PrimeDataTable>

    <p v-if="!loading && !hasCategories && !errorMessage" class="category-view__empty">
      Категории не найдены.
    </p>

    <p v-if="!loading && errorMessage" class="category-view__error">
      {{ errorMessage }}
    </p>

    <PrimeDialog
      v-model:visible="createDialogVisible"
      header="Новая категория"
      modal
      :style="{ width: '26rem' }"
      :closable="!savingCategory"
      class="category-view__dialog"
      @hide="cancelCreateDialog"
    >
      <form class="category-view__form" @submit.prevent="saveCategory">
        <label for="category-name" class="category-view__label">Название категории</label>
        <PrimeInputText
          id="category-name"
          v-model.trim="newCategoryName"
          :disabled="savingCategory"
          autofocus
        />
        <div class="category-view__dialog-actions">
          <PrimeButton
            type="button"
            label="Отмена"
            icon="pi pi-times"
            text
            severity="secondary"
            :disabled="savingCategory"
            @click="cancelCreateDialog"
          />
          <PrimeButton
            type="submit"
            label="Сохранить"
            icon="pi pi-check"
            :loading="savingCategory"
          />
        </div>
      </form>
    </PrimeDialog>

    <PrimeDialog
      v-model:visible="editDialogVisible"
      header="Редактирование категории"
      modal
      :style="{ width: '26rem' }"
      :closable="!updatingCategory"
      class="category-view__dialog"
      @hide="cancelEditDialog"
    >
      <form class="category-view__form" @submit.prevent="updateCategory">
        <label for="edit-category-name" class="category-view__label">Название категории</label>
        <PrimeInputText
          id="edit-category-name"
          v-model.trim="editCategoryName"
          :disabled="updatingCategory"
          autofocus
        />
        <div class="category-view__dialog-actions">
          <PrimeButton
            type="button"
            label="Отмена"
            icon="pi pi-times"
            text
            severity="secondary"
            :disabled="updatingCategory"
            @click="cancelEditDialog"
          />
          <PrimeButton
            type="submit"
            label="Сохранить"
            icon="pi pi-check"
            :loading="updatingCategory"
          />
        </div>
      </form>
    </PrimeDialog>
  </section>
</template>

<style scoped>
.category-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.category-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.category-view__title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  color: #0f172a;
}

.category-view__subtitle {
  margin: 0.25rem 0 0;
  color: #475569;
}

.category-view__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: flex-start;
  width: 100%;
}

.category-view__toolbar-btn {
  flex: 0 0 var(--data-table-header-button-width, 12rem);
}

.category-view__table {
  min-height: 320px;
}

.category-view__empty,
.category-view__error {
  margin: 0;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(15, 23, 42, 0.12);
}

.category-view__error {
  color: #b91c1c;
  border-color: rgba(185, 28, 28, 0.3);
  background: rgba(254, 226, 226, 0.6);
}

.category-view__dialog {
  max-width: 100%;
}

.category-view__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.category-view__label {
  font-weight: 600;
  color: #0f172a;
}

.category-view__dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
