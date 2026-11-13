"""Génère index.html et les pages des rubriques (/carte/, /bureaux/, …), data/seo.js et sitemap.xml à partir de scripts/gabarit_index.html.
Chaque page ne contient QUE sa rubrique (contenu principal distinct, pas de doublon caché) ; l'accueil contient l'accueil et le cadre des fiches.
À relancer après toute modification du gabarit : python scripts/generer_pages_rubriques.py
Aucun contenu n'est ajouté (hors un titre h1 masqué pour la carte et la liste) : titre, description et adresse canonique propres à chaque page."""
import json
import pathlib
import re
import subprocess

R = pathlib.Path(__file__).resolve().parent.parent
BASE = "https://urbanisme.observatoiregentilly.fr"

RUBRIQUES = {
    "accueil": ("/", "Observatoire de l'urbanisme de Gentilly : permis, PLU et PLUi",
                "Permis de construire, de démolir et d'aménager à Gentilly depuis 2013, règles du PLU et du PLUi, anciennes carrières et patrimoine communal : une carte pour les habitants."),
    "carte": ("/carte/", "Carte des permis de construire à Gentilly depuis 2013 | Observatoire de l'urbanisme",
              "Les permis de construire, de démolir et d'aménager accordés à Gentilly depuis 2013 sur une carte : adresse, logements, surfaces, dates. Données publiques Sitadel."),
    "bureaux": ("/bureaux/", "Bureaux à Gentilly : surfaces autorisées | Observatoire de l'urbanisme",
                "Les surfaces de bureaux créées ou transformées par les permis accordés à Gentilly depuis 2013 : projets, quartiers et évolution, d'après les données publiques Sitadel."),
    "pleine-terre": ("/pleine-terre/", "Pleine terre à Gentilly : estimations des habitants | Observatoire de l'urbanisme",
                     "La part de pleine terre avant et après les projets de construction à Gentilly, estimée par les habitants sur les photographies aériennes de l'IGN."),
    "grands-projets": ("/grands-projets/", "Grands projets de construction à Gentilly | Observatoire de l'urbanisme",
                       "Les grands projets de logements et d'activités autorisés à Gentilly : liste, fiches détaillées et critères retenus."),
    "liste": ("/liste/", "Liste des permis de construire à Gentilly depuis 2013 | Observatoire de l'urbanisme",
              "Recherchez et triez les autorisations d'urbanisme de Gentilly : permis de construire, de démolir, d'aménager et déclarations préalables, par adresse, année ou type."),
    "autrefois": ("/autrefois/", "Gentilly autrefois : photos aériennes anciennes et actuelles | Observatoire",
                  "Comparez les photographies aériennes anciennes et actuelles de Gentilly pour voir comment les constructions et les espaces verts ont évolué."),
    "a-propos": ("/a-propos/", "Sources, méthode et limites de l'Observatoire de l'urbanisme de Gentilly",
                 "D'où viennent les données de l'Observatoire (Sitadel, IGN, cadastre), comment elles sont traitées, leurs limites et comment signaler une erreur."),
}
H1_CACHE = {"carte": "Carte des permis de construire à Gentilly", "liste": "Liste des permis de construire à Gentilly"}
AUTRES = {"/patrimoine.html": ["patrimoine.html"], "/urbanisme.html": ["urbanisme.html", "data/urbanisme_donnees.js"], "/releve-pleine-terre.html": ["releve-pleine-terre.html"],
          "/mentions-legales.html": ["mentions-legales.html"], "/confidentialite.html": ["confidentialite.html"]}
DONNEES_RUBRIQUE = {"accueil": ["data/permis.json"], "carte": ["data/permis.json"], "liste": ["data/permis.json"], "bureaux": ["data/permis.json"], "grands-projets": ["data/permis.json"],
                    "pleine-terre": ["data/releve_pleine_terre.json"], "autrefois": [], "a-propos": []}

gab = (R / "scripts/gabarit_index.html").read_text(encoding="utf-8")
gab = gab.replace('<meta name="robots" content="noindex">\n  ', "", 1)  # le gabarit lui-même n'est pas indexé ; les pages générées le sont


def chemins_absolus(t):
    t = re.sub(r'(href|src)="(assets|data)/', r'\1="/\2/', t)
    for p in ("releve-pleine-terre.html", "patrimoine.html", "urbanisme.html", "mentions-legales.html", "confidentialite.html"):
        t = t.replace(f'href="{p}"', f'href="/{p}"')
    return t


