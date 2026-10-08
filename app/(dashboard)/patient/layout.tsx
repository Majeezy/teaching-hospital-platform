import { ReactNode, Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser, hasRole } from "@/lib/permissions";

// Same reasoning as app/(dashboard)/admin/layout.tsx -- this segment
// redirects based on role, so there's no static shell to validate.
export const instant = false;

export default function PatientLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <PatientGate>{children}</PatientGate>
    </Suspense>
  );
}

async function PatientGate({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user || !hasRole(user, "PATIENT")) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
