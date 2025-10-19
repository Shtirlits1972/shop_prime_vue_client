<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter, RouterLink, RouterView } from 'vue-router'
import { useAuth } from './stores/auth'

const router = useRouter()
const auth = useAuth()
const loggingOut = ref(false)

const isAuthenticated = computed(() => auth.isAuthenticated.value)
const userName = computed(() => auth.userName.value || 'пользователь')
const isLoading = computed(() => auth.isLoading.value)
const isAdmin = computed(() => auth.role.value === 'admin')

onMounted(() => {
  auth.initialize()
})

function handleLoginClick() {
  router.push({ name: 'login' })
}

async function handleLogoutClick() {
  if (loggingOut.value) {
    return
  }
  loggingOut.value = true
  try {
    await auth.logout()
    router.push({ name: 'home' })
  } catch (error) {
    console.error('Ошибка при выходе', error)
  } finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <div class="app">
    <header class="app__header">
      <div class="app__brand">
        <RouterLink class="app__logo" to="/">Shop Vue</RouterLink>
      </div>
      <nav class="app__nav">
        <RouterLink class="app__nav-link" to="/">Home</RouterLink>
        <RouterLink class="app__nav-link" to="/about">About</RouterLink>
        <RouterLink
          v-if="isAuthenticated"
          class="app__nav-link"
          to="/categories"
        >
          Categories
        </RouterLink>
        <RouterLink
          v-if="isAuthenticated"
          class="app__nav-link"
          to="/products"
        >
          Products
        </RouterLink>
        <RouterLink
          v-if="isAuthenticated"
          class="app__nav-link"
          to="/orders"
        >
          Orders
        </RouterLink>
        <RouterLink
          v-if="isAuthenticated && isAdmin"
          class="app__nav-link"
          to="/users"
        >
          Users
        </RouterLink>
      </nav>
      <div class="app__auth">
        <template v-if="isAuthenticated">
          <span class="app__greeting">
            Привет, {{ userName }}!
          </span>
          <button
            class="app__action app__action--secondary"
            type="button"
            :disabled="loggingOut || isLoading"
            @click="handleLogoutClick"
          >
            {{ loggingOut ? 'Выходим...' : 'Выход' }}
          </button>
        </template>
        <template v-else>
          <button
            class="app__action app__action--primary"
            type="button"
            :disabled="isLoading"
            @click="handleLoginClick"
          >
            Вход
          </button>
        </template>
      </div>
    </header>

    <div class="app__content">
      <main class="app__main">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
:global(body) {
  display: block;
  margin: 0;
}

:global(#app) {
  max-width: none;
  margin: 0;
  padding: 0;
  display: block;
}

.app {
  min-height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
}

.app__header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 1.5rem;
  padding: 1rem 2rem;
  background: #0f172a;
  color: #f8fafc;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.2);
}

.app__brand {
  font-size: 1.25rem;
  font-weight: 600;
}

.app__logo {
  color: inherit;
  font-weight: 700;
  font-size: 1.5rem;
  text-decoration: none;
}

.app__logo:hover {
  color: #38bdf8;
}

.app__nav {
  display: flex;
  gap: 0.75rem;
  margin-left: 1rem;
}

.app__nav-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 7rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  background: #38bdf8;
  color: #0f172a;
  font-weight: 600;
  text-decoration: none;
  transition:
    background 0.2s ease,
    color 0.2s ease;
}

.app__nav-link:hover {
  background: #0ea5e9;
  color: #0f172a;
}

.router-link-active.app__nav-link {
  background: #0ea5e9;
  color: #0f172a;
}

.app__auth {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: auto;
}

.app__greeting {
  font-weight: 600;
  white-space: nowrap;
}

.app__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  border: none;
  font-weight: 600;
  cursor: pointer;
  padding: 0.5rem 1rem;
  transition:
    background 0.2s ease,
    color 0.2s ease,
    opacity 0.2s ease;
}

.app__action:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.app__action--primary {
  background: #38bdf8;
  color: #0f172a;
}

.app__action--primary:hover:not(:disabled) {
  background: #0ea5e9;
}

.app__action--secondary {
  background: transparent;
  color: #f8fafc;
  border: 1px solid rgba(248, 250, 252, 0.4);
}

.app__action--secondary:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.2);
}

.app__content {
  flex: 1;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
}

.app__main {
  flex: 1;
  padding: 1.5rem;
}

.app__main h1 {
  margin-top: 0;
}

@media (min-width: 768px) {
  .app__header {
    padding: 1.25rem 2.5rem;
  }
}

@media (min-width: 1024px) {
  :global(body) {
    display: block;
  }

  :global(#app) {
    display: block;
  }
}
</style>
