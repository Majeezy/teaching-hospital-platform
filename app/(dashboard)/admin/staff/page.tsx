import { Suspense } from "react";
import { listStaff } from "@/actions/staff";
import { listDepartments } from "@/actions/departments";
import { StaffTable } from "@/components/admin/StaffTable";

export default function StaffPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <StaffContent />
    </Suspense>
  );
}

async function StaffContent() {
  const [staff, departments] = await Promise.all([
    listStaff(),
    listDepartments(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Staff</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Doctor and nurse accounts. Patients register themselves; staff
          accounts are provisioned here.
        </p>
      </div>
      <StaffTable staff={staff} departments={departments} />
    </div>
  );
}
