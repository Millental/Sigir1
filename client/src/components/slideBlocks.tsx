import { BlockType, LayoutKind, TemplateBlock } from "../api/client";

interface RichTextValue {
  text: string;
}

interface MetricTileValue {
  value: string;
  plan?: string;
  fact?: string;
  percent?: string;
}

interface TableValue {
  rows: string[][];
}

function asRichText(value: unknown): RichTextValue {
  const v = value as Partial<RichTextValue> | undefined;
  return { text: typeof v?.text === "string" ? v.text : "" };
}

function asMetricTile(value: unknown): MetricTileValue {
  const v = value as Partial<MetricTileValue> | undefined;
  return {
    value: typeof v?.value === "string" ? v.value : "",
    plan: typeof v?.plan === "string" ? v.plan : undefined,
    fact: typeof v?.fact === "string" ? v.fact : undefined,
    percent: typeof v?.percent === "string" ? v.percent : undefined,
  };
}

function asTable(value: unknown): TableValue {
  const v = value as Partial<TableValue> | undefined;
  return { rows: Array.isArray(v?.rows) ? (v!.rows as string[][]) : [] };
}

export function layoutContainerClass(layoutKind: LayoutKind): string {
  if (layoutKind === "QUADRANT") return "block-grid layout-quadrant";
  if (layoutKind === "FINANCIAL_CHART") return "block-grid layout-financial";
  return "block-grid layout-simple";
}

export function isBlockEmpty(blockType: BlockType, value: unknown): boolean {
  if (blockType === "RICH_TEXT_SECTION" || blockType === "FOOTER_STATS") {
    return !asRichText(value).text.trim();
  }
  if (blockType === "METRIC_TILE") {
    return !asMetricTile(value).value.trim();
  }
  if (blockType === "CHART_IMAGE") {
    return true;
  }
  return asTable(value).rows.length === 0;
}

const CHART_IMAGE_NOTE = "Загрузка изображений появится в одном из следующих этапов";

export function BlockPreview({ block, value }: { block: TemplateBlock; value: unknown }) {
  if (block.blockType === "RICH_TEXT_SECTION" || block.blockType === "FOOTER_STATS") {
    const { text } = asRichText(value);
    return (
      <div className="preview-field">
        <div className="preview-label">{block.label}</div>
        <div className="preview-value">{text || <span className="muted-cell">—</span>}</div>
      </div>
    );
  }

  if (block.blockType === "METRIC_TILE") {
    const v = asMetricTile(value);
    return (
      <div className="preview-field metric-tile">
        <div className="preview-label">{block.label}</div>
        <div className="metric-tile-value">{v.value || <span className="muted-cell">—</span>}</div>
        {(v.plan || v.fact || v.percent) && (
          <div className="metric-tile-details">
            {v.plan && <span>План: {v.plan}</span>}
            {v.fact && <span>Факт: {v.fact}</span>}
            {v.percent && <span>%: {v.percent}</span>}
          </div>
        )}
      </div>
    );
  }

  if (block.blockType === "CHART_IMAGE") {
    return (
      <div className="preview-field">
        <div className="preview-label">{block.label}</div>
        <div className="preview-value muted-cell">— ({CHART_IMAGE_NOTE})</div>
      </div>
    );
  }

  // TABLE
  const columns = block.config?.columns ?? [];
  const { rows } = asTable(value);
  return (
    <div className="preview-field">
      <div className="preview-label">{block.label}</div>
      {rows.length === 0 ? (
        <div className="preview-value muted-cell">—</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={i}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function BlockEditor({
  block,
  value,
  onChange,
  disabled,
}: {
  block: TemplateBlock;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}) {
  if (block.blockType === "RICH_TEXT_SECTION" || block.blockType === "FOOTER_STATS") {
    const { text } = asRichText(value);
    return (
      <div className="field">
        <label>
          {block.label}
          {block.isRequired && <span className="required-mark"> *</span>}
        </label>
        <textarea
          rows={3}
          value={text}
          disabled={disabled}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      </div>
    );
  }

  if (block.blockType === "METRIC_TILE") {
    const v = asMetricTile(value);
    return (
      <div className="field">
        <label>
          {block.label}
          {block.isRequired && <span className="required-mark"> *</span>}
        </label>
        <div className="metric-tile-row">
          <input
            placeholder="Значение"
            value={v.value}
            disabled={disabled}
            onChange={(e) => onChange({ ...v, value: e.target.value })}
          />
          <input
            placeholder="План"
            value={v.plan ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ ...v, plan: e.target.value })}
          />
          <input
            placeholder="Факт"
            value={v.fact ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ ...v, fact: e.target.value })}
          />
          <input
            placeholder="%"
            value={v.percent ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ ...v, percent: e.target.value })}
          />
        </div>
      </div>
    );
  }

  if (block.blockType === "CHART_IMAGE") {
    return (
      <div className="field">
        <label>{block.label}</label>
        <p className="hint-text">{CHART_IMAGE_NOTE}</p>
      </div>
    );
  }

  // TABLE
  const columns = block.config?.columns ?? [];
  const { rows } = asTable(value);

  function updateCell(rowIndex: number, cellIndex: number, cellValue: string) {
    const nextRows = rows.map((row, ri) => (ri === rowIndex ? row.map((c, ci) => (ci === cellIndex ? cellValue : c)) : row));
    onChange({ rows: nextRows });
  }

  function addRow() {
    onChange({ rows: [...rows, columns.map(() => "")] });
  }

  function removeRow(rowIndex: number) {
    onChange({ rows: rows.filter((_, ri) => ri !== rowIndex) });
  }

  return (
    <div className="field">
      <label>
        {block.label}
        {block.isRequired && <span className="required-mark"> *</span>}
      </label>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i}>{c}</th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {columns.map((_, ci) => (
                <td key={ci}>
                  <input
                    value={row[ci] ?? ""}
                    disabled={disabled}
                    onChange={(e) => updateCell(ri, ci, e.target.value)}
                  />
                </td>
              ))}
              <td>
                {!disabled && (
                  <button type="button" className="danger-outline" onClick={() => removeRow(ri)}>
                    Удалить
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!disabled && (
        <button type="button" className="secondary" onClick={addRow}>
          + Добавить строку
        </button>
      )}
    </div>
  );
}
