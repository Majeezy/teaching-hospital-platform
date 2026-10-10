import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Serif, IBM_Plex_Mono } from "next/font/google";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// next/font self-hosts these at build time -- no runtime request to Google's
// CDN, so this works cleanly with next.config.ts's existing font-src 'self'
// CSP directive with zero changes needed there.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexSerif = IBM_Plex_Serif({
  variable: "--font-plex-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Teaching Hospital Platform",
  description:
    "A simulated hospital management system and medical-student clinical-education platform — portfolio project, fictional data only, not for real medical use.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // next-themes sets the .dark class and a style attribute on this
      // element before first paint via an inline script it injects --
      // suppressHydrationWarning tells React that's expected, not a bug,
      // since the server-rendered markup can never know the client's
      // actual theme preference ahead of time.
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexSerif.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
