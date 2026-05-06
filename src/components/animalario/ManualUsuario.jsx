import { useState, useEffect } from 'react'

// ── Styles ────────────────────────────────────────────────────────────────────

const MODAL_OVERLAY = {
  position: 'fixed', inset: 0, zIndex: 1000,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  padding: '3vh 1rem',
  overflowY: 'auto',
}
const MODAL_BOX = {
  background: '#fff',
  borderRadius: '10px',
  boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
  width: '100%',
  maxWidth: 720,
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '92vh',
}
const MODAL_HEADER = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '1.1rem 1.5rem',
  borderBottom: '1px solid #e5e7eb',
  background: 'var(--accent)',
  borderRadius: '10px 10px 0 0',
}
const MODAL_BODY = {
  overflowY: 'auto',
  padding: '1.25rem 1.5rem',
  flex: 1,
}
const SECTION_HDR = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0.65rem 0',
  borderBottom: '2px solid var(--accent)',
  cursor: 'pointer',
  userSelect: 'none',
  marginTop: '1.25rem',
  marginBottom: 0,
}
const SECTION_TITLE = {
  fontSize: '0.95rem', fontWeight: 700,
  color: 'var(--accent)', letterSpacing: '-0.01em',
}
const SECTION_BODY = {
  paddingTop: '0.75rem',
  paddingBottom: '0.25rem',
  fontSize: '0.875rem',
  color: '#374151',
  lineHeight: 1.65,
}
const TABLE_STYLE = {
  width: '100%', borderCollapse: 'collapse',
  fontSize: '0.82rem', marginTop: '0.5rem',
}
const TH = { background: '#f3f4f6', padding: '0.4rem 0.7rem', border: '1px solid #d1d5db', textAlign: 'left', fontWeight: 700 }
const TD = { padding: '0.4rem 0.7rem', border: '1px solid #d1d5db', verticalAlign: 'top' }

// ── CollapsibleSection ────────────────────────────────────────────────────────

