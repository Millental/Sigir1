import { useEffect, useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { api, Slide, WeeklyCycle } from "../api/client";
import { statusLabels } from "../statusLabels";

export function ReviewPage() {
  const [cycles, setCycles] = useState<WeeklyCycle[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revisionDraftId, setRevisionDraftId] = useState<string | null>(null);
  const [revisionComment, setRevisionComment] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.listCycles().then(setCycles).catch(() => setError("Не удалось загрузить список циклов"));
  }, []);

  function loadSlides(id: string) {
    setLoading(true);
    setError(null);
    api
      .listCycleSlides(id)
      .then(setSlides)
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить слайды"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!cycleId) {
      setSlides([]);
      return;
    }
    loadSlides(cycleId);
  }, [cycleId]);

  async function handleApprove(slide: Slide) {
    setBusyId(slide.id);
    setError(null);
    try {
      await api.approveSlide(slide.id);
      setApprovedIds((prev) => new Set(prev).add(slide.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось принять слайд");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRequestRevision(slide: Slide) {
    if (!revisionComment.trim()) return;
    setBusyId(slide.id);
    setError(null);
    try {
      await api.requestRevision(slide.id, revisionComment.trim());
      setRevisionDraftId(null);
      setRevisionComment("");
      loadSlides(cycleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить слайд на доработку");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="content">
        <div className="card">
          <h2>Проверка слайдов</h2>
          {error && <p className="error-text">{error}</p>}

          <div className="field">
            <label htmlFor="cycle">Недельный цикл</label>
            <select id="cycle" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
              <option value="">— выберите цикл —</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.weekLabel}
                </option>
              ))}
            </select>
          </div>

          {loading && <p className="hint-text">Загрузка слайдов…</p>}
          {cycleId && !loading && slides.length === 0 && (
            <p className="hint-text">В этом цикле пока нет слайдов.</p>
          )}
        </div>

        {slides.map((slide) => {
          const sortedFields = [...slide.template.fields].sort((a, b) => a.order - b.order);
          const valueByField = new Map(slide.fieldValues.map((v) => [v.templateFieldId, v.value]));
          const isRevisionOpen = revisionDraftId === slide.id;

          return (
            <div className="card preview-card" key={slide.id}>
              <h3>
                {slide.owner.fullName} — {slide.template.name}
                <span className="badge"> {statusLabels[slide.status]}</span>
                {approvedIds.has(slide.id) && <span className="saved-hint"> Принято</span>}
              </h3>

              {slide.status === "NEEDS_REVISION" && slide.reviewComment && (
                <p className="review-comment">Комментарий проверяющего: {slide.reviewComment}</p>
              )}

              {sortedFields.map((f) => (
                <div className="preview-field" key={f.id}>
                  <div className="preview-label">{f.label}</div>
                  <div className="preview-value">
                    {valueByField.get(f.id) || <span className="muted-cell">—</span>}
                  </div>
                </div>
              ))}

              {slide.status === "SUBMITTED" && (
                <div className="field-row">
                  <button
                    className="primary"
                    disabled={busyId === slide.id}
                    onClick={() => handleApprove(slide)}
                  >
                    {busyId === slide.id ? "Принимаем…" : "Принять"}
                  </button>
                  {!isRevisionOpen && (
                    <button
                      className="danger-outline"
                      disabled={busyId === slide.id}
                      onClick={() => {
                        setRevisionDraftId(slide.id);
                        setRevisionComment("");
                      }}
                    >
                      Вернуть на доработку
                    </button>
                  )}
                </div>
              )}

              {isRevisionOpen && (
                <div className="field">
                  <label htmlFor={`revision-${slide.id}`}>Комментарий для доработки</label>
                  <textarea
                    id={`revision-${slide.id}`}
                    rows={3}
                    value={revisionComment}
                    onChange={(e) => setRevisionComment(e.target.value)}
                  />
                  <button
                    className="danger-outline"
                    disabled={!revisionComment.trim() || busyId === slide.id}
                    onClick={() => handleRequestRevision(slide)}
                  >
                    {busyId === slide.id ? "Отправляем…" : "Отправить решение"}
                  </button>{" "}
                  <button className="secondary" onClick={() => setRevisionDraftId(null)}>
                    Отмена
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
