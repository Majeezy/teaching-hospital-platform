import { Suspense } from "react";
import { getSessionUser } from "@/lib/permissions";
import {
  getAdminDashboard,
  getDoctorDashboard,
  getPatientDashboard,
  getStudentDashboard,
} from "@/actions/dashboard";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { DoctorDashboard } from "@/components/dashboard/DoctorDashboard";
import { PatientDashboard } from "@/components/dashboard/PatientDashboard";
import { StudentDashboard } from "@/components/dashboard/StudentDashboard";
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

  // Priority order for accounts that could hold more than one role: admin
  // first, then clinical staff, then patient, then student. Nurse (and
  // anyone with no dashboard-eligible role) falls through to the generic
  // summary below.
  if (user.roles.includes("HOSPITAL_ADMIN") || user.roles.includes("SYSTEM_ADMIN")) {
    const data = await getAdminDashboard();
    return <DashboardShell user={user}><AdminDashboard data={data} /></DashboardShell>;
  }

  if (user.roles.includes("DOCTOR")) {
    const data = await getDoctorDashboard();
    return <DashboardShell user={user}><DoctorDashboard data={data} /></DashboardShell>;
  }

  if (user.roles.includes("PATIENT")) {
    const data = await getPatientDashboard();
    return <DashboardShell user={user}><PatientDashboard data={data} /></DashboardShell>;
  }

  if (user.roles.includes("STUDENT")) {
    const data = await getStudentDashboard();
    return <DashboardShell user={user}><StudentDashboard data={data} /></DashboardShell>;
  }

  return (
    <DashboardShell user={user}>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Your roles</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">
          {user.roles.join(", ") || "None assigned"}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}

function DashboardShell({
  user,
  children,
}: {
  user: { name: string; email: string };
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">{user.email}</p>
      </div>
      {children}
    </div>
  );
}
