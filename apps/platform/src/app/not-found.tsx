import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-2xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
        404
      </p>
      <h1 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-[var(--text-secondary)]">
        The page you were looking for does not exist, or you no longer have access to it.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 text-sm font-medium text-[var(--text-link)] hover:underline"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
