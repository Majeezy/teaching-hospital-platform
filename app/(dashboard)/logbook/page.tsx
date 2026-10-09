import { Suspense } from "react";
import { getSessionUser } from "@/lib/permissions";
import { listLogbookEntries } from "@/actions/logbook";
import { LogbookTable } from "@/components/logbook/LogbookTable";

export default function LogbookPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <LogbookContent />
    </Suspense>
  );
}

async function LogbookContent() {
  const user = await getSessionUser();
  if (!user) return null; // layout already redirects; satisfies types here

  const isAdmin =
    user.roles.includes("HOSPITAL_ADMIN") || user.roles.includes("SYSTEM_ADMIN");
  const isDoctor = user.roles.includes("DOCTOR");

  const entries = await listLogbookEntries();
  const totalHours = entries.reduce((sum, entry) => sum + Number(entry.hours), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Clinical Logbook</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {isAdmin
            ? "Every clinical hour logged across the platform."
            : isDoctor
              ? "Hours your shadowing students logged on your appointments."
              : "Your clinical hours, logged automatically."}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Entries are created automatically when a shadowed appointment is
          marked completed -- there&rsquo;s no manual entry here.
        </p>
      </div>
      <p className="text-sm font-medium">
        Total hours: {totalHours.toFixed(1)}
      </p>
      <LogbookTable entries={entries} />
    </div>
  );
}
