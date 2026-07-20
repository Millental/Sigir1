import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { assertPresentationReadAccess, PresentationAccessError } from "../utils/presentationAccess";
import { renderPresentationPdf } from "../pdf/browser";
import { buildPdfContentDisposition } from "../utils/pdfFilename";

const router = Router();
router.use(requireAuth);

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

router.get("/cycle/:weeklyCycleId/export.pdf", async (req, res) => {
  const weeklyCycle = await prisma.weeklyCycle.findUnique({ where: { id: req.params.weeklyCycleId } });
  if (!weeklyCycle) return res.status(404).json({ error: "Цикл не найден" });

  try {
    assertPresentationReadAccess(weeklyCycle, req.user!);
  } catch (err) {
    if (err instanceof PresentationAccessError) return res.status(err.status).json({ error: err.message });
    throw err;
  }

  const presentation = await prisma.presentation.findUnique({ where: { weeklyCycleId: weeklyCycle.id } });
  if (!presentation) return res.status(404).json({ error: "Презентация ещё не собрана" });

  try {
    const pdf = await renderPresentationPdf({
      url: `${CLIENT_ORIGIN}/print/${weeklyCycle.id}`,
      token: req.cookies.token,
      clientOrigin: CLIENT_ORIGIN,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", buildPdfContentDisposition(`presentation-${weeklyCycle.weekLabel}`));
    res.send(pdf);
  } catch (err) {
    console.error("Ошибка генерации PDF презентации:", err);
    res.status(502).json({ error: "Не удалось сформировать PDF" });
  }
});

router.get("/slots/:slotId/export.pdf", async (req, res) => {
  const slot = await prisma.presentationSlide.findUnique({
    where: { id: req.params.slotId },
    include: {
      presentation: { include: { weeklyCycle: true } },
      slide: { select: { owner: { select: { fullName: true } }, template: { select: { name: true } } } },
    },
  });
  if (!slot) return res.status(404).json({ error: "Слот не найден" });

  const weeklyCycle = slot.presentation.weeklyCycle;
  try {
    assertPresentationReadAccess(weeklyCycle, req.user!);
  } catch (err) {
    if (err instanceof PresentationAccessError) return res.status(err.status).json({ error: err.message });
    throw err;
  }

  const label = slot.slide ? `${slot.slide.owner.fullName}-${slot.slide.template.name}` : slot.placeholderLabel ?? "slide";

  try {
    const pdf = await renderPresentationPdf({
      url: `${CLIENT_ORIGIN}/print/${weeklyCycle.id}?slot=${slot.id}`,
      token: req.cookies.token,
      clientOrigin: CLIENT_ORIGIN,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", buildPdfContentDisposition(`slide-${weeklyCycle.weekLabel}-${label}`));
    res.send(pdf);
  } catch (err) {
    console.error("Ошибка генерации PDF слайда:", err);
    res.status(502).json({ error: "Не удалось сформировать PDF" });
  }
});

export default router;
