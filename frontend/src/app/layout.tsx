import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import { PostHogProvider } from '@/components/PostHogProvider';
import './globals.css';

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'SafeGuard — Decentralized Asset Inheritance',
  description:
    'Protect your digital legacy. SafeGuard uses biometric Passkeys and Stellar smart contracts to automatically transfer assets to your chosen beneficiary.',
  keywords: ['inheritance', 'stellar', 'soroban', 'passkey', 'webauthn', 'defi', 'estate'],
  openGraph: {
    title: 'SafeGuard — Decentralized Asset Inheritance',
    description: 'Your digital legacy, protected by biometrics and blockchain.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${outfit.variable} font-outfit antialiased bg-[#080B14] text-white`}>
        <PostHogProvider>
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
