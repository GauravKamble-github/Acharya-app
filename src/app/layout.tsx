import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import "./globals.css";
import PhoneGate from "@/components/PhoneGate";
import { getAcharyaContextBySlug } from "@/lib/server/acharya-context";
import { SUPPORTED_ACHARYAS, type AcharyaSlug } from "@/lib/server/supabase";

async function activeSlug(): Promise<AcharyaSlug> {
  const h = await headers();
  const slug = h.get("x-acharya-slug");
  return (SUPPORTED_ACHARYAS as readonly string[]).includes(slug || "")
    ? (slug as AcharyaSlug)
    : "farmer";
}

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getAcharyaContextBySlug(await activeSlug());
  return {
    title: "Acharya app",
    description: ctx.brand.description,
    manifest: "/manifest.json",
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2F5D36",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="bn"
      data-scroll-behavior="smooth"
      data-theme="light"
      className="h-full"
      suppressHydrationWarning
    >
      <head>
        <Script id="strip-extension-hydration-attrs" strategy="beforeInteractive">
          {`
            (function () {
              var attrs = ["cz-shortcut-listen"];
              function clean() {
                var targets = [document.documentElement, document.body].filter(Boolean);
                for (var i = 0; i < targets.length; i++) {
                  for (var j = 0; j < attrs.length; j++) {
                    targets[i].removeAttribute(attrs[j]);
                  }
                }
              }
              clean();
              function observe() {
                clean();
                if (!document.body || !window.MutationObserver) return;
                var observer = new MutationObserver(clean);
                observer.observe(document.body, { attributes: true, attributeFilter: attrs });
                setTimeout(function () { observer.disconnect(); }, 5000);
              }
              if (document.body) observe();
              else document.addEventListener("DOMContentLoaded", observe, { once: true });
            })();
          `}
        </Script>
      </head>
      <body className="h-full bg-paper text-ink font-sans" suppressHydrationWarning>
        <PhoneGate>{children}</PhoneGate>
      </body>
    </html>
  );
}
