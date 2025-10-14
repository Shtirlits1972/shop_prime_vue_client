import { FilterMatchMode } from '@primevue/core/api'

export type FilterMatchModeValue = (typeof FilterMatchMode)[keyof typeof FilterMatchMode]

export interface FilterMatchModeOption {
  label: string
  value: FilterMatchModeValue
}

export const TEXT_FILTER_MATCH_MODES: readonly FilterMatchModeOption[] = Object.freeze([
  { label: 'Начинается с', value: FilterMatchMode.STARTS_WITH },
  { label: 'Содержит', value: FilterMatchMode.CONTAINS },
  { label: 'Не содержит', value: FilterMatchMode.NOT_CONTAINS },
  { label: 'Заканчивается на', value: FilterMatchMode.ENDS_WITH },
  { label: 'Равно', value: FilterMatchMode.EQUALS },
  { label: 'Не равно', value: FilterMatchMode.NOT_EQUALS },
])

export const NUMBER_FILTER_MATCH_MODES: readonly FilterMatchModeOption[] = Object.freeze([
  { label: 'Равно', value: FilterMatchMode.EQUALS },
  { label: 'Не равно', value: FilterMatchMode.NOT_EQUALS },
  { label: 'Больше', value: FilterMatchMode.GREATER_THAN },
  { label: 'Больше или равно', value: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO },
  { label: 'Меньше', value: FilterMatchMode.LESS_THAN },
  { label: 'Меньше или равно', value: FilterMatchMode.LESS_THAN_OR_EQUAL_TO },
])

export const BOOLEAN_FILTER_MATCH_MODES: readonly FilterMatchModeOption[] = Object.freeze([
  { label: 'Равно', value: FilterMatchMode.EQUALS },
  { label: 'Не равно', value: FilterMatchMode.NOT_EQUALS },
])
