import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import GenScriptHome from './pages/genscript/GenScriptHome'
import EndUserStatement from './pages/genscript/EndUserStatement'
import MOHQuestions from './pages/genscript/MOHQuestions'
import AduanasHome from './pages/aduanas/AduanasHome'
import FacturaProforma from './pages/aduanas/FacturaProforma'
import PqpImport from './pages/aduanas/PqpImport'
import Documento1403 from './pages/aduanas/Documento1403'
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
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
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
        <Route path="/contrato-menor" element={<ContratoMenorPage />} />
        <Route path="/contrato-menor/certificado-exclusividad" element={<CertificadoExclusividad />} />

        {/* Gastos de viaje */}
        <Route path="/gastos-viaje" element={<GastosViajeList />} />
        <Route path="/gastos-viaje/nuevo" element={<GastosViajeForm />} />
        <Route path="/gastos-viaje/:id" element={<GastosViajeForm />} />

        {/* Animalario */}
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

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
