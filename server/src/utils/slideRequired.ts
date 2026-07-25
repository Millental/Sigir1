type BlockType = "METRIC_TILE" | "RICH_TEXT_SECTION" | "TABLE" | "FOOTER_STATS" | "CHART_IMAGE";

// Зеркалит isBlockEmpty из client/src/components/slideBlocks.tsx — оба места должны сходиться в
// том, что считается «пустым», иначе клиентский дизейбл кнопки и серверная 400-проверка разойдутся.
function isBlockValueEmpty(blockType: BlockType, value: unknown): boolean {
  const v = (value ?? {}) as Record<string, unknown>;
  if (blockType === "RICH_TEXT_SECTION" || blockType === "FOOTER_STATS") {
    return typeof v.text !== "string" || v.text.trim() === "";
  }
  if (blockType === "METRIC_TILE") {
    return typeof v.value !== "string" || v.value.trim() === "";
  }
  if (blockType === "CHART_IMAGE") {
    return !v.path;
  }
  // TABLE
  return !Array.isArray(v.rows) || v.rows.length === 0;
}

export interface MissingRequiredItem {
  kind: "field" | "block";
  id: string;
  label: string;
}

export function findMissingRequired(
  template: {
    layoutKind: string | null;
    fields: Array<{ id: string; label: string; isRequired: boolean }>;
    blocks: Array<{ id: string; label: string; isRequired: boolean; blockType: string }>;
  },
  fieldValues: Array<{ templateFieldId: string; value: string }>,
  blockValues: Array<{ templateBlockId: string; value: unknown }>
): MissingRequiredItem[] {
  const missing: MissingRequiredItem[] = [];

  if (template.layoutKind === null) {
    const byFieldId = new Map(fieldValues.map((v) => [v.templateFieldId, v.value]));
    for (const f of template.fields) {
      if (!f.isRequired) continue;
      if (!(byFieldId.get(f.id) ?? "").trim()) {
        missing.push({ kind: "field", id: f.id, label: f.label });
      }
    }
  } else {
    const byBlockId = new Map(blockValues.map((v) => [v.templateBlockId, v.value]));
    for (const b of template.blocks) {
      if (!b.isRequired) continue;
      if (isBlockValueEmpty(b.blockType as BlockType, byBlockId.get(b.id))) {
        missing.push({ kind: "block", id: b.id, label: b.label });
      }
    }
  }

  return missing;
}
