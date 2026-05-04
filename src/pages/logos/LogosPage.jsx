import { useState, useEffect } from 'react'
import PageHeader from '../../components/PageHeader'
import styles from './LogosPage.module.css'

const PAGE_SIZE_OPTIONS = [6, 12, 24, 48]

const CATEGORIES = ['Todos', 'Institucional', 'Proyecto', 'Fundación', 'Organismo', 'Universidad', 'Empresa']

export default function LogosPage() {
  const [logos, setLogos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pageSize, setPageSize] = useState(12)
  const [currentPage, setCurrentPage] = useState(1)
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

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function handleCategoryChange(cat) {
    setActiveCategory(cat)
    setCurrentPage(1)
  }

  function handlePageSizeChange(e) {
    setPageSize(Number(e.target.value))
    setCurrentPage(1)
  }

  function goToPage(p) {
    setCurrentPage(Math.max(1, Math.min(p, totalPages)))
  }

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
                  onClick={() => handleCategoryChange(cat)}
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
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor="page-size" style={{ whiteSpace: 'nowrap' }}>Por página</label>
              <select
                id="page-size"
                value={pageSize}
                onChange={handlePageSizeChange}
                style={{ width: 'auto' }}
              >
                {PAGE_SIZE_OPTIONS.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className={styles.status}>No hay logos en esta categoría.</p>
          ) : (
            <>
              <div className={styles.grid}>
                {paginated.map(logo => (
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

              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={`btn btn-ghost ${styles.pageBtn}`}
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    ←
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      className={`btn ${p === currentPage ? 'btn-primary' : 'btn-ghost'} ${styles.pageBtn}`}
                      onClick={() => goToPage(p)}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    className={`btn btn-ghost ${styles.pageBtn}`}
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    →
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
