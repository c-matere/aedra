import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-neutral-50">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="mt-3 text-sm text-neutral-300">
          Your role does not have permission to view this section.
        </p>
        <div className="mt-6">
          <Link
            href="/admin"
            className="inline-flex rounded-lg border border-neutral-400/40 bg-neutral-500/20 px-4 py-2 text-sm font-semibold text-neutral-100 hover:bg-neutral-500/30"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
