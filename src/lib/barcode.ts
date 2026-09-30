import "server-only";
import bwipjs from "bwip-js/node";
import { isBarcodeSafe } from "@/lib/membership-card";

/** Code 128 barcode as an SVG string (scales with CSS). Only plain alphanumeric text is accepted. */
export function code128Svg(text: string): string {
  if (!isBarcodeSafe(text)) throw new Error("Unsafe barcode text");
  return bwipjs.toSVG({ bcid: "code128", text, scale: 3, height: 14, includetext: false, paddingwidth: 4, paddingheight: 2 });
}
