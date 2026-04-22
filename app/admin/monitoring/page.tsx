"use client";

/**
 * @file app/admin/monitoring/page.tsx
 * @description Cost and health monitoring dashboard for PrintPerfect.
 *
 * Shows real-time API spending, token usage, and system health metrics.
 * Protected by middleware cookie (pp_admin) set at /admin/login.
 *
 * Two tabs:
 * 1. Cost — daily/weekly/monthly/yearly spend, trends, model breakdown, recent requests
 * 2. Health — error rates, uptime, request volume, recent errors
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import SpoolIcon from "@/components/SpoolIcon";
import {
  LogOut, ArrowLeft, TrendingUp, DollarSign, Activity, AlertCircle, Check,
} from "lucide-react";

interface ApiStats {
  costMetrics: {
    today: number;
    week: number;
    month: number;
    year: number;
    byModel: Record<string, number>;
  };
  tokenMetrics: {
    totalInputToday: number;
    totalOutputToday: number;
    avgTokensPerRequestToday: number;
  };
  totalToday: number;
  allowedToday: number;
  blockedToday: number;
  suspiciousToday: number;
}

interface ApiMonitoringData {
  stats: ApiStats;
  logs: any[];
  note?: string;
}

export default function AdminMonitoringPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"cost" | "health">("cost");
  const [data, setData] = useState<ApiMonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>("");

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/api-monitor?ts=" + Date.now());
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) {
        throw new Error("Failed to load monitoring data");
      }
      const json = await res.json();
      setData(json);
      setError(null);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [loadData]);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4 text-center">
        <div>
          <p className="text-slate-500 dark:text-slate-400 mb-4">{error || "Failed to load monitoring data."}</p>
          <button onClick={loadData} className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-primary-600">
              <SpoolIcon className="w-6 h-6" />
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100">PrintPerfect</span>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-full ml-1">
              Monitoring
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin/settings" className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              Settings
            </a>
            <a href="/admin" className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              <ArrowLeft size={14} /> Admin
            </a>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Page title */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Cost & Health Monitoring</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
              Real-time API usage metrics and system health dashboard.
            </p>
            {lastRefresh && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                <Check size={11} className="text-emerald-500" /> Last updated: {lastRefresh}
              </p>
            )}
          </div>
          <button
            onClick={loadData}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setTab("cost")}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              tab === "cost"
                ? "text-primary-600 dark:text-primary-400 border-primary-600 dark:border-primary-400"
                : "text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <DollarSign size={16} className="inline mr-2 align-text-bottom" />
            Cost
          </button>
          <button
            onClick={() => setTab("health")}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              tab === "health"
                ? "text-primary-600 dark:text-primary-400 border-primary-600 dark:border-primary-400"
                : "text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <Activity size={16} className="inline mr-2 align-text-bottom" />
            Health
          </button>
        </div>

        {/* Cost Tab */}
        {tab === "cost" && (
          <div className="space-y-6">
            {/* Key metrics cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Today's Spend</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  ${data.stats.costMetrics.today.toFixed(2)}
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">This Week</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  ${data.stats.costMetrics.week.toFixed(2)}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  ~${(data.stats.costMetrics.week / 7).toFixed(2)} / day
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">This Month</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  ${data.stats.costMetrics.month.toFixed(2)}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  ~${(data.stats.costMetrics.month / 30).toFixed(2)} / day
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Yearly Projection</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  ${(data.stats.costMetrics.year * (365 / 365)).toFixed(2)}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Based on this year's rate
                </p>
              </div>
            </div>

            {/* Token metrics */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Token Usage Today</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Input Tokens</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {data.stats.tokenMetrics.totalInputToday.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Output Tokens</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {data.stats.tokenMetrics.totalOutputToday.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Avg per Request</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {data.stats.tokenMetrics.avgTokensPerRequestToday.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Cost by model */}
            {Object.keys(data.stats.costMetrics.byModel).length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Cost by Model</h3>
                <div className="space-y-3">
                  {Object.entries(data.stats.costMetrics.byModel)
                    .sort(([, a], [, b]) => b - a)
                    .map(([model, cost]) => (
                      <div key={model} className="flex items-center justify-between">
                        <span className="text-sm text-slate-700 dark:text-slate-300 font-mono">{model}</span>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 max-w-xs h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                              className="h-2 rounded-full bg-primary-500 transition-all"
                              style={{
                                width: `${
                                  (cost /
                                    Math.max(
                                      ...Object.values(data.stats.costMetrics.byModel),
                                      cost
                                    )) *
                                  100
                                }%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 w-16 text-right">
                            ${cost.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Info box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                <TrendingUp size={16} className="inline mr-2 align-text-bottom" />
                Refresh every 30 seconds. Configure alerts and thresholds in{" "}
                <a href="/admin/settings" className="font-semibold hover:underline">
                  Admin → Settings → Alert Configuration
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Health Tab */}
        {tab === "health" && (
          <div className="space-y-6">
            {/* Status cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Requests Today</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {data.stats.totalToday}
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Allowed</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {data.stats.allowedToday}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {data.stats.totalToday > 0
                    ? ((data.stats.allowedToday / data.stats.totalToday) * 100).toFixed(1)
                    : "0"}
                  % success rate
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Blocked / Suspicious</p>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                  {data.stats.blockedToday + data.stats.suspiciousToday}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {data.stats.blockedToday} blocked · {data.stats.suspiciousToday} suspicious
                </p>
              </div>
            </div>

            {/* Coming soon */}
            <div className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center">
              <AlertCircle size={32} className="mx-auto text-slate-400 dark:text-slate-500 mb-3" />
              <p className="text-slate-600 dark:text-slate-400 font-medium">
                Detailed health metrics coming soon
              </p>
              <p className="text-slate-500 dark:text-slate-500 text-sm mt-1">
                This includes 24-hour request timeline, error rates, and error history.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
