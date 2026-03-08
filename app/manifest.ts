import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "INSIDE JS - JavaScript Runtime Visualizer",
    short_name: "INSIDE JS",
    description:
      "Interactive JavaScript runtime visualizer for call stack, event loop, async queues, memory heap, and console output.",
    start_url: "/",
    display: "standalone",
    background_color: "#090c13",
    theme_color: "#090c13",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
