// Хранилище — обычный JSON-файл, не SQL-база. Объём данных тривиален (конфиг
// отделов + несколько строк значений на неделю), а native-зависимости вроде
// better-sqlite3 требуют компиляции (node-gyp/Visual Studio) — ненадёжно для
// переноса на прод-сервер. Один файл, синхронное чтение/запись, тривиальный бэкап
// (просто скопировать файл).

import fs from "node:fs";
import path from "node:path";

const DATA_PATH = process.env.DATA_PATH || path.join(process.cwd(), "data.json");

type DeptRecord = { name: string; token: string; editable: boolean };
type WeekDeptRecord = { status: string; values: any; updatedAt: string };

type Store = {
  departments: Record<string, DeptRecord>;
  weeks: Record<string, Record<string, WeekDeptRecord>>;
};

function load(): Store {
  if (!fs.existsSync(DATA_PATH)) return { departments: {}, weeks: {} };
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function save(store: Store): void {
  fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2), "utf8");
}

export function upsertDepartmentIfMissing(id: string, name: string, token: string, editable: boolean): void {
  const store = load();
  if (store.departments[id]) return; // не перевыпускаем токен при повторном seed
  store.departments[id] = { name, token, editable };
  save(store);
}

export function findDepartmentByToken(token: string): (DeptRecord & { id: string }) | undefined {
  const store = load();
  const id = Object.keys(store.departments).find((k) => store.departments[k].token === token);
  if (!id) return undefined;
  return { id, ...store.departments[id] };
}

export function getDepartmentById(id: string): DeptRecord | undefined {
  const store = load();
  return store.departments[id];
}

export function getWeekDepartment(weekId: string, deptId: string): { status: string; values: any } | undefined {
  const store = load();
  const row = store.weeks[weekId]?.[deptId];
  if (!row) return undefined;
  return { status: row.status, values: row.values };
}

export function saveWeekDepartment(weekId: string, deptId: string, status: string, values: any): void {
  const store = load();
  if (!store.weeks[weekId]) store.weeks[weekId] = {};
  store.weeks[weekId][deptId] = { status, values, updatedAt: new Date().toISOString() };
  save(store);
}
