import { Suspense } from "react";
import { listDepartments } from "@/actions/departments";
import { DepartmentsTable } from "@/components/admin/DepartmentsTable";

export default function DepartmentsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <DepartmentsContent />
    </Suspense>
  );
}

async function DepartmentsContent() {
  const departments = await listDepartments();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Departments</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Referenced by staff, appointments, and student placements
          throughout the system.
        </p>
      </div>
      <DepartmentsTable departments={departments} />
    </div>
  );
}
