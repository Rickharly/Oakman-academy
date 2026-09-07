import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Oakman Academy", template: "%s · Oakman Academy" },
  applicationName: "Oakman Academy",
  // Added to an iPad home screen, the school opens full-screen like an app.
  appleWebApp: { capable: true, title: "Oakman Academy", statusBarStyle: "default" },
  description: "Our school, every day.",
};

export const viewport: Viewport = {
  themeColor: "#17304c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-surface text-ink">{children}</body>
    </html>
  );
}
