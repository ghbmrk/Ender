# Third-party material

## Painted art models

The images in `apps/game/src/art/painted/` were generated locally (CPU, no paid service) by
`scripts/art-generate.py` from the prompts in `art/prompts.json`, then fitted by `scripts/art-ingest.py`.

| Model | Use | Licence | Revision |
|---|---|---|---|
| [segmind/Segmind-Vega](https://huggingface.co/segmind/Segmind-Vega) | text-to-image base model | Apache-2.0 | `7714c43` |
| [segmind/Segmind-VegaRT](https://huggingface.co/segmind/Segmind-VegaRT) | few-step LCM LoRA | Apache-2.0 | `3162e91` |

The model weights are not redistributed in this repository.
