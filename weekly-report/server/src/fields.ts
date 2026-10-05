// Generic-редактор: строит дерево блоков отдела (body/extra), даёт каждому узлу
// стабильный id по пути в дереве, рендерит форму со значениями + drag-and-drop
// переупорядочиванием и удалением, и собирает отправленную форму обратно в дерево.
//
// Управляемые (draggable + с кнопкой "Удалить") узлы — это:
//  - любое редактируемое поле-лист (bullets/table/kv/statRow/...), НЕ raw (графики)
//  - целый раздел block/subcard (например "Метрики, достижения, показатели") —
//    удаление/перемещение раздела тащит с собой всё его содержимое
// Чисто вёрсточные обёртки (row2/cols3) сами не перетаскиваются — переставляются
// только элементы ВНУТРИ каждой их колонки. raw-блоки (графики) не редактируются
// и не перетаскиваются, но остаются на своём месте в структуре.

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

// -------- дерево узлов формы --------

type LeafNode = { kind: "leaf"; id: string; block: Block };
type SkipNode = { kind: "skip"; id: string; block: Block };
type ContainerNode = {
  kind: "container";
  id: string;
  type: "row2" | "cols3" | "block" | "subcard";
  block: Block;
  containers: Record<string, TreeNode[]>; // "a"/"b" | "c0".. | "body"
};
type TreeNode = LeafNode | SkipNode | ContainerNode;

function buildTree(nodes: Block[] | undefined, containerId: string): TreeNode[] {
  return (nodes || []).map((node, i) => {
    const id = `${containerId}_${i}`;
    switch (node.t) {
      case "row2":
        return {
          kind: "container", id, type: "row2", block: node,
          containers: { a: buildTree(node.a, `${id}_a`), b: buildTree(node.b, `${id}_b`) },
        } as ContainerNode;
      case "cols3": {
        const containers: Record<string, TreeNode[]> = {};
        (node.items || []).forEach((col: Block[], ci: number) => {
          containers[`c${ci}`] = buildTree(col, `${id}_c${ci}`);
        });
        return { kind: "container", id, type: "cols3", block: node, containers } as ContainerNode;
      }
      case "block":
      case "subcard":
        return {
          kind: "container", id, type: node.t, block: node,
          containers: { body: buildTree(node.body, `${id}_body`) },
        } as ContainerNode;
      case "raw":
        return { kind: "skip", id, block: node } as SkipNode;
      default:
        return { kind: "leaf", id, block: node } as LeafNode;
    }
  });
}

// -------- человеко-читаемые подписи --------

function fieldLabel(block: Block): string {
  if (block.label) return block.label;
  if (block.title) return block.title;
  switch (block.t) {
    case "bullets": return "Список пунктов";
    case "subgroup": return "Список пунктов";
    case "taglist": return "Список (по одному в строке)";
    case "kv": return "Показатели (подпись — значение)";
    case "segments": return "Категории";
    case "statRow": return "Ключевые показатели";
    case "meterRow": return "Прогресс / заполненность";
    case "table": return "Таблица";
    case "text":
      if (block.cls === "risk") return "Текст";
      if (block.cls === "tbl-caption") return "Подзаголовок блока";
      if (block.cls === "hero-chip") return "Акцент-плашка";
      if (typeof block.cls === "string" && block.cls.indexOf("status-tag") === 0) return "Статус (метка)";
      if (block.cls === "block-title") return "Заголовок";
      return "Текст";
    case "risk": return "Риски / просьбы";
    default: return block.t;
  }
}

function sectionLabel(block: Block, type: string): string {
  return block.title || (type === "subcard" ? "Раздел" : "Блок");
}

// -------- рендер инпута под тип блока (значения листа) --------

