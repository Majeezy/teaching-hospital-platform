export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center dark:bg-black">
      <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
        Phase 0 — Project setup
      </p>
      <h1 className="max-w-xl text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Teaching Hospital Platform
      </h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        A simulated hospital + medical-education platform. See{" "}
        <code className="rounded bg-black/[.06] px-1.5 py-0.5 text-sm dark:bg-white/[.08]">
          docs/architecture.md
        </code>{" "}
        for the full design.
      </p>
    </main>
  );
}
