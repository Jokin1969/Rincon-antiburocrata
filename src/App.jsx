import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import DocumentosCicHub from './pages/documentos-cic/DocumentosCicHub'
import Layout from './components/Layout'
import Home from './pages/Home'
import GenScriptHome from './pages/genscript/GenScriptHome'
import EndUserStatement from './pages/genscript/EndUserStatement'
import MOHQuestions from './pages/genscript/MOHQuestions'
import AduanasHome from './pages/aduanas/AduanasHome'
import FacturaProforma from './pages/aduanas/FacturaProforma'
import PqpImport from './pages/aduanas/PqpImport'
import Documento1403 from './pages/aduanas/Documento1403'
import DeclaracionExenta from './pages/aduanas/DeclaracionExenta'
import CertNoPeligrosidad from './pages/aduanas/CertNoPeligrosidad'
import AdaptarCarta from './pages/adaptarcarta/AdaptarCarta'
import GestorLogos from './pages/logos/GestorLogos'
import ContratoMenorPage from './pages/contratomenos/ContratoMenorPage'
import CertificadoExclusividad from './pages/contratomenor/CertificadoExclusividad'
import AnimalarioHub from './pages/animalario/AnimalarioHub'
import ProyectosList from './pages/animalario/ProyectosList'
import ProyectoHub from './pages/animalario/ProyectoHub'
import SeccionAForm from './pages/animalario/seccionA/SeccionAForm'
import ProcedimientosHub from './pages/animalario/seccionB/ProcedimientosHub'
import SeccionBForm from './pages/animalario/seccionB/SeccionBForm'
import SeccionCForm from './pages/animalario/seccionC/SeccionCForm'
import SeccionDForm from './pages/animalario/seccionD/SeccionDForm'
import ModificacionForm from './pages/animalario/modificacion/ModificacionForm'
import GastosViajeList from './pages/gastosviaje/GastosViajeList'
import GastosViajeForm from './pages/gastosviaje/GastosViajeForm'
import CertificadosHub from './pages/certificados/CertificadosHub'
import AutorizacionImagenList from './pages/certificados/autorizacion-imagen/AutorizacionImagenList'
import AutorizacionImagenForm from './pages/certificados/autorizacion-imagen/AutorizacionImagenForm'
import FirmaDigital from './pages/certificados/autorizacion-imagen/FirmaDigital'
import CartasReferenciaList from './pages/cartasreferencia/CartasReferenciaList'
import CartaReferenciaForm  from './pages/cartasreferencia/CartaReferenciaForm'
import LoginPage from './pages/auth/LoginPage'
import ChangePasswordPage from './pages/auth/ChangePasswordPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import AdminPanel from './pages/admin/AdminPanel'
import NotFound from './pages/NotFound'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location          = useLocation()

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>Cargando…</div>
  if (!user)   return <Navigate to="/login" state={{ from: location }} replace />
  if (user.must_change_pw && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  return children
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user && !user.must_change_pw) return <Navigate to="/" replace />
  return children
}

function RequireSession() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return <ChangePasswordPage />
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public auth pages */}
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Change password (requires session but not full auth) */}
      <Route path="/change-password" element={<RequireSession />} />

      {/* Protected app */}
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/" element={<Home />} />
        <Route path="/genscript" element={<GenScriptHome />} />
        <Route path="/genscript/end-user-statement" element={<EndUserStatement />} />
        <Route path="/genscript/moh-questions" element={<MOHQuestions />} />
        <Route path="/adaptar-carta" element={<AdaptarCarta />} />
        <Route path="/logos" element={<GestorLogos />} />
        <Route path="/aduanas" element={<AduanasHome />} />
        <Route path="/aduanas/factura-proforma" element={<FacturaProforma />} />
        <Route path="/aduanas/pqp-import" element={<PqpImport />} />
        <Route path="/aduanas/documento-1403" element={<Documento1403 />} />
        <Route path="/aduanas/declaracion-exenta" element={<DeclaracionExenta />} />
        <Route path="/aduanas/cert-no-peligrosidad" element={<CertNoPeligrosidad />} />
        <Route path="/contrato-menor" element={<ContratoMenorPage />} />
        <Route path="/contrato-menor/certificado-exclusividad" element={<CertificadoExclusividad />} />

        <Route path="/gastos-viaje" element={<GastosViajeList />} />
        <Route path="/gastos-viaje/nuevo" element={<GastosViajeForm />} />
        <Route path="/gastos-viaje/:id" element={<GastosViajeForm />} />

        <Route path="/animalario" element={<AnimalarioHub />} />
        <Route path="/animalario/proyectos" element={<ProyectosList />} />
        <Route path="/animalario/proyecto/nuevo" element={<SeccionAForm />} />
        <Route path="/animalario/proyecto/:proyectoId" element={<ProyectoHub />} />
        <Route path="/animalario/proyecto/:proyectoId/editar" element={<SeccionAForm />} />
        <Route path="/animalario/proyecto/:proyectoId/procedimientos" element={<ProcedimientosHub />} />
        <Route path="/animalario/proyecto/:proyectoId/procedimientos/nuevo" element={<SeccionBForm />} />
        <Route path="/animalario/proyecto/:proyectoId/procedimientos/:procId" element={<SeccionBForm />} />
        <Route path="/animalario/proyecto/:proyectoId/cria/nueva" element={<SeccionCForm />} />
        <Route path="/animalario/proyecto/:proyectoId/cria/:cId" element={<SeccionCForm />} />
        <Route path="/animalario/proyecto/:proyectoId/productos" element={<SeccionDForm />} />
        <Route path="/animalario/proyecto/:proyectoId/modificacion/nueva" element={<ModificacionForm />} />
        <Route path="/animalario/proyecto/:proyectoId/modificacion/:mId" element={<ModificacionForm />} />

        <Route path="/documentos-cic" element={<DocumentosCicHub />} />

        <Route path="/autorizaciones" element={<CertificadosHub />} />
        <Route path="/autorizaciones/autorizacion-imagen" element={<AutorizacionImagenList />} />
        <Route path="/autorizaciones/autorizacion-imagen/nuevo" element={<AutorizacionImagenForm />} />
        <Route path="/autorizaciones/autorizacion-imagen/:id" element={<AutorizacionImagenForm />} />

        <Route path="/cartas-referencia" element={<CartasReferenciaList />} />
        <Route path="/cartas-referencia/nueva" element={<CartaReferenciaForm />} />
        <Route path="/cartas-referencia/:id" element={<CartaReferenciaForm />} />

        <Route path="/admin" element={<AdminPanel />} />

        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Firma digital pública (sin layout, sin auth) */}
      <Route path="/firma/:eventoId" element={<FirmaDigital />} />
      <Route path="/firma/:eventoId/:participanteId" element={<FirmaDigital />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
