import { SimulatorWorkbench } from "@/components/simulator-workbench";
import type { Metadata } from "next";
import { DEFAULT_SIMULATION_CODE } from "@/lib/engineSimulator/default-code";
import { simulateRuntime } from "@/lib/engineSimulator/simulate-runtime";

export const metadata: Metadata = {
  title: "JavaScript Runtime Visualizer",
  description:
    "Learn how JavaScript executes code line by line with call stack, event loop, memory heap, and runtime-verified console output.",
};

export const dynamic = "force-dynamic";

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
  const initial = simulateRuntime("javascript", DEFAULT_SIMULATION_CODE);
  const initialBuildMs = Math.max(0.2, initial.steps.length * 0.15 + DEFAULT_SIMULATION_CODE.length * 0.002);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SimulatorWorkbench
        initialCode={DEFAULT_SIMULATION_CODE}
        initialSteps={initial.steps}
        initialError={initial.error}
        initialBuildMs={initialBuildMs}
      />
    </>
  );
}
