import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optional: lets a second dev server run alongside the main one (e.g. automated testing).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
