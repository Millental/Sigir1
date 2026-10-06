"""
Конвертер «присланная/собранная pptx-дека -> один HTML-отчёт» в утверждённой
ledger-дизайн-системе SIGIR (фиолетово-оранжевый бренд, Montserrat+Golos Text,
без карточек, тонкие линии-разделители — см. report_css.py).

Без участия LLM: детерминированный разбор геометрии/текста слайдов.
Хорошо справляется со "стандартными" слайдами отделов (два столбца:
события/планы слева, метрики/риски справа — так оформлено большинство
отделов). На слайдах с произвольной сеткой (Продажи, Подрядчики, HR, IT/IS
и т.п.) раскладка восстанавливается эвристикой по надписям-подпискам и
может быть менее аккуратной, чем ручная версия, но данные не теряются —
все текстовые блоки/таблицы/графики всё равно попадают в вывод.

CLI:
    python convert.py вход.pptx выход.html [--week NN]
"""

from __future__ import annotations

import argparse
import base64
import datetime
import html
import os
import re
import sys
from dataclasses import dataclass, field

from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

from report_css import REPORT_CSS

# ---------------------------------------------------------------------------

MONTHS_RU = {
    "января": 1, "февраля": 2, "марта": 3, "апреля": 4, "мая": 5, "июня": 6,
    "июля": 7, "августа": 8, "сентября": 9, "октября": 10, "ноября": 11, "декабря": 12,
}

LABEL_MAX_LEN = 60
RISK_RE = re.compile(r"^Риски", re.I)
VACATION_HDR_RE = re.compile(r"^Отпуск,\s*отсутств", re.I)
FOOTER_TRIPLE_RE = re.compile(r"^(Отпуск/больничн|Командировк|Найм/увольнен)", re.I)
FOOTER_BLOCK_HINTS = ("Болеет", "Увольняются", "В отпуске", "В командировке", "Еще не наняты", "Ещё не наняты")


def norm(text: str) -> str:
    return (text or "").replace("\x0b", "\n").replace("\r", "\n")


def lines_of(text: str) -> list[str]:
    return [l.strip() for l in norm(text).split("\n") if l.strip()]


def is_label(text: str) -> bool:
    ls = lines_of(text)
    if len(ls) != 1:
        return False
    line = ls[0]
    return len(line) <= LABEL_MAX_LEN and line.endswith(":")


SLUG_MAP = str.maketrans({
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh",
    "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
    "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "c",
    "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu",
    "я": "ya",
})


def slugify(text: str, fallback: str) -> str:
    s = text.lower().translate(SLUG_MAP)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or fallback


def esc(text: str) -> str:
    return html.escape(text, quote=False)


# ---------------------------------------------------------------------------
# Разбор pptx в простые структуры

@dataclass
class Shape:
    kind: str  # text | table | chart | picture
    left: int
    top: int
    width: int
    height: int
    text: str = ""
    table_rows: list[list[str]] = field(default_factory=list)
    chart_categories: list[str] = field(default_factory=list)
    chart_series: list[tuple[str, list[float]]] = field(default_factory=list)
    chart_is_line: bool = False
    image_data_uri: str | None = None

    @property
    def center_x(self) -> int:
        return self.left + self.width // 2


def extract_chart(shape) -> tuple[list[str], list[tuple[str, list[float]]], bool]:
    try:
        chart = shape.chart
    except Exception:
        return [], [], False
    cats: list[str] = []
    series: list[tuple[str, list[float]]] = []
    is_line = False
    try:
        is_line = "LINE" in str(chart.chart_type)
    except Exception:
        pass
    try:
        for plot in chart.plots:
            if not cats:
                cats = [str(c) for c in plot.categories]
            for s in plot.series:
                vals = [float(v) if v is not None else 0.0 for v in s.values]
                series.append((s.name or "", vals))
    except Exception:
        pass
    return cats, series, is_line


PICTURE_MAX_AREA_FRACTION = 0.35
COLUMN_GAP_FRACTION = 0.12


