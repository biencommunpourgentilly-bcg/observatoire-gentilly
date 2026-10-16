/* Relevé collaboratif de la pleine terre : chaque participant décrit ce qu'il voit sur les
   photos aériennes avant/après de chaque terrain, puis envoie ses réponses dans un fichier JSON
   (traité par scripts/traiter_releve.py). Les réponses sont gardées sur l'appareil en attendant. */
(function () {
  "use strict";

  const D = window.OBSERVATOIRE || { meta: {}, permis: [] };
  const META = D.meta;
  const PHOTOS = (META.photos_couleur || []).filter((ph) => ph.annee >= 2008);
  const CLE = "releve-pleine-terre-v1";
  const casse = window.casseAdresse;

  const TYPES = { PC: "Permis de construire", DP: "Déclaration préalable", PD: "Permis de démolir", PA: "Permis d'aménager" };
  const PARTS = [0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v) => [v, `${v} %`]).concat([[null, "Je ne sais pas"]]);
  const DENSITES = [["beaucoup_plus", "Beaucoup plus dense"], ["plus", "Un peu plus dense"], ["pareil", "Aussi dense"], ["moins", "Moins dense"], ["inconnu", "Je ne sais pas"]];
  const APPRECIATIONS = [[1, "1 · Pas du tout"], [2, "2"], [3, "3"], [4, "4"], [5, "5 · Beaucoup"], [null, "Sans avis"]];
  const OPTIONS = { part_avant: PARTS, part_apres: PARTS, etat_projet: null, densite: DENSITES, appreciation: APPRECIATIONS };
  const TEXTE = { etat_projet: true, densite: true }; // réponses en mots ; les autres sont des nombres
  const ETATS_PROJET = [["termine", "Terminé"], ["chantier", "En chantier"], ["pas_commence", "Pas commencé"], ["inconnu", "Je ne sais pas"]];
  OPTIONS.etat_projet = ETATS_PROJET;
  const nf = new Intl.NumberFormat("fr-FR");
  const m2 = (n) => `${nf.format(Math.round(n))} m²`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------------ Surfaces (m²) sur la sphère
  function aire(latlngs) {
    const R = 6378137, rad = Math.PI / 180;
    let a = 0;
    for (let i = 0; i < latlngs.length; i++) {
      const [lat1, lon1] = latlngs[i];
      const [lat2, lon2] = latlngs[(i + 1) % latlngs.length];
      a += (lon2 - lon1) * rad * (2 + Math.sin(lat1 * rad) + Math.sin(lat2 * rad));
    }
    return Math.abs((a * R * R) / 2);
  }
  function aireGeojson(geom) {
    const polys = geom.type === "MultiPolygon" ? geom.coordinates : [geom.coordinates];
    return polys.reduce((s, poly) => s + poly.reduce((t, anneau, i) => {
      const a = aire(anneau.map(([lon, lat]) => [lat, lon]));
      return t + (i === 0 ? a : -a);
    }, 0), 0);
  }

  // ------------------------------------------------------------------ Terrains : parcelles regroupées
  // Deux autorisations partageant une parcelle (ex. permis de démolir puis de construire) forment un même terrain.
  const parent = new Map();
  const racine = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const avecContours = D.permis.filter((p) => p.contours && p.contours.length);
  avecContours.forEach((p) => {
    const ks = p.contours.map((c) => c.parcelle);
    ks.slice(1).forEach((k) => parent.set(racine(k), racine(ks[0])));
    racine(ks[0]);
  });
  const groupes = new Map();
  avecContours.forEach((p) => {
    const r = racine(p.contours[0].parcelle);
    if (!groupes.has(r)) groupes.set(r, []);
    groupes.get(r).push(p);
  });
  const poids = (p) => Math.max(p.logements || 0, (p.surface_totale || 0) / 70);
  const TERRAINS = [...groupes.values()].map((permis) => {
    permis.sort((a, b) => (b.date_autorisation || "").localeCompare(a.date_autorisation || ""));
    const contours = new Map();
    permis.forEach((p) => p.contours.forEach((c) => contours.set(c.parcelle, c)));
    const parcelles = [...contours.keys()].sort();
    const premiere = permis.map((p) => p.date_autorisation).filter(Boolean).sort()[0] || "";
    const anneeRef = +premiere.slice(0, 4) || 9999;
    const avant = [...PHOTOS].reverse().find((ph) => ph.annee < anneeRef) || PHOTOS[0];
    const principal = permis.reduce((m, p) => (p.grand_projet && !m.grand_projet) || poids(p) > poids(m) ? p : m, permis[0]);
    return {
      id: parcelles.join("+"),
      parcelles,
      contours: [...contours.values()],
      permis,
      principal,
      grand: permis.some((p) => p.grand_projet),
      quartier: principal.quartier || permis.map((p) => p.quartier).find(Boolean) || null,
      surface: [...contours.values()].reduce((s, g) => s + aireGeojson(g), 0),
      anneeAvant: avant ? avant.annee : null,
      anneeApres: PHOTOS.length ? PHOTOS[PHOTOS.length - 1].annee : null,
    };
  }).sort((a, b) => (b.grand - a.grand) || (poids(b.principal) - poids(a.principal)) ||
    (b.principal.date_autorisation || "").localeCompare(a.principal.date_autorisation || ""));

  // ------------------------------------------------------------------ Réponses enregistrées sur l'appareil
  let etat = { participant: "", reponses: {} };
  try {
    const lu = JSON.parse(localStorage.getItem(CLE) || "null");
    if (lu && lu.reponses) etat = lu;
  } catch (e) { /* stockage indisponible : les réponses vivront le temps de la page */ }
  function sauver() {
    try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) { /* idem */ }
    majProgression();
  }
  const repondu = (t) => {
    const r = etat.reponses[t.id];
    return !!(r && (r.part_avant !== undefined || r.part_apres !== undefined || (r.zones && r.zones.length)));
  };
  function reponse(t) {
    if (!etat.reponses[t.id]) {
      etat.reponses[t.id] = { annee_avant: t.anneeAvant, annee_apres: t.anneeApres, zones: [], commentaire: "" };
    }
    return etat.reponses[t.id];
  }
  function majProgression() {
    const n = TERRAINS.filter(repondu).length;
    $("progression-entete").textContent = `${n} / ${TERRAINS.length} terrains relevés`;
    $("resume-reponses").textContent = n
      ? `${n} terrain${n > 1 ? "s" : ""} relevé${n > 1 ? "s" : ""} sur ${TERRAINS.length}${etat.participant ? `, par ${etat.participant}` : ""}.`
      : "Aucune réponse pour le moment.";
    const nGrands = TERRAINS.filter((t) => t.grand).length;
    $("lib-grands").textContent = `Les grands projets d'abord (${nGrands} terrains, puis les autres)`;
    $("lib-tous").textContent = `Tous les terrains, dans l'ordre (${TERRAINS.length})`;
    $("lib-restants").textContent = `Seulement ceux que je n'ai pas encore faits (${TERRAINS.length - n})`;
  }

  // ------------------------------------------------------------------ Écrans
  let liste = TERRAINS;
  let index = 0;
  function montrer(ecran) {
    $("ecran-accueil").hidden = ecran !== "accueil";
    $("ecran-terrain").hidden = ecran !== "terrain";
    window.scrollTo(0, 0);
  }

  const QUARTIERS = [...new Set(TERRAINS.map((t) => t.quartier).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  $("choix-quartier").innerHTML = QUARTIERS.map((q) => `<option value="${esc(q)}">${esc(q)} (${TERRAINS.filter((t) => t.quartier === q).length})</option>`).join("");
  $("choix-quartier").addEventListener("change", () => { document.querySelector("input[name=liste][value=quartier]").checked = true; });
  $("participant").value = etat.participant || "";
  $("form-demarrage").addEventListener("submit", () => {
    const nom = $("participant").value.trim();
    if (!nom) { $("participant").focus(); return; }
    etat.participant = nom;
    sauver();
    const choix = document.querySelector("input[name=liste]:checked").value;
    liste = choix === "quartier" ? TERRAINS.filter((t) => t.quartier === $("choix-quartier").value)
      : choix === "restants" ? TERRAINS.filter((t) => !repondu(t)) : choix === "tous"
      ? [...TERRAINS].sort((a, b) => (b.principal.date_autorisation || "").localeCompare(a.principal.date_autorisation || ""))
      : TERRAINS;
    if (!liste.length) { alert("Vous avez déjà relevé tous les terrains. Merci !"); return; }
    index = 0;
    montrer("terrain");
    afficherTerrain();
  });
  $("retour-accueil").addEventListener("click", () => { finirDessin(false); montrer("accueil"); });

  // ------------------------------------------------------------------ Cartes avant / après synchronisées
  const IGN = (couche) => `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${couche}&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`;
  const ATTRIB = '© <a href="https://www.ign.fr/" target="_blank" rel="noopener">IGN</a>';
  const cartes = {};
  const couches = {};
  const calques = {};
  let synchro = false;
  function creerCartes() {
    if (cartes.avant) return;
    ["avant", "apres"].forEach((cote) => {
      cartes[cote] = L.map(`carte-${cote}`, { zoomSnap: 0.5, maxZoom: 20 });
      calques[cote] = { contour: L.layerGroup().addTo(cartes[cote]), zones: L.layerGroup().addTo(cartes[cote]), dessin: L.layerGroup().addTo(cartes[cote]) };
      cartes[cote].on("click", (e) => ajouterPoint(e.latlng, cote));
    });
    const lier = (a, b) => cartes[a].on("move", () => {
      if (synchro) return;
      synchro = true;
      cartes[b].setView(cartes[a].getCenter(), cartes[a].getZoom(), { animate: false });
      synchro = false;
    });
    lier("avant", "apres");
    lier("apres", "avant");
  }
  function photo(annee) { return PHOTOS.find((ph) => ph.annee === annee) || PHOTOS[PHOTOS.length - 1]; }
  function poserPhoto(cote, annee) {
    const ph = photo(annee);
    if (couches[cote]) cartes[cote].removeLayer(couches[cote]);
    couches[cote] = L.tileLayer(IGN(ph.couche), { maxZoom: 20, maxNativeZoom: ph.zmax, attribution: ATTRIB }).addTo(cartes[cote]);
  }
  ["avant", "apres"].forEach((cote) => {
    $(`annee-${cote}`).innerHTML = PHOTOS.map((ph) => `<option value="${ph.annee}">${ph.annee}</option>`).join("");
    $(`annee-${cote}`).addEventListener("change", (e) => {
      const r = reponse(terrainCourant());
      r[`annee_${cote}`] = +e.target.value;
      poserPhoto(cote, r[`annee_${cote}`]);
      sauver();
    });
  });

  // ------------------------------------------------------------------ Fiche terrain
  const terrainCourant = () => liste[index];
  function resumePermis(p) {
    const m = [];
    if (p.logements) m.push(`${nf.format(p.logements)} logement${p.logements > 1 ? "s" : ""}`);
    if (p.bureaux && p.bureaux.crees) m.push(`${m2(p.bureaux.crees)} de bureaux`);
    else if (p.surface_totale) m.push(m2(p.surface_totale));
    if (!m.length && p.nature) m.push(p.nature.toLowerCase());
    return m.join(" · ");
  }
  function afficherTerrain() {
    const t = terrainCourant();
    const r = etat.reponses[t.id] || { annee_avant: t.anneeAvant, annee_apres: t.anneeApres, zones: [], commentaire: "" };
    $("compteur-terrain").textContent = `Terrain ${index + 1} sur ${liste.length}${repondu(t) ? " · déjà relevé" : ""}`;
    $("terrain-titre").textContent = casse(t.principal.adresse) || `Parcelles ${t.parcelles.join(", ")}`;
    $("terrain-permis").innerHTML = t.permis.map((p) => `<li><b>${esc(TYPES[p.type])}</b> accordé en ${esc((p.date_autorisation || "").slice(0, 4))}` +
      `${p.demandeur ? ` à ${esc(p.demandeur)}` : ""}${resumePermis(p) ? ` · ${esc(resumePermis(p))}` : ""}${p.etat === "annule" ? " · <i>annulé</i>" : ""}</li>`).join("");
    $("terrain-quartier").textContent = t.quartier ? `Quartier ${t.quartier}` : "";
    $("terrain-surface").textContent = `${m2(t.surface)} (parcelles ${t.parcelles.join(", ")})`;

    creerCartes();
    ["avant", "apres"].forEach((cote) => {
      const annee = r[`annee_${cote}`] || (cote === "avant" ? t.anneeAvant : t.anneeApres);
      $(`annee-${cote}`).value = String(photo(annee).annee);
      poserPhoto(cote, annee);
      calques[cote].contour.clearLayers();
      t.contours.forEach((g) => L.geoJSON(g, { style: { color: "#ffe100", weight: 3, fill: false }, interactive: false }).addTo(calques[cote].contour));
    });
    const bornes = L.geoJSON({ type: "GeometryCollection", geometries: t.contours.map((c) => ({ type: c.type, coordinates: c.coordinates })) }).getBounds();
    setTimeout(() => {
      ["avant", "apres"].forEach((cote) => cartes[cote].invalidateSize());
      cartes.avant.fitBounds(bornes, { padding: [24, 24], maxZoom: 19 });
    }, 0);

    document.querySelectorAll(".choix").forEach((zone) => {
      const q = zone.dataset.question;
      const options = OPTIONS[q];
      zone.innerHTML = options.map(([v, lib]) => `<button type="button" data-valeur="${v === null ? "null" : v}" aria-pressed="${r[q] !== undefined && r[q] === v}">${lib}</button>`).join("");
    });
    $("commentaire").value = r.commentaire || "";
    finirDessin(false);
    dessinerZones();
    $("precedent").disabled = index === 0;
    $("suivant").textContent = index === liste.length - 1 ? "Terminer" : "Suivant →";
  }

  document.querySelectorAll(".choix").forEach((zone) => zone.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-valeur]");
    if (!b) return;
    const q = zone.dataset.question;
    const v = b.dataset.valeur;
    const r = reponse(terrainCourant());
    r[q] = v === "null" ? null : TEXTE[q] ? v : +v;
    r.repondu_le = new Date().toISOString();
    zone.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    sauver();
  }));
  $("commentaire").addEventListener("input", (e) => {
    const r = reponse(terrainCourant());
    r.commentaire = e.target.value;
    sauver();
  });

  function aller(delta) {
    finirDessin(false);
    index += delta;
    if (index >= liste.length) {
      index = liste.length - 1;
      montrer("accueil");
      alert("Merci ! Pensez à envoyer vos réponses avec le bouton « Envoyer ».");
      return;
    }
    index = Math.max(0, index);
    afficherTerrain();
    window.scrollTo(0, 0);
  }
  $("precedent").addEventListener("click", () => aller(-1));
  $("passer").addEventListener("click", () => aller(1));
  $("suivant").addEventListener("click", () => aller(1));

  // ------------------------------------------------------------------ Dessin des zones (doigt ou souris)
  let dessin = null; // { type, points: [[lat, lon]] }
  const COULEURS = { disparue: "#e30613", creee: "#00c0f3" };
  document.querySelectorAll(".bouton-dessin").forEach((b) => b.addEventListener("click", () => {
    dessin = { type: b.dataset.type, points: [] };
    $("outils-dessin").hidden = true;
    $("outils-en-cours").hidden = false;
    majDessin();
  }));
  function ajouterPoint(latlng, cote) {
    if (!dessin) return;
    dessin.points.push([+latlng.lat.toFixed(7), +latlng.lng.toFixed(7)]);
    dessin.cote = dessin.cote || cote;
    majDessin();
  }
  function majDessin() {
    ["avant", "apres"].forEach((cote) => {
      calques[cote].dessin.clearLayers();
      if (!dessin) return;
      const c = COULEURS[dessin.type];
      if (dessin.points.length > 1) L.polygon(dessin.points, { color: c, weight: 2, dashArray: "5 4", fillOpacity: 0.2, interactive: false }).addTo(calques[cote].dessin);
      dessin.points.forEach((pt) => L.circleMarker(pt, { radius: 5, color: "#ffffff", weight: 2, fillColor: c, fillOpacity: 1, interactive: false }).addTo(calques[cote].dessin));
    });
    if (dessin) {
      const n = dessin.points.length;
      $("consigne-dessin").innerHTML = `<b class="${dessin.type === "disparue" ? "txt-disparue" : "txt-creee"}">Zone ${dessin.type === "disparue" ? "disparue" : "créée"}</b> : ` +
        (n < 3 ? `touchez la photo pour placer les coins (${n} placé${n > 1 ? "s" : ""}, il en faut au moins 3).` : `${n} coins, ${m2(aire(dessin.points))}.`);
      $("dessin-terminer").disabled = n < 3;
    }
  }
  function finirDessin(garder) {
    if (dessin && garder && dessin.points.length >= 3) {
      const r = reponse(terrainCourant());
      r.zones.push({ type: dessin.type, photo: dessin.cote === "avant" ? r.annee_avant : r.annee_apres, points: dessin.points, surface_m2: Math.round(aire(dessin.points)) });
      r.repondu_le = new Date().toISOString();
      sauver();
    }
    dessin = null;
    $("outils-dessin").hidden = false;
    $("outils-en-cours").hidden = true;
    if (cartes.avant) { majDessin(); dessinerZones(); }
  }
  $("dessin-terminer").addEventListener("click", () => finirDessin(true));
  $("dessin-abandonner").addEventListener("click", () => finirDessin(false));
  $("dessin-annuler-point").addEventListener("click", () => {
    if (dessin && dessin.points.length) { dessin.points.pop(); majDessin(); }
  });
  function dessinerZones() {
    const r = etat.reponses[terrainCourant().id];
    const zones = (r && r.zones) || [];
    ["avant", "apres"].forEach((cote) => {
      if (!calques[cote]) return;
      calques[cote].zones.clearLayers();
      zones.forEach((z) => L.polygon(z.points, { color: COULEURS[z.type], weight: 2, fillOpacity: 0.35, interactive: false }).addTo(calques[cote].zones));
    });
    $("liste-zones").innerHTML = zones.map((z, i) => `<li><span class="pastille-zone ${z.type}"></span>Pleine terre ${z.type === "disparue" ? "disparue" : "créée"} : <b>${m2(z.surface_m2)}</b>
      <button type="button" class="lien-bouton" data-supprimer="${i}">Supprimer</button></li>`).join("");
  }
  $("liste-zones").addEventListener("click", (e) => {
    const b = e.target.closest("[data-supprimer]");
    if (!b) return;
    reponse(terrainCourant()).zones.splice(+b.dataset.supprimer, 1);
    sauver();
    dessinerZones();
  });

  // ------------------------------------------------------------------ Envoi des réponses
  function fichier() {
    const reponses = TERRAINS.filter(repondu).map((t) => ({
      terrain: t.id,
      parcelles: t.parcelles,
      permis: t.permis.map((p) => p.id),
      adresse: casse(t.principal.adresse),
      surface_terrain_m2: Math.round(t.surface),
      ...etat.reponses[t.id],
    }));
    const contenu = {
      format: "releve-pleine-terre-gentilly",
      version: 1,
      participant: etat.participant,
      exporte_le: new Date().toISOString(),
      millesime_donnees: META.millesime,
      reponses,
    };
    const slug = (etat.participant || "anonyme").normalize("NFD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
    const nom = `releve-pleine-terre-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
    return { nom, blob: new Blob([JSON.stringify(contenu, null, 1)], { type: "application/json" }), n: reponses.length };
  }
  function telecharger() {
    const f = fichier();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(f.blob);
    a.download = f.nom;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  $("bouton-telecharger").addEventListener("click", () => {
    if (!fichier().n) { alert("Aucune réponse à envoyer pour le moment."); return; }
    telecharger();
  });
  $("bouton-partager").addEventListener("click", async () => {
    const f = fichier();
    if (!f.n) { alert("Aucune réponse à envoyer pour le moment."); return; }
    const doc = new File([f.blob], f.nom, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [doc] })) {
      try {
        await navigator.share({ files: [doc], title: "Relevé de la pleine terre", text: `Relevé de la pleine terre : ${f.n} terrains, par ${etat.participant}` });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    telecharger();
    alert("Le fichier a été téléchargé : envoyez-le en pièce jointe à la personne qui coordonne le relevé.");
  });

  majProgression();
})();
