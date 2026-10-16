"""Scientific map of unchanged R2 data, one frozen visualization gain3."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np,json,resource,sys,hashlib
from reportlab.pdfgen import canvas
ROOT=Path(__file__).resolve().parent
result=json.loads((ROOT/'result.json').read_text());diag=json.loads((ROOT/'palette-and-diagnostics.json').read_text())
rgb=np.memmap(ROOT/'rgb-linear.f32',dtype='<f4',mode='r',shape=(2048,2048,3))
valid=np.memmap(ROOT/'valid-area.f32',dtype='<f4',mode='r',shape=(2048,2048))
preview=np.empty((2048,2048,3),np.uint8);vimg=np.empty((2048,2048),np.uint8)
for row in range(0,2048,32):
    q=np.clip(rgb[row:row+32].astype(float)*3,0,1)
    srgb=np.where(q<=.0031308,12.92*q,1.055*np.power(q,1/2.4)-.055)
    a=np.floor(srgb*255+.5).astype(np.uint8)
    a[valid[row:row+32]==0]=[208,203,212]
    preview[row:row+32]=a;vimg[row:row+32]=np.floor(valid[row:row+32]*255+.5).astype(np.uint8)
observed=Image.fromarray(np.flipud(preview));coverage=Image.fromarray(np.flipud(vimg))
observed.save(ROOT/'s2-rgb-gain3-srgb.png');coverage.save(ROOT/'s2-validity-gray.png')
font='/System/Library/Fonts/Supplemental/Arial.ttf'
def f(size):return ImageFont.truetype(font,size)
W,H=2380,1480;page=Image.new('RGB',(W,H),'#f5f5f2');d=ImageDraw.Draw(page)
d.text((60,35),'SENTINEL-2 / ESA WORLDCOVER 2021',font=f(38),fill='#172128')
d.text((60,88),'RGB osservato annuale e area valida — stesso dominio 128 × 128 km di Cloudia',font=f(25),fill='#38484e')
S=1024;top=185;lefts=[80,1270]
for left,title,img in [(lefts[0],'Riflettanza RGB osservata · gain globale 3 + OETF sRGB',observed),(lefts[1],'Frazione di area valida · 0% nero / 100% bianco',coverage.convert('RGB'))]:
    d.text((left,145),title,font=f(23),fill='#172128')
    page.paste(img.resize((S,S),Image.Resampling.LANCZOS),(left,top))
    d.rectangle((left,top,left+S,top+S),outline='#68757b',width=1)
    for i,label in [(0,'−64'),(256,'−32'),(512,'0'),(768,'32'),(1024,'64')]:
        d.line((left+i,top+S,left+i,top+S+8),fill='#38484e',width=2)
        d.text((left+i-18,top+S+13),label,font=f(19),fill='#38484e')
        d.line((left-8,top+S-i,left,top+S-i),fill='#38484e',width=2)
        d.text((left-55,top+S-i-10),label,font=f(19),fill='#38484e')
    d.text((left+340,top+S+45),'X verso Ovest [km] →',font=f(22),fill='#172128')
    d.text((left+8,top+12),'N ↑  Z verso Nord',font=f(20),fill='#172128',stroke_width=1,stroke_fill='#f5f5f2')
    # Geographic tile seams are annotations, not an image correction.
    d.line((left+S//2,top,left+S//2,top+S),fill='#b87329',width=1)
    d.line((left,top+S//2,left+S,top+S//2),fill='#b87329',width=1)
lines=[
 '2048² celle da 62,5 m · overview4 sorgente ≈37,1 m N/S ×26,7 m E/O · origine 44°N 10°E · equirettangolare locale',
 f'Area valida {result["validityStats"]["validAreaProjectedKm2"]:,.2f} km² ({result["validityStats"]["mean"]*100:.3f}%) · celle completamente invalide in grigio-lilla nella mappa RGB',
 'RGB non è albedo: illuminazione e ombre sono già contenute nel composito annuale; nessuna rimozione fisica o livellamento fra tessere.',
 'Gate valido prefissato: tutte le 4 bande DN in [1,10000]. Acqua e NoData sono distinti in WorldCover; nessun classificatore nuvole SCL disponibile.',
 'Sono conservati anche coltivi e aree costruite osservati. Linee ocra = confini dei quattro COG, non discontinuità corrette.'
]
for i,line in enumerate(lines):d.text((60,1290+i*31),line,font=f(21),fill='#38484e')
page.save(ROOT/'sentinel2-scientific-view.png')
pdf=canvas.Canvas(str(ROOT/'sentinel2-scientific-view.pdf'),pagesize=(1190,740))
pdf.drawImage(str(ROOT/'sentinel2-scientific-view.png'),0,0,width=1190,height=740);pdf.showPage();pdf.save()
peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
if sys.platform!='darwin':peak*=1024
assert peak<=384*1024**2
record={'status':'FIXED_GAIN3_SRGB_VISUALIZATION_ONLY','scriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
 'sourceRgbSha256':result['rgb']['sha256'],'sourceValiditySha256':result['validity']['sha256'],
 'figureDownsample':'PIL Lanczos2048→1024 display only; full2048PNG also retained',
 'northUp':True,'westRight':True,'assetLinearEncodingUnchanged':True,'peakRssBytes':peak,
 'clippedChannelsAtGain3':diag['globalHeuristics']['visualGain3ClippedChannels'],
 'invalidCellDisplayRGB':[208,203,212],'limits':'No exposure retuning; visualization is not an albedo or renderer photograph.'}
(ROOT/'figure-record.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
