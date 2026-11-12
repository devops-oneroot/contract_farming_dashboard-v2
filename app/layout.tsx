import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "OneRoot Contract Farming", template: "%s · OneRoot Contract Farming" },
  description: "Manage farmers, agronomists, package of practices and products",
};

export const viewport: Viewport = {
  themeColor: "#ff6200",
};

// Runs before first paint so the page never flashes the wrong theme or accent.
const THEME_SCRIPT = `(function(){try{var d=document.documentElement,t=localStorage.getItem("theme"),a=localStorage.getItem("accent");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";d.setAttribute("data-theme",t);if(a)d.setAttribute("data-accent",a)}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full text-zinc-900 dark:text-zinc-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