def parse_shape(sp, slide_area: int) -> Shape | None:
    try:
        left, top, width, height = int(sp.left or 0), int(sp.top or 0), int(sp.width or 0), int(sp.height or 0)
    except Exception:
        return None

    if sp.shape_type == MSO_SHAPE_TYPE.TABLE or sp.has_table:
        table = sp.table
        rows = [[cell.text.strip() for cell in row.cells] for row in table.rows]
        if not any(any(r) for r in rows):
            return None
        return Shape(kind="table", left=left, top=top, width=width, height=height, table_rows=rows)

    if getattr(sp, "has_chart", False):
        cats, series, is_line = extract_chart(sp)
        if not series:
            return None
        return Shape(kind="chart", left=left, top=top, width=width, height=height,
                     chart_categories=cats, chart_series=series, chart_is_line=is_line)

    if sp.shape_type == MSO_SHAPE_TYPE.PICTURE:
        if width * height >= PICTURE_MAX_AREA_FRACTION * slide_area:
            return None  # почти во весь слайд — декоративный фон, не контент
        try:
            image = sp.image
            b64 = base64.b64encode(image.blob).decode("ascii")
            uri = f"data:{image.content_type};base64,{b64}"
        except Exception:
            return None
        return Shape(kind="picture", left=left, top=top, width=width, height=height, image_data_uri=uri)

    if getattr(sp, "has_text_frame", False):
        text = sp.text_frame.text
        if not text or not text.strip():
            return None
        return Shape(kind="text", left=left, top=top, width=width, height=height, text=text)

    return None


def parse_slide_shapes(slide, slide_width: int, slide_height: int) -> list[Shape]:
    slide_area = slide_width * slide_height
    out = []
    for sp in slide.shapes:
        if getattr(sp, "shape_type", None) == MSO_SHAPE_TYPE.GROUP:
            for sub in sp.shapes:
                s = parse_shape(sub, slide_area)
                if s:
                    out.append(s)
            continue
        s = parse_shape(sp, slide_area)
        if s:
            out.append(s)
    return out


# ---------------------------------------------------------------------------
# Разбор департамента: заголовок, зоны по подпискам, футер

@dataclass
class Zone:
    label: str
    items: list[Shape]


@dataclass
class Department:
    title: str
    role: str
    columns: list[list[Zone]]
    footer: list[tuple[str, str]]
    empty: bool


def pick_title(shapes: list[Shape], slide_width: int, slide_height: int) -> tuple[Shape | None, str]:
    candidates = [s for s in shapes if s.kind == "text" and not is_label(s.text)]
    wide_top = [s for s in candidates if s.width >= 0.85 * slide_width and s.top <= 0.12 * slide_height]
    if wide_top:
        chosen = min(wide_top, key=lambda s: s.top)
        return chosen, " ".join(lines_of(chosen.text))
    short_top = [s for s in candidates if s.top <= 0.12 * slide_height and len(" ".join(lines_of(s.text))) <= 70]
    if short_top:
        chosen = min(short_top, key=lambda s: s.top)
        return chosen, " ".join(lines_of(chosen.text))
    return None, "Без названия"


def split_title_role(title: str) -> tuple[str, str]:
    for dash in (" – ", " — ", " - "):
        if dash in title:
            a, b = title.split(dash, 1)
            return a.strip(), b.strip()
    return title, ""


