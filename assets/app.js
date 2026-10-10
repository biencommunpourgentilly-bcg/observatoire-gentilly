/* Observatoire de l'urbanisme de Gentilly — affichage des données (data/permis.js). */
(function () {
  "use strict";

  const DONNEES = window.OBSERVATOIRE || { meta: {}, permis: [] };
  const COMPLEMENTS = window.COMPLEMENTS || {};
  const PERMIS = DONNEES.permis;
  const PAR_ID = new Map(PERMIS.map((p) => [p.id, p]));
  const META = DONNEES.meta;

  // ------------------------------------------------------------------ Libellés
  const TYPES = {
    PC: "Permis de construire",
    DP: "Déclaration préalable",
    PD: "Permis de démolir",
    PA: "Permis d'aménager",
  };
  const ETATS = {
    autorise: "Autorisé",
    commence: "Chantier en cours",
    termine: "Terminé",
    annule: "Annulé",
  };
  const CATEGORIES = {
    habitat: "Habitat",
    activites: "Activités et équipements",
    amenagement: "Aménagement",
    demolition: "Démolition",
  };
  const DEMANDEURS = {
    particulier: "Nom du demandeur non diffusé",
    public: "Collectivité ou organisme public",
    societe: "Société",
    association: "Association ou autre organisme",
    personne_morale: "Personne morale",
  };

  const nf = new Intl.NumberFormat("fr-FR");
  const nombre = (n) => nf.format(n || 0);
  const m2 = (n) => `${nombre(n)} m²`;
  const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  function dateFr(iso, long) {
    if (!iso) return "—";
    const [a, m, j] = iso.split("-");
    if (!j) return `${MOIS[+m - 1]} ${a}`;
    return long ? `${+j} ${MOIS[+m - 1]} ${a}` : `${j}/${m}/${a}`;
  }
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const casse = window.casseAdresse; // assets/adresses.js
  function adresse(p) {
    const t = casse(p.adresse);
    if (!t) return "Adresse non renseignée";
    const m = t.match(/^(.*) \((.*)\)$/); // lieu-dit identique à l'adresse : inutile de le répéter
    return m && normaliser(m[1]) === normaliser(m[2]) ? m[1] : t;
  }
  const demandeur = (p) => p.demandeur || DEMANDEURS[p.demandeur_categorie] || "Non renseigné";
  const couleur = (p) => `var(--c-${p.categorie})`;
  const annee = (p) => (p.date_autorisation || "").slice(0, 4);

  // Bureaux, et relevé collaboratif de la pleine terre (data/releve_pleine_terre.js, produit par scripts/traiter_releve.py)
  const RELEVE = window.RELEVE_PLEINE_TERRE || null;
  const PHOTOS = (META.photos_couleur || []).filter((ph) => ph.annee >= 2008);
  const arrondi = (n, pas = 10) => Math.round((n || 0) / pas) * pas;
  const aBureaux = (p) => !!(p.bureaux && (p.bureaux.crees || p.bureaux.demolis || p.bureaux.transformes));
  const terrainParParcelle = new Map();
  if (RELEVE) Object.keys(RELEVE.terrains).forEach((cle) => cle.split("+").forEach((k) => terrainParParcelle.set(k, cle)));
  function releveDe(p) {
    if (!RELEVE) return null;
    const cle = (p.parcelles || []).map((k) => terrainParParcelle.get(k)).find(Boolean);
    return cle ? { cle, ...RELEVE.terrains[cle] } : null;
  }
  const construit = (r) => !!(r && ["termine", "chantier"].includes(r.etat_projet));
  PERMIS.forEach((p) => {
    p.bureaux_crees = p.bureaux ? p.bureaux.crees : 0;
    const r = releveDe(p);
    p.pt_evolution = construit(r) ? r.evolution_m2 : null;
  });
  const perdPT = (p) => p.pt_evolution !== null && p.pt_evolution < 0;
  function totauxBureaux() {
    const t = { crees: 0, demolis: 0, transformes: 0, n: 0, habitation: 0 };
    PERMIS.filter((p) => p.etat !== "annule").forEach((p) => {
      t.habitation += (p.surf_hab_creee || 0) + (p.surf_hab_transfo || 0);
      if (!aBureaux(p)) return;
      t.n += 1;
      t.crees += p.bureaux.crees;
      t.demolis += p.bureaux.demolis;
      t.transformes += p.bureaux.transformes;
    });
    t.solde = t.crees - t.demolis - t.transformes;
    return t;
  }

  function resume(p) {
    const morceaux = [];
    if (p.logements) morceaux.push(`${nombre(p.logements)} logement${p.logements > 1 ? "s" : ""}`);
    if (p.residence) morceaux.push(p.residence.toLowerCase());
    if (p.surface_totale) morceaux.push(m2(p.surface_totale));
    if (p.bureaux && p.bureaux.crees) morceaux.push(`dont ${m2(p.bureaux.crees)} de bureaux`);
    if (!morceaux.length && p.nature) morceaux.push(p.nature.toLowerCase());
    return morceaux.join(" · ");
  }

  function pastilles(p, avecType = true) {
    const out = [];
    if (avecType) out.push(`<span class="pastille" style="--c:${couleur(p)}"><span class="point"></span>${esc(TYPES[p.type])}</span>`);
    out.push(`<span class="pastille etat-${p.etat}">${esc(ETATS[p.etat])}</span>`);
    if (p.grand_projet) out.push(`<span class="pastille gp">Grand projet</span>`);
    return `<span class="pastilles">${out.join("")}</span>`;
  }

  function carteHtml(p) {
    return `<a class="carte-permis" href="#fiche/${encodeURIComponent(p.id)}" data-id="${esc(p.id)}" style="--c:${couleur(p)}">
      <div class="ligne-haut"><span>${esc(TYPES[p.type])} · ${dateFr(p.date_autorisation)}</span><span>${esc(ETATS[p.etat])}</span></div>
      <div class="adresse">${esc(adresse(p))}</div>
      <div class="demandeur">${esc(demandeur(p))}</div>
      ${resume(p) ? `<div class="chiffres">${esc(resume(p))}</div>` : ""}
    </a>`;
  }

  // ------------------------------------------------------------------ Filtres partagés
  const annees = [...new Set(PERMIS.map(annee).filter(Boolean))].sort();
  const THEMES = { bureaux: "Bureaux", ...(RELEVE ? { pleine_terre: "Pleine terre perdue (relevé)" } : {}) };
  const FILTRES_VIDES = () => ({ texte: "", type: "", categorie: "", theme: "", etat: "", de: annees[0], a: annees[annees.length - 1], gp: false });
  const filtres = FILTRES_VIDES();

  function normaliser(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }
  PERMIS.forEach((p) => {
    p._recherche = normaliser([p.adresse, casse(p.adresse), p.demandeur, p.num, p.parcelles.join(" "), p.residence].join(" "));
  });

  function filtrer() {
    const t = normaliser(filtres.texte).trim();
    return PERMIS.filter((p) => {
      if (t && !t.split(/\s+/).every((m) => p._recherche.includes(m))) return false;
      if (filtres.type && p.type !== filtres.type) return false;
      if (filtres.categorie && p.categorie !== filtres.categorie) return false;
      if (filtres.theme === "bureaux" && !aBureaux(p)) return false;
      if (filtres.theme === "pleine_terre" && !perdPT(p)) return false;
      if (filtres.etat && p.etat !== filtres.etat) return false;
      if (filtres.gp && !p.grand_projet) return false;
      const a = annee(p);
      if (a && (a < filtres.de || a > filtres.a)) return false;
      return true;
    });
  }

  function options(objet, tous) {
    return `<option value="">${tous}</option>` + Object.entries(objet).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
  }
  const optionsAnnees = annees.map((a) => `<option value="${a}">${a}</option>`).join("");
  const LEGENDE = Object.entries(CATEGORIES).map(([k, v]) => `<span><i style="--c:var(--c-${k})"></i>${v}</span>`).join("");

  document.querySelectorAll("[data-filtres]").forEach((zone) => {
    zone.innerHTML = `<form class="filtres" role="search" onsubmit="return false">
      <label class="recherche">Rechercher<input type="search" name="texte" placeholder="Adresse, demandeur, n° de permis…"></label>
      <button type="button" class="bouton-filtres" aria-expanded="false">Filtres</button>
      <label class="plus">Type<select name="type">${options(TYPES, "Tous")}</select></label>
      <label class="plus">Catégorie<select name="categorie">${options(CATEGORIES, "Toutes")}</select></label>
      <label class="plus">Thème<select name="theme">${options(THEMES, "Tous")}</select></label>
      <label class="plus">État<select name="etat">${options(ETATS, "Tous")}</select></label>
      <label class="plus">De<select name="de">${optionsAnnees}</select></label>
      <label class="plus">À<select name="a">${optionsAnnees}</select></label>
      <label class="case plus"><input type="checkbox" name="gp"> Grands projets</label>
      <button type="button" class="reinit plus">Réinitialiser</button>
      ${zone.closest("#vue-carte") ? `<div class="legende" aria-label="Légende">${LEGENDE}</div>` : ""}
    </form>`;
  });

  function synchroniserFormulaires() {
    document.querySelectorAll(".filtres").forEach((f) => {
      f.texte.value = filtres.texte;
      f.type.value = filtres.type;
      f.categorie.value = filtres.categorie;
      f.theme.value = filtres.theme;
      f.etat.value = filtres.etat;
      f.de.value = filtres.de;
      f.a.value = filtres.a;
      f.gp.checked = filtres.gp;
    });
  }
  document.addEventListener("input", (e) => {
    const f = e.target.form;
    if (!f || !f.classList.contains("filtres")) return;
    const champ = e.target.name;
    filtres[champ] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    if (filtres.de > filtres.a) {
      if (champ === "de") filtres.a = filtres.de; else filtres.de = filtres.a;
    }
    synchroniserFormulaires();
    rafraichir();
  });
  document.addEventListener("click", (e) => {
    const bf = e.target.closest(".bouton-filtres");
    if (bf) {
      const ouvert = bf.form.classList.toggle("ouvert");
      bf.setAttribute("aria-expanded", String(ouvert));
      return;
    }
    if (!e.target.classList.contains("reinit")) return;
    Object.assign(filtres, FILTRES_VIDES());
    synchroniserFormulaires();
    rafraichir();
  });
  // Liens « voir sur la carte » qui présélectionnent un thème
  document.addEventListener("click", (e) => {
    const lien = e.target.closest("a[data-theme]");
    if (!lien) return;
    Object.assign(filtres, FILTRES_VIDES(), { theme: lien.dataset.theme });
    synchroniserFormulaires();
  });
  synchroniserFormulaires();

  function compteur(liste) {
    const lgts = liste.filter((p) => p.etat !== "annule").reduce((s, p) => s + (p.logements || 0), 0);
    const txt = `${nombre(liste.length)} autorisation${liste.length > 1 ? "s" : ""}` + (lgts ? ` · ${nombre(lgts)} logements (hors annulés)` : "");
    document.querySelectorAll("[data-compteur]").forEach((el) => (el.textContent = txt));
  }

  // ------------------------------------------------------------------ Infobulle
  const bulle = document.getElementById("infobulle");
  function montrerBulle(html, x, y) {
    bulle.innerHTML = html;
    bulle.hidden = false;
    const r = bulle.getBoundingClientRect();
    const gauche = Math.min(x + 14, window.innerWidth - r.width - 8);
    const haut = y - r.height - 12 < 8 ? y + 16 : y - r.height - 12;
    bulle.style.left = `${Math.max(8, gauche)}px`;
    bulle.style.top = `${haut}px`;
  }
  const cacherBulle = () => (bulle.hidden = true);

  // ------------------------------------------------------------------ Accueil
  function accueil() {
    const actifs = PERMIS.filter((p) => p.etat !== "annule");
    const lgts = actifs.reduce((s, p) => s + (p.logements || 0), 0);
    const gp = PERMIS.filter((p) => p.grand_projet).length;
    const B = totauxBureaux();
    const tuiles = [
      [nombre(lgts), `logements autorisés depuis ${annees[0]} (hors permis annulés)`],
      [m2(arrondi(B.crees, 100)), `de bureaux autorisés depuis ${annees[0]}`],
      RELEVE && RELEVE.terrains_construits ? [m2(arrondi(RELEVE.pertes_m2)), `de pleine terre perdus sur les terrains relevés par des habitants`] : null,
      [nombre(gp), "grands projets"],
    ].filter(Boolean);
    document.getElementById("tuiles").innerHTML = tuiles
      .map(([v, l]) => `<div class="tuile"><div class="valeur">${esc(v)}</div><div class="libelle">${esc(l)}</div></div>`)
      .join("");
    document.getElementById("dernieres").innerHTML = PERMIS.slice(0, 4).map((p) => `<li>${carteHtml(p)}</li>`).join("");
    const part = B.habitation ? Math.round((B.crees / B.habitation) * 100) : null;
    document.getElementById("focus-bureaux").innerHTML =
      `<b>${m2(arrondi(B.crees, 100))}</b> de bureaux autorisés depuis ${annees[0]}` +
      (part ? `, soit l'équivalent de <b>${part} %</b> des surfaces de logement autorisées sur la même période.` : ".");
    document.getElementById("focus-pleine-terre").innerHTML = RELEVE && RELEVE.terrains_construits
      ? `Relevé par ${RELEVE.participants} habitant${RELEVE.participants > 1 ? "s" : ""} sur les photos aériennes : <b>${m2(arrondi(RELEVE.pertes_m2))}</b> de pleine terre perdus sur les terrains des projets construits. Les dossiers de permis donnent les chiffres exacts : nous les demandons.`
      : "Aucune base publique ne mesure la pleine terre. Avec des habitants, nous la relevons terrain par terrain sur les photos aériennes, et nous demandons à la mairie les chiffres des dossiers de permis.";
    document.getElementById("accueil-couverture").textContent = META.donnees_jusqu_au ? `autorisations jusqu'au ${dateFr(META.donnees_jusqu_au, true)}` : "";
    graphique(actifs);
  }

  function graphique(actifs) {
    const parAn = new Map(annees.map((a) => [a, { lgts: 0, n: 0 }]));
    actifs.forEach((p) => {
      const a = annee(p);
      if (!parAn.has(a)) return;
      parAn.get(a).lgts += p.logements || 0;
      if (p.logements) parAn.get(a).n += 1;
    });
    const serie = [...parAn.entries()];
    const derniere = META.donnees_jusqu_au || "";
    const anneePartielle = derniere && !derniere.endsWith("-12-31") ? derniere.slice(0, 4) : null;
    document.getElementById("graphique-note").textContent =
      `Nombre de logements créés par les autorisations accordées chaque année, permis annulés exclus.` +
      (anneePartielle ? ` ${anneePartielle} : jusqu'au ${dateFr(derniere, true)} (barre hachurée).` : "");

    const L = 640, H = 260, g = 40, d = 8, h = 16, b = 28;
    const max = Math.max(...serie.map(([, v]) => v.lgts), 1);
    const pas = max > 400 ? 100 : max > 200 ? 50 : max > 80 ? 20 : 10;
    const plafond = Math.ceil(max / pas) * pas;
    const y = (v) => H - b - (v / plafond) * (H - b - h);
    const largeurBande = (L - g - d) / serie.length;
    const lb = Math.max(6, Math.min(28, largeurBande * 0.62));
    const maxAn = serie.reduce((m, s) => (s[1].lgts > m[1].lgts ? s : m), serie[0]);

    let svg = `<svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Logements autorisés par année à Gentilly">
      <defs><pattern id="hachures" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--surface)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--c-habitat)" stroke-width="2.5"/></pattern></defs>`;
    for (let v = 0; v <= plafond; v += pas) {
      svg += `<line class="${v === 0 ? "axe" : "grille-ligne"}" x1="${g}" x2="${L - d}" y1="${y(v)}" y2="${y(v)}"/>`;
      svg += `<text x="${g - 8}" y="${y(v) + 4}" text-anchor="end">${nombre(v)}</text>`;
    }
    serie.forEach(([a, v], i) => {
      const cx = g + largeurBande * i + largeurBande / 2;
      const top = y(v.lgts);
      const hauteur = Math.max(0, H - b - top);
      const r = Math.min(4, hauteur / 2, lb / 2);
      const x0 = cx - lb / 2, x1 = cx + lb / 2, y0 = H - b;
      const chemin = hauteur > 0
        ? `M${x0},${y0} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x1 - r} Q${x1},${top} ${x1},${top + r} V${y0} Z`
        : "";
      const partielle = a === anneePartielle;
      svg += `<rect class="cible" data-an="${a}" x="${g + largeurBande * i}" y="${h}" width="${largeurBande}" height="${H - b - h}"/>`;
      if (chemin) svg += `<path class="barre${partielle ? " partielle" : ""}" data-an="${a}" d="${chemin}"/>`;
      const etiquette = largeurBande < 34 ? `’${a.slice(2)}` : a;
      svg += `<text x="${cx}" y="${H - b + 18}" text-anchor="middle">${etiquette}</text>`;
      if (a === maxAn[0] || i === serie.length - 1 || v.lgts === 0) {
        svg += `<text class="valeur-barre" x="${cx}" y="${top - 6}" text-anchor="middle">${nombre(v.lgts)}</text>`;
      }
    });
    svg += `</svg>`;
    const zone = document.getElementById("graphique");
    zone.innerHTML = svg;
    const valeurs = new Map(serie);
    zone.querySelectorAll(".cible").forEach((c) => {
      const a = c.dataset.an;
      const v = valeurs.get(a);
      const barre = zone.querySelector(`.barre[data-an="${a}"]`);
      c.addEventListener("mousemove", (e) => {
        barre && barre.classList.add("survol");
        montrerBulle(`<strong>${a}${a === anneePartielle ? " (année en cours)" : ""}</strong>${nombre(v.lgts)} logements · ${v.n} autorisation${v.n > 1 ? "s" : ""}`, e.clientX, e.clientY);
      });
      c.addEventListener("mouseleave", () => { barre && barre.classList.remove("survol"); cacherBulle(); });
      c.addEventListener("click", () => {
        Object.assign(filtres, FILTRES_VIDES(), { de: a, a: a });
        synchroniserFormulaires();
        location.hash = "#liste";
      });
      c.style.cursor = "pointer";
    });
  }

  // ------------------------------------------------------------------ Graphiques en barres positives / négatives

  // Barres verticales par année, au-dessus (haut) et en dessous (bas) de zéro, sur un seul axe.
  function barresAnnuelles(zone, serie, opts) {
    const L = 680, H = 300, g = 64, d = 8, hh = 14, bb = 24;
    const maxH = Math.max(1, ...serie.map((s) => s.haut));
    const maxB = Math.max(0, ...serie.map((s) => s.bas));
    const pas = opts.pas;
    const plafond = Math.ceil(maxH / pas) * pas;
    const plancher = Math.ceil(maxB / pas) * pas;
    const echelle = (H - hh - bb) / (plafond + plancher);
    const y0 = hh + plafond * echelle;
    const bande = (L - g - d) / serie.length;
    const lb = Math.max(6, Math.min(26, bande * 0.6));
    let svg = `<svg viewBox="0 0 ${L} ${H}" role="img" aria-label="${esc(opts.titre)}">`;
    for (let v = -plancher; v <= plafond; v += pas) {
      const y = y0 - v * echelle;
      svg += `<line class="${v === 0 ? "axe" : "grille-ligne"}" x1="${g}" x2="${L - d}" y1="${y}" y2="${y}"/>`;
      svg += `<text x="${g - 8}" y="${y + 4}" text-anchor="end">${nombre(Math.abs(v))}</text>`;
    }
    serie.forEach((s, i) => {
      const cx = g + bande * i + bande / 2;
      const x0 = cx - lb / 2, x1 = cx + lb / 2;
      if (s.haut > 0) {
        const top = y0 - s.haut * echelle, r = Math.min(3, (y0 - top) / 2);
        svg += `<path class="barre-haut" d="M${x0},${y0} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x1 - r} Q${x1},${top} ${x1},${top + r} V${y0} Z"/>`;
      }
      if (s.bas > 0) {
        const bas = y0 + s.bas * echelle, r = Math.min(3, (bas - y0) / 2);
        svg += `<path class="barre-bas" d="M${x0},${y0} V${bas - r} Q${x0},${bas} ${x0 + r},${bas} H${x1 - r} Q${x1},${bas} ${x1},${bas - r} V${y0} Z"/>`;
      }
      svg += `<rect class="cible" data-i="${i}" x="${g + bande * i}" y="${hh}" width="${bande}" height="${H - hh - bb}"/>`;
      svg += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${bande < 34 ? "’" + s.cle.slice(2) : s.cle}</text>`;
      if (s.haut === maxH) svg += `<text class="valeur-barre" x="${cx}" y="${y0 - s.haut * echelle - 6}" text-anchor="middle">${nombre(s.haut)} m²</text>`;
    });
    svg += "</svg>";
    zone.innerHTML = svg;
    zone.querySelectorAll(".cible").forEach((c) => {
      const s = serie[+c.dataset.i];
      c.addEventListener("mousemove", (e) => montrerBulle(opts.bulle(s), e.clientX, e.clientY));
      c.addEventListener("mouseleave", cacherBulle);
    });
  }

  // Barres horizontales par projet, à gauche (négatif) ou à droite (positif) de zéro.
  function barresProjets(zone, lignes) {
    const L = 1000, hl = 26, gauche = 320, d = 90, hh = 8;
    const H = hh + lignes.length * hl + 24;
    const max = Math.max(1, ...lignes.map((l) => Math.abs(l.valeur)));
    const minV = Math.min(0, ...lignes.map((l) => l.valeur));
    const maxV = Math.max(0, ...lignes.map((l) => l.valeur));
    const largeur = L - gauche - d;
    const echelle = largeur / (maxV - minV || max);
    const x0 = gauche + -minV * echelle;
    let svg = `<svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Évolution de la végétation par projet">`;
    svg += `<line class="axe" x1="${x0}" x2="${x0}" y1="${hh - 4}" y2="${H - 20}"/>`;
    lignes.forEach((l, i) => {
      const y = hh + i * hl;
      const w = Math.abs(l.valeur) * echelle;
      const x = l.valeur < 0 ? x0 - w : x0;
      svg += `<a href="#fiche/${encodeURIComponent(l.id)}"><g class="ligne-projet">`;
      svg += `<rect class="cible" x="0" y="${y}" width="${L}" height="${hl}"/>`;
      svg += `<text class="etiquette-projet" x="${gauche - 10}" y="${y + 17}" text-anchor="end">${esc(l.libelle)}</text>`;
      svg += `<rect class="${l.valeur < 0 ? "barre-perte" : "barre-gain"}" x="${x}" y="${y + 5}" width="${Math.max(1, w)}" height="${hl - 10}" rx="2"/>`;
      const tx = l.valeur < 0 ? x0 + 8 : x + w + 6; // pertes : valeur à droite de l'axe, loin des adresses
      svg += `<text class="valeur-barre" x="${tx}" y="${y + 17}" text-anchor="start">${l.valeur > 0 ? "+" : "−"}${nombre(Math.abs(l.valeur))} m²</text>`;
      svg += `</g></a>`;
    });
    svg += `<text x="${x0}" y="${H - 4}" text-anchor="middle">0</text></svg>`;
    zone.innerHTML = svg;
    zone.querySelectorAll(".ligne-projet").forEach((gr, i) => {
      const l = lignes[i];
      gr.addEventListener("mousemove", (e) => montrerBulle(l.bulle, e.clientX, e.clientY));
      gr.addEventListener("mouseleave", cacherBulle);
    });
  }

  // ------------------------------------------------------------------ Page Bureaux
  let bureauxFaits = false;
  function pageBureaux() {
    if (bureauxFaits) return;
    bureauxFaits = true;
    const B = totauxBureaux();
    const part = B.habitation ? Math.round((B.crees / B.habitation) * 100) : 0;
    document.getElementById("bureaux-chapeau").innerHTML =
      `Depuis ${annees[0]}, les permis accordés à Gentilly ont autorisé <b>${m2(B.crees)}</b> de bureaux. ` +
      `C'est l'équivalent de <b>${part} %</b> des surfaces de logement autorisées sur la même période (${m2(B.habitation)}). ` +
      `Une fois retirés les bureaux démolis ou transformés, la ville compte <b>${m2(B.solde)}</b> de bureaux en plus.`;
    const tuiles = [
      [m2(B.crees), "de bureaux créés"],
      [m2(B.demolis), "de bureaux démolis"],
      [m2(B.transformes), "de bureaux transformés, surtout en logements"],
      [`+${m2(B.solde)}`, "de bureaux en plus au total"],
    ];
    document.getElementById("bureaux-tuiles").innerHTML = tuiles
      .map(([v, l]) => `<div class="tuile"><div class="valeur">${esc(v)}</div><div class="libelle">${esc(l)}</div></div>`).join("");

    const parAn = new Map(annees.map((a) => [a, { cle: a, haut: 0, bas: 0, projets: [] }]));
    PERMIS.filter((p) => p.etat !== "annule" && aBureaux(p)).forEach((p) => {
      const s = parAn.get(annee(p));
      if (!s) return;
      s.haut += p.bureaux.crees;
      s.bas += p.bureaux.demolis + p.bureaux.transformes;
      if (p.bureaux.crees >= 1000) s.projets.push(adresse(p));
    });
    barresAnnuelles(document.getElementById("graphique-bureaux"), [...parAn.values()], {
      titre: "Surfaces de bureaux créées et supprimées par année",
      pas: 20000,
      bulle: (s) => `<strong>${s.cle}</strong>${m2(s.haut)} créés · ${m2(s.bas)} démolis ou transformés` +
        (s.projets.length ? `<br>${s.projets.map(esc).join("<br>")}` : ""),
    });

    const projets = PERMIS.filter((p) => aBureaux(p) && p.bureaux.crees >= 100 && p.etat !== "annule")
      .sort((a, b) => b.bureaux.crees - a.bureaux.crees);
    const annules = PERMIS.filter((p) => aBureaux(p) && p.etat === "annule" && p.bureaux.crees >= 100);
    document.getElementById("bureaux-note").textContent =
      `${projets.length} autorisations créent au moins 100 m² de bureaux, de la plus grande à la plus petite.` +
      (annules.length ? ` Non comptés car annulés : ${annules.map((p) => `${adresse(p)} (${m2(p.bureaux.crees)} en ${annee(p)})`).join(", ")}.` : "");
    document.getElementById("bureaux-liste").innerHTML = projets.map((p) => `<li><a class="carte-permis" href="#fiche/${encodeURIComponent(p.id)}" style="--c:var(--c-${p.categorie})">
        <div class="ligne-haut"><span>${esc(TYPES[p.type])} · ${dateFr(p.date_autorisation)}</span><span>${esc(ETATS[p.etat])}</span></div>
        <div class="adresse">${esc(adresse(p))}</div>
        <div class="demandeur">${esc(demandeur(p))}</div>
        <div class="chiffre-cle">${m2(p.bureaux.crees)} <small>de bureaux</small></div>
        ${p.bureaux.demolis ? `<div class="chiffres">${m2(p.bureaux.demolis)} de bureaux démolis</div>` : ""}
      </a></li>`).join("");
  }

  // ------------------------------------------------------------------ Page Pleine terre
  let pleineTerreFaite = false;
  function pagePleineTerre() {
    if (pleineTerreFaite) return;
    pleineTerreFaite = true;
    if (!RELEVE || !RELEVE.terrains_releves) return; // relevé pas encore traité : la page n'affiche que l'explication
    const tuiles = [
      [m2(arrondi(RELEVE.pertes_m2)), "de pleine terre perdus sur les terrains des projets construits"],
      [m2(arrondi(RELEVE.gains_m2)), "de pleine terre créés"],
      [nombre(RELEVE.terrains_releves), "terrains relevés"],
      [nombre(RELEVE.participants), `habitant${RELEVE.participants > 1 ? "s" : ""} ayant participé`],
    ];
    document.getElementById("pt-tuiles").innerHTML = tuiles
      .map(([v, l]) => `<div class="tuile"><div class="valeur">${esc(v)}</div><div class="libelle">${esc(l)}</div></div>`).join("");
    // Un terrain par ligne, rattaché à son autorisation la plus importante
    const principal = new Map();
    PERMIS.forEach((p) => {
      const r = releveDe(p);
      if (!r || !construit(r) || !r.evolution_m2) return;
      const m = principal.get(r.cle);
      if (!m || (p.grand_projet && !m.p.grand_projet)) principal.set(r.cle, { p, r });
    });
    const lignes = [...principal.values()].sort((a, b) => a.r.evolution_m2 - b.r.evolution_m2);
    document.getElementById("pt-resultats").innerHTML = lignes.length ? `<figure class="bloc graphique">
        <figcaption><h2>Pleine terre perdue ou gagnée, terrain par terrain</h2>
        <p class="note">Projets construits ou en chantier. Estimations des habitants sur les photos aériennes avant et après le projet (médiane des réponses). Cliquez sur un terrain pour voir sa fiche.</p></figcaption>
        <div class="legende-graphique"><span><i style="--c:var(--rouge)"></i>Pleine terre perdue</span><span><i style="--c:var(--cyan)"></i>Pleine terre créée</span></div>
        <div id="graphique-pleine-terre" class="graphique-zone"></div></figure>` : "";
    if (lignes.length) {
      barresProjets(document.getElementById("graphique-pleine-terre"), lignes.map(({ p, r }) => ({
        id: p.id,
        valeur: arrondi(r.evolution_m2),
        libelle: adresse(p).length > 40 ? adresse(p).slice(0, 39) + "…" : adresse(p),
        bulle: `<strong>${esc(adresse(p))}</strong>Pleine terre : ${Math.round(r.part_avant_pct)} % du terrain avant, ${Math.round(r.part_apres_pct)} % après` +
          `<br>${r.nb_reponses} réponse${r.nb_reponses > 1 ? "s" : ""}${r.desaccord ? " · avis divergents" : ""}`,
      })));
    }
    document.getElementById("pt-lien-carte").hidden = !lignes.some(({ r }) => r.evolution_m2 < 0);
  }

  // ------------------------------------------------------------------ Carte
  const IGN = (couche, format, style = "normal") =>
    `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${couche}&STYLE=${encodeURIComponent(style)}&TILEMATRIXSET=PM&FORMAT=${format}&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`;
  const ATTRIB_IGN = '© <a href="https://www.ign.fr/" target="_blank" rel="noopener">IGN</a> · Données Sitadel (SDES)';
  function fonds() {
    const opts = { maxZoom: 20, maxNativeZoom: 19, attribution: ATTRIB_IGN };
    return {
      plan: L.tileLayer(IGN("GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2", "image/png"), { ...opts, className: "fond-plan" }),
      photo: L.tileLayer(IGN("ORTHOIMAGERY.ORTHOPHOTOS", "image/jpeg"), opts),
      cadastre: L.tileLayer(IGN("CADASTRALPARCELS.PARCELLAIRE_EXPRESS", "image/png", "PCI vecteur"), { ...opts, opacity: 0.85 }),
    };
  }
  function couleurCss(p) {
    return getComputedStyle(document.documentElement).getPropertyValue(`--c-${p.categorie}`).trim() || "#2a78d6";
  }
  function rayon(p) {
    const taille = Math.max(p.logements || 0, (p.surface_totale || 0) / 70);
    const r = Math.max(6, Math.min(18, 5 + Math.sqrt(taille) * 1.1));
    return window.matchMedia("(max-width: 700px)").matches ? Math.max(5, r * 0.7) : r;
  }

  let carte, coucheMarqueurs, coucheContours, coucheCommune;
  const marqueursParLieu = new Map();

  function initCarte() {
    if (carte || typeof L === "undefined") return;
    const f = fonds();
    carte = L.map("carte", { layers: [f.plan], zoomSnap: 0.5 });
    L.control.layers({ "Plan IGN": f.plan, "Photo aérienne": f.photo }, { "Cadastre": f.cadastre }, { collapsed: true }).addTo(carte);
    L.control.scale({ imperial: false }).addTo(carte);
    if (DONNEES.commune) {
      coucheCommune = L.geoJSON(DONNEES.commune, { style: { color: "#3155a6", weight: 2.5, dashArray: "8 5", fill: false }, interactive: false }).addTo(carte);
      carte.fitBounds(coucheCommune.getBounds(), { padding: [10, 10] });
    } else {
      carte.setView([48.8155, 2.3445], 15);
    }
    coucheContours = L.layerGroup().addTo(carte);
    coucheMarqueurs = L.layerGroup().addTo(carte);
  }

  function dessinerCarte(liste) {
    if (!carte) return;
    coucheMarqueurs.clearLayers();
    coucheContours.clearLayers();
    marqueursParLieu.clear();
    const lieux = new Map();
    liste.forEach((p) => {
      if (p.lat == null) return;
      const cle = `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
      if (!lieux.has(cle)) lieux.set(cle, []);
      lieux.get(cle).push(p);
    });
    // Petits points d'abord, grands projets au-dessus.
    const groupes = [...lieux.values()].sort((a, b) => Math.max(...a.map(rayon)) - Math.max(...b.map(rayon)));
    groupes.forEach((groupe) => {
      const principal = groupe.reduce((m, p) => (rayon(p) > rayon(m) ? p : m), groupe[0]);
      const c = couleurCss(principal);
      const gp = groupe.some((p) => p.grand_projet);
      groupe.forEach((p) =>
        (p.contours || []).forEach((geom) =>
          L.geoJSON(geom, { style: { color: couleurCss(p), weight: 1.5, fillOpacity: 0.12, opacity: 0.8 }, interactive: false }).addTo(coucheContours)
        )
      );
      const m = L.circleMarker([principal.lat, principal.lon], {
        radius: rayon(principal),
        color: "#1b1d24",
        weight: gp ? 2.5 : 1,
        opacity: gp ? 1 : 0.6,
        fillColor: c,
        fillOpacity: principal.etat === "annule" ? 0.35 : 0.9,
      });
      const html = groupe
        .sort((a, b) => (b.date_autorisation || "").localeCompare(a.date_autorisation || ""))
        .map((p) => `<div class="popup-permis"><span class="type">${esc(TYPES[p.type])} · ${dateFr(p.date_autorisation)} · ${esc(ETATS[p.etat])}</span>
          <strong>${esc(adresse(p))}</strong>${esc(demandeur(p))}${resume(p) ? `<br>${esc(resume(p))}` : ""}<br><a href="#fiche/${encodeURIComponent(p.id)}">Voir la fiche →</a></div>`)
        .join("");
      m.bindPopup(html, { maxWidth: 300 });
      m.bindTooltip(`${adresse(principal)}${groupe.length > 1 ? ` (+${groupe.length - 1})` : ""}`, { direction: "top", offset: [0, -6] });
      m.addTo(coucheMarqueurs);
      groupe.forEach((p) => marqueursParLieu.set(p.id, m));
    });
  }

  function listeCarte(liste) {
    const ul = document.getElementById("carte-liste");
    const affiches = liste.slice(0, 300);
    ul.innerHTML = affiches.map((p) => `<li>${carteHtml(p)}</li>`).join("") +
      (liste.length > affiches.length ? `<li class="note">… et ${liste.length - affiches.length} autres : affinez la recherche.</li>` : "") +
      (liste.length ? "" : `<li class="vide">Aucune autorisation ne correspond à ces filtres.</li>`);
  }
  document.getElementById("carte-liste").addEventListener("mouseover", (e) => {
    const a = e.target.closest(".carte-permis");
    if (!a || !carte) return;
    const m = marqueursParLieu.get(a.dataset.id);
    if (m) m.openTooltip();
  });
  document.getElementById("carte-liste").addEventListener("click", (e) => {
    const a = e.target.closest(".carte-permis");
    if (!a || !carte || window.matchMedia("(max-width: 900px)").matches) return;
    const m = marqueursParLieu.get(a.dataset.id);
    if (!m) return;
    e.preventDefault();
    carte.flyTo(m.getLatLng(), Math.max(carte.getZoom(), 17), { duration: 0.6 });
    m.openPopup();
  });

  // ------------------------------------------------------------------ Grands projets
  let periodeGp = "recent";
  function grandsProjets() {
    const anMax = +annees[annees.length - 1];
    const periodes = { recent: [`Depuis ${anMax - 5}`, (p) => +annee(p) >= anMax - 5], tous: [`Depuis ${annees[0]}`, () => true] };
    const seg = document.getElementById("gp-periode");
    seg.innerHTML = Object.entries(periodes).map(([k, [lib]]) => `<button type="button" data-periode="${k}" aria-pressed="${k === periodeGp}">${lib}</button>`).join("");
    const liste = PERMIS.filter((p) => p.grand_projet && periodes[periodeGp][1](p));
    const lgts = liste.filter((p) => p.etat !== "annule").reduce((s, p) => s + (p.logements || 0), 0);
    const s = META.seuils_grand_projet || { logements: 10, surface_m2: 1000 };
    document.getElementById("gp-chapeau").textContent =
      `${liste.length} opérations : permis d'au moins ${s.logements} logements ou ${nombre(s.surface_m2)} m², permis de démolir de sociétés ou collectivités, et permis d'aménager. ` +
      `Ensemble, hors permis annulés, elles prévoient ${nombre(lgts)} logements.`;
    document.getElementById("gp-liste").innerHTML = liste
      .map((p) => `<li><a class="carte-permis" href="#fiche/${encodeURIComponent(p.id)}" style="--c:${couleur(p)}">
        <div class="ligne-haut"><span>${esc(TYPES[p.type])} · accordé le ${dateFr(p.date_autorisation)}</span></div>
        <div class="adresse">${esc((COMPLEMENTS[p.num] && COMPLEMENTS[p.num].titre) || adresse(p))}</div>
        <div class="demandeur">${esc(demandeur(p))}${COMPLEMENTS[p.num] && COMPLEMENTS[p.num].titre ? ` · ${esc(adresse(p))}` : ""}</div>
        ${resume(p) ? `<div class="chiffres">${esc(resume(p))}</div>` : ""}
        <div style="margin-top:10px">${pastilles(p, false)}</div>
      </a></li>`)
      .join("");
  }
  document.getElementById("gp-periode").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-periode]");
    if (!b) return;
    periodeGp = b.dataset.periode;
    grandsProjets();
  });

  // ------------------------------------------------------------------ Tableau
  let tri = { cle: "date_autorisation", sens: -1 };
  function tableau(liste) {
    const v = (p) => {
      const x = tri.cle === "adresse" ? adresse(p) : tri.cle === "demandeur" ? demandeur(p) : p[tri.cle];
      return x == null ? "" : x;
    };
    const tries = [...liste].sort((a, b) => {
      const x = v(a), y = v(b);
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "fr", { numeric: true });
      return r * tri.sens;
    });
    document.querySelectorAll("#tableau th").forEach((th) => {
      const cle = th.querySelector("button").dataset.tri;
      th.setAttribute("aria-sort", cle === tri.cle ? (tri.sens > 0 ? "ascending" : "descending") : "none");
    });
    document.querySelector("#tableau tbody").innerHTML = tries.length
      ? tries.map((p) => `<tr data-id="${esc(p.id)}">
        <td class="date">${dateFr(p.date_autorisation)}</td>
        <td><a href="#fiche/${encodeURIComponent(p.id)}">${esc(adresse(p))}</a>${p.grand_projet ? '<span class="gp-marque">GRAND PROJET</span>' : ""}</td>
        <td><span class="pastille" style="--c:${couleur(p)}"><span class="point"></span>${esc(p.type)}</span></td>
        <td>${esc(demandeur(p))}</td>
        <td class="num">${p.logements ? nombre(p.logements) : ""}</td>
        <td class="num">${p.surface_totale ? m2(p.surface_totale) : ""}</td>
        <td class="num">${p.bureaux_crees ? m2(p.bureaux_crees) : ""}</td>
        ${RELEVE ? `<td class="num ${perdPT(p) ? "perte" : ""}">${p.pt_evolution ? `${p.pt_evolution > 0 ? "+" : "−"}${m2(arrondi(Math.abs(p.pt_evolution)))}` : ""}</td>` : ""}
        <td>${esc(ETATS[p.etat])}</td>
      </tr>`).join("")
      : `<tr><td colspan="${RELEVE ? 9 : 8}" class="vide">Aucune autorisation ne correspond à ces filtres.</td></tr>`;
  }
  document.querySelector("#tableau thead").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tri]");
    if (!b) return;
    tri = { cle: b.dataset.tri, sens: tri.cle === b.dataset.tri ? -tri.sens : (["adresse", "demandeur", "type", "etat"].includes(b.dataset.tri) ? 1 : -1) };
    tableau(filtrer());
  });
  document.querySelector("#tableau tbody").addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    const tr = e.target.closest("tr[data-id]");
    if (tr) location.hash = `#fiche/${encodeURIComponent(tr.dataset.id)}`;
  });

  // ------------------------------------------------------------------ Fiche
  let carteFiche;
  let cartesPhotos = [];
  let vuePrecedente = "#carte";
  function ligne(lib, val) {
    return val === null || val === undefined || val === "" ? "" : `<tr><th scope="row">${lib}</th><td>${val}</td></tr>`;
  }
  function fiche(id) {
    const p = PAR_ID.get(id);
    const zone = document.getElementById("fiche");
    if (!p) {
      zone.innerHTML = `<a class="retour" href="#liste">← Retour</a><p class="vide">Cette autorisation n'existe pas ou n'est plus publiée.</p>`;
      return;
    }
    const comp = COMPLEMENTS[p.num] || null;
    const chiffres = [];
    if (p.logements) chiffres.push([nombre(p.logements), `logement${p.logements > 1 ? "s" : ""} créé${p.logements > 1 ? "s" : ""}`]);
    if (p.logements_sociaux) chiffres.push([nombre(p.logements_sociaux), "logements locatifs sociaux déclarés"]);
    if (p.surface_totale) chiffres.push([m2(p.surface_totale), "de surface de plancher créée ou transformée"]);
    if (p.niveaux) chiffres.push([nombre(p.niveaux), "niveaux au maximum"]);
    if (p.terrain_m2) chiffres.push([m2(p.terrain_m2), "de terrain"]);

    const etapes = [
      ["Dépôt", p.date_depot && !p.date_depot.endsWith("-01-01") ? dateFr(p.date_depot) : p.annee_depot],
      [p.etat === "annule" ? "Accordé, puis annulé" : "Autorisation", dateFr(p.date_autorisation)],
      ["Ouverture du chantier", p.date_chantier ? dateFr(p.date_chantier) : null],
      ["Achèvement", p.date_achevement ? dateFr(p.date_achevement) : null],
    ];
    const etapesHtml = `<ol class="etapes">${etapes.map(([lib, val]) => `<li class="${val ? "fait" : ""}"><b>${lib}</b>${val ? esc(val) : "non déclaré"}</li>`).join("")}</ol>`;

    const typo = Object.entries(p.typologie || {}).map(([k, n]) => `${n} × ${k.replace("_PLUS", " et +").replace("P", " p.")}`).join(", ");
    const locaux = Object.entries(p.locaux || {}).map(([k, n]) => `${esc(k)} : ${m2(n)}`).join("<br>");
    const siren = p.siren ? ` · <a href="https://annuaire-entreprises.data.gouv.fr/entreprise/${encodeURIComponent(p.siren)}" target="_blank" rel="noopener">fiche entreprise</a>` : "";
    const details = [
      ligne("Numéro", `<span style="font-family:ui-monospace,monospace">${esc(p.num)}</span>`),
      ligne("Demandeur", esc(demandeur(p)) + siren),
      ligne("Nature du projet", esc(p.nature)),
      ligne("Résidence", esc(p.residence)),
      ligne("Typologie des logements", esc(typo)),
      ligne("Logements individuels / collectifs", p.logements ? `${nombre(p.logements_individuels)} / ${nombre(p.logements_collectifs)}` : ""),
      ligne("Logements aidés (accession, hors PTZ)", p.logements_aides ? nombre(p.logements_aides) : ""),
      ligne("Logements démolis", p.logements_demolis ? nombre(p.logements_demolis) : ""),
      ligne("Habitation créée", p.surf_hab_creee ? m2(p.surf_hab_creee) : ""),
      ligne("Habitation issue d'une transformation", p.surf_hab_transfo ? m2(p.surf_hab_transfo) : ""),
      ligne("Habitation démolie", p.surf_hab_demolie ? m2(p.surf_hab_demolie) : ""),
      ligne("Activités créées ou transformées", locaux),
      ligne("Activités démolies", p.surf_loc_demolie ? m2(p.surf_loc_demolie) : ""),
      ligne("Chambres (hôtel, foyer…)", p.chambres ? nombre(p.chambres) : ""),
      ligne("Équipement public", esc(p.service_public)),
      ligne("Usage prévu", esc(p.utilisation)),
      ligne("Surélévation ou niveaux ajoutés", p.surelevation ? "Oui" : ""),
      ligne("Zone", esc(p.zone)),
      ligne("Parcelles cadastrales", esc(p.parcelles.join(", "))),
      ligne("Dernière mise à jour Sitadel", p.maj_sitadel ? dateFr(p.maj_sitadel) : ""),
    ].join("");

    let bureauxHtml = "";
    if (aBureaux(p)) {
      const b = p.bureaux;
      bureauxHtml = `<div class="bloc bloc-theme"><h2>Bureaux</h2><table class="details"><tbody>
        ${ligne("Bureaux existants avant travaux", b.existants ? m2(b.existants) : "")}
        ${ligne("Bureaux créés", b.crees ? `<b>${m2(b.crees)}</b>` : "")}
        ${ligne("Bureaux démolis", b.demolis ? m2(b.demolis) : "")}
        ${ligne("Bureaux transformés (en logements ou autre)", b.transformes ? m2(b.transformes) : "")}
        ${ligne("Solde", `${b.crees - b.demolis - b.transformes >= 0 ? "+" : "−"}${m2(Math.abs(b.crees - b.demolis - b.transformes))}`)}
      </tbody></table></div>`;
    }
    // Photos aériennes avant / après, et résultat du relevé collaboratif s'il existe
    const anRef = +(p.date_autorisation || "").slice(0, 4) || 9999;
    const photoAvant = [...PHOTOS].reverse().find((ph) => ph.annee < anRef);
    const photoApres = PHOTOS[PHOTOS.length - 1];
    let ptHtml = "";
    if ((p.contours || []).length && photoAvant && photoApres && photoAvant !== photoApres) {
      const r = releveDe(p);
      let phrase = "";
      if (r && r.part_avant_pct !== null && r.part_apres_pct !== null) {
        phrase = `<p>Relevé par ${r.nb_reponses} habitant${r.nb_reponses > 1 ? "s" : ""} : environ <b>${Math.round(r.part_avant_pct)} %</b> du terrain en pleine terre avant le projet, <b>${Math.round(r.part_apres_pct)} %</b> après` +
          (construit(r) && r.evolution_m2 ? `, soit <b class="${r.evolution_m2 < 0 ? "perte" : "gain"}">${r.evolution_m2 < 0 ? "−" : "+"}${m2(Math.abs(arrondi(r.evolution_m2)))}</b>` : "") +
          `.${r.desaccord ? " Les avis divergent sur ce terrain." : ""}</p>`;
      }
      ptHtml = `<div class="bloc bloc-theme"><h2>Le terrain avant et après</h2>${phrase}
        <div class="avant-apres"><figure><div id="carte-avant" class="carte-photo"></div><figcaption>${photoAvant.annee}, avant le projet</figcaption></figure>
        <figure><div id="carte-apres" class="carte-photo"></div><figcaption>${photoApres.annee}</figcaption></figure></div>
        <p class="note">Photos aériennes de l'IGN, terrain du projet entouré en blanc. <a href="#pleine-terre">Pourquoi la pleine terre compte</a></p></div>`;
    }

    const lies = (p.lies || []).map((i) => PAR_ID.get(i)).filter(Boolean);
    const liesHtml = lies.length
      ? `<div class="bloc"><h2>Sur les mêmes parcelles</h2><ul class="liste-cartes compacte">${lies.map((q) => `<li>${carteHtml(q)}</li>`).join("")}</ul></div>`
      : "";

    const liensExt = [];
    if (p.lat != null) {
      liensExt.push(`<a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${p.lat},${p.lon}" target="_blank" rel="noopener">Vue de la rue (Google Street View)</a>`);
      liensExt.push(`<a href="https://www.geoportail.gouv.fr/carte?c=${p.lon},${p.lat}&z=19&l0=ORTHOIMAGERY.ORTHOPHOTOS::GEOPORTAIL:OGC:WMTS(1)&l1=CADASTRALPARCELS.PARCELLAIRE_EXPRESS::GEOPORTAIL:OGC:WMTS(1)&permalink=yes" target="_blank" rel="noopener">Photo aérienne et cadastre (Géoportail)</a>`);
      liensExt.push(`<a href="https://www.geoportail-urbanisme.gouv.fr/map/#tile=1&lon=${p.lon}&lat=${p.lat}&zoom=18" target="_blank" rel="noopener">Règles d'urbanisme applicables (Géoportail de l'urbanisme)</a>`);
    }
    liensExt.push(`<a href="${esc(META.source_url)}" target="_blank" rel="noopener">Source : base Sitadel</a>`);

    const compHtml = comp
      ? `<div class="bloc complement"><h2>Notes de l'observatoire</h2>
          ${(comp.texte || "").split(/\n\n+/).filter(Boolean).map((t) => `<p>${esc(t)}</p>`).join("")}
          ${(comp.images || []).map((im) => `<figure><img src="${esc(im.src)}" alt="${esc(im.legende || "")}" loading="lazy"><figcaption>${esc(im.legende || "")}${im.credit ? ` · ${esc(im.credit)}` : ""}</figcaption></figure>`).join("")}
          ${(comp.liens || []).length ? `<ul class="liens-ext">${comp.liens.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.titre)}</a></li>`).join("")}</ul>` : ""}
        </div>`
      : "";

    zone.innerHTML = `
      <a class="retour" href="${esc(vuePrecedente)}">← Retour</a>
      <div class="fiche-entete">
        ${pastilles(p)}
        <h1>${esc((comp && comp.titre) || adresse(p))}</h1>
        <p class="sous-titre">${esc(comp && comp.titre ? adresse(p) + " · " : "")}${esc(demandeur(p))} · ${esc(TYPES[p.type])} accordé le ${dateFr(p.date_autorisation, true)}</p>
      </div>
      ${chiffres.length ? `<div class="fiche-chiffres">${chiffres.map(([v, l]) => `<div class="tuile"><div class="valeur">${esc(v)}</div><div class="libelle">${esc(l)}</div></div>`).join("")}</div>` : ""}
      <div class="fiche-grille">
        <div>
          <div class="bloc"><h2>Calendrier</h2>${etapesHtml}</div>
          ${compHtml}
          ${bureauxHtml}
          ${ptHtml}
          <div class="bloc"><h2>Détails déclarés</h2><table class="details"><tbody>${details}</tbody></table>
            <p class="note" style="margin-top:10px">Chiffres déclarés par le demandeur à la date de l'autorisation initiale, sans les éventuels permis modificatifs.</p></div>
          ${liesHtml}
        </div>
        <div>
          <div class="bloc">
            ${p.lat != null ? `<div id="fiche-carte" class="fiche-carte"></div>` : `<p class="note">Cette autorisation n'a pas pu être localisée.</p>`}
            <ul class="liens-ext">${liensExt.map((l) => `<li>${l}</li>`).join("")}</ul>
          </div>
          <div class="bloc">
            <h2>Consulter le dossier complet</h2>
            <p class="note" style="color:var(--encre-2)">Les plans et l'arrêté ne sont pas publiés en ligne. Toute personne peut demander à la mairie de Gentilly une copie du dossier n° ${esc(p.num)} (droit d'accès aux documents administratifs). Sans réponse sous un mois, la <a href="https://www.cada.fr" target="_blank" rel="noopener">CADA</a> peut être saisie gratuitement.</p>
          </div>
        </div>
      </div>`;

    if (carteFiche) { carteFiche.remove(); carteFiche = null; }
    cartesPhotos.forEach((c) => c.remove());
    cartesPhotos = [];
    if (ptHtml && typeof L !== "undefined") {
      [["carte-avant", photoAvant], ["carte-apres", photoApres]].forEach(([idCarte, ph]) => {
        const c = L.map(idCarte, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false });
        L.tileLayer(IGN(ph.couche, "image/jpeg"), { maxZoom: 20, maxNativeZoom: ph.zmax }).addTo(c);
        const gr = L.featureGroup((p.contours || []).map((geom) => L.geoJSON(geom, { style: { color: "#ffffff", weight: 2.5, fill: false } }))).addTo(c);
        c.fitBounds(gr.getBounds(), { padding: [12, 12], maxZoom: 19 });
        cartesPhotos.push(c);
      });
    }
    if (p.lat != null && typeof L !== "undefined") {
      const f = fonds();
      carteFiche = L.map("fiche-carte", { layers: [f.photo], zoomControl: true, scrollWheelZoom: false });
      const fondsFiche = { "Photo aérienne": f.photo, "Plan IGN": f.plan };
      (META.photos_couleur || []).filter((ph) => ph.annee >= 2008).forEach((ph) => {
        fondsFiche[`Photo ${ph.annee}`] = L.tileLayer(IGN(ph.couche, "image/jpeg"), { maxZoom: 20, maxNativeZoom: ph.zmax, attribution: ATTRIB_IGN });
      });
      L.control.layers(fondsFiche, { "Cadastre": f.cadastre }).addTo(carteFiche);
      const groupe = L.featureGroup().addTo(carteFiche);
      (p.contours || []).forEach((geom) => L.geoJSON(geom, { style: { color: "#ffffff", weight: 2.5, fillColor: couleurCss(p), fillOpacity: 0.3 } }).addTo(groupe));
      L.circleMarker([p.lat, p.lon], { radius: 7, color: "#ffffff", weight: 2, fillColor: couleurCss(p), fillOpacity: 1 }).addTo(groupe);
      if (p.contours && p.contours.length) carteFiche.fitBounds(groupe.getBounds(), { padding: [30, 30], maxZoom: 19 });
      else carteFiche.setView([p.lat, p.lon], 18);
    }
    document.title = `${adresse(p)} — Observatoire de l'urbanisme de Gentilly`;
  }

  // ------------------------------------------------------------------ Navigation
  const TITRE = document.title;
  function rafraichir() {
    const liste = filtrer();
    compteur(liste);
    const vue = document.querySelector(".vue:not([hidden])");
    if (!vue) return;
    if (vue.dataset.vue === "carte") { dessinerCarte(liste); listeCarte(liste); }
    if (vue.dataset.vue === "liste") tableau(liste);
  }

  function router() {
    const h = decodeURIComponent(location.hash.replace(/^#/, "")) || "accueil";
    const [nom, id] = h.startsWith("fiche/") ? ["fiche", h.slice(6)] : [h, null];
    const vue = document.querySelector(`.vue[data-vue="${nom}"]`) ? nom : "accueil";
    document.querySelectorAll(".vue").forEach((v) => (v.hidden = v.dataset.vue !== vue));
    document.querySelectorAll(".nav a").forEach((a) => {
      if (a.dataset.vue === vue) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    document.getElementById("nav").classList.remove("ouvert");
    document.querySelector(".menu-bouton").setAttribute("aria-expanded", "false");
    cacherBulle();
    if (vue !== "fiche") { vuePrecedente = `#${vue}`; document.title = TITRE; }
    if (vue === "fiche") fiche(id);
    if (vue === "carte") { initCarte(); setTimeout(() => carte && carte.invalidateSize(), 0); }
    if (vue === "grands-projets") grandsProjets();
    if (vue === "bureaux") pageBureaux();
    if (vue === "pleine-terre") pagePleineTerre();
    rafraichir();
    window.scrollTo(0, 0);
  }

  document.querySelector(".menu-bouton").addEventListener("click", (e) => {
    const nav = document.getElementById("nav");
    const ouvert = nav.classList.toggle("ouvert");
    e.currentTarget.setAttribute("aria-expanded", String(ouvert));
  });

  // Textes dépendant de la date des données.
  const maj = META.maj_source ? `Données mises à jour par le ministère le ${dateFr(META.maj_source, true)}, couvrant les autorisations jusqu'au ${dateFr(META.donnees_jusqu_au, true)}.` : "";
  document.getElementById("apropos-maj").textContent = maj;
  if (!RELEVE) document.getElementById("th-pleine-terre").remove();
  if (META.seuils_grand_projet) {
    const s = META.seuils_grand_projet;
    document.getElementById("apropos-seuils").textContent =
      `Un permis de construire d'au moins ${s.logements} logements ou ${nombre(s.surface_m2)} m² de surface de plancher créée ou transformée, un permis de démolir déposé par une société ou une collectivité, ou un permis d'aménager.`;
  }

  // Logo du Bien Commun pour Gentilly : s'il est déposé dans assets/logo-bcg.png, il remplace le bloc typographique.
  const logo = new Image();
  logo.onload = () => {
    document.querySelectorAll("[data-logo]").forEach((bloc) => {
      const img = document.createElement("img");
      img.src = logo.src;
      img.alt = "Bien Commun pour Gentilly";
      img.className = "logo-bcg";
      bloc.replaceWith(img);
    });
  };
  logo.src = "assets/logo-bcg.png";

  accueil();
  window.addEventListener("hashchange", router);
  router();
})();
