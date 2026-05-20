import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
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
    title: ctx.brand.name,
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
      <body className="h-full bg-paper text-ink font-sans" suppressHydrationWarning>
        <PhoneGate>{children}</PhoneGate>
      </body>
    </html>
  );
}
