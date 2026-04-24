import { useState } from 'react'
import PageHeader from '../../components/PageHeader'
import { TIPOS_JUSTIFICACION } from '../../data/contratoMenorConfig'
import styles from './ContratoMenorPage.module.css'

const TODAY = new Date().toISOString().split('T')[0]
const EMPTY_PROVEEDOR = { nombre: '', cif: '', contacto: '', presupuesto: '' }

const DEFAULTS = {
  codigo: '',
  objeto: '',
  justificacionNecesidad: '',
  tipoJustificacion: '',
  centroCoste: '',
  proveedores: [
    { ...EMPTY_PROVEEDOR },
    { ...EMPTY_PROVEEDOR },
    { ...EMPTY_PROVEEDOR },
  ],
  justificacionEleccion: '',
  plazo: '',
  importe: '',
  fecha: TODAY,
}

export default function ContratoMenorPage() {
  const [form, setForm] = useState(DEFAULTS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError(null)
  }

  function handleProveedorChange(index, field, value) {
    setForm(prev => ({
      ...prev,
      proveedores: prev.proveedores.map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      ),
    }))
  }

  function addProveedor() {
    setForm(prev => ({
      ...prev,
      proveedores: [...prev.proveedores, { ...EMPTY_PROVEEDOR }],
    }))
  }

  async function handleDownload() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/contrato-menor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Error ${res.status}`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const code = form.codigo.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
      a.download = `Contrato_Menor_#${code}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isValid =
    form.codigo.trim() &&
    form.objeto.trim() &&
    form.justificacionNecesidad.trim() &&
    form.tipoJustificacion

  return (
    <div>
      <PageHeader
        back="/"
        backLabel="Inicio"
        title="Contrato Menor"
        subtitle="Rellena los campos del formulario. Los datos fijos del centro y del responsable se insertan automáticamente en el documento."
      />

      <form onSubmit={e => e.preventDefault()} className={styles.form}>

        {/* ── Código + Fecha ───────────────────────────────────────────── */}
        <div className={styles.fields}>
          <div className={styles.row}>
            <div className="form-group">
              <label htmlFor="codigo">Código</label>
              <input
                id="codigo"
                name="codigo"
                type="text"
                value={form.codigo}
                onChange={handleChange}
                placeholder="Ej. 2026-001"
                autoComplete="off"
                required
              />
              <span className={styles.hint}>Define el nombre del archivo: Contrato_Menor_#[código].docx</span>
            </div>

            <div className="form-group" style={{ maxWidth: '190px' }}>
              <label htmlFor="fecha">Fecha</label>
              <input
                id="fecha"
                name="fecha"
                type="date"
                value={form.fecha}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* ── Objeto ───────────────────────────────────────────────────── */}
          <div className="form-group">
            <label htmlFor="objeto">Objeto del contrato</label>
            <textarea
              id="objeto"
              name="objeto"
              value={form.objeto}
              onChange={handleChange}
              rows={3}
              placeholder="Descripción del objeto del contrato"
              required
            />
          </div>

          {/* ── Importe + Plazo ──────────────────────────────────────────── */}
          <div className={styles.row}>
            <div className="form-group" style={{ maxWidth: '180px' }}>
              <label htmlFor="importe">Importe (€, sin IVA)</label>
              <input
                id="importe"
                name="importe"
                type="number"
                min="0"
                step="0.01"
                value={form.importe}
                onChange={handleChange}
                placeholder="0,00"
              />
            </div>

            <div className="form-group" style={{ maxWidth: '220px' }}>
              <label htmlFor="plazo">Plazo de ejecución</label>
              <input
                id="plazo"
                name="plazo"
                type="text"
                value={form.plazo}
                onChange={handleChange}
                placeholder="Ej. 30 días"
                autoComplete="off"
              />
            </div>

            <div className="form-group" style={{ maxWidth: '240px' }}>
              <label htmlFor="centroCoste">Centro de coste</label>
              <input
                id="centroCoste"
                name="centroCoste"
                type="text"
                value={form.centroCoste}
                onChange={handleChange}
                placeholder="Ej. BFB-2024-001"
                autoComplete="off"
              />
            </div>
          </div>

          {/* ── Justificación de necesidad ───────────────────────────────── */}
          <div className="form-group">
            <label htmlFor="justificacionNecesidad">Justificación de la necesidad</label>
            <textarea
              id="justificacionNecesidad"
              name="justificacionNecesidad"
              value={form.justificacionNecesidad}
              onChange={handleChange}
              rows={4}
              placeholder="Explica por qué es necesaria esta contratación"
              required
            />
          </div>

          {/* ── Tipo de justificación ────────────────────────────────────── */}
          <div className="form-group">
            <label>Tipo de justificación</label>
            <div className={styles.radioGroup}>
              {TIPOS_JUSTIFICACION.map(({ value, label }) => (
                <label key={value} className={styles.radioOption}>
                  <input
                    type="radio"
                    name="tipoJustificacion"
                    value={label}
                    checked={form.tipoJustificacion === label}
                    onChange={handleChange}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ── Proveedores ──────────────────────────────────────────────── */}
          <div className="form-group">
            <label>Proveedores consultados</label>
            <div className={styles.proveedoresWrapper}>
              <table className={styles.proveedoresTable}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>CIF</th>
                    <th>Contacto</th>
                    <th>Presupuesto</th>
                  </tr>
                </thead>
                <tbody>
                  {form.proveedores.map((prov, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          type="text"
                          value={prov.nombre}
                          onChange={e => handleProveedorChange(i, 'nombre', e.target.value)}
                          placeholder="Nombre del proveedor"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={prov.cif}
                          onChange={e => handleProveedorChange(i, 'cif', e.target.value)}
                          placeholder="B12345678"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={prov.contacto}
                          onChange={e => handleProveedorChange(i, 'contacto', e.target.value)}
                          placeholder="email / teléfono"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={prov.presupuesto}
                          onChange={e => handleProveedorChange(i, 'presupuesto', e.target.value)}
                          placeholder="0,00 €"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" className={styles.addRowBtn} onClick={addProveedor}>
                + Añadir fila
              </button>
            </div>
          </div>

          {/* ── Justificación de elección ────────────────────────────────── */}
          <div className="form-group">
            <label htmlFor="justificacionEleccion">Justificación de la elección del proveedor</label>
            <textarea
              id="justificacionEleccion"
              name="justificacionEleccion"
              value={form.justificacionEleccion}
              onChange={handleChange}
              rows={3}
              placeholder="Motivo por el que se elige el proveedor seleccionado"
            />
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className={styles.actions}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!isValid || loading}
            onClick={handleDownload}
          >
            {loading ? 'Generando…' : '⬇ Generar documento'}
          </button>
          <span className={styles.meta}>
            Logo · Datos del centro · Firma — incluidos automáticamente
          </span>
        </div>

      </form>
    </div>
  )
}
