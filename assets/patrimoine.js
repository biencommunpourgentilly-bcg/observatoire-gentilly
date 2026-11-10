const DONNEES = window.PATRIMOINE;
const MODES = {
  statut: { champ: "statut", libelles: { stable: "Présente de 2019 à 2025", apparue: "Apparue après 2019", disparue: "Disparue avant 2025", irreguliere: "Présence irrégulière" },
            couleurs: { stable: "#2f6db5", apparue: "#c98a1b", disparue: "#b5452b", irreguliere: "#7a847f" } },
  emprise: { champ: "emprise", libelles: { totalite: "Terrain en totalité (pleine propriété)", locaux: "Locaux seulement : pas le terrain", bail: "Terrain en bail à construction", partielle: "Terrain en partie" },
             couleurs: { totalite: "#2f6db5", locaux: "#c98a1b", bail: "#7a847f", partielle: "#b5452b" } },
  ens: { champ: "ens", libelles: { ensemble: "Fait partie d'un ensemble de plusieurs parcelles contiguës", isolee: "Parcelle isolée", hors: "Hors calcul (locaux seulement ou absente du dernier millésime)" },
         couleurs: { ensemble: "#2f6db5", isolee: "#c98a1b", hors: "#a9b0ac" } },
};
let mode = "emprise";
const cat = (p) => p[MODES[mode].champ];
const COULEUR = new Proxy({}, { get: (_, k) => MODES[mode].couleurs[k] });
const STATUTS = new Proxy({}, { get: (_, k) => MODES[mode].libelles[k] });
const EMPRISE_TXT = { totalite: "La commune détient toute la parcelle (terrain et éventuels locaux).", locaux: "La commune n'a que des locaux sur cette parcelle : le terrain n'est pas dans la liste de ses parcelles.", bail: "La commune est bailleur à construction : elle détient le terrain, qui est loué à un tiers pour y construire.", partielle: "La commune ne détient qu'une partie du terrain." };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const m2 = (n) => n == null ? "—" : `${new Intl.NumberFormat("fr-FR").format(n)} m²`;
const IGN = (c, f = "image/jpeg") => `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${c}&STYLE=normal&TILEMATRIXSET=PM&FORMAT=${f}&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`;
const attrib = '© <a href="https://www.ign.fr/">IGN</a>';
const plan = L.tileLayer(IGN("GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2", "image/png"), { maxZoom: 19, attribution: attrib, className: "fond-plan" });
const photo = L.tileLayer(IGN("ORTHOIMAGERY.ORTHOPHOTOS"), { maxZoom: 19, attribution: attrib });
const cadastre = L.tileLayer(IGN("CADASTRALPARCELS.PARCELLAIRE_EXPRESS", "image/png").replace("STYLE=normal", "STYLE=PCI%20vecteur"), { maxZoom: 19, opacity: .8, attribution: attrib });
const carte = L.map("carte", { layers: [plan], zoomSnap: .5, maxZoom: 19 });
L.control.layers({ "Plan IGN": plan, "Photo aérienne": photo }, { "Cadastre": cadastre }).addTo(carte);
L.control.scale({ imperial: false }).addTo(carte);

const calque = L.layerGroup().addTo(carte);
const contours = L.layerGroup();
const objets = new Map();

