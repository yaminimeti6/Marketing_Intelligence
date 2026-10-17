import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Northstar · Marketing Intelligence', description: 'Meta-first marketing intelligence workspace.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
