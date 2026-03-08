import { SimulatorWorkbench } from "@/components/simulator-workbench";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JavaScript Runtime Visualizer",
  description:
    "Learn how JavaScript executes code line by line with call stack, event loop, memory heap, and runtime-verified console output.",
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "INSIDE JS",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Any",
  description:
    "Interactive JavaScript runtime visualizer that explains call stack, event loop, queues, memory, and console output.",
  url: "https://inside-js.vercel.app/",
  codeRepository: "https://github.com/mhmdrameez/runtimevisulizerlab",
  sameAs: ["https://github.com/mhmdrameez/runtimevisulizerlab"],
  inLanguage: "en",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  publisher: {
    "@type": "Organization",
    name: "INSIDE JS",
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SimulatorWorkbench />
    </>
  );
}
