"""Read-only JPEG replay of archived samples. Writes no files."""
from pathlib import Path
from PIL import Image, __version__ as pillow_version
import hashlib
import gzip
import json
import math
import statistics

base = Path(__file__).resolve().parent
image_path = base / 'browser/solar-day-left-near.jpg'
image = Image.open(image_path)
assert image.size == (1280, 720) and image.mode == 'RGB'
prediction = json.loads(gzip.decompress((base / 'model/near-light.json.gz').read_bytes()))
rectangles = [
    ('brand', (18, 17, 224, 119)),
    ('diagnostic', (31, 125, 451, 157)),
    ('hands', (1139, 27, 1249, 73)),
    ('dock', (328, 628, 953, 694)),
    ('zoom', (1195, 551, 1249, 694)),
    ('help', (15, 688, 233, 712)),
]
weights = [.2126, .7152, .0722]
records = []
for ray in prediction['rays']:
    uv = ray['uv']
    x, y = round(uv[0] * image.width), round(uv[1] * image.height)
    radius = 3
    overlays = [name for name, (a, b, c, d) in rectangles
                if x + radius >= a and x - radius < c and y + radius >= b and y - radius < d]
    item = dict(uv=uv, pixel=[x, y], patchRadius=radius, excluded=bool(overlays),
                overlays=overlays, predictedRGB255=ray['display8'])
    if not overlays:
        pixels = [image.getpixel((xx, yy))
                  for yy in range(y - radius, y + radius + 1)
                  for xx in range(x - radius, x + radius + 1)]
        means = [statistics.mean(pixel[c] for pixel in pixels) for c in range(3)]
        item.update(observedMeanRGB=means,
                    observedMedianRGB=[statistics.median(pixel[c] for pixel in pixels) for c in range(3)],
                    observedMinRGB=[min(pixel[c] for pixel in pixels) for c in range(3)],
                    observedMaxRGB=[max(pixel[c] for pixel in pixels) for c in range(3)],
                    differenceMeanRGB=[means[c] - ray['display8'][c] for c in range(3)],
                    observedLuminance255=sum(v * w for v, w in zip(means, weights)),
                    predictedLuminance255=ray['srgbLuminance'] * 255)
    records.append(item)
valid = [item for item in records if not item['excluded']]
observed = [item['observedLuminance255'] for item in valid]
predicted = [item['predictedLuminance255'] for item in valid]
def stats(values):
    return dict(n=len(values), min=min(values), max=max(values),
                mean=statistics.mean(values), standardDeviation=statistics.pstdev(values))
mean_observed, mean_predicted = statistics.mean(observed), statistics.mean(predicted)
covariance = sum((a - mean_observed) * (b - mean_predicted) for a, b in zip(observed, predicted))
variance_predicted = sum((v - mean_predicted) ** 2 for v in predicted)
variance_observed = sum((v - mean_observed) ** 2 for v in observed)
errors = [a - b for a, b in zip(observed, predicted)]
summary = dict(
    usableSamples=len(valid), excludedSamples=len(records) - len(valid),
    observedLuminance255=stats(observed), predictedLuminance255=stats(predicted),
    biasObservedMinusCPU255=statistics.mean(errors),
    rmseLuminance255=math.sqrt(statistics.mean(v * v for v in errors)),
    maxAbsoluteLuminanceError255=max(abs(v) for v in errors),
    correlation=covariance / math.sqrt(variance_predicted * variance_observed),
    linearFitObservedFromCPU=dict(slope=covariance / variance_predicted,
                                 intercept=mean_observed - covariance / variance_predicted * mean_predicted),
    perChannelBiasObservedMinusCPU255=[statistics.mean(item['differenceMeanRGB'][c] for item in valid) for c in range(3)],
)
report = dict(
    imagePath=str(image_path), imageBytes=image_path.stat().st_size,
    imageSHA256=hashlib.sha256(image_path.read_bytes()).hexdigest(),
    dimensions=image.size, encoding=image.format, embeddedICC=bool(image.info.get('icc_profile')),
    mode=image.mode, decoder=f'Pillow {pillow_version}',
    method='Read-only JPEG numeric decode; 7x7 mean/median around13 specified CSS UVs. Four UI patches excluded using explicit rectangles. CPU Float64 radiance/film/sRGB is approximate, not native f32. No image conversion, editing or product writes.',
    overlayRectangles=[dict(name=name, xyxy=rect) for name, rect in rectangles],
    samples=records, summary=summary,
)
expected = json.loads((base / 'jpeg-comparison.json').read_text())
assert report['imageSHA256'] == expected['imageSHA256'], 'Image SHA differs'
assert report['samples'] == expected['samples'], 'Decoded sampled patch values differ'
assert report['summary'] == expected['summary'], 'Comparison metrics differ'
print(json.dumps(summary, indent=2))
