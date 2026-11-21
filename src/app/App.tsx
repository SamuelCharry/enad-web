import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import { Landing } from '../landing/Landing'
import { CollectRoutes } from '../features/collect'
import { ReportRoutes } from '../features/reports'

function Home() {
  return (
    <main>
      <Link to="/recoleccion">Recolección de datos</Link>
      <Link to="/visualizacion">Visualización de datos</Link>
    </main>
  )
}

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/portal" element={<Home />} />
        <Route path="/recoleccion/*" element={<CollectRoutes />} />
        <Route path="/visualizacion/*" element={<ReportRoutes />} />
      </Routes>
    </HashRouter>
  )
}
