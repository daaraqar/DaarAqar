"use client";

import React, { forwardRef } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string | null;
  hint?: string;
  options?: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, children, className = "", id, ...props }, ref) => {
    const selectId = id || (label ? `select-${label.replace(/\s+/g, "-")}` : undefined);

    return (
      <div className="w-full space-y-1.5 text-right" dir="rtl">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-bold text-slate-800">
            {label} {props.required && <span className="text-rose-500">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            id={selectId}
            ref={ref}
            className={`w-full py-2.5 pl-9 pr-3.5 bg-slate-50 border rounded-xl text-xs sm:text-sm font-medium text-slate-900 transition-all outline-none appearance-none focus:bg-white focus:ring-2 disabled:bg-slate-100 disabled:cursor-not-allowed ${
              error
                ? "border-rose-400 focus:border-rose-600 focus:ring-rose-500/15"
                : "border-slate-200 focus:border-brand-600 focus:ring-brand-500/15"
            } ${className}`}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <ChevronDown className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
        {error && <p className="text-[11px] font-bold text-rose-600 mt-1">{error}</p>}
        {hint && !error && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
