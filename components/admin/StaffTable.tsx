"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { Department } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  createDoctor,
  createNurse,
  type CreateDoctorInput,
  type CreateNurseInput,
  type listStaffForUser,
} from "@/actions/staff";
import { deactivateUser } from "@/actions/users";
import { ResetPasswordButton } from "@/components/admin/ResetPasswordButton";

type StaffMember = Awaited<ReturnType<typeof listStaffForUser>>[number];

export function StaffTable({
  staff,
  departments,
}: {
  staff: StaffMember[];
  departments: Department[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"doctor" | "nurse" | null>(null);

  function handleCreateDoctor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const input: CreateDoctorInput = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      departmentId: String(formData.get("departmentId") ?? ""),
      specialization: String(formData.get("specialization") ?? ""),
      licenseNumber: String(formData.get("licenseNumber") ?? ""),
      canSupervise: formData.get("canSupervise") === "on",
    };

    startTransition(async () => {
      try {
        await createDoctor(input);
        toast.success("Doctor account created");
        setDialog(null);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  function handleCreateNurse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const input: CreateNurseInput = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      departmentId: String(formData.get("departmentId") ?? ""),
    };

    startTransition(async () => {
      try {
        await createNurse(input);
        toast.success("Nurse account created");
        setDialog(null);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  function handleDeactivate(member: StaffMember) {
    if (
      !confirm(
        `Deactivate ${member.name}? They will no longer be able to sign in.`,
      )
    )
      return;

    startTransition(async () => {
      try {
        await deactivateUser(member.id);
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
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setDialog("nurse")}>
          <Plus size={16} />
          Add nurse
        </Button>
        <Button onClick={() => setDialog("doctor")}>
          <Plus size={16} />
          Add doctor
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-48" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-sm text-muted-foreground"
                >
                  No staff accounts yet.
                </TableCell>
              </TableRow>
            )}
            {staff.map((member) => {
              const roleNames = member.roles.map((r) => r.role.name);
              const department =
                member.doctorProfile?.department.name ??
                member.nurseProfile?.department.name ??
                "—";
              return (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.email}
                  </TableCell>
                  <TableCell>{roleNames.join(", ")}</TableCell>
                  <TableCell>{department}</TableCell>
                  <TableCell>
                    <Badge
                      variant={member.isActive ? "secondary" : "destructive"}
                    >
                      {member.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {member.isActive && (
                      <div className="flex items-center justify-end gap-1">
                        <ResetPasswordButton
                          userId={member.id}
                          userName={member.name}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeactivate(member)}
                        >
                          Deactivate
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={dialog === "doctor"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add doctor</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateDoctor} className="flex flex-col gap-4">
            <Field label="Full name" name="name" type="text" required />
            <Field label="Email" name="email" type="email" required />
            <Field
              label="Initial password"
              name="password"
              type="password"
              required
              minLength={8}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="departmentId-doctor">Department</Label>
              <Select name="departmentId">
                <SelectTrigger id="departmentId-doctor">
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field
              label="Specialization"
              name="specialization"
              type="text"
              required
            />
            <Field
              label="License number"
              name="licenseNumber"
              type="text"
              required
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="canSupervise" className="h-4 w-4" />
              Can supervise medical students
            </label>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "nurse"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add nurse</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateNurse} className="flex flex-col gap-4">
            <Field label="Full name" name="name" type="text" required />
            <Field label="Email" name="email" type="email" required />
            <Field
              label="Initial password"
              name="password"
              type="password"
              required
              minLength={8}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="departmentId-nurse">Department</Label>
              <Select name="departmentId">
                <SelectTrigger id="departmentId-nurse">
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  required,
  minLength,
}: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        minLength={minLength}
      />
    </div>
  );
}
