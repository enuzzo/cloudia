# Evidence package: native frame export v57

Six complete browser PNG triplets and full-quality same-draw metadata, transport ledgers, qualification, negative R1 evidence and independent reviews. Product source/dist immutable in external cycle24; source-manifest124 matches runtime at qualification.

Run `python3 verify.py`, optionally `--runtime-source /absolute/checkout` and `--dist /absolute/dist`. Requires existing Pillow; no renderer/model/test/build/browser execution. The wrapper checks all packaged payload hashes, then fully decodes PNG and validates saved metadata. It also checks saved clear/ordinary-preview evidence. Collector provenance is recorded, not recreated: raw UI base64 strings are not duplicated.

Main/worker near60 parity is limited to the captured canvas PNG/decoded pixels. No FPS, compositor, HDR/float, motion or artistic acceptance. Native near detail and rain curtain remain open. The proposal in terrain-native-diagnosis.md is a read-only diagnosis, not an implemented fix.

The ordinary4196 screenshot is CSS/JPEG UI context; six files ending .png are actual native canvas exports. No partialPNG was saved from the truncated R1 attempt.
