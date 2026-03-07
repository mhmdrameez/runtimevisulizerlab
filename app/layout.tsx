import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const ibmSans = IBM_Plex_Sans({
  variable: "--font-ibm-sans",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const ibmMono = IBM_Plex_Mono({
  variable: "--font-ibm-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://inside-js.vercel.app"),
  title: {
    default: "INSIDE JS",
    template: "%s | INSIDE JS",
  },
  description: "A simple lab to understand JavaScript runtime with step-by-step execution visualization.",
  applicationName: "INSIDE JS",
  keywords: [
    "JavaScript runtime",
    "call stack",
    "event loop",
    "memory heap",
    "JavaScript visualizer",
  ],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "INSIDE JS",
    description: "A simple lab to understand JavaScript runtime with step-by-step execution visualization.",
    type: "website",
    locale: "en_US",
    siteName: "INSIDE JS",
  },
  twitter: {
    card: "summary_large_image",
    title: "INSIDE JS",
    description: "A simple lab to understand JavaScript runtime with step-by-step execution visualization.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${ibmSans.variable} ${ibmMono.variable} antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
