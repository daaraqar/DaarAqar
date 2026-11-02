"use client";

import React from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  className = "",
}) => {
  if (totalPages <= 1) return null;

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const delta = 1;

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        pages.push(i);
      } else if (
        (i === currentPage - delta - 1 && i > 1) ||
        (i === currentPage + delta + 1 && i < totalPages)
      ) {
        pages.push("...");
      }
    }

    // Deduplicate consecutive ellipses
    return pages.filter((page, index) => {
      if (page === "..." && pages[index - 1] === "...") return false;
      return true;
    });
  };

  const pages = getPageNumbers();

  return (
    <nav
      aria-label="التنقل بين الصفحات"
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-4 ${className}`}
      dir="rtl"
    >
      {totalItems !== undefined && pageSize !== undefined && (
        <span className="text-xs font-semibold text-slate-500">
          عرض {Math.min((currentPage - 1) * pageSize + 1, totalItems)} -{" "}
          {Math.min(currentPage * pageSize, totalItems)} من أصل {totalItems} عقار
        </span>
      )}

      <div className="flex items-center gap-1.5 select-none">
        {/* Next / Previous in RTL: Right arrow goes to previous page */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="الصفحة السابقة"
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {pages.map((p, idx) =>
          typeof p === "number" ? (
            <button
              key={idx}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === currentPage ? "page" : undefined}
              className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${
                p === currentPage
                  ? "bg-brand-600 text-white shadow-md shadow-brand-600/20 font-black"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          ) : (
            <span
              key={idx}
              className="w-9 h-9 flex items-center justify-center text-xs text-slate-400 font-bold"
            >
              ...
            </span>
          )
        )}

        {/* Next page */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="الصفحة التالية"
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
};
