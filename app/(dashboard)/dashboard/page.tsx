import { Suspense } from "react";
import { getSessionUser } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const user = await getSessionUser();
  if (!user) return null; // layout already redirects; satisfies types here

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          Phase 1, Stage 1 — role-specific dashboards land in Stage 6
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Welcome, {user.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">{user.email}</p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Your roles</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">
          {user.roles.join(", ") || "None assigned"}
        </CardContent>
      </Card>
    </div>
  );
}
