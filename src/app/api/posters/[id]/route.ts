import { NextRequest } from "next/server";
import {
  DELETE as deletePoster,
  PATCH as patchPoster,
} from "@/app/api/admin/website-posters/[posterId]/route";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return patchPoster(req, { params: Promise.resolve({ posterId: id }) });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return deletePoster(req, { params: Promise.resolve({ posterId: id }) });
}
