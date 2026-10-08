import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-2xl px-6 py-16">
          <p className="text-sm text-zinc-500">Loading…</p>
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.isActive) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs uppercase tracking-widest text-zinc-500">
        Temporary — real role-specific dashboards land in Phase 1
      </p>
      <h1 className="mt-2 text-2xl font-semibold">
        Welcome, {session.user.name}
      </h1>
      <p className="mt-2 text-sm text-zinc-500">{session.user.email}</p>
      <p className="mt-4 text-sm">
        Roles: {session.user.roles.join(", ") || "none"}
      </p>
      <div className="mt-8">
        <SignOutButton />
      </div>
    </main>
  );
}
