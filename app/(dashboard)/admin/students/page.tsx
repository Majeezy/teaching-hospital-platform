import { Suspense } from "react";
import { listStudents } from "@/actions/students";
import { StudentsTable } from "@/components/admin/StudentsTable";

export default function StudentsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <StudentsContent />
    </Suspense>
  );
}

async function StudentsContent() {
  const students = await listStudents();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Students</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Medical student accounts. Placements and supervisors are assigned
          separately once a student account exists.
        </p>
      </div>
      <StudentsTable students={students} />
    </div>
  );
}
