import type { MetadataRoute } from "next";

/**
 * Web app manifest, so adding the school to an iPad home screen gives a real app icon and
 * name, and opens without browser chrome — the children should tap a crest, not a bookmark.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Oakman Academy",
    short_name: "Oakman",
    description: "Our school, every day.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf9",
    theme_color: "#17304c",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
