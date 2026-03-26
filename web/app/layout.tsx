import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getAppBrandTitle, isDevAppBranding } from "@/lib/app-brand";

export function generateMetadata(): Metadata {
  const title = getAppBrandTitle();
  return {
    title,
    description: "AI Agent Hub — Tim, Suzi, Rainbow",
    manifest: "/manifest.json",
    icons: {
      icon: [
        { url: "/icons/app-construction.svg", type: "image/svg+xml" },
      ],
      apple: "/icons/app-construction.svg",
      shortcut: "/icons/app-construction.svg",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: isDevAppBranding() ? "Command Central DEV" : "Command Central",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0e1621",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-screen">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').catch(() => {});
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
