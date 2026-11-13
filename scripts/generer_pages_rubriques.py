"""Génère les adresses propres des rubriques (/carte/, /bureaux/, …), data/seo.js et sitemap.xml à partir de index.html.
À relancer après toute modification de index.html : python scripts/generer_pages_rubriques.py
Aucun contenu n'est ajouté : chaque page est la même application, avec sa rubrique affichée d'emblée, son titre, sa description et son adresse canonique."""
import json
import pathlib
import re
import subprocess

R = pathlib.Path(__file__).resolve().parent.parent
BASE = "https://urbanisme.observatoiregentilly.fr"
IMAGE = BASE + "/assets/partage.png"

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
AUTRES = {  # pages autonomes existantes : seules leurs métadonnées sont harmonisées à la main ; elles figurent dans le plan du site
    "/patrimoine.html": "patrimoine.html", "/urbanisme.html": "urbanisme.html", "/releve-pleine-terre.html": "releve-pleine-terre.html",
    "/mentions-legales.html": "mentions-legales.html", "/confidentialite.html": "confidentialite.html"}

h = (R / "index.html").read_text(encoding="utf-8")


def navigation(t):
    """Menu et logo : vraies adresses (/carte/…) ; l'application les intercepte pour naviguer sans recharger."""
    m = re.search(r'<nav id="nav".*?</nav>', t, re.S)
    blk = re.sub(r'href="(?:#|/)([a-z-]*)/?" data-vue="([a-z-]+)"', lambda x: 'href="/" data-vue="accueil"' if x.group(2) == "accueil" else f'href="/{x.group(2)}/" data-vue="{x.group(2)}"', m.group(0))
    t = t.replace(m.group(0), blk, 1)
    return t.replace('<a class="marque" href="#accueil">', '<a class="marque" href="/">', 1)



def chemins_absolus(t):
    t = re.sub(r'(href|src)="(assets|data)/', r'\1="/\2/', t)
    for p in ("releve-pleine-terre.html", "patrimoine.html", "urbanisme.html", "mentions-legales.html", "confidentialite.html"):
        t = t.replace(f'href="{p}"', f'href="/{p}"')
    return t


def tete(t, titre, desc, url):
    t = re.sub(r"<title>.*?</title>", lambda m: f"<title>{titre}</title>", t, count=1, flags=re.S)
    t = re.sub(r'<meta name="description" content="[^"]*">', lambda m: f'<meta name="description" content="{desc}">', t, count=1)
    t = re.sub(r'<link rel="canonical" href="[^"]*">', lambda m: f'<link rel="canonical" href="{url}">', t, count=1)
    t = re.sub(r'<meta property="og:title" content="[^"]*">', lambda m: f'<meta property="og:title" content="{titre}">', t, count=1)
    t = re.sub(r'<meta property="og:description" content="[^"]*">', lambda m: f'<meta property="og:description" content="{desc}">', t, count=1)
    t = re.sub(r'<meta property="og:url" content="[^"]*">', lambda m: f'<meta property="og:url" content="{url}">', t, count=1)
    return t


# 1. page d'accueil : métadonnées cohérentes avec la table (le chemin racine reste index.html)
t0, d0 = RUBRIQUES["accueil"][1:3]
h_acc = tete(h, t0, d0, BASE + "/")
h_acc = navigation(chemins_absolus(h_acc))
(R / "index.html").write_text(h_acc, encoding="utf-8")

# 2. pages des rubriques
for cle, (chemin, titre, desc) in RUBRIQUES.items():
    if cle == "accueil":
        continue
    t = tete(h_acc, titre, desc, BASE + chemin)
    # rubrique affichée d'emblée (sans JavaScript, le bon contenu est visible)
    def vue(m):
        nom = m.group(2)
        return f'<section class="vue" id="vue-{nom}" data-vue="{nom}"' + ("" if nom == cle else " hidden") + ">"
    t = re.sub(r'<section class="vue" id="vue-([a-z-]+)" data-vue="([a-z-]+)"(?: hidden)?>', lambda m: vue(m), t)
    t = t.replace('aria-current="page"', "")
    t = re.sub(r'(<a href="/%s/" data-vue="%s")' % (cle, cle), r'\1 aria-current="page"', t, count=1)
    d = R / cle
    d.mkdir(exist_ok=True)
    (d / "index.html").write_text(t, encoding="utf-8")

# 3. table lue par l'application (titre, description, adresse canonique par rubrique)
seo = {k: {"titre": v[1], "description": v[2], "url": BASE + v[0]} for k, v in RUBRIQUES.items()}
(R / "data/seo.js").write_text("/* Titres, descriptions et adresses canoniques des rubriques. Généré par scripts/generer_pages_rubriques.py. */\nwindow.SEO_PAGES = " + json.dumps(seo, ensure_ascii=False) + ";\n", encoding="utf-8")


# 4. plan du site : uniquement des adresses réelles, avec la date de dernière modification connue de Git
def date(*fichiers):
    d = ""
    for f in fichiers:
        r = subprocess.run(["git", "log", "-1", "--format=%cs", "--", f], cwd=R, capture_output=True, text=True).stdout.strip()
        d = max(d, r)
    return d


lignes = []
corps_accueil = date("index.html", "data/permis.json", "assets/app.js")
for cle, (chemin, _, _) in RUBRIQUES.items():
    lignes.append((BASE + chemin, corps_accueil))
for chemin, f in AUTRES.items():
    lignes.append((BASE + chemin, date(f, "data/urbanisme_donnees.js") if f == "urbanisme.html" else date(f)))
xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
for u, dm in lignes:
    xml += f"  <url><loc>{u}</loc>" + (f"<lastmod>{dm}</lastmod>" if dm else "") + "</url>\n"
xml += "</urlset>\n"
(R / "sitemap.xml").write_text(xml, encoding="utf-8")
print(len(RUBRIQUES) - 1, "pages de rubriques, data/seo.js et sitemap.xml (", len(lignes), "adresses )")
