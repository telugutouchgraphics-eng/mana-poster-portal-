import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const snap = await adminDb
      .collection("appSurveys")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const surveys = snap.docs.map((doc) => {
      const data = doc.data();
      const rawQuestions = Array.isArray(data.questions) ? data.questions : [];
      let questions = rawQuestions
        .map((q: any, idx: number) => ({
          id: String(q?.id ?? `q_${idx}`).trim(),
          question: String(q?.question ?? "").trim(),
          options: Array.isArray(q?.options) ? q.options.map(String) : [],
          voteCounts:
            q?.voteCounts && typeof q.voteCounts === "object"
              ? q.voteCounts
              : {},
        }))
        .filter((q: any) => q.question.length > 0);

      if (questions.length === 0 && data.question) {
        questions = [
          {
            id: "q_0",
            question: String(data.question ?? "").trim(),
            options: Array.isArray(data.options) ? data.options.map(String) : [],
            voteCounts:
              data.voteCounts && typeof data.voteCounts === "object"
                ? data.voteCounts
                : {},
          },
        ];
      }

      const recentComments = Array.isArray(data.recentComments)
        ? data.recentComments
            .map((c: any) => ({
              userId: String(c?.userId ?? ""),
              comment: String(c?.comment ?? "").trim(),
              createdAt: Number(c?.createdAt ?? 0),
            }))
            .filter((c: any) => c.comment.length > 0)
        : [];

      return {
        id: doc.id,
        title: String(data.title ?? "").trim(),
        question: String(data.question ?? (questions[0]?.question ?? "")).trim(),
        options: Array.isArray(data.options)
          ? data.options
          : (questions[0]?.options ?? []),
        questions,
        voteCounts:
          data.voteCounts && typeof data.voteCounts === "object"
            ? data.voteCounts
            : (questions[0]?.voteCounts ?? {}),
        totalVotes: Number(data.totalVotes ?? 0),
        status: String(data.status ?? "active").trim(),
        targetRegion: String(data.targetRegion ?? "all").trim(),
        targetReligion: String(data.targetReligion ?? "all").trim(),
        recentComments,
        createdAt: Number(data.createdAt ?? 0),
        updatedAt: Number(data.updatedAt ?? 0),
      };
    });

    return NextResponse.json({ ok: true, surveys });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load surveys.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const body = await req.json();

    const title = String(body.title ?? "").trim();
    const targetRegion = String(body.targetRegion ?? "all").trim();
    const allowedReligions = ["all", "hindu", "muslim", "christian"];
    const rawReligion = String(body.targetReligion ?? "all").toLowerCase().trim();
    const targetReligion = allowedReligions.includes(rawReligion) ? rawReligion : "all";
    const status = body.status === "closed" ? "closed" : "active";

    interface QuestionInput {
      id?: string;
      question: string;
      options: string[];
      voteCounts?: Record<string, number>;
    }

    let inputQuestions: QuestionInput[] = [];
    if (Array.isArray(body.questions) && body.questions.length > 0) {
      inputQuestions = body.questions.map((q: any, idx: number) => {
        const qText = String(q?.question ?? "").trim();
        const rawOpts = Array.isArray(q?.options) ? q.options : [];
        const opts = rawOpts
          .map((o: unknown) => String(o ?? "").trim())
          .filter((o: string) => o.length > 0);
        return {
          id: String(q?.id ?? `q_${idx}`),
          question: qText,
          options: opts,
        };
      });
    } else {
      const qText = String(body.question ?? "").trim();
      const rawOpts = Array.isArray(body.options) ? body.options : [];
      const opts = rawOpts
        .map((o: unknown) => String(o ?? "").trim())
        .filter((o: string) => o.length > 0);
      if (qText) {
        inputQuestions.push({
          id: "q_0",
          question: qText,
          options: opts,
        });
      }
    }

    if (inputQuestions.length === 0) {
      return NextResponse.json(
        { ok: false, error: "At least one question is required." },
        { status: 400 },
      );
    }

    for (let i = 0; i < inputQuestions.length; i++) {
      const q = inputQuestions[i];
      if (!q.question) {
        return NextResponse.json(
          { ok: false, error: `Question #${i + 1} cannot be empty.` },
          { status: 400 },
        );
      }
      if (q.options.length < 2) {
        return NextResponse.json(
          {
            ok: false,
            error: `Question #${i + 1} must have at least 2 options.`,
          },
          { status: 400 },
        );
      }
      const qVotes: Record<string, number> = {};
      for (let j = 0; j < q.options.length; j++) {
        qVotes[String(j)] = 0;
      }
      q.voteCounts = qVotes;
    }

    const now = Date.now();

    // If making this survey active, close any other active surveys
    if (status === "active") {
      const activeSnaps = await adminDb
        .collection("appSurveys")
        .where("status", "==", "active")
        .get();

      const batch = adminDb.batch();
      for (const d of activeSnaps.docs) {
        batch.update(d.ref, { status: "closed", updatedAt: now });
      }
      await batch.commit();
    }

    const docRef = adminDb.collection("appSurveys").doc();
    await docRef.set({
      id: docRef.id,
      title: title || "User Survey",
      // Legacy backward compatibility fields:
      question: inputQuestions[0].question,
      options: inputQuestions[0].options,
      voteCounts: inputQuestions[0].voteCounts,
      // Full multi-question support:
      questions: inputQuestions,
      totalVotes: 0,
      status,
      targetRegion,
      targetReligion,
      recentComments: [],
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ ok: true, id: docRef.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create survey.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const body = await req.json();
    const id = String(body.id ?? "").trim();
    const action = String(body.action ?? "").trim(); // "activate" | "close" | "delete"

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Survey ID is required." },
        { status: 400 },
      );
    }

    const docRef = adminDb.collection("appSurveys").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json(
        { ok: false, error: "Survey not found." },
        { status: 404 },
      );
    }

    const now = Date.now();

    if (action === "delete") {
      await docRef.delete();
      return NextResponse.json({ ok: true, deleted: true });
    }

    if (action === "activate") {
      // Close other active surveys
      const activeSnaps = await adminDb
        .collection("appSurveys")
        .where("status", "==", "active")
        .get();

      const batch = adminDb.batch();
      for (const d of activeSnaps.docs) {
        if (d.id !== id) {
          batch.update(d.ref, { status: "closed", updatedAt: now });
        }
      }
      batch.update(docRef, { status: "active", updatedAt: now });
      await batch.commit();
      return NextResponse.json({ ok: true, status: "active" });
    }

    if (action === "close") {
      await docRef.update({ status: "closed", updatedAt: now });
      return NextResponse.json({ ok: true, status: "closed" });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid action." },
      { status: 400 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update survey.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