function popup(p) {
  const loc = Object.entries(p.locaux).map(([a, n]) => `${a} : ${n}`).join(" · ");
  return `<div class="popup"><b>${esc(p.commune)}, parcelle ${esc(p.ref)}</b>
    <table>
      <tr><td>Emprise</td><td>${esc(MODES.emprise.libelles[p.emprise])}</td></tr>
      ${p.ens_n ? `<tr><td>Ensemble</td><td>${p.ens_n > 1 ? `n° ${p.ens_id} : ${p.ens_n} parcelles contiguës, ${m2(p.ens_m2)} au total` : "parcelle isolée"}</td></tr>` : ""}
      <tr><td>Statut</td><td>${esc(p.libelle)}</td></tr>
      <tr><td>Millésimes</td><td>${p.annees.join(", ")}</td></tr>
      <tr><td>Contenance</td><td>${p.emprise === "locaux" ? "— (terrain non détenu)" : m2(p.contenance_m2)}</td></tr>
      <tr><td>Adresse</td><td>${p.voies.length ? p.voies.map(esc).join(" ; ") : "—"}</td></tr>
      <tr><td>Droit</td><td>${p.droits.map(esc).join(", ") || "—"}</td></tr>
      <tr><td>Nature</td><td>${p.cultures.map(esc).join(", ") || "—"}</td></tr>
      <tr><td>Locaux</td><td>${loc || "aucun recensé"}</td></tr>
    </table>
    <div class="attention" style="background:#eef4ec">${esc(EMPRISE_TXT[p.emprise])}</div>
    ${p.approx ? '<div class="attention">Emplacement approximatif : cette référence n\'existe plus au cadastre actuel.</div>' : ""}
    <a target="_blank" rel="noopener" href="https://www.google.com/maps/@?api=1&map_action=map&center=${p.centre[0]},${p.centre[1]}&zoom=19&basemap=satellite">Vue satellite</a> ·
    <a target="_blank" rel="noopener" href="https://www.geoportail.gouv.fr/carte?c=${p.centre[1]},${p.centre[0]}&z=19&l0=ORTHOIMAGERY.ORTHOPHOTOS::GEOPORTAIL:OGC:WMTS(1)&l1=CADASTRALPARCELS.PARCELLAIRE_EXPRESS::GEOPORTAIL:OGC:WMTS(1)&permalink=yes">Cadastre (Géoportail)</a>
    <div class="attention">Une apparition ou une disparition de référence n'est pas une transaction.</div></div>`;
}

function styles(p) {
  const c = COULEUR[cat(p)];
  const locaux = p.emprise === "locaux";
  return {
    pt: p.approx ? { radius: 8, color: "#1f2a25", weight: 2, fillColor: c, fillOpacity: .9, dashArray: "3 3" }
                 : { radius: locaux ? 7 : 6, color: locaux ? "#1f2a25" : "#fff", weight: locaux ? 2 : 1.5, fillColor: c, fillOpacity: locaux ? .55 : .9 },
    poly: { color: c, weight: 2, fillColor: c, fillOpacity: locaux ? .12 : .35, dashArray: locaux ? "6 5" : null },
  };
}
DONNEES.forEach((p, i) => {
  const c = COULEUR[cat(p)];
  const pt = L.circleMarker(p.centre, styles(p).pt);
  pt.bindPopup(() => popup(p), { maxWidth: 340 });
  pt.bindTooltip(`${p.commune} ${p.ref}`);
  let poly = null;
  if (p.geometrie) {
    poly = L.geoJSON(p.geometrie, { style: styles(p).poly });
    poly.bindPopup(() => popup(p), { maxWidth: 340 });
  }
  objets.set(i, { p, pt, poly });
});

function appliquerStyles() {
  objets.forEach((o) => { o.pt.setStyle(styles(o.p).pt); if (o.poly) o.poly.setStyle(styles(o.p).poly); });
}
function legende() {
  const n = {}; DONNEES.forEach((p) => { n[cat(p)] = (n[cat(p)] || 0) + 1; });
  $("statuts").innerHTML = Object.keys(MODES[mode].libelles).filter((s) => n[s]).map((s) =>
    `<label class="case"><input type="checkbox" value="${s}" checked><span class="pastille" style="background:${MODES[mode].couleurs[s]}"></span>${MODES[mode].libelles[s]}<span class="nb">${n[s]}</span></label>`).join("");
  document.querySelectorAll("#statuts input").forEach((x) => x.addEventListener("change", dessiner));
}
document.querySelectorAll("input[name=mode]").forEach((r) => r.addEventListener("change", () => { mode = r.value; legende(); appliquerStyles(); dessiner(); }));

