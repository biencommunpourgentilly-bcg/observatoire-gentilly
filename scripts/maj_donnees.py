#!/usr/bin/env python3
"""Met à jour les données de l'Observatoire de l'urbanisme de Gentilly.

Source : base Sitadel du ministère de la Transition écologique (SDES), via l'API
publique DiDo, sans authentification. Les autorisations sont localisées par leurs
parcelles cadastrales (API Carto de l'IGN), ou à défaut par leur adresse
(Géoplateforme, Base Adresse Nationale). Le script repère aussi les photos aériennes
de l'IGN disponibles pour Gentilly, utilisées par le site et par le relevé de la pleine terre.

Usage : python scripts/maj_donnees.py
Produit : data/permis.js (lu par le site), data/permis.json et data/permis.csv
(téléchargements), en gardant un cache des localisations dans data/cache_geocodage.json.

Uniquement la bibliothèque standard de Python 3.9+.
"""

import csv
import datetime as dt
import json
import math
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

COMMUNE = "94037"  # code INSEE de Gentilly
NOM_COMMUNE = "Gentilly"
DATASET = "6513f0189d7d312c80ec5b5b"
API_DIDO = "https://data.statistiques.developpement-durable.gouv.fr/dido/api/v1"
API_CADASTRE = "https://apicarto.ign.fr/api/cadastre/parcelle"
API_ADRESSE = "https://data.geopf.fr/geocodage/search"
API_COMMUNE = f"https://geo.api.gouv.fr/communes/{COMMUNE}?format=geojson&geometry=contour"
URL_DATASET = f"https://www.statistiques.developpement-durable.gouv.fr/catalogue?page=dataset&datasetId={DATASET}"

# Emprise large autour de Gentilly, pour écarter une localisation aberrante.
EMPRISE = {"lat": (48.80, 48.83), "lon": (2.32, 2.37)}

# Seuils d'un « grand projet » (repris dans la page À propos du site).
SEUIL_LOGEMENTS = 10
SEUIL_SURFACE = 1000

RACINE = pathlib.Path(__file__).resolve().parent.parent
DATA = RACINE / "data"
CACHE = DATA / "cache_geocodage.json"

ETATS = {2: "autorise", 4: "annule", 5: "commence", 6: "termine"}
NATURES = {
    1: "Nouvelle construction",
    2: "Transformation sans changement de surface",
    3: "Transformation avec extension",
    4: "Transformation avec diminution de surface",
    5: "Extension sans transformation",
    6: "Diminution de surface",
}
NATURES_DECLAREES = {1: "Nouvelle construction", 2: "Travaux sur construction existante"}
RESIDENCES = {
    1: "Résidence pour personnes âgées",
    2: "Résidence étudiante",
    3: "Résidence de tourisme",
    4: "Résidence hôtelière à vocation sociale",
    5: "Résidence sociale",
    6: "Résidence pour personnes handicapées",
    7: "Autre résidence",
    8: "Projet mixte (logements et résidence)",
}
SERVICES_PUBLICS = {
    1: "Transport",
    2: "Enseignement et recherche",
    3: "Santé",
    4: "Action sociale",
    5: "Ouvrage spécial",
    6: "Culture et loisirs",
}
UTILISATIONS = {1: "Occupation personnelle", 2: "Vente", 3: "Location", 4: "Vente et location"}
# Sous-destinations des locaux non résidentiels (fichier « locaux »).
LOCAUX = [
    ("BUR", "Bureaux"),
    ("COM", "Commerce et services"),
    ("HEB", "dont hôtels"),
    ("PUB", "Équipements publics ou d'intérêt collectif"),
    ("IND", "Industrie"),
    ("ENT", "Entrepôts"),
    ("AGR", "Agriculture"),
]


# --------------------------------------------------------------------------- HTTP