def build_department(shapes: list[Shape], slide_width: int, slide_height: int) -> Department:
    title_shape, title_text = pick_title(shapes, slide_width, slide_height)
    pool = [s for s in shapes if s is not title_shape]

    # 1) забрать явные футер-блоки: тройка Отпуск/больничный|Командировка|Найм,
    #    сводный параграф "Болеет: ... В отпуске: ...", и — ВСЕГДА — заголовок
    #    "Отпуск, отсутствия в отделе :" (он почти всегда во всю ширину слайда,
    #    поэтому не годится для разбиения на левую/правую колонку; с этого
    #    заголовка в любом случае начинается футер-зона)
    footer: list[tuple[str, str]] = []
    remaining: list[Shape] = []
    footer_tops: list[int] = []
    for s in pool:
        if s.kind != "text":
            remaining.append(s)
            continue
        ls = lines_of(s.text)
        first_line = ls[0] if ls else ""
        if FOOTER_TRIPLE_RE.match(first_line):
            rest = "\n".join(ls[1:])
            label = first_line.rstrip(":").strip()
            footer.append((label, rest or "—"))
            footer_tops.append(s.top)
            continue
        if any(h in s.text for h in FOOTER_BLOCK_HINTS) and len(ls) >= 2:
            for ln in ls:
                if ":" in ln:
                    label, _, value = ln.partition(":")
                    footer.append((label.strip(), value.strip() or "—"))
                else:
                    footer.append(("", ln.strip()))
            footer_tops.append(s.top)
            continue
        if VACATION_HDR_RE.match(first_line):
            footer_tops.append(s.top)
            continue
        remaining.append(s)

    footer_start = min(footer_tops) if footer_tops else slide_height

    # 2) всё, что физически ниже начала футер-зоны, тоже уходит в футер
    #    (отдельной заметкой, если не распозналось по шаблону выше)
    labels: list[Shape] = []
    content: list[Shape] = []
    for s in remaining:
        if s.top >= footer_start:
            txt = " / ".join(lines_of(s.text)) if s.kind == "text" else ""
            if txt:
                footer.append(("", txt))
            continue
        if s.kind == "text" and is_label(s.text):
            labels.append(s)
        else:
            content.append(s)

    if not labels:
        if not content and not footer:
            return Department(title=title_text, role="", columns=[], footer=[], empty=True)
        main, role = split_title_role(title_text)
        cols = [[Zone(label="", items=content)]] if content else []
        return Department(title=main, role=role, columns=cols, footer=footer, empty=False)

    # Кластеризуем подписи по x в произвольное число колонок (2 для
    # стандартной вёрстки событий/метрик, 3-4 для сеток вроде IT/IS), а не
    # жёстко делим на "левую"/"правую половину" — иначе колонки, начинающиеся
    # чуть раньше середины слайда, путаются с соседней, а 3-4-колоночные
    # сетки схлопываются в две и контент разных колонок перемешивается.
    gap = COLUMN_GAP_FRACTION * slide_width
    by_left = sorted(labels, key=lambda s: s.left)
    label_clusters: list[list[Shape]] = []
    for lab in by_left:
        if label_clusters and lab.left - label_clusters[-1][-1].left <= gap:
            label_clusters[-1].append(lab)
        else:
            label_clusters.append([lab])

    columns: list[list[Zone]] = []
    column_labels: list[tuple[Shape, int]] = []  # (label-shape, column-index)
    for col_idx, cluster in enumerate(label_clusters):
        cluster_sorted = sorted(cluster, key=lambda s: s.top)
        zones: list[Zone] = []
        for i, lab in enumerate(cluster_sorted):
            top = lab.top
            bottom = cluster_sorted[i + 1].top if i + 1 < len(cluster_sorted) else footer_start
            z = Zone(label=lines_of(lab.text)[0].rstrip(":"), items=[])
            z._top = top          # type: ignore[attr-defined]
            z._bottom = bottom    # type: ignore[attr-defined]
            zones.append(z)
            column_labels.append((lab, col_idx))
        columns.append(zones)

    leads: dict[int, list[Shape]] = {}

    def assign(shape: Shape):
        if not column_labels:
            return
        lab, col_idx = min(column_labels, key=lambda pair: abs(shape.left - pair[0].left))
        zones = columns[col_idx]
        for z in zones:
            if z._top <= shape.top < z._bottom:  # type: ignore[attr-defined]
                z.items.append(shape)
                return
        if shape.top < zones[0]._top:  # type: ignore[attr-defined]
            leads.setdefault(col_idx, []).append(shape)
        else:
            zones[-1].items.append(shape)

    for s in content:
        assign(s)

    for col_idx, lead_items in leads.items():
        columns[col_idx].insert(0, Zone(label="", items=lead_items))

    main, role = split_title_role(title_text)
    return Department(title=main, role=role, columns=columns, footer=footer, empty=False)


