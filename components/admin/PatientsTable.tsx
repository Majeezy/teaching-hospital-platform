"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deactivateUser } from "@/actions/users";
import { ResetPasswordButton } from "@/components/admin/ResetPasswordButton";
import type { listPatientsForUser } from "@/actions/patients";

type Patient = Awaited<ReturnType<typeof listPatientsForUser>>[number];

function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())
  ) {
    age--;
  }
  return age;
}

export function PatientsTable({ patients }: { patients: Patient[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDeactivate(patient: Patient) {
    if (
      !confirm(
        `Deactivate ${patient.name}? They will no longer be able to sign in.`,
      )
    )
      return;

    startTransition(async () => {
      try {
        await deactivateUser(patient.id);
        toast.success("Account deactivated");
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
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Age</TableHead>
            <TableHead>Blood type</TableHead>
            <TableHead>Allergies</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-48" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-sm text-muted-foreground"
              >
                No patients registered yet.
              </TableCell>
            </TableRow>
          )}
          {patients.map((patient) => (
            <TableRow key={patient.id}>
              <TableCell className="font-medium">{patient.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {patient.email}
              </TableCell>
              <TableCell>
                {patient.patientProfile
                  ? calculateAge(patient.patientProfile.dateOfBirth)
                  : "—"}
              </TableCell>
              <TableCell>
                {patient.patientProfile?.bloodType || "—"}
              </TableCell>
              <TableCell>
                {patient.patientProfile?.allergies.length
                  ? patient.patientProfile.allergies.join(", ")
                  : "None recorded"}
              </TableCell>
              <TableCell>
                <Badge variant={patient.isActive ? "secondary" : "destructive"}>
                  {patient.isActive ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                {patient.isActive && (
                  <div className="flex items-center justify-end gap-1">
                    <ResetPasswordButton
                      userId={patient.id}
                      userName={patient.name}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleDeactivate(patient)}
                    >
                      Deactivate
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
