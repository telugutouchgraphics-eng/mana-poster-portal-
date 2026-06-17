import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { sendPortalMail } from "@/lib/server/mail";
import { RequestUser } from "@/lib/server/auth";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";

export type CommunityReportStatus = "open" | "closed";

export interface CommunityReportRow {
  id: string;
  contentType: string;
  statusId: string;
  commentId: string;
  reportedUserId: string;
  reportedUserName: string;
  reporterUserId: string;
  reporterName: string;
  reporterEmail: string;
  reason: string;
  details: string;
  statusTextPreview: string;
  commentTextPreview: string;
  statusImagePath: string;
  regionId: string;
  regionName: string;
  religionPreference: string;
  locationState: string;
  locationDistrict: string;
  locationCity: string;
  statusCreatedAt: number;
  reportedAt: number;
  reviewStatus: CommunityReportStatus;
  actionNote: string;
  actionByUid: string;
  actionByEmail: string;
  actionAt: number;
  reopenedAt: number;
  reopenedByEmail: string;
  userMailSentAt: number;
  userMailError: string;
}

function cleanStatus(value: string | null): CommunityReportStatus | "all" {
  const safe = (value ?? "open").trim().toLowerCase();
  if (safe === "closed" || safe === "all") {
    return safe;
  }
  return "open";
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function rowFromDoc(doc: { id: string; data(): FirebaseFirestore.DocumentData | undefined }): CommunityReportRow {
  const data = (doc.data() ?? {}) as Record<string, unknown>;
  const rawReviewStatus = String(data.reviewStatus ?? "open").trim().toLowerCase();
  return {
    id: doc.id,
    contentType: String(data.contentType ?? "").trim(),
    statusId: String(data.statusId ?? "").trim(),
    commentId: String(data.commentId ?? "").trim(),
    reportedUserId: String(data.reportedUserId ?? "").trim(),
    reportedUserName: String(data.reportedUserName ?? "").trim(),
    reporterUserId: String(data.reporterUserId ?? "").trim(),
    reporterName: String(data.reporterName ?? "").trim(),
    reporterEmail: String(data.reporterEmail ?? "").trim(),
    reason: String(data.reason ?? "").trim(),
    details: String(data.details ?? "").trim(),
    statusTextPreview: String(data.statusTextPreview ?? "").trim(),
    commentTextPreview: String(data.commentTextPreview ?? "").trim(),
    statusImagePath: String(data.statusImagePath ?? "").trim(),
    regionId: String(data.regionId ?? "").trim(),
    regionName: String(data.regionName ?? "").trim(),
    religionPreference: String(data.religionPreference ?? "").trim(),
    locationState: String(data.locationState ?? "").trim(),
    locationDistrict: String(data.locationDistrict ?? "").trim(),
    locationCity: String(data.locationCity ?? "").trim(),
    statusCreatedAt: toNumber(data.statusCreatedAt),
    reportedAt: toNumber(data.reportedAt),
    reviewStatus: rawReviewStatus === "closed" ? "closed" : "open",
    actionNote: String(data.actionNote ?? "").trim(),
    actionByUid: String(data.actionByUid ?? "").trim(),
    actionByEmail: String(data.actionByEmail ?? "").trim(),
    actionAt: toNumber(data.actionAt),
    reopenedAt: toNumber(data.reopenedAt),
    reopenedByEmail: String(data.reopenedByEmail ?? "").trim(),
    userMailSentAt: toNumber(data.userMailSentAt),
    userMailError: String(data.userMailError ?? "").trim(),
  };
}

export async function listCommunityReports(input: {
  status?: string | null;
  q?: string | null;
  regionId?: string | null;
}) {
  const status = cleanStatus(input.status ?? "open");
  const q = (input.q ?? "").trim().toLowerCase();
  const regionId = String(input.regionId ?? "").trim();
  const snap = await adminDb.collection("communityContentReports").get();

  return snap.docs
    .map(rowFromDoc)
    .filter((item) => !regionId || item.regionId === regionId)
    .filter((item) => status === "all" || item.reviewStatus === status)
    .filter((item) => {
      if (!q) return true;
      return [
        item.id,
        item.contentType,
        item.reason,
        item.details,
        item.reporterName,
        item.reporterEmail,
        item.reportedUserName,
        item.regionName,
        item.locationState,
        item.locationDistrict,
        item.locationCity,
        item.statusTextPreview,
        item.commentTextPreview,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    })
    .sort((a, b) => b.reportedAt - a.reportedAt)
    .slice(0, 300);
}

function buildUserUpdateMail(input: {
  report: CommunityReportRow;
  nextStatus: CommunityReportStatus;
  note: string;
}) {
  const contentLabel = input.report.contentType === "comment" ? "reply/comment" : "status";
  const actionLabel = input.nextStatus === "closed" ? "reviewed and closed" : "re-opened for review";
  const note = input.note.trim();
  const text = [
    "Hello,",
    "",
    `Your Mana Poster Ai ${contentLabel} report has been ${actionLabel}.`,
    `Report reason: ${input.report.reason || "Not specified"}`,
    note ? `Team note: ${note}` : "",
    "",
    "Thank you for helping keep the Mana Poster Ai community safe.",
  ]
    .filter(Boolean)
    .join("\n");
  const html = `<div style="font-family:Arial,sans-serif;padding:24px;color:#111827;line-height:1.6">
    <p style="margin:0 0 12px">Hello,</p>
    <p style="margin:0 0 12px">Your Mana Poster Ai <strong>${contentLabel}</strong> report has been <strong>${actionLabel}</strong>.</p>
    <p style="margin:0 0 8px"><strong>Report reason:</strong> ${input.report.reason || "Not specified"}</p>
    ${note ? `<p style="margin:0 0 12px"><strong>Team note:</strong> ${note}</p>` : ""}
    <p style="margin:16px 0 0;color:#374151">Thank you for helping keep the Mana Poster Ai community safe.</p>
  </div>`;
  return {
    subject: `Mana Poster Ai report update: ${actionLabel}`,
    text,
    html,
  };
}

export async function updateCommunityReport(input: {
  reportId: string;
  nextStatus: CommunityReportStatus;
  actionNote: string;
  sendUserEmail: boolean;
  actor: RequestUser;
}) {
  const reportRef = adminDb.collection("communityContentReports").doc(input.reportId);
  const snap = await reportRef.get();
  if (!snap.exists) {
    throw new Error("Report not found.");
  }
  const report = rowFromDoc(snap);
  await assertActorCanAccessRegion(input.actor, report.regionId);
  const now = Date.now();
  const note = input.actionNote.trim().slice(0, 1000);
  const patch: Record<string, unknown> = {
    reviewStatus: input.nextStatus,
    actionNote: note,
    actionByUid: input.actor.uid,
    actionByEmail: input.actor.email ?? "",
    actionAt: now,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (input.nextStatus === "open") {
    patch.reopenedAt = now;
    patch.reopenedByEmail = input.actor.email ?? "";
  }

  let userMailSent = false;
  let userMailError = "";
  if (input.sendUserEmail && report.reporterEmail) {
    try {
      const mail = buildUserUpdateMail({
        report,
        nextStatus: input.nextStatus,
        note,
      });
      await sendPortalMail({
        to: report.reporterEmail,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
      userMailSent = true;
      patch.userMailSentAt = now;
      patch.userMailError = "";
    } catch (error) {
      userMailError = error instanceof Error ? error.message : "Mail failed.";
      patch.userMailError = userMailError;
    }
  }

  await reportRef.set(patch, { merge: true });
  const nextSnap = await reportRef.get();
  return {
    report: rowFromDoc(nextSnap),
    userMailSent,
    userMailError,
  };
}
