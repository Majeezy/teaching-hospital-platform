import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/permissions";
import { canAccessDocument } from "@/actions/documents";

/**
 * Streams a private document's content to an authenticated, authorized
 * caller. `fileUrl` is never directly fetchable from the browser -- the
 * store is private, so every read has to go through here, which is what
 * makes per-document authorization enforceable at all (unlike a public
 * blob URL, which anyone with the link could hit).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  // A document that doesn't exist and one that exists-but-is-forbidden
  // both 404 -- same reasoning as appointment access elsewhere in this
  // app: don't let the response shape confirm a record's existence to
  // someone who can't see it.
  if (!document || !(await canAccessDocument(user, document))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const blob = await get(document.fileUrl, {
    access: "private",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  if (!blob || blob.statusCode !== 200) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(blob.stream, {
    headers: {
      "Content-Type": blob.blob.contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(document.fileName)}"`,
    },
  });
}
