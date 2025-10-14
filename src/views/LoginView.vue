<template>
  <section class="login">
    <AppCard class="login__card">
      <template #title>Вход</template>
      <template #content>
        <form class="login__form" @submit.prevent="handleSubmit">
          <div class="login__field">
            <label for="login-email">Email</label>
            <AppInputText
              id="login-email"
              v-model.trim="email"
              type="email"
              placeholder="Введите email"
              autocomplete="email"
              class="login__input"
              required
            />
          </div>
          <div class="login__field">
            <label for="login-password">Пароль</label>
            <AppPassword
              id="login-password"
              v-model="password"
              :feedback="false"
              toggle-mask
              placeholder="Введите пароль"
              autocomplete="current-password"
              class="login__input"
              input-class="login__input-field"
              required
            />
          </div>

          <AppMessage v-if="errorMessage" :closable="false" severity="error">
            {{ errorMessage }}
          </AppMessage>

          <AppButton
            type="submit"
            label="Вход"
            class="login__submit"
            :loading="isLoading"
            :disabled="isLoading"
          />
          <AppButton
            type="button"
            label="Регистрация"
            class="login__secondary"
            severity="secondary"
            outlined
            @click="goToRegister"
          />
        </form>
      </template>
    </AppCard>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuth()

const email = ref('')
const password = ref('')
const errorMessage = ref('')

const isLoading = computed(() => auth.isLoading.value)
const redirectPath = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.trim().length > 0 ? redirect : '/'
})

watch(
  () => auth.error.value,
  (value) => {
    if (value) {
      errorMessage.value = value
    }
  },
  { immediate: true }
)

async function handleSubmit() {
  errorMessage.value = ''
  try {
    await auth.login(email.value, password.value)
    await router.replace(redirectPath.value)
  } catch (error) {
    if (error instanceof Error) {
      errorMessage.value = error.message
    } else {
      errorMessage.value = 'Не удалось выполнить вход'
    }
  }
}

function goToRegister() {
  router.push({ name: 'register', query: route.query })
}
</script>

<style scoped>
.login {
  min-height: calc(100vh - 120px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.login__card {
  width: min(100%, 420px);
}

.login__form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.login__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.login__field label {
  font-weight: 600;
  color: #0f172a;
}

.login__input {
  width: 100%;
}

.login__input-field {
  width: 100%;
}

.login__submit {
  width: 100%;
  justify-content: center;
}

.login__secondary {
  width: 100%;
  justify-content: center;
  margin-top: 0.5rem;
}
</style>
