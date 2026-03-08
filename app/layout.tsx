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
    default: "INSIDE JS - JavaScript Runtime Visualizer",
    template: "%s | INSIDE JS",
  },
  description:
    "Interactive JavaScript runtime visualizer for call stack, event loop, microtasks, macrotasks, memory heap, and console output with step-by-step execution.",
  applicationName: "INSIDE JS",
  creator: "Runtime Visualizer Lab",
  publisher: "Runtime Visualizer Lab",
  authors: [{ name: "Runtime Visualizer Lab", url: "https://github.com/mhmdrameez/runtimevisulizerlab" }],
  keywords: [
    "JavaScript visualizer",
    "JavaScript runtime visualizer",
    "event loop visualizer",
    "JavaScript runtime",
    "call stack",
    "microtask queue",
    "macrotask queue",
    "event loop",
    "memory heap",
    "execution context",
    "javascript debugger learning",
    "learn javascript internals",
    "how javascript works",
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "INSIDE JS - JavaScript Runtime Visualizer",
    description:
      "Understand JavaScript internals with step-by-step runtime simulation: call stack, event loop, memory, async queues, and verified console output.",
    type: "website",
    url: "/",
    locale: "en_US",
    siteName: "INSIDE JS",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "INSIDE JS - JavaScript Runtime Visualizer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "INSIDE JS - JavaScript Runtime Visualizer",
    description:
      "Interactive JavaScript runtime simulation for call stack, event loop, memory heap, and async execution.",
    images: ["/twitter-image"],
  },
  manifest: "/manifest.webmanifest",
  category: "education",
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
