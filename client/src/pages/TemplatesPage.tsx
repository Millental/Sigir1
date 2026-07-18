import { useEffect, useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { api, Template } from "../api/client";

interface FieldRow {
  id?: string;
  label: string;
  isRequired: boolean;
}

const emptyField: FieldRow = { label: "", isRequired: false };

export function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [fields, setFields] = useState<FieldRow[]>([{ ...emptyField }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function loadTemplates() {
    api.listTemplates().then(setTemplates).catch(() => setError("Не удалось загрузить список шаблонов"));
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  function selectNew() {
    setSelectedId(null);
    setName("");
    setIsShared(false);
    setFields([{ ...emptyField }]);
    setError(null);
  }

  function selectTemplate(t: Template) {
    setSelectedId(t.id);
    setName(t.name);
    setIsShared(t.isShared);
    setFields(
      [...t.fields]
        .sort((a, b) => a.order - b.order)
        .map((f) => ({ id: f.id, label: f.label, isRequired: f.isRequired }))
    );
    setError(null);
  }

  function updateField(index: number, patch: Partial<FieldRow>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function addField() {
    setFields((prev) => [...prev, { ...emptyField }]);
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Укажите название шаблона");
      return;
    }
    if (fields.length === 0 || fields.some((f) => !f.label.trim())) {
      setError("Добавьте хотя бы одно поле, у каждого поля должна быть подпись");
      return;
    }

    setSaving(true);
    try {
      const payload = fields.map((f, i) => ({ id: f.id, label: f.label.trim(), isRequired: f.isRequired, order: i }));
      const saved = selectedId
        ? await api.updateTemplate(selectedId, { name, isShared, fields: payload })
        : await api.createTemplate({ name, isShared, fields: payload });
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
                </button>
              </li>
            ))}
          </ul>
          <button className="secondary" onClick={selectNew}>
            + Новый шаблон
          </button>
        </div>

        <form className="card" onSubmit={handleSubmit}>
          <h2>{selectedId ? "Редактирование шаблона" : "Новый шаблон"}</h2>
          {error && <p className="error-text">{error}</p>}

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

          <div className="template-fields">
            <label>Поля слайда</label>
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

          <button className="primary" type="submit" disabled={saving}>
            {saving ? "Сохраняем…" : "Сохранить шаблон"}
          </button>
        </form>
      </div>
    </div>
  );
}
