import { Inter } from 'next/font/google';

// The ONLY place the web loads the brand font (family name documented in
// packages/design-tokens/src/tokens.ts → typography.family).
// To change it: swap `Inter` for another next/font/google font, keep
// `variable: '--font-brand'` — web-theme.css maps it to Tailwind's font-sans.
export const brandFont = Inter({
  variable: '--font-brand',
  subsets: ['latin'],
  display: 'swap',
});
