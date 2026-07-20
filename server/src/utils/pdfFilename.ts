export function sanitizeFilenameSegment(input: string): string {
  const cleaned = input
    .normalize("NFC")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80);
  return cleaned || "file";
}

export function buildPdfContentDisposition(baseNameNoExt: string): string {
  const safe = sanitizeFilenameSegment(baseNameNoExt);
  const utf8Name = `${safe}.pdf`;
  const isAscii = /^[\x20-\x7E]+$/.test(safe);
  const asciiFallback = isAscii ? utf8Name : "export.pdf";
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(utf8Name)}`;
}
