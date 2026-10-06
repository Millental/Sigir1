"""
Приводит присланную pptx-деку (слайды отделов для еженедельного собрания) к виду,
где контент каждого слайда занимает максимум пространства страницы: без больших
пустых полей по бокам и с максимально крупным (но влезающим) шрифтом.

Не переодевает слайды в чужой дизайн/тему — только чинит геометрию (растягивает
блоки на свободное место, сохраняя их взаимное расположение) и шрифт (подбирает
наибольший кегль, который помещается в получившийся блок).

Используется и как библиотека (fix_presentation), и как CLI:
    python layout_fix.py вход.pptx выход.pptx [шаблон.pptx]
"""

from __future__ import annotations

import copy
import os
import sys
from dataclasses import dataclass

from pptx import Presentation
from pptx.util import Emu, Pt
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.enum.text import MSO_AUTO_SIZE, MSO_ANCHOR

try:
    from PIL import ImageFont
except ImportError:  # на случай сборки без Pillow — тогда работаем без точного подбора шрифта
    ImageFont = None


# ---------------------------------------------------------------------------
# Константы вёрстки

EMU_PER_INCH = 914400
DPI = 96.0  # условная плотность для оценки ширины текста — важна только относительно

TITLE_BAND_FRACTION = 0.09   # доля высоты слайда, которая считается "шапкой" (не трогаем)
SIDE_MARGIN_IN = 0.12
BOTTOM_MARGIN_IN = 0.12
TOP_GAP_IN = 0.06            # отступ между шапкой и контентом

MIN_SCALE = 0.55             # не сжимаем контент больше чем в ~2 раза
MAX_SCALE = 2.6              # и не растягиваем больше чем в ~2.6 раза (иначе бред)
FILL_SKIP_THRESHOLD = 0.94   # если контент и так занимает >=94% целевой area — не трогаем

MAX_FONT_PT = 32
MIN_FONT_PT = 8
LINE_HEIGHT_FACTOR = 1.15
PARA_SPACING_FACTOR = 0.25   # дополнительный зазор между абзацами, в размерах шрифта

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\calibri.ttf",
    r"C:\Windows\Fonts\arial.ttf",
    r"C:\Windows\Fonts\segoeui.ttf",
]


def _load_measuring_font():
    if ImageFont is None:
        return None
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return path
    return None


_FONT_PATH = _load_measuring_font()
_FONT_CACHE: dict[int, "ImageFont.FreeTypeFont"] = {}


def _font_at(size_pt: float):
    if _FONT_PATH is None:
        return None
    size_px = max(1, round(size_pt * DPI / 72.0))
    cached = _FONT_CACHE.get(size_px)
    if cached is None:
        cached = ImageFont.truetype(_FONT_PATH, size=size_px)
        _FONT_CACHE[size_px] = cached
    return cached


def _text_width_px(text: str, size_pt: float) -> float:
    font = _font_at(size_pt)
    if font is None:
        # грубая оценка без PIL: ~0.55 ширины кегля на символ
        return len(text) * size_pt * DPI / 72.0 * 0.55
    return font.getlength(text) if text else 0.0


def _wrapped_line_count(text: str, size_pt: float, width_px: float) -> int:
    if not text:
        return 1
    if width_px <= 1:
        return 1
    lines = 0
    for raw_line in text.split("\n"):
        words = raw_line.split(" ")
        if not words:
            lines += 1
            continue
        cur = ""
        line_count_here = 0
        for w in words:
            candidate = (cur + " " + w).strip() if cur else w
            if _text_width_px(candidate, size_pt) <= width_px or not cur:
                cur = candidate
            else:
                line_count_here += 1
                cur = w
        line_count_here += 1  # последняя строка абзаца
        lines += max(1, line_count_here)
    return max(1, lines)


# ---------------------------------------------------------------------------
# Геометрия

@dataclass
class Rect:
    left: int
    top: int
    width: int
    height: int

    @property
    def right(self) -> int:
        return self.left + self.width

    @property
    def bottom(self) -> int:
        return self.top + self.height


