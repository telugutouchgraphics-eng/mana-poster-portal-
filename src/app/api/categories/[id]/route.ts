import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { loadLandingPageRecord, saveLandingPageRecord } from "@/lib/server/landing-page-management";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { id } = await params;
    const body = await req.json();
    const landingPage = await loadLandingPageRecord();
    const items = landingPage.categories.items.map((item) =>
      item.id === id
        ? {
            ...item,
            ...body,
            id: item.id,
            sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : item.sortOrder,
          }
        : item,
    );
    const saved = await saveLandingPageRecord(
      { ...landingPage, categories: { ...landingPage.categories, items } },
      actor,
    );
    return NextResponse.json({ ok: true, categories: saved.categories.items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update category.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { id } = await params;
    const landingPage = await loadLandingPageRecord();
    const items = landingPage.categories.items.filter((item) => item.id !== id);
    const saved = await saveLandingPageRecord(
      { ...landingPage, categories: { ...landingPage.categories, items } },
      actor,
    );
    return NextResponse.json({ ok: true, categories: saved.categories.items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete category.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
