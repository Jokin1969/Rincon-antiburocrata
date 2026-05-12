import { useState, useEffect } from 'react'
import PageHeader from '../../components/PageHeader'
import styles from './LogosPage.module.css'

const CATEGORIES = ['Todos', 'Institucional', 'Proyecto', 'Fundación', 'Organismo', 'Universidad', 'Empresa']

export default function LogosPage() {
  const [logos, setLogos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeCategory, setActiveCategory] = useState('Todos')

  useEffect(() => {
    fetch('/api/logos')
      .then(r => {
        if (!r.ok) throw new Error('Error al cargar los logos')
        return r.json()
      })
      .then(data => {
        setLogos(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  function countForCategory(cat) {
    if (cat === 'Todos') return logos.length
    return logos.filter(l => l.category === cat).length
  }

  const filtered = activeCategory === 'Todos'
    ? logos
    : logos.filter(l => l.category === activeCategory)

  return (
    <div>
      <PageHeader
        back="/"
        backLabel="Módulos"
        title="Logos"
        subtitle="Galería de logotipos de instituciones y proyectos."
      />

      {loading && <p className={styles.status}>Cargando logos…</p>}
      {error && <p className={`alert alert-error ${styles.status}`}>{error}</p>}

      {!loading && !error && (
        <>
          <div className={styles.tabs}>
            {CATEGORIES.map(cat => {
              const count = countForCategory(cat)
              return (
                <button
                  key={cat}
                  className={`${styles.tab} ${activeCategory === cat ? styles.tabActive : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                  <span className={styles.tabCount}>{count}</span>
                </button>
              )
            })}
          </div>

          <div className={styles.toolbar}>
            <span className={styles.count}>
              {filtered.length} {filtered.length === 1 ? 'logo' : 'logos'}
            </span>
          </div>

          {filtered.length === 0 ? (
            <p className={styles.status}>No hay logos en esta categoría.</p>
          ) : (
            <div className={styles.grid}>
              {filtered.map(logo => (
                <div key={logo.name} className={styles.card}>
                  <div className={styles.imageWrapper}>
                    <img
                      src={logo.image}
                      alt={logo.label}
                      className={styles.image}
                    />
                  </div>
                  <div className={styles.cardFooter}>
                    <div className={styles.cardInfo}>
                      <span className={styles.name}>{logo.label}</span>
                      <span className={styles.category}>{logo.category}</span>
                    </div>
                    {logo.pdf && (
                      <a
                        href={logo.pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`btn btn-ghost ${styles.pdfBtn}`}
                      >
                        PDF
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
