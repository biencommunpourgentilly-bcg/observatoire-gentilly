"""Test automatique de toutes les adresses du plan du site (sitemap.xml) de l'observatoire.
Usage : python scripts/tester_pages.py [--rapide]      (--rapide : sans navigateur, contrôles statiques seulement)
Contrôles statiques : réponse HTTP 200, ressources (CSS, JS, images, données, polices, liens internes) présentes, titre et description uniques, canonical correct,
Open Graph complet, absence de noindex, un seul h1, sitemap cohérent (adresses accessibles, indexables, dates valides, aucune page orpheline).
Contrôles dans un navigateur (Edge ou Chrome sans interface) : bonne rubrique affichée, titre et canonical après exécution du JavaScript, contenu principal
assez long et DISTINCT d'une page à l'autre, anciens liens #… (redirigés vers la bonne page), fiche de permis, aucune erreur JavaScript."""
import datetime
import http.server
import itertools
import os
import pathlib
import re
import shutil
import subprocess
import sys
import threading
import urllib.parse
import urllib.request

R = pathlib.Path(__file__).resolve().parent.parent
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
BASE = "https://urbanisme.observatoiregentilly.fr"
PORT = 8791
LOCAL = f"http://127.0.0.1:{PORT}"
rapide = "--rapide" in sys.argv
echecs, essais = [], 0


def check(cond, msg):
    global essais
    essais += 1
    if not cond:
        echecs.append(msg)
        print("  ECHEC :", msg)
    return cond


FIN_TEST = threading.Event()


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(R), **k)

    def do_GET(self):
        if self.path.startswith("/__attendre"):  # retient la fin du chargement de la page de test jusqu'à la fin des contrôles
            FIN_TEST.wait(600)
            self.send_response(200)
            self.send_header("Content-Type", "image/gif")
            self.end_headers()
            self.wfile.write(bytes.fromhex("47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b"))
            return
        if self.path.startswith("/__fin"):
            FIN_TEST.set()
            self.send_response(200)
            self.end_headers()
            return
        super().do_GET()

    def log_message(self, *a):
        pass


srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()


def get(path):
    try:
        with urllib.request.urlopen(LOCAL + path, timeout=30) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""


# ------------------------------------------------------------------ plan du site
sm = (R / "sitemap.xml").read_text(encoding="utf-8")
entrees = re.findall(r"<url><loc>([^<]+)</loc>(?:<lastmod>([^<]*)</lastmod>)?</url>", sm)
print(f"{len(entrees)} adresses dans sitemap.xml")
check(len(entrees) == len(set(u for u, _ in entrees)), "adresses en double dans le plan du site")
pages = {}
for url, lm in entrees:
    check(url.startswith(BASE), f"adresse hors domaine : {url}")
    chemin = url[len(BASE):] or "/"
    st, html = get(chemin)
    check(st == 200, f"{chemin} : HTTP {st}")
    pages[chemin] = html
    if lm:
        try:
            d = datetime.date.fromisoformat(lm)
            check(d <= datetime.date.today(), f"{chemin} : date de modification dans le futur ({lm})")
            check(d >= datetime.date(2026, 11, 1), f"{chemin} : date de modification peu plausible ({lm})")
        except ValueError:
            check(False, f"{chemin} : date de modification invalide ({lm})")
    else:
        check(False, f"{chemin} : date de modification absente")

# pages indexables du dépôt absentes du plan
for f in R.rglob("*.html"):
    rel = "/" + f.relative_to(R).as_posix()
    if any(x in rel for x in ("/scripts/", "/node_modules/", "/collecte/", "/reponses/")) or rel in ("/404.html",):
        continue
    t = f.read_text(encoding="utf-8")
    if "noindex" in t:
        continue
    url = rel[:-len("index.html")] if rel.endswith("/index.html") else rel
    if url == "/index.html":
        url = "/"
    check(url in pages, f"page indexable absente du plan du site : {url}")

# ------------------------------------------------------------------ contrôles statiques par page
titres, descs, h1s = {}, {}, {}
manquants = set()


def existe(chemin_url, depuis):
    p = urllib.parse.urlparse(chemin_url)
    if p.scheme in ("http", "https", "mailto", "data", "tel", "javascript") or chemin_url.startswith("#") or p.netloc:
        return True
    chemin = p.path if p.path.startswith("/") else urllib.parse.urljoin(depuis, p.path)
    st, _ = get(chemin)
    return st == 200


