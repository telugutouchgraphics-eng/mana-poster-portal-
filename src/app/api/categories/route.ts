import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { loadLandingPageRecord, saveLandingPageRecord } from "@/lib/server/landing-page-management";

export async function GET() {
  try {
    const landingPage = await loadLandingPageRecord();
    return NextResponse.json({ ok: true, categories: landingPage.categories.items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load categories.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const body = (await req.json()) as {
      title?: string;
      subtitle?: string;
      description?: string;
      emoji?: string;
      imageUrl?: string;
      imagePath?: string;
    };
    const landingPage = await loadLandingPageRecord();
    const now = Date.now();
    const next = {
      ...landingPage,
      categories: {
        ...landingPage.categories,
        items: [
          ...landingPage.categories.items,
          {
            id: `category-${now}`,
            title: body.title?.trim() || "New Category",
            subtitle: body.subtitle?.trim() || "",
            description: body.description?.trim() || "",
            emoji: body.emoji?.trim() || "+",
            imageUrl: body.imageUrl?.trim() || "",
            imagePath: body.imagePath?.trim() || "",
            buttonText: "Explore",
            buttonLink: "#categories",
            sortOrder: (landingPage.categories.items.length + 1) * 10,
            visible: true,
            published: true,
          },
        ],
      },
    };
    const saved = await saveLandingPageRecord(next, actor);
    return NextResponse.json({ ok: true, categories: saved.categories.items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create category.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
