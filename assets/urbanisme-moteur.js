/* Moteur de comparaison ancien PLU / PLUi : règle générale + exceptions + niveau de fiabilité.
   Aucune dépendance au DOM : le même code est exécuté par le site et par le script de contrôle (node scripts/controle_moteur.js).
   Principe : une règle générale identique ne prouve pas que les droits à construire sont inchangés ; on compare AUSSI les exceptions
   (amélioration de l'existant, petits terrains, majorations, annexes…) et on indique le niveau de fiabilité de la comparaison.
   Niveaux : f = comparaison historique fiable ; p = comparaison partielle ; v = information à vérifier. */
(function (root) {
  const fm = v => v == null ? '—' : v === Infinity ? 'aucune limite' : String(v).replace('.', ',') + ' m';
  const fpc = v => v == null ? '—' : v === Infinity ? 'aucune limite' : v + ' %';
  const sgn = (a, b) => a == null || b == null ? null : (b > a ? 1 : b < a ? -1 : 0);
  const num = v => { if (typeof v === 'number') return v; const m = /(\d+(?:[.,]\d+)?)/.exec(v || ''); return m ? parseFloat(m[1].replace(',', '.')) : null; };

  // une exception réservée aux petits terrains ne compte pas dans la comparaison si le terrain est nettement au-dessus du seuil (marge de 10 %)
  const pertinent = (ex, s) => (ex || []).filter(x => x.seuil == null || s < x.seuil * 1.1);
  function exDiff(exA, exN, ign) {
    const ka = {}, kn = {};
    (exA || []).forEach(x => ka[x.k] = x); (exN || []).forEach(x => kn[x.k] = x);
    const keys = [...new Set([...Object.keys(ka), ...Object.keys(kn)])].filter(k => !(ign || []).includes(k));
    const same = [], diff = [];
    keys.forEach(k => {
      const a = ka[k], n = kn[k];
      if (a && n) { ((a.v === n.v || a.v == null || n.v == null) && (a.seuil === n.seuil)) ? same.push({ k, a, n }) : diff.push({ k, a, n, type: 'valeur' }); }
      else if (a) diff.push({ k, a, type: 'ancien' });
      else diff.push({ k, n, type: 'nouveau' });
    });
    return { same, diff };
  }
  const NOTE_EQUIV = { maj_equip: 'équivalent partiel seulement dans le PLUi : installations techniques exclues du calcul jusqu’à 2 m (lexique, p. 393) et dispositifs d’énergie renouvelable admis jusqu’à 1,50 m au-delà de la hauteur maximale (règles environnementales de la zone) ; ce n’est pas une majoration de la même nature' };

  function appl(x, s) {
    if (x.seuil != null) {
      const proche = Math.abs(s - x.seuil) / x.seuil <= 0.1;
      return (s < x.seuil ? 'oui : ce terrain (' + Math.round(s) + ' m²) est sous le seuil de ' + x.seuil + ' m²' : 'non : ce terrain (' + Math.round(s) + ' m²) n’est pas sous le seuil de ' + x.seuil + ' m²') + (proche ? ' — surface proche du seuil : le seuil porte sur l’unité foncière, la surface cadastrale est approximative : à vérifier' : '');
    }
    return 'selon le projet (conditions dans le texte)';
  }
  const proche = (d, s) => [d.a, d.n].some(x => x && x.seuil != null && Math.abs(s - x.seuil) / x.seuil <= 0.1);
  const lignesEx = (ex, s, ref) => (ex || []).map(x => ({ t: x.t, art: x.art || '', app: appl(x, s), k: x.k }));

  function refA(A, k) { const a = A && A[k]; return a ? (A.fichier + ', art. ' + a.art + (a.p_pdf_zone ? ', p. ' + a.p_pdf_zone + ' du PDF de zone' + (a.p_imprimee ? ' (page imprimée ' + a.p_imprimee + ')' : '') : '')) : null; }
  function refN(N, k) { const n = N && N[k]; return n ? (n.art + ', p. ' + n.p + ' du PDF du règlement') : null; }

  function finir(o, p, k, REG, opts) {
    // o : {rows, diffs, ev}; niveau et libellé
    const why = o.why || [];
    let niv = 'f';
    if (!o.luA) { niv = 'p'; why.push('exceptions de l’ancien PLU pour la zone ' + (p.az || '?') + ' non relues : comparaison limitée aux règles générales'); }
    if (!o.luN) { niv = 'v'; why.push('règle du PLUi non relue pour le code ' + p.z); }
    if (o.diffs.some(d => d.incertain)) { if (niv === 'f') niv = 'p'; why.push('une différence d’exception n’est pas établie avec certitude (équivalence entre les deux textes, ou surface proche d’un seuil) : voir le détail'); }
    if (opts && opts.graphique) { if (niv === 'f') niv = 'p'; why.push(opts.graphique); }
    if (o.nc) { niv = 'v'; why.push(o.nc); }
    if (p.ch && niv === 'f') { niv = 'p'; why.push('terrain à cheval sur plusieurs zones : seule la zone majoritaire est comparée'); }
    let label;
    if (o.nc) label = 'non comparable';
    else if (o.ev === 'inchangée' && !o.diffs.length) label = 'Identique (règle générale et exceptions relues)';
    else if (o.ev === 'inchangée') label = 'Règle générale identique ; exceptions différentes';
    else if (o.ev === 'non comparable') label = 'Non comparable';
    else label = ({ hausse: 'Hausse de la règle générale', baisse: 'Baisse de la règle générale', mixte: 'Évolution mixte de la règle générale', 'plus exigeante': 'Règle générale plus exigeante', 'moins exigeante': 'Règle générale moins exigeante' })[o.ev] + (o.diffs.length ? ' ; exceptions différentes' : '');
    // terrain à cheval : si la zone retenue (PLUi ou ancienne) couvre moins de 80 % du terrain, le résultat n'est pas déterminé
    if (p.ch && ((p.zp != null && p.zp < 80) || (p.azp != null && p.azp < 80))) {
      o.evBrut = o.ev; o.ev = 'non déterminé'; niv = 'v';
      why.push('terrain à cheval sur plusieurs zones : la zone retenue ne couvre que ' + Math.min(p.zp == null ? 100 : p.zp, p.azp == null ? 100 : p.azp) + ' % du terrain ; le résultat est calculé pour cette zone seulement et n’est pas déterminé pour l’ensemble du terrain');
      label = 'Non déterminé (terrain à cheval sur plusieurs zones) ; valeur de la zone retenue : ' + label;
    }
    o.niv = niv; o.why = why; o.label = label; o.k = k;
    o.refA = refA(REG.RA[p.az], k); o.refN = refN(REG.RN[p.z], k);
    return o;
  }

  function globalEv(rows, hi, lo) {
    const s = rows.map(r => r.sg).filter(x => x != null);
    if (!s.length) return 'non comparable';
    const up = s.some(x => x > 0), dn = s.some(x => x < 0);
    return up && dn ? 'mixte' : up ? hi : dn ? lo : 'inchangée';
  }
  const evl = (sg, hi, lo) => sg == null ? 'non comparable' : sg > 0 ? hi : sg < 0 ? lo : 'inchangée';

  // ------------------------------------------------------------------ hauteur
  function side(h) { const o = {}; ['faitage', 'egout', 'acrotere', 'pph'].forEach(k => { if (h && h[k] != null) o[k] = h[k]; }); return o; }
  function cmpH(p, REG) {
    const A = REG.RA[p.az], N = REG.RN[p.z];
    const a = A ? A.h : null, n = N && N.h && N.h.txt ? N.h : null;
    if (a && a.nc) { const o = { rows: [{ lab: 'Hauteur', a: 'non comparable', n: fm(n && (n.faitage != null ? n.faitage : n.pph)), sg: null, ev: 'non comparable', note: a.nc }], diffs: [], same: [], luA: true, luN: !!n, ev: 'non comparable', nc: a.nc, exa: [], exn: lignesEx(n && n.ex, p.s) }; return finir(o, p, 'h', REG, null); }
    let va = a ? side(a) : (Number.isFinite(num(p.h0)) ? { pph: num(p.h0) } : {});
    let vn = n ? side(n) : (Number.isFinite(num(p.h1)) ? { pph: num(p.h1) } : {});
    const top = v => v.faitage != null ? { v: v.faitage, d: 'au faîtage' } : v.pph != null ? { v: v.pph, d: 'au point le plus haut' } : null;
    const ta = top(va), tn = top(vn), rows = [];
    const mk = (lab, x, y, dx, dy, note) => { const sg = sgn(x, y); rows.push({ lab, a: x == null ? 'non précisé' : fm(x) + (dx ? ' (' + dx + ')' : ''), n: y == null ? 'non précisé' : fm(y) + (dy ? ' (' + dy + ')' : ''), sg, ev: evl(sg, 'hausse', 'baisse'), note: note || '' }); };
    mk('Faîtage (ou point le plus haut)', ta && ta.v, tn && tn.v, ta && ta.d, tn && tn.d, ta && tn && ta.d !== tn.d ? 'le point de mesure n’est pas décrit de la même façon dans les deux textes' : '');
    if (va.egout != null || vn.egout != null) mk('Égout du toit', va.egout, vn.egout);
    if (va.acrotere != null || vn.acrotere != null) mk('Acrotère (toiture-terrasse)', va.acrotere, vn.acrotere);
    rows.forEach(r => { if (r.ev === 'non comparable' && (r.a === 'non précisé' || r.n === 'non précisé')) r.sg = null; });
    const exv = (E, k) => (E || []).find(x => x.k === k);
    [['adoss15', 'Hauteur conditionnelle : adossement à des voisins plus hauts (un étage de plus)'], ['rdc_comm', 'Hauteur conditionnelle : rez-de-chaussée commercial, artisanal ou d’équipement']].forEach(([k, lab]) => {
      const xa = exv(a && a.ex, k), xn = exv(n && n.ex, k);
      if (!xa && !xn) return;
      rows.push({ lab, a: xa ? fm(xa.v) : 'non prévue', n: xn ? fm(xn.v) : 'non prévue', sg: null, ev: xa && xn && xa.v === xn.v ? 'inchangée' : 'exception différente', note: 'sous conditions (voir le détail)' });
    });
    const dd = exDiff(pertinent(a ? a.ex : [], p.s), pertinent(n ? n.ex : [], p.s), ['plafond']);
    const diffs = dd.diff.map(d => ({ type: d.type, a: d.a, n: d.n, k: d.k, note: d.k === 'maj_equip' ? NOTE_EQUIV.maj_equip : '', incertain: d.k === 'maj_equip' || d.k === 'limite_ub' }));
    const o = { rows, diffs, same: dd.same, luA: !!a, luN: !!n, ev: globalEv(rows, 'hausse', 'baisse'), exa: lignesEx(a && a.ex, p.s), exn: lignesEx(n && n.ex, p.s) };
    if (rows[0] && ta && tn && ta.d !== tn.d) o.why = ['le point de mesure de la hauteur est décrit différemment (faîtage / point le plus haut) : à lire dans les deux textes'];
    const g = [];
    if (p.ha && p.ha.length) g.push('ligne de hauteur particulière de l’ancien PLU (' + p.ha.join(', ') + ') à moins de 5 m');
    if (p.hs) g.push('hauteur spécifique du PLUi (' + p.hs + ') à moins de 5 m');
    if (p.hp) g.push('hauteur plafond repérée sur le plan');
    return finir(o, p, 'h', REG, g.length ? { graphique: 'prescription graphique de hauteur à comparer : ' + g.join(' ; ') } : null);
  }

  // ------------------------------------------------------------------ emprise au sol
  const Eg = E => E ? (E.aucune ? Infinity : E.g) : null;
  const eff = (E, s) => { if (!E) return null; const pt = (E.ex || []).find(x => x.k === 'petit'); return pt && s < pt.seuil ? pt.v : Eg(E); };
  const amel = (E, s) => { if (!E) return null; const e = eff(E, s), a = (E.ex || []).find(x => x.k === 'amel'); return a ? (e === Infinity ? e : Math.max(a.v, e == null ? 0 : e)) : e; };
  function cmpE(p, REG) {
    const A = REG.RA[p.az], N = REG.RN[p.z];
    const a = A ? A.e : null, n = N && N.e && N.e.txt ? N.e : null;
    let ea = a, en = n;
    if (!ea) { const v = num(p.e0); ea = { g: p.e0 === 'aucune' ? null : v, aucune: p.e0 === 'aucune', ex: [] }; }
    if (!en) { const v = num(p.e1); en = { g: p.e1 === 'aucune' ? null : v, aucune: p.e1 === 'aucune', ex: [] }; }
    const rows = [];
    const r1a = eff(ea, p.s), r1n = eff(en, p.s);
    rows.push({ lab: 'Construction nouvelle (règle générale' + (((ea.ex || []).concat(en.ex || [])).some(x => x.k === 'petit' && p.s < x.seuil) ? ', avec la règle des petits terrains qui s’applique à ce terrain' : '') + ')', a: fpc(r1a), n: fpc(r1n), sg: sgn(r1a, r1n), ev: evl(sgn(r1a, r1n), 'hausse', 'baisse') });
    const hasAm = !!a && ((ea.ex || []).some(x => x.k === 'amel') || (en.ex || []).some(x => x.k === 'amel'));
    if (hasAm) { const r2a = amel(ea, p.s), r2n = amel(en, p.s); rows.push({ lab: 'Amélioration du bâti existant (à la date d’approbation du règlement)', a: fpc(r2a), n: fpc(r2n), sg: sgn(r2a, r2n), ev: evl(sgn(r2a, r2n), 'hausse', 'baisse') }); }
    const dd = a ? exDiff(pertinent(ea.ex, p.s), pertinent(en.ex, p.s)) : { same: [], diff: [] };
    const diffs = dd.diff.map(d => ({ type: d.type, a: d.a, n: d.n, k: d.k, note: d.k === 'annexe9' ? 'ancien PLU : une annexe est définie comme une construction de 9 m² d’emprise au plus et de moins de 3 m de haut (lexique), sans limite de nombre relevée ; PLUi : une seule annexe par unité foncière, 9 m² au plus (indice H), alors que le lexique définit l’annexe jusqu’à 15 m² : lecture de cette différence à vérifier' : '', incertain: proche(d, p.s) }));
    const o = { rows, diffs, same: dd.same, luA: !!a, luN: !!n, ev: rows[0].sg == null ? 'non comparable' : evl(rows[0].sg, 'hausse', 'baisse'), exa: lignesEx(a && a.ex, p.s), exn: lignesEx(n && n.ex, p.s) };
    // l'évolution porte sur la règle générale (construction nouvelle) ; l'exception « amélioration » est comparée à part (ligne et différences)
    if (a && !(en.ex || []).some(x => x.k === 'amel') && (ea.ex || []).some(x => x.k === 'amel') && rows[1] && rows[1].ev === 'baisse') o.why = ['l’exception « amélioration du bâti existant » de l’ancien PLU n’a pas d’équivalent relevé dans le PLUi pour ce code'];
    return finir(o, p, 'e', REG, null);
  }

  // ------------------------------------------------------------------ pleine terre
  function cmpP(p, REG) {
    const A = REG.RA[p.az], N = REG.RN[p.z];
    const a = A ? A.pt : null, n = N && N.pt && N.pt.txt ? N.pt : null;
    const cbsTxt = x => { const m = /CBS\s*(\d+)/.exec(x || ''); return m ? parseInt(m[1], 10) : null; };
    const ptit = E => { const x = E && (E.ex || []).find(y => y.k === 'petit'); return x && p.s < x.seuil ? x.v : null; };
    let pa = a ? (a.aucune ? 0 : a.g) : num(p.p0), pn = n ? n.g : num(p.p1);
    const pta = ptit(a), ptn = ptit(n);
    if (pta != null) pa = pta;   // petit terrain : pleine terre réduite (ex. 20 % au lieu de 40 %) quand l'emprise spécifique s'applique
    if (ptn != null) pn = ptn;
    const rows = [];
    let nc = a && a.nc ? a.nc : null;
    const s1 = nc ? null : sgn(pa, pn);
    rows.push({ lab: 'Pleine terre (part minimale de l’unité foncière)' + (pta != null || ptn != null ? ' — règle des petits terrains (moins de 150 m²) appliquée' : ''), a: nc ? 'non comparable (' + a.nc + ')' : (a && a.aucune ? 'aucune règle' : fpc(pa)), n: fpc(pn), sg: s1 == null ? null : -s1, ev: nc ? 'non comparable' : evl(s1 == null ? null : -s1, 'moins exigeante', 'plus exigeante') });
    const ca = a ? a.cbs : cbsTxt(p.p0), cn = n ? n.cbs : cbsTxt(p.p1);
    if ((a && (ca != null || cn != null)) || (!a && ca != null)) { const sc = sgn(ca || 0, cn || 0); rows.push({ lab: 'Coefficient de biotope (CBS)', a: ca != null ? ca + ' %' : 'aucune exigence', n: cn != null ? cn + ' %' : 'aucune exigence', sg: nc ? null : (sc == null ? null : -sc), ev: nc ? 'non comparable' : evl(sc == null ? null : -sc, 'moins exigeante', 'plus exigeante') }); }
    // vocabulaire : sg > 0 = règle moins exigeante (moins de pleine terre exigée) ; on inverse pour l'agrégat
    const dd = exDiff(pertinent(a ? a.ex : [], p.s), pertinent(n ? n.ex : [], p.s));
    const diffs = dd.diff.map(d => ({ type: d.type, a: d.a, n: d.n, k: d.k, note: '', incertain: proche(d, p.s) }));
    const o = { rows, diffs, same: dd.same, luA: !!a, luN: !!n, ev: nc ? 'non comparable' : globalEv(rows, 'moins exigeante', 'plus exigeante'), nc, exa: lignesEx(a && a.ex, p.s), exn: lignesEx(n && n.ex, p.s) };
    return finir(o, p, 'pt', REG, null);
  }

  function cmp(p, REG) { return { h: cmpH(p, REG), e: cmpE(p, REG), pt: cmpP(p, REG) }; }
  const rang = { f: 0, p: 1, v: 2 };
  function nivGlobal(c) { return ['h', 'e', 'pt'].map(k => c[k].niv).reduce((x, y) => rang[y] > rang[x] ? y : x, 'f'); }

  const API = { cmp, cmpH, cmpE, cmpP, nivGlobal, exDiff, appl, fm, fpc };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.MOTEUR = API;
})(typeof window !== 'undefined' ? window : globalThis);
