"""Export SDXS-512-DreamShaper for the in-browser WebGPU engine.

Writes model/manifest.json plus weight chunks (<=14 MB each):
  - UNet weights (except the time-embedding path) as 5-bit codes, one (min, scale) pair per 128 weights
  - small tensors and norms as float32
  - TAESD decoder as float16
  - the time-embedding bias of every ResNet, precomputed for a few timesteps (the phone never runs that path)
  - CLIP embeddings of every trait phrase (the phone never runs the text encoder)
"""
import json, math, sys, struct, numpy as np, torch
from diffusers import UNet2DConditionModel, AutoencoderTiny
from transformers import CLIPTokenizer, CLIPTextModel

REPO = "IDKiro/sdxs-512-dreamshaper"
OUT = sys.argv[1] if len(sys.argv) > 1 else "model"
BITS, G, CHUNK = 5, 128, 14 * 1024 * 1024
TIMESTEPS = [999, 799, 599]

unet = UNet2DConditionModel.from_pretrained(REPO, subfolder="unet").eval()
vae = AutoencoderTiny.from_pretrained(REPO, subfolder="vae").eval()
tok = CLIPTokenizer.from_pretrained(REPO, subfolder="tokenizer")
te = CLIPTextModel.from_pretrained(REPO, subfolder="text_encoder").eval()

blob, tensors = bytearray(), {}

def put(name, kind, shape, payload, extra=None):
  tensors[name] = dict(kind=kind, shape=list(shape), offset=len(blob), bytes=len(payload), **(extra or {}))
  blob.extend(payload)

def q5(w):
  """Flat groups of G: codes 0..31, value = min + code * scale. Returns the dequantized tensor too."""
  f = w.reshape(-1).astype(np.float32)
  pad = (-f.size) % G
  g = np.concatenate([f, np.zeros(pad, np.float32)]).reshape(-1, G)
  lo, hi = g.min(1), g.max(1)
  sc = np.maximum(hi - lo, 1e-8) / (2**BITS - 1)
  codes = np.clip(np.round((g - lo[:, None]) / sc[:, None]), 0, 31).astype(np.uint8)
  deq = (codes * sc[:, None] + lo[:, None]).reshape(-1)[: f.size].reshape(w.shape)
  c = codes.reshape(-1)[: f.size]
  c = np.concatenate([c, np.zeros((-c.size) % 8, np.uint8)]).reshape(-1, 8).astype(np.uint64)
  packed = np.zeros(c.shape[0], np.uint64)
  for i in range(8): packed |= c[:, i] << np.uint64(5 * i)
  pb = packed.astype("<u8").view(np.uint8).reshape(-1, 8)[:, :5].tobytes()  # 8 codes in 5 bytes
  return lo.astype("<f4").tobytes() + sc.astype("<f4").tobytes() + pb, deq.astype(np.float32), lo.size

# UNet
sd = {k: v.detach().numpy() for k, v in unet.state_dict().items()}
skip = lambda k: k.startswith("time_embedding.") or ".time_emb_proj." in k
deq_sd = {}
for k, w in sd.items():
  if skip(k): continue
  if w.ndim >= 2 and w.size >= 65536:
    payload, deq, ng = q5(w)
    put("unet." + k, "q5", w.shape, payload, dict(groups=ng))
    deq_sd[k] = deq
  else:
    put("unet." + k, "f32", w.shape, w.astype("<f4").tobytes())
    deq_sd[k] = w

# time-embedding biases per ResNet per timestep
temb = {}
with torch.no_grad():
  for t in TIMESTEPS:
    e = unet.time_embedding(unet.time_proj(torch.tensor([t])).float())
    e = torch.nn.functional.silu(e)
    for n, m in unet.named_modules():
      if n.endswith("time_emb_proj"):
        put(f"temb.{t}.{n}", "f32", (m.out_features,), m(e)[0].numpy().astype("<f4").tobytes())

# TAESD decoder
for k, w in vae.decoder.state_dict().items():
  put("dec." + k, "f16", w.shape, w.numpy().astype("<f2").tobytes())

# alphas for the 1-step / img2img update
betas = torch.linspace(0.00085**0.5, 0.012**0.5, 1000) ** 2
acp = torch.cumprod(1 - betas, 0)

# trait phrases -> CLIP embeddings (each phrase encoded alone: BOS + tokens + EOS)
phrases = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else {}
emb_meta = {}
with torch.no_grad():
  for key, text in phrases.items():
    ids = tok(text, truncation=True, max_length=77, return_tensors="pt").input_ids
    e = te(ids)[0][0].numpy()
    put("emb." + key, "f16", e.shape, e.astype("<f2").tobytes())
    emb_meta[key] = text

# write chunks
files = []
for i in range(0, len(blob), CHUNK):
  fn = f"w{len(files):02d}.bin"
  open(f"{OUT}/{fn}", "wb").write(blob[i : i + CHUNK])
  files.append(fn)
json.dump(dict(model=REPO, bits=BITS, group=G, files=files, chunk=CHUNK, total=len(blob),
               timesteps=TIMESTEPS, alphas_cumprod={t: float(acp[t]) for t in TIMESTEPS},
               phrases=emb_meta, tensors=tensors, matte=dict(json="u2.json", bin="u2.bin")), open(f"{OUT}/manifest.json", "w"))
print("total MB", round(len(blob) / 1e6, 1), "files", len(files))

# reference outputs with the dequantized weights, for the engine test
if "--ref" in sys.argv:
  unet.load_state_dict({k: torch.from_numpy(v) if not skip(k) else torch.from_numpy(sd[k]) for k, v in {**sd, **deq_sd}.items()})
  g = torch.Generator().manual_seed(0)
  x = torch.randn(1, 4, 64, 64, generator=g)
  keys = list(phrases)[:5]
  ctx = torch.cat([te(tok(phrases[k], return_tensors="pt").input_ids)[0] for k in keys], 1)
  with torch.no_grad():
    eps = unet(x, 999, encoder_hidden_states=ctx.half().float()).sample
    a = acp[999]
    x0 = (x - (1 - a).sqrt() * eps) / a.sqrt()
    img = vae.decoder.layers(torch.tanh(x0 / 3) * 3).clamp(0, 1)
  np.save(f"{OUT}/../ref_noise.npy", x.numpy()); open(f"{OUT}/../ref_noise.bin", "wb").write(x.numpy().astype("<f4").tobytes())
  open(f"{OUT}/../ref_eps.bin", "wb").write(eps.numpy().astype("<f4").tobytes())
  open(f"{OUT}/../ref_img.bin", "wb").write(img.numpy().astype("<f4").tobytes())
  json.dump(keys, open(f"{OUT}/../ref_keys.json", "w"))
  from PIL import Image
  Image.fromarray((img[0].permute(1, 2, 0).numpy() * 255).round().astype(np.uint8)).save(f"{OUT}/../ref.png")
  print("ref written")