function renderFieldInput(fieldId: string, block: Block): string {
  const label = fieldLabel(block);
  switch (block.t) {
    case "bullets":
    case "subgroup":
      return row(label, `<textarea name="${fieldId}" rows="${rowsFor(block.items)}">${esc(linesToText(block.items))}</textarea>`, "по одному пункту в строке");
    case "taglist":
      return row(label, `<textarea name="${fieldId}" rows="${rowsFor(block.tags)}">${esc(linesToText(block.tags))}</textarea>`, "по одному в строке");
    case "kv":
      return row(label, `<textarea name="${fieldId}" rows="${rowsFor(block.items)}">${esc(tuplesToText(block.items))}</textarea>`, "формат: подпись | значение — например: Отгружено | 5 паллет · 56 мешков");
    case "segments":
      return row(label, `<textarea name="${fieldId}" rows="${rowsFor(block.pairs)}">${esc(tuplesToText(block.pairs))}</textarea>`, "формат: категория | текст");
    case "statRow":
      return row(label, `<textarea name="${fieldId}" rows="${rowsFor(block.stats)}">${esc(statsToText(block.stats))}</textarea>`, "формат: подпись | значение | дельта (необязательно) — например: ПДЗ | 7% | ▼ было 35%");
    case "meterRow":
      return row(label, `<textarea name="${fieldId}" rows="${rowsFor(block.meters)}">${esc(metersToText(block.meters))}</textarea>`, "формат: подпись | отображаемое значение | % заливки — например: Исполнение плана | 86% | 86");
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
  return `<div class="edit-row"><label>${esc(label)}</label>${inputHtml}${hint ? `<p class="edit-hint">${hint}</p>` : ""}</div>`;
}
function esc(s: any): string {
  return String(s ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escAttr(s: any): string {
  return String(s ?? "").replace(/"/g, "&quot;");
}

// -------- рендер дерева: сортируемые списки с drag-handle + удалением --------

function renderNode(node: TreeNode): string {
  if (node.kind === "skip") {
    return `<div class="sortable-item static" data-id="${node.id}"><p class="static-note">график/иллюстрация — редактируется в коде, не через эту форму</p></div>`;
  }
  if (node.kind === "leaf") {
    return `<div class="sortable-item" data-id="${node.id}" draggable="true">
  <div class="drag-row">
    <span class="drag-handle" aria-hidden="true">⠿⠿</span>
    <div class="drag-body">${renderFieldInput(node.id, node.block)}</div>
    <button type="button" class="remove-btn" data-id="${node.id}" title="Удалить это поле">✕</button>
  </div>
</div>`;
  }
  const c = node;
  if (c.type === "row2") {
    return `<div class="sortable-item static row2-wrap" data-id="${c.id}">
  <div class="row2-col">${renderContainer(c.containers.a, `${c.id}_a`)}</div>
  <div class="row2-col">${renderContainer(c.containers.b, `${c.id}_b`)}</div>
</div>`;
  }
  if (c.type === "cols3") {
    const keys = Object.keys(c.containers).sort();
    return `<div class="sortable-item static cols3-wrap" data-id="${c.id}">
  ${keys.map((k) => `<div class="cols3-col">${renderContainer(c.containers[k], `${c.id}_${k}`)}</div>`).join("")}
</div>`;
  }
  // block / subcard — целый раздел, тоже перетаскиваемый и удаляемый
  return `<div class="sortable-item section" data-id="${c.id}" draggable="true">
  <div class="drag-row section-row">
    <span class="drag-handle" aria-hidden="true">⠿⠿</span>
    <div class="section-title">Раздел: ${esc(sectionLabel(c.block, c.type))}</div>
    <button type="button" class="remove-btn" data-id="${c.id}" title="Удалить весь раздел">✕ раздел</button>
  </div>
  <div class="section-body">${renderContainer(c.containers.body, `${c.id}_body`)}</div>
</div>`;
}

function renderContainer(nodes: TreeNode[], containerId: string): string {
  return `<div class="sortable-list" data-container="${containerId}">
${nodes.map(renderNode).join("")}
<input type="hidden" class="order-input" name="order_${containerId}" value="${nodes.map((n) => n.id).join(",")}">
</div>`;
}

export function renderBodyEditor(rec: WeekRecord): string {
  const bodyTree = buildTree(rec.body, "body");
  const extraTree = rec.extra ? buildTree(rec.extra, "extra") : undefined;
  return renderContainer(bodyTree, "body") + (extraTree ? renderContainer(extraTree, "extra") : "");
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
      block.stats = lines.map((line, idx) => {
        const [label, value, deltaText] = line;
        const origDelta = block.stats?.[idx]?.[2];
        const color = block.stats?.[idx]?.[3];
        const kind = origDelta && typeof origDelta === "object" ? origDelta.kind : undefined;
        if (deltaText) return kind ? [label, value, { kind, text: deltaText }] : [label, value, { kind: "flat", text: deltaText }];
        return color ? [label, value, null, color] : [label, value];
      });
      break;
    }
    case "meterRow": {
      const lines = tuplesOf(raw, 3);
      const orig = block.meters || [];
      block.meters = lines.map((line, idx) => ({ ...(orig[idx] || {}), label: line[0], val: line[1], pct: Number(line[2]) || 0 }));
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

function collectRemoved(fv: Record<string, string>): Set<string> {
  const removed = new Set<string>();
  for (const k of Object.keys(fv)) {
    if (k.startsWith("removed_") && fv[k] === "1") removed.add(k.slice("removed_".length));
  }
  return removed;
}

function materialize(node: TreeNode, fv: Record<string, string>, removed: Set<string>): Block {
  if (node.kind === "skip") return clone(node.block);
  if (node.kind === "leaf") {
    const block = clone(node.block);
    applyOne(block, node.id, fv);
    return block;
  }
  const block = clone(node.block);
  if (node.type === "row2") {
    block.a = rebuild(`${node.id}_a`, node.containers.a, fv, removed);
    block.b = rebuild(`${node.id}_b`, node.containers.b, fv, removed);
  } else if (node.type === "cols3") {
    const keys = Object.keys(node.containers).sort();
    block.items = keys.map((k) => rebuild(`${node.id}_${k}`, node.containers[k], fv, removed));
  } else {
    block.body = rebuild(`${node.id}_body`, node.containers.body, fv, removed);
  }
  return block;
}

function rebuild(containerId: string, originalChildren: TreeNode[], fv: Record<string, string>, removed: Set<string>): Block[] {
  const orderRaw = fv[`order_${containerId}`];
  const orderIds = orderRaw ? orderRaw.split(",").filter(Boolean) : originalChildren.map((c) => c.id);
  const byId = new Map(originalChildren.map((c) => [c.id, c]));
  const result: Block[] = [];
  for (const id of orderIds) {
    if (removed.has(id)) continue;
    const node = byId.get(id);
    if (!node) continue;
    result.push(materialize(node, fv, removed));
  }
  return result;
}

export function applyFields(rec: WeekRecord, formValues: Record<string, string>): { body: Block[]; extra?: Block[] } {
  const removed = collectRemoved(formValues);
  const bodyTree = buildTree(rec.body, "body");
  const body = rebuild("body", bodyTree, formValues, removed);
  let extra: Block[] | undefined;
  if (rec.extra) {
    const extraTree = buildTree(rec.extra, "extra");
    extra = rebuild("extra", extraTree, formValues, removed);
  }
  return { body, extra };
}

// -------- отдел-футер (не входит в drag/удаление — простая фиксированная форма) --------

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
