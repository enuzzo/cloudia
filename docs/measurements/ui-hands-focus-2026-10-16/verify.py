#!/usr/bin/env python3
"""Read-only, stdlib verification of the curated UI focus evidence."""
import argparse
from datetime import datetime
import difflib
import gzip
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent


def sha(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_json(name):
    return json.loads((HERE / name).read_text())


def events(name):
    return read_json('browser/' + name)['events']


def check_tree(root, mapping):
    for rel, expected in mapping.items():
        path = root / rel
        require(path.is_file(), f'Missing frozen file: {path}')
        require(sha(path.read_bytes()) == expected, f'Frozen SHA mismatch: {path}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--frozen-source', type=Path)
    parser.add_argument('--dist', type=Path)
    args = parser.parse_args()
    manifest = read_json('MANIFEST.json')
    listed = {row['path'] for row in manifest['files']}
    actual = {p.relative_to(HERE).as_posix() for p in HERE.rglob('*') if p.is_file()}
    require(actual == listed | {'MANIFEST.json'}, 'Payload inventory mismatch')
    require(len(listed) == manifest['fileCount'], 'Manifest count mismatch')
    require(sum(row['bytes'] for row in manifest['files']) == manifest['payloadBytes'], 'Byte total mismatch')
    for row in manifest['files']:
        data = (HERE / row['path']).read_bytes()
        require(len(data) == row['bytes'] and sha(data) == row['sha256'], 'Payload mismatch: ' + row['path'])

    origins = read_json('origins.json')['copiedOriginals']
    for row in origins:
        data = (HERE / row['path']).read_bytes()
        if row['copy'].startswith('gzip'):
            data = gzip.decompress(data)
            require(len(data) == row['uncompressedBytes'] and sha(data) == row['uncompressedSha256'], 'Original gzip mismatch: ' + row['path'])
        else:
            require(len(data) == row['bytes'] and sha(data) == row['sha256'], 'Original mismatch: ' + row['path'])

    before = read_json('source/before-source-119.json')
    after = read_json('source/after-source-119.json')
    dist_before = read_json('source/before-dist-30.json')
    dist_after = read_json('source/after-dist-30.json')
    css_path = 'src/cumulonimbus/scene.css'
    require(len(before) == len(after) == 119 and before.keys() == after.keys(), 'Source manifest scope mismatch')
    require([k for k in before if before[k] != after[k]] == [css_path], 'Unexpected changed source')
    require(len(dist_before) == len(dist_after) == 30, 'Dist manifest scope mismatch')
    css_before = (HERE / 'source/scene.before.css').read_bytes()
    css_after = (HERE / 'source/scene.after.css').read_bytes()
    old = b'.cloud-scene:has(.sky-inspector[open]) :is(.view-controls,.view-help){visibility:hidden}'
    new = b'.cloud-scene:has(.sky-inspector[open],.hands-guide[open]) :is(.view-controls,.view-help){visibility:hidden}'
    require(css_before.count(old) == 1 and css_before.replace(old, new) == css_after, 'CSS change is not the single agreed selector')
    require(sha(css_before) == before[css_path] and sha(css_after) == after[css_path], 'CSS provenance mismatch')
    delta = ''.join(difflib.unified_diff(css_before.decode().splitlines(True), css_after.decode().splitlines(True), fromfile='a/' + css_path, tofile='b/' + css_path, n=1))
    expected_patch = 'diff --git a/' + css_path + ' b/' + css_path + '\n' + delta
    require((HERE / 'source/scene.patch').read_text() == expected_patch, 'CSS patch mismatch')

    all_raw = sorted((HERE / 'browser').glob('*.json'))
    require(len(all_raw) == 7, 'Expected seven raw focus logs')
    for path in all_raw:
        raw = json.loads(path.read_text())
        require(raw['scope'].startswith('Passive same-origin DOM focus observer'), 'Observer scope mismatch')
        for event in raw['events']:
            require(event['viewportCSS'] == event['iframeCSS'] == [390, 844], 'Viewport mismatch')
    original = events('before-focus.json')
    first = original[3]
    require(first['event'] == 'focusin' and first['active']['ariaLabel'] == 'Avvicinati alla nube', 'Before natural zoom witness missing')
    require(first['activeContainsCenterElement'] is False and first['elementAtActiveCenter']['class'] == 'diagnostics hand-panel', 'Before covered-center witness missing')
    require(original[4]['event'] == 'manual-current-focus' and original[4]['active']['tag'] == 'body', 'Preserved manual snapshot caveat changed')
    cycle = events('after-full-tab-cycle.json')
    labels = [e['active']['ariaLabel'] or e['active']['text'] for e in cycle[-7:]]
    expected_labels = ['Chiudi guida mani', 'Pausa', 'Sole', 'Tramonto', 'Pioggia', 'Temporale', 'Regola il cielo']
    require(len(cycle) == 18 and labels == expected_labels, 'Seven-event cycle mismatch')
    require(all(e['event'] == 'focusin' and e['activeContainsCenterElement'] is True for e in cycle[-7:]), 'Seven visible controls gate failed')
    require(cycle[9]['active']['tag'] == 'canvas' and cycle[9]['activeContainsCenterElement'] is False, 'Earlier canvas caveat changed')
    expected_last = {
        'after-tab-focus.json': ('button', 'Pausa', True),
        'after-escape-focus.json': ('summary', 'Mani in arrivo', True),
        'after-close-button-focus.json': ('summary', 'Mani in arrivo', True),
        'after-outside-focus.json': ('canvas', 'Nube volumetrica ruotabile', False),
        'after-restored-zoom-focus.json': ('button', 'Avvicinati alla nube', True),
    }
    summary = read_json('summary.json')
    require(summary['before']['event'] == first and summary['before']['eventIndex'] == 3, 'Before summary mismatch')
    require(summary['afterVisibleCycle']['eventIndices'] == list(range(11, 18)) and summary['afterVisibleCycle']['labels'] == expected_labels, 'Cycle summary mismatch')
    require(summary['afterVisibleCycle']['centerAccessible'] == [True] * 7 and summary['afterVisibleCycle']['count'] == 7, 'Cycle summary count mismatch')
    for name, (tag, label, accessible) in expected_last.items():
        raw = events(name)
        last = raw[-1]
        require(last['active']['tag'] == tag and (last['active']['ariaLabel'] or last['active']['text']) == label, 'Focus destination mismatch: ' + name)
        require(last['activeContainsCenterElement'] is accessible, 'Focus geometry mismatch: ' + name)
        require(summary['results'][name]['lastEventIndex'] == len(raw) - 1 and summary['results'][name]['lastEvent'] == last, 'Result summary mismatch: ' + name)
    require(summary['sourceManifestCounts'] == {'before': 119, 'after': 119, 'changedSourcePaths': [css_path], 'distBefore': 30, 'distAfter': 30}, 'Manifest summary mismatch')

    r1 = read_json('qa/original-host-manifest-r1.json')
    r2 = read_json('qa/original-host-manifest-r2.json')
    require(r2['r1ManifestSha256'] == sha((HERE / 'qa/original-host-manifest-r1.json').read_bytes()), 'Historical R1 manifest mismatch')
    require(r2['baseDist']['fileCount'] == 30, 'Historical host dist count mismatch')
    historical = {row['path'].removeprefix('qa-host/'): row['sha256'] for row in r2['baseDist']['files']}
    require(historical == dist_before, 'Historical host and baseline dist mismatch')
    require(bool(r1) and all('width:390px;height:844px' in (HERE / ('qa/' + name)).read_text() for name in ['before-qa-mobile-r1.html', 'before-qa-mobile-r2.html', 'after-qa-mobile.html']), 'Wrapper dimensions mismatch')
    require('Registra focus corrente' in (HERE / 'qa/before-qa-mobile-r2.html').read_text(), 'R2 manual button missing')
    require('Registra focus corrente' in (HERE / 'qa/after-qa-mobile.html').read_text(), 'Fixed observer button missing')
    observation = read_json('console-observation.json')
    require(observation['level'] == 'error' and observation['url'] is None, 'Console observation scope mismatch')
    require(datetime.fromisoformat(observation['timestamp'].replace('Z', '+00:00')) < datetime.fromisoformat(observation['fixedQaHtmlMtimeReportedByRoot']), 'Historical error order mismatch')
    require(observation['message'] == "Uncaught TypeError: Failed to execute 'observe' on 'MutationObserver': parameter 1 is not of type 'Node'.", 'Historical error text mismatch')
    for name in ['fixed-build-app.log.gz', 'fixed-build-hero.log.gz']:
        require(b'built in' in gzip.decompress((HERE / 'build' / name).read_bytes()), 'Original successful build log missing')
    require(len(list((HERE / 'browser').glob('*.jpg'))) == 4, 'Expected four original CSS JPEGs')
    if args.frozen_source:
        check_tree(args.frozen_source, after)
    if args.dist:
        check_tree(args.dist, dist_after)
    print(json.dumps({'status': 'PASS_OFFLINE_ARCHIVE', 'payloads': manifest['fileCount'], 'payloadBytes': manifest['payloadBytes'], 'originalPayloads': len(origins), 'sourceManifests': [119, 119], 'distManifests': [30, 30], 'beforeNaturalZoomCovered': True, 'afterVisibleControls': 7, 'canvasFalsePreserved': True, 'externalSourceFilesChecked': 119 if args.frozen_source else 0, 'externalDistFilesChecked': 30 if args.dist else 0, 'browserGpuBuildProductTestsRun': False}, indent=2))


if __name__ == '__main__':
    main()
