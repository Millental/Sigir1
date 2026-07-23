import { useEffect, useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { api, BlockType, LayoutKind, Template, TemplateVersionItem } from "../api/client";

interface FieldRow {
  id?: string;
  label: string;
  isRequired: boolean;
}

interface BlockRow {
  id?: string;
  blockType: BlockType;
  label: string;
  isRequired: boolean;
  columns: string;
  previewImageBase64?: string;
}

interface ImportProposal {
  index: number;
  textSnippet: string;
  layoutKind: LayoutKind;
  blocks: Array<{
    blockType: BlockType;
    label: string;
    order: number;
    config?: { columns?: string[] };
    previewImageBase64?: string;
  }>;
}

const emptyField: FieldRow = { label: "", isRequired: false };
const emptyBlock: BlockRow = { blockType: "RICH_TEXT_SECTION", label: "", isRequired: false, columns: "" };

const layoutKindLabels: Record<LayoutKind, string> = {
  QUADRANT: "Квадрант (2×2 текстовых блока)",
  FINANCIAL_CHART: "Финансовый (таблицы/метрики)",
  SIMPLE_COLUMN: "Простой одноколоночный",
};

const blockTypeLabels: Record<BlockType, string> = {
  METRIC_TILE: "Метрика (план/факт/%)",
  RICH_TEXT_SECTION: "Текстовая секция",
  TABLE: "Таблица",
  FOOTER_STATS: "Футер (кадровая статистика)",
  CHART_IMAGE: "Изображение (график/диаграмма)",
};

function proposalBadge(p: ImportProposal): string {
  const counts: Record<string, number> = {};
  for (const b of p.blocks) counts[b.blockType] = (counts[b.blockType] ?? 0) + 1;
  const parts: string[] = [];
  if (counts.RICH_TEXT_SECTION || counts.METRIC_TILE) {
    parts.push(`текст: ${(counts.RICH_TEXT_SECTION ?? 0) + (counts.METRIC_TILE ?? 0)}`);
  }
  if (counts.TABLE) parts.push(`таблицы: ${counts.TABLE}`);
  if (counts.CHART_IMAGE) parts.push(`изображения: ${counts.CHART_IMAGE}`);
  return parts.join(", ");
}

function moveItem<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLayoutKind, setSelectedLayoutKind] = useState<LayoutKind | null>(null);
  const [selectedFrozen, setSelectedFrozen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<TemplateVersionItem[] | null>(null);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [name, setName] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [fields, setFields] = useState<FieldRow[]>([{ ...emptyField }]);
  const [layoutKind, setLayoutKind] = useState<LayoutKind>("SIMPLE_COLUMN");
  const [blocks, setBlocks] = useState<BlockRow[]>([{ ...emptyBlock }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importProposals, setImportProposals] = useState<ImportProposal[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  function loadTemplates() {
    api.listTemplates().then(setTemplates).catch(() => setError("Не удалось загрузить список шаблонов"));
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  function selectNew() {
    setSelectedId(null);
    setSelectedLayoutKind(null);
    setSelectedFrozen(false);
    setSelectedVersion(null);
    setVersionsOpen(false);
    setVersions(null);
    setName("");
    setIsShared(false);
    setLayoutKind("SIMPLE_COLUMN");
    setBlocks([{ ...emptyBlock }]);
    setError(null);
  }

  function selectTemplate(t: Template) {
    setSelectedId(t.id);
    setSelectedLayoutKind(t.layoutKind);
    setSelectedFrozen((t._count?.slides ?? 0) > 0);
    setSelectedVersion(t.version);
    setVersionsOpen(false);
    setVersions(null);
    setName(t.name);
    setIsShared(t.isShared);
    setError(null);

    if (t.layoutKind === null) {
      setFields(
        [...t.fields]
          .sort((a, b) => a.order - b.order)
          .map((f) => ({ id: f.id, label: f.label, isRequired: f.isRequired }))
      );
    } else {
      setLayoutKind(t.layoutKind);
      setBlocks(
        [...t.blocks]
          .sort((a, b) => a.order - b.order)
          .map((b) => ({
            id: b.id,
            blockType: b.blockType,
            label: b.label,
            isRequired: b.isRequired,
            columns: (b.config?.columns ?? []).join(", "),
          }))
      );
    }
  }

  function toggleVersions() {
    if (!versionsOpen && versions === null && selectedId) {
      setVersionsLoading(true);
      api
        .getTemplateVersions(selectedId)
        .then(setVersions)
        .catch(() => setError("Не удалось загрузить историю версий"))
        .finally(() => setVersionsLoading(false));
    }
    setVersionsOpen((o) => !o);
  }

  const isBlockForm = selectedId === null || selectedLayoutKind !== null;

  function updateField(index: number, patch: Partial<FieldRow>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function addField() {
    setFields((prev) => [...prev, { ...emptyField }]);
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  function updateBlock(index: number, patch: Partial<BlockRow>) {
    setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  function addBlock() {
    setBlocks((prev) => [...prev, { ...emptyBlock }]);
  }

  function removeBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  }

  function moveBlock(index: number, delta: number) {
    setBlocks((prev) => moveItem(prev, index, delta));
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError(null);
    setImporting(true);
    try {
      const result = await api.parsePptx(file);
      setImportProposals(result.slides);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Не удалось разобрать файл");
    } finally {
      setImporting(false);
    }
  }

  function applyProposal(p: ImportProposal) {
    setSelectedId(null);
    setSelectedLayoutKind(null);
    setSelectedFrozen(false);
    setName("");
    setIsShared(false);
    setError(null);
    setLayoutKind(p.layoutKind);
    setBlocks(
      p.blocks.map((b) => ({
        blockType: b.blockType,
        label: b.label,
        isRequired: false,
        columns: (b.config?.columns ?? []).join(", "),
        previewImageBase64: b.previewImageBase64,
      }))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Укажите название шаблона");
      return;
    }

    setSaving(true);
    try {
      let saved: Template;

      if (!isBlockForm) {
        // Легаси-шаблон: только редактирование существующего, layoutKind === null.
        if (fields.length === 0 || fields.some((f) => !f.label.trim())) {
          setError("Добавьте хотя бы одно поле, у каждого поля должна быть подпись");
          setSaving(false);
          return;
        }
        const payload = fields.map((f, i) => ({ id: f.id, label: f.label.trim(), isRequired: f.isRequired, order: i }));
        saved = await api.updateTemplate(selectedId!, { name, isShared, fields: payload });
      } else if (selectedId && selectedFrozen) {
        // Заморожен — состав блоков не отправляем вовсе.
        saved = await api.updateBlockTemplate(selectedId, { name, isShared });
      } else {
        if (blocks.length === 0 || blocks.some((b) => !b.label.trim())) {
          setError("Добавьте хотя бы один блок, у каждого блока должна быть подпись");
          setSaving(false);
          return;
        }
        const invalidTable = blocks.find(
          (b) => b.blockType === "TABLE" && b.columns.split(",").map((c) => c.trim()).filter(Boolean).length === 0
        );
        if (invalidTable) {
          setError('Для блока "Таблица" укажите хотя бы одну колонку (через запятую)');
          setSaving(false);
          return;
        }

        const payload = blocks.map((b, i) => ({
          id: b.id,
          blockType: b.blockType,
          label: b.label.trim(),
          isRequired: b.isRequired,
          order: i,
          ...(b.blockType === "TABLE"
            ? { config: { columns: b.columns.split(",").map((c) => c.trim()).filter(Boolean) } }
            : {}),
        }));

        saved = selectedId
          ? await api.updateBlockTemplate(selectedId, { name, isShared, blocks: payload })
          : await api.createBlockTemplate({ name, isShared, layoutKind, blocks: payload });
      }

      loadTemplates();
      selectTemplate(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить шаблон");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="content two-col">
        <div className="card">
          <h2>Шаблоны</h2>
          <ul className="template-list">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  className={t.id === selectedId ? "template-list-item active" : "template-list-item"}
                  onClick={() => selectTemplate(t)}
                >
                  {t.name} {t.isShared && <span className="badge">общий</span>}
                  {t.layoutKind === null && <span className="badge">легаси</span>}
                </button>
              </li>
            ))}
          </ul>
          <button className="secondary" onClick={selectNew}>
            + Новый шаблон
          </button>

          <div className="field import-field">
            <label htmlFor="pptxImport">Импортировать из pptx</label>
            <input id="pptxImport" type="file" accept=".pptx" disabled={importing} onChange={handleImportFile} />
            {importing && <p className="hint-text">Разбираем файл…</p>}
            {importError && <p className="error-text">{importError}</p>}
          </div>

          {importProposals && (
            <div className="template-fields">
              <label>Выберите слайд-образец ({importProposals.length})</label>
              <ul className="template-list">
                {importProposals.map((p) => (
                  <li key={p.index}>
                    <button type="button" className="template-list-item" onClick={() => applyProposal(p)}>
                      Слайд {p.index + 1}: {p.textSnippet || "(без текста)"}
                      <br />
                      <span className="hint-text">{proposalBadge(p)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="secondary" onClick={() => setImportProposals(null)}>
                Скрыть список
              </button>
            </div>
          )}
        </div>

        <form className="card" onSubmit={handleSubmit}>
          <h2>
            {selectedId ? "Редактирование шаблона" : "Новый шаблон"}
            {selectedId && selectedVersion !== null && <span className="badge"> версия {selectedVersion}</span>}
          </h2>
          {error && <p className="error-text">{error}</p>}

          {selectedId && (
            <div className="template-version-history">
              <button type="button" className="secondary" onClick={toggleVersions}>
                {versionsOpen ? "Скрыть историю версий" : "История версий"}
              </button>
              {versionsOpen && (
                <div className="slide-history-list">
                  {versionsLoading && <p className="hint-text">Загрузка…</p>}
                  {versions && versions.length === 0 && <p className="hint-text">История версий пуста.</p>}
                  {versions && versions.length > 0 && (
                    <ul>
                      {versions.map((v) => (
                        <li key={v.id} className="slide-history-item">
                          <div className="slide-history-item-label">версия {v.versionNumber}: {v.name}</div>
                          <div className="slide-history-item-value">
                            {v.isShared ? "общий" : "личный"},{" "}
                            {v.layoutKind === null
                              ? `полей: ${v.fieldsSnapshot?.length ?? 0}`
                              : `блоков: ${v.blocksSnapshot?.length ?? 0}`}
                          </div>
                          <div className="slide-history-item-meta">
                            {v.changedBy.fullName},{" "}
                            {new Date(v.createdAt).toLocaleString("ru-RU", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="field">
            <label htmlFor="name">Название</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="field-checkbox">
            <label>
              <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} />
              Общий шаблон (виден всем спикерам)
            </label>
          </div>

          {!isBlockForm && (
            <div className="template-fields">
              <label>Поля слайда (легаси-шаблон)</label>
              {fields.map((f, i) => (
                <div className="template-field-row" key={f.id ?? `new-${i}`}>
                  <input
                    placeholder="Подпись поля"
                    value={f.label}
                    onChange={(e) => updateField(i, { label: e.target.value })}
                  />
                  <label className="inline-checkbox">
                    <input
                      type="checkbox"
                      checked={f.isRequired}
                      onChange={(e) => updateField(i, { isRequired: e.target.checked })}
                    />
                    обязательное
                  </label>
                  <button type="button" className="danger-outline" onClick={() => removeField(i)}>
                    Удалить
                  </button>
                </div>
              ))}
              <button type="button" className="secondary" onClick={addField}>
                + Добавить поле
              </button>
            </div>
          )}

          {isBlockForm && (
            <div className="template-fields">
              <div className="field">
                <label htmlFor="layoutKind">Компоновка (layoutKind)</label>
                <select
                  id="layoutKind"
                  value={layoutKind}
                  disabled={!!selectedId}
                  onChange={(e) => setLayoutKind(e.target.value as LayoutKind)}
                >
                  {Object.entries(layoutKindLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {selectedId && <p className="hint-text">Компоновка неизменна после создания шаблона.</p>}
              </div>

              {selectedFrozen && (
                <p className="frozen-banner">
                  Заморожено — по шаблону уже есть слайды, состав блоков менять нельзя.
                </p>
              )}

              <label>Блоки слайда</label>
              {blocks.map((b, i) => (
                <div className="template-block-row" key={b.id ?? `new-${i}`}>
                  <div className="field-row">
                    <select
                      value={b.blockType}
                      disabled={selectedFrozen}
                      onChange={(e) => updateBlock(i, { blockType: e.target.value as BlockType })}
                    >
                      {Object.entries(blockTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="Подпись блока"
                      value={b.label}
                      disabled={selectedFrozen}
                      onChange={(e) => updateBlock(i, { label: e.target.value })}
                    />
                  </div>
                  {b.blockType === "TABLE" && (
                    <div className="field-row">
                      <input
                        placeholder="Колонки через запятую, напр.: План, Факт, %"
                        value={b.columns}
                        disabled={selectedFrozen}
                        onChange={(e) => updateBlock(i, { columns: e.target.value })}
                      />
                    </div>
                  )}
                  {b.blockType === "CHART_IMAGE" && (
                    <div className="field-row">
                      {b.previewImageBase64 ? (
                        <img src={b.previewImageBase64} alt="Превью из pptx" className="chart-image-preview" />
                      ) : (
                        <p className="hint-text">
                          Файл изображения загружается позже, при заполнении слайда — здесь задаётся только
                          подпись блока.
                        </p>
                      )}
                    </div>
                  )}
                  <div className="field-row">
                    <label className="inline-checkbox">
                      <input
                        type="checkbox"
                        checked={b.isRequired}
                        disabled={selectedFrozen}
                        onChange={(e) => updateBlock(i, { isRequired: e.target.checked })}
                      />
                      обязательное
                    </label>
                    {!selectedFrozen && (
                      <>
                        <button type="button" disabled={i === 0} onClick={() => moveBlock(i, -1)}>
                          ▲
                        </button>
                        <button type="button" disabled={i === blocks.length - 1} onClick={() => moveBlock(i, 1)}>
                          ▼
                        </button>
                        <button type="button" className="danger-outline" onClick={() => removeBlock(i)}>
                          Удалить
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {!selectedFrozen && (
                <button type="button" className="secondary" onClick={addBlock}>
                  + Добавить блок
                </button>
              )}
            </div>
          )}

          <button className="primary" type="submit" disabled={saving}>
            {saving ? "Сохраняем…" : "Сохранить шаблон"}
          </button>
        </form>
      </div>
    </div>
  );
}
