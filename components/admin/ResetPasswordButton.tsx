"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resetPassword } from "@/actions/users";

export function ResetPasswordButton({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  function handleReset() {
    if (
      !confirm(
        `Reset ${userName}'s password? Their current password stops working immediately.`,
      )
    )
      return;

    startTransition(async () => {
      try {
        const { temporaryPassword: generated } = await resetPassword(userId);
        setTemporaryPassword(generated);
        setCopied(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  function handleCopy() {
    if (!temporaryPassword) return;
    navigator.clipboard.writeText(temporaryPassword);
    setCopied(true);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleReset}
        disabled={isPending}
      >
        <KeyRound size={14} />
        Reset password
      </Button>

      <Dialog
        open={temporaryPassword !== null}
        onOpenChange={(open) => !open && setTemporaryPassword(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New temporary password</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Shown once. Copy it now and share it with {userName} out of band
            -- it won&rsquo;t be shown again.
          </p>
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3 font-mono text-sm">
            <span className="flex-1 break-all">{temporaryPassword}</span>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setTemporaryPassword(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
