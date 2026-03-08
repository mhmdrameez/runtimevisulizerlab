import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: "https://inside-js.vercel.app/sitemap.xml",
    host: "https://inside-js.vercel.app",
  };
}