def lire_json(url, essais=4):
    req = urllib.request.Request(url, headers={"User-Agent": "observatoire-urbanisme-gentilly/1.0"})
    for essai in range(essais):
        try:
            with urllib.request.urlopen(req, timeout=120) as rep:
                return json.load(rep)
        except urllib.error.HTTPError as e:
            if e.code in (400, 404):
                raise
            erreur = e
        except (urllib.error.URLError, TimeoutError) as e:
            erreur = e
        time.sleep(2 * (essai + 1))
    raise RuntimeError(f"Échec de la requête {url} : {erreur}")


# --------------------------------------------------------------------------- Sitadel

def fichiers_sitadel():
    """Repère les 4 fichiers du jeu de données et leur dernier millésime."""
    meta = lire_json(f"{API_DIDO}/datasets/{DATASET}")
    trouves = {}
    for f in meta["datafiles"]:
        titre = f["title"].lower()
        if "logements" in titre:
            cle = "logements"
        elif "locaux" in titre:
            cle = "locaux"
        elif "aménager" in titre:
            cle = "amenager"
        elif "démolir" in titre:
            cle = "demolir"
        else:
            continue
        millesime = max(m["millesime"] for m in f["millesimes"])
        trouves[cle] = (f["rid"], millesime)
    manquants = {"logements", "locaux", "amenager", "demolir"} - set(trouves)
    if manquants:
        raise RuntimeError(f"Fichiers Sitadel introuvables : {', '.join(sorted(manquants))}")
    return meta, trouves


def lignes_commune(rid, millesime):
    q = urllib.parse.urlencode({"millesime": millesime, "COMM": f"eq:{COMMUNE}"})
    return lire_json(f"{API_DIDO}/datafiles/{rid}/json?{q}")


# --------------------------------------------------------------------------- Normalisation

def entier(v):
    if v in (None, "", False):
        return 0
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


def code(v):
    """Code numérique Sitadel, parfois publié en texte."""
    n = entier(v)
    return n or None


def date_iso(v):
    if not v:
        return None
    s = str(v)
    if len(s) == 6 and s.isdigit():  # AAAAMM
        return f"{s[:4]}-{s[4:]}"
    return s[:10]


def adresse(r):
    num = (r.get("ADR_NUM_TER") or "").strip()
    voie = " ".join((r.get("ADR_LIBVOIE_TER") or "").split())
    lieudit = " ".join((r.get("ADR_LIEUDIT_TER") or "").split())
    principale = " ".join(x for x in (num, voie) if x)
    if not principale:
        return lieudit
    if lieudit and lieudit != principale:
        return f"{principale} ({lieudit})"
    return principale


def parcelles(r):
    res = []
    for i in (1, 2, 3):
        sec, num = r.get(f"SEC_CADASTRE{i}"), r.get(f"NUM_CADASTRE{i}")
        if sec and num not in (None, ""):
            p = f"{str(sec).strip().upper()} {entier(num)}"
            if p not in res:
                res.append(p)
    return res


def categorie_demandeur(r):
    cj = str(r.get("CJ_DEM") or "")
    if not r.get("DENOM_DEM"):
        return "particulier"
    if cj.startswith("7"):
        return "public"
    if cj.startswith(("5", "6")):
        return "societe"
    if cj.startswith("9"):
        return "association"
    return "personne_morale"


def fusionner(a, b):
    """Complète l'enregistrement a avec les valeurs non vides de b."""
    for k, v in b.items():
        if v not in (None, "", 0, False) and a.get(k) in (None, "", 0, False):
            a[k] = v
    return a


