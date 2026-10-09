import { Suspense } from "react";
import { getSessionUser } from "@/lib/permissions";
import { listActivities, listSupervisedStudents } from "@/actions/learning-activities";
import { ActivitiesTable } from "@/components/activities/ActivitiesTable";
import { AssignActivityDialog } from "@/components/activities/AssignActivityDialog";

export default function ActivitiesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <ActivitiesContent />
    </Suspense>
  );
}

async function ActivitiesContent() {
  const user = await getSessionUser();
  if (!user) return null; // layout already redirects; satisfies types here

  const isDoctor = user.roles.includes("DOCTOR");
  const isAdmin =
    user.roles.includes("HOSPITAL_ADMIN") || user.roles.includes("SYSTEM_ADMIN");

  const [activities, supervisedStudents] = await Promise.all([
    listActivities(),
    isDoctor ? listSupervisedStudents() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Learning Activities</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isAdmin
              ? "All assigned learning activities."
              : isDoctor
                ? "Activities you've assigned to your students."
                : "Activities assigned to you."}
          </p>
        </div>
        {isDoctor && <AssignActivityDialog students={supervisedStudents} />}
      </div>
      <ActivitiesTable activities={activities} />
    </div>
  );
}
