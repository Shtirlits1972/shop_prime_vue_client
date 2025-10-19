import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Message from 'primevue/message'
import Card from 'primevue/card'
import 'primeicons/primeicons.css'


const primeVueLocale = {
  startsWith: 'Начинается с',
  contains: 'Содержит',
  notContains: 'Не содержит',
  endsWith: 'Заканчивается на',
  equals: 'Равно',
  notEquals: 'Не равно',
  noFilter: 'Без фильтра',
  lt: 'Меньше чем',
  lte: 'Меньше или равно',
  gt: 'Больше чем',
  gte: 'Больше или равно',
  dateIs: 'Дата равна',
  dateIsNot: 'Дата не равна',
  dateBefore: 'Дата до',
  dateAfter: 'Дата после',
  clear: 'Очистить',
  apply: 'Применить',
  matchAll: 'Все условия',
  matchAny: 'Любое условие',
  addRule: 'Добавить правило',
  removeRule: 'Удалить правило',
  accept: 'Да',
  reject: 'Нет',
  choose: 'Выбрать',
  upload: 'Загрузить',
  cancel: 'Отмена',
  completed: 'Готово',
  pending: 'В ожидании',
  chooseDate: 'Выберите дату',
  chooseTime: 'Выберите время',
  chooseAll: 'Выбрать все',
  unselectAll: 'Снять выбор',
  close: 'Закрыть',
  dayNames: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
  dayNamesShort: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
  dayNamesMin: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  monthNames: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
  monthNamesShort: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  today: 'Сегодня',
  weekHeader: 'Нед',
  firstDayOfWeek: 1,
  dateFormat: 'dd.mm.yyyy',
  weak: 'Слабый',
  medium: 'Средний',
  strong: 'Сильный',
  passwordPrompt: 'Введите пароль',
  emptyFilterMessage: 'Нет данных',
  emptyMessage: 'Ничего не найдено'
}

const app = createApp(App)

app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
  locale: primeVueLocale,
})
app.use(ToastService)
app.use(ConfirmationService)

app.component('AppButton', Button)
app.component('AppInputText', InputText)
app.component('AppPassword', Password)
app.component('AppMessage', Message)
app.component('AppCard', Card)

app.mount('#app')
