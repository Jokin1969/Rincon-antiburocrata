import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import GenScriptHome from './pages/genscript/GenScriptHome'
import EndUserStatement from './pages/genscript/EndUserStatement'
import MOHQuestions from './pages/genscript/MOHQuestions'
import AduanasHome from './pages/aduanas/AduanasHome'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/genscript" element={<GenScriptHome />} />
        <Route path="/genscript/end-user-statement" element={<EndUserStatement />} />
        <Route path="/genscript/moh-questions" element={<MOHQuestions />} />
        <Route path="/aduanas" element={<AduanasHome />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
