"""
Окно: перетащил собранную .pptx -> рядом появляется .html-свод в стиле SIGIR,
открывается в браузере. Без установки Python — запускается из .exe (build.ps1).
"""

from __future__ import annotations

import os
import sys
import traceback
import webbrowser
from datetime import datetime

import tkinter as tk
from tkinter import filedialog, messagebox

try:
    from tkinterdnd2 import DND_FILES, TkinterDnD
    HAS_DND = True
except ImportError:
    HAS_DND = False

from convert import convert

BG = "#1c1c1f"
BG_DROP = "#2a2a30"
BG_DROP_HOVER = "#34343c"
FG = "#f2f2f2"
FG_DIM = "#9a9aa2"
OK = "#52c97a"
ERR = "#ff6b6b"


class App:
    def __init__(self, root):
        self.root = root
        root.title("SIGIR — свод недели из pptx")
        root.geometry("580x420")
        root.configure(bg=BG)
        root.minsize(480, 340)

        self.status_var = tk.StringVar(value="Перетащите сюда собранную .pptx")
        self.detail_var = tk.StringVar(value="")

        tk.Label(root, text="Свод недели SIGIR из pptx", bg=BG, fg=FG,
                 font=("Segoe UI", 14, "bold")).pack(pady=(18, 4))
        tk.Label(root, text="Собирает один HTML-отчёт в фирменном стиле из слайдов\nпо отделам. Номер недели — из имени файла, иначе спросит.",
                 bg=BG, fg=FG_DIM, font=("Segoe UI", 9), justify="center").pack(pady=(0, 14))

        self.drop_frame = tk.Frame(root, bg=BG_DROP, highlightthickness=2,
                                    highlightbackground="#45454e", highlightcolor="#45454e")
        self.drop_frame.pack(padx=24, pady=4, fill="both", expand=True)

        self.drop_label = tk.Label(self.drop_frame, textvariable=self.status_var, bg=BG_DROP, fg=FG,
                                    font=("Segoe UI", 11), wraplength=480, justify="center")
        self.drop_label.pack(expand=True, pady=(0, 6))

        self.detail_label = tk.Label(self.drop_frame, textvariable=self.detail_var, bg=BG_DROP, fg=FG_DIM,
                                      font=("Segoe UI", 9), wraplength=480, justify="center")
        self.detail_label.pack(pady=(0, 10))

        self.open_btn = tk.Button(self.drop_frame, text="Открыть в браузере", command=self.open_last,
                                   bg="#3a2260", fg="#fff", activebackground="#4d2c82", activeforeground="#fff",
                                   relief="flat", padx=12, pady=6, font=("Segoe UI", 9))
        self.last_output = None

        browse_btn = tk.Button(root, text="...или выбрать файл", command=self.browse,
                                bg="#2d2d34", fg=FG, activebackground="#3a3a42", activeforeground=FG,
                                relief="flat", padx=12, pady=6, font=("Segoe UI", 9))
        browse_btn.pack(pady=(6, 16))

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
        self.drop_label.configure(fg=ERR if error else OK if ok else FG)
        if ok and self.last_output:
            self.open_btn.pack(pady=(4, 0))
        else:
            self.open_btn.pack_forget()

    def browse(self):
        path = filedialog.askopenfilename(title="Выберите .pptx", filetypes=[("PowerPoint", "*.pptx")])
        if path:
            self.process(path)

    def on_drop(self, event):
        self.drop_frame.configure(bg=BG_DROP)
        paths = self.root.tk.splitlist(event.data)
        pptx_paths = [p for p in paths if p.lower().endswith(".pptx")]
        if not pptx_paths:
            self._set_status("Это не похоже на .pptx — перетащите файл PowerPoint", error=True)
            return
        for path in pptx_paths:
            self.process(path)

    def open_last(self):
        if self.last_output:
            webbrowser.open(f"file:///{self.last_output}")

    def process(self, input_path: str):
        self._set_status(f"Обрабатываю: {os.path.basename(input_path)} ...")
        self.root.update_idletasks()

        folder, name = os.path.split(input_path)
        stem, _ = os.path.splitext(name)
        ts = datetime.now().strftime("%H%M%S")
        output_path = os.path.join(folder, f"{stem}_свод.html")
        if os.path.exists(output_path):
            output_path = os.path.join(folder, f"{stem}_свод_{ts}.html")

        try:
            convert(input_path, output_path)
        except Exception as exc:
            traceback.print_exc()
            self._set_status(f"Не получилось обработать {name}", error=True, detail=str(exc))
            messagebox.showerror("Ошибка", f"{name}:\n\n{exc}")
            return

        self.last_output = output_path
        self._set_status(f"Готово: {os.path.basename(output_path)}", ok=True,
                          detail=f"Сохранено рядом с исходным файлом:\n{output_path}")
        webbrowser.open(f"file:///{output_path}")


def main():
    root = TkinterDnD.Tk() if HAS_DND else tk.Tk()
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()
