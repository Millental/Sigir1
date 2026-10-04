// Generic-редактор: один проход по дереву блоков отдела (body/extra) находит
// каждый редактируемый "лист" (bullets/table/meterRow/statRow/kv/taglist/
// segments/subgroup/text/risk — НЕ raw, графики остаются ручными) и даёт ему
// стабильный fieldId по пути в дереве. Тот же обход используется и для рендера
// формы (GET), и для сборки обратно (POST) — структура/заголовки/подписи
// колонок остаются из шаблона, редактируются только сами значения.

export type Block = any;

export type WeekRecord = {
  status: string;
  role?: string;
  body: Block[];
  extra?: Block[];
  footer?: any;
};

function clone<T>(v: T): T {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

export function defaultWeekRecord(dept: any): WeekRecord {
  return {
    status: dept.status,
    role: dept.role,
    body: clone(dept.body || []),
    extra: clone(dept.extra),
    footer: clone(dept.footer),
  };
}

// -------- сериализация "одна строка — одна запись" (textarea) --------

export function linesOf(raw: string): string[] {
  return raw.split("\n").map((s) => s.trim()).filter(Boolean);
}
export function linesToText(items: string[]): string {
  return (items || []).join("\n");
}
export function tuplesOf(raw: string, arity: number): string[][] {
  return linesOf(raw).map((line) => {
    const parts = line.split("|").map((s) => s.trim());
    while (parts.length < arity) parts.push("");
    return parts.slice(0, arity);
  });
}
export function tuplesToText(items: any[][]): string {
  return (items || []).map((t) => t.join(" | ")).join("\n");
}
export function rowsOf(raw: string): string[][] {
  return linesOf(raw).map((line) => line.split("|").map((s) => s.trim()));
}

// -------- обход дерева --------

type Visit = (block: Block, fieldId: string) => void;

function walkBody(nodes: Block[] | undefined, prefix: string, visit: Visit): void {
  (nodes || []).forEach((node, i) => {
    const id = `${prefix}_${i}`;
    switch (node.t) {
      case "row2":
        walkBody(node.a, `${id}_a`, visit);
        walkBody(node.b, `${id}_b`, visit);
        break;
      case "cols3":
        (node.items || []).forEach((col: Block[], ci: number) => walkBody(col, `${id}_c${ci}`, visit));
        break;
      case "subcard":
      case "block":
        if (node.body) walkBody(node.body, `${id}_b`, visit);
        break;
      case "raw":
        break; // графики — не редактируем
      default:
        visit(node, id);
    }
  });
}

export type FieldRef = { fieldId: string; block: Block };

export function collectFields(rec: WeekRecord): FieldRef[] {
  const fields: FieldRef[] = [];
  walkBody(rec.body, "body", (block, id) => fields.push({ fieldId: id, block }));
  walkBody(rec.extra, "extra", (block, id) => fields.push({ fieldId: id, block }));
  return fields;
}

function fieldLabel(block: Block): string {
  if (block.title) return block.title;
  if (block.t === "text") return block.cls === "risk" ? "Текст" : block.cls || "Текст";
  if (block.t === "risk") return "Риски";
  return block.t;
}

// -------- рендер инпута под тип блока --------

export function renderFieldInput(fieldId: string, block: Block): string {
  const label = fieldLabel(block);
  switch (block.t) {
    case "bullets":
    case "subgroup":
      return row(label, `<textarea name="${fieldId}" rows="${rowsFor(block.items)}">${esc(linesToText(block.items))}</textarea>`, "по одному пункту в строке");
    case "taglist":
      return row(label, `<textarea name="${fieldId}" rows="${rowsFor(block.tags)}">${esc(linesToText(block.tags))}</textarea>`, "по одному в строке");
    case "kv":
      return row(label, `<textarea name="${fieldId}" rows="${rowsFor(block.items)}">${esc(tuplesToText(block.items))}</textarea>`, "формат: подпись | значение");
    case "segments":
      return row(label, `<textarea name="${fieldId}" rows="${rowsFor(block.pairs)}">${esc(tuplesToText(block.pairs))}</textarea>`, "формат: категория | текст");
    case "statRow":
      return row(label, `<textarea name="${fieldId}" rows="${rowsFor(block.stats)}">${esc(statsToText(block.stats))}</textarea>`, "формат: подпись | значение | дельта (необязательно)");
    case "meterRow":
      return row(label, `<textarea name="${fieldId}" rows="${rowsFor(block.meters)}">${esc(metersToText(block.meters))}</textarea>`, "формат: подпись | отображаемое значение | % заливки");
    case "table": {
      const rowsText = (block.rows || []).map((r: string[]) => r.join(" | ")).join("\n");
      const totalRow = block.total
        ? `<div class="edit-row"><label style="font-size:.74rem">Итоговая строка</label><input type="text" name="${fieldId}__total" value="${escAttr(block.total.join(" | "))}"></div>`
        : "";
      const cols = (block.cols || []).join(" / ");
      return row(label, `<textarea name="${fieldId}" rows="${rowsFor(block.rows)}">${esc(rowsText)}</textarea>`, `столбцы (не редактируются): ${esc(cols)} — формат строки: ячейка | ячейка | …`) + totalRow;
    }
    case "text":
    case "risk":
      return row(label, `<textarea name="${fieldId}" rows="2">${esc(block.html)}</textarea>`, "можно использовать &lt;b&gt;жирный&lt;/b&gt;");
    default:
      return "";
  }
}

function rowsFor(arr: any[]): number {
  return Math.max(2, Math.min(10, (arr || []).length + 1));
}
function statsToText(stats: any[]): string {
  return (stats || [])
    .map((s) => [s[0], s[1], s[2] && typeof s[2] === "object" ? s[2].text : ""].join(" | "))
    .join("\n");
}
function metersToText(meters: any[]): string {
  return (meters || []).map((m) => [m.label, m.val, m.pct].join(" | ")).join("\n");
}
function row(label: string, inputHtml: string, hint?: string): string {
  return `<div class="edit-row"><label>${esc(label)}</label>${inputHtml}${hint ? `<p style="font-size:.72rem;color:var(--muted);margin-top:4px">${hint}</p>` : ""}</div>`;
}
function esc(s: any): string {
  return String(s ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escAttr(s: any): string {
  return String(s ?? "").replace(/"/g, "&quot;");
}

// -------- сборка обратно из отправленной формы --------

function applyOne(block: Block, id: string, fv: Record<string, string>): void {
  const raw = fv[id] ?? "";
  switch (block.t) {
    case "bullets":
    case "subgroup":
      block.items = linesOf(raw);
      break;
    case "taglist":
      block.tags = linesOf(raw);
      break;
    case "kv":
      block.items = tuplesOf(raw, 2);
      break;
    case "segments":
      block.pairs = tuplesOf(raw, 2);
      break;
    case "statRow": {
      const lines = tuplesOf(raw, 3);
      block.stats = (block.stats || []).map((orig: any[], idx: number) => {
        const line = lines[idx];
        if (!line) return orig;
        const [label, value, deltaText] = line;
        const origDelta = orig[2];
        const color = orig[3];
        if (origDelta && typeof origDelta === "object") {
          return deltaText ? [label, value, { kind: origDelta.kind, text: deltaText }] : [label, value];
        }
        return color ? [label, value, null, color] : [label, value];
      });
      break;
    }
    case "meterRow": {
      const lines = tuplesOf(raw, 3);
      block.meters = (block.meters || []).map((orig: any, idx: number) => {
        const line = lines[idx];
        if (!line) return orig;
        return { ...orig, label: line[0], val: line[1], pct: Number(line[2]) || 0 };
      });
      break;
    }
    case "table":
      block.rows = rowsOf(raw);
      if (block.total) {
        const totalRaw = fv[id + "__total"];
        if (totalRaw !== undefined && totalRaw.trim()) block.total = totalRaw.split("|").map((s) => s.trim());
      }
      break;
    case "text":
    case "risk":
      block.html = raw;
      break;
  }
}

export function applyFields(rec: WeekRecord, formValues: Record<string, string>): { body: Block[]; extra?: Block[] } {
  const body = clone(rec.body) || [];
  const extra = rec.extra ? clone(rec.extra) : undefined;
  walkBody(body, "body", (block, id) => applyOne(block, id, formValues));
  if (extra) walkBody(extra, "extra", (block, id) => applyOne(block, id, formValues));
  return { body, extra };
}

export function renderFooterInputs(footer: any): string {
  if (!footer) return "";
  const parts: string[] = [`<p class="edit-title" style="margin-top:20px">Строка «${esc(footer.label)}» внизу раздела</p>`];
  if (footer.empty !== undefined) {
    parts.push(row("Текст (если нечего заполнять)", `<textarea name="footer_empty" rows="2">${esc(footer.empty)}</textarea>`));
  }
  if (footer.stats) {
    parts.push(row("Показатели", `<textarea name="footer_stats" rows="${rowsFor(footer.stats)}">${esc(tuplesToText(footer.stats))}</textarea>`, "формат: подпись | значение"));
  }
  if (footer.notes) {
    parts.push(row("Заметки", `<textarea name="footer_notes" rows="${rowsFor(footer.notes)}">${esc(tuplesToText(footer.notes))}</textarea>`, "формат: подпись | текст"));
  }
  return parts.join("");
}

export function applyFooter(templateFooter: any, fv: Record<string, string>): any {
  if (!templateFooter) return templateFooter;
  const footer: any = { label: templateFooter.label };
  if (templateFooter.empty !== undefined) footer.empty = fv.footer_empty ?? templateFooter.empty;
  if (templateFooter.stats) footer.stats = tuplesOf(fv.footer_stats ?? "", 2);
  if (templateFooter.notes) footer.notes = tuplesOf(fv.footer_notes ?? "", 2);
  return footer;
}