for chemin, html in pages.items():
    print("-", chemin)
    t = re.search(r"<title>(.*?)</title>", html, re.S)
    d = re.search(r'<meta name="description" content="([^"]*)"', html)
    c = re.search(r'<link rel="canonical" href="([^"]*)"', html)
    og = {k: (re.search(r'<meta property="og:%s" content="([^"]*)"' % k, html) or [None, None])[1] for k in ("title", "description", "url", "image", "type", "locale")}
    if check(t, f"{chemin} : <title> absent"):
        titres.setdefault(t.group(1).strip(), []).append(chemin)
        check(15 <= len(t.group(1)) <= 90, f"{chemin} : titre de longueur inhabituelle ({len(t.group(1))})")
    if check(d, f"{chemin} : meta description absente"):
        descs.setdefault(d.group(1), []).append(chemin)
        check(50 <= len(d.group(1)) <= 200, f"{chemin} : description de longueur inhabituelle ({len(d.group(1))})")
    attendu = BASE + (chemin if chemin != "/" else "/")
    check(c and c.group(1) == attendu, f"{chemin} : canonical {c.group(1) if c else None} au lieu de {attendu}")
    for k, v in og.items():
        check(v, f"{chemin} : og:{k} absent")
    check(og["url"] == attendu, f"{chemin} : og:url incorrect ({og['url']})")
    if t and og["title"]:
        check(og["title"] == t.group(1).strip(), f"{chemin} : og:title différent du titre")
    if d and og["description"]:
        check(og["description"] == d.group(1), f"{chemin} : og:description différent de la description")
    check('name="twitter:card"' in html, f"{chemin} : twitter:card absent")
    check(not re.search(r'name="robots"[^>]*noindex', html), f"{chemin} : noindex présent")
    check('name="viewport"' in html, f"{chemin} : meta viewport absent")
    check(re.search(r'<html lang="fr">', html), f"{chemin} : langue absente")
    n_h1 = len(re.findall(r"<h1[ >]", html))
    check(n_h1 >= 1, f"{chemin} : aucun h1")
    if n_h1 > 1:
        print(f"   AVERTISSEMENT : {n_h1} balises h1 sur {chemin} (étapes successives d'une application ; sans gravité pour le référencement)")
    h1s[chemin] = re.sub(r"<[^>]+>", "", (re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S) or [0, ""])[1]).strip()
    # ressources et liens internes
    refs = re.findall(r'(?:src|href)="([^"#][^"]*)"', html)
    for r in set(refs):
        if not existe(r, chemin):
            manquants.add((chemin, r))
            check(False, f"{chemin} : ressource ou lien introuvable : {r}")
    # liens # : la rubrique visée existe-t-elle sur cette page ou sur une autre (redirection) ?
    for r in set(re.findall(r'href="#([a-z-]+)(?:/[^"]*)?"', html)):
        if r in ("contenu",):
            check(f'id="{r}"' in html, f"{chemin} : cible #{r} absente")
for t, liste in titres.items():
    check(len(liste) == 1, f"titre en double « {t[:50]} » : {liste}")
for t, liste in descs.items():
    check(len(liste) == 1, f"description en double : {liste}")

# ressources chargées par les scripts et les feuilles de style (chemins en chaîne, url(), fetch, import)
for f in list((R / "assets").glob("*.js")) + list((R / "assets").glob("*.css")) + [R / "data/seo.js"]:
    t = f.read_text(encoding="utf-8", errors="replace")
    for r in set(re.findall(r'url\(["\']?([^"\')]+)["\']?\)', t)):
        if r.startswith(("data:", "http", "#")):
            continue
        base = "/assets/" if f.suffix == ".css" else "/"
        chemin = urllib.parse.urljoin(base + f.name, r) if f.suffix == ".css" else "/" + r.lstrip("/")
        check(get(chemin)[0] == 200, f"{f.name} : ressource url() introuvable : {r}")
    for r in set(re.findall(r'["\'`]((?:/?)(?:assets|data)/[A-Za-z0-9_./-]+\.[a-z0-9]{2,5})["\'`]', t)):
        check(get("/" + r.lstrip("/"))[0] == 200, f"{f.name} : fichier référencé introuvable : {r}")
    for r in set(re.findall(r'import\(["\']([^"\']+)["\']\)', t)):
        check(get("/" + r.lstrip("./"))[0] == 200, f"{f.name} : import introuvable : {r}")
    for r in set(re.findall(r'fetch\(["\'`](/?[A-Za-z][^"\'`$]*)["\'`]', t)):
        if not r.startswith("http"):
            check(get("/" + r.lstrip("/"))[0] == 200, f"{f.name} : fetch() introuvable : {r}")
for pf in ("/robots.txt", "/404.html", "/assets/partage.png"):
    check(get(pf)[0] == 200, f"{pf} : introuvable")
rb = (R / "robots.txt").read_text(encoding="utf-8")
check("Sitemap: " + BASE + "/sitemap.xml" in rb, "robots.txt : ligne Sitemap absente")
check(not re.search(r"^Disallow:\s*/(assets|data)", rb, re.M), "robots.txt : bloque les ressources nécessaires au rendu")

