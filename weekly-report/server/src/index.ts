import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findDepartmentByToken, getWeekDepartment, saveWeekDepartment } from "./db.js";
import {
  DEPARTMENTS, WEEK, WEEK_ID, EDITABLE_IDS,
  renderPageHtml, renderEditFormHtml, renderNotFoundHtml, renderComingSoonHtml,
  mergeOverlay, defaultValuesFor,
} from "./render.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.disable("x-powered-by");
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (_req, res) => {
  const departments = DEPARTMENTS.map((d) =>
    EDITABLE_IDS.includes(d.id) ? mergeOverlay(d, getWeekDepartment(WEEK_ID, d.id)) : d
  );
  res.type("html").send(renderPageHtml(WEEK, departments));
});

app.get("/edit/:token", (req, res) => {
  const dept = findDepartmentByToken(req.params.token);
  if (!dept) return res.status(404).type("html").send(renderNotFoundHtml());
  if (!dept.editable) return res.type("html").send(renderComingSoonHtml(dept.name));

  const template = DEPARTMENTS.find((d) => d.id === dept.id)!;
  const overlay = getWeekDepartment(WEEK_ID, dept.id);
  const status = overlay?.status || template.status;
  const values = overlay?.values || defaultValuesFor(template);
  res.type("html").send(renderEditFormHtml(template, status, values, req.query.saved === "1"));
});

app.post("/edit/:token", (req, res) => {
  const dept = findDepartmentByToken(req.params.token);
  if (!dept || !dept.editable) return res.status(404).type("html").send(renderNotFoundHtml());

  const status = req.body.status === "no_report" ? "no_report" : "reported";
  const values: any = {
    events: String(req.body.events || "").split("\n").map((s: string) => s.trim()).filter(Boolean),
    plans: String(req.body.plans || "").split("\n").map((s: string) => s.trim()).filter(Boolean),
  };
  if (dept.id === "engineering") {
    values.meters = [
      { label: "СЛ", num: Number(req.body.sl_num) || 0, den: Number(req.body.sl_den) || 1 },
      { label: "СТ", num: Number(req.body.st_num) || 0, den: Number(req.body.st_den) || 1 },
    ];
  }

  saveWeekDepartment(WEEK_ID, dept.id, status, values);
  res.redirect(`/edit/${req.params.token}?saved=1`);
});

const PORT = Number(process.env.PORT) || 4100;
app.listen(PORT, () => {
  console.log(`weekly-report listening on :${PORT}`);
});
