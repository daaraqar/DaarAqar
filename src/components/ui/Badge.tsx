"use client";

import React from "react";

export type BadgeVariant =
  | "draft"
  | "pending_review"
  | "published"
  | "rejected"
  | "paused"
  | "archived"
  | "sale"
  | "rent"
  | "featured"
  | "verified"
  | "default";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  size = "md",
  className = "",
  ...props
}) => {
  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
  };

  const variantStyles: Record<BadgeVariant, string> = {
    draft: "bg-slate-100 text-slate-700 border border-slate-200",
    pending_review: "bg-amber-50 text-amber-800 border border-amber-300",
    published: "bg-emerald-50 text-emerald-800 border border-emerald-300",
    rejected: "bg-rose-50 text-rose-800 border border-rose-300",
    paused: "bg-purple-50 text-purple-800 border border-purple-300",
    archived: "bg-slate-200 text-slate-600 border border-slate-300",
    sale: "bg-brand-600 text-white font-black",
    rent: "bg-blue-600 text-white font-black",
    featured: "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-xs",
    verified: "bg-teal-50 text-teal-800 border border-teal-300 font-black",
    default: "bg-slate-100 text-slate-700 border border-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-bold rounded-full select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

export function getStatusBadgeProps(status: string): { variant: BadgeVariant; label: string } {
  switch (status) {
    case "draft":
      return { variant: "draft", label: "مسودة خاصة" };
    case "pending_review":
      return { variant: "pending_review", label: "قيد المراجعة والتدقيق" };
    case "published":
      return { variant: "published", label: "منشور ومفعل" };
    case "rejected":
      return { variant: "rejected", label: "مرفوض / يتطلب تعديلات" };
    case "paused":
      return { variant: "paused", label: "موقوف مؤقتاً" };
    case "archived":
      return { variant: "archived", label: "مؤرشف" };
    default:
      return { variant: "default", label: status };
  }
}
