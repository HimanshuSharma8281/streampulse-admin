import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StreamPulse — Streamer Studio & Command Center',
  description: 'Broadcast screen, audio, monitor real-time viewers, and moderate community chat.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090a0f] text-slate-100 min-h-screen flex flex-col antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
