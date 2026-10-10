"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  createStudent,
  type CreateStudentInput,
  type listStudentsForUser,
} from "@/actions/students";
import { deactivateUser } from "@/actions/users";
import { ResetPasswordButton } from "@/components/admin/ResetPasswordButton";

type Student = Awaited<ReturnType<typeof listStudentsForUser>>[number];

export function StudentsTable({ students }: { students: Student[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const input: CreateStudentInput = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      studentNumber: String(formData.get("studentNumber") ?? ""),
      university: String(formData.get("university") ?? ""),
      yearOfStudy: Number(formData.get("yearOfStudy") ?? 1),
      program: String(formData.get("program") ?? ""),
    };

    startTransition(async () => {
      try {
        await createStudent(input);
        toast.success("Student account created");
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  function handleDeactivate(student: Student) {
    if (
      !confirm(
        `Deactivate ${student.name}? They will no longer be able to sign in.`,
      )
    )
      return;

    startTransition(async () => {
      try {
        await deactivateUser(student.id);
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
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} />
          Add student
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>University</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-48" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-sm text-zinc-500"
                >
                  No students registered yet.
                </TableCell>
              </TableRow>
            )}
            {students.map((student) => (
              <TableRow key={student.id}>
                <TableCell className="font-medium">{student.name}</TableCell>
                <TableCell className="text-zinc-500">
                  {student.email}
                </TableCell>
                <TableCell>
                  {student.studentProfile?.university ?? "—"}
                </TableCell>
                <TableCell>
                  {student.studentProfile?.yearOfStudy ?? "—"}
                </TableCell>
                <TableCell>
                  {student.studentProfile?.program ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={student.isActive ? "secondary" : "destructive"}
                  >
                    {student.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {student.isActive && (
                    <div className="flex items-center justify-end gap-1">
                      <ResetPasswordButton
                        userId={student.id}
                        userName={student.name}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleDeactivate(student)}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add student</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <Field label="Full name" name="name" type="text" required />
            <Field label="Email" name="email" type="email" required />
            <Field
              label="Initial password"
              name="password"
              type="password"
              required
              minLength={8}
            />
            <Field
              label="Student number"
              name="studentNumber"
              type="text"
              required
            />
            <Field label="University" name="university" type="text" required />
            <Field
              label="Year of study"
              name="yearOfStudy"
              type="number"
              required
              min={1}
              max={10}
            />
            <Field label="Program" name="program" type="text" required />
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
  min,
  max,
}: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
  minLength?: number;
  min?: number;
  max?: number;
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
        min={min}
        max={max}
        defaultValue={type === "number" ? 1 : undefined}
      />
    </div>
  );
}