def normaliser(type_dau, num, r, r_locaux=None):
    """Construit la fiche d'une autorisation à partir des lignes brutes Sitadel."""
    etat = ETATS.get(code(r.get("ETAT_DAU") or r.get("ETAT_PD") or r.get("ETAT_PA")), "autorise")
    p = {
        "id": f"{type_dau}-{num}",
        "num": num,
        "type": type_dau,
        "etat": etat,
        "date_depot": date_iso(r.get("DR_DEPOT")),
        "annee_depot": entier(r.get("AN_DEPOT")) or None,
        "date_autorisation": date_iso(r.get("DATE_REELLE_AUTORISATION") or r.get("DPC_AUT")),
        "date_chantier": date_iso(r.get("DATE_REELLE_DOC")),
        "date_achevement": date_iso(r.get("DATE_REELLE_DAACT")),
        "maj_sitadel": date_iso(r.get("DPC_DERN")),
        "demandeur": " ".join((r.get("DENOM_DEM") or "").split()) or None,
        "demandeur_categorie": categorie_demandeur(r),
        "siren": r.get("SIREN_DEM") or None,
        "architecte": bool(r.get("REC_ARCHI")) if r.get("REC_ARCHI") is not None else None,
        "adresse": adresse(r),
        "parcelles": parcelles(r),
        "terrain_m2": entier(r.get("SUPERFICIE_TERRAIN")) or None,
        "zone": "ZAC" if code(r.get("ZONE_OP")) == 2 else ("Lotissement" if code(r.get("ZONE_OP")) == 1 else None),
    }
    if type_dau in ("PC", "DP"):
        nature = NATURES.get(code(r.get("NATURE_PROJET_COMPLETEE"))) or NATURES_DECLAREES.get(code(r.get("NATURE_PROJET_DECLAREE")))
        p.update({
            "nature": nature,
            "niveaux": entier(r.get("NB_NIV_MAX")) or None,
            "surelevation": bool(r.get("I_SURELEVATION") or r.get("I_NIVSUPP")),
            "extension": bool(r.get("I_EXTENSION")),
            "utilisation": UTILISATIONS.get(code(r.get("UTILISATION"))),
            "logements": entier(r.get("NB_LGT_TOT_CREES")),
            "logements_individuels": entier(r.get("NB_LGT_IND_CREES")),
            "logements_collectifs": entier(r.get("NB_LGT_COL_CREES")),
            "logements_sociaux": entier(r.get("NB_LGT_PRET_LOC_SOCIAL")),
            "logements_aides": entier(r.get("NB_LGT_ACC_SOC_HORS_PTZ")),
            "logements_demolis": entier(r.get("NB_LGT_DEMOLIS")),
            "typologie": {k: entier(r.get(f"NB_LGT_{k}")) for k in ("1P", "2P", "3P", "4P", "5P", "6P_PLUS") if entier(r.get(f"NB_LGT_{k}"))},
            "residence": RESIDENCES.get(code(r.get("RESIDENCE"))),
            "surf_hab_creee": entier(r.get("SURF_HAB_CREEE")),
            "surf_hab_transfo": entier(r.get("SURF_HAB_ISSUE_TRANSFO")),
            "surf_hab_demolie": entier(r.get("SURF_HAB_DEMOLIE")),
            "surf_loc_creee": entier(r.get("SURF_LOC_CREEE")),
            "surf_loc_transfo": entier(r.get("SURF_LOC_ISSUE_TRANSFO")),
            "surf_loc_demolie": entier(r.get("SURF_LOC_DEMOLIE")),
            "locaux": {},
        })
        rl = r_locaux or {}
        for cle, libelle in LOCAUX:
            m2 = entier(rl.get(f"SURF_{cle}_CREEE")) + entier(rl.get(f"SURF_{cle}_ISSUE_TRANSFO"))
            if m2:
                p["locaux"][libelle] = m2
        p["chambres"] = entier(rl.get("NB_CHAMBRES")) or None
        p["service_public"] = SERVICES_PUBLICS.get(code(rl.get("TYPE_SERVICE_PUBLIC")))
        # Bureaux : créés (neufs ou issus d'une transformation), démolis, et transformés en autre chose.
        transformes = entier(rl.get("SURF_BUR_TRANSFORMEE"))
        if not transformes and code(r.get("TYPE_PRINCIP_LOCAUX_TRANSFORMES")) == 3:
            transformes = entier(r.get("SURF_LOC_TRANSFORMEE"))  # bureaux transformés (souvent en logements)
        bureaux = {
            "existants": entier(rl.get("SURF_BUR_AVANT")),
            "crees": entier(rl.get("SURF_BUR_CREEE")) + entier(rl.get("SURF_BUR_ISSUE_TRANSFO")),
            "demolis": entier(rl.get("SURF_BUR_DEMOLIE")),
            "transformes": transformes,
        }
        p["bureaux"] = bureaux if any(bureaux.values()) else None
        p["surface_totale"] = p["surf_hab_creee"] + p["surf_hab_transfo"] + p["surf_loc_creee"] + p["surf_loc_transfo"]
    if type_dau == "PD":
        p["nature"] = "Démolition"
    if type_dau == "PA":
        p["nature"] = "Aménagement"
    p["categorie"] = categorie(p)
    p["grand_projet"] = est_grand_projet(p)
    return p


