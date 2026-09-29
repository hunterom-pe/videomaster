import type { MediaFormat } from "@/generated/prisma/client";

// Pure helpers (no database access) shared by inventory queries and the sample-data generator.
export const FORMAT_CODES: Record<MediaFormat, string> = {
  VHS: "VHS", DVD: "DVD", BLURAY: "BD", LASERDISC: "LD", VIDEO_GAME: "GAME", OTHER: "OTH",
};
export const FORMAT_LABELS: Record<MediaFormat, string> = {
  VHS: "VHS", DVD: "DVD", BLURAY: "BLU-RAY", LASERDISC: "LASERDISC", VIDEO_GAME: "VIDEO GAME", OTHER: "OTHER",
};
export const buildSearchText = (director: string, genres: string[], cast: string[]) =>
  [director, ...genres, ...cast].join(" ").toLowerCase();
