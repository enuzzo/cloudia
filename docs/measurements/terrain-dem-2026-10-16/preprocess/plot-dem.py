"""Scientific plate from frozen CDM1; no renderer, procedural model or DEM rerun."""
from pathlib import Path
import struct, json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parent
W, H = 2240, 1790
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'

def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, size)

def run():
    raw = (ROOT / 'apuane-liguria-cdm1.bin').read_bytes()
    magic, n, spacing, min_x, min_z = struct.unpack_from('<4sIddd', raw)
    assert magic == b'CDM1'
    height = np.frombuffer(raw, '<u2', n*n, 32).reshape(n, n).astype(float) * .125
    coast = np.frombuffer(raw, '<i2', n*n, 32+n*n*2).reshape(n, n).astype(float) * 8
    sea = np.fromfile(ROOT / 'ocean-mask.u8', np.uint8).reshape(n, n).astype(bool)
    result = json.loads((ROOT / 'preprocess-result.json').read_text())
    img = Image.new('RGB', (W, H), '#fafaf7')
    d = ImageDraw.Draw(img)
    ink = '#17212a'; muted = '#53606c'
    def text(x, y, s, size=25, bold=False, fill=ink, anchor=None):
        d.text((x, y), s, font=font(size, bold), fill=fill, anchor=anchor)
    text(90, 45, 'Rilievo reale costiero — Apuane e Liguria orientale', 44, True)
    text(90, 106, 'Copernicus GLO-90  |  CDM1 1025²  |  nodi ogni 125 m  |  nessuna esagerazione verticale', 27)
    text(90, 149, 'Tavola scientifica dei dati: non è una cattura del renderer e non qualifica il fotorealismo.', 23, fill=muted)

    stops = np.array([0, 150, 450, 850, 1300, 1800, 2300])
    colors = np.array([[84, 127, 89], [115, 151, 96], [151, 164, 112],
                       [168, 158, 123], [165, 147, 129], [177, 175, 164], [220, 219, 211]])
    rgb = np.stack([np.interp(height, stops, colors[:, c]) for c in range(3)], axis=-1)
    # Cartographic hillshade only. Derivatives use metres/metres, source north up.
    gz, gx = np.gradient(height, spacing * 1000)
    normal = np.stack([-gx, np.ones_like(height), -gz], axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    light = np.array([-.5, .75, .45]); light /= np.linalg.norm(light)
    shade = .52 + .48 * np.maximum(0, normal @ light)
    rgb *= shade[..., None]
    rgb[sea] = [72, 123, 154]
    boundary = np.zeros_like(sea)
    boundary[1:] |= sea[1:] != sea[:-1]
    boundary[:, 1:] |= sea[:, 1:] != sea[:, :-1]
    rgb[boundary] = [21, 59, 70]
    # Coast plot is signed raster distance, saturated only for visual colour scale.
    cscale = np.clip(coast / 80000, -1, 1)
    crgb = np.empty_like(rgb)
    for c, (sea_c, zero_c, land_c) in enumerate(zip([42, 103, 151], [245, 245, 231], [129, 72, 33])):
        crgb[..., c] = np.where(cscale < 0, zero_c + (-cscale) * (sea_c - zero_c), zero_c + cscale * (land_c - zero_c))
    crgb[boundary] = [24, 39, 44]
    map_size = 870; map_y = 248
    maps = [(110, rgb, 'A  Quota e ombreggiatura cartografica'),
            (1240, crgb, 'B  Distanza dalla costa con segno')]
    def at(x0, x, z):
        return x0 + (x + 64) / 128 * map_size, map_y + (64 - z) / 128 * map_size
    def dashed_line(a, b, fill, width=2, dash=10):
        dx, dy = b[0]-a[0], b[1]-a[1]; length = math.hypot(dx, dy)
        for start in np.arange(0, length, dash*2):
            lo = start / length; hi = min(length, start+dash) / length
            d.line((a[0]+dx*lo, a[1]+dy*lo, a[0]+dx*hi, a[1]+dy*hi), fill=fill, width=width)
    for x0, data, title in maps:
        text(x0, 202, title, 28, True)
        raster = Image.fromarray(np.flipud(np.clip(data, 0, 255).astype('uint8')))
        img.paste(raster.resize((map_size, map_size), Image.Resampling.BILINEAR), (x0, map_y))
        d.rectangle((x0, map_y, x0+map_size, map_y+map_size), outline=ink, width=2)
        # Tile seam (x=0, z=0); this line is a reference, not a discontinuity.
        dashed_line(at(x0, 0, -64), at(x0, 0, 64), '#dc72c4', 2, 8)
        dashed_line(at(x0, -64, 0), at(x0, 64, 0), '#dc72c4', 2, 8)
        for a,b in [((-48,-48),(48,-48)),((48,-48),(48,48)),((48,48),(-48,48)),((-48,48),(-48,-48))]:
            dashed_line(at(x0,*a), at(x0,*b), '#ffffff', 3, 12)
        for val in [-64, -32, 0, 32, 64]:
            xx, yy = at(x0, val, -64)
            d.line((xx, yy, xx, yy+8), fill=ink, width=2)
            text(xx, yy+14, f'{val:+d}' if val else '0', 21, anchor='mt')
            xx, yy = at(x0, -64, val)
            d.line((xx-8, yy, xx, yy), fill=ink, width=2)
            text(xx-17, yy, f'{val:+d}' if val else '0', 21, anchor='rm')
        text(x0+map_size/2, map_y+map_size+46, 'X verso Ovest  →  [km]', 23, anchor='mt')
        text(x0-11, map_y-7, 'Z Nord ↑', 20, anchor='rb')
        ox, oz = at(x0, 0, 0)
        d.ellipse((ox-5, oz-5, ox+5, oz+5), outline='#111111', fill='white', width=2)
        text(ox+12, oz+10, '44° N, 10° E', 19, fill='#17212a')
    for i in range(map_size):
        a = i / (map_size - 1)
        color_h = tuple(int(np.interp(a * 2300, stops, colors[:, c])) for c in range(3))
        d.line((110+i, 1197, 110+i, 1210), fill=color_h)
        v = a * 2 - 1
        color_c = tuple(int(z + abs(v) * ((s if v < 0 else l) - z))
                        for s,z,l in zip([42,103,151],[245,245,231],[129,72,33]))
        d.line((1240+i, 1197, 1240+i, 1210), fill=color_c)
    text(110, 1217, 'Quota: 0 → 2300 m (prima dell’ombreggiatura)', 21)
    text(1240, 1217, 'Mare −80 km  ←  0 costa  →  Terra +80 km', 21)
    text(110, 1253, 'Tratteggio bianco: centro ±48 km; fascia 48–64 km destinata al raccordo runtime, assente dai dati qui mostrati.', 22, fill=muted)
    text(110, 1287, 'Tratteggio magenta: giunzioni delle tessere. Orientamento world: Nord in alto, Ovest a destra.', 22, fill=muted)

    def profile(x0, values, title):
        y0=1380; pw=870; ph=230
        text(x0, 1328, title, 27, True)
        for alt in [0, 1000, 2000]:
            yy=y0+ph-alt/2400*ph
            d.line((x0,yy,x0+pw,yy),fill='#d7dcdb',width=1)
            text(x0-12,yy,f'{alt}',19,anchor='rm')
        for v in [-64,-32,0,32,64]:
            xx=x0+(v+64)/128*pw
            d.line((xx,y0,xx,y0+ph),fill='#d7dcdb',width=1)
            text(xx,y0+ph+12,str(v),20,anchor='mt')
        pts=[(x0+i/(n-1)*pw,y0+ph-float(h)/2400*ph) for i,h in enumerate(values)]
        d.polygon([(x0,y0+ph)]+pts+[(x0+pw,y0+ph)],fill='#c8d2bc')
        d.line(pts,fill='#315b3b',width=3)
        d.rectangle((x0,y0,x0+pw,y0+ph),outline=ink,width=1)
        text(x0+pw/2,y0+ph+43,'Distanza world [km] · quota [m]',21,anchor='mt')
    profile(110,height[n//2,:],'C  Profilo Est–Ovest del reticolo, Z = 0')
    profile(1240,height[:,n//2],'D  Profilo Sud–Nord del reticolo, X = 0')
    ocean_count = format(result['mask']['borderConnectedOceanNodes'], ',').replace(',', ' ')
    text(90, 1698, f'Max quota {height.max():.2f} m  |  errore quantizzazione H ≤ 0,0625 m  |  oceano {ocean_count} nodi', 24, True)
    text(90, 1738, 'Fonte e licenza: Copernicus GLO-90 / AWS 2021. Credito completo e disclaimer in NOTICE-COPERNICUS-DEM.txt.', 21, fill=muted)
    path=ROOT/'dem-scientific-view.png'; img.save(path)
    pdf=canvas.Canvas(str(ROOT/'dem-scientific-view.pdf'),pagesize=(1120,895))
    pdf.setTitle('Copernicus GLO-90 — Apuane / Liguria: CDM1 scientific view')
    pdf.drawImage(ImageReader(img),0,0,width=1120,height=895)
    pdf.showPage();pdf.save()
    print(path)

if __name__ == '__main__':
    run()
