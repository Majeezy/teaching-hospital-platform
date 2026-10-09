"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
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
import {
  requestAppointment,
  type listDoctorsForBookingForUser,
} from "@/actions/appointments";

type Doctor = Awaited<ReturnType<typeof listDoctorsForBookingForUser>>[number];

export function RequestAppointmentDialog({ doctors }: { doctors: Doctor[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const input = {
      doctorId: String(formData.get("doctorId") ?? ""),
      scheduledAt: String(formData.get("scheduledAt") ?? ""),
      reason: String(formData.get("reason") ?? "") || undefined,
    };

    startTransition(async () => {
      try {
        await requestAppointment(input);
        toast.success("Appointment requested");
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
        <CalendarPlus size={16} />
        Request appointment
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request an appointment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="doctorId">Doctor</Label>
            <Select name="doctorId">
              <SelectTrigger id="doctorId">
                <SelectValue placeholder="Select a doctor" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    Dr. {doctor.user.name} — {doctor.specialization} (
                    {doctor.department.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scheduledAt">Date & time</Label>
            <Input
              id="scheduledAt"
              name="scheduledAt"
              type="datetime-local"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea id="reason" name="reason" />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Requesting…" : "Request appointment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
