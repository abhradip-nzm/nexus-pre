import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import './Pagination.css';

/**
 * Pagination component
 * Props:
 *   page        — current page (1-indexed)
 *   totalPages  — total number of pages
 *   total       — total number of records
 *   limit       — records per page
 *   onPageChange(newPage) — callback
 */
export default function Pagination({ page, totalPages, total, limit, onPageChange }) {
  if (!totalPages || totalPages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  // Build the page number buttons with smart ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [];
    if (page <= 4) {
      pages.push(1, 2, 3, 4, 5, '...', totalPages);
    } else if (page >= totalPages - 3) {
      pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
    }
    return pages;
  };

  return (
    <div className="pagination-bar">
      <span className="pagination-info">
        Showing {from}–{to} of {total}
      </span>

      <div className="pagination-controls">
        <button
          className="pg-btn"
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          title="First page"
        >
          <ChevronsLeft size={14} />
        </button>
        <button
          className="pg-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          title="Previous page"
        >
          <ChevronLeft size={14} />
        </button>

        {getPageNumbers().map((p, i) =>
          p === '...'
            ? <span key={`ellipsis-${i}`} className="pg-ellipsis">…</span>
            : <button
                key={p}
                className={`pg-btn pg-num${p === page ? ' pg-active' : ''}`}
                onClick={() => p !== page && onPageChange(p)}
                disabled={p === page}
              >
                {p}
              </button>
        )}

        <button
          className="pg-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          title="Next page"
        >
          <ChevronRight size={14} />
        </button>
        <button
          className="pg-btn"
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          title="Last page"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}
