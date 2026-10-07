import type { Metadata, Viewport } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import './globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const serif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif', weight: ['500', '600'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Quolin · Crypto, the careful way',
  description: 'A crypto investing app for people who don’t trust crypto, sold through the banks they do trust.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = { themeColor: '#0F1922', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