def categorie(p):
    if p["type"] == "PD":
        return "demolition"
    if p["type"] == "PA":
        return "amenagement"
    if p["logements"] or p["surf_hab_creee"] or p["surf_hab_transfo"]:
        return "habitat"
    return "activites"


def est_grand_projet(p):
    if p["type"] == "PA":
        return True
    if p["type"] == "PD":
        return p["demandeur_categorie"] != "particulier"
    return p["logements"] >= SEUIL_LOGEMENTS or p["surface_totale"] >= SEUIL_SURFACE


def construire(brut):
    permis = {}
    locaux = {r["NUM_DAU"]: r for r in brut["locaux"]}
    logements = {r["NUM_DAU"]: r for r in brut["logements"]}
    for num in sorted(set(locaux) | set(logements)):
        r = dict(logements.get(num) or {})
        fusionner(r, locaux.get(num) or {})
        permis_type = r.get("TYPE_DAU") or "PC"
        p = normaliser(permis_type, num, r, locaux.get(num))
        permis[p["id"]] = p
    for r in brut["demolir"]:
        p = normaliser("PD", r["NUM_PD"], r)
        permis[p["id"]] = p
    for r in brut["amenager"]:
        p = normaliser("PA", r["NUM_PA"], r)
        permis[p["id"]] = p
    # Autorisations portant sur les mêmes parcelles (ex. permis de démolir + permis de construire).
    par_parcelle = {}
    for p in permis.values():
        for parc in p["parcelles"]:
            par_parcelle.setdefault(parc, set()).add(p["id"])
    for p in permis.values():
        lies = set()
        for parc in p["parcelles"]:
            lies |= par_parcelle[parc]
        lies.discard(p["id"])
        p["lies"] = sorted(lies, key=lambda i: permis[i]["date_autorisation"] or "", reverse=True)
    return sorted(permis.values(), key=lambda p: (p["date_autorisation"] or "", p["id"]), reverse=True)


# --------------------------------------------------------------------------- Localisation

def charger_cache():
    if CACHE.exists():
        return json.loads(CACHE.read_text(encoding="utf-8"))
    return {"parcelles": {}, "adresses": {}}


def arrondir(coords):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], 6), round(coords[1], 6)]
    return [arrondir(c) for c in coords]


def centre_anneau(anneau):
    """Centroïde d'un anneau de polygone (lon, lat), pondéré par l'aire."""
    a = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(anneau, anneau[1:]):
        f = x0 * y1 - x1 * y0
        a += f
        cx += (x0 + x1) * f
        cy += (y0 + y1) * f
    if abs(a) < 1e-14:
        xs, ys = zip(*anneau)
        return sum(xs) / len(xs), sum(ys) / len(ys), 0.0
    return cx / (3 * a), cy / (3 * a), abs(a) / 2


def dans_emprise(lat, lon):
    return EMPRISE["lat"][0] <= lat <= EMPRISE["lat"][1] and EMPRISE["lon"][0] <= lon <= EMPRISE["lon"][1]


def parcelle_cadastre(cle, cache):
    if cle in cache["parcelles"]:
        return cache["parcelles"][cle]
    section, numero = cle.split()
    q = urllib.parse.urlencode({"code_insee": COMMUNE, "section": section.rjust(2, "0"), "numero": numero.zfill(4)})
    try:
        feats = lire_json(f"{API_CADASTRE}?{q}").get("features", [])
    except Exception as e:  # parcelle supprimée ou renumérotée : on se rabattra sur l'adresse
        print(f"  parcelle {cle} : {e}", file=sys.stderr)
        feats = []
    res = None
    if feats:
        geom = feats[0]["geometry"]
        polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        x, y, _ = max((centre_anneau(poly[0]) for poly in polys), key=lambda c: c[2])
        if dans_emprise(y, x):
            res = {"centre": [round(y, 6), round(x, 6)], "geom": {"type": geom["type"], "coordinates": arrondir(geom["coordinates"])}}
    cache["parcelles"][cle] = res
    time.sleep(0.15)
    return res


