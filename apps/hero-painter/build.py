"""Assemble the standalone Hero Painter page: inline the engine and fonts, copy the backdrop and model files.
  python3 build.py OUT_DIR   (expects ./model from export.py and export_u2.py)
"""
import base64, os, shutil, sys
D = os.path.dirname(os.path.abspath(__file__)); OUT = sys.argv[1]
GAME = os.path.join(D, "../game/src")
page = open(f"{D}/page.src.html").read()
page = page.replace("__ENGINE__", open(f"{D}/engine.js").read().replace("export async function createPainter", "async function createPainter"))
for k, f in [("__FONT_SC700__", "AlegreyaSC-700.woff2"), ("__FONT_AT400__", "AtkinsonHyperlegible-400.woff2"), ("__FONT_AT700__", "AtkinsonHyperlegible-700.woff2")]:
  page = page.replace(k, "data:font/woff2;base64," + base64.b64encode(open(f"{GAME}/fonts/{f}", "rb").read()).decode())
os.makedirs(f"{OUT}/model", exist_ok=True)
open(f"{OUT}/index.html", "w").write(page)
shutil.copy(f"{GAME}/art/painted/bg-hollow-keep.webp", f"{OUT}/bg-hollow-keep.webp")
for f in os.listdir(f"{D}/model"):
  src, dst = f"{D}/model/{f}", f"{OUT}/model/{f}"
  if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src): shutil.copy(src, dst)
print("built", OUT)
