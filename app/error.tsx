"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center dark:bg-black">
      <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
        Error
      </p>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Something went wrong
      </h1>
      <p className="max-w-sm text-sm text-zinc-500">
        That&rsquo;s on us, not you. Try again, and if it keeps happening,
        come back later.
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
      >
        Try again
      </button>
    </main>
  );
}
