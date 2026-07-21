import fs from "fs";
import path from "path";

// server/dist/utils и server/src/utils лежат на одинаковой глубине от server/ —
// путь резолвится одинаково и в dev (tsx из src), и в prod (node dist/index.js).
export const CHART_IMAGE_DIR = path.join(__dirname, "..", "..", "uploads", "chart-images");

export const MAX_CHART_IMAGE_BYTES = 5 * 1024 * 1024;

export const CHART_IMAGE_CONTENT_TYPES: Record<"png" | "jpg", string> = {
  png: "image/png",
  jpg: "image/jpeg",
};

const SIGNATURES: Array<{ mimeType: "image/png" | "image/jpeg"; extension: "png" | "jpg"; magic: number[] }> = [
  { mimeType: "image/png", extension: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
  { mimeType: "image/jpeg", extension: "jpg", magic: [0xff, 0xd8, 0xff] },
];

export function detectChartImageFormat(buffer: Buffer): { mimeType: string; extension: "png" | "jpg" } | null {
  for (const sig of SIGNATURES) {
    if (buffer.length >= sig.magic.length && sig.magic.every((b, i) => buffer[i] === b)) {
      return { mimeType: sig.mimeType, extension: sig.extension };
    }
  }
  return null;
}

export function ensureChartImageDir(): void {
  fs.mkdirSync(CHART_IMAGE_DIR, { recursive: true });
}
