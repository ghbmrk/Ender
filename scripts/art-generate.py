"""Render Ender's painted art from art/prompts.json with a free open-weight image model, on this machine's CPU.

    python3 scripts/art-generate.py                  # every asset that has no art/raw/<id>.png yet
    python3 scripts/art-generate.py warden bg-throne # just these
    python3 scripts/art-generate.py --force --variants 3 warden   # re-roll: warden.png, warden.v2.png, warden.v3.png

No paid inference: the default model is Segmind Vega (Apache-2.0) with the Segmind VegaRT few-step LoRA,
downloaded once from huggingface.co. Seeds come from the asset id, so a run is repeatable.
Outputs go to art/raw/; then run scripts/art-ingest.py to fit them to the game.
"""

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROMPTS = ROOT / "art" / "prompts.json"
RAW = ROOT / "art" / "raw"

# Width x height per kind (SDXL-family buckets).
SIZE = {"figure": (832, 1216), "backdrop": (768, 1344), "cardart": (1024, 1024), "texture": (768, 768)}


def seed_of(asset_id: str, variant: int) -> int:
    return int(hashlib.sha256(f"{asset_id}#{variant}".encode()).hexdigest()[:8], 16)


def full_prompt(style: dict, asset: dict) -> str:
    kind = style[asset["kind"]].replace("{screen}", asset.get("screen", "bright green"))
    return ", ".join([kind, asset["prompt"], style["base"]])


def encode_long(pipe, prompt: str, negative: str):
    """SDXL prompt embeddings without CLIP's 77-token cut: encode 75-token chunks with both text encoders and
    concatenate them, so the style and framing text after a long subject prompt still reaches the model."""
    import torch

    def ids(tok, text):
        return tok(text, truncation=False, add_special_tokens=False).input_ids

    n = max(1, *[-(-len(ids(t, x)) // 75) for t in (pipe.tokenizer, pipe.tokenizer_2) for x in (prompt, negative)])
    result = []
    for text in (prompt, negative):
        per_encoder, pooled = [], None
        for tok, enc in ((pipe.tokenizer, pipe.text_encoder), (pipe.tokenizer_2, pipe.text_encoder_2)):
            toks = ids(tok, text)
            states = []
            for i in range(n):
                chunk = [tok.bos_token_id] + toks[i * 75 : (i + 1) * 75] + [tok.eos_token_id]
                chunk += [tok.pad_token_id] * (77 - len(chunk))
                with torch.no_grad():
                    out = enc(torch.tensor([chunk]), output_hidden_states=True)
                states.append(out.hidden_states[-2])
                if enc is pipe.text_encoder_2 and pooled is None:
                    pooled = out[0]
            per_encoder.append(torch.cat(states, dim=1))
        result.append((torch.cat(per_encoder, dim=-1), pooled))
    (pe, pp), (ne, np_) = result
    return dict(prompt_embeds=pe, pooled_prompt_embeds=pp, negative_prompt_embeds=ne, negative_pooled_prompt_embeds=np_)


def load_pipeline(model: str, lora: str | None, steps: int):
    import torch
    from diffusers import AutoPipelineForText2Image, LCMScheduler

    torch.set_num_threads(max(1, torch.get_num_threads()))
    pipe = AutoPipelineForText2Image.from_pretrained(model, torch_dtype=torch.float32)
    if lora:
        pipe.load_lora_weights(lora)
        pipe.fuse_lora()
        pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
    pipe.set_progress_bar_config(disable=True)
    return pipe


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*", help="asset ids (default: all missing)")
    ap.add_argument("--model", default="segmind/Segmind-Vega")
    ap.add_argument("--lora", default="segmind/Segmind-VegaRT", help="few-step LoRA; pass '' to disable")
    ap.add_argument("--steps", type=int, default=6)
    ap.add_argument("--guidance", type=float, default=1.5)
    ap.add_argument("--variants", type=int, default=1)
    ap.add_argument("--force", action="store_true", help="re-render even if the raw image exists")
    ap.add_argument("--dry-run", action="store_true", help="print the prompts only")
    a = ap.parse_args()

    spec = json.loads(PROMPTS.read_text())
    style, assets = spec["style"], spec["assets"]
    unknown = set(a.ids) - {x["id"] for x in assets}
    if unknown:
        sys.exit(f"unknown asset ids: {', '.join(sorted(unknown))}")
    todo = [x for x in assets if (not a.ids or x["id"] in a.ids)]
    RAW.mkdir(parents=True, exist_ok=True)

    jobs = []
    for asset in todo:
        for v in range(1, a.variants + 1):
            out = RAW / (f"{asset['id']}.png" if v == 1 else f"{asset['id']}.v{v}.png")
            if out.exists() and not a.force:
                continue
            jobs.append((asset, v, out))
    if a.dry_run:
        for asset, v, out in jobs:
            print(f"{out.name}: {full_prompt(style, asset)}\n  negative: {style['negative']}\n")
        return
    if not jobs:
        print("nothing to render (use --force to re-roll)")
        return

    import torch

    pipe = load_pipeline(a.model, a.lora or None, a.steps)
    for i, (asset, v, out) in enumerate(jobs, 1):
        w, h = SIZE[asset["kind"]]
        t = time.time()
        img = pipe(
            **encode_long(pipe, full_prompt(style, asset), style["negative"]),
            width=w,
            height=h,
            num_inference_steps=a.steps,
            guidance_scale=a.guidance,
            generator=torch.Generator().manual_seed(seed_of(asset["id"], v)),
        ).images[0]
        img.save(out)
        print(f"[{i}/{len(jobs)}] {out.name} {w}x{h} in {time.time() - t:.0f}s", flush=True)


if __name__ == "__main__":
    main()
