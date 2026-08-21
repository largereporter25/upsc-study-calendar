import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ascent — UPSC CSE 2027 Study Calendar',
  description:
    'A Swiss-minimal study calendar and focus timer for UPSC CSE 2027. Five blocks a day, one mountain to climb.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const themeInit = `
(function () {
  try {
    var d = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', d);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <link
          rel="icon"
          href={
            'data:image/svg+xml,' +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="%23161513"/><path d="M6 24 L14 10 L19 17 L22 13 L27 24 Z" fill="none" stroke="%23d6382f" stroke-width="2.4" stroke-linejoin="round"/></svg>'.replace(
                /%23/g,
                '#'
              )
            )
          }
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
