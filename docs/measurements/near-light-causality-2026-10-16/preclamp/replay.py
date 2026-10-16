"""Scalar-only replay of coefficient .6 -> .5 on frozen existing sample stencils.

No volume, texture, cache, light bake, product source or image is generated.
"""
from pathlib import Path
import hashlib
import json
import math
import statistics
import struct
import gzip

base = Path(__file__).resolve().parent
source_bytes = gzip.decompress((base / 'input/carving-causality.json.gz').read_bytes())
source = json.loads(source_bytes)
nodes = {','.join(map(str, item['index'])): item['scalar']
         for record in source['records'] for item in record['stencil']}
assert len(nodes) == 196

def clamp(value):
    return max(0, min(1, value))

def float32(value):
    return struct.unpack('<f', struct.pack('<f', value))[0]

def macro_byte(node, coefficient):
    # All frozen196 nodes are liquid, above the base fade. Assert before using
    # the reduced expression; no approximation to a mixed ice phase is hidden.
    assert node['ice'] == 0 and node['point'][1] > .96
    t = clamp((node['field'] - .04) / (.28 - .04))
    interior = 1 - coefficient * (t * t * (3 - 2 * t))
    carving = node['erosion'] * node['erosionScale'] * interior
    raw = (node['field'] + carving - .025) * 10
    density = float32(clamp(raw) * (.65 + .35 * node['noise2']))
    # Match JS Math.round for these nonnegative quantities, after original f32
    # density storage. Python's default round uses a different tie rule.
    return dict(interior=interior, raw=raw, byte=math.floor(density * 255 + .5))

changed = {}
for key, node in nodes.items():
    old = macro_byte(node, .6)
    assert old['byte'] == node['actualByte'], f'Original byte replay differs: {key}'
    new = macro_byte(node, .5)
    changed[key] = dict(index=node['index'], oldInterior=old['interior'], newInterior=new['interior'],
                        oldRaw=old['raw'], newRaw=new['raw'], oldByte=old['byte'], newByte=new['byte'],
                        oldSaturated=old['raw'] >= 1, newSaturated=new['raw'] >= 1)

records = []
for record in source['records']:
    revised_macro = sum(item['weight'] * changed[','.join(map(str, item['index']))]['newByte'] / 255
                        for item in record['stencil'])
    old_macro, old_density = record['macro'], record['renderDensity']
    assert 0 < old_density < 1
    # With ice=0 and no dispersal, rho=(macro-E)/(1-E). Recover the same fixed
    # filtered fine/flow/micro erosion at the already sampled coordinate.
    effective_erosion = (old_macro - old_density) / (1 - old_density)
    revised_density = clamp((revised_macro - effective_erosion) / (1 - effective_erosion))
    if revised_density < .002:
        revised_density = 0
    saturated = sum(item['weight'] * changed[','.join(map(str, item['index']))]['newSaturated']
                    for item in record['stencil'])
    records.append(dict(uv=record['uv'], label=record['label'], oldMacro=old_macro,
                        newMacro=revised_macro, deltaMacro=revised_macro - old_macro,
                        oldRenderDensity=old_density, newRenderDensity=revised_density,
                        deltaRenderDensity=revised_density - old_density,
                        effectiveErosion=effective_erosion,
                        oldSaturatedStencilWeight=record['diagnostic']['saturatedStencilWeight'],
                        newSaturatedStencilWeight=saturated, newZeroDensity=revised_density == 0))

def stats(values):
    return dict(n=len(values), min=min(values), max=max(values), mean=statistics.mean(values))

summaries = {}
for label in ['first-plus5m', 'view-tau1', 'mean-opacity-distance', 'view-tau3']:
    rows = [item for item in records if item['label'] == label]
    summaries[label] = {key: stats([item[key] for item in rows])
                        for key in ['oldMacro', 'newMacro', 'deltaMacro', 'oldRenderDensity',
                                    'newRenderDensity', 'deltaRenderDensity',
                                    'oldSaturatedStencilWeight', 'newSaturatedStencilWeight']}
    summaries[label]['zeroDensitySamples'] = sum(item['newZeroDensity'] for item in rows)

report = dict(
    scope='Scalar counterfactual on196 original reconstructed macro nodes only; exact coefficient .6->.5 in interior=1-coefficient*smoothstep(.04,.28,field). Original196 bytes reproduced. Existing field/noise/threshold/modulation retained. f32 density storage and JS rounding included. All nodes liquid/baseFade1. Same filtered fine erosion applied at52 existing coordinates. No new volume/cache, product edit, light rebake, surface finding or artistic claim.',
    uniqueNodes=len(nodes), originalByteReplayMismatches=0,
    sourceInputSHA256=hashlib.sha256(source_bytes).hexdigest(),
    summaries=summaries, records=records, nodes=list(changed.values()),
)
expected = json.loads(gzip.decompress((base / 'expected/interior-coefficient-scalar.json.gz').read_bytes()))
assert report == expected, 'Frozen complete counterfactual output differs'
print(json.dumps(dict(status='PASS', originalBytesMatched=len(nodes), frozenCounterfactualRecordsMatched=len(records), decision='Negative counterfactual; not promoted'), indent=2))
