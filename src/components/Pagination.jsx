import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Previous / Next bar for lists paged on the server (same look as the IPD Admission list).
 *
 * @param {number}   page         zero-based page number
 * @param {number}   pageSize     rows per page
 * @param {number}   total        total rows (from `count` in the Supabase response)
 * @param {Function} onPageChange called with the new zero-based page
 * @param {boolean}  disabled     e.g. while the next page is loading
 * @param {string}   label        word after the count, e.g. "patients"
 */
export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  disabled = false,
  label = "records",
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-white">
      <p className="text-sm text-gray-600">
        {total === 0 ? `0 ${label}` : `Showing ${first}–${last} of ${total} ${label}`}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={disabled || page === 0}
          className="flex items-center gap-1 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        <span className="text-sm text-gray-600 whitespace-nowrap">
          Page {page + 1} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || page + 1 >= totalPages}
          className="flex items-center gap-1 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
