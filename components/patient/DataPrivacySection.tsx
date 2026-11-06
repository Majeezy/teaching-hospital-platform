"use client";

import { useTransition } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { exportMyData, deleteMyData } from "@/actions/patients";

export function DataPrivacySection() {
  const [isExporting, startExport] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function handleExport() {
    startExport(async () => {
      try {
        const data = await exportMyData();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  function handleDelete() {
    if (
      !confirm(
        "Delete your account? Your name, email, and contact details will be permanently removed. " +
          "Your medical records stay on file, the same way a real clinic retains them, but will no " +
          "longer be linked to any identifying information you control. This cannot be undone.",
      )
    )
      return;

    startDelete(async () => {
      try {
        await deleteMyData();
        await signOut({ callbackUrl: "/login" });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Your data
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm">Download a copy of your data</p>
            <p className="text-sm text-muted-foreground">
              Your profile, appointments, clinical records, documents, and
              messages, as a JSON file.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download size={16} />
            {isExporting ? "Preparing…" : "Download"}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4 border-t pt-4">
          <div>
            <p className="text-sm">Delete your account</p>
            <p className="text-sm text-muted-foreground">
              Removes your identifying information and signs you out.
              Medical records are retained, not erased.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 size={16} />
            {isDeleting ? "Deleting…" : "Delete account"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
