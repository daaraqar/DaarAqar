"use client";

import React from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "./Button";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}) => {
  return (
    <div
      className={`py-16 px-6 bg-white rounded-3xl border border-slate-200 text-center flex flex-col items-center justify-center space-y-3.5 max-w-lg mx-auto ${className}`}
      dir="rtl"
    >
      <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-150 flex items-center justify-center text-slate-400">
        {icon || <AlertCircle className="w-7 h-7 text-amber-500" />}
      </div>
      <h3 className="text-base font-black text-slate-900">{title}</h3>
      {description && (
        <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <div className="pt-2">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
