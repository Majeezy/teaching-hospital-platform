"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AppointmentStatus, RoleName } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  updateAppointmentStatus,
  type listAppointmentsForUser,
} from "@/actions/appointments";

type Appointment = Awaited<ReturnType<typeof listAppointmentsForUser>>[number];

const STATUS_VARIANT: Record<
  AppointmentStatus,
  "secondary" | "default" | "destructive" | "outline"
> = {
  SCHEDULED: "outline",
  CONFIRMED: "secondary",
  IN_PROGRESS: "default",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
  NO_SHOW: "destructive",
};

type Action = {
  label: string;
  nextStatus: AppointmentStatus;
  destructive?: boolean;
};

function getAvailableActions(
  viewerRoles: RoleName[],
  status: AppointmentStatus,
): Action[] {
  const isStaff = viewerRoles.some((role) =>
    ["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "DOCTOR"].includes(role),
  );
  const isPatient = viewerRoles.includes("PATIENT");
  const actions: Action[] = [];

  if (isStaff) {
    if (status === "SCHEDULED") {
      actions.push({ label: "Confirm", nextStatus: "CONFIRMED" });
    }
    if (status === "CONFIRMED") {
      actions.push({ label: "Start", nextStatus: "IN_PROGRESS" });
      actions.push({ label: "No-show", nextStatus: "NO_SHOW" });
    }
    if (status === "IN_PROGRESS") {
      actions.push({ label: "Complete", nextStatus: "COMPLETED" });
    }
  }

  if ((isStaff || isPatient) && ["SCHEDULED", "CONFIRMED"].includes(status)) {
    actions.push({ label: "Cancel", nextStatus: "CANCELLED", destructive: true });
  }

  return actions;
}

export function AppointmentsTable({
  appointments,
  viewerRoles,
}: {
  appointments: Appointment[];
  viewerRoles: RoleName[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isPatientOnly =
    viewerRoles.includes("PATIENT") &&
    !viewerRoles.some((role) =>
      ["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "DOCTOR", "NURSE"].includes(role),
    );

  function handleTransition(appointment: Appointment, action: Action) {
    if (
      action.destructive &&
      !confirm(`${action.label} this appointment? This cannot be undone.`)
    ) {
      return;
    }

    startTransition(async () => {
      try {
        await updateAppointmentStatus(appointment.id, action.nextStatus);
        toast.success(`Appointment ${action.label.toLowerCase()}ed`);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {!isPatientOnly && <TableHead>Patient</TableHead>}
            <TableHead>Doctor</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>When</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-48" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={isPatientOnly ? 5 : 6}
                className="text-center text-sm text-zinc-500"
              >
                No appointments yet.
              </TableCell>
            </TableRow>
          )}
          {appointments.map((appointment) => {
            const actions = getAvailableActions(
              viewerRoles,
              appointment.status,
            );
            return (
              <TableRow key={appointment.id}>
                {!isPatientOnly && (
                  <TableCell className="font-medium">
                    {appointment.patient.user.name}
                  </TableCell>
                )}
                <TableCell>{appointment.doctor.user.name}</TableCell>
                <TableCell className="text-zinc-500">
                  {appointment.department.name}
                </TableCell>
                <TableCell>
                  {new Date(appointment.scheduledAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[appointment.status]}>
                    {appointment.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {actions.map((action) => (
                      <Button
                        key={action.nextStatus}
                        variant={action.destructive ? "ghost" : "outline"}
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleTransition(appointment, action)}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
