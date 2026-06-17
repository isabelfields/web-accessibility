'use client'

interface Props {
  page: number
  pageCount: number
  onPage: (page: number) => void
}

/** Simple Previous/Next pager. Renders nothing when there's a single page. */
export function Pagination({ page, pageCount, onPage }: Props) {
  if (pageCount <= 1) return null
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm"
    >
      <span className="text-gray-500">Page {page} of {pageCount}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          className="px-3 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </nav>
  )
}
