"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

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
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-brand-accent">
        Error
      </p>
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        Something went wrong
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        That&rsquo;s on us, not you. Try again, and if it keeps happening,
        come back later.
      </p>
      <Button onClick={reset} className="mt-2">
        Try again
      </Button>
    </main>
  );
}
