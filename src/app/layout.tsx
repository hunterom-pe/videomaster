import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "VIDEOMASTER — Video Rental Management System", template: "%s — VIDEOMASTER" },
  description: "VideoMaster Video Rental Management System, Version 1.0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
