<template>
  <section class="register">
    <AppCard class="register__card">
      <template #title>Регистрация</template>
      <template #content>
        <form class="register__form" @submit.prevent="handleSubmit">
          <div class="register__field">
            <label for="register-email">Email</label>
            <AppInputText
              id="register-email"
              v-model.trim="email"
              type="email"
              placeholder="Введите email"
              autocomplete="email"
              class="register__input"
              required
            />
          </div>

          <div class="register__field">
            <label for="register-password">Пароль</label>
            <AppPassword
              id="register-password"
              v-model="password"
              :feedback="false"
              toggle-mask
              placeholder="Введите пароль"
              autocomplete="new-password"
              class="register__input"
              input-class="register__input-field"
              required
            />
          </div>

          <div class="register__field">
            <label for="register-username">Имя пользователя</label>
            <AppInputText
              id="register-username"
              v-model.trim="userName"
              type="text"
              placeholder="Введите имя"
              autocomplete="name"
              class="register__input"
              required
            />
          </div>

          <AppMessage v-if="errorMessage" :closable="false" severity="error">
            {{ errorMessage }}
          </AppMessage>

          <AppButton
            type="submit"
            label="Зарегистрироваться"
            class="register__submit"
            :loading="isLoading"
            :disabled="isLoading"
          />
        </form>
      </template>
    </AppCard>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'

const router = useRouter()
const auth = useAuth()

const email = ref('')
const password = ref('')
const userName = ref('')
const errorMessage = ref('')

const isLoading = computed(() => auth.isLoading.value)

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
    await auth.register(email.value, password.value, userName.value)
    await router.replace({ name: 'home' })
  } catch (error) {
    if (error instanceof Error) {
      errorMessage.value = error.message
    } else {
      errorMessage.value = 'Не удалось выполнить регистрацию'
    }
  }
}
</script>

<style scoped>
.register {
  min-height: calc(100vh - 120px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.register__card {
  width: min(100%, 480px);
}

.register__form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.register__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.register__field label {
  font-weight: 600;
  color: #0f172a;
}

.register__input {
  width: 100%;
}

.register__input-field {
  width: 100%;
}

.register__submit {
  width: 100%;
  justify-content: center;
}
</style>
