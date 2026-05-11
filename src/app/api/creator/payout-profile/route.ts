import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireCreatorAccessContext } from "@/lib/server/creator-dashboard";
import { writeAuditLog } from "@/lib/server/audit-log";
import {
  buildCreatorBankAgreementText,
  CREATOR_BANK_AGREEMENT_VERSION,
} from "@/lib/legal/creator-bank-agreement";
import {
  decryptSensitiveField,
  encryptSensitiveField,
  maskBankAccountNumber,
} from "@/lib/server/secure-fields";

const payoutProfileSchema = z.object({
  accountHolderName: z.string().trim().min(2).max(80),
  bankName: z.string().trim().min(2).max(80),
  branchName: z.string().trim().min(2).max(80),
  accountNumber: z.string().trim().min(8).max(24).regex(/^[0-9]+$/),
  confirmAccountNumber: z.string().trim().min(8).max(24).regex(/^[0-9]+$/),
  ifscCode: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/),
  signatureName: z.string().trim().min(2).max(80),
  agreed: z.literal(true),
});

interface IfscLookupResponse {
  IFSC?: string;
  BANK?: string;
  BRANCH?: string;
  ADDRESS?: string;
  CITY?: string;
  DISTRICT?: string;
  STATE?: string;
}

function normalizeBankText(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\b(BANK|LIMITED|LTD|CO OPERATIVE|COOPERATIVE|PAYMENTS)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bankNameMatches(inputBankName: string, officialBankName: string) {
  const left = normalizeBankText(inputBankName);
  const right = normalizeBankText(officialBankName);
  return left === right || left.includes(right) || right.includes(left);
}

async function lookupIfsc(ifscCode: string) {
  const response = await fetch(`https://ifsc.razorpay.com/${encodeURIComponent(ifscCode)}`, {
    cache: "no-store",
    headers: {
      "user-agent": "Mozilla/5.0 ManaPosterPortal/1.0",
    },
  });
  if (!response.ok) {
    throw new Error("Entered IFSC code is invalid. Please re-enter correct IFSC.");
  }
  const data = (await response.json()) as IfscLookupResponse;
  if (!data.BANK || !data.IFSC) {
    throw new Error("Unable to verify IFSC right now. Please try again.");
  }
  return data;
}

function formatIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    ""
  );
}

export async function GET(req: NextRequest) {
  try {
    const creator = await requireCreatorAccessContext(req);
    const profileSnap = await adminDb
      .collection("creatorPayoutProfiles")
      .doc(creator.creatorPublicId)
      .get();

    if (!profileSnap.exists) {
      return NextResponse.json({
        ok: true,
        payoutProfile: null,
        agreementVersion: CREATOR_BANK_AGREEMENT_VERSION,
      });
    }

    const data = profileSnap.data() as Record<string, unknown>;
    const encryptedAccountNumber = String(data.accountNumberEncrypted ?? "");
    const accountNumber = decryptSensitiveField(encryptedAccountNumber);

    return NextResponse.json({
      ok: true,
      agreementVersion: String(data.agreementVersion ?? CREATOR_BANK_AGREEMENT_VERSION),
      payoutProfile: {
        creatorPublicId: creator.creatorPublicId,
        status: String(data.status ?? "pending_review"),
        accountHolderName: String(data.accountHolderName ?? ""),
        bankName: String(data.bankName ?? ""),
        branchName: String(data.branchName ?? ""),
        ifscCode: String(data.ifscCode ?? ""),
        accountNumberMasked:
          String(data.accountNumberMasked ?? "") || maskBankAccountNumber(accountNumber),
        submittedAt: Number(data.submittedAt ?? 0),
        reviewedAt: Number(data.reviewedAt ?? 0),
        reviewComment: String(data.reviewComment ?? ""),
        signatureName: String(data.signatureName ?? ""),
        agreementAcceptedAt: Number(data.agreementAcceptedAt ?? 0),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load payout profile.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const creator = await requireCreatorAccessContext(req);
    const payload = payoutProfileSchema.parse(await req.json());
    if (payload.accountNumber !== payload.confirmAccountNumber) {
      throw new Error("Account number mismatch.");
    }
    const ifscDetails = await lookupIfsc(payload.ifscCode);
    if (!bankNameMatches(payload.bankName, String(ifscDetails.BANK ?? ""))) {
      throw new Error(
        `Entered bank name does not match IFSC. IFSC ${payload.ifscCode} belongs to ${String(ifscDetails.BANK ?? "").trim()}. Please re-enter correct bank name.`,
      );
    }

    const now = Date.now();
    const agreementText = buildCreatorBankAgreementText();
    const profileRef = adminDb.collection("creatorPayoutProfiles").doc(creator.creatorPublicId);
    await profileRef.set(
      {
        creatorPublicId: creator.creatorPublicId,
        authUid: creator.uid,
        name: creator.name,
        email: creator.email,
        status: "pending_review",
        accountHolderName: payload.accountHolderName,
        bankName: String(ifscDetails.BANK ?? payload.bankName).trim(),
        branchName: String(ifscDetails.BRANCH ?? payload.branchName).trim() || payload.branchName,
        accountNumberEncrypted: encryptSensitiveField(payload.accountNumber),
        accountNumberMasked: maskBankAccountNumber(payload.accountNumber),
        ifscCode: payload.ifscCode,
        ifscVerified: true,
        ifscVerifiedAt: now,
        ifscAddress: String(ifscDetails.ADDRESS ?? ""),
        ifscCity: String(ifscDetails.CITY ?? ""),
        ifscDistrict: String(ifscDetails.DISTRICT ?? ""),
        ifscState: String(ifscDetails.STATE ?? ""),
        signatureName: payload.signatureName,
        agreementAccepted: true,
        agreementAcceptedAt: now,
        agreementVersion: CREATOR_BANK_AGREEMENT_VERSION,
        agreementText,
        submittedAt: now,
        updatedAt: now,
        reviewedAt: 0,
        reviewComment: "",
        reviewedByUid: "",
        reviewedByEmail: "",
        submissionIp: formatIp(req),
      },
      { merge: true },
    );

    await writeAuditLog({
      actorUid: creator.uid,
      actorRole: "creator",
      actorEmail: creator.email,
      action: "creator_payout_profile_submitted",
      targetType: "creator_payout_profile",
      targetId: creator.creatorPublicId,
      message: "Creator submitted payout profile and legal acceptance.",
      metadata: {
        agreementVersion: CREATOR_BANK_AGREEMENT_VERSION,
        bankName: String(ifscDetails.BANK ?? payload.bankName).trim(),
        ifscCode: payload.ifscCode,
        branchName: String(ifscDetails.BRANCH ?? payload.branchName).trim(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save payout profile.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
