import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center dark:bg-black">
      <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
        404
      </p>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Page not found
      </h1>
      <p className="max-w-sm text-sm text-zinc-500">
        Either this doesn&rsquo;t exist, or you don&rsquo;t have access to
        it — we don&rsquo;t distinguish the two here, on purpose.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
