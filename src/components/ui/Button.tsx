"use client";

import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost" | "gold";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      className = "",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]";

    const sizeStyles = {
      sm: "px-3 py-1.5 text-xs gap-1.5",
      md: "px-4 py-2.5 text-xs sm:text-sm gap-2",
      lg: "px-6 py-3.5 text-sm sm:text-base gap-2.5 rounded-2xl",
    };

    const variantStyles = {
      primary:
        "bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-600/20 focus-visible:ring-brand-500",
      secondary:
        "bg-slate-100 hover:bg-slate-200 text-slate-800 focus-visible:ring-slate-400",
      outline:
        "bg-transparent border border-slate-300 hover:bg-slate-50 text-slate-700 focus-visible:ring-slate-400",
      danger:
        "bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 focus-visible:ring-rose-500",
      ghost:
        "bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 focus-visible:ring-slate-400",
      gold:
        "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black shadow-md shadow-amber-500/20 focus-visible:ring-amber-400",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span>{children}</span>
          </>
        ) : (
          <>
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
            <span>{children}</span>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
