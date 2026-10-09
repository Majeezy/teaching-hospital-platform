import { Suspense } from "react";
import { getSessionUser } from "@/lib/permissions";
import {
  listPlacements,
  listStudentsForPlacement,
  listSupervisors,
} from "@/actions/placements";
import { listDepartments } from "@/actions/departments";
import { PlacementsTable } from "@/components/placements/PlacementsTable";
import { CreatePlacementDialog } from "@/components/placements/CreatePlacementDialog";

export default function PlacementsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <PlacementsContent />
    </Suspense>
  );
}

async function PlacementsContent() {
  const user = await getSessionUser();
  if (!user) return null; // layout already redirects; satisfies types here

  const isAdmin =
    user.roles.includes("HOSPITAL_ADMIN") ||
    user.roles.includes("SYSTEM_ADMIN");

  const [placements, students, supervisors, departments] = await Promise.all([
    listPlacements(),
    isAdmin ? listStudentsForPlacement() : Promise.resolve([]),
    isAdmin ? listSupervisors() : Promise.resolve([]),
    isAdmin ? listDepartments() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Clinical Placements</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isAdmin
              ? "All student placements."
              : "Placements you're involved in."}
          </p>
        </div>
        {isAdmin && (
          <CreatePlacementDialog
            students={students}
            supervisors={supervisors}
            departments={departments}
          />
        )}
      </div>
      <PlacementsTable placements={placements} />
    </div>
  );
}
