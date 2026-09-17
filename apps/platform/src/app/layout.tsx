import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';

import { THEME_INIT_SCRIPT } from '@nexora/ui';

import './globals.css';

/**
 * Root layout for the Platform micro frontend.
 *
 * Inter is loaded through `next/font`, which self-hosts the files at build time
 * — no render-blocking request to a third party, and no layout shift from a
 * late-arriving webfont. The CSS variable it exposes is what
 * `packages/config/tailwind/tokens.css` names as the primary font.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'Nexora Telecom',
    template: '%s · Nexora Telecom',
  },
  description:
    'Enterprise Configure-Price-Quote platform for business telecommunications and digital infrastructure. A fictional demonstration system.',
  robots: {
    // A demo carrying seeded commercial data has no business in search results.
    index: false,
    follow: false,
  },
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
