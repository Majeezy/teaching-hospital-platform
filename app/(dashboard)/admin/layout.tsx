import { ReactNode, Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser, hasAnyRole } from "@/lib/permissions";

// Same reasoning as app/(dashboard)/layout.tsx -- this segment redirects
// based on role, so there's no static shell to validate.
export const instant = false;

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user || !hasAnyRole(user, ["HOSPITAL_ADMIN", "SYSTEM_ADMIN"])) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
