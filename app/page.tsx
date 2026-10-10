import Link from "next/link";
import { Stethoscope } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Stethoscope size={22} />
      </div>

      <p className="text-sm font-medium uppercase tracking-widest text-brand-accent">
        Portfolio project
      </p>
      <h1 className="max-w-xl font-heading text-3xl font-semibold text-foreground text-balance">
        Teaching Hospital Platform
      </h1>
      <p className="max-w-md text-muted-foreground">
        A simulated hospital management system and medical-student
        clinical-education platform, sharing one backend, one database, and
        one role-based permission model.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/login" className={buttonVariants({ size: "lg" })}>
          Sign in
        </Link>
        <Link
          href="/register"
          className={buttonVariants({ variant: "secondary", size: "lg" })}
        >
          Register as a patient
        </Link>
      </div>

      <div className="mt-4 max-w-md rounded-lg border border-border bg-muted/50 px-4 py-3 text-left text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          Evaluating this project?
        </p>
        <p className="mt-1">
          Sign in with the seeded demo admin account:{" "}
          <code className="rounded bg-foreground/[.06] px-1 py-0.5">
            admin@teachinghospital.test
          </code>{" "}
          /{" "}
          <code className="rounded bg-foreground/[.06] px-1 py-0.5">
            DemoAdmin123!
          </code>
          . All data is fictional.
        </p>
      </div>

      <p className="max-w-md text-xs text-muted-foreground">
        Full design rationale, entity-relationship diagram, and build log:{" "}
        <a
          href="https://github.com/Majeezy/teaching-hospital-platform/blob/main/docs/architecture.md"
          className="underline"
        >
          docs/architecture.md
        </a>
      </p>
    </main>
  );
}
