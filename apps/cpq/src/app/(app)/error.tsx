'use client';

import { useEffect } from 'react';
import { ErrorState } from '@nexora/ui';

/**
 * The route error boundary.
 *
 * `error.digest` is the identifier Next attaches to a server error; the real
 * message and stack stay on the server. Showing the digest gives support a
 * thread to pull without leaking internals to the browser (§31).
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced in the browser console for local debugging only; the server has
    // already logged the real error with full context.
    console.error('Route error', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="py-10">
      <ErrorState
        title="This page could not be loaded"
        description="Something went wrong on our side. Your work has not been lost — try again, and if it keeps happening quote the reference below."
        reference={error.digest}
        onRetry={reset}
      />
    </div>
  );
}
