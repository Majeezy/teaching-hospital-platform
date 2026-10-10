"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
  assignActivity,
  listShadowedAppointments,
  type listShadowedAppointmentsForUser,
  type listSupervisedStudentsForUser,
} from "@/actions/learning-activities";
import { formatDateTime } from "@/lib/format-date";

type Student = Awaited<ReturnType<typeof listSupervisedStudentsForUser>>[number];
type ShadowedAppointment = Awaited<
  ReturnType<typeof listShadowedAppointmentsForUser>
>[number];

export function AssignActivityDialog({ students }: { students: Student[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [studentId, setStudentId] = useState("");
  const [shadowedAppointments, setShadowedAppointments] = useState<
    ShadowedAppointment[]
  >([]);

  function handleStudentChange(value: string | null) {
    setStudentId(value ?? "");
    setShadowedAppointments([]);
    if (!value) return;
    startTransition(async () => {
      try {
        const appointments = await listShadowedAppointments(value);
        setShadowedAppointments(appointments);
      } catch {
        setShadowedAppointments([]);
      }
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const relatedAppointmentId = String(
      formData.get("relatedAppointmentId") ?? "",
    );
    const dueDate = String(formData.get("dueDate") ?? "");

    startTransition(async () => {
      try {
        await assignActivity({
          studentId,
          title: String(formData.get("title") ?? ""),
          description: String(formData.get("description") ?? ""),
          relatedAppointmentId: relatedAppointmentId || undefined,
          dueDate: dueDate || undefined,
        });
        toast.success("Activity assigned");
        setOpen(false);
        setStudentId("");
        setShadowedAppointments([]);
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
        <Plus size={16} />
        Assign activity
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign a learning activity</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="studentId">Student</Label>
            <Select
              value={studentId}
              onValueChange={handleStudentChange}
              name="studentId"
            >
              <SelectTrigger id="studentId">
                <SelectValue
                  placeholder={
                    students.length === 0
                      ? "No students placed under you"
                      : "Select a student"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" required rows={4} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="relatedAppointmentId">
              Related shadowed appointment (optional)
            </Label>
            <Select name="relatedAppointmentId">
              <SelectTrigger id="relatedAppointmentId">
                <SelectValue
                  placeholder={
                    !studentId
                      ? "Select a student first"
                      : shadowedAppointments.length === 0
                        ? "No shadowed appointments for this student"
                        : "Not tied to an appointment"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {shadowedAppointments.map((appointment) => (
                  <SelectItem key={appointment.id} value={appointment.id}>
                    {formatDateTime(appointment.scheduledAt)}
                    {appointment.reason ? ` — ${appointment.reason}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only appointments this student shadowed under you appear here.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dueDate">Due date (optional)</Label>
            <Input id="dueDate" name="dueDate" type="date" />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending || !studentId}>
              {isPending ? "Assigning…" : "Assign activity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