def navigation(t):
    m = re.search(r'<nav id="nav".*?</nav>', t, re.S)
    blk = re.sub(r'href="(?:#|/)[a-z-]*/?" data-vue="([a-z-]+)"', lambda x: 'href="/" data-vue="accueil"' if x.group(1) == "accueil" else f'href="/{x.group(1)}/" data-vue="{x.group(1)}"', m.group(0))
    t = t.replace(m.group(0), blk, 1)
    return t.replace('<a class="marque" href="#accueil">', '<a class="marque" href="/">', 1)


def tete(t, titre, desc, url):
    for motif, nouveau in ((r"<title>.*?</title>", f"<title>{titre}</title>"), (r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{desc}">'),
                           (r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{url}">'), (r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{titre}">'),
                           (r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{desc}">'), (r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{url}">')):
        t = re.sub(motif, lambda m: nouveau, t, count=1, flags=re.S)
    return t


SECTION = re.compile(r'[ \t]*<!--[^>]*-->\n[ \t]*<section class="vue" id="vue-([a-z-]+)" data-vue="[a-z-]+"(?: hidden)?>.*?</section>\n|[ \t]*<section class="vue" id="vue-([a-z-]+)" data-vue="[a-z-]+"(?: hidden)?>.*?</section>\n', re.S)


def garder(t, gardees, visible):
    """Ne conserve que les rubriques `gardees` ; `visible` est affichée d'emblée."""
    def f(m):
        nom = m.group(1) or m.group(2)
        if nom not in gardees:
            return ""
        bloc = m.group(0)
        bloc = re.sub(r'(<section class="vue" id="vue-[a-z-]+" data-vue="[a-z-]+")(?: hidden)?>', lambda x: x.group(1) + ("" if nom == visible else " hidden") + ">", bloc, count=1)
        return bloc
    return SECTION.sub(f, t)


base = navigation(chemins_absolus(gab))
nav_courant = lambda t, cle: re.sub(r'(<a href="%s" data-vue="%s")' % ("/" if cle == "accueil" else f"/{cle}/", cle), r'\1 aria-current="page"', t.replace('aria-current="page"', ""), count=1)

# accueil : accueil + cadre des fiches (affichées par #fiche/…)
t0, d0 = RUBRIQUES["accueil"][1:3]
acc = garder(tete(base, t0, d0, BASE + "/"), {"accueil", "fiche"}, "accueil")
(R / "index.html").write_text(nav_courant(acc, "accueil"), encoding="utf-8")

# pages des rubriques : une seule rubrique chacune
for cle, (chemin, titre, desc) in RUBRIQUES.items():
    if cle == "accueil":
        continue
    t = garder(tete(base, titre, desc, BASE + chemin), {cle}, cle)
    if cle in H1_CACHE:
        t = re.sub(r'(<section class="vue" id="vue-%s"[^>]*>)' % cle, lambda m: m.group(1) + f'\n      <h1 class="h1-cache">{H1_CACHE[cle]}</h1>', t, count=1)
    d = R / cle
    d.mkdir(exist_ok=True)
    (d / "index.html").write_text(nav_courant(t, cle), encoding="utf-8")

seo = {k: {"titre": v[1], "description": v[2], "url": BASE + v[0]} for k, v in RUBRIQUES.items()}
(R / "data/seo.js").write_text("/* Titres, descriptions et adresses canoniques des rubriques. Généré par scripts/generer_pages_rubriques.py. */\nwindow.SEO_PAGES = " + json.dumps(seo, ensure_ascii=False) + ";\n", encoding="utf-8")


def date(*fichiers):
    d = ""
    for f in fichiers:
        r = subprocess.run(["git", "log", "-1", "--format=%cs", "--", f], cwd=R, capture_output=True, text=True).stdout.strip()
        d = max(d, r)
    return d


xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
for cle, (chemin, _, _) in RUBRIQUES.items():
    f_page = "scripts/gabarit_index.html"
    dm = date(f_page, "assets/app.js", *DONNEES_RUBRIQUE[cle]) if cle != "a-propos" else date(f_page, "assets/app.js", "data/permis.json")
    xml += f"  <url><loc>{BASE + chemin}</loc>" + (f"<lastmod>{dm}</lastmod>" if dm else "") + "</url>\n"
for chemin, fs in AUTRES.items():
    dm = date(*fs)
    xml += f"  <url><loc>{BASE + chemin}</loc>" + (f"<lastmod>{dm}</lastmod>" if dm else "") + "</url>\n"
xml += "</urlset>\n"
(R / "sitemap.xml").write_text(xml, encoding="utf-8")
print(len(RUBRIQUES) - 1, "pages de rubriques + accueil, data/seo.js et sitemap.xml")
