import { Suspense } from "react";
import { listPatients } from "@/actions/patients";
import { PatientsTable } from "@/components/admin/PatientsTable";

export default function PatientsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <PatientsContent />
    </Suspense>
  );
}

async function PatientsContent() {
  const patients = await listPatients();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Patients</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Patients register themselves and manage their own profile details.
        </p>
      </div>
      <PatientsTable patients={patients} />
    </div>
  );
}