# ---------------------------------------------------------------------------
# Рендер HTML

def render_linechart(categories: list[str], values: list[float]) -> str:
    if not values:
        return ""
    w, top_pad, bottom_pad = 480.0, 20.0, 20.0
    h = 180.0
    plot_h = h - top_pad - bottom_pad
    vmin, vmax = min(values), max(values)
    if vmax == vmin:
        vmax = vmin + 1
    n = len(values)
    step = w / max(1, n - 1)
    pts = []
    for i, v in enumerate(values):
        x = i * step
        y = top_pad + plot_h - (v - vmin) / (vmax - vmin) * plot_h
        pts.append((round(x, 1), round(y, 1)))
    poly = " ".join(f"{x},{y}" for x, y in pts)
    area = poly + f" {pts[-1][0]},{h-bottom_pad} {pts[0][0]},{h-bottom_pad}"
    dots = "".join(f'<circle class="dot" cx="{x}" cy="{y}" r="4"></circle>' for x, y in pts[:-1])
    lx, ly = pts[-1]
    end_dot = f'<circle class="dot end" cx="{lx}" cy="{ly}" r="5"></circle>'
    end_label = f'<text class="end-label" x="{max(0, lx-60)}" y="{max(12, ly-9)}" text-anchor="start">{esc(str(round(values[-1], 1)))}</text>'
    labels = ""
    if categories:
        for i, c in enumerate(categories):
            x = i * step
            anchor = "start" if i == 0 else "end" if i == len(categories) - 1 else "middle"
            labels += f'<text x="{round(x,1)}" y="{h-6}" text-anchor="{anchor}">{esc(c)}</text>'
    return (
        f'<svg class="linechart" viewBox="0 0 {w:.0f} {h:.0f}" preserveAspectRatio="xMidYMid meet" style="max-width:420px">'
        f'<line class="grid-line" x1="0" y1="{top_pad:.0f}" x2="{w:.0f}" y2="{top_pad:.0f}"></line>'
        f'<line class="grid-line" x1="0" y1="{h-bottom_pad:.0f}" x2="{w:.0f}" y2="{h-bottom_pad:.0f}"></line>'
        f'<polygon class="area" points="{area}"></polygon>'
        f'<polyline class="line" points="{poly}"></polyline>'
        f"{dots}{end_dot}{end_label}{labels}"
        f"</svg>"
    )


def render_table(rows: list[list[str]]) -> str:
    if not rows:
        return ""
    head, *body = rows
    thead = "".join(f"<th>{esc(c)}</th>" for c in head)
    trs = []
    for r in body:
        tds = "".join(f'<td class="num">{esc(c)}</td>' if i > 0 else f"<td>{esc(c)}</td>" for i, c in enumerate(r))
        trs.append(f"<tr>{tds}</tr>")
    return f'<div class="tbl-wrap"><table class="tbl"><thead><tr>{thead}</tr></thead><tbody>{"".join(trs)}</tbody></table></div>'


def render_shape_content(s: Shape) -> str:
    if s.kind == "text":
        ls = lines_of(s.text)
        if len(ls) > 1:
            items = "".join(f"<li>{esc(l)}</li>" for l in ls)
            return f'<ul class="bullets">{items}</ul>'
        return f'<p class="plain-p">{esc(ls[0])}</p>' if ls else ""
    if s.kind == "table":
        return render_table(s.table_rows)
    if s.kind == "chart":
        if s.chart_is_line and s.chart_series:
            name, vals = s.chart_series[0]
            chart_html = render_linechart(s.chart_categories, vals)
            cap = f'<p class="tbl-caption">{esc(name)}</p>' if name else ""
            return f'<div class="block chart-card">{cap}{chart_html}</div>'
        rows = [["Период", *s.chart_categories]]
        for name, vals in s.chart_series:
            rows.append([name or "—", *[str(round(v, 1) if v % 1 else int(v)) for v in vals]])
        return render_table(rows)
    if s.kind == "picture":
        return f'<div class="block"><img src="{s.image_data_uri}" alt=""></div>'
    return ""


