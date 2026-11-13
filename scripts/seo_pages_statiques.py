"""Harmonise les métadonnées (titre, description, Open Graph, Twitter) et ajoute une navigation entre rubriques sur les pages autonomes.
Idempotent. Usage : python scripts/seo_pages_statiques.py  (dans le dépôt de l'observatoire)."""
import pathlib
import re

R = pathlib.Path(__file__).resolve().parent.parent
BASE = "https://urbanisme.observatoiregentilly.fr"
IMG = BASE + "/assets/partage.png"
PAGES = {
    "patrimoine.html": ("Patrimoine communal de Gentilly : parcelles et locaux de la Commune | Observatoire de l'urbanisme", None),
    "releve-pleine-terre.html": ("Relevé de la pleine terre à Gentilly | Observatoire de l'urbanisme", None),
    "mentions-legales.html": (None, None),
    "confidentialite.html": (None, None),
}
NAV = ('<nav class="nav-sec" aria-label="Autres rubriques"><a href="/">Accueil</a> <a href="/carte/">Carte des permis</a> <a href="/urbanisme.html">Règles du PLUi</a> '
       '<a href="/patrimoine.html">Patrimoine communal</a> <a href="/releve-pleine-terre.html">Pleine terre</a> <a href="/liste/">Liste des permis</a> <a href="/a-propos/">À propos</a></nav>')
STYLE = '<style>.nav-sec{display:flex;flex-wrap:wrap;gap:6px 16px;padding:8px 14px;font-size:14px;border-bottom:1px solid rgba(128,128,128,.3)}.nav-sec a{color:inherit;text-decoration:underline;display:inline-block;padding:8px 2px}</style>'


def meta(t, titre, desc, url):
    bloc = (f'<meta property="og:type" content="website">\n<meta property="og:site_name" content="Observatoire de l\'urbanisme de Gentilly">\n'
            f'<meta property="og:title" content="{titre}">\n<meta property="og:description" content="{desc}">\n<meta property="og:url" content="{url}">\n'
            f'<meta property="og:locale" content="fr_FR">\n<meta property="og:image" content="{IMG}">\n<meta property="og:image:width" content="1200">\n'
            f'<meta property="og:image:height" content="630">\n<meta property="og:image:alt" content="Observatoire de l\'urbanisme de Gentilly">\n<meta name="twitter:card" content="summary_large_image">')
    t = re.sub(r'<meta property="og:[^>]*>\s*|<meta name="twitter:[^>]*>\s*', "", t)
    return re.sub(r'(<link rel="canonical" href="[^"]*">)', lambda m: m.group(1) + "\n" + bloc, t, count=1)


for f, (titre, _) in PAGES.items():
    p = R / f
    t = p.read_text(encoding="utf-8")
    if titre:
        t = re.sub(r"<title>.*?</title>", lambda m: f"<title>{titre}</title>", t, count=1, flags=re.S)
    titre_f = re.search(r"<title>(.*?)</title>", t, re.S).group(1)
    desc = re.search(r'<meta name="description" content="([^"]*)">', t).group(1)
    url = re.search(r'<link rel="canonical" href="([^"]*)">', t).group(1)
    t = meta(t, titre_f, desc, url)
    if 'class="nav-sec"' not in t:
        t = t.replace("</head>", STYLE + "\n</head>", 1)
        t = re.sub(r"(<body[^>]*>)", lambda m: m.group(1) + "\n" + NAV, t, count=1)
    p.write_text(t, encoding="utf-8")
    print(f, "ok")
