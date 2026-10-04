import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findDepartmentByToken, getWeekDepartment, saveWeekDepartment } from "./db.js";
import {
  DEPARTMENTS, WEEK, WEEK_ID, EDITABLE_IDS,
  renderPageHtml, renderEditFormHtml, renderNotFoundHtml, renderComingSoonHtml,
  mergeOverlay,
} from "./render.js";
import { defaultWeekRecord, applyFields, applyFooter } from "./fields.js";

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
  const rec = getWeekDepartment(WEEK_ID, dept.id) || defaultWeekRecord(template);
  res.type("html").send(renderEditFormHtml(template, rec, req.query.saved === "1"));
});

app.post("/edit/:token", (req, res) => {
  const dept = findDepartmentByToken(req.params.token);
  if (!dept || !dept.editable) return res.status(404).type("html").send(renderNotFoundHtml());

  const template = DEPARTMENTS.find((d) => d.id === dept.id)!;
  const current = getWeekDepartment(WEEK_ID, dept.id) || defaultWeekRecord(template);
  const { body, extra } = applyFields(current, req.body);
  const footer = applyFooter(current.footer, req.body);

  saveWeekDepartment(WEEK_ID, dept.id, {
    status: req.body.status === "no_report" ? "no_report" : "reported",
    role: req.body.role || current.role,
    body,
    extra,
    footer,
  });

  res.redirect(`/edit/${req.params.token}?saved=1`);
});

const PORT = Number(process.env.PORT) || 4100;
app.listen(PORT, () => {
  console.log(`weekly-report listening on :${PORT}`);
});
