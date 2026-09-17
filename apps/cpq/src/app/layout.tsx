import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';

import { THEME_INIT_SCRIPT } from '@nexora/ui';

import './globals.css';

/**
 * Root layout for the CPQ micro frontend.
 *
 * Intentionally near-identical to Platform's: the two applications are
 * deployed independently but must be visually indistinguishable to the user.
 * The same font, the same tokens, the same toast treatment — anything that
 * differs would announce the zone boundary that the architecture works to hide.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'Quotes · Nexora Telecom',
    template: '%s · Nexora Telecom',
  },
  description: 'Configure, price and quote enterprise telecommunications services.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Applies a stored theme before first paint, so dark mode does not flash light. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--surface-overlay)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
            },
          }}
        />
      </body>
    </html>
  );
}
