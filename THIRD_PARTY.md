# Third-party material

## Painted art models

The images in `apps/game/src/art/painted/` were generated locally (CPU, no paid service) by
`scripts/art-generate.py` from the prompts in `art/prompts.json`, then fitted by `scripts/art-ingest.py`.

| Model | Use | Licence | Revision |
|---|---|---|---|
| [segmind/Segmind-Vega](https://huggingface.co/segmind/Segmind-Vega) | text-to-image base model | Apache-2.0 | `7714c43` |
| [segmind/Segmind-VegaRT](https://huggingface.co/segmind/Segmind-VegaRT) | few-step LCM LoRA | Apache-2.0 | `3162e91` |

The model weights are not redistributed in this repository.

## Hero Painter models

`apps/hero-painter/` paints the hero in the player's browser. Its export scripts fetch these models; the
quantised weights are published with the page and are not committed here.

| Model | Use | Licence |
|---|---|---|
| [IDKiro/sdxs-512-dreamshaper](https://huggingface.co/IDKiro/sdxs-512-dreamshaper) | one-step text-to-image UNet, CLIP text encoder (export time only) | OpenRAIL++ |
| [madebyollin/taesd](https://huggingface.co/madebyollin/taesd) (bundled with SDXS) | tiny image decoder | MIT |
| [U-2-Net p](https://github.com/xuebinqin/U-2-Net) via [rembg](https://github.com/danielgatis/rembg/releases/tag/v0.0.0) | hero cutout matte | Apache-2.0 |
