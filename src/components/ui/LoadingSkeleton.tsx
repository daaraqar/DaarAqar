"use client";

import React from "react";

export const PropertyCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse">
      <div className="aspect-[16/10] bg-slate-200 w-full" />
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div className="h-5 bg-slate-200 rounded-lg w-28" />
          <div className="h-5 bg-slate-200 rounded-lg w-16" />
        </div>
        <div className="h-4 bg-slate-200 rounded-lg w-3/4" />
        <div className="h-3 bg-slate-100 rounded-lg w-1/2" />
        <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
          <div className="h-6 bg-slate-200 rounded-full w-20" />
          <div className="h-7 bg-slate-200 rounded-lg w-16" />
        </div>
      </div>
    </div>
  );
};

export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 5 }) => {
  return (
    <tr className="animate-pulse border-b border-slate-100">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="py-4 px-4">
          <div className="h-4 bg-slate-200 rounded-lg w-full" />
        </td>
      ))}
    </tr>
  );
};