def candidats_adresse(texte):
    """Variantes interrogeables d'une adresse Sitadel : « 22/22 B AVENUE X (ET 12 RUE Y) »
    donne « 22 AVENUE X » puis « 12 RUE Y »."""
    principale, _, reste = texte.partition(" (")
    res = []
    for partie in (principale, reste.rstrip(")")):
        mots = partie.split()
        if mots and mots[0] == "ET":
            mots = mots[1:]
        if not mots:
            continue
        num = re.match(r"\d+", mots[0])
        if num and len(mots) > 1 and mots[1] == "EME":  # « 3 EME AVENUE »
            mots = [num.group() + "ème"] + mots[2:]
        elif num:
            suite = 1
            while suite < len(mots) and re.fullmatch(r"[\d/\-]+|[A-Z]|BIS|TER", mots[suite]):
                suite += 1
            mots = [num.group()] + mots[suite:]
        t = " ".join(mots)
        if t not in res:
            res.append(t)
    return res


def adresse_ban(texte, cache):
    if texte in cache["adresses"]:
        return cache["adresses"][texte]
    q = urllib.parse.urlencode({"q": f"{texte} {NOM_COMMUNE}", "citycode": COMMUNE, "limit": 1})
    res = None
    try:
        feats = lire_json(f"{API_ADRESSE}?{q}").get("features", [])
        if feats and feats[0]["properties"].get("score", 0) >= 0.5:
            lon, lat = feats[0]["geometry"]["coordinates"]
            if dans_emprise(lat, lon):
                res = [round(lat, 6), round(lon, 6)]
    except Exception as e:
        print(f"  adresse « {texte} » : {e}", file=sys.stderr)
    cache["adresses"][texte] = res
    time.sleep(0.1)
    return res


def localiser(permis, cache):
    for p in permis:
        geoms, centres = [], []
        for cle in p["parcelles"]:
            parc = parcelle_cadastre(cle, cache)
            if parc:
                geoms.append({"parcelle": cle, **parc["geom"]})
                centres.append(parc["centre"])
        if centres:
            p["lat"] = round(sum(c[0] for c in centres) / len(centres), 6)
            p["lon"] = round(sum(c[1] for c in centres) / len(centres), 6)
            p["geo"] = "cadastre"
            p["contours"] = geoms
            continue
        pt = None
        for texte in candidats_adresse(p["adresse"] or ""):
            pt = adresse_ban(texte, cache)
            if pt:
                break
        if pt:
            p["lat"], p["lon"], p["geo"] = pt[0], pt[1], "adresse"
        else:
            p["lat"] = p["lon"] = p["geo"] = None
        p["contours"] = []


# --------------------------------------------------------------------------- Photos aériennes

def photos_couleur(cache):
    """Photos aériennes en couleurs naturelles couvrant Gentilly (pour le site et le relevé),
    avec leur zoom maximal : les plus anciennes s'arrêtent au niveau 18, les récentes au 19."""
    connues = {ph["annee"]: ph for ph in cache.get("photos_couleur", [])}
    lon, lat = 2.3463, 48.8136

    def tuile_existe(couche, z):
        n = 2 ** z
        x = int((lon + 180) / 360 * n)
        y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
        url = (f"https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER={couche}"
               f"&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}")
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "observatoire-urbanisme-gentilly/1.0"}), timeout=30):
                return True
        except Exception:
            return False

    for annee in range(2000, dt.date.today().year + 1):
        if annee in connues:
            continue
        for couche in (f"ORTHOIMAGERY.ORTHOPHOTOS{annee}", f"ORTHOIMAGERY.ORTHOPHOTOS.ORTHO-EXPRESS.{annee}"):
            if tuile_existe(couche, 17):
                connues[annee] = {"annee": annee, "couche": couche, "zmax": 19 if tuile_existe(couche, 19) else 18}
                break
    cache["photos_couleur"] = [connues[a] for a in sorted(connues)]
    return cache["photos_couleur"]


