import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import './shell.css'

const Landing = lazy(() => import('../landing/Landing').then(m => ({ default: m.Landing })))
const Login = lazy(() => import('./Login').then(m => ({ default: m.Login })))
const RequireSession = lazy(() => import('./RequireSession').then(m => ({ default: m.RequireSession })))
const PortalLayout = lazy(() => import('./PortalLayout').then(m => ({ default: m.PortalLayout })))
const Home = lazy(() => import('./Home').then(m => ({ default: m.Home })))
const CollectRoutes = lazy(() => import('../features/collect').then(m => ({ default: m.CollectRoutes })))
const ReportRoutes = lazy(() => import('../features/reports').then(m => ({ default: m.ReportRoutes })))

function LoadingPage() {
  return <p className="route-loading" role="status">Cargando página…</p>
}

export function App() {
  return <HashRouter><Suspense fallback={<LoadingPage />}><Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/login" element={<Login />} />
    <Route element={<RequireSession />}>
      <Route element={<PortalLayout />}>
        <Route path="/portal" element={<Home />} />
        <Route path="/recoleccion/*" element={<CollectRoutes />} />
        <Route path="/visualizacion/*" element={<ReportRoutes />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense></HashRouter>
}