function visibles() {
  const statuts = new Set([...document.querySelectorAll("#statuts input:checked")].map((x) => x.value));
  const an = $("annee").value;
  const q = $("recherche").value.trim().toLowerCase();
  return DONNEES.map((p, i) => i).filter((i) => {
    const p = DONNEES[i];
    if (!statuts.has(cat(p))) return false;
    if (an && !(p.statut === "apparue" && String(p.annees[0]) === an)) return false;
    if (q && !`${p.commune} ${p.ref} ${p.voies.join(" ")} ${p.cultures.join(" ")}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

function dessiner() {
  calque.clearLayers();
  contours.clearLayers();
  const ids = visibles();
  ids.forEach((i) => { const o = objets.get(i); o.pt.addTo(calque); if (o.poly) o.poly.addTo(contours); });
  majContours();
  $("compteur").textContent = `${ids.length} parcelle${ids.length > 1 ? "s" : ""} affichée${ids.length > 1 ? "s" : ""} sur ${DONNEES.length}.`;
  $("liste").innerHTML = ids.slice(0, 300).map((i) => `<button data-i="${i}">${esc(DONNEES[i].commune)} ${esc(DONNEES[i].ref)} <span style="color:${COULEUR[cat(DONNEES[i])]}">●</span> <small>${esc(mode === "emprise" ? MODES.emprise.libelles[DONNEES[i].emprise] : DONNEES[i].libelle)}</small></button>`).join("") || '<p class="note" style="padding:6px">Aucune parcelle.</p>';
}
function majContours() {
  if (carte.getZoom() >= 14) { if (!carte.hasLayer(contours)) contours.addTo(carte); } else if (carte.hasLayer(contours)) carte.removeLayer(contours);
}
carte.on("zoomend", majContours);

function aller(i) {
  const o = objets.get(i);
  carte.flyTo(o.p.centre, 18, { duration: .7 });
  setTimeout(() => (o.poly ? o.poly : o.pt).openPopup(o.p.centre), 800);
}
$("liste").addEventListener("click", (e) => { const b = e.target.closest("button[data-i]"); if (b) aller(+b.dataset.i); });

// Filtres : légende selon le mode
legende();
const annees = [...new Set(DONNEES.filter((p) => p.statut === "apparue").map((p) => p.annees[0]))].sort();
annees.forEach((a) => { const o = document.createElement("option"); o.value = a; o.textContent = `${a} (${DONNEES.filter((p) => p.statut === "apparue" && p.annees[0] === a).length})`; $("annee").appendChild(o); });
$("annee").addEventListener("change", dessiner);
$("recherche").addEventListener("input", dessiner);

// Communes
const parCommune = {};
DONNEES.forEach((p) => { (parCommune[p.commune] ||= { dep: p.dep, n: 0, pts: [] }).n++; parCommune[p.commune].pts.push(p.centre); });
const ordre = Object.entries(parCommune).sort((a, b) => b[1].n - a[1].n);
$("communes").innerHTML = `<button data-tout="1"><strong>Toutes les parcelles</strong><small>${DONNEES.length}</small></button>` +
  ordre.map(([nom, c]) => `<button data-c="${esc(nom)}">${esc(nom)} <small>dép. ${esc(c.dep)} · ${c.n}</small></button>`).join("");
$("communes").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.tout) { carte.fitBounds(L.latLngBounds(DONNEES.map((p) => p.centre)), { padding: [30, 30] }); return; }
  carte.fitBounds(L.latLngBounds(parCommune[b.dataset.c].pts), { padding: [40, 40], maxZoom: 17 });
});

dessiner();
const gentilly = DONNEES.filter((p) => p.commune === "Gentilly").map((p) => p.centre);
carte.fitBounds(L.latLngBounds(gentilly), { padding: [20, 20] });