# --------------------------------------------------------------------------- Écriture

COLONNES_CSV = [
    "type", "num", "etat", "date_depot", "date_autorisation", "date_chantier", "date_achevement",
    "demandeur", "siren", "adresse", "parcelles", "nature", "logements", "logements_sociaux",
    "surf_hab_creee", "surf_loc_creee", "surface_totale", "bureaux_crees", "bureaux_demolis",
    "bureaux_transformes", "niveaux", "grand_projet", "lat", "lon",
]


def ecrire(permis, meta, commune):
    paquet = {"meta": meta, "commune": commune, "permis": permis}
    (DATA / "permis.json").write_text(json.dumps(paquet, ensure_ascii=False, indent=1), encoding="utf-8")
    js = "/* Fichier généré par scripts/maj_donnees.py — ne pas modifier à la main. */\n"
    js += "window.OBSERVATOIRE = " + json.dumps(paquet, ensure_ascii=False, separators=(",", ":")) + ";\n"
    (DATA / "permis.js").write_text(js, encoding="utf-8")
    # CSV lisible par Excel : séparateur point-virgule, encodage UTF-8 avec BOM.
    with open(DATA / "permis.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(COLONNES_CSV)
        for p in permis:
            ligne = []
            plat = dict(p)
            for k, v in (p.get("bureaux") or {}).items():
                plat[f"bureaux_{k}"] = v
            for c in COLONNES_CSV:
                v = plat.get(c)
                if isinstance(v, list):
                    v = ", ".join(v)
                elif isinstance(v, bool):
                    v = "oui" if v else "non"
                ligne.append("" if v is None else v)
            w.writerow(ligne)


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    DATA.mkdir(exist_ok=True)
    print("Lecture du catalogue Sitadel…")
    meta_ds, fichiers = fichiers_sitadel()
    brut = {}
    for cle, (rid, millesime) in fichiers.items():
        brut[cle] = lignes_commune(rid, millesime)
        print(f"  {cle} : {len(brut[cle])} lignes (millésime {millesime})")
    permis = construire(brut)

    print("Localisation des autorisations…")
    cache = charger_cache()
    localiser(permis, cache)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")

    try:
        commune = lire_json(API_COMMUNE)
        geom = commune.get("geometry", commune)
        commune = {"type": geom["type"], "coordinates": arrondir(geom["coordinates"])}
    except Exception as e:
        print(f"  contour de la commune indisponible : {e}", file=sys.stderr)
        commune = None

    couleur = photos_couleur(cache)
    for cle in ("vegetation", "vegetation_commune", "vegetation_methode", "photos"):
        cache.pop(cle, None)  # anciennes mesures automatiques de la végétation, abandonnées
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")

    millesime = max(m for _, m in fichiers.values())
    meta = {
        "commune": NOM_COMMUNE,
        "code_insee": COMMUNE,
        "millesime": millesime,
        "donnees_jusqu_au": (meta_ds.get("temporal_coverage") or {}).get("end"),
        "maj_source": (meta_ds.get("last_update") or "")[:10],
        "genere_le": dt.date.today().isoformat(),
        "source_url": URL_DATASET,
        "seuils_grand_projet": {"logements": SEUIL_LOGEMENTS, "surface_m2": SEUIL_SURFACE},
        "photos_couleur": couleur,
    }
    ecrire(permis, meta, commune)

    sans_lieu = [p["id"] for p in permis if p["lat"] is None]
    print(f"{len(permis)} autorisations écrites dans data/ "
          f"({sum(p['grand_projet'] for p in permis)} grands projets, {len(sans_lieu)} non localisées).")
    if sans_lieu:
        print("  Non localisées : " + ", ".join(sans_lieu))


if __name__ == "__main__":
    main()
