import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

export type LayoutKind = "QUADRANT" | "FINANCIAL_CHART" | "SIMPLE_COLUMN";
export type BlockType = "METRIC_TILE" | "RICH_TEXT_SECTION" | "TABLE" | "FOOTER_STATS" | "CHART_IMAGE";

interface ParsedShape {
  kind: "text" | "table" | "picture" | "chart";
  x: number;
  y: number;
  text?: string;
  columns?: string[];
  imageBase64?: string;
}

interface ParsedSlide {
  index: number;
  textSnippet: string;
  shapes: ParsedShape[];
}

export interface ProposedBlock {
  blockType: BlockType;
  label: string;
  order: number;
  config?: { columns: string[] };
  previewImageBase64?: string;
}

export interface SlideProposal {
  index: number;
  textSnippet: string;
  layoutKind: LayoutKind;
  blocks: ProposedBlock[];
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", removeNSPrefix: true });

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function runsText(txBody: any): string {
  const paragraphs = asArray(txBody?.p);
  const lines: string[] = [];
  for (const p of paragraphs) {
    const runs = asArray(p?.r);
    const line = runs
      .map((r) => (typeof r?.t === "string" ? r.t : typeof r?.t === "number" ? String(r.t) : ""))
      .join("");
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

function shapeXY(xfrm: any): { x: number; y: number } {
  const off = xfrm?.off;
  return { x: Number(off?.x ?? 0) || 0, y: Number(off?.y ?? 0) || 0 };
}

function mimeForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  return "image/png";
}

async function parseSlide(
  zip: JSZip,
  slidePath: string,
  index: number
): Promise<ParsedSlide> {
  const xml = await zip.file(slidePath)!.async("string");
  const relsPath = slidePath.replace(/^(.*\/)([^/]+)$/, "$1_rels/$2.rels");
  const relsFile = zip.file(relsPath);
  const relsXml = relsFile ? await relsFile.async("string") : null;

  const relsById = new Map<string, string>();
  if (relsXml) {
    const relsDoc = parser.parse(relsXml);
    for (const rel of asArray(relsDoc?.Relationships?.Relationship)) {
      if (rel?.Id && rel?.Target) relsById.set(rel.Id, rel.Target);
    }
  }

  const doc = parser.parse(xml);
  const spTree = doc?.sld?.cSld?.spTree;
  const shapes: ParsedShape[] = [];

  for (const sp of asArray(spTree?.sp)) {
    const text = runsText(sp?.txBody);
    if (!text.trim()) continue;
    const { x, y } = shapeXY(sp?.spPr?.xfrm);
    shapes.push({ kind: "text", x, y, text: text.trim() });
  }

  for (const pic of asArray(spTree?.pic)) {
    const { x, y } = shapeXY(pic?.spPr?.xfrm);
    const embedId: string | undefined = pic?.blipFill?.blip?.embed;
    let imageBase64: string | undefined;
    if (embedId && relsById.has(embedId)) {
      const target = relsById.get(embedId)!;
      const mediaPath = new URL(target, `zip:///${slidePath}`).pathname.replace(/^\//, "");
      const mediaFile = zip.file(mediaPath);
      if (mediaFile) {
        const base64 = await mediaFile.async("base64");
        imageBase64 = `data:${mimeForPath(mediaPath)};base64,${base64}`;
      }
    }
    shapes.push({ kind: "picture", x, y, imageBase64 });
  }

  for (const gf of asArray(spTree?.graphicFrame)) {
    const { x, y } = shapeXY(gf?.xfrm);
    const graphicData = gf?.graphic?.graphicData;
    const uri: string = graphicData?.uri ?? "";

    if (uri.endsWith("/table")) {
      const rows = asArray(graphicData?.tbl?.tr);
      const firstRow = rows[0];
      const columns = asArray(firstRow?.tc).map((tc: any) => runsText(tc?.txBody).trim() || "Колонка");
      if (columns.length > 0) {
        shapes.push({ kind: "table", x, y, columns });
      }
    } else if (uri.endsWith("/chart")) {
      shapes.push({ kind: "chart", x, y });
    }
  }

  const textSnippet = shapes
    .filter((s) => s.kind === "text")
    .map((s) => s.text)
    .join(" — ")
    .slice(0, 120);

  return { index, textSnippet, shapes };
}

/**
 * Разбирает .pptx (zip) в память, без записи на диск.
 * Порядок слайдов определяется по числовому суффиксу имени файла (slideN.xml), не по
 * presentation.xml/sldIdLst — упрощение, приемлемое для эвристики-подсказки (не финального
 * результата): в подавляющем большинстве реальных файлов порядок совпадает.
 */
export async function parsePptx(buffer: Buffer): Promise<ParsedSlide[]> {
  const zip = await JSZip.loadAsync(buffer);
  const slideEntries = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .map((name) => ({ name, num: Number(name.match(/slide(\d+)\.xml$/)![1]) }))
    .sort((a, b) => a.num - b.num);

  const slides: ParsedSlide[] = [];
  for (let i = 0; i < slideEntries.length; i++) {
    slides.push(await parseSlide(zip, slideEntries[i].name, i));
  }
  return slides;
}

function isLikelyMetric(text: string): boolean {
  return text.length <= 20;
}

export function proposeTemplate(slide: ParsedSlide): { layoutKind: LayoutKind; blocks: ProposedBlock[] } {
  const ordered = [...slide.shapes].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const blocks: ProposedBlock[] = [];
  let hasFinancial = false;
  let textBlockCount = 0;

  ordered.forEach((shape, i) => {
    if (shape.kind === "picture") {
      blocks.push({ blockType: "CHART_IMAGE", label: "Изображение", order: i, previewImageBase64: shape.imageBase64 });
    } else if (shape.kind === "chart") {
      blocks.push({ blockType: "CHART_IMAGE", label: "График", order: i });
      hasFinancial = true;
    } else if (shape.kind === "table") {
      blocks.push({ blockType: "TABLE", label: "Таблица", order: i, config: { columns: shape.columns! } });
      hasFinancial = true;
    } else if (shape.kind === "text") {
      const text = shape.text!;
      if (isLikelyMetric(text)) {
        blocks.push({ blockType: "METRIC_TILE", label: text.slice(0, 30), order: i });
      } else {
        blocks.push({ blockType: "RICH_TEXT_SECTION", label: text.split("\n")[0].slice(0, 40) || "Текстовый блок", order: i });
      }
      textBlockCount++;
    }
  });

  const layoutKind: LayoutKind = hasFinancial ? "FINANCIAL_CHART" : textBlockCount >= 3 ? "QUADRANT" : "SIMPLE_COLUMN";

  return { layoutKind, blocks };
}

export async function parseAndPropose(buffer: Buffer): Promise<SlideProposal[]> {
  const slides = await parsePptx(buffer);
  return slides.map((slide) => ({
    index: slide.index,
    textSnippet: slide.textSnippet,
    ...proposeTemplate(slide),
  }));
}
