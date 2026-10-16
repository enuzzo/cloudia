from pathlib import Path
import hashlib, json, math, struct

p = Path(__file__).resolve().parent
report = json.loads((p / 'browser-result.json').read_text())
inputs = json.loads((p / 'inputs.json').read_text())
verified = []
for dataset in report['datasets']:
    name = dataset['name']
    raw = (p / 'gpu-readbacks' / (name + '-readback.bin')).read_bytes()
    spec = next(item for item in inputs['datasets'] if item['name'] == name)
    query = (p / spec['queryFile']).read_bytes()
    count = dataset['queryCount']
    assert len(raw) == 48 * count + 16 and len(query) == 16 * count
    assert hashlib.sha256(raw).hexdigest() == dataset['outputSHA256']
    zero = positive = 0
    for index in range(count):
        a, b, delta, absolute, ai, bi, mismatch, nonfinite, *echo = struct.unpack_from('<4f4I4f', raw, index * 48)
        assert all(math.isfinite(value) for value in [a, b, delta, absolute, *echo])
        assert 0 <= a <= 1 and 0 <= b <= 1
        assert ai == bi and mismatch == nonfinite == 0 and delta == absolute == 0
        assert struct.pack('<2f', a, b) == struct.pack('<2I', ai, bi)
        assert raw[index * 48 + 32:index * 48 + 48] == query[index * 16:index * 16 + 16]
        if spec['expectedConstant'] is not None:
            assert a == spec['expectedConstant']
        zero += a == 0
        positive += a > 0
    assert struct.unpack_from('<4I', raw, count * 48) == (count, 0, 0, 0)
    assert zero == dataset['summary']['zeroPairs'] and positive == dataset['summary']['positivePairs']
    verified.append(dict(name=name, queries=count, zero=zero, positive=positive,
                         exactBits=True, echoBits=True, outputSHA256=dataset['outputSHA256']))

result = dict(status='PASS independent raw readback verification',
              queries=sum(item['queries'] for item in verified), datasets=verified,
              scope='Finite shared sampler raw WebGPU result, not renderer/Three or universal proof.')
(p / 'independent-verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(result['status'], result['queries'])
