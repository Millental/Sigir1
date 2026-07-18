import "dotenv/config";
import { app } from "./app";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

// Страховка: необработанный reject в async-роуте не должен ронять весь процесс —
// такое уже случалось (гонка на уникальном констрейнте в presentations.ts).
process.on("unhandledRejection", (err) => {
  console.error("Необработанный reject:", err);
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
