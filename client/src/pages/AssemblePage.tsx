import { useEffect, useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { useAuth } from "../context/AuthContext";
import { api, PresentationCycleView, PresentationSlide, WeeklyCycle } from "../api/client";
import { statusLabels } from "../statusLabels";

function moveSlot(slots: PresentationSlide[], index: number, delta: number): string[] {
  const next = [...slots];
  const target = index + delta;
  if (target < 0 || target >= next.length) return next.map((s) => s.id);
  [next[index], next[target]] = [next[target], next[index]];
  return next.map((s) => s.id);
}

export function AssemblePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [cycles, setCycles] = useState<WeeklyCycle[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [view, setView] = useState<PresentationCycleView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [placeholderDraft, setPlaceholderDraft] = useState("");

  useEffect(() => {
    api.listCycles().then(setCycles).catch(() => setError("Не удалось загрузить список циклов"));
  }, []);

  function loadView(id: string) {
    setLoading(true);
    setError(null);
    api
      .getPresentation(id)
      .then(setView)
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить презентацию"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!cycleId) {
      setView(null);
      return;
    }
    loadView(cycleId);
  }, [cycleId]);

  async function handleAddSlide(slideId: string) {
    setBusyId(slideId);
    setError(null);
    try {
      await api.addSlideToPresentation(cycleId, slideId);
      loadView(cycleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить слайд в презентацию");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddPlaceholder() {
    if (!placeholderDraft.trim()) return;
    setBusyId("placeholder");
    setError(null);
    try {
      await api.addPlaceholderToPresentation(cycleId, placeholderDraft.trim());
      setPlaceholderDraft("");
      loadView(cycleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить заглушку");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(presentationSlideId: string) {
    setBusyId(presentationSlideId);
    setError(null);
    try {
      await api.removePresentationSlot(presentationSlideId);
      loadView(cycleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось убрать слот из презентации");
    } finally {
      setBusyId(null);
    }
  }

  async function handleMove(index: number, delta: number) {
    if (!view?.presentation) return;
    const order = moveSlot(view.presentation.slides, index, delta);
    setBusyId(view.presentation.slides[index].id);
    setError(null);
    try {
      await api.reorderPresentation(cycleId, order);
      loadView(cycleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось изменить порядок");
    } finally {
      setBusyId(null);
    }
  }

  const slots = view?.presentation?.slides ?? [];

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="content">
        <div className="card">
          <h2>Презентация</h2>
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

          {loading && <p className="hint-text">Загрузка…</p>}
          {cycleId && !loading && !view?.presentation && (
            <p className="hint-text">Презентация ещё не собрана.</p>
          )}
        </div>

        {isAdmin && cycleId && !loading && (
          <div className="card">
            <h3>Готовые слайды</h3>
            {view?.candidateSlides.length === 0 && (
              <p className="hint-text">Нет слайдов, готовых к включению.</p>
            )}
            {view?.candidateSlides.map((slide) => (
              <div className="field-row" key={slide.id}>
                <span>
                  {slide.owner.fullName} — {slide.template.name}
                </span>
                <button
                  className="primary"
                  disabled={busyId === slide.id}
                  onClick={() => handleAddSlide(slide.id)}
                >
                  {busyId === slide.id ? "Добавляем…" : "Добавить"}
                </button>
              </div>
            ))}

            <div className="field">
              <label htmlFor="placeholder">Заглушка вместо неготового спикера</label>
              <div className="field-row">
                <input
                  id="placeholder"
                  type="text"
                  value={placeholderDraft}
                  onChange={(e) => setPlaceholderDraft(e.target.value)}
                  placeholder="Например: Иванов И.И. — доклад не готов"
                />
                <button
                  className="secondary"
                  disabled={!placeholderDraft.trim() || busyId === "placeholder"}
                  onClick={handleAddPlaceholder}
                >
                  {busyId === "placeholder" ? "Добавляем…" : "Добавить заглушку"}
                </button>
              </div>
            </div>
          </div>
        )}

        {slots.map((slot, index) => {
          const sortedFields = slot.slide ? [...slot.slide.template.fields].sort((a, b) => a.order - b.order) : [];
          const valueByField = slot.slide
            ? new Map(slot.slide.fieldValues.map((v) => [v.templateFieldId, v.value]))
            : new Map<string, string>();

          return (
          <div className="card preview-card" key={slot.id}>
            <h3>
              {slot.slide ? (
                <>
                  {slot.slide.owner.fullName} — {slot.slide.template.name}
                  <span className="badge"> {statusLabels[slot.slide.status]}</span>
                </>
              ) : (
                <>
                  {slot.placeholderLabel}
                  <span className="badge"> Заглушка</span>
                </>
              )}
            </h3>

            {slot.slide &&
              sortedFields.map((f) => (
                <div className="preview-field" key={f.id}>
                  <div className="preview-label">{f.label}</div>
                  <div className="preview-value">
                    {valueByField.get(f.id) || <span className="muted-cell">—</span>}
                  </div>
                </div>
              ))}

            {isAdmin && (
              <div className="field-row">
                <button disabled={index === 0 || busyId === slot.id} onClick={() => handleMove(index, -1)}>
                  ▲
                </button>
                <button
                  disabled={index === slots.length - 1 || busyId === slot.id}
                  onClick={() => handleMove(index, 1)}
                >
                  ▼
                </button>
                <button
                  className="danger-outline"
                  disabled={busyId === slot.id}
                  onClick={() => handleRemove(slot.id)}
                >
                  Убрать
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
