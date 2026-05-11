import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { loadPortalAnalyticsSnapshot } from "@/lib/server/dashboard-metrics";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const status = (url.searchParams.get("status") ?? "all").trim().toLowerCase();
    const format = (url.searchParams.get("format") ?? "json").trim().toLowerCase();
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, Number(url.searchParams.get("pageSize") ?? 10) || 10),
    );
    const snapshot = await loadPortalAnalyticsSnapshot();

    const filteredRows = snapshot.payouts
      .filter((item) => (status === "all" ? true : item.status.toLowerCase() === status))
      .filter((item) => {
        if (!q) return true;
        const search = [item.creatorPublicId, item.note, item.status].join(" ").toLowerCase();
        return search.includes(q);
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    if (format === "csv") {
      const lines = [
        "creatorPublicId,amount,status,note,createdAt",
        ...filteredRows.map((item) =>
          [
            item.creatorPublicId,
            item.amount,
            item.status,
            `"${String(item.note ?? "").replaceAll('"', '""')}"`,
            item.createdAt,
          ].join(","),
        ),
      ];
      return new NextResponse(lines.join("\n"), {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="creator-payouts.csv"',
        },
      });
    }

    const total = filteredRows.length;
    const start = (page - 1) * pageSize;
    const rows = filteredRows.slice(start, start + pageSize);

    return NextResponse.json({
      ok: true,
      payouts: rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load payouts.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
