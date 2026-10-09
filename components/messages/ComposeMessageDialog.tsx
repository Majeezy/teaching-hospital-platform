"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PenSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sendMessage, type EligibleRecipient } from "@/actions/messages";

export function ComposeMessageDialog({
  recipients,
}: {
  recipients: EligibleRecipient[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        await sendMessage({
          recipientId: String(formData.get("recipientId") ?? ""),
          subject: String(formData.get("subject") ?? "") || undefined,
          body: String(formData.get("body") ?? ""),
        });
        toast.success("Message sent");
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <PenSquare size={16} />
        Compose
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recipientId">To</Label>
            <Select name="recipientId">
              <SelectTrigger id="recipientId">
                <SelectValue
                  placeholder={
                    recipients.length === 0
                      ? "No eligible recipients yet"
                      : "Select a recipient"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {recipients.map((recipient) => (
                  <SelectItem key={recipient.userId} value={recipient.userId}>
                    {recipient.name} ({recipient.roles.join(", ")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="subject">Subject (optional)</Label>
            <Input id="subject" name="subject" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="body">Message</Label>
            <Textarea id="body" name="body" required rows={5} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending || recipients.length === 0}>
              {isPending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
