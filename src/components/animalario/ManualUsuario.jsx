import { useState, useEffect } from 'react'
import s from './ManualUsuario.module.css'

// ── Primitives ────────────────────────────────────────────────────────────────

function Sec({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <div className={s.secHdr} onClick={() => setOpen(o => !o)}>
        <span className={s.secTitle}>{title}</span>
        <span className={s.secChevron} style={{ transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </div>
      {open && <div className={s.secBody}>{children}</div>}
    </div>
  )
}

function SubSec({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className={s.subSecHdr} onClick={() => setOpen(o => !o)}>
        <span className={s.subSecTitle}>{title}</span>
        <span className={s.subSecChevron} style={{ transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </div>
      {open && <div className={s.subSecBody}>{children}</div>}
    </div>
  )
}

function Faq({ pregunta, respuesta }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={s.faqItem}>
      <div className={s.faqQ} onClick={() => setOpen(o => !o)}>
        <span>P: {pregunta}</span>
        <span className={s.faqChevron} style={{ transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </div>
      {open && <div className={s.faqA}>R: {respuesta}</div>}
    </div>
  )
}

function Step({ n, children }) {
  return (
    <div className={s.step}>
      <span className={s.stepNum}>{n}</span>
      <span style={{ paddingTop: 2 }}>{children}</span>
    </div>
  )
}

function Nota({ children }) {
  return <div className={s.nota}>ℹ {children}</div>
}

function Aviso({ children }) {
  return <div className={s.aviso}>{children}</div>
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ManualUsuario({ abierto, onCerrar }) {
  useEffect(() => {
    if (!abierto) return
    const onKey = e => { if (e.key === 'Escape') onCerrar() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [abierto, onCerrar])

  if (!abierto) return null

  return (
    <div className={s.overlay} onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div className={s.panel}>

        {/* ── Cabecera ── */}
        <div className={s.cabecera}>
          <img
            src="/logos/animalario/cicbiogune.png"
            alt="CIC bioGUNE"
            className={s.cabeceraLogo}
          />
          <span className={s.cabeceraTitulo}>Manual de usuario — Módulo Animalario</span>
          <button type="button" className={s.cabeceraClose} onClick={onCerrar}>×</button>
        </div>

        {/* ── Cuerpo ── */}
        <div className={s.cuerpo}>

          {/* 1 — ¿Qué es? */}
          <Sec title="1. ¿Qué es el módulo Animalario?" defaultOpen={true}>
            <p>
              El módulo <strong>Animalario</strong> del Rincón del Antiburócrata es una herramienta
              para preparar, gestionar y actualizar la documentación necesaria para proyectos de
              investigación con animales de experimentación en el <strong>CIC bioGUNE</strong>.
            </p>
            <p style={{ marginTop: '0.5rem' }}>
              Permite generar los documentos requeridos por el Comité Ético de Experimentación
              Animal (CEEA) y el Comité de Bioética y Bienestar Animal (CBBA):
            </p>
            <table className={s.tabla} style={{ marginTop: '0.6rem' }}>
              <thead>
                <tr>
                  <th className={s.th}>Sección</th>
                  <th className={s.th}>Documento que genera</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Sección A',    'Solicitud de evaluación ética del proyecto'],
                  ['Sección B',    'Descripción del procedimiento experimental'],
                  ['Sección C',    'Cría de cepas/líneas de ratón y OMGs'],
                  ['Sección D',    'Productos con riesgo para la salud o el medio ambiente'],
                  ['Modificación', 'Solicitud de modificación de proyecto aprobado'],
                ].map(([sec, doc]) => (
                  <tr key={sec}>
                    <td className={s.tdBold}>{sec}</td>
                    <td className={s.td}>{doc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ marginTop: '0.65rem' }}>
              Todos los documentos se pueden descargar en formato <strong>Word (.docx)</strong> para
              edición o <strong>PDF</strong> para envío al comité.
            </p>
          </Sec>

          {/* 2 — Cómo crear un proyecto */}
          <Sec title="2. Cómo crear un proyecto nuevo">
            <Step n="1">
              Desde el hub Animalario, pulsa <strong>«Proyectos»</strong> y luego{' '}
              <strong>«Nuevo proyecto»</strong>.
            </Step>
            <Step n="2">
              Rellena la <strong>Sección A</strong> (información general): responsable,
              participantes, duración, financiación, objetivos, las 3Rs y condiciones de
              alojamiento. Pulsa <em>«Guardar y continuar»</em>.
            </Step>
            <Step n="3">
              Desde el hub del proyecto, accede a <strong>«Procedimientos»</strong> y crea al menos
              un procedimiento (Sección B).
            </Step>
            <Step n="4">
              Si declaraste cría de animales en Sección A, aparecerá el bloque{' '}
              <strong>«Cría de animales»</strong>. Crea una Sección C por cada cepa/línea declarada.
            </Step>
            <Step n="5">
              Si en algún procedimiento marcaste que hay sustancias con riesgo, aparecerá el bloque{' '}
              <strong>«Productos con riesgo»</strong>. Completa la Sección D.
            </Step>
            <Step n="6">
              Cuando todo esté listo, exporta el proyecto completo desde el hub del proyecto.
            </Step>
          </Sec>

          {/* 3 — Secciones */}
          <Sec title="3. Las secciones del proyecto">
            <p style={{ marginBottom: '0.25rem', color: '#6b7280', fontSize: '0.82rem' }}>
              Pulsa cada apartado para ver los detalles.
            </p>

            <SubSec title="▶ Sección A — Información general">
              <p>
                <strong>Qué es:</strong> el documento principal del proyecto. Define el responsable,
                los participantes, la duración, la financiación, los objetivos científicos y el
                cumplimiento de las 3Rs (Reemplazo, Reducción, Refinamiento).
              </p>
              <p style={{ marginTop: '0.4rem' }}>
                <strong>Cuándo:</strong> siempre. Es el primer paso para cualquier proyecto.
              </p>
              <p style={{ marginTop: '0.4rem' }}>
                <strong>Campos obligatorios:</strong> título, responsable (nombre, NIF, función),
                fecha de inicio y fin, objetivo principal, resumen (máx. 300 palabras), análisis
                daño/beneficio (máx. 300 palabras), tipo de proyecto, finalidad, las 3Rs.
              </p>
              <Nota>
                El resumen de procedimientos (tabla A.6) se rellena automáticamente al crear
                procedimientos en Sección B.
              </Nota>
            </SubSec>

            <SubSec title="▶ Sección B — Procedimientos">
              <p>
                <strong>Qué es:</strong> describe cada procedimiento experimental por separado. Un
                proyecto puede tener múltiples procedimientos, cada uno con su propio documento.
              </p>
              <p style={{ marginTop: '0.4rem' }}>
                <strong>Cuándo:</strong> siempre. Todo proyecto necesita al menos un procedimiento.
              </p>
              <p style={{ marginTop: '0.4rem' }}>
                <strong>Campos importantes:</strong> especie, cepa, número de animales, severidad,
                fases del procedimiento, técnicas, analgesia/anestesia, parámetros a medir, método
                de eutanasia.
              </p>
              <Nota>
                La severidad del procedimiento determina los límites de incremento en futuras
                modificaciones (leve: máx. 25%; moderada: máx. 10%).
              </Nota>
            </SubSec>

            <SubSec title="▶ Sección C — Cría de animales y OMGs">
              <p>
                <strong>Qué es:</strong> describe el programa de cría de cada cepa o línea animal.
                Si la cepa es un organismo modificado genéticamente (OMG), incluye el bloque de
                información genética.
              </p>
              <p style={{ marginTop: '0.4rem' }}>
                <strong>Cuándo:</strong> solo si en Sección A se marcó{' '}
                <em>«¿Contempla un procedimiento de cría?» = Sí</em>. Se crea una Sección C por
                cada cepa/línea.
              </p>
              <Nota>
                Si el OMG ya fue aprobado en otro procedimiento, basta con indicar el número de
                procedimiento previo. No es necesario rellenar el resto del bloque.
              </Nota>
            </SubSec>

            <SubSec title="▶ Sección D — Productos con riesgo">
              <p>
                <strong>Qué es:</strong> lista los agentes biológicos y químicos administrados que
                suponen un riesgo para la salud o el medio ambiente.
              </p>
              <p style={{ marginTop: '0.4rem' }}>
                <strong>Cuándo:</strong> solo si en algún procedimiento B se respondió «Sí» a la
                pregunta sobre sustancias con riesgo.
              </p>
              <Nota>
                Recuerda adjuntar la ficha de seguridad de cada producto químico al enviar la
                documentación al comité.
              </Nota>
            </SubSec>

            <SubSec title="▶ Modificaciones">
              <p>
                <strong>Qué es:</strong> solicitud formal de cambio sobre un proyecto ya aprobado.
                Puede incluir alta/baja de investigadores, más animales, nuevos procedimientos,
                cambios en procedimientos existentes, nuevas líneas animales, nuevos lugares o
                cambios en el alojamiento.
              </p>
              <p style={{ marginTop: '0.4rem' }}>
                <strong>Cuándo:</strong> cuando necesites modificar un proyecto que ya tiene
                aprobación del CBBA.
              </p>
              <Nota>
                El incremento de animales no puede superar el 25% en proyectos de severidad leve ni
                el 10% en proyectos de severidad moderada. Si se supera ese límite, es necesario un
                proyecto nuevo.
              </Nota>
            </SubSec>
          </Sec>

          {/* 4 — Cuándo se activa cada sección */}
          <Sec title="4. Cuándo se activa cada sección">
            <table className={s.tabla}>
              <thead>
                <tr>
                  <th className={s.th}>Sección</th>
                  <th className={s.th}>Se activa cuando…</th>
                  <th className={s.th}>Dónde se configura</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['C — Cría',      'hay_cria = Sí en Sección A',                         'Sección A, bloque A.6'],
                  ['C-O — OMG',     'La cepa está marcada como OMG en Sección C',          'Sección C, pregunta «¿Es un OMG?»'],
                  ['D — Productos', 'Algún procedimiento B declara sustancias con riesgo', 'Sección B, bloque B.6'],
                  ['Modificación',  'Siempre disponible en proyectos existentes',          'Hub del proyecto'],
                ].map(([sec, when, where]) => (
                  <tr key={sec}>
                    <td className={s.tdBold}>{sec}</td>
                    <td className={s.td}>{when}</td>
                    <td className={s.td}>{where}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Nota>
              En el hub de cada proyecto, las secciones inactivas no aparecen. Las activas muestran
              su estado (Pendiente / Completada) con un indicador de color.
            </Nota>
          </Sec>

          {/* 5 — Exportar */}
          <Sec title="5. Exportar documentos">
            <p><strong>Desde el hub del proyecto:</strong></p>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.3rem' }}>
              <li>«Exportar todo en Word» → ZIP con todos los documentos en .docx</li>
              <li>«Exportar todo en PDF» → ZIP con todos en .pdf</li>
              <li>«Exportar todo (Word + PDF)» → ZIP con ambos formatos</li>
            </ul>
            <p style={{ marginTop: '0.6rem' }}><strong>Desde cada sección individual:</strong></p>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.3rem' }}>
              <li>Cada formulario tiene su propio botón de exportación.</li>
              <li>
                Desde ProcedimientosHub, cada procedimiento tiene botones{' '}
                <strong>«⬇ Word»</strong> y <strong>«⬇ PDF»</strong> individuales.
              </li>
              <li>Desde el bloque de crías del hub, cada cepa tiene sus propios botones de descarga.</li>
              <li>Lo mismo para cada modificación en la lista.</li>
            </ul>
            <p style={{ marginTop: '0.6rem' }}><strong>Formatos:</strong></p>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.3rem' }}>
              <li><strong>.docx</strong> → para editar, completar manualmente o añadir firma escaneada.</li>
              <li><strong>.pdf</strong> → para enviar al comité de ética.</li>
            </ul>
            <p style={{ marginTop: '0.6rem' }}>
              <strong>Adjuntos requeridos</strong> (no generados automáticamente):
            </p>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.3rem' }}>
              <li>Fichas de seguridad de productos químicos (Sección D)</li>
              <li>Mapa de restricción del vector en PDF (Sección C-O)</li>
              <li>Certificados de formación del personal nuevo (Modificaciones con alta de investigadores)</li>
              <li>Esquemas adicionales del procedimiento (Sección B)</li>
            </ul>
          </Sec>

          {/* 6 — Autocompletado */}
          <Sec title="6. Autocompletado y reutilización">
            <p>
              El módulo guarda automáticamente los valores que introduces en determinados campos
              (cepas, técnicas, productos, parámetros, etc.). La próxima vez que escribas en ese
              campo, verás sugerencias basadas en lo que ya has introducido antes.
            </p>
            <p style={{ marginTop: '0.5rem' }}><strong>Campos con autocompletado activo:</strong></p>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.3rem', columns: 2, columnGap: '1.5rem' }}>
              {[
                'Cepa / línea animal', 'Especie', 'Técnica experimental', 'Frecuencia',
                'Producto administrado', 'Vía de administración', 'Parámetro medido',
                'Método de eutanasia', 'Fuente de financiación', 'Muestra de genotipaje',
                'Tipo de modificación genética (OMG)', 'Agente biológico', 'Agente químico',
              ].map(c => <li key={c}>{c}</li>)}
            </ul>
            <p style={{ marginTop: '0.65rem' }}>
              <strong>Reutilizar un proyecto anterior:</strong> desde la lista de proyectos, el
              botón <em>«Usar como base»</em> crea una copia del proyecto seleccionado con un nuevo
              ID, conservando toda la información para que puedas adaptarla al nuevo proyecto.
            </p>
          </Sec>

          {/* 7 — Avisos */}
          <Sec title="7. Avisos y límites importantes">
            <Aviso>
              ⚠️ <strong>Duración máxima del proyecto: 5 años.</strong> Si la fecha de fin supera
              ese límite desde la fecha de inicio, se muestra un aviso (no bloquea el guardado).
            </Aviso>
            <Aviso>
              ⚠️ <strong>Resumen y análisis daño/beneficio: máximo 300 palabras cada uno.</strong>{' '}
              El contador es visible mientras escribes.
            </Aviso>
            <Aviso>
              ⚠️ <strong>Incremento de animales en modificaciones:</strong>
              <ul style={{ paddingLeft: '1.25rem', marginTop: '0.3rem' }}>
                <li>Severidad <em>leve</em>: máximo 25% sobre el total aprobado.</li>
                <li>Severidad <em>moderada</em>: máximo 10%.</li>
                <li>
                  Si se supera, no se puede guardar la modificación → necesitas un proyecto nuevo.
                </li>
              </ul>
            </Aviso>
            <Aviso>
              ⚠️ <strong>Severidad de nuevos procedimientos:</strong> si la severidad de los
              procedimientos a añadir en una modificación es superior a la del proyecto original,
              necesitas un proyecto nuevo.
            </Aviso>
            <Aviso>
              ⚠️ <strong>Sección D obligatoria si hay sustancias de riesgo:</strong> si un
              procedimiento declara sustancias con riesgo y no se completa la Sección D, el hub del
              proyecto muestra un banner de aviso.
            </Aviso>
          </Sec>

          {/* 8 — FAQ */}
          <Sec title="8. Preguntas frecuentes">
            {[
              {
                p: '¿Puedo tener varios procedimientos en un proyecto?',
                r: 'Sí. Desde el hub del proyecto accede a «Procedimientos» y crea tantos como necesites. Cada uno genera su propio documento Sección B.',
              },
              {
                p: '¿Puedo duplicar un procedimiento?',
                r: 'Sí. En la lista de procedimientos, cada uno tiene un botón «Duplicar» que crea una copia con un nuevo número correlativo. Es útil cuando varios procedimientos son similares.',
              },
              {
                p: '¿Qué pasa si desactivo la cría después de haber creado Secciones C?',
                r: 'Los datos de las Secciones C se conservan en el sistema pero el bloque deja de mostrarse en el hub. Si vuelves a activar la cría, los datos siguen ahí.',
              },
              {
                p: '¿Puedo empezar desde un proyecto anterior?',
                r: 'Sí. Desde la lista de proyectos usa el botón «Usar como base» para crear una copia del proyecto que quieras reutilizar.',
              },
              {
                p: '¿El borrador se guarda automáticamente?',
                r: 'No automáticamente. Usa el botón «Guardar borrador» para guardar sin validar campos obligatorios, o «Guardar y continuar» para validar y avanzar.',
              },
              {
                p: '¿Puedo modificar un proyecto ya exportado?',
                r: 'Sí. Los datos siempre son editables en la aplicación. Vuelve a exportar después de modificar para obtener la versión actualizada.',
              },
              {
                p: '¿Los documentos exportados incluyen la firma?',
                r: 'Sí. Si existe el fichero de firma configurado, se incrusta automáticamente en todos los documentos. Si no existe, se deja un espacio en blanco para firma manual.',
              },
            ].map(({ p, r }) => (
              <Faq key={p} pregunta={p} respuesta={r} />
            ))}
          </Sec>

        </div>

        {/* ── Pie ── */}
        <div className={s.pie}>v1.0 · mayo 2026</div>

      </div>
    </div>
  )
}
