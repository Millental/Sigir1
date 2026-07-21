import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { CHART_IMAGE_DIR, CHART_IMAGE_CONTENT_TYPES } from "../utils/chartImageStorage";

const router = Router();

router.use(requireAuth);

router.get("/chart-images/:assetId", async (req, res) => {
  const asset = await prisma.chartImageAsset.findUnique({
    where: { id: req.params.assetId },
    include: { slideBlockValue: { include: { slide: { include: { weeklyCycle: true } } } } },
  });
  if (!asset) return res.status(404).json({ error: "Файл не найден" });

  const slide = asset.slideBlockValue.slide;
  const weeklyCycle = slide.weeklyCycle;
  const user = req.user!;

  const canRead =
    user.role === "ADMIN" ||
    slide.ownerId === user.userId ||
    (weeklyCycle.status !== "ARCHIVED" && slide.status === "IN_PRESENTATION");
  if (!canRead) return res.status(403).json({ error: "Нет доступа к файлу" });

  try {
    const buffer = await fs.readFile(path.join(CHART_IMAGE_DIR, asset.id));
    res.setHeader("Content-Type", CHART_IMAGE_CONTENT_TYPES[asset.extension as "png" | "jpg"]);
    res.send(buffer);
  } catch {
    res.status(404).json({ error: "Файл не найден на диске" });
  }
});

export default router;
