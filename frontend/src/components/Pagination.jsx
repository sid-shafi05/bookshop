// src/components/Pagination.jsx
export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const spread = 1;
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= page - spread && p <= page + spread)) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <div className="pagination-bar">
      <button className="page-nav-btn" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>‹ Prev</button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="page-dots">…</span>
        ) : (
          <button key={p} className={`page-num-btn ${p === page ? 'active' : ''}`} onClick={() => onPageChange(p)}>
            {p}
          </button>
        )
      )}
      <button className="page-nav-btn" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next ›</button>
    </div>
  );
}
