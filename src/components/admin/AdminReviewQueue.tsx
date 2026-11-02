"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

type ReviewTaskStatus = "unassigned" | "assigned" | "in_progress" | "blocked" | "completed";
type ReviewTaskAction = "assign" | "claim" | "release" | "status";
type QueueFilter = "all" | "unassigned" | "mine" | "team";

interface ReviewEvent {
  id: string;
  actor_id: string | null;
  actorName: string;
  action: string;
  previous_status: string | null;
  next_status: string | null;
  created_at: string;
}

interface ReviewQueueItem {
  id: string;
  title: string;
  status: string;
  created_at: string;
  task: {
    id: string;
    assigned_to: string | null;
    assigned_by: string | null;
    status: ReviewTaskStatus;
    version: number;
    updated_at: string;
  } | null;
  assigneeName: string | null;
  activity: ReviewEvent[];
}

interface Reviewer {
  id: string;
  name: string;
}

interface ReviewQueueResponse {
  currentUserId: string;
  canManageAssignments: boolean;
  reviewers: Reviewer[];
  tasks: ReviewQueueItem[];
  recentActivity: Array<ReviewEvent & { propertyTitle: string }>;
}

const TASK_STATUS_LABELS: Record<ReviewTaskStatus, string> = {
  unassigned: "غير مسندة",
  assigned: "مسندة",
  in_progress: "قيد المراجعة",
  blocked: "متوقفة",
  completed: "مكتملة",
};

const EVENT_LABELS: Record<string, string> = {
  assigned: "إسناد المهمة",
  claimed: "استلام المهمة",
  released: "إعادة المهمة للفريق",
  status_changed: "تحديث حالة المهمة",
  moderated: "اتخاذ قرار إداري",
};

function formatQueueTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "وقت غير معروف";
  return date.toLocaleString("ar-EG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminReviewQueue() {
  const [data, setData] = useState<ReviewQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [busyPropertyId, setBusyPropertyId] = useState<string | null>(null);
  const requestInFlight = useRef(false);

  const loadQueue = useCallback(async (quiet = false) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/review-tasks", {
        cache: "no-store",
        credentials: "include",
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "تعذر تحميل قائمة مهام المراجعة.");
      }
      if (!Array.isArray(body.tasks) || !Array.isArray(body.reviewers) || !Array.isArray(body.recentActivity)) {
        throw new Error("وصلت بيانات مهام المراجعة بتنسيق غير متوقع.");
      }
      setData(body as ReviewQueueResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل قائمة مهام المراجعة.");
    } finally {
      requestInFlight.current = false;
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleTaskUpdates = () => void loadQueue(true);
    void loadQueue();
    window.addEventListener("admin-review-tasks-updated", handleTaskUpdates);
    const refreshTimer = window.setInterval(() => {
      if (!document.hidden) void loadQueue(true);
    }, 20000);
    return () => {
      window.removeEventListener("admin-review-tasks-updated", handleTaskUpdates);
      window.clearInterval(refreshTimer);
    };
  }, [loadQueue]);

  const filteredTasks = useMemo(() => {
    const tasks = data?.tasks || [];
    if (filter === "unassigned") return tasks.filter((item) => !item.task?.assigned_to);
    if (filter === "mine") return tasks.filter((item) => item.task?.assigned_to === data?.currentUserId);
    if (filter === "team") return tasks.filter((item) => Boolean(item.task?.assigned_to));
    return tasks;
  }, [data, filter]);

  const counts = useMemo(() => {
    const tasks = data?.tasks || [];
    return {
      all: tasks.length,
      unassigned: tasks.filter((item) => !item.task?.assigned_to).length,
      mine: tasks.filter((item) => item.task?.assigned_to === data?.currentUserId).length,
      team: tasks.filter((item) => Boolean(item.task?.assigned_to)).length,
    };
  }, [data]);

  const runAction = async (
    item: ReviewQueueItem,
    action: ReviewTaskAction,
    options: { assigneeId?: string; status?: "in_progress" | "blocked" } = {}
  ) => {
    setBusyPropertyId(item.id);
    setError(null);
    try {
      const response = await fetch("/api/admin/review-tasks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: item.id,
          action,
          assigneeId: options.assigneeId,
          status: options.status,
          expectedVersion: item.task?.version ?? 0,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "تعذر تحديث المهمة.");
      }
      await loadQueue();
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : "تعذر تحديث المهمة.";
      await loadQueue(true);
      setError(message);
    } finally {
      setBusyPropertyId(null);
    }
  };

  const filters: Array<{ id: QueueFilter; label: string }> = [
    { id: "all", label: "الكل" },
    { id: "unassigned", label: "غير مسندة" },
    { id: "mine", label: "مهامي" },
    { id: "team", label: "مسندة للفريق" },
  ];

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/[0.03] sm:p-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-black text-slate-900">تنظيم مراجعات الفريق</h2>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              استلام واضح لكل إعلان، مع سجل مشترك وحماية من تحديث مهمة قديمة.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadQueue()}
          disabled={loading}
          className="inline-flex min-h-9 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 px-3 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          تحديث المهام
        </button>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold leading-5 text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {data && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="تصفية مهام الفريق">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                aria-pressed={filter === item.id}
                className={`min-h-9 rounded-xl border px-3 text-[11px] font-bold transition-colors ${
                  filter === item.id
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {item.label}
                <span className={`mr-1.5 tabular-nums ${filter === item.id ? "text-white/70" : "text-slate-400"}`}>
                  {counts[item.id]}
                </span>
              </button>
            ))}
          </div>

          {loading && !data.tasks.length ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-emerald-700" /></div>
          ) : filteredTasks.length ? (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">
              {filteredTasks.map((item) => {
                const taskStatus = item.task?.status || "unassigned";
                const isMine = item.task?.assigned_to === data.currentUserId;
                const isBusy = busyPropertyId === item.id;
                return (
                  <article key={item.id} className="space-y-3 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xs font-black text-slate-900">{item.title}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            taskStatus === "blocked"
                              ? "bg-rose-50 text-rose-700"
                              : taskStatus === "in_progress"
                              ? "bg-sky-50 text-sky-700"
                              : taskStatus === "assigned"
                              ? "bg-indigo-50 text-indigo-700"
                              : "bg-slate-100 text-slate-600"
                          }`}>
                            {TASK_STATUS_LABELS[taskStatus]}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400">
                          أُرسل للمراجعة {formatQueueTime(item.created_at)}
                          {item.assigneeName ? ` · المسؤول: ${item.assigneeName}` : ""}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {data.canManageAssignments && (
                          <label className="sr-only" htmlFor={`assign-${item.id}`}>إسناد {item.title}</label>
                        )}
                        {data.canManageAssignments && (
                          <select
                            id={`assign-${item.id}`}
                            value={item.task?.assigned_to || ""}
                            disabled={isBusy}
                            onChange={(event) => {
                              if (event.target.value) {
                                void runAction(item, "assign", { assigneeId: event.target.value });
                              }
                            }}
                            className="min-h-9 max-w-48 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-700"
                          >
                            <option value="" disabled>إسناد لموظف...</option>
                            {data.reviewers.map((reviewer) => (
                              <option key={reviewer.id} value={reviewer.id}>{reviewer.name}</option>
                            ))}
                          </select>
                        )}
                        {!item.task?.assigned_to && (
                          <button
                            type="button"
                            onClick={() => void runAction(item, "claim")}
                            disabled={isBusy}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-[10px] font-black text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
                          >
                            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                            استلام المهمة
                          </button>
                        )}
                        {item.task?.assigned_to && (isMine || data.canManageAssignments) && taskStatus !== "completed" && (
                          <>
                            <button
                              type="button"
                              onClick={() => void runAction(item, "status", {
                                status: taskStatus === "blocked" ? "in_progress" : "blocked",
                              })}
                              disabled={isBusy}
                              className="min-h-9 rounded-lg border border-slate-200 px-3 text-[10px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                            >
                              {taskStatus === "blocked" ? "استئناف العمل" : "تعليق مؤقت"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void runAction(item, "release")}
                              disabled={isBusy}
                              title="إعادة المهمة إلى قائمة الفريق"
                              className="min-h-9 rounded-lg border border-slate-200 px-3 text-[10px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                            >
                              إعادة للفريق
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {item.activity.length > 0 && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-50 pt-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                          <Clock3 className="h-3 w-3" />
                          آخر نشاط
                        </span>
                        {item.activity.slice(0, 2).map((event) => (
                          <span key={event.id} className="text-[10px] text-slate-500">
                            {EVENT_LABELS[event.action] || "تحديث"} · {event.actorName} · {formatQueueTime(event.created_at)}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
              <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600" />
              <p className="mt-2 text-xs font-black text-slate-800">
                {filter === "mine" ? "لا توجد مهام مسندة إليك" : "لا توجد إعلانات مطابقة لهذا العرض"}
              </p>
            </div>
          )}
          <p className="flex items-center gap-1.5 text-[10px] leading-5 text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            استلام المهمة وتحديثها محميان بإصدار متزامن؛ إذا سبقك زميلك ستظهر أحدث حالة بدلاً من الكتابة فوقها.
          </p>
          {data.recentActivity.length > 0 && (
            <section className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <h3 className="mb-2 text-[10px] font-black text-slate-600">آخر نشاط على مراجعات الفريق</h3>
              <div className="space-y-2">
                {data.recentActivity.slice(0, 6).map((event) => (
                  <div key={event.id} className="flex flex-col gap-1 text-[10px] sm:flex-row sm:items-center sm:justify-between">
                    <p className="min-w-0 truncate text-slate-600">
                      <span className="font-black text-slate-800">{EVENT_LABELS[event.action] || "تحديث"}</span>
                      {" · "}{event.propertyTitle}{" · "}{event.actorName}
                    </p>
                    <time className="shrink-0 text-slate-400">{formatQueueTime(event.created_at)}</time>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
