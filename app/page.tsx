import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white px-6 py-12 text-center dark:bg-black">
      <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
        Portfolio project
      </p>
      <h1 className="max-w-xl text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Teaching Hospital Platform
      </h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        A simulated hospital management system and medical-student
        clinical-education platform, sharing one backend, one database, and
        one role-based permission model.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/login"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 dark:border-zinc-700 dark:text-zinc-50"
        >
          Register as a patient
        </Link>
      </div>

      <div className="mt-4 max-w-md rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        <p className="font-medium text-zinc-900 dark:text-zinc-50">
          Evaluating this project?
        </p>
        <p className="mt-1">
          Sign in with the seeded demo admin account:{" "}
          <code className="rounded bg-black/[.06] px-1 py-0.5 dark:bg-white/[.08]">
            admin@teachinghospital.test
          </code>{" "}
          /{" "}
          <code className="rounded bg-black/[.06] px-1 py-0.5 dark:bg-white/[.08]">
            DemoAdmin123!
          </code>
          . All data is fictional.
        </p>
      </div>

      <p className="max-w-md text-xs text-zinc-500">
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
