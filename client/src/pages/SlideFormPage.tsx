import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { api, Slide, Template, WeeklyCycle } from "../api/client";
import { statusLabels } from "../statusLabels";
import { BlockEditor, BlockPreview, isBlockEmpty, layoutContainerClass } from "../components/slideBlocks";

export function SlideFormPage() {
  const [cycles, setCycles] = useState<WeeklyCycle[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [slide, setSlide] = useState<Slide | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [blockValues, setBlockValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.listCycles().then(setCycles).catch(() => setError("Не удалось загрузить список циклов"));
    api.listTemplates().then(setTemplates).catch(() => setError("Не удалось загрузить список шаблонов"));
  }, []);

  const openCycles = useMemo(() => cycles.filter((c) => c.status === "COLLECTING"), [cycles]);

  useEffect(() => {
    if (!cycleId || !templateId) {
      setSlide(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSaved(false);
    api
      .getOrCreateSlide(cycleId, templateId)
      .then((s) => {
        setSlide(s);
        const initial: Record<string, string> = {};
        for (const v of s.fieldValues) initial[v.templateFieldId] = v.value;
        setValues(initial);
        const initialBlocks: Record<string, unknown> = {};
        for (const v of s.blockValues) initialBlocks[v.templateBlockId] = v.value;
        setBlockValues(initialBlocks);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось открыть слайд"))
      .finally(() => setLoading(false));
  }, [cycleId, templateId]);

  const selectedTemplate = slide?.template ?? templates.find((t) => t.id === templateId) ?? null;
  const isBlockTemplate = selectedTemplate?.layoutKind != null;
  const sortedFields = useMemo(
    () => (selectedTemplate && !isBlockTemplate ? [...selectedTemplate.fields].sort((a, b) => a.order - b.order) : []),
    [selectedTemplate, isBlockTemplate]
  );
  const sortedBlocks = useMemo(
    () => (selectedTemplate && isBlockTemplate ? [...selectedTemplate.blocks].sort((a, b) => a.order - b.order) : []),
    [selectedTemplate, isBlockTemplate]
  );

  async function handleSave() {
    if (!slide) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      let updated: Slide;
      if (isBlockTemplate) {
        const payload = sortedBlocks.map((b) => ({ templateBlockId: b.id, value: blockValues[b.id] }));
        updated = await api.updateSlideBlocks(slide.id, payload);
      } else {
        const payload = sortedFields.map((f) => ({ templateFieldId: f.id, value: values[f.id] ?? "" }));
        updated = await api.updateSlideFields(slide.id, payload);
      }
      setSlide(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить слайд");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!slide) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await api.submitSlide(slide.id);
      setSlide(updated);
      setSaved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить слайд на проверку");
    } finally {
      setSubmitting(false);
    }
  }

  const editable = slide?.status === "DRAFT" || slide?.status === "NEEDS_REVISION";

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="content two-col">
        <div className="card">
          <h2>
            Заполнение слайда
            {slide && <span className="badge"> {statusLabels[slide.status]}</span>}
          </h2>
          {error && <p className="error-text">{error}</p>}
          {slide?.status === "NEEDS_REVISION" && slide.reviewComment && (
            <p className="review-comment">Комментарий проверяющего: {slide.reviewComment}</p>
          )}

          <div className="field">
            <label htmlFor="cycle">Недельный цикл</label>
            <select id="cycle" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
              <option value="">— выберите цикл —</option>
              {openCycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.weekLabel}
                </option>
              ))}
            </select>
            {cycles.length > 0 && openCycles.length === 0 && (
              <p className="hint-text">Нет циклов, открытых для сбора (статус «Сбор»).</p>
            )}
          </div>

          <div className="field">
            <label htmlFor="template">Шаблон</label>
            <select id="template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">— выберите шаблон —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {loading && <p className="hint-text">Загрузка слайда…</p>}

          {slide && !loading && !isBlockTemplate && (
            <>
              {sortedFields.map((f) => (
                <div className="field" key={f.id}>
                  <label htmlFor={`field-${f.id}`}>
                    {f.label}
                    {f.isRequired && <span className="required-mark"> *</span>}
                    {f.isRequired && editable && !values[f.id]?.trim() && (
                      <span className="hint-text"> — не заполнено</span>
                    )}
                  </label>
                  <textarea
                    id={`field-${f.id}`}
                    rows={3}
                    value={values[f.id] ?? ""}
                    disabled={!editable}
                    onChange={(e) => {
                      setSaved(false);
                      setValues((prev) => ({ ...prev, [f.id]: e.target.value }));
                    }}
                  />
                </div>
              ))}
            </>
          )}

          {slide && !loading && isBlockTemplate && (
            <>
              {sortedBlocks.map((b) => (
                <div key={b.id}>
                  <BlockEditor
                    block={b}
                    value={blockValues[b.id]}
                    disabled={!editable}
                    onChange={(v) => {
                      setSaved(false);
                      setBlockValues((prev) => ({ ...prev, [b.id]: v }));
                    }}
                  />
                  {b.isRequired && editable && isBlockEmpty(b.blockType, blockValues[b.id]) && (
                    <p className="hint-text">— не заполнено</p>
                  )}
                </div>
              ))}
            </>
          )}

          {slide && !loading && editable && (
            <>
              <button className="primary" onClick={handleSave} disabled={saving}>
                {saving ? "Сохраняем…" : "Сохранить"}
              </button>{" "}
              <button className="secondary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Отправляем…" : "Отправить на проверку"}
              </button>
              {saved && <span className="saved-hint"> Сохранено</span>}
            </>
          )}
        </div>

        <div className="card preview-slide">
          <h2>Предпросмотр</h2>
          {!selectedTemplate && <p className="hint-text">Выберите цикл и шаблон, чтобы увидеть предпросмотр.</p>}
          {selectedTemplate && !isBlockTemplate && (
            <div className="preview-card">
              <h3>{selectedTemplate.name}</h3>
              {sortedFields.map((f) => (
                <div className="preview-field" key={f.id}>
                  <div className="preview-label">{f.label}</div>
                  <div className="preview-value">{values[f.id] || <span className="muted-cell">—</span>}</div>
                </div>
              ))}
            </div>
          )}
          {selectedTemplate && isBlockTemplate && (
            <div className="preview-card">
              <h3>{selectedTemplate.name}</h3>
              <div className={layoutContainerClass(selectedTemplate.layoutKind!)}>
                {sortedBlocks
                  .filter((b) => b.blockType !== "FOOTER_STATS")
                  .map((b) => (
                    <BlockPreview key={b.id} block={b} value={blockValues[b.id]} />
                  ))}
              </div>
              {sortedBlocks
                .filter((b) => b.blockType === "FOOTER_STATS")
                .map((b) => (
                  <div className="block-footer-band" key={b.id}>
                    <BlockPreview block={b} value={blockValues[b.id]} />
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
