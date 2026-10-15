#!/usr/bin/env python3
"""Regenera c-rotulus-sitio.zip con los archivos desplegables del sitio."""
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'c-rotulus-sitio.zip')
# Sin carpeta raiz: al extraer en public_html, los archivos quedan ahi directamente.
PREFIX = ''

EXCLUDE_FILES = {'config.local.php'}
EXCLUDE_DIRS = {'.git', '.agent_tmp', 'preview', 'tools'}
EXCLUDE_EXT = {'.sqlite', '.log', '.zip'}


def include(path_rel):
    parts = path_rel.split(os.sep)
    if any(p in EXCLUDE_DIRS for p in parts):
        return False
    name = parts[-1]
    # Solo se omite el .gitignore raíz; los marcadores de app/data sí se incluyen.
    if name == '.gitignore' and len(parts) == 1:
        return False
    if name in EXCLUDE_FILES:
        return False
    if os.path.splitext(name)[1] in EXCLUDE_EXT:
        return False
    return True


def main():
    count = 0
    with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
        for base, dirs, files in os.walk(ROOT):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for f in files:
                full = os.path.join(base, f)
                rel = os.path.relpath(full, ROOT)
                if not include(rel):
                    continue
                z.write(full, os.path.join(PREFIX, rel))
                count += 1
    print('ZIP regenerado:', OUT, '->', count, 'archivos')


if __name__ == '__main__':
    main()
