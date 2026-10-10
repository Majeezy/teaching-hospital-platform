"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  assignShadowing,
  type listShadowableStudentsForUser,
  type listShadowingForAppointmentForUser,
} from "@/actions/shadowing";

type ShadowingAssignment = Awaited<
  ReturnType<typeof listShadowingForAppointmentForUser>
>[number];
type ShadowableStudent = Awaited<
  ReturnType<typeof listShadowableStudentsForUser>
>[number];

export function ShadowingPanel({
  appointmentId,
  canAssign,
  assignments,
  shadowableStudents,
}: {
  appointmentId: string;
  canAssign: boolean;
  assignments: ShadowingAssignment[];
  shadowableStudents: ShadowableStudent[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const studentId = String(
      new FormData(event.currentTarget).get("studentId") ?? "",
    );

    startTransition(async () => {
      try {
        await assignShadowing({ appointmentId, studentId });
        toast.success("Student assigned to shadow");
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  const unassignedStudents = shadowableStudents.filter(
    (student) =>
      !assignments.some(
        (assignment) => assignment.student.id === student.id,
      ),
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Eye size={16} />
          Shadowing
        </CardTitle>
        {canAssign && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <UserPlus size={14} />
            Assign student
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No students assigned to shadow this appointment.
          </p>
        ) : (
          assignments.map((assignment) => (
            <p key={assignment.id} className="text-sm">
              {assignment.student.user.name}{" "}
              <span className="text-xs text-muted-foreground">
                (observer, read-only)
              </span>
            </p>
          ))
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign a student to shadow</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="studentId">Student</Label>
              <Select name="studentId">
                <SelectTrigger id="studentId">
                  <SelectValue
                    placeholder={
                      shadowableStudents.length === 0
                        ? "No students placed under you"
                        : "Select a student"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {unassignedStudents.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only students with an active placement under you appear here.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={isPending || unassignedStudents.length === 0}
              >
                {isPending ? "Assigning…" : "Assign"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
