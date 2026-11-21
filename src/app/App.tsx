import '../ui/tokens.css'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Landing } from '../landing/Landing'
import { CollectRoutes } from '../features/collect'
import { ReportRoutes } from '../features/reports'
import { Home } from './Home'
import { Login } from './Login'
import { PortalLayout } from './PortalLayout'
import { RequireSession } from './RequireSession'
import './shell.css'

export function App() {
  return <HashRouter><Routes>
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
  </Routes></HashRouter>
}
