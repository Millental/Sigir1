import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import weeklyCycleRoutes from "./routes/weeklyCycles";
import templateRoutes from "./routes/templates";
import slideRoutes from "./routes/slides";
import presentationRoutes from "./routes/presentations";
import pptxImportRoutes from "./routes/pptxImport";

export const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/weekly-cycles", weeklyCycleRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/slides", slideRoutes);
app.use("/api/presentations", presentationRoutes);
app.use("/api/pptx-import", pptxImportRoutes);

// Единый обработчик непойманных ошибок — чтобы стек не утекал клиенту.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});