def _is_title_shape(shape, slide_height: int) -> bool:
    title_band_h = slide_height * TITLE_BAND_FRACTION
    try:
        top = shape.top or 0
        height = shape.height or 0
    except Exception:
        return False
    # шапка — то, что целиком лежит в пределах верхней полосы слайда
    return top < title_band_h and (top + height) <= title_band_h * 1.6


def _shape_rect(shape) -> Rect | None:
    try:
        if shape.left is None or shape.top is None:
            return None
        return Rect(int(shape.left), int(shape.top), int(shape.width or 0), int(shape.height or 0))
    except Exception:
        return None


def _content_bbox(shapes) -> Rect | None:
    rects = [r for r in (_shape_rect(s) for s in shapes) if r is not None and r.width > 0 and r.height > 0]
    if not rects:
        return None
    left = min(r.left for r in rects)
    top = min(r.top for r in rects)
    right = max(r.right for r in rects)
    bottom = max(r.bottom for r in rects)
    return Rect(left, top, right - left, bottom - top)


# ---------------------------------------------------------------------------
# Текст: подбор максимального кегля под новый размер блока

def _effective_margins(text_frame) -> tuple[int, int, int, int]:
    default = int(0.1 * EMU_PER_INCH)
    default_tb = int(0.05 * EMU_PER_INCH)
    l = text_frame.margin_left if text_frame.margin_left is not None else default
    r = text_frame.margin_right if text_frame.margin_right is not None else default
    t = text_frame.margin_top if text_frame.margin_top is not None else default_tb
    b = text_frame.margin_bottom if text_frame.margin_bottom is not None else default_tb
    return l, r, t, b


def _best_fit_font_size(text_frame, box_width_emu: int, box_height_emu: int) -> float | None:
    l, r, t, b = _effective_margins(text_frame)
    avail_w_in = max(0.1, (box_width_emu - l - r) / EMU_PER_INCH)
    avail_h_in = max(0.1, (box_height_emu - t - b) / EMU_PER_INCH)
    width_px = avail_w_in * DPI
    height_px = avail_h_in * DPI

    paragraphs = [p.text for p in text_frame.paragraphs]
    full_text = "\n".join(paragraphs)
    if not full_text.strip():
        return None

    for size in range(MAX_FONT_PT, MIN_FONT_PT - 1, -1):
        total_lines = 0
        for para_text in paragraphs:
            total_lines += _wrapped_line_count(para_text, size, width_px)
        n_paras = max(1, len(paragraphs))
        total_height_px = total_lines * size * DPI / 72.0 * LINE_HEIGHT_FACTOR
        total_height_px += (n_paras - 1) * size * DPI / 72.0 * PARA_SPACING_FACTOR
        if total_height_px <= height_px:
            return float(size)
    return float(MIN_FONT_PT)


def _apply_font_size(text_frame, size_pt: float) -> None:
    size = Pt(size_pt)
    for paragraph in text_frame.paragraphs:
        if paragraph.runs:
            for run in paragraph.runs:
                run.font.size = size
        else:
            # пустой абзац без runs — задаём размер через paragraph_format по умолчанию недоступно
            # в python-pptx напрямую; пропускаем, высота пустой строки некритична.
            pass
    text_frame.word_wrap = True
    try:
        text_frame.auto_size = MSO_AUTO_SIZE.NONE
    except Exception:
        pass
    try:
        text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    except Exception:
        pass


def _refit_text(shape) -> None:
    if not shape.has_text_frame:
        return
    tf = shape.text_frame
    if not tf.text.strip():
        return
    size = _best_fit_font_size(tf, shape.width, shape.height)
    if size is not None:
        _apply_font_size(tf, size)


# ---------------------------------------------------------------------------
# Таблицы: пропорционально растягиваем колонки/строки вместе с рамкой

def _rescale_table(shape, scale_x: float, scale_y: float) -> None:
    if shape.shape_type != MSO_SHAPE_TYPE.TABLE:
        return
    table = shape.table
    for col in table.columns:
        col.width = Emu(int(col.width * scale_x))
    for row in table.rows:
        row.height = Emu(int(row.height * scale_y))


