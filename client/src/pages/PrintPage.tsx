import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, PresentationCycleView } from "../api/client";
import { PresentationSlideCard } from "../components/PresentationSlideCard";

type PrintStatus = "loading" | "ready" | "error";

export function PrintPage() {
  const { weeklyCycleId } = useParams<{ weeklyCycleId: string }>();
  const [searchParams] = useSearchParams();
  const slotId = searchParams.get("slot");

  const [status, setStatus] = useState<PrintStatus>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [view, setView] = useState<PresentationCycleView | null>(null);

  useEffect(() => {
    if (!weeklyCycleId) {
      setErrorMsg("Не указан цикл");
      setStatus("error");
      return;
    }
    api
      .getPresentation(weeklyCycleId)
      .then((data) => {
        if (!data.presentation) {
          setErrorMsg("Презентация ещё не собрана");
          setStatus("error");
          return;
        }
        if (slotId && !data.presentation.slides.some((s) => s.id === slotId)) {
          setErrorMsg("Слайд не найден в презентации");
          setStatus("error");
          return;
        }
        setView(data);
        setStatus("ready");
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : "Не удалось загрузить презентацию");
        setStatus("error");
      });
  }, [weeklyCycleId, slotId]);

  const allSlots = view?.presentation?.slides ?? [];
  const slotsToRender = slotId ? allSlots.filter((s) => s.id === slotId) : allSlots;
  const exportDate = new Date().toLocaleDateString("ru-RU", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="print-root" data-print-status={status} data-print-error={status === "error" ? errorMsg : undefined}>
      {status === "error" && <p className="error-text">{errorMsg}</p>}
      {status === "ready" && view?.weeklyCycle && (
        <>
          {!slotId && (
            <section className="print-page print-title-page">
              <h1>{view.weeklyCycle.weekLabel}</h1>
              <p>Экспортировано: {exportDate}</p>
            </section>
          )}
          {slotsToRender.map((slot) => (
            <section className="print-page print-slide" key={slot.id}>
              <PresentationSlideCard slot={slot} />
            </section>
          ))}
        </>
      )}
    </div>
  );
}