function Sec({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <div style={SECTION_HDR} onClick={() => setOpen(o => !o)}>
        <span style={SECTION_TITLE}>{title}</span>
        <span style={{ color: 'var(--accent)', fontSize: '0.8rem', transform: open ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>▼</span>
      </div>
      {open && <div style={SECTION_BODY}>{children}</div>}
    </div>
  )
}

function Note({ children }) {
  return (
    <div style={{ background: 'rgba(123,28,46,0.06)', border: '1px solid rgba(123,28,46,0.18)', borderRadius: 5, padding: '0.6rem 0.85rem', marginTop: '0.6rem', fontSize: '0.82rem', color: '#5a1322' }}>
      ℹ {children}
    </div>
  )
}

function Step({ n, children }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
      <span style={{ minWidth: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>{n}</span>
      <span style={{ paddingTop: 2 }}>{children}</span>
    </div>
  )
}

// ── Manual content ────────────────────────────────────────────────────────────

export default function ManualUsuario({ onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={MODAL_OVERLAY} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={MODAL_BOX}>

        {/* Header */}
        <div style={MODAL_HEADER}>
          <span style={{ fontWeight: 800, fontSize: '1rem', color: '#fff', letterSpacing: '-0.01em' }}>
            📖 Manual de usuario — Módulo Animalario
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 5, color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', padding: '0.2rem 0.6rem', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={MODAL_BODY}>

          {/* 1 — Qué es */}
          <Sec title="1. ¿Qué es el módulo Animalario?" defaultOpen={true}>
            <p>El módulo <strong>Animalario</strong> es una herramienta de gestión documental para la experimentación animal en el <strong>CIC bioGUNE</strong>. Permite crear, editar y exportar los formularios requeridos por el Comité de Ética y el CBBA para la aprobación de proyectos.</p>
            <p style={{ marginTop: '0.5rem' }}>Los documentos que genera son:</p>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.3rem' }}>
              <li><strong>Sección A</strong> — Solicitud de evaluación ética del proyecto</li>
              <li><strong>Sección B</strong> — Descripción de cada procedimiento experimental</li>
              <li><strong>Sección C</strong> — Formulario de cría de cepas/líneas (incluye OMGs)</li>
              <li><strong>Sección D</strong> — Productos administrados con riesgo</li>
              <li><strong>Modificaciones</strong> — Solicitudes de modificación del proyecto aprobado</li>
            </ul>
            <Note>Los documentos generados son de uso interno. Antes de presentarlos al CBBA deben ser revisados y firmados por el responsable del proyecto.</Note>
          </Sec>

          {/* 2 — Cómo crear */}
          <Sec title="2. Cómo crear un proyecto nuevo">
            <Step n="1">Desde el <strong>Hub del Animalario</strong>, ve a "Ver todos los proyectos" y pulsa <em>Nuevo proyecto</em>.</Step>
            <Step n="2">Rellena la <strong>Sección A</strong> (información general). Guarda para activar las demás secciones.</Step>
            <Step n="3">En el <strong>Hub del proyecto</strong>, accede a <em>Sección B → Gestionar</em> y añade los procedimientos experimentales.</Step>
            <Step n="4">Si declaraste cría en Sección A, aparecerán las tarjetas de <strong>Sección C</strong> (una por cepa). Completa cada una.</Step>
            <Step n="5">Si algún procedimiento usa sustancias con riesgo, aparecerá el aviso y la tarjeta de <strong>Sección D</strong>. Complétala.</Step>
            <Step n="6">Cuando el proyecto esté aprobado, usa <em>Nueva modificación</em> para registrar los cambios posteriores.</Step>
            <Step n="7">Exporta el proyecto completo con el botón <em>Exportar proyecto completo</em> en el Hub del proyecto.</Step>
          </Sec>

          {/* 3 — Secciones */}
          <Sec title="3. Secciones del proyecto">

            <p style={{ fontWeight: 700, marginTop: '0.5rem', marginBottom: '0.2rem' }}>Sección A — Información general</p>
            <p>Recoge los datos del responsable, participantes, duración, financiación, objetivos, las 3Rs, tipo de proyecto, cepas de cría y condiciones de alojamiento.</p>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
              <li>El <strong>resumen</strong> no debe superar 300 palabras.</li>
              <li>La <strong>duración máxima</strong> del proyecto es 5 años.</li>
              <li>Si hay cría, declara las cepas en el bloque A.6 para que aparezcan las tarjetas de Sección C.</li>
            </ul>

            <p style={{ fontWeight: 700, marginTop: '0.85rem', marginBottom: '0.2rem' }}>Sección B — Procedimientos</p>
            <p>Cada procedimiento tiene 13 bloques (datos generales, metodología, técnicas, anestesia, sustancias, parámetros, eutanasia…). Puedes <strong>duplicar</strong> un procedimiento existente desde el hub de procedimientos para reutilizar campos comunes.</p>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
              <li>Clasificar correctamente la <strong>severidad</strong> (ninguna / leve / moderada / severa) es obligatorio.</li>
              <li>Si marcas "Sustancias con riesgo", se activará la Sección D del proyecto.</li>
            </ul>

            <p style={{ fontWeight: 700, marginTop: '0.85rem', marginBottom: '0.2rem' }}>Sección C — Cría de animales y OMGs</p>
            <p>Aparece una tarjeta por cada cepa declarada en Sección A. Si la cepa es un organismo modificado genéticamente (OMG), se despliega el bloque C-O con datos de clasificación, lugar de manipulación, cruces y modificación genética.</p>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
              <li>Si el OMG ya fue usado anteriormente, solo se pide el número de procedimiento previo.</li>
              <li>Si es un cruce de OMGs, indica los códigos CBBA de los parentales.</li>
            </ul>

            <p style={{ fontWeight: 700, marginTop: '0.85rem', marginBottom: '0.2rem' }}>Sección D — Productos con riesgo</p>
            <p>Lista los agentes biológicos (con grupo de riesgo) y agentes químicos (con ficha de seguridad) usados en los procedimientos. Se activa automáticamente cuando algún procedimiento B declara sustancias con riesgo.</p>
            <Note>Recuerda adjuntar la ficha de seguridad de cada producto al exportar el proyecto.</Note>

            <p style={{ fontWeight: 700, marginTop: '0.85rem', marginBottom: '0.2rem' }}>Modificaciones</p>
            <p>Registra los cambios aprobados tras la aprobación inicial del proyecto. Puede incluir alta/baja de investigadores, adición de animales, nuevos procedimientos, cambios en procedimientos existentes, nuevas líneas animales, nuevo lugar o cambio de alojamiento.</p>
          </Sec>

          {/* 4 — Lógica condicional */}
          <Sec title="4. Lógica condicional — cuándo aparece cada sección">
            <table style={TABLE_STYLE}>
              <thead>
                <tr>
                  <th style={TH}>Sección / bloque</th>
                  <th style={TH}>Se activa cuando…</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Sección C', 'hay_cria = true en Sección A (bloque A.6)'],
                  ['Bloque C-O (OMG)', 'es_omg = true en el formulario de la cepa (Sección C)'],
                  ['OMG — datos completos', 'usado_anteriormente = false en el bloque C-O'],
                  ['OMG — solo referencia', 'usado_anteriormente = true en el bloque C-O'],
                  ['Sección D', 'hay_riesgo = true en algún procedimiento B'],
                  ['Aviso Sección D pendiente', 'hay_riesgo y seccionD_id está vacío en el proyecto'],
                  ['Modificaciones', 'Siempre disponible en proyectos existentes'],
                  ['Bloque adición animales', 'tipos_cambio.adicion_animales = true en Modificación'],
                  ['Bloque OMG en cruce', 'omg.es_cruce_omgs = true en Sección C'],
                ].map(([sec, cond]) => (
                  <tr key={sec}>
                    <td style={{ ...TD, fontWeight: 600, whiteSpace: 'nowrap' }}>{sec}</td>
                    <td style={TD}>{cond}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Sec>

          {/* 5 — Exportar */}
          <Sec title="5. Exportar documentos">
            <p>Cada formulario tiene un botón <strong>⬇ Exportar</strong> con tres opciones:</p>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
              <li><strong>Word (.docx)</strong> — Documento editable para revisión final.</li>
              <li><strong>PDF</strong> — Documento para presentación oficial.</li>
              <li><strong>Ambos (ZIP)</strong> — Descarga ambos formatos en un .zip.</li>
            </ul>
            <p style={{ marginTop: '0.6rem' }}>Desde el <strong>Hub del proyecto</strong>, el botón <em>Exportar proyecto completo</em> genera en un único ZIP:</p>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
              <li>Sección A del proyecto</li>
              <li>Una Sección B por cada procedimiento</li>
              <li>Una Sección C por cada cepa (si hay cría)</li>
              <li>Sección D (si existe)</li>
              <li>Todas las modificaciones (si existen)</li>
            </ul>
            <Note>Los documentos exportados no incluyen firmas digitales. El responsable debe firmarlos manualmente antes de presentarlos.</Note>
            <p style={{ marginTop: '0.6rem' }}>Adjuntos requeridos que <strong>no</strong> genera la herramienta:</p>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
              <li>Fichas de seguridad de productos químicos (Sección D)</li>
              <li>Mapas de vectores (Sección C, bloque OMG)</li>
              <li>Certificados de formación ECC566 del personal</li>
            </ul>
          </Sec>

          {/* 6 — Autocompletado */}
          <Sec title="6. Repositorio de autocompletado">
            <p>Los campos con autocompletado aprenden de los valores que introduces. La primera vez que escribes un valor nuevo, se guarda en el repositorio y aparece como sugerencia en todos los proyectos futuros.</p>
            <p style={{ marginTop: '0.5rem' }}>Campos con autocompletado activo:</p>
            <table style={TABLE_STYLE}>
              <thead>
                <tr><th style={TH}>Campo</th><th style={TH}>Formulario</th></tr>
              </thead>
              <tbody>
                {[
                  ['Cepa / línea', 'Secciones A y B'],
                  ['Especie', 'Sección B'],
                  ['Técnica experimental', 'Sección B'],
                  ['Producto administrado', 'Sección B'],
                  ['Vía de administración', 'Sección B'],
                  ['Parámetro medido', 'Sección B'],
                  ['Método de eutanasia', 'Sección B'],
                  ['Fuente de financiación', 'Sección A'],
                  ['Tipo de muestra (genotipaje)', 'Sección C'],
                  ['Tipo de modificación OMG', 'Sección C'],
                  ['Agente biológico', 'Sección D'],
                  ['Agente químico', 'Sección D'],
                ].map(([c, f]) => (
                  <tr key={c}><td style={TD}>{c}</td><td style={TD}>{f}</td></tr>
                ))}
              </tbody>
            </table>
            <Note>Para usar un proyecto anterior como base, accede a la lista de proyectos, ábrelo y edita la Sección A directamente. Los procedimientos pueden duplicarse desde el hub de procedimientos.</Note>
          </Sec>

          {/* 7 — Avisos */}
          <Sec title="7. Avisos y validaciones importantes">
            <ul style={{ paddingLeft: '1.25rem' }}>
              <li style={{ marginBottom: '0.4rem' }}><strong>Duración máxima del proyecto:</strong> 5 años. La herramienta muestra un aviso si la fecha fin supera este límite.</li>
              <li style={{ marginBottom: '0.4rem' }}><strong>Límite de incremento de animales en modificaciones:</strong><br />
                — Severidad <em>leve</em>: máximo +25 % sobre el total aprobado.<br />
                — Severidad <em>moderada</em>: máximo +10 %.<br />
                — Si se supera el límite, el botón de guardar se bloquea y debe abrirse un proyecto nuevo.
              </li>
              <li style={{ marginBottom: '0.4rem' }}><strong>Resumen (Sección A):</strong> máximo 300 palabras. El contador en tiempo real indica si se supera.</li>
              <li style={{ marginBottom: '0.4rem' }}><strong>Sección D pendiente:</strong> si hay procedimientos con riesgo y la Sección D no está cumplimentada, aparece un aviso en el Hub del proyecto.</li>
              <li><strong>Cuándo se necesita proyecto nuevo en lugar de modificación:</strong> cuando se cambia la especie, se añaden objetivos sustancialmente distintos, o se supera el límite de incremento de animales según severidad.</li>
            </ul>
          </Sec>

          {/* 8 — FAQ */}
          <Sec title="8. Preguntas frecuentes">
            {[
              ['¿Puedo tener varios procedimientos en un proyecto?', 'Sí. Desde el hub de procedimientos (Sección B → Gestionar) puedes añadir tantos procedimientos como necesites.'],
              ['¿Puedo duplicar un procedimiento?', 'Sí. En el hub de procedimientos, cada card tiene el botón "Duplicar". Crea una copia independiente con todos los campos copiados.'],
              ['¿Qué pasa si desactivo hay_cria después de haber creado cepas?', 'Las cepas y sus formularios C se conservan en la base de datos, pero las tarjetas dejan de mostrarse en el Hub del proyecto. Si vuelves a activar hay_cria, reaparecen.'],
              ['¿Se pueden cargar proyectos anteriores como base?', 'Sí. Desde la lista de proyectos, abre el proyecto que quieras reutilizar, edita la Sección A y modifica los campos necesarios. Los procedimientos pueden duplicarse uno a uno.'],
              ['¿Dónde se almacenan los datos?', 'En el servidor Railway, bajo /data/animalario/. Los datos persisten entre despliegues gracias al volumen de datos montado.'],
              ['¿Puedo exportar una sección aunque no esté completa?', 'Sí. La exportación no valida si todos los campos están rellenos. Los campos vacíos aparecen como "—" en el documento.'],
              ['¿Qué es el número de procedimiento en Sección D?', 'Es el identificador interno del procedimiento B al que pertenece el agente. Se selecciona en el desplegable de Sección D.'],
            ].map(([q, a]) => (
              <div key={q} style={{ marginTop: '0.7rem' }}>
                <p style={{ fontWeight: 700, marginBottom: '0.15rem' }}>P: {q}</p>
                <p style={{ color: '#4b5563' }}>R: {a}</p>
              </div>
            ))}
          </Sec>

        </div>
      </div>
    </div>
  )
}
