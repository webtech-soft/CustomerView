import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'
import TicketsPage from './pages/TicketsPage.vue'
import CheckInsPage from './pages/CheckInsPage.vue'
import FeedbackPage from './pages/FeedbackPage.vue'
import AppointmentsPage from './pages/AppointmentsPage.vue'
import AppointmentsDashboardPage from './pages/AppointmentsDashboardPage.vue'
import AppointmentsWidgetPage from './pages/AppointmentsWidgetPage.vue'
import AppointmentReschedulePage from './pages/AppointmentReschedulePage.vue'
import CustomerInvoiceView from './pages/CustomerInvoiceView.vue'

const routes = [
  { path: '/', component: TicketsPage },
  { path: '/tickets', component: TicketsPage },
  { path: '/inspections', redirect: { path: '/tickets', query: { view: 'wip' } } },
  { path: '/check-in', component: CheckInsPage },
  { path: '/checkins', component: CheckInsPage }, // Alias for consistency
  { path: '/feedback', component: FeedbackPage },
  { path: '/appointments', component: AppointmentsDashboardPage },
  { path: '/appointments/book', component: AppointmentsPage },
  { path: '/appointments/widget', component: AppointmentsWidgetPage },
  { path: '/appointments/reschedule', component: AppointmentReschedulePage },
  { path: '/view/:token', component: CustomerInvoiceView }, // Legacy route for backward compatibility
  { path: '/cv', component: CustomerInvoiceView }, // New customer view route with token query parameter
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

const app = createApp(App)
app.use(router)
app.mount('#app')

