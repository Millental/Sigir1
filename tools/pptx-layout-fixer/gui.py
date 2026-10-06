"""
Окно: перетащил .pptx -> получил рядом файл «..._выровнено.pptx», уже подогнанный
под наш шаблон (layout_fix.fix_presentation). Без установки Python — запускается
из собранного .exe (см. build.ps1).
"""

from __future__ import annotations

import os
import sys
import traceback
from datetime import datetime

import tkinter as tk
from tkinter import filedialog, messagebox

try:
    from tkinterdnd2 import DND_FILES, TkinterDnD
    HAS_DND = True
except ImportError:
    HAS_DND = False

from layout_fix import fix_presentation


def resource_path(relative: str) -> str:
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, relative)


TEMPLATE_PATH = resource_path("референс общей презентации.pptx")

BG = "#1c1c1f"
BG_DROP = "#2a2a30"
BG_DROP_HOVER = "#34343c"
FG = "#f2f2f2"
FG_DIM = "#9a9aa2"
ACCENT = "#5b8cff"
ERR = "#ff6b6b"
OK = "#52c97a"


class App:
    def __init__(self, root):
        self.root = root
        root.title("SIGIR — выравнивание слайдов")
        root.geometry("560x380")
        root.configure(bg=BG)
        root.minsize(480, 320)

        self.status_var = tk.StringVar(value="Перетащите сюда .pptx с присланными слайдами")
        self.detail_var = tk.StringVar(value="")

        title = tk.Label(
            root, text="Выравнивание слайдов под шаблон SIGIR",
            bg=BG, fg=FG, font=("Segoe UI", 14, "bold"),
        )
        title.pack(pady=(18, 4))

        subtitle = tk.Label(
            root,
            text="Растягивает контент каждого слайда на всю страницу и\nподбирает максимальный читаемый шрифт.",
            bg=BG, fg=FG_DIM, font=("Segoe UI", 9), justify="center",
        )
        subtitle.pack(pady=(0, 14))

        self.drop_frame = tk.Frame(root, bg=BG_DROP, highlightthickness=2,
                                    highlightbackground="#45454e", highlightcolor="#45454e")
        self.drop_frame.pack(padx=24, pady=4, fill="both", expand=True)

        self.drop_label = tk.Label(
            self.drop_frame, textvariable=self.status_var, bg=BG_DROP, fg=FG,
            font=("Segoe UI", 11), wraplength=460, justify="center",
        )
        self.drop_label.pack(expand=True, pady=(0, 6))

        self.detail_label = tk.Label(
            self.drop_frame, textvariable=self.detail_var, bg=BG_DROP, fg=FG_DIM,
            font=("Segoe UI", 9), wraplength=460, justify="center",
        )
        self.detail_label.pack(pady=(0, 18))

        browse_btn = tk.Button(
            root, text="...или выбрать файл", command=self.browse,
            bg="#2d2d34", fg=FG, activebackground="#3a3a42", activeforeground=FG,
            relief="flat", padx=12, pady=6, font=("Segoe UI", 9),
        )
        browse_btn.pack(pady=(6, 16))

        if not os.path.exists(TEMPLATE_PATH):
            self._set_status(f"Не найден файл шаблона рядом с программой:\n{TEMPLATE_PATH}", error=True)

        if HAS_DND:
            self.drop_frame.drop_target_register(DND_FILES)
            self.drop_frame.dnd_bind("<<Drop>>", self.on_drop)
            self.drop_frame.dnd_bind("<<DragEnter>>", lambda e: self.drop_frame.configure(bg=BG_DROP_HOVER))
            self.drop_frame.dnd_bind("<<DragLeave>>", lambda e: self.drop_frame.configure(bg=BG_DROP))
        else:
            self.detail_var.set("(Drag-and-drop недоступен в этой сборке — используйте кнопку выбора файла)")

    def _set_status(self, text: str, error: bool = False, ok: bool = False, detail: str = "") -> None:
        self.status_var.set(text)
        self.detail_var.set(detail)
        color = ERR if error else OK if ok else FG
        self.drop_label.configure(fg=color)

    def browse(self):
        path = filedialog.askopenfilename(
            title="Выберите .pptx",
            filetypes=[("PowerPoint", "*.pptx")],
        )
        if path:
            self.process(path)

    def on_drop(self, event):
        self.drop_frame.configure(bg=BG_DROP)
        raw = event.data
        paths = self.root.tk.splitlist(raw)
        pptx_paths = [p for p in paths if p.lower().endswith(".pptx")]
        if not pptx_paths:
            self._set_status("Это не похоже на .pptx — перетащите файл PowerPoint", error=True)
            return
        for path in pptx_paths:
            self.process(path)

    def process(self, input_path: str):
        if not os.path.exists(TEMPLATE_PATH):
            self._set_status("Нет файла шаблона рядом с программой — пересоберите .exe", error=True)
            return

        self._set_status(f"Обрабатываю: {os.path.basename(input_path)} ...")
        self.root.update_idletasks()

        folder, name = os.path.split(input_path)
        stem, _ = os.path.splitext(name)
        ts = datetime.now().strftime("%H%M%S")
        output_path = os.path.join(folder, f"{stem}_выровнено.pptx")
        if os.path.exists(output_path):
            output_path = os.path.join(folder, f"{stem}_выровнено_{ts}.pptx")

        try:
            fix_presentation(input_path, output_path, TEMPLATE_PATH)
        except Exception as exc:  # показываем пользователю, не роняем окно
            traceback.print_exc()
            self._set_status(f"Не получилось обработать {name}", error=True, detail=str(exc))
            messagebox.showerror("Ошибка", f"{name}:\n\n{exc}")
            return

        self._set_status(f"Готово: {os.path.basename(output_path)}", ok=True,
                          detail=f"Сохранено рядом с исходным файлом:\n{output_path}")


def main():
    root = TkinterDnD.Tk() if HAS_DND else tk.Tk()
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()
