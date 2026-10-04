// Разовый скрипт: создаёт по токену на каждый отдел (если его ещё нет — повторный
// запуск НЕ перевыпускает токены, чтобы не ломать уже разосланные ссылки) и печатает
// готовые ссылки на редактирование. Запуск: npm run seed (из server/).

import "dotenv/config";
import crypto from "node:crypto";
import { upsertDepartmentIfMissing, getDepartmentById } from "./db.js";
import { DEPARTMENTS, EDITABLE_IDS } from "./render.js";

const BASE_URL = process.env.BASE_URL || "http://localhost:4100";

for (const dept of DEPARTMENTS) {
  const editable = EDITABLE_IDS.includes(dept.id);
  const token = crypto.randomBytes(24).toString("hex");
  upsertDepartmentIfMissing(dept.id, dept.name, token, editable);
}

console.log("Ссылки для редактирования (повторный запуск seed их не меняет):\n");
for (const dept of DEPARTMENTS) {
  if (!EDITABLE_IDS.includes(dept.id)) continue;
  const saved = getDepartmentById(dept.id)!;
  console.log(`${dept.name.padEnd(30)} ${BASE_URL}/edit/${saved.token}`);
}

console.log("\nОстальные отделы тоже получили токен (задел на Этап 3), но формы для них пока нет.");
