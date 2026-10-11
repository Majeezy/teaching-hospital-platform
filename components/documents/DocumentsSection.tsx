"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { Download, FileText, Plus, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteDocument,
  recordAppointmentDocument,
  recordMyDocument,
} from "@/actions/documents";
import {
  ALLOWED_DOCUMENT_CONTENT_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
} from "@/lib/document-constraints";
import { formatDateTime } from "@/lib/format-date";

type DocumentListItem = {
  id: string;
  fileName: string;
  type: string;
  sizeBytes: number;
  uploadedAt: Date;
  uploadedById: string;
  uploadedBy: { name: string };
};

type UploadContext =
  | { kind: "appointment"; appointmentId: string }
  | { kind: "self" };

export function DocumentsSection({
  patientId,
  context,
  canUpload,
  currentUserId,
  documents,
}: {
  patientId: string;
  context: UploadContext;
  canUpload: boolean;
  currentUserId: string;
  documents: DocumentListItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("file") as File | null;
    const type = String(formData.get("type") ?? "").trim();

    if (!file || file.size === 0) {
      toast.error("Choose a file to upload");
      return;
    }
    if (!type) {
      toast.error("Document type is required");
      return;
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      toast.error("File is larger than the 10MB limit");
      return;
    }
    if (
      !ALLOWED_DOCUMENT_CONTENT_TYPES.includes(
        file.type as (typeof ALLOWED_DOCUMENT_CONTENT_TYPES)[number],
      )
    ) {
      toast.error("Only PDF, JPG, and PNG files are allowed");
      return;
    }

    setIsUploading(true);
    try {
      const clientPayload =
        context.kind === "appointment"
          ? JSON.stringify({
              context: "appointment",
              appointmentId: context.appointmentId,
            })
          : JSON.stringify({ context: "self" });

      const blob = await upload(`documents/${patientId}/${file.name}`, file, {
        access: "private",
        handleUploadUrl: "/api/documents/upload",
        clientPayload,
      });

      const metadata = {
        fileUrl: blob.url,
        fileName: file.name,
        sizeBytes: file.size,
        type,
      };

      if (context.kind === "appointment") {
        await recordAppointmentDocument(context.appointmentId, metadata);
      } else {
        await recordMyDocument(metadata);
      }

      toast.success("Document uploaded");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  function handleDelete(documentId: string) {
    startTransition(async () => {
      try {
        await deleteDocument(documentId);
        toast.success("Document deleted");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Delete failed");
      }
    });
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FileText size={16} />
            Documents
          </CardTitle>
          {canUpload && (
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Plus size={14} />
              Upload
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents on file.</p>
          ) : (
            documents.map((document) => (
              <div
                key={document.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{document.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {document.type} — {formatSize(document.sizeBytes)} —{" "}
                    {document.uploadedBy.name} —{" "}
                    {formatDateTime(document.uploadedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={`/api/documents/${document.id}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Download ${document.fileName}`}
                    className={buttonVariants({ variant: "ghost", size: "icon" })}
                  >
                    <Download size={16} />
                  </a>
                  {document.uploadedById === currentUserId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isPending}
                      aria-label={`Delete ${document.fileName}`}
                      onClick={() => handleDelete(document.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Document type</Label>
              <Input id="type" name="type" required placeholder="e.g. Lab Result" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="file">File (PDF, JPG, or PNG, up to 10MB)</Label>
              <Input
                id="file"
                name="file"
                type="file"
                required
                accept=".pdf,.jpg,.jpeg,.png"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isUploading}>
                {isUploading ? "Uploading…" : "Upload"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
