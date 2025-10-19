import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import CategoryView from '../views/CategoryView.vue'
import ProductView from '../views/ProductView.vue'
import OrderHeadView from '../views/OrderHeadView.vue'
import UsersView from '../views/UsersView.vue'
import { useAuth } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/categories',
      name: 'categories',
      component: CategoryView,
      meta: { requiresAuth: true },
    },
    {
      path: '/products',
      name: 'products',
      component: ProductView,
      meta: { requiresAuth: true },
    },
    {
      path: '/orders',
      name: 'orders',
      component: OrderHeadView,
      meta: { requiresAuth: true },
    },
    {
      path: '/users',
      name: 'users',
      component: UsersView,
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/orderdetail/:OrderId?', //  "OrderId?"
      name: 'OrderDetail',
      component: () => import('@/views/OrderDetailView.vue'),
      props: (route) => {
        const raw = Array.isArray(route.params.OrderId) ? route.params.OrderId[0] : route.params.OrderId
        const fromQuery = Array.isArray(route.query?.OrderId) ? route.query?.OrderId[0] : route.query?.OrderId
        const normalized = raw ?? fromQuery ?? '0'
        const parsed = Number.parseInt(normalized, 10)
        return { OrderId: Number.isFinite(parsed) ? parsed : 0 }
      },
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { requiresGuest: true },
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView,
      meta: { requiresGuest: true },
    },
  ],
})

router.beforeEach(async (to, from, next) => {
  const auth = useAuth()
  if (!auth.initialized.value && !auth.isLoading.value) {
    await auth.initialize()
  }

  if (to.meta?.requiresAuth && !auth.isAuthenticated.value) {
    next({
      name: 'login',
      query: { redirect: to.fullPath },
    })
    return
  }

  if (to.meta?.requiresAdmin && auth.role.value !== 'admin') {
    next({ name: 'home' })
    return
  }

  if (to.meta?.requiresGuest && auth.isAuthenticated.value) {
    next({ name: 'home' })
    return
  }

  next()
})

export default router
