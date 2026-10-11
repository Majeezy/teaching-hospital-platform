import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSessionUser } from "@/lib/permissions";
import { assertDoctorOwnsAppointment } from "@/actions/clinical-records";
import {
  ALLOWED_DOCUMENT_CONTENT_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
} from "@/lib/document-constraints";
import { prisma } from "@/lib/prisma";

type ClientPayload =
  | { context: "appointment"; appointmentId: string }
  | { context: "self" };

/**
 * Generates a short-lived, narrowly-scoped client token for a direct
 * browser-to-Blob upload. This -- not the Server Action that records
 * the resulting metadata afterwards -- is the real authorization gate:
 * by the time recordAppointmentDocument/recordMyDocument runs, the file
 * is already written, so the check that actually matters is "should
 * this user be allowed to get a token for this pathname at all."
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayloadRaw) => {
        const user = await getSessionUser();
        if (!user) {
          throw new Error("You must be signed in to upload a document.");
        }

        if (!clientPayloadRaw) {
          throw new Error("Missing upload context.");
        }
        const clientPayload = JSON.parse(clientPayloadRaw) as ClientPayload;

        let patientId: string;
        if (clientPayload.context === "appointment") {
          const appointment = await assertDoctorOwnsAppointment(
            user,
            clientPayload.appointmentId,
          );
          patientId = appointment.patientId;
        } else {
          if (!user.roles.includes("PATIENT")) {
            throw new Error("Only a patient can upload to their own profile.");
          }
          const patientProfile = await prisma.patientProfile.findUniqueOrThrow({
            where: { userId: user.id },
          });
          patientId = patientProfile.id;
        }

        // Scopes the token to a pathname under this patient's own
        // folder -- even a tampered client payload can't make the
        // server mint a token for somewhere else, since the pathname
        // itself (not just the payload) is fixed at generation time.
        if (!pathname.startsWith(`documents/${patientId}/`)) {
          throw new Error("Upload path does not match the authorized patient.");
        }

        return {
          allowedContentTypes: [...ALLOWED_DOCUMENT_CONTENT_TYPES],
          maximumSizeInBytes: MAX_DOCUMENT_SIZE_BYTES,
          addRandomSuffix: true,
        };
      },
      // onUploadCompleted deliberately omitted -- it's delivered via a
      // webhook that needs a public callback URL, which never fires in
      // local dev. The client calls recordAppointmentDocument /
      // recordMyDocument directly once upload() resolves instead.
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