def render_zone(z: Zone, is_risk: bool = False) -> str:
    body = "".join(render_shape_content(s) for s in z.items)
    if not body.strip():
        return ""
    if is_risk:
        texts = []
        for s in z.items:
            if s.kind == "text":
                texts.extend(lines_of(s.text))
        if texts:
            return f'<div class="block"><p class="risk">{esc(" · ".join(texts))}</p></div>'
        return f'<div class="block">{body}</div>'
    title = f'<p class="block-title">{esc(z.label)}</p>' if z.label else ""
    return f'<div class="block">{title}{body}</div>'


def render_footer(footer: list[tuple[str, str]]) -> str:
    if not footer:
        return ""
    parts = []
    for label, value in footer:
        if not label and value:
            parts.append(f'<p class="dept-footer-note">{esc(value)}</p>')
            continue
        if value and len(value) <= 20 and "\n" not in value:
            parts.append(f'<div class="dept-footer-stat"><p class="dt">{esc(label)}</p><p class="dd">{esc(value)}</p></div>')
        else:
            note = f"<b>{esc(label)}</b> — {esc(value)}" if value and value != "—" else esc(label)
            parts.append(f'<p class="dept-footer-note">{note}</p>')
    return (
        '<div class="dept-footer"><p class="dept-footer-label">Отдел</p>'
        f'<div class="dept-footer-row">{"".join(parts)}</div></div>'
    )


def render_department(dept: Department, anchor_id: str) -> str:
    if dept.empty:
        return (
            f'<div class="divider-dept" id="{anchor_id}">'
            f"<h3>{esc(dept.title)}</h3>"
            '<span class="tag-empty">Без письменного отчёта на этой неделе</span></div>'
        )

    role_html = f'<p class="role">{esc(dept.role)}</p>' if dept.role else ""

    col_htmls = []
    for zones in dept.columns:
        html_part = "".join(render_zone(z, is_risk=RISK_RE.match(z.label or "") is not None) for z in zones)
        if html_part:
            col_htmls.append(html_part)

    if len(col_htmls) == 0:
        body = ""
    elif len(col_htmls) == 1:
        body = col_htmls[0]
    elif len(col_htmls) == 2:
        body = f'<div class="row2"><div>{col_htmls[0]}</div><div>{col_htmls[1]}</div></div>'
    else:
        inner = "".join(f"<div>{c}</div>" for c in col_htmls)
        body = f'<div class="cols3" style="--cols:{len(col_htmls)}">{inner}</div>'

    footer_html = render_footer(dept.footer)
    if not body.strip() and not footer_html:
        return (
            f'<div class="divider-dept" id="{anchor_id}">'
            f"<h3>{esc(dept.title)}</h3>"
            '<span class="tag-empty">Без письменного отчёта на этой неделе</span></div>'
        )

    return (
        f'<section class="dept" id="{anchor_id}">'
        f'<div class="dept-head"><h2>{esc(dept.title)}</h2>{role_html}</div>'
        f"{body}{footer_html}</section>"
    )


# ---------------------------------------------------------------------------
# Титульный слайд: дата / период / номер недели

def parse_title_slide(slide, slide_width: int, slide_height: int) -> datetime.date | None:
    for sp in parse_slide_shapes(slide, slide_width, slide_height):
        if sp.kind != "text":
            continue
        for line in lines_of(sp.text):
            m = re.match(r"(\d{1,2})\s+([а-яё]+)\s+(\d{4})", line, re.I)
            if m:
                day, month_name, year = m.groups()
                month = MONTHS_RU.get(month_name.lower())
                if month:
                    try:
                        return datetime.date(int(year), month, int(day))
                    except ValueError:
                        pass
    return None


