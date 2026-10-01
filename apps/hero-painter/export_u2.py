"""Flatten U2-Net-p (rembg's u2netp.onnx) into a static layer list for the WebGPU engine, at 320x320."""
import onnx, json, sys, numpy as np
from onnx import numpy_helper, shape_inference
src, out = sys.argv[1], sys.argv[2]
m = onnx.load(src)
m.graph.input[0].type.tensor_type.shape.dim[0].dim_value = 1
m = shape_inference.infer_shapes(m)
shapes = {vi.name: [d.dim_value for d in vi.type.tensor_type.shape.dim] for vi in list(m.graph.value_info) + list(m.graph.input) + list(m.graph.output)}
import onnxruntime as ort
m2 = onnx.load(src)
prod = {o: n.op_type for n in m2.graph.node for o in n.output}
keep = {o for n in m2.graph.node if n.op_type in ("Conv","Relu","Sigmoid","MaxPool","Resize","Concat","Add") and not (n.op_type == "Concat" and any(prod.get(i) in ("Unsqueeze","Constant","Cast","Slice","Gather") for i in n.input)) for o in n.output}
m2.graph.output.extend([onnx.helper.make_tensor_value_info(o, onnx.TensorProto.FLOAT, None) for o in keep if o not in {x.name for x in m2.graph.output}])
sess = ort.InferenceSession(m2.SerializeToString())
vals = sess.run(None, {m2.graph.input[0].name: np.zeros((1, 3, 320, 320), np.float32)})
for o, v in zip([x.name for x in sess.get_outputs()], vals): shapes[o] = list(v.shape)
init = {t.name: numpy_helper.to_array(t) for t in m.graph.initializer}
blob, wt, layers = bytearray(), {}, []
def put(name, a):
  wt[name] = dict(offset=len(blob), shape=list(a.shape)); blob.extend(a.astype("<f2").tobytes())
for n in m.graph.node:
  at = {a.name: onnx.helper.get_attribute_value(a) for a in n.attribute}
  if n.op_type == "Conv":
    w, b = n.input[1], n.input[2] if len(n.input) > 2 else None
    put(w, init[w]); b and put(b, init[b])
    layers.append(dict(op="conv", x=n.input[0], w=w, b=b, y=n.output[0], d=at.get("dilations", [1, 1])[0], k=at["kernel_shape"][0], pad=at.get("pads", [0] * 4)[0], s=at.get("strides", [1, 1])[0]))
  elif n.op_type in ("Relu", "Sigmoid"):
    layers.append(dict(op=n.op_type.lower(), x=n.input[0], y=n.output[0]))
  elif n.op_type == "MaxPool":
    layers.append(dict(op="pool", x=n.input[0], y=n.output[0]))
  elif n.op_type == "Resize":
    layers.append(dict(op="resize", x=n.input[0], y=n.output[0], to=shapes[n.output[0]][2:]))
  elif n.op_type == "Concat" and n.output[0] in shapes and len(shapes[n.output[0]]) == 4:
    layers.append(dict(op="concat", xs=list(n.input), y=n.output[0]))
  elif n.op_type == "Add":
    layers.append(dict(op="add", a=n.input[0], b=n.input[1], y=n.output[0]))
for L in layers:
  L["shape"] = shapes.get(L["y"])
json.dump(dict(input=m.graph.input[0].name, output=m.graph.output[0].name, layers=layers, weights=wt), open(f"{out}/u2.json", "w"))
open(f"{out}/u2.bin", "wb").write(blob)
print(len(layers), "layers", len(blob) / 1e6, "MB", {L["op"] for L in layers})
print(sum(1 for L in layers if L["shape"] is None), "missing shapes")