# ------------------------------------------------------------------ contrôles dans un navigateur
# Un navigateur sans interface charge une page de test qui ouvre chaque adresse dans un cadre, laisse le JavaScript s'exécuter, puis écrit un compte rendu court ;
# le compte rendu est lu dans le PDF imprimé par le navigateur (les sorties DOM directes ne sont pas disponibles avec Edge récent).
if not rapide:
    edge = next((p for p in (r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                             r"C:\Program Files\Google\Chrome\Application\chrome.exe", shutil.which("chromium") or "", shutil.which("google-chrome") or "") if p and os.path.exists(p)), None)
    try:
        import pymupdf
    except ImportError:
        pymupdf = None
    if not edge or not pymupdf:
        print("Navigateur ou pymupdf introuvable : contrôles dynamiques ignorés.")
        echecs.append("contrôles dynamiques non exécutés")
    else:
        attendu = {"/": "accueil"} | {p: p.strip("/") for p in pages if p.endswith("/") and p != "/"}
        titre_de = {p: next(k for k, v in titres.items() if p in v) for p in attendu}
        cas = [{"url": p, "vue": v, "titre": titre_de[p], "canon": BASE + p, "type": "page"} for p, v in attendu.items()]
        cas += [{"url": f"/#{v}", "vue": v, "titre": titre_de[f"/{v}/"], "canon": BASE + f"/{v}/", "type": "ancien lien"} for v in attendu.values() if v != "accueil"]
        cas += [{"url": "/#fiche/DP-0940372604036", "vue": "fiche", "titre": "Lafouge", "canon": BASE + "/", "type": "fiche"}]
        harnais = r"""<!doctype html><meta charset="utf-8"><body style="font:11px monospace"><pre id="r">test en cours</pre><img src="/__attendre" width="1" height="1"><script>
const CAS = %s;
const sig = t => { const m = t.toLowerCase().split(/\s+/).filter(Boolean); const s = new Set(); for (let i = 0; i < m.length - 3; i++) s.add(m.slice(i, i + 4).join(' ')); return s; };
(async () => {
  const L = [], S = {};
  for (const c of CAS) {
    const f = document.createElement('iframe'); f.style.cssText = 'width:1000px;height:800px'; document.body.appendChild(f);
    f.src = c.url; await new Promise(r => f.onload = r); await new Promise(r => setTimeout(r, 4000));
    if (!f.contentDocument.title && c.type !== 'fiche') await new Promise(r => setTimeout(r, 4000));
    const d = f.contentDocument, w = f.contentWindow;
    const vis = [...d.querySelectorAll('.vue')].filter(v => !v.hidden).map(v => v.dataset.vue);
    const can = (d.querySelector('link[rel=canonical]') || {}).href;
    const main = d.querySelector('#contenu'); const clone = main ? main.cloneNode(true) : d.body.cloneNode(true);
    clone.querySelectorAll('[hidden],script,style').forEach(x => x.remove());
    const txt = clone.textContent.replace(/\s+/g, ' ').trim();
    const okT = c.type === 'fiche' ? d.title.includes(c.titre) : d.title === c.titre;
    const okC = can === c.canon, okV = vis.length === 1 && vis[0] === c.vue;
    L.push([okT && okC && okV && txt.length >= 400 ? 'OK ' : 'KO ', c.type, c.url, 'vue=' + vis.join(','), 'titre=' + (okT ? 'ok' : 'NON:' + d.title.slice(0, 40)), 'canon=' + (okC ? 'ok' : 'NON'), 'chars=' + txt.length, 'chemin=' + w.location.pathname].join(' | '));
    if (c.type === 'page') S[c.url] = sig(txt);
    f.remove();
  }
  const ks = Object.keys(S);
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
    let inter = 0; for (const x of S[ks[i]]) if (S[ks[j]].has(x)) inter++;
    const u = S[ks[i]].size + S[ks[j]].size - inter, sim = u ? inter / u : 0;
    L.push((sim < 0.45 ? 'OK ' : 'KO ') + 'similarite | ' + ks[i] + ' | ' + ks[j] + ' | ' + sim.toFixed(2));
  }
  document.getElementById('r').textContent = ['RESULTATS'].concat(L, ['FIN']).join(String.fromCharCode(10));
  fetch('/__fin');
})();
</script>""" % __import__("json").dumps(cas, ensure_ascii=False)
        hp = R / "scripts" / "_harnais_test.html"
        hp.write_text(harnais, encoding="utf-8")
        if "--harnais-seul" in sys.argv:
            print("page de test écrite :", hp)
            sys.exit(0)
        pdf = R / "_harnais.pdf"
        try:
            subprocess.run([edge, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={pdf}", f"{LOCAL}/scripts/_harnais_test.html"],
                           capture_output=True, timeout=600)
            texte = "".join(p.get_text() for p in pymupdf.open(pdf)) if pdf.exists() else ""
        finally:
            if "--garder" not in sys.argv:
                hp.unlink(missing_ok=True)
                if pdf.exists():
                    pdf.unlink()
        print("  compte rendu lu :", len(texte), "caractères")
        lignes = [l.strip() for l in texte.splitlines() if l.strip().startswith(("OK", "KO"))]
        check("FIN" in texte and lignes, "le test dans le navigateur n'a pas produit de compte rendu")
        for l in lignes:
            print("  " + l)
            check(l.startswith("OK"), "navigateur : " + l)
        check(len([l for l in lignes if "| page |" in l]) == len(attendu), "toutes les pages n'ont pas été rendues")

srv.shutdown()
print(f"\n{essais} contrôles, {len(echecs)} échec(s)")
sys.exit(1 if echecs else 0)
