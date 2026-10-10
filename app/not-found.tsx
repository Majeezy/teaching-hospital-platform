import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-brand-accent">
        404
      </p>
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        Page not found
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Either this doesn&rsquo;t exist, or you don&rsquo;t have access to
        it — we don&rsquo;t distinguish the two here, on purpose.
      </p>
      <Link href="/dashboard" className={buttonVariants({ className: "mt-2" })}>
        Back to dashboard
      </Link>
    </main>
  );
}
