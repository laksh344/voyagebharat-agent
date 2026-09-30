import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'VoyageBHARAT — an AI travel agent for India',
  description: 'Plan any India trip in one sentence. An agent that compares flights, trains, buses and hotels, checks the weather, and adds up the cost — routed through Vercel AI Gateway.',
};
export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#FAFAFB' }, { media: '(prefers-color-scheme: dark)', color: '#0C0C0F' }],
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}><body>{children}</body></html>;
}
