#!/usr/bin/env python3
"""Genera capturas de vista previa (portada, empresa y movil) con Playwright.

Usa el Chromium del sistema. Guarda en preview/ a altura real completa.
"""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:12000"
OUT = "preview"
JOBS = [
    ("index-full.png", "index.html", 1440, 1000),
    ("empresa-full.png", "empresa.html", 1440, 1000),
    ("index-movil.png", "index.html", 390, 844),
]


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/chromium",
            args=["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
        )
        for name, page_path, w, h in JOBS:
            ctx = browser.new_context(
                viewport={"width": w, "height": h},
                device_scale_factor=1,
                reduced_motion="reduce",
            )
            page = ctx.new_page()
            page.goto(f"{BASE}/{page_path}", wait_until="networkidle")
            page.wait_for_timeout(1200)
            page.evaluate(
                """() => {
                    document.querySelectorAll('.reveal').forEach(e => e.classList.add('is-visible'));
                    document.documentElement.classList.remove('has-reveal-anim');
                }"""
            )
            page.wait_for_timeout(300)
            page.screenshot(path=f"{OUT}/{name}", full_page=True)
            print("guardado", name, "->", page.evaluate("document.body.scrollHeight"), "px")
            ctx.close()
        browser.close()


if __name__ == "__main__":
    sys.exit(main())
