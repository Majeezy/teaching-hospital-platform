"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  createDepartment,
  deleteDepartment,
  updateDepartment,
} from "@/actions/departments";

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; department: Department }
  | null;

export function DepartmentsTable({
  departments,
}: {
  departments: Department[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogState, setDialogState] = useState<DialogState>(null);

  function closeDialog() {
    setDialogState(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const input = {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || undefined,
    };

    startTransition(async () => {
      try {
        if (dialogState?.mode === "edit") {
          await updateDepartment(dialogState.department.id, input);
          toast.success("Department updated");
        } else {
          await createDepartment(input);
          toast.success("Department created");
        }
        closeDialog();
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  function handleDelete(department: Department) {
    if (!confirm(`Delete ${department.name}? This cannot be undone.`)) return;

    startTransition(async () => {
      try {
        await deleteDepartment(department.id);
        toast.success("Department deleted");
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
        <Button onClick={() => setDialogState({ mode: "create" })}>
          <Plus size={16} />
          Add department
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center text-sm text-zinc-500"
                >
                  No departments yet.
                </TableCell>
              </TableRow>
            )}
            {departments.map((department) => (
              <TableRow key={department.id}>
                <TableCell className="font-medium">
                  {department.name}
                </TableCell>
                <TableCell className="text-zinc-500">
                  {department.description || "—"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${department.name}`}
                      onClick={() =>
                        setDialogState({ mode: "edit", department })
                      }
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${department.name}`}
                      onClick={() => handleDelete(department)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={dialogState !== null}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogState?.mode === "edit"
                ? "Edit department"
                : "Add department"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={
                  dialogState?.mode === "edit"
                    ? dialogState.department.name
                    : ""
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={
                  dialogState?.mode === "edit"
                    ? (dialogState.department.description ?? "")
                    : ""
                }
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
