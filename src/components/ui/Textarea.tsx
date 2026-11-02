"use client";

import React, { forwardRef } from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string | null;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = "", id, rows = 4, ...props }, ref) => {
    const textareaId = id || (label ? `textarea-${label.replace(/\s+/g, "-")}` : undefined);

    return (
      <div className="w-full space-y-1.5 text-right" dir="rtl">
        {label && (
          <label htmlFor={textareaId} className="block text-xs font-bold text-slate-800">
            {label} {props.required && <span className="text-rose-500">*</span>}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          rows={rows}
          className={`w-full py-2.5 px-3.5 bg-slate-50 border rounded-xl text-xs sm:text-sm font-medium text-slate-900 transition-all outline-none resize-y placeholder:text-slate-400 focus:bg-white focus:ring-2 disabled:bg-slate-100 disabled:cursor-not-allowed ${
            error
              ? "border-rose-400 focus:border-rose-600 focus:ring-rose-500/15"
              : "border-slate-200 focus:border-brand-600 focus:ring-brand-500/15"
          } ${className}`}
          {...props}
        />
        {error && <p className="text-[11px] font-bold text-rose-600 mt-1">{error}</p>}
        {hint && !error && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
