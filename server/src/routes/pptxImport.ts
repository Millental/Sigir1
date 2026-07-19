import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../middleware/auth";
import { parseAndPropose } from "../pptx/parse";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isPptxExt = file.originalname.toLowerCase().endsWith(".pptx");
    const isPptxMime = file.mimetype === PPTX_MIME || file.mimetype === "application/octet-stream";
    if (isPptxExt && isPptxMime) return cb(null, true);
    cb(new Error("Ожидается файл .pptx"));
  },
});

router.post(
  "/parse",
  upload.single("file"),
  (err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: "Файл слишком большой (максимум 20 МБ) или повреждён" });
    }
    if (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Не удалось прочитать файл" });
    }
    next();
  },
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: "Укажите файл .pptx" });
    }
    try {
      const slides = await parseAndPropose(req.file.buffer);
      res.json({ slides });
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: "Не удалось разобрать файл — убедитесь, что это корректный .pptx" });
    }
  }
);

export default router;
