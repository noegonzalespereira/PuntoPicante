import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'

import CajeroLayout from "./layouts/CajeroLayout";
import GerenteLayout from './layouts/GerenteLayout'
import CocinaLayout from './layouts/CocinaLayout'
import MeseroLayout from './layouts/MeseroLayout'

import DashboardGerente from './pages/gerente/DashboardGerente'
import CajaPage from './pages/gerente/CajaPage'
import GastosPage from './pages/gerente/GastosPage'
import StockPage from './pages/gerente/StockPage'
import ProductosPage from './pages/gerente/ProductosPage'
import UsuariosPage from './pages/gerente/UsuariosPage'
import ReportesPage from './pages/gerente/ReportesPage'
import RecetaPage from './pages/gerente/RecetaPage'
import PedidosPage from './pages/gerente/PedidosPage'
import CocinaPage from './pages/gerente/CocinaPage'
import PedidosCocinaPage from './pages/cocina/PedidosCocinaPage'
import PedidosMeseroPage from './pages/mesero/PedidosMeseroPage'

import LoginPage from './pages/login/LoginPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />

      {/* GERENTE */}
      <Route element={<ProtectedRoute roles={['GERENTE']} />}>
        <Route path="/gerente" element={<GerenteLayout />}>
          <Route path="dashboard" element={<DashboardGerente />} />
          <Route path="caja" element={<CajaPage />} />
          <Route path="gastos" element={<GastosPage />} />
          <Route path="inventario" element={<StockPage />} />
          <Route path="productos" element={<ProductosPage />} />
          <Route path="usuarios" element={<UsuariosPage />} />
          <Route path="reportes" element={<ReportesPage />} />
          <Route path="receta" element={<RecetaPage />} />
          <Route path="pedidos" element={<PedidosPage />} />
          <Route path="cocina" element={<CocinaPage />} />
        </Route>
      </Route>

      {/* CAJERO */}
      <Route element={<ProtectedRoute roles={['CAJERO']} />}>
        <Route path="/cajero" element={<CajeroLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardGerente />} />
          <Route path="pedidos" element={<PedidosPage />} />
          <Route path="gastos" element={<GastosPage />} />
          <Route path="caja" element={<CajaPage />} />
          <Route path="inventario" element={<StockPage />} />
          <Route path="reportes" element={<ReportesPage />} />
        </Route>
      </Route>

      {/* COCINA */}
      <Route element={<ProtectedRoute roles={['COCINA']} />}>
        <Route path="/cocina" element={<CocinaLayout />}>
          <Route index element={<PedidosCocinaPage />} />
          <Route path="inventario" element={<StockPage />} />
        </Route>
      </Route>

      {/* MESERO */}
      <Route element={<ProtectedRoute roles={['MESERO']} />}>
        <Route path="/mesero" element={<MeseroLayout />}>
          <Route index element={<PedidosMeseroPage />} />
        </Route>
      </Route>

      <Route path="*" element={<div style={{padding:24}}>404</div>} />
    </Routes>
  )
}