# ---------------------------------------------------------------------------
# Основной проход по слайду

def _fix_slide(slide, slide_width: int, slide_height: int) -> None:
    all_shapes = list(slide.shapes)
    if not all_shapes:
        return

    title_shapes = [s for s in all_shapes if _is_title_shape(s, slide_height)]
    content_shapes = [s for s in all_shapes if s not in title_shapes]
    if not content_shapes:
        return

    title_bottom = max((_shape_rect(s).bottom for s in title_shapes if _shape_rect(s)), default=0)

    target_left = int(SIDE_MARGIN_IN * EMU_PER_INCH)
    target_top = max(int((TITLE_BAND_FRACTION) * 0), title_bottom + int(TOP_GAP_IN * EMU_PER_INCH))
    if title_bottom == 0:
        target_top = int(SIDE_MARGIN_IN * EMU_PER_INCH)
    target_right = slide_width - int(SIDE_MARGIN_IN * EMU_PER_INCH)
    target_bottom = slide_height - int(BOTTOM_MARGIN_IN * EMU_PER_INCH)
    target_w = max(1, target_right - target_left)
    target_h = max(1, target_bottom - target_top)

    bbox = _content_bbox(content_shapes)
    if bbox is None or bbox.width <= 0 or bbox.height <= 0:
        return

    fill_ratio = (bbox.width / target_w) * (bbox.height / target_h)
    if fill_ratio >= FILL_SKIP_THRESHOLD and bbox.width <= target_w and bbox.height <= target_h:
        return  # уже хорошо заполняет страницу — не трогаем

    scale_x = target_w / bbox.width
    scale_y = target_h / bbox.height
    scale_x = max(MIN_SCALE, min(MAX_SCALE, scale_x))
    scale_y = max(MIN_SCALE, min(MAX_SCALE, scale_y))

    for shape in content_shapes:
        rect = _shape_rect(shape)
        if rect is None:
            continue
        new_left = target_left + round((rect.left - bbox.left) * scale_x)
        new_top = target_top + round((rect.top - bbox.top) * scale_y)
        new_width = max(1, round(rect.width * scale_x))
        new_height = max(1, round(rect.height * scale_y))

        try:
            shape.left = Emu(new_left)
            shape.top = Emu(new_top)
            shape.width = Emu(new_width)
            shape.height = Emu(new_height)
        except Exception:
            continue

        if shape.shape_type == MSO_SHAPE_TYPE.TABLE:
            _rescale_table(shape, scale_x, scale_y)

        if getattr(shape, "has_text_frame", False):
            _refit_text(shape)


def _rescale_whole_deck_if_needed(prs: Presentation, target_w: int, target_h: int) -> None:
    if prs.slide_width == target_w and prs.slide_height == target_h:
        return
    sx = target_w / prs.slide_width
    sy = target_h / prs.slide_height
    for slide in prs.slides:
        for shape in slide.shapes:
            rect = _shape_rect(shape)
            if rect is None:
                continue
            try:
                shape.left = Emu(round(rect.left * sx))
                shape.top = Emu(round(rect.top * sy))
                shape.width = Emu(round(rect.width * sx))
                shape.height = Emu(round(rect.height * sy))
            except Exception:
                continue
    prs.slide_width = Emu(target_w)
    prs.slide_height = Emu(target_h)


def fix_presentation(input_path: str, output_path: str, template_path: str | None = None) -> None:
    prs = Presentation(input_path)

    if template_path and os.path.exists(template_path):
        tpl = Presentation(template_path)
        _rescale_whole_deck_if_needed(prs, tpl.slide_width, tpl.slide_height)

    slide_w, slide_h = prs.slide_width, prs.slide_height
    for slide in prs.slides:
        _fix_slide(slide, slide_w, slide_h)

    prs.save(output_path)


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("Использование: python layout_fix.py вход.pptx выход.pptx [шаблон.pptx]")
        return 1
    input_path = argv[0]
    output_path = argv[1]
    template_path = argv[2] if len(argv) > 2 else None
    fix_presentation(input_path, output_path, template_path)
    print(f"Готово: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
