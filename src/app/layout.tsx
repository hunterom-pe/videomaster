import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { SoundEngine } from "@/components/SoundEngine";
import { SOUND_COOKIE, parseSoundEnabled } from "@/lib/sound";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";

// Absolute base URL: link-preview crawlers (iMessage, Slack, ...) need full URLs for the image.
// Set SITE_URL in Netlify if you add a custom domain; Netlify's own URL variable is used otherwise.
const SITE_URL = process.env.SITE_URL ?? process.env.URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://videomaster-rms.netlify.app");
const TITLE = "VIDEOMASTER — Video Rental Management System";
const DESCRIPTION = "Run your own 1990s video rental store: rentals, returns, late fees, customers, inventory, concessions, receipts and reports — 1996 look, 2026 usability.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s — VIDEOMASTER" },
  description: DESCRIPTION,
  applicationName: "VideoMaster",
  // The image itself comes from src/app/opengraph-image.png and twitter-image.png (Next adds those tags).
  openGraph: { type: "website", siteName: "VIDEOMASTER", title: TITLE, description: DESCRIPTION, locale: "en_US" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);
  const soundOn = parseSoundEnabled(jar.get(SOUND_COOKIE)?.value);
  return (
    <html lang="en" data-theme={theme}>
      <body>
        <SoundEngine initialEnabled={soundOn} />
        {children}
      </body>
    </html>
  );
}