def week_number_from_filename(path: str) -> str | None:
    base = os.path.splitext(os.path.basename(path))[0]
    nums = re.findall(r"\d+", base)
    return nums[-1] if nums else None


RU_MONTHS_GEN = ["", "января", "февраля", "марта", "апреля", "мая", "июня",
                 "июля", "августа", "сентября", "октября", "ноября", "декабря"]


def fmt_date(d: datetime.date) -> str:
    return f"{d.day} {RU_MONTHS_GEN[d.month]} {d.year} г"


def fmt_period(start: datetime.date, end: datetime.date) -> str:
    if start.month == end.month:
        return f"{start.day}–{end.day} {RU_MONTHS_GEN[end.month]} {end.year}"
    return f"{start.day} {RU_MONTHS_GEN[start.month]} – {end.day} {RU_MONTHS_GEN[end.month]} {end.year}"


# ---------------------------------------------------------------------------

def convert(input_path: str, output_path: str, week_override: str | None = None) -> None:
    prs = Presentation(input_path)
    slides = list(prs.slides)
    slide_w, slide_h = prs.slide_width, prs.slide_height

    meeting_date = parse_title_slide(slides[0], slide_w, slide_h) if slides else None
    week = week_override or week_number_from_filename(input_path) or "—"

    dept_sections = []
    seen_ids: set[str] = set()
    non_empty = 0

    for idx, slide in enumerate(slides[1:], start=1):
        shapes = parse_slide_shapes(slide, slide_w, slide_h)
        if not shapes:
            continue
        dept = build_department(shapes, slide_w, slide_h)
        base_id = slugify(dept.title, f"dept-{idx}")
        anchor_id = base_id
        n = 2
        while anchor_id in seen_ids:
            anchor_id = f"{base_id}-{n}"
            n += 1
        seen_ids.add(anchor_id)
        if not dept.empty:
            non_empty += 1
        dept_sections.append((anchor_id, dept))

    nav = "".join(f'<a class="nav-link" href="#{aid}">{esc(d.title)}</a>' for aid, d in dept_sections)
    body = "".join(render_department(d, aid) for aid, d in dept_sections)

    if meeting_date:
        period_end = meeting_date - datetime.timedelta(days=1)
        period_start = period_end - datetime.timedelta(days=6)
        meta = (
            f'<span><b>{esc(fmt_period(period_start, period_end))}</b> — отчётный период</span>'
            f'<span>Собрание <b>{esc(fmt_date(meeting_date))}</b></span>'
        )
    else:
        meta = ""
    meta += f'<span>Свод по <b>{non_empty}</b> подразделениям</span>'

    title_tag = f"Свод недели SIGIR · {esc(week)}"

    html_out = f"""<!doctype html><html lang="ru"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title_tag}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=Golos+Text:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>{REPORT_CSS}</style>
</head><body>
<header class="masthead"><div class="wrap">
  <p class="eyebrow">Еженедельное собрание · <span class="brand-mark">SIGIR</span></p>
  <h1>Неделя {esc(week)}</h1>
  <div class="masthead-meta">{meta}</div>
  <div class="masthead-rule"></div>
</div></header>
<nav class="subnav" aria-label="Разделы свода"><div class="wrap" id="subnavWrap">{nav}</div></nav>
<main class="wrap">{body}</main>
<footer><div class="wrap">
  <p class="wordmark">SIGIR</p>
  <p>Свод еженедельного собрания · неделя {esc(week)} · автособрано из «{esc(os.path.basename(input_path))}».</p>
</div></footer>
<script>
(function(){{
  var els = document.querySelectorAll('#subnavWrap, .tbl-wrap');
  els.forEach(function(el){{
    el.addEventListener('wheel', function(e){{
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }}, {{passive:false}});
  }});
}})();
</script>
</body></html>"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_out)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--week")
    args = ap.parse_args(argv)
    convert(args.input, args.output, args.week)
    print(f"Готово: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
