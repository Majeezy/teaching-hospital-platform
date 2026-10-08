"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
    >
      Sign out
    </button>
  );
}
