"""Mesure de la végétation sur les terrains, à partir des photos aériennes infrarouges de l'IGN.

Sur une photo infrarouge couleur (IRC), la végétation vivante réfléchit fortement le
proche infrarouge : elle apparaît en rouge. On calcule pour chaque pixel un indice de
végétation (NDVI ≈ (PIR - R) / (PIR + R), soit (rouge - vert) / (rouge + vert) dans
l'image IRC) et l'on compte les pixels végétalisés à l'intérieur des parcelles.

Les campagnes photo n'ont pas la même luminosité ni le même rendu des couleurs (celle de
2021 est nettement plus sombre). Le seuil de l'indice est donc calculé pour chaque photo
par la méthode d'Otsu sur l'ensemble de la commune : il sépare au mieux les deux
populations de pixels (végétation et surfaces minérales), ce qui rend les années
comparables.

C'est une estimation de la surface végétalisée visible du ciel, qui sert d'indicateur de
la pleine terre : un arbre au-dessus d'un parking compte comme végétation, un sol nu ou
une toiture végétalisée sont mal distingués. Les ordres de grandeur sont fiables, pas le
mètre carré près.

Nécessite Pillow (pip install pillow).
"""

import io
import math
import time
import urllib.error
import urllib.request

from PIL import Image, ImageChops, ImageDraw

WMTS = ("https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER={couche}"
        "&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}")
Z_PARCELLE = 18   # environ 0,4 m par pixel à Gentilly
Z_COMMUNE = 17    # environ 0,8 m par pixel
SEUIL_LUMINOSITE = 25  # écarte les ombres profondes, où l'indice n'est pas fiable

_tuiles = {}


def _octets(url, essais=3):
    req = urllib.request.Request(url, headers={"User-Agent": "observatoire-urbanisme-gentilly/1.0"})
    for essai in range(essais):
        try:
            with urllib.request.urlopen(req, timeout=60) as rep:
                return rep.read()
        except urllib.error.HTTPError as e:
            if e.code in (400, 404):
                return None
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(2 * (essai + 1))
    return None


def tuile(couche, z, x, y):
    cle = (couche, z, x, y)
    if cle not in _tuiles:
        data = _octets(WMTS.format(couche=couche, z=z, x=x, y=y))
        _tuiles[cle] = Image.open(io.BytesIO(data)).convert("RGB") if data else None
        time.sleep(0.03)
    return _tuiles[cle]


def pixel(lon, lat, z):
    n = 256 * 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def disponible(couche, lon, lat):
    """La couche couvre-t-elle ce point ?"""
    x, y = pixel(lon, lat, Z_COMMUNE)
    return _octets(WMTS.format(couche=couche, z=Z_COMMUNE, x=int(x // 256), y=int(y // 256))) is not None


def _mosaique(polys, couche, z):
    pts = [pixel(lon, lat, z) for poly in polys for anneau in poly for lon, lat in anneau]
    tx0, tx1 = int(min(p[0] for p in pts) // 256), int(max(p[0] for p in pts) // 256)
    ty0, ty1 = int(min(p[1] for p in pts) // 256), int(max(p[1] for p in pts) // 256)
    mosaique = Image.new("RGB", ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256))
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            t = tuile(couche, z, tx, ty)
            if t is None:
                return None, None
            mosaique.paste(t, ((tx - tx0) * 256, (ty - ty0) * 256))
    masque = Image.new("L", mosaique.size, 0)
    dessin = ImageDraw.Draw(masque)
    for poly in polys:
        for i, anneau in enumerate(poly):
            pts = [(px - tx0 * 256, py - ty0 * 256) for px, py in (pixel(lon, lat, z) for lon, lat in anneau)]
            if len(pts) >= 3:
                dessin.polygon(pts, fill=255 if i == 0 else 0)
    return mosaique, masque


def seuil_otsu(geom, couche, z=Z_COMMUNE):
    """Seuil d'indice de végétation propre à une photo, calculé sur tout le polygone (la commune)."""
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    mosaique, masque = _mosaique(polys, couche, z)
    if mosaique is None:
        return None
    hist = [0] * 200
    pixels, dans = mosaique.getdata(), masque.getdata()
    for i in range(0, len(pixels), 3):  # un pixel sur trois suffit
        if dans[i]:
            r, g, _ = pixels[i]
            if r > SEUIL_LUMINOSITE:
                hist[min(199, int(((r - g) / (r + g) + 1) * 100))] += 1
    total, somme = sum(hist), sum(i * h for i, h in enumerate(hist))
    poids = cumul = 0
    meilleur = (0, 100)
    for t, h in enumerate(hist):
        poids += h
        if not poids or poids == total:
            continue
        cumul += t * h
        ecart = poids * (total - poids) * (cumul / poids - (somme - cumul) / (total - poids)) ** 2
        if ecart > meilleur[0]:
            meilleur = (ecart, t)
    return round(meilleur[1] / 100 - 1, 3)


def mesurer(geom, couche, seuil, z=Z_PARCELLE):
    """Surface végétalisée et surface totale (m²) d'un polygone GeoJSON (lon, lat).
    Renvoie None si la photo ne couvre pas tout le polygone."""
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    mosaique, masque = _mosaique(polys, couche, z)
    if mosaique is None:
        return None
    r, g, _ = mosaique.split()
    # (r - g) / (r + g) > seuil  <=>  r × (1 - seuil) > g × (1 + seuil)
    a = int(round((1 - seuil) * 100))
    b = int(round((1 + seuil) * 100))
    vert = ImageChops.subtract(r.point(lambda v: v * a // 100), g.point(lambda v: v * b // 100))
    vert = vert.point(lambda v: 255 if v > 0 else 0)
    clair = r.point(lambda v: 255 if v > SEUIL_LUMINOSITE else 0)
    vert = ImageChops.multiply(ImageChops.multiply(vert, clair), masque)
    lat_moy = sum(lat for poly in polys for lon, lat in poly[0]) / sum(len(poly[0]) for poly in polys)
    m2_par_pixel = (40075016.686 * math.cos(math.radians(lat_moy)) / (256 * 2 ** z)) ** 2
    return round(vert.histogram()[255] * m2_par_pixel), round(masque.histogram()[255] * m2_par_pixel)
