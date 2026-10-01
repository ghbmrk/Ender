# Hero Painter

Paints the player's hero on the player's own device: no server, no paid inference. A prototype of
"characters generated on device, evolving with the Loom" before it moves into the game.

- **Model:** SDXS-512-DreamShaper, a one-step distilled Stable Diffusion, with its TAESD decoder.
  The UNet ships as 5-bit codes (one min/scale pair per 128 weights): 214 MB, downloaded once.
- **No text model on the device.** Every trait phrase in `phrases.json` is encoded by CLIP at export time.
  The page concatenates the phrase embeddings it needs (garb and colours, Loom ranks, weapon, view, style).
  Same seed plus one more phrase gives the same hero with the upgrade.
- **Cutout:** U2-Net-p (2 MB) mattes the hero off its plain backdrop.
- **Engine:** `engine.js`, plain WebGPU compute shaders (no WASM, no ML runtime). Weights stay 5-bit on the
  GPU and are dequantised inside the shaders. Checked against the PyTorch reference: noise prediction
  matches to 4e-5, the image to 3/255 at worst.

## Build

```sh
pip install torch diffusers transformers onnx onnxruntime
mkdir -p model
python3 export.py model phrases.json            # 214 MB of weights + manifest (add --ref for test tensors)
curl -L -o u2netp.onnx https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx
python3 export_u2.py u2netp.onnx model
python3 build.py dist                            # dist/index.html + model/ + backdrop
```

`model/` and `dist/` are build output and are not committed.
