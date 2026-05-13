import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/auth-provider';
import { ErrorBoundary } from '@/components/error-boundary';

export const metadata: Metadata = {
  title: 'SVGOI Appraisal System',
  description: 'Enterprise appraisal management system for SVGOI'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <AuthProvider>
            <main id="root">{children}</main>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
