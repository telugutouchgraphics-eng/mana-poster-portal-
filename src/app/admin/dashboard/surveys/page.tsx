"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { DASHBOARD_REGIONS } from "@/lib/dashboard-regions";

interface SurveyQuestion {
  id?: string;
  question: string;
  options: string[];
  voteCounts?: Record<string, number>;
}

interface SurveyComment {
  userId: string;
  comment: string;
  createdAt: number;
}

interface SurveyItem {
  id: string;
  title: string;
  question: string;
  options: string[];
  questions?: SurveyQuestion[];
  voteCounts: Record<string, number>;
  totalVotes: number;
  status: "active" | "closed" | string;
  targetRegion: string;
  targetReligion?: string;
  recentComments?: SurveyComment[];
  createdAt: number;
  updatedAt: number;
}

interface FormQuestion {
  question: string;
  options: string[];
}

const RELIGION_OPTIONS = [
  { value: "all", label: "All Religions", icon: "🕉️" },
  { value: "hindu", label: "Hindu", icon: "🪔" },
  { value: "muslim", label: "Muslim", icon: "🌙" },
  { value: "christian", label: "Christian", icon: "✝️" },
] as const;

export default function AdminSurveysPage() {
  const { user } = useAuth();
  const [surveys, setSurveys] = useState<SurveyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<FormQuestion[]>([
    { question: "", options: ["", ""] },
  ]);
  const [targetReligion, setTargetReligion] = useState<string>("all");
  const [isStatesDropdownOpen, setIsStatesDropdownOpen] = useState(false);
  const [isAllRegions, setIsAllRegions] = useState(true);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [regionSearch, setRegionSearch] = useState("");
  const [creating, setCreating] = useState(false);

  // Open comments drawer tracking
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

  function toggleComments(id: string) {
    setExpandedComments((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // Question handlers
  function addQuestion() {
    if (questions.length < 10) {
      setQuestions([...questions, { question: "", options: ["", ""] }]);
    }
  }

  function removeQuestion(qIdx: number) {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== qIdx));
    }
  }

  function handleQuestionChange(qIdx: number, val: string) {
    const next = [...questions];
    next[qIdx].question = val;
    setQuestions(next);
  }

  function handleOptionChange(qIdx: number, optIdx: number, val: string) {
    const next = [...questions];
    next[qIdx].options[optIdx] = val;
    setQuestions(next);
  }

  function addOption(qIdx: number) {
    const next = [...questions];
    if (next[qIdx].options.length < 5) {
      next[qIdx].options.push("");
      setQuestions(next);
    }
  }

  function removeOption(qIdx: number, optIdx: number) {
    const next = [...questions];
    if (next[qIdx].options.length > 2) {
      next[qIdx].options = next[qIdx].options.filter((_, i) => i !== optIdx);
      setQuestions(next);
    }
  }

  // Region multi-select helpers
  function toggleRegion(id: string) {
    if (isAllRegions) {
      setIsAllRegions(false);
      setSelectedRegions([id]);
    } else {
      setSelectedRegions((prev) => {
        const next = prev.includes(id)
          ? prev.filter((r) => r !== id)
          : [...prev, id];
        if (next.length === DASHBOARD_REGIONS.length) {
          setIsAllRegions(true);
          return [];
        }
        return next;
      });
    }
  }

  function selectRegionPreset(ids: string[]) {
    setIsAllRegions(false);
    setSelectedRegions(ids);
  }

  function selectAllRegions() {
    setIsAllRegions(true);
    setSelectedRegions([]);
  }

  function clearAllRegions() {
    setIsAllRegions(false);
    setSelectedRegions([]);
  }

  function formatTargetRegion(target: string) {
    if (!target || target === "all") return "All States & UTs (All India)";
    const parts = target.split(",").map((p) => p.trim()).filter(Boolean);
    const names = parts.map((id) => {
      const found = DASHBOARD_REGIONS.find((r) => r.id === id);
      return found ? found.name : id;
    });
    return names.join(", ");
  }

  function formatReligion(rel?: string) {
    switch (rel?.toLowerCase()) {
      case "hindu":
        return "🪔 Hindu";
      case "muslim":
        return "🌙 Muslim";
      case "christian":
        return "✝️ Christian";
      default:
        return "🕉️ All Religions";
    }
  }

  function formatDateTime(timestamp?: number) {
    if (!timestamp) return "N/A";
    try {
      return new Date(timestamp).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return new Date(timestamp).toLocaleString();
    }
  }

  async function loadSurveys() {
    try {
      const token = await user?.getIdToken();
      if (!token) return;
      const res = await fetch("/api/admin/surveys", {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSurveys(data.surveys ?? []);
      } else {
        setStatusMessage(data.error ?? "Failed to load surveys.");
      }
    } catch {
      setStatusMessage("Error loading surveys.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSurveys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) {
        setStatusMessage(`Question #${i + 1} cannot be empty.`);
        return;
      }
      const cleanOpts = q.options.map((o) => o.trim()).filter((o) => o.length > 0);
      if (cleanOpts.length < 2) {
        setStatusMessage(`Question #${i + 1} must have at least 2 valid options.`);
        return;
      }
    }

    const payloadQuestions = questions.map((q, idx) => ({
      id: `q_${idx}`,
      question: q.question.trim(),
      options: q.options.map((o) => o.trim()).filter((o) => o.length > 0),
    }));

    setCreating(true);
    setStatusMessage(null);
    try {
      const token = await user?.getIdToken();
      if (!token) return;
      const finalTargetRegion =
        isAllRegions || selectedRegions.length === 0
          ? "all"
          : selectedRegions.join(",");

      const res = await fetch("/api/admin/surveys", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim() || "User Survey",
          questions: payloadQuestions,
          targetRegion: finalTargetRegion,
          targetReligion,
          status: "active",
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStatusMessage("Survey created and published successfully!");
        setTitle("");
        setQuestions([{ question: "", options: ["", ""] }]);
        setIsAllRegions(true);
        setSelectedRegions([]);
        setIsStatesDropdownOpen(false);
        setTargetReligion("all");
        await loadSurveys();
      } else {
        setStatusMessage(data.error ?? "Failed to create survey.");
      }
    } catch {
      setStatusMessage("Error creating survey.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleStatus(id: string, currentStatus: string) {
    const newAction = currentStatus === "active" ? "close" : "activate";
    try {
      const token = await user?.getIdToken();
      if (!token) return;
      const res = await fetch("/api/admin/surveys", {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ id, action: newAction }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        await loadSurveys();
      } else {
        setStatusMessage(data.error ?? "Failed to update survey status.");
      }
    } catch {
      setStatusMessage("Error updating survey.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this survey?")) return;
    try {
      const token = await user?.getIdToken();
      if (!token) return;
      const res = await fetch("/api/admin/surveys", {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ id, action: "delete" }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        await loadSurveys();
      } else {
        setStatusMessage(data.error ?? "Failed to delete survey.");
      }
    } catch {
      setStatusMessage("Error deleting survey.");
    }
  }

  // Client-side instant PDF generation (Zero cost, high-fidelity printable report)
  function downloadSurveyPdf(survey: SurveyItem) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to download the PDF report.");
      return;
    }

    const surveyQuestions =
      survey.questions && survey.questions.length > 0
        ? survey.questions
        : [
            {
              id: "q_0",
              question: survey.question,
              options: survey.options,
              voteCounts: survey.voteCounts,
            },
          ];

    const comments = survey.recentComments ?? [];

    const questionsHtml = surveyQuestions
      .map((q, idx) => {
        const qVotes = q.voteCounts ?? survey.voteCounts ?? {};
        const optionsRows = q.options
          .map((opt, optIdx) => {
            const count = qVotes[String(optIdx)] ?? 0;
            const pct =
              survey.totalVotes > 0
                ? Math.round((count / survey.totalVotes) * 100)
                : 0;
            return `
              <tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1e293b;">
                  ${opt}
                </td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: bold; text-align: center; color: #0f172a;">
                  ${count}
                </td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; width: 140px;">
                  <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
                    <div style="flex: 1; background: #e2e8f0; border-radius: 99px; height: 8px; overflow: hidden; min-width: 60px;">
                      <div style="background: #4f46e5; height: 100%; width: ${pct}%;"></div>
                    </div>
                    <span style="font-weight: bold; color: #4f46e5; width: 36px;">${pct}%</span>
                  </div>
                </td>
              </tr>
            `;
          })
          .join("");

        return `
          <div style="margin-bottom: 24px; padding: 16px; border: 1px solid #cbd5e1; border-radius: 10px; background: #ffffff; page-break-inside: avoid;">
            <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #1e1b4b;">
              Question #${idx + 1}: ${q.question}
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f8fafc;">
                  <th style="padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #cbd5e1;">Option</th>
                  <th style="padding: 8px 12px; text-align: center; font-size: 11px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #cbd5e1;">Votes</th>
                  <th style="padding: 8px 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #cbd5e1;">Share</th>
                </tr>
              </thead>
              <tbody>
                ${optionsRows}
              </tbody>
            </table>
          </div>
        `;
      })
      .join("");

    const commentsHtml =
      comments.length > 0
        ? `
        <div style="margin-top: 30px; page-break-inside: avoid;">
          <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 14px;">
            User Comments & Feedback (${comments.length})
          </h2>
          <div style="display: grid; gap: 10px;">
            ${comments
              .map(
                (c) => `
              <div style="padding: 10px 14px; background: #f8fafc; border-left: 3px solid #6366f1; border-radius: 6px; font-size: 12.5px; color: #334155;">
                <div style="font-style: italic; margin-bottom: 4px;">"${c.comment}"</div>
                <div style="font-size: 10px; color: #94a3b8;">User ID: ${c.userId.substring(0, 12)}... • ${formatDateTime(c.createdAt)}</div>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `
        : `
        <div style="margin-top: 20px; font-size: 12px; color: #94a3b8; font-style: italic;">
          No user comments submitted for this survey.
        </div>
      `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${survey.title || "Survey Results Report"} - Mana Poster</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4;
            margin: 1.5cm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 20px;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header {
            border-bottom: 2px solid #4f46e5;
            padding-bottom: 14px;
            margin-bottom: 20px;
          }
          .title {
            font-size: 22px;
            font-weight: 800;
            color: #1e1b4b;
            margin: 0 0 6px 0;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            background: #f1f5f9;
            padding: 14px;
            border-radius: 8px;
            margin-bottom: 24px;
            font-size: 12.5px;
          }
          .meta-item strong {
            color: #475569;
          }
          .print-btn {
            background: #4f46e5;
            color: white;
            border: none;
            padding: 10px 20px;
            font-size: 14px;
            font-weight: bold;
            border-radius: 8px;
            cursor: pointer;
            margin-bottom: 20px;
          }
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="text-align: right;">
          <button class="print-btn" onclick="window.print()">📥 Print / Save as PDF</button>
        </div>
        <div class="header">
          <div style="font-size: 11px; font-weight: 800; color: #4f46e5; letter-spacing: 1px; text-transform: uppercase;">
            Mana Poster AI • Official Survey & Poll Report
          </div>
          <h1 class="title">${survey.title || "User Preferences Survey"}</h1>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <strong>📅 Published Date:</strong> ${formatDateTime(survey.createdAt)}
          </div>
          <div class="meta-item">
            <strong>📊 Status:</strong> <span style="font-weight: bold; text-transform: uppercase; color: ${survey.status === "active" ? "#16a34a" : "#64748b"};">${survey.status}</span>
          </div>
          <div class="meta-item">
            <strong>📍 Target States:</strong> ${formatTargetRegion(survey.targetRegion)}
          </div>
          <div class="meta-item">
            <strong>🕉️ Target Religion:</strong> ${formatReligion(survey.targetReligion)}
          </div>
          <div class="meta-item" style="grid-column: span 2;">
            <strong>👥 Total Responses Received:</strong> <span style="font-size: 14px; font-weight: 800; color: #4f46e5;">${survey.totalVotes} Users</span>
          </div>
        </div>

        <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 16px;">
          Question Responses & Analysis
        </h2>

        ${questionsHtml}

        ${commentsHtml}

        <div style="margin-top: 40px; padding-top: 14px; border-top: 1px solid #cbd5e1; font-size: 10px; color: #94a3b8; text-align: center;">
          Generated on ${new Date().toLocaleString("en-IN")} • Mana Poster Admin Portal
        </div>

        <script>
          // Automatically trigger system print dialog
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }

  const activeSurveys = surveys.filter((s) => s.status === "active");
  const pastSurveys = surveys.filter((s) => s.status !== "active");

  const filteredRegions = DASHBOARD_REGIONS.filter((r) =>
    r.name.toLowerCase().includes(regionSearch.toLowerCase().trim()),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          App User Surveys & Polls
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Create multi-question surveys for mobile app users. Questions display in an animated carousel flow in the app.
        </p>
      </div>

      {statusMessage && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-800">
          {statusMessage}
        </div>
      )}

      {/* CREATE SURVEY CARD */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Create New Survey / Poll</h2>
            <p className="text-xs text-slate-500">Add questions, target regions & religion, and collect optional user comments.</p>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
            {questions.length} {questions.length === 1 ? "Question" : "Questions"}
          </span>
        </div>

        <form onSubmit={handleCreate} className="mt-6 space-y-6">
          {/* Survey Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Survey Title (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. User Preferences Survey 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* TARGET RELIGION SELECTOR */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Target Religion
                </label>
                <p className="text-xs text-slate-500">
                  Select which users should see this survey based on community preference.
                </p>
              </div>
              <span className="text-xs font-bold text-indigo-600">
                {formatReligion(targetReligion)}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RELIGION_OPTIONS.map((item) => {
                const isSelected = targetReligion === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTargetReligion(item.value)}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-center transition ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/80 text-indigo-950 shadow-xs ring-1 ring-indigo-600"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-xs font-bold">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TARGET STATES / REGIONS (PREMIUM FLOATING MULTI-SELECT DROPDOWN) */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Target States / Regions
                </label>
                <p className="text-xs text-slate-500">
                  Select which states and union territories should see this survey.
                </p>
              </div>
              <span className="text-xs font-bold text-indigo-600">
                {isAllRegions
                  ? "All India (All 36 States & UTs)"
                  : `${selectedRegions.length} States Selected`}
              </span>
            </div>

            {/* TRIGGER INPUT BAR */}
            <div
              onClick={() => setIsStatesDropdownOpen(!isStatesDropdownOpen)}
              className={`min-h-[48px] w-full rounded-xl border bg-white px-3.5 py-2 cursor-pointer transition flex items-center justify-between gap-2 select-none ${
                isStatesDropdownOpen
                  ? "border-indigo-600 ring-2 ring-indigo-100 shadow-sm"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex flex-wrap items-center gap-1.5 overflow-hidden">
                {isAllRegions ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 border border-indigo-100/80 px-2.5 py-1 text-xs font-bold text-indigo-700">
                    <span>🇮🇳</span>
                    <span>All India (All 36 States & Union Territories)</span>
                  </span>
                ) : selectedRegions.length === 0 ? (
                  <span className="text-xs text-slate-400 font-medium pl-1">
                    Click here to select states (Select States ▾)...
                  </span>
                ) : (
                  <>
                    {selectedRegions.slice(0, 3).map((id) => {
                      const r = DASHBOARD_REGIONS.find((item) => item.id === id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-900"
                        >
                          <span>{r ? r.name : id}</span>
                          <span
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRegion(id);
                            }}
                            className="hover:text-red-500 text-slate-400 text-xs px-0.5 font-bold"
                          >
                            ✕
                          </span>
                        </span>
                      );
                    })}
                    {selectedRegions.length > 3 && (
                      <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                        +{selectedRegions.length - 3} more
                      </span>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 text-slate-400">
                {!isAllRegions && selectedRegions.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAllRegions();
                    }}
                    className="p-1 hover:text-red-600 text-slate-400 text-xs font-medium"
                    title="Reset to All India"
                  >
                    Reset
                  </button>
                )}
                <span className="rounded-md bg-slate-100 p-1 text-slate-600">
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isStatesDropdownOpen ? "rotate-180 text-indigo-600" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </div>
            </div>

            {/* BACKDROP TO CLOSE DROPDOWN WHEN CLICKING OUTSIDE */}
            {isStatesDropdownOpen && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsStatesDropdownOpen(false)}
              />
            )}

            {/* FLOATING DROPDOWN MENU */}
            {isStatesDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
                {/* Search Header */}
                <div className="p-3.5 border-b border-slate-100 bg-slate-50/70 space-y-2.5">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="🔍 Search state or union territory (e.g. Andhra, Telangana, Delhi)..."
                      value={regionSearch}
                      onChange={(e) => setRegionSearch(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                      autoFocus
                    />
                    {regionSearch && (
                      <button
                        type="button"
                        onClick={() => setRegionSearch("")}
                        className="absolute right-3 top-2 text-xs text-slate-400 hover:text-slate-600"
                      >
                        ✕ Clear
                      </button>
                    )}
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={selectAllRegions}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        isAllRegions
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      🇮🇳 All India (36)
                    </button>
                    <button
                      type="button"
                      onClick={() => selectRegionPreset(["andhra_pradesh", "telangana"])}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        !isAllRegions &&
                        selectedRegions.length === 2 &&
                        selectedRegions.includes("andhra_pradesh") &&
                        selectedRegions.includes("telangana")
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100"
                      }`}
                    >
                      🏛️ AP & TS
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        selectRegionPreset([
                          "andhra_pradesh",
                          "telangana",
                          "tamil_nadu",
                          "karnataka",
                          "kerala",
                        ])
                      }
                      className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      South India
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        selectRegionPreset([
                          "delhi",
                          "uttar_pradesh",
                          "punjab",
                          "haryana",
                          "rajasthan",
                        ])
                      }
                      className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      North India
                    </button>
                    {!isAllRegions && (
                      <button
                        type="button"
                        onClick={clearAllRegions}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                {/* VERTICAL LIST */}
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 p-2">
                  {/* All India Master Row */}
                  <div
                    onClick={selectAllRegions}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition select-none ${
                      isAllRegions
                        ? "bg-indigo-50/70 text-indigo-950 font-bold"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center transition border ${
                          isAllRegions
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isAllRegions && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span>🇮🇳</span>
                        <span className="text-xs font-bold">All India (All States & Union Territories)</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100/60 px-2 py-0.5 rounded-md">
                      All 36
                    </span>
                  </div>

                  {/* State rows */}
                  {filteredRegions.map((region) => {
                    const isSelected = isAllRegions || selectedRegions.includes(region.id);

                    return (
                      <div
                        key={region.id}
                        onClick={() => toggleRegion(region.id)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition select-none ${
                          isSelected && !isAllRegions
                            ? "bg-indigo-50/60 text-indigo-950"
                            : "hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center transition border ${
                              isSelected
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <div className={`text-xs ${isSelected ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>
                              {region.name}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {region.primaryLanguage} • {region.kind}
                            </div>
                          </div>
                        </div>

                        {isSelected && !isAllRegions && (
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                            Selected ✓
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {filteredRegions.length === 0 && (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No states found matching "{regionSearch}"
                    </div>
                  )}
                </div>

                {/* Popover Footer */}
                <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">
                    {isAllRegions
                      ? "🇮🇳 All 36 States Selected"
                      : `${selectedRegions.length} of 36 States Selected`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsStatesDropdownOpen(false)}
                    className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700"
                  >
                    Done ✓
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* QUESTIONS BUILDER */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Survey Questions
              </label>
              {questions.length < 10 && (
                <button
                  type="button"
                  onClick={addQuestion}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
                >
                  <span className="text-sm">+</span> Add Another Question
                </button>
              )}
            </div>

            <div className="space-y-4">
              {questions.map((q, qIdx) => (
                <div
                  key={qIdx}
                  className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 transition hover:border-slate-300"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                        {qIdx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        Question #{qIdx + 1}
                      </span>
                    </div>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeQuestion(qIdx)}
                        className="rounded-lg p-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 hover:text-red-700"
                      >
                        Delete Question
                      </button>
                    )}
                  </div>

                  {/* Question Text */}
                  <div className="mt-3">
                    <textarea
                      rows={2}
                      required
                      placeholder={`Enter question #${qIdx + 1} (e.g. Which festival posters do you want?)`}
                      value={q.question}
                      onChange={(e) => handleQuestionChange(qIdx, e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Options */}
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">
                        Options (Min 2, Max 5)
                      </span>
                      {q.options.length < 5 && (
                        <button
                          type="button"
                          onClick={() => addOption(qIdx)}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
                        >
                          + Add Option
                        </button>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-400 w-4">
                            {optIdx + 1}.
                          </span>
                          <input
                            type="text"
                            required
                            placeholder={`Option ${optIdx + 1}`}
                            value={opt}
                            onChange={(e) => handleOptionChange(qIdx, optIdx, e.target.value)}
                            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                          />
                          {q.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeOption(qIdx, optIdx)}
                              className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {creating ? (
                "Publishing Survey..."
              ) : (
                <>
                  <span>🚀 Publish {questions.length > 1 ? `${questions.length}-Question` : ""} Survey to App</span>
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* ACTIVE SURVEY SECTION */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Active Survey in Mobile App</h2>
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Loading surveys...
          </div>
        ) : activeSurveys.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No active survey currently running. Create one above to ask questions to your app users.
          </div>
        ) : (
          activeSurveys.map((survey) => {
            const surveyQuestions =
              survey.questions && survey.questions.length > 0
                ? survey.questions
                : [
                    {
                      id: "q_0",
                      question: survey.question,
                      options: survey.options,
                      voteCounts: survey.voteCounts,
                    },
                  ];
            const comments = survey.recentComments ?? [];
            const showComments = expandedComments[survey.id] ?? false;

            return (
              <div
                key={survey.id}
                className="rounded-2xl border border-emerald-200 bg-emerald-50/20 p-6 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                        LIVE NOW
                      </span>
                      <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
                        {surveyQuestions.length} {surveyQuestions.length === 1 ? "Question" : "Questions (Carousel)"}
                      </span>
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                        {formatReligion(survey.targetReligion)}
                      </span>
                    </div>

                    <h3 className="mt-2 text-lg font-bold text-slate-900">
                      {survey.title || "User Survey"}
                    </h3>

                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span><strong>📅 Published:</strong> {formatDateTime(survey.createdAt)}</span>
                      <span><strong>📍 Target:</strong> {formatTargetRegion(survey.targetRegion)}</span>
                      <span><strong>👥 Completed:</strong> {survey.totalVotes} Users</span>
                    </div>
                  </div>

                  {/* Actions: Download PDF, Close, Delete */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => downloadSurveyPdf(survey)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-xs hover:bg-indigo-50"
                    >
                      <span>📄 Download PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(survey.id, survey.status)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Close Survey
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(survey.id)}
                      className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* QUESTIONS RESULTS BREAKDOWN */}
                <div className="mt-6 space-y-4">
                  {surveyQuestions.map((q, qIdx) => {
                    const qVotes = q.voteCounts ?? survey.voteCounts ?? {};
                    return (
                      <div
                        key={q.id ?? qIdx}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-700">
                            Question {qIdx + 1} of {surveyQuestions.length}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900">{q.question}</h4>

                        <div className="space-y-2">
                          {q.options.map((opt, optIdx) => {
                            const count = qVotes[String(optIdx)] ?? 0;
                            const pct =
                              survey.totalVotes > 0
                                ? Math.round((count / survey.totalVotes) * 100)
                                : 0;
                            return (
                              <div key={optIdx} className="space-y-1">
                                <div className="flex justify-between text-xs font-medium text-slate-700">
                                  <span>{opt}</span>
                                  <span>
                                    {count} votes ({pct}%)
                                  </span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full bg-indigo-600 transition-all duration-500"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* USER COMMENTS DRAWER */}
                <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                  <button
                    type="button"
                    onClick={() => toggleComments(survey.id)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">
                        💬 User Feedback & Comments ({comments.length})
                      </span>
                    </div>
                    <span className="text-xs font-bold text-indigo-600">
                      {showComments ? "Hide ▲" : "View All ▾"}
                    </span>
                  </button>

                  {showComments && (
                    <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100 pt-3">
                      {comments.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No feedback comments submitted yet.</p>
                      ) : (
                        <div className="max-h-60 space-y-2.5 overflow-y-auto pr-1">
                          {comments.map((c, i) => (
                            <div key={i} className="rounded-lg bg-slate-50 p-2.5 text-xs">
                              <p className="font-medium text-slate-800">"{c.comment}"</p>
                              <p className="mt-1 text-[10px] text-slate-400">
                                {formatDateTime(c.createdAt)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* PAST SURVEYS HISTORY */}
      {pastSurveys.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Past Surveys History</h2>
          <div className="space-y-4">
            {pastSurveys.map((survey) => {
              const surveyQuestions =
                survey.questions && survey.questions.length > 0
                  ? survey.questions
                  : [
                      {
                        id: "q_0",
                        question: survey.question,
                        options: survey.options,
                        voteCounts: survey.voteCounts,
                      },
                    ];
              const comments = survey.recentComments ?? [];
              const showComments = expandedComments[survey.id] ?? false;

              return (
                <div
                  key={survey.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                          CLOSED
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                          {surveyQuestions.length} {surveyQuestions.length === 1 ? "Question" : "Questions"}
                        </span>
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          {formatReligion(survey.targetReligion)}
                        </span>
                      </div>

                      <h3 className="mt-2 text-base font-bold text-slate-900">
                        {survey.title || survey.question}
                      </h3>

                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span><strong>📅 Published:</strong> {formatDateTime(survey.createdAt)}</span>
                        <span><strong>📍 Target:</strong> {formatTargetRegion(survey.targetRegion)}</span>
                        <span><strong>👥 Completed:</strong> {survey.totalVotes} Users</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadSurveyPdf(survey)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-xs hover:bg-indigo-50"
                      >
                        <span>📄 Download PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(survey.id, survey.status)}
                        className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        Re-activate
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(survey.id)}
                        className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {surveyQuestions.map((q, qIdx) => {
                      const qVotes = q.voteCounts ?? survey.voteCounts ?? {};
                      return (
                        <div key={q.id ?? qIdx} className="rounded-lg bg-slate-50 p-3 text-xs">
                          <p className="font-semibold text-slate-800">
                            Q{qIdx + 1}: {q.question}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-slate-600">
                            {q.options.map((opt, optIdx) => {
                              const count = qVotes[String(optIdx)] ?? 0;
                              return (
                                <span key={optIdx}>
                                  • {opt}: <strong className="text-slate-900">{count}</strong>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* USER COMMENTS DRAWER IN PAST SURVEY */}
                  {comments.length > 0 && (
                    <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                      <button
                        type="button"
                        onClick={() => toggleComments(survey.id)}
                        className="flex w-full items-center justify-between text-left text-xs font-bold text-slate-700"
                      >
                        <span>💬 User Comments ({comments.length})</span>
                        <span className="text-indigo-600">{showComments ? "Hide ▲" : "View ▾"}</span>
                      </button>
                      {showComments && (
                        <div className="mt-2 space-y-2 border-t border-slate-200/60 pt-2">
                          {comments.map((c, i) => (
                            <div key={i} className="text-xs text-slate-700">
                              <span className="italic">"{c.comment}"</span>
                              <span className="ml-2 text-[10px] text-slate-400">
                                ({formatDateTime(c.createdAt)})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
