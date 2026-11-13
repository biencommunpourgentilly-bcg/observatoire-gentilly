/* Page « règles d'urbanisme » : code. Généré par scripts/export_observatoire.py (dépôt observatoire-plu). */
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





const L19 = C.a2019;







let STATS2;

P.features.forEach(f=>{const q=f.properties,c=MOTEUR.cmp(q,REG);q.xh=c.h.ev;q.xe=c.e.ev;q.xp=c.pt.ev;q.dfh=c.h.diffs.length?1:0;q.dfe=c.e.diffs.length?1:0;q.dfp=c.pt.diffs.length?1:0;q.nh=c.h.niv;q.ne=c.e.niv;q.np=c.pt.niv;q.nv=MOTEUR.nivGlobal(c)});
const FAM = {UC:'#c46b6b',UA:'#e8a0a0',UM:'#f0b27a',UR:'#d9b99b',UH:'#f6dcae',UI:'#b9a3d6',UE:'#8fc9c9',N:'#9bd18b',U3:'#bbb',UG:'#bbb'};
const FAMLIB = {UC:'Cœur de ville',UA:'Grands axes',UM:'Mixte',UR:'Habitat collectif',UH:'Habitat individuel',UI:'Activités',UE:'Équipements',N:'Naturel'};
const fam=z=>{for(const p of ['UHm','UEh','UEs','UE','UI','UC','UA','UM','UR','Np','N','UG','U3'])if(z.startsWith(p))return {UHm:'UH',UEh:'UE',UEs:'UE',Np:'N'}[p]||p;return 'UG'};
const ETQ = {'non déterminé':'#6b6b6b','exception différente':'#d8c46a','plus exigeante':'#2f6db5','moins exigeante':'#e07b00','mixte':'#8a5cc2','générale identique, exceptions différentes':'#d8c46a','comparaison fiable':'#3e8c50','comparaison partielle':'#c98a1b','à vérifier':'#b5452b','baisse':'#2f6db5','hausse':'#e07b00','inchangée':'#c9cfc5','non comparée':'#8d99a0','modifiée':'#8a5cc2','ajoutée':'#e07b00','supprimée':'#2f6db5','non comparable':'#b0719a','à lire':'#8d99a0'};
function dominant(p){const r=p.zr;if(r[0]>0||r[1]>0)return r[0]>=r[1]?'rouge':'rouge hachuré';if(r[2]>50)return 'bleue';if(r[2]>0)return 'bleue (partielle)';return 'hors zonage'}
const MODES = {
 h:{lib:'Hauteur maximale : règle générale seule',val:p=>p.he,col:v=>ETQ[v]||'#ccc',cle:['baisse','hausse','inchangée','non comparée']},
 e:{lib:'Emprise au sol : règle générale seule',val:p=>p.ee,col:v=>ETQ[v]||'#ccc',cle:['inchangée','modifiée','ajoutée','supprimée']},
 p:{lib:'Pleine terre : règle générale seule',val:p=>p.pe,col:v=>ETQ[v]||'#ccc',cle:['inchangée','modifiée','ajoutée','non comparable']},
 hx:{lib:'Hauteur : règle générale + exceptions',val:p=>p.xh==='inchangée'&&p.dfh?'générale identique, exceptions différentes':p.xh,col:v=>ETQ[v]||'#ccc',cle:['baisse','hausse','mixte','inchangée','générale identique, exceptions différentes','non comparable','non déterminé'],note:'Compare aussi les exceptions et majorations (adossement à 15 m, rez-de-chaussée commercial, majorations, etc.).'},
 ex:{lib:'Emprise : règle générale + exceptions',val:p=>p.xe==='inchangée'&&p.dfe?'générale identique, exceptions différentes':p.xe,col:v=>ETQ[v]||'#ccc',cle:['baisse','hausse','mixte','inchangée','générale identique, exceptions différentes','non comparable','non déterminé'],note:'Compare aussi l’amélioration du bâti existant, les petits terrains et les annexes (9 m²).'},
 px:{lib:'Pleine terre : règle générale + exceptions',val:p=>p.xp==='inchangée'&&p.dfp?'générale identique, exceptions différentes':p.xp,col:v=>ETQ[v]||'#ccc',cle:['plus exigeante','moins exigeante','mixte','inchangée','générale identique, exceptions différentes','non comparable','non déterminé']},
 fb:{lib:'Fiabilité de la comparaison (hauteur, emprise, pleine terre)',val:p=>({f:'comparaison fiable',p:'comparaison partielle',v:'à vérifier'})[p.nv],col:v=>ETQ[v]||'#ccc',cle:['comparaison fiable','comparaison partielle','à vérifier'],note:'« Fiable » = règles générales et exceptions relues dans les deux textes et identiques ou clairement comparables. « Partielle » = exceptions différentes, zone non relue en détail ou prescription graphique à comparer.'},
 ar:{lib:'Argiles : exposition au retrait-gonflement (Géorisques)',val:p=>({0:'non disponible',1:'faible',2:'moyenne',3:'forte'})[p.arg||0],col:v=>({'non disponible':'#bbb',faible:'#e9d98a',moyenne:'#e0a040',forte:'#b5452b'})[v],cle:['faible','moyenne','forte','non disponible'],note:'Un point par terrain (carte nationale du BRGM via Géorisques) : près d’une limite d’aléa, à vérifier. Le plan de prévention des argiles de 2018 ne couvre pas Gentilly.'},
 z:{lib:'Zone du PLUi',val:p=>fam(p.z),col:v=>FAM[v]||'#ccc',cle:['UC','UA','UM','UR','UH','UI','UE','N'],lab:v=>FAMLIB[v]||v},
 c:{lab:v=>v+' — '+RISQN[v],lib:'Anciennes carrières (plan 2026)',val:p=>dominant(p),col:v=>({rouge:'#e03214','rouge hachuré':'#7a1414',bleue:'#4f6fc7','bleue (partielle)':'#9db0e6','hors zonage':'#e6e8e1'})[v],cle:['rouge','rouge hachuré','bleue','bleue (partielle)','hors zonage']},
 a6:{lab:v=>v+' — '+RISQN[v],lib:'Carrières : aléa dominant 2026',val:p=>NIVL[dom(p.c26)],col:v=>COULN[v],cle:['faible','modéré','fort','très fort','hors aléa cartographié']},
 a9:{lab:v=>v+' — '+RISQN[v],lib:'Carrières : aléa dominant 2019',val:p=>NIVL[dom(p.c19)],col:v=>COULN[v],cle:['faible','modéré','fort','très fort','hors aléa cartographié']},
 cd:{lib:'Carrières : niveau différent entre 2019 et 2026',val:p=>{const a=dom(p.c19),b=dom(p.c26);return a===b?'même niveau dominant':(b>a?'niveau plus élevé en 2026':'niveau plus bas en 2026')},col:v=>({'même niveau dominant':'#dfe3da','niveau plus élevé en 2026':'#d9822b','niveau plus bas en 2026':'#2f6db5'})[v],cle:['même niveau dominant','niveau plus élevé en 2026','niveau plus bas en 2026'],note:'Un niveau différent peut venir de l\'amélioration des connaissances ou d\'un changement de méthode : ce n\'est pas une aggravation du danger.'},
 d:{lib:'Droit de préemption renforcé : ancien / PLUi',val:p=>({maintenu:'dans le périmètre avant et après',entre:'entre dans le périmètre en 2026',sort:'sort du périmètre en 2026',hors:'hors périmètre'})[p.dp||'hors'],col:v=>({'dans le périmètre avant et après':'#6f8fbf','entre dans le périmètre en 2026':'#d9822b','sort du périmètre en 2026':'#8a5cc2','hors périmètre':'#e6e8e1'})[v],cle:['dans le périmètre avant et après','entre dans le périmètre en 2026','sort du périmètre en 2026','hors périmètre']},
 o:{lib:'Secteur d\'orientation d\'aménagement (OAP locale)',val:p=>p.oap&&p.oap.includes('locale')?'dans une OAP locale':'hors OAP locale',col:v=>v.startsWith('dans')?'#2f6db5':'#e6e8e1',cle:['dans une OAP locale','hors OAP locale']}
};
const NIVL=['faible','modéré','fort','très fort','hors aléa cartographié'];
const COULN={'faible':'#8cd25a','modéré':'#f5e13c','fort':'#f0961e','très fort':'#96200a','hors aléa cartographié':'#e6e8e1'};
function dom(a){let m=-1,v=0;a.forEach((x,i)=>{if(x>=v&&x>0){v=x;m=i}});return m<0?4:m}
let numP=null,numK=null;
let mode='h';
const map=L.map('map',{scrollWheelZoom:true,renderer:L.canvas()}).setView([48.8135,2.3455],15);
const fondPlan=L.tileLayer('https://data.geopf.fr/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',{maxZoom:18,attribution:'Fond : © IGN (Plan IGN)'}).addTo(map);
const fondSat=L.tileLayer('https://data.geopf.fr/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',{maxZoom:19,attribution:'Fond : © IGN (Photographies aériennes)'});
let satOn=false;
let sel=null;
const couche=L.geoJSON(P,{style:f=>st(f),onEachFeature:(f,l)=>{l.on('click',()=>choisir(l))}}).addTo(map);
function st(f){const m=MODES[mode];return {color:'#44505a',weight:.5,fillColor:m.col(m.val(f.properties)),fillOpacity:satOn?.38:.72}}
function maj(){couche.setStyle(st);if(sel)sel.setStyle({color:'#000',weight:3});legende()}
function legende(){const m=MODES[mode];document.getElementById('cle').insertAdjacentHTML('beforebegin','');document.getElementById('cle').innerHTML=(m.note?`<div class="note" style="width:100%">${m.note}</div>`:'')+m.cle.map(v=>`<span><span class="pastille" style="background:${m.col(v)}"></span> ${(m.lab?m.lab(v):v)}</span>`).join('')}
document.getElementById('modes').innerHTML=Object.entries(MODES).map(([k,m])=>`<label class="l"><input type="radio" name="md" value="${k}" ${k==='h'?'checked':''}> ${m.lib}</label>`).join('');
document.querySelectorAll('input[name=md]').forEach(e=>e.onchange=()=>{mode=e.value;maj();if(document.body.classList.contains('compact'))document.getElementById('bCol').classList.add('ferme')});legende();
const RISQ={faible:'risque faible',modere:'risque modéré',fort:'risque fort',tres_fort:'risque très fort',bleue:'aléas faible à fort : construction possible avec étude géotechnique et prescriptions',rouge:'aléa très fort : en principe inconstructible',rouge_hachure:'rouge, mais constructions admises si l’aléa est ramené au moins au niveau moyen (périmètre d’étude « avenue Paul Vaillant-Couturier / gare RER »)'};
const RISQN={'faible':'risque faible','modéré':'risque modéré','fort':'risque fort','très fort':'risque très fort','hors aléa cartographié':'aucun aléa cartographié','rouge':RISQ.rouge,'rouge hachuré':RISQ.rouge_hachure,'bleue':RISQ.bleue,'bleue (partielle)':'en partie en zone bleue : '+RISQ.bleue,'hors zonage':'hors zonage du plan'};
const COULC={faible:'#8cd25a',modere:'#f5e13c',fort:'#f0961e',tres_fort:'#96200a',bleue:'#4f6fc7',rouge:'#e03214',rouge_hachure:'#7a1414'};
const oa19=L.geoJSON(C.a2019,{style:f=>({color:COULC[f.properties.niveau],weight:.5,fillColor:COULC[f.properties.niveau],fillOpacity:.25}),interactive:false});
const oz=L.geoJSON(C.zonage,{style:f=>({color:COULC[f.properties.zone],weight:1.5,fillColor:COULC[f.properties.zone],fillOpacity:.22}),interactive:false});
const oa=L.geoJSON(C.a2026,{style:f=>({color:COULC[f.properties.niveau],weight:.5,fillColor:COULC[f.properties.niveau],fillOpacity:.25}),interactive:false});
const osup=L.geoJSON(SUPG,{style:f=>f.properties.m?{color:'#7a3b00',weight:2,fillColor:'#c8801a',fillOpacity:.55}:{color:'#9a6a2a',weight:1.2,dashArray:'5 4',fillColor:'#e9c98a',fillOpacity:.12},onEachFeature:(f,l)=>l.bindTooltip((f.properties.m?'Monument historique : ':'Abords : ')+f.properties.n,{sticky:true})});
document.getElementById('osup').onchange=e=>e.target.checked?osup.addTo(map):map.removeLayer(osup);
function setSat(on){satOn=on;document.getElementById('osat').checked=on;btnSat.textContent=on?'🗺 Plan':'🛰 Satellite';if(on){map.removeLayer(fondPlan);fondSat.addTo(map);fondSat.bringToBack()}else{map.removeLayer(fondSat);fondPlan.addTo(map);fondPlan.bringToBack()}maj()}
const btnSat=L.DomUtil.create('button','');btnSat.textContent='🛰 Satellite';btnSat.setAttribute('style','background:#fff;color:#1f2a25;border:2px solid #0006;border-radius:8px;padding:7px 11px;font:600 14px system-ui;cursor:pointer;box-shadow:0 1px 4px #0004');btnSat.setAttribute('aria-label','Afficher ou masquer la vue satellite');
L.DomEvent.disableClickPropagation(btnSat);btnSat.onclick=()=>setSat(!satOn);
const ctlSat=L.control({position:'topright'});ctlSat.onAdd=()=>btnSat;ctlSat.addTo(map);
function majCar(){const on=['oz','oa','oa9'].some(i=>document.getElementById(i).checked),d=document.getElementById('clecar');d.style.display=on?'block':'none';if(on&&!d.innerHTML)d.innerHTML='<strong>Couleurs des couches « carrières »</strong><br>'+['faible','modere','fort','tres_fort','bleue','rouge','rouge_hachure'].map(k=>`<span class="pastille" style="background:${COULC[k]}"></span> ${LIBK[k]} : ${RISQ[k]}`).join('<br>')+'<br><em>Les couleurs d’aléa et de zone peuvent se ressembler d’une couche à l’autre ; c’est le texte qui fait foi.</em>'}
['oz','oa','oa9'].forEach(i=>document.getElementById(i).addEventListener('change',majCar));
document.getElementById('osat').onchange=e=>setSat(e.target.checked);
document.getElementById('oz').onchange=e=>e.target.checked?oz.addTo(map):map.removeLayer(oz);
document.getElementById('oa9').onchange=e=>e.target.checked?oa19.addTo(map):map.removeLayer(oa19);
numP=couchenum(map);document.getElementById('num').onchange=e=>numP.on(e.target.checked);
document.getElementById('oa').onchange=e=>e.target.checked?oa.addTo(map):map.removeLayer(oa);
const F=(v,d)=>v===''||v==null?(d||'—'):v;
const M=v=>v==null?'—':(typeof v==='number'?String(v).replace('.',',')+' m':v);
function etq(v){return `<span class="etq" style="background:${ETQ[v]||'#8d99a0'};${v==='inchangée'?'color:#1f2a25':''}">${v}</span>`}
function regle(nom,a,n,ev,ref,art){return `<tr><td><strong>${nom}</strong></td><td>${a}</td><td>${n}</td><td>${etq(ev)}</td></tr>${ref?`<tr><td colspan="4" class="note">PLUi : ${ref}${art?` · ancien PLU : ${art}`:''}</td></tr>`:''}`}
const ERANC={ER1:'élargissement de trottoir, rue Gabrielle (10 m)',ER2:'élargissement de trottoir, rue Romain-Rolland (10 m)',ER3:'élargissement de trottoir, rue Louis-Gaillet (10 m)',ER4:'élargissement partiel de l’avenue Paul-Vaillant-Couturier (10 m)',ER5:'création d’espace vert (418 m²)',ERb:'bords de Bièvre en espace public de promenade (12 m axés sur la Bièvre)'};
const ERNEW={'1':'élargissement de trottoir, rue Romain-Rolland (10 m)','2':'création d’espace vert (418 m²)','3':'élargissement de voirie (2 m), avenue Lénine','4':'aménagement d’espace public (59 m²), rue Benoît-Malon','5':'bords de Bièvre en espace public de promenade (12 m axés sur la Bièvre)','6':'espace public (1 040 m²), avenue Paul-Vaillant-Couturier'};
const OAPT={'Centre-ville':'programmes chiffrés (îlot de la mairie : 50 à 70 logements ; îlot central : 80 à 100 ; franges du complexe sportif : environ 100), nouveau centre municipal, réouverture de la Bièvre « par endroits », 30 % de logement social (OAP, p. 163 à 168).','Gabriel Péri':'ancien collège Pierre-Curie : environ 100 logements, 5 000 m² d’activités, groupe scolaire, conservation de l’aile ouest ; cœurs d’îlot végétalisés (OAP, p. 169 à 173).','Avenue Paul Vaillant-Couturier':'activités économiques et tertiaires le long des voies, bâtiments réversibles (14 m d’épaisseur au plus), couverture partielle de l’A6a et du RER B, pas de nombre de logements (OAP, p. 174 à 178).','Avenue Paul Vaillant-Couturier (pôle gare)':'réaménagement du pôle gare : parvis élargi, sente piétonne, « certaine mixité fonctionnelle » (OAP, p. 174 à 178).','Îlot rue de la Paix / rue de Reims':'jardin paysager, maison des associations, équipement cultuel, marqueur d’activités (bâtiment signal visant R+5), emprise limitée à 30 % (OAP, p. 182 à 185).'};
const SD={A:['autorisé','#3e8c50'],C:['sous conditions','#c98a1b'],X:['interdit','#b5452b'],'X*':['interdit (sauf l’existant)','#b5452b']};
function sec(titre,corps,ouvert){return `<details class="sec"${ouvert?' open':''}><summary>${titre}</summary><div class="corps">${corps}</div></details>`}
function imprimerFiche(){const d=[...document.querySelectorAll('#fiche details')],o=d.map(x=>x.open);d.forEach(x=>x.open=true);window.print();d.forEach((x,i)=>x.open=o[i])}
function zrr(p){const z=p.zr;return z[0]||z[1]?(z[0]>=z[1]?'rouge':'rouge hachurée'):z[2]>50?'bleue':z[2]>0?'bleue (partielle)':''}
const NIVL2={f:'Comparaison historique fiable',p:'Comparaison partielle',v:'Information à vérifier'};
const NCOL2={f:'#3e8c50',p:'#c98a1b',v:'#b5452b'};
const nvb=k=>`<span class="niv" style="background:${NCOL2[k]}">${NIVL2[k]}</span>`;
const bdg=(t,c)=>`<span class="niv" style="background:${c}">${t}</span>`;
const B_GEN=bdg('Règle générale vérifiée','#3e7d5a'),B_EXC=bdg('Règle particulière ou exception','#7a5aa6'),B_PG=bdg('Prescription graphique applicable','#2f6f8f'),B_PAR=bdg('Comparaison partielle','#c98a1b'),B_VER=bdg('Information à vérifier','#b5452b'),B_FIA=bdg('Comparaison historique fiable','#3e8c50');
const EXN={adoss15:'adossement à des voisins plus hauts (15 m)',rdc_comm:'rez-de-chaussée commercial',maj_equip:'majoration pour équipements de toiture',bievre:'bords de la Bièvre',limite_ub:'limite avec les zones UB',plafond:'plafond du plan des hauteurs',amel:'amélioration du bâti existant',petit:'petits terrains',annexe9:'annexes (une seule, 9 m²)',maj_ls:'logement social',evergreen:'evergreen / terrasse (petits terrains)',toit_cbs:'toitures-terrasses en coefficient de biotope'};
const URLS={plui:'https://data.geopf.fr/annexes/gpu/documents/DU_200058014/',zone:'https://www.ville-gentilly.fr/sites/default/files/'};
function tabRegle(x){let t='<table class="syn"><tr><th>Élément</th><th>Ancien PLU</th><th>PLUi</th><th>Évolution</th></tr>';x.rows.forEach(r=>{t+=`<tr><td>${r.lab}${r.note?`<br><span class="note">${r.note}</span>`:''}</td><td>${r.a}</td><td>${r.n}</td><td>${etq(r.ev)}</td></tr>`});return t+'</table>'}
function lignesDiff(x){return x.diffs.map(d=>{const nm=EXN[d.k]||d.k;
 if(d.type==='valeur')return `<li>${B_EXC} <strong>${nm}</strong> : ancien PLU « ${d.a.t} » (art. ${d.a.art||'—'}) → PLUi « ${d.n.t} »${d.note?` <span class="note">${d.note}</span>`:''}</li>`;
 if(d.type==='ancien')return `<li>${B_EXC} <strong>${nm}</strong> — <em>ancien PLU seulement</em> : ${d.a.t} (art. ${d.a.art||'—'}) ; pas d’équivalent relevé dans le PLUi${d.incertain?' : <strong>à vérifier</strong>':''}${d.note?` <span class="note">${d.note}</span>`:''}</li>`;
 return `<li>${B_EXC} <strong>${nm}</strong> — <em>PLUi seulement</em> : ${d.n.t}${d.note?` <span class="note">${d.note}</span>`:''}</li>`}).join('')}
const IMPL={
'UB1>UM':[['Voie : implantation','à l’alignement (UB1-6.1)','à l’alignement (3.1.1.8 H, p. 94)','identique'],['Voie : prolongement des constructions voisines','peut être imposé (UB1-6.1)','peut être imposé (3.1.1.8 H)','identique'],['Voie : saillies et modénatures','saillies interdites, modénatures de moins de 30 cm tolérées (UB1-6.2-6.3)','idem','identique'],['Voie : façade de plus de 20 m','fractionnement, 6 m minimum entre constructions (UB1-6.6)','idem ; en cas de vues, règles des constructions multiples sur une même unité foncière','identique en principe (formulation des « vues » différente)'],['Voie : angle de deux voies','pan coupé de 3 m (UB1-6.5)','non relevé dans le texte lu','à vérifier']],
'UB2>UHm':[['Voie : implantation','alignement ou retrait de 4 m au plus (UB2-6.1)','alignement ou retrait de 4 m au plus (3.1.1.10 H, p. 105)','identique'],['Voie : prolongement des constructions voisines','peut être imposé (UB2-6.1)','peut être imposé','identique'],['Voie : façade de plus de 20 m','fractionnement, 6 m minimum (UB2-6.6)','idem (avec vues : règles des constructions multiples)','identique en principe'],['Voie : angle de deux voies','pan coupé de 7 m (UB2-6.5)','non relevé dans le texte lu','à vérifier']],
'UB2>UM':[['Voie : implantation','alignement ou retrait de 4 m au plus (UB2-6.1)','<strong>à l’alignement obligatoire</strong> (3.1.1.8 H, p. 94)','différent : la possibilité de retrait de 4 m disparaît'],['Voie : façade de plus de 20 m','fractionnement, 6 m minimum (UB2-6.6)','idem','identique en principe'],['Voie : angle de deux voies','pan coupé de 7 m (UB2-6.5)','non relevé dans le texte lu','à vérifier']],
'UA1>UC':[['Voie : implantation','prospect H = L avec l’alignement opposé (UA1-6.1)','hauteur de façade ≤ distance à l’alignement opposé (3.1.1.6, p. 85)','identique'],['Voie : prolongement des constructions voisines','peut être imposé','peut être imposé','identique'],['Voie : façade de plus de 45 m','fractionnement du rythme de la façade (UA1-6.6)','non relevé dans le texte lu','à vérifier'],['Voie : angle de deux voies','pan coupé de 7 m (UA1-6.5)','non relevé','à vérifier'],['Voie : espaces libres','—','espaces libres implantés au maximum côté Bièvre (3.1.1.6)','nouveau dans le PLUi'],['Limites latérales','limite ou retrait, L = H (8 m min.) avec baies principales, L = ½ H (4 m min.) sinon (UA1-7.1.1)','idem avec « ouvertures constituant des vues » (3.1.2.4 H, p. 121-122)','identique de formule ; périmètre des vues différent'],['Limites latérales : pignon voisin','obligation de s’implanter sur la limite si pignon voisin de R+1 au moins (UA1-7.1.2)','idem (3.1.2.4 H)','identique'],['Limites de fond','retrait obligatoire ; adossement possible à un bâtiment voisin (UA1-7.2 et 7.3.2)','idem','identique'],['Limites de fond : annexes','annexes de moins de 2,6 m (3,50 m en activité) admises en limite de fond (UA1-7.3.1)','non relevé','à vérifier'],['Limites : vue à moins de 2,50 m','—','retrait imposable si un voisin a une vue à moins de 2,50 m (3.1.2.4 H)','nouveau dans le PLUi']],
'UA2>UA':[['Voie : implantation','à l’alignement (UA2-6.1)','à l’alignement (3.1.1.7 H, p. 89)','identique'],['Voie : façade de plus de 45 m','fractionnement (UA2-6.6)','non relevé','à vérifier'],['Voie : angle de deux voies','pan coupé de 7 m (UA2-6.5)','non relevé','à vérifier'],['Limites : bande de 15 m','implantation obligatoire sur les limites latérales ; attique en retrait possible (UA2-7.1)','idem (3.1.2.5 H, p. 131-132)','identique'],['Limites : au-delà de 15 m','retrait, L = H / ½ H, 8 m / 4 m minimum (UA2-7.2)','retrait, 8 m / 4 m minimum','identique de formule'],['Limites : zones UB voisines','retrait d’au moins 8 m, végétalisé et planté (UA2-7.1.2)','non relevé','à vérifier']],
'UH>UR':[['Voie : implantation','alignement ou retrait de 8 m au plus (UH-6.1)','alignement ou retrait de 8 m au plus (3.1.1.9 H, p. 99)','identique'],['Voie : prospect','H = L avec l’alignement opposé (UH-6.2)','hauteur de façade ≤ distance à l’alignement opposé','identique'],['Limites séparatives','retrait de 8 m (UH-7.1)','retrait d’au moins 8 m (3.1.2.7 H, p. 156)','identique']],
'UE>UI':[['Voie : implantation','à l’alignement, retraits partiels de façade autorisés (UE-6.1)','à l’alignement ou en retrait (3.1.1.11 H, p. 109)','plus souple dans le PLUi (retrait libre)'],['Voie : prospect','H = L','hauteur de façade ≤ distance à l’alignement opposé','identique'],['Limites séparatives','limite ou retrait de 8 m minimum ; vis-à-vis de baies principales : L = ½ H (UE-7)','limite ou retrait ; avec vues ½ H, 8 m min. ; sans vues 8 m min. (3.1.2.9 H, p. 183)','différences de détail : à vérifier']],
'UE>UA':[['Voie : implantation','à l’alignement, retraits partiels autorisés (UE-6.1)','à l’alignement (3.1.1.7 H)','plus strict dans le PLUi (retraits partiels non relevés)'],['Limites séparatives','limite ou retrait de 8 m minimum (UE-7)','bande de 15 m : limites latérales obligatoires (3.1.2.5 H)','différent : à vérifier']],
'UE>UC':[['Voie : implantation','à l’alignement, retraits partiels autorisés (UE-6.1)','hauteur de façade ≤ distance à l’alignement opposé, sans alignement obligatoire (3.1.1.6 H)','plus souple dans le PLUi'],['Limites séparatives','limite ou retrait de 8 m minimum (UE-7)','limites latérales ou retrait, 8 m / 4 m minimum (3.1.2.4 H)','différent : à vérifier']]};
IMPL['UB1>UHm']=IMPL['UB2>UHm'];
function fiche(p){
 const nature=NATURE[p.z]||'';
 let h=`<h2>Terrain ${p.s_}${p.n_} <span class="surf">· ${p.s.toLocaleString('fr-FR')} m²</span></h2><p class="note">Parcelle ${p.id} · surface calculée sur le plan cadastral : ${p.s.toLocaleString('fr-FR')} m² (${(p.s/10000).toLocaleString('fr-FR',{maximumFractionDigits:3})} ha)${p.ad?` · adresse(s) probable(s) : ${p.ad.join(', ')}`:''}</p>`;
 h+=`<p><strong>PLUi</strong> : zone <code>${p.z}</code>${nature?` — ${nature}`:''}${p.zp<100?` (${p.zp} % du terrain)`:''}<br><strong>Ancien PLU</strong> : zone ${F(p.az)}${p.azp<100&&p.azp?` (${p.azp} %)`:''}</p>`;
 if(p.ch)h+=`<div class="avert">Terrain à cheval sur plusieurs zones : seule la zone majoritaire est affichée${p.zo?` (autres zones du PLUi : ${p.zo})`:''}.</div>`;
 if(p.etr)h+=`<div class="avert"><strong>Terrain très étroit et allongé</strong> (environ ${p.etr[0]} m de large pour ${p.etr[1]} m de long) : il peut s’agir d’un <strong>passage, d’un chemin d’accès ou d’une bande de terrain</strong> (par exemple une voie privée), figuré au cadastre comme une parcelle, ou d’un terrain en lanière. Il prend la couleur de la zone comme les autres terrains. Indication déduite de la forme seulement : à vérifier sur le plan cadastral ; les règles ci-dessous sont celles de la zone, pas une constructibilité avérée.</div>`;
 // ===== NIVEAU 1 : synthèse pour les habitants =====
 const C=MOTEUR.cmp(p,REG),NG=MOTEUR.nivGlobal(C);
 h+=`<div class="niv1"><h3>Synthèse pour les habitants</h3>`;
 {let t='<table class="syn"><tr><th>Règle</th><th>Ancien PLU</th><th>PLUi</th><th>Évolution</th></tr>';
  [['h','Hauteurs maximales (faîtage, égout du toit, acrotère)'],['e','Emprise au sol'],['pt','Pleine terre']].forEach(([k,nom])=>{const x=C[k];
   t+=`<tr class="rh"><td colspan="4"><strong>${nom}</strong> — ${x.label} ${nvb(x.niv)}</td></tr>`;
   x.rows.forEach(r=>{t+=`<tr><td>${r.lab}${r.note?`<br><span class="note">${r.note}</span>`:''}</td><td>${r.a}</td><td>${r.n}</td><td>${etq(r.ev)}</td></tr>`})});
  h+=t+'</table><p class="note">Ces chiffres sont les règles <strong>générales</strong> relues dans les deux règlements ; les exceptions, majorations et prescriptions graphiques sont traitées dans l’analyse détaillée ci-dessous. Une règle générale identique ne veut pas dire que les droits à construire sont inchangés.</p>'}
 {const L=[];
  [['h','Hauteur'],['e','Emprise au sol'],['pt','Pleine terre']].forEach(([k,n])=>{const x=C[k];L.push(`<strong>${n}</strong> : ${x.label}${x.diffs.length?' (exceptions concernées : '+x.diffs.map(d=>EXN[d.k]||d.k).join(' ; ')+')':''}`)});
  if(p.pk&&PAIRS[p.pk]){const n=PAIRS[p.pk].filter(r=>r[5]!=='nc').length,nc=PAIRS[p.pk].filter(r=>r[5]==='nc').length;L.push(`<strong>Usages</strong> : ${n} sous-destination(s) changent de statut selon la correspondance établie par l’observatoire${nc?` ; ${nc} non comparable(s)`:''} (<em>comparaison partielle</em> : l’ancien PLU n’utilise pas la même nomenclature)`)}
  L.push('<strong>Plantations</strong> : remplacement des arbres abattus à raison de 2 pour 1 (ancien PLU : un nombre égal) ; stationnement et eaux pluviales : règles reformulées (voir le détail)');
  if(p.mxs)L.push(`<strong>Mixité sociale</strong> : secteur GE1 sur ${p.mxs} % du terrain (aucune règle équivalente trouvée dans l’ancien PLU : <em>comparaison partielle</em>)`);
  h+=`<p><strong>Principales évolutions réglementaires</strong></p><ul>${L.map(x=>'<li>'+x+'</li>').join('')}</ul>`}
 {const v=[];const z=zrr(p);
  if(z)v.push(`carrières : zone ${z}${p.cinc?' (limite à moins de 3 m : <strong>incertain</strong>)':''}`);else if(p.cinc)v.push('carrières : limite de zone ou d’aléa à moins de 3 m (<strong>incertain</strong>)');
  if(p.sup)v.push(`servitudes d’utilité publique (GPU) : ${p.sup.length}`);
  if(p.bp||p.pat)v.push('bâti patrimonial');if(p.ev>0)v.push('espace vert protégé');if(p.ark)v.push('arbre remarquable à moins de 5 m');if(p.aa)v.push('alignement d’arbres');
  if(p.erx||p.er)v.push('emplacement réservé');if(p.on)v.push('orientation d’aménagement');if(p.bv)v.push('Bièvre à moins de 12 m');
  v.push(p.dp&&p.dp!=='hors'?'droit de préemption renforcé':'droit de préemption urbain (simple)');
  h+=`<p><strong>Risques et protections applicables</strong></p><div class="puces">${v.map(x=>`<span class="pc">${x}</span>`).join('')}</div>`}
 {const w=[];
  if(NG!=='f')w.push(`Fiabilité globale de la comparaison : <strong>${NIVL2[NG].toLowerCase()}</strong> — le détail des raisons figure dans l’analyse détaillée.`);
  if(p.ch)w.push('Terrain à cheval sur plusieurs zones : seule la zone majoritaire est comparée'+(p.zo?` (autres zones : ${p.zo})`:'')+'.');
  if(p.etr)w.push(`Terrain très étroit et allongé (environ ${p.etr[0]} m sur ${p.etr[1]} m) : peut être un passage ou une bande ; les règles affichées sont celles de la zone, pas une constructibilité avérée.`);
  if(p.cinc)w.push('Une limite des couches carrières 2026 (reconstituées à environ 3 m près) passe à proximité : ne pas conclure sans la carte officielle.');
  w.push('<strong>Unité foncière</strong> : les règles s’appliquent à l’unité foncière (ensemble de parcelles contiguës appartenant à un même propriétaire), pas à la parcelle cadastrale isolée. Ce site ne connaît pas les propriétaires : si ce terrain fait partie d’une unité foncière plus grande, la surface, les seuils (150 m², 2 000 m²…), l’emprise et la pleine terre se calculent sur l’ensemble.');
  w.push('Règles générales seulement : les exceptions, majorations et prescriptions graphiques sont dans l’analyse détaillée. Un potentiel réglementaire n’est ni un permis ni un projet ; le document officiel fait foi.');
  h+=`<div class="avert"><strong>Avertissements importants</strong><ul>${w.map(x=>'<li>'+x+'</li>').join('')}</ul></div>`}
 h+='</div>';
 {const L=[];
  [['h','Hauteur'],['e','Emprise au sol'],['pt','Pleine terre']].forEach(([k,n])=>{const x=C[k];if(['inchangée','non comparable','non déterminé'].includes(x.ev))return;
   let t=`<strong>${n}</strong> : ${x.rows[0].a} → ${x.rows[0].n}. Ancien PLU : ${x.refA||'règle non relue'} ; PLUi : ${x.refN||'règle non relue'}.`;
   const petL=(x.exa||[]).find(l=>l.k==='petit'&&/^oui/.test(l.app)),pet=!!petL;
   if(pet&&!(x.exn||[]).some(l=>l.k==='petit'))t+=' <em>Cause : la règle des petits terrains de l’ancien PLU (art. '+petL.art+' : terrain de moins de 150 m²) n’est pas reprise par cet indice du PLUi.</em>';
   else if(k==='h')t+=' <em>Cause : l’indice de hauteur de la nouvelle zone fixe d’autres valeurs que celles de l’ancienne zone.</em>';
   else t+=' <em>Cause : la règle de la nouvelle zone diffère de celle de l’ancienne zone.</em>';
   L.push(t)});
  if(L.length)h+=`<p><strong>Pourquoi ces règles ont changé</strong></p><p class="note">Le terrain est passé de la zone <strong>${F(p.az)}</strong> de l’ancien PLU à la zone <strong>${p.z}</strong> du PLUi${NATURE[p.z]?' ('+NATURE[p.z]+')':''}.</p><ul>${L.map(x=>'<li>'+x+'</li>').join('')}</ul>`;
  else h+=`<p class="note">Le terrain passe de la zone ${F(p.az)} à la zone ${p.z} sans écart de règle générale établi (hauteur, emprise, pleine terre) ; voir les exceptions dans l’analyse détaillée.</p>`}
 // ===== NIVEAU 2 : analyse détaillée =====
 h+='<h3 class="niv2">Analyse détaillée</h3>';
 {let e='<p class="note">Pour chaque règle : la règle générale, puis les exceptions de chaque texte (avec l’article et la page), puis les différences. Une exception réservée aux petits terrains est signalée comme applicable ou non à ce terrain d’après sa surface cadastrale.</p>';
  [['h','Hauteur'],['e','Emprise au sol'],['pt','Pleine terre']].forEach(([k,nom])=>{const x=C[k];
   e+=`<h4>${nom} ${B_GEN} ${nvb(x.niv)}</h4>${tabRegle(x)}`;
   e+=`<p><strong>Exceptions — ancien PLU (zone ${F(p.az)})</strong> <span class="note">${x.refA||'exceptions non relues pour cette zone : à vérifier'}</span></p>`;
   e+=x.exa.length?'<ul>'+x.exa.map(l=>`<li>${B_EXC} ${l.t} <span class="note">(art. ${l.art||'—'} ; applicable à ce terrain : ${l.app})</span></li>`).join('')+'</ul>':'<p class="note">Aucune exception relevée.</p>';
   e+=`<p><strong>Exceptions — PLUi (code ${p.z})</strong> <span class="note">${x.refN||'règle non relue : à vérifier'}</span></p>`;
   e+=x.exn.length?'<ul>'+x.exn.map(l=>`<li>${B_EXC} ${l.t} <span class="note">(applicable à ce terrain : ${l.app})</span></li>`).join('')+'</ul>':'<p class="note">Aucune exception relevée.</p>';
   if(x.diffs.length)e+=`<p><strong>Différences entre les deux textes</strong></p><ul>${lignesDiff(x)}</ul>`;
   if(x.why.length)e+=`<div class="avert"><strong>Pourquoi cette comparaison n’est pas établie avec certitude</strong> : ${x.why.join(' ; ')}.</div>`;
   if(k==='e'&&(x.exa.some(l=>l.k==='amel')||x.exn.some(l=>l.k==='amel')))e+='<p class="note"><strong>Portée de l’exception « amélioration »</strong> : elle ne vaut pas pour n’importe quel agrandissement. Dans les deux textes, il s’agit de travaux sur une construction existante faisant preuve d’exemplarité énergétique ou environnementale (art. L. 151-28 du code de l’urbanisme), qui n’augmentent pas la surface de plancher de plus de 50 % et ne créent pas de logement (ancien PLU : annexe 1 « définitions », p. imprimée 113 ; PLUi : lexique, p. 407 du PDF). Écarts : l’ancien texte ajoutait « ou à énergie positive » ; le PLUi se réfère aux constructions existantes à la date d’approbation <em>du PLUi</em>, l’ancien à celles existantes à la date de l’ancien règlement : <strong>la portée exacte reste à vérifier</strong>.</p>';
   if(k==='h'&&((p.ha&&p.ha.length)||p.hs||p.hp))e+=`<p>${B_PG} ${p.ha&&p.ha.length?`ligne de hauteur particulière de l’ancien PLU à moins de 5 m (${p.ha.join(', ')}) ; `:''}${p.hs?`hauteur spécifique du PLUi à moins de 5 m (${p.hs}) ; `:''}${p.hp?'hauteur plafond repérée sur le plan ; ':''}<span class="note">à lire avec les prescriptions sur le plan ci-dessous</span></p>`;
   else if(k==='h')e+=`<p class="note">${B_PG} Aucune ligne de hauteur particulière (ancien PLU, paquet de 2019 concordant avec la planche 3 de mars 2024) ni hauteur spécifique du PLUi à moins de 5 m de ce terrain.</p>`;
   if(k==='h')e+='<p class="note">Les installations techniques indispensables (antennes, cheminées, ascenseurs, panneaux solaires…) sont exclues du calcul de la hauteur dans la limite de 2 m, en retrait de 2 m en toiture-terrasse (PLUi, lexique « Hauteur », p. 393 du PDF). La hauteur se mesure depuis le terrain avant travaux.</p>'});
  h+=sec('Exceptions et majorations (hauteur, emprise, pleine terre)',e,true)}
 // Voisinage : vues, distances, hauteur des voisins
 const lefP=(p.ad||[]).some(a=>/Lef[eè]vre/i.test(a)),adTxt=p.ad&&p.ad.length?p.ad.join(', '):'adresse non déterminée';
 {const um=p.z==='UMHHHHHH',uh=p.z==='UHmHHHHHH';
  const VUES=`<table class="syn"><tr><th></th><th>Ancien PLU (annexe 1 « définitions », p. imprimée 113)</th><th>PLUi (lexique « ouverture… », p. 398-399 du PDF)</th></tr>
   <tr><td><strong>Ouvertures qui déclenchent la règle la plus stricte</strong></td><td>« baies principales » : ouvertures à moins de 1,90 m au-dessus du plancher (y compris châssis de toiture), fenêtres, portes-fenêtres, lucarnes, loggias non closes au nu de la façade</td><td>« ouvertures constituant des vues » : ouvertures à moins de 1,90 m du plancher, portes vitrées transparentes, <strong>balcons</strong>, <strong>loggias</strong>, <strong>terrasses à plus de 0,60 m du terrain</strong>, <strong>toits-terrasses accessibles</strong></td></tr>
   <tr><td><strong>Ouvertures qui ne déclenchent pas cette règle</strong></td><td>« baies secondaires » (ouvertures à 1,90 m ou plus, de moins de 0,25 m², percements en sous-sol, baies de rez-de-chaussée face à un mur occultant) ; ne sont pas des baies : pavés de verre, châssis fixes translucides, jours de souffrance, <strong>balcons, terrasses (accessibles ou non)</strong>, marches et paliers</td><td>« ouvertures ne constituant pas des vues » : ouvertures à 1,90 m ou plus, de moins de 0,25 m² (0,5 m² par façade au plus), sous-sol, portes pleines ou translucides, châssis fixes translucides, pavés de verre, marches de moins de 2 m², toits-terrasses inaccessibles, terrasses à moins de 0,60 m, <strong>balcons, terrasses et ouvertures masquées par un pare-vue</strong></td></tr></table>
   <p class="note"><strong>Correspondance : comparaison partielle.</strong> « Baies principales » et « ouvertures constituant des vues » jouent le même rôle (distance L = H, 8 m au minimum), « baies secondaires » et « ouvertures ne constituant pas des vues » aussi (L = ½ H, 4 m au minimum), mais <strong>le périmètre n’est pas le même</strong> : les balcons et terrasses n’étaient pas des baies dans l’ancien PLU alors qu’ils constituent des vues dans le PLUi (sauf pare-vue). Les distances écrites sont donc de même formule, pas nécessairement de même effet.</p>`;
  if(um||uh){
   let v='<ul>';
   v+='<li><strong>Façade sur une limite séparative</strong> : elle doit être <strong>aveugle</strong> (ni ouverture, ni pavé de verre, ni jour de souffrance, ni châssis fixe) — règlement, art. 3.1.2.1.1, p. 118. <span class="note">Définition du « mur aveugle » au lexique, p. 398 du PDF : un châssis fixe ou un pavé de verre translucide y est toléré ; l’article 3.1.2.1.1 est plus strict : lecture à vérifier.</span></li>';
   v+='<li><strong>Implantation</strong> : sur les limites séparatives ou en retrait'+(uh?' ; en limite de fond, une construction sans vues peut s’implanter sur la limite, une construction avec vues doit être en retrait (ancien UB2-7.2 : en fond de parcelle sans baies, sinon retrait L = ½ H)':'')+'.</li>';
   v+='<li><strong>En retrait, avec ouvertures constituant des vues</strong> (façade ou toiture) : distance au moins égale à la <strong>hauteur de la façade</strong> (ou de l’allège de l’ouverture en toiture), <strong>8 m au minimum</strong>.</li>';
   v+='<li><strong>En retrait, sans ouverture ou avec ouvertures ne constituant pas des vues</strong> : au moins la <strong>moitié de la hauteur</strong> de la façade, <strong>4 m au minimum</strong>.</li>';
   if(uh)v+='<li><strong>En retrait des limites de fond</strong> : au moins la moitié de la hauteur de la façade.</li>';
   v+='<li><strong>Pompes à chaleur, climatiseurs, VMC</strong> : à au moins <strong>3 m</strong> de toute limite séparative (admises sur façade ou pignon si elles sont intégrées à la composition du bâtiment).</li>';
   if(um)v+='<li><strong>Hauteur et voisins</strong> : hauteur portée à 15 m (un étage de plus) si la construction s’adosse de part et d’autre à des bâtiments voisins en bon état et plus hauts (art. 3.1.7.4, p. 299)'+(p.az==='UB1'?' — <strong>cette possibilité existait déjà dans l’ancien PLU</strong> (art. UB1-10.2) : ce n’est pas une nouveauté du PLUi':p.az==='UB2'?' — <strong>absente de l’ancien PLU en zone UB2</strong> (nouveauté pour ce terrain)':'')+'.</li>';
   if(um)v+=lefP?'<li><strong>Rue Lefebvre</strong> : l’adresse de ce terrain est rue Lefebvre : des règles particulières d’implantation sur les limites latérales s’appliquent côté pair et côté impair (art. 3.1.2.6, indice H, p. 141-142) ; à lire dans le texte ci-dessous et sur le document graphique.</li>':`<li class="mute"><strong>Rue Lefebvre</strong> : les dispositions particulières à la rue Lefebvre (côtés pair et impair) <strong>ne concernent pas ce terrain</strong> (adresse : ${adTxt}). Elles figurent dans le texte reproduit plus bas, signalées comme telles.</li>`;
   v+=`</ul><p class="note">PLUi : ${um?'art. 3.1.2.6, indice H, p. 141-142':'art. 3.1.2.8, indice H, p. 168-169'}.${(p.az==='UB1'||p.az==='UB2')?` Ancien PLU (${p.az}, art. 7.1${p.az==='UB2'?' et 7.2':''}) : même formule de prospect (L = H avec baies principales, 8 m minimum ; L = ½ H sinon, 4 m minimum).`:` Ancien PLU : voir l’article 7 de l’ancienne zone (${F(p.az)}).`} Les règles s’appliquent aux constructions principales ; annexes et cas particuliers : voir le règlement.</p>`+VUES;
   h+=sec('Implantation et règles de voisinage : vues, distances, hauteur des voisins',v,false)}
  else{const f=(/^(UC|UA|UR|UI|UE)HHHHHH1?$/.exec(p.z)||[])[1];const A={
   UC:['3.1.2.4, indice H, p. 121-122',['sur les limites latérales ou en retrait ; <strong>en retrait obligatoire des limites de fond</strong>','<strong>si un bâtiment voisin en bon état, d’au moins R+1, a un mur aveugle sur la limite latérale, le projet doit obligatoirement s’implanter sur cette limite</strong>','si un bâtiment voisin à moins de 2,50 m d’une limite a une façade avec une vue, le projet peut être imposé en retrait','adossement autorisé à un bâtiment voisin en bon état sur la limite de fond, sans le dépasser en dimensions','en retrait avec vues : hauteur de la façade (ou allège de l’ouverture en toiture), <strong>8 m minimum</strong> ; sans vues : moitié de la hauteur, <strong>4 m minimum</strong>']],
   UA:['3.1.2.5, indice H, p. 131-132',['<strong>dans une bande de 15 m depuis l’alignement : implantation obligatoire sur les limites latérales</strong> (les deux derniers niveaux en attique peuvent être en retrait)','au-delà de 15 m : en retrait des limites','adossement autorisé à un bâtiment voisin en bon état sur la limite de fond, sans le dépasser','en retrait avec vues : hauteur de la façade, <strong>8 m minimum</strong> ; sans vues : moitié de la hauteur, <strong>4 m minimum</strong>']],
   UR:['3.1.2.7, indice H, p. 156',['constructions principales en retrait d’au moins <strong>8 m</strong> des limites séparatives']],
   UI:['3.1.2.9, indice H, p. 183',['sur les limites ou en retrait','en retrait avec vues : moitié de la hauteur de la façade, <strong>8 m minimum</strong> ; sans vues : <strong>8 m minimum</strong>']],
   UE:['3.1.2.10, indice H, p. 191',['sur les limites ou en retrait','en retrait avec vues : <strong>8 m minimum</strong> ; sans vues : <strong>3 m minimum</strong>']]};
   if(f){const [art,L]=A[f];h+=sec('Implantation et règles de voisinage : vues, distances, hauteur des voisins','<ul><li><strong>Façade sur une limite séparative</strong> : aveugle (aucune ouverture, pavé de verre, jour de souffrance ni châssis fixe) — art. 3.1.2.1.1, p. 118.</li>'+L.map(x=>'<li>'+x+'</li>').join('')+'<li><strong>Pompes à chaleur, climatiseurs, VMC</strong> : à 3 m au moins de toute limite séparative.</li></ul><p class="note">PLUi : art. '+art+'. Ancien PLU : voir l’article 7 de l’ancienne zone ('+F(p.az)+'). Règles reproduites en résumé : <strong>comparaison partielle</strong>, les équivalents de l’ancien article 7 n’ont pas été comparés pour cette zone ; annexes et cas particuliers : voir le règlement.</p>'+VUES,false)}
   else h+=sec('Implantation et règles de voisinage : vues, distances, hauteur des voisins','<p class="note">Pour cette zone ('+p.z+'), les règles de retrait par rapport aux limites séparatives et de hauteur par rapport aux voisins sont celles de l’article 3.1.2 du règlement (indices propres à la zone) : non détaillées ici, à lire dans le règlement. Dispositions communes : façade en limite séparative aveugle ; pompes à chaleur et climatiseurs à 3 m au moins des limites (art. 3.1.2.1.1, p. 118). '+B_VER+'</p>'+VUES,false)}}
 {const lt=LIMT[p.z];if(lt){
   const morceaux=[];let cur=[];lt[2].split('\n').forEach(l=>{cur.push(l);if(/\.\s*$/.test(l)){morceaux.push(cur.join('\n'));cur=[]}});if(cur.length)morceaux.push(cur.join('\n'));
   const corps=morceaux.map(m=>{const lef=/Lefebvre/.test(m);const t=m.replace(/</g,'&lt;');
    if(lef&&!lefP)return `<div class="mute"><span class="note"><strong>Ne concerne pas ce terrain</strong> : disposition particulière à la rue Lefebvre (adresse du terrain : ${adTxt}).</span><div style="white-space:pre-line">${t}</div></div>`;
    if(lef)return `<div style="border-left:3px solid var(--ocre);padding-left:8px"><span class="note"><strong>Concerne ce terrain</strong> (rue Lefebvre).</span><div style="white-space:pre-line">${t}</div></div>`;
    return `<div style="white-space:pre-line">${t}</div>`}).join('');
   h+=sec('Implantation : texte intégral du règlement (limites séparatives)','<p class="note">Reproduction du règlement du PLUi, art. '+lt[0]+', p. '+lt[1]+' du PDF, pour le code '+p.z+'. Le texte fait foi. Les dispositions qui ne concernent pas ce terrain sont estompées et signalées.</p><blockquote style="margin:6px 0;padding-left:10px;border-left:3px solid var(--trait)">'+corps+'</blockquote>',false)}}
 {const fz=/^(UM|UHm|UC|UA|UR|UI|UE)/.exec(p.z||''),k=(p.az||'')+'>'+(fz?fz[1]:'');
  if(IMPL[k]){const V=v=>/^identique/.test(v)?B_FIA:/à vérifier/.test(v)?B_VER:B_PAR;
   let t='<table class="syn"><tr><th>Point</th><th>Ancien PLU (zone '+F(p.az)+')</th><th>PLUi</th><th>Comparaison</th></tr>'+IMPL[k].map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${V(r[3])}<br><span class="note">${r[3]}</span></td></tr>`).join('')+'</table><p class="note">Lecture article par article des anciens articles 6 et 7 et des indices H du PLUi (résumés, pas le texte intégral). Les lignes « non relevé » signifient que la disposition n’a pas été retrouvée dans le texte de l’indice lu : <strong>à vérifier</strong>, pas une preuve d’absence. Les annexes et les services publics ont souvent des régimes propres.</p>';
   h+=sec('Implantation : comparaison article par article (anciens articles 6 et 7)',t,false)}}
 // 2. prescriptions graphiques
 const L=[];
 if(p.rs)L.push(`<strong>Retrait spécifique</strong> (à moins de 3 m) : ${p.rs.split(',').map(c=>({GE1:'retrait de 2 m depuis l’alignement',GE2:'retrait de 3 m minimum',GE3:'retrait de 4 m minimum'})[c.trim().toUpperCase()]||c).join(' ; ')}`);
 if(p.al)L.push(`<strong>Alignement spécifique</strong> : ${p.al.split(',').map(c=>({GE1:'construction à l’alignement du tracé',GE2:'bureaux : encorbellement possible à partir du R+2 sur 1,50 m de profondeur au plus'})[c.trim().toUpperCase()]||c).join(' ; ')}`);
 if(p.hs)L.push(`<strong>Hauteur spécifique</strong> (à moins de 5 m) : ${p.hs.split(',').map(c=>({GE1:'7,5 m à l’égout ou à l’acrotère, 9,5 m au faîtage',GE2:'9,5 m à l’égout ou à l’acrotère, 12 m au faîtage'})[c.trim().toUpperCase()]||c).join(' ; ')}`);
 if(p.hp)L.push('<strong>Hauteur plafond</strong> repérée sur le plan (non lue en détail)');
 if(p.ev>0)L.push(`<strong>Espace vert protégé</strong> sur ${p.ev} % du terrain : plantations existantes maintenues, pleine terre préservée, clôtures perméables à la petite faune ; toute construction ou changement du traitement des espaces extérieurs est interdit, sauf travaux d’amélioration et changement de destination de l’existant, <strong>une construction annexe</strong>, <strong>une serre de 20 m²</strong> au plus (démontable, sans fondation), <strong>des abris légers de 15 m²</strong> au plus, circulations douces perméables de moins de 1,50 m de large et ouvrages d’intérêt collectif (règlement 3.3.2.1, p. 352-353). Une variante « à sanctuariser » est plus stricte (pas d’annexe ni d’abri).`);
 if(p.ark)L.push('<strong>Arbre remarquable</strong> repéré à moins de 5 m (il peut se trouver sur le terrain voisin ou sur la voie) : <strong>coupe et abattage interdits</strong>, sauf motif sanitaire ou de sécurité justifié par un diagnostic d’un organisme indépendant, avec replantation obligatoire (baliveau de 300/350 cm au moins, ou arbre de grand développement d’au moins 15 m à l’âge adulte) ; interdit d’atteindre le houppier ou les racines ; <strong>distance minimale entre le tronc et toute construction principale ou imperméabilisation : 7 m (grand développement), 6 m (moyen), 5 m (petit)</strong>, avec pleine terre obligatoire dans ce périmètre et changements de niveau du sol interdits (règlement 3.3.2.3, p. 354-355)');
 if(p.aa)L.push('<strong>Alignement d’arbres protégé</strong> à moins de 5 m : coupes et abattages <strong>interdits</strong> sauf motif sanitaire ou de sécurité justifié par un diagnostic indépendant ; la protection vaut aussi pour l’emplacement d’un arbre abattu ; les accès à la propriété doivent éviter les arbres (règlement 3.3.2.2, p. 354)');
 if(p.bv)L.push('<strong>Bièvre</strong> à moins de 12 m : constructions interdites sur 6 m de part et d’autre de l’axe (partie canalisée), règlement 3.3.2.4');
 if(p.la){const m=[];if(/commercial/i.test(p.la))m.push('commercial et artisanal : rez-de-chaussée en artisanat, commerce de détail, restauration ou équipement');if(/mixite/i.test(p.la))m.push('mixité d’activités : s’y ajoutent services, hôtels, cinéma');if(/actif/i.test(p.la))m.push('actif : s’y ajoutent les bureaux');L.push(`<strong>Linéaire en rez-de-chaussée</strong> à moins de 5 m (${m.join(' ; ')} ; règlement 2.2.4.1)`)}
 if(L.length)h+=sec(`Prescriptions sur le plan (${L.length})`,`<ul>${L.map(x=>`<li>${x}</li>`).join('')}</ul><p class="note">Les codes GE1 à GE3 sont ceux du règlement de Gentilly (voir les documents de vérification du dépôt).</p>`,true);
 // Arbres et plantations : règles communes à tous les terrains
 {let a='<ul><li><strong>Conservation</strong> : les projets doivent conserver au maximum les plantations existantes de l’unité foncière ; en cas d’abattage, remplacement par des essences indigènes à raison de <strong>2 arbres plantés pour 1 abattu</strong> sur la même unité foncière.</li>';
  a+='<li><strong>Plantation</strong> : au moins <strong>1 arbre par tranche de 100 m² d’espaces libres</strong> (arrondi au supérieur ; les arbres existants comptent), planté dans un espace de pleine terre « <strong>au moins égal à un cube de 2,50 mètres de côté, ou 12 m³</strong> » (formulation littérale du règlement). <strong>Les deux valeurs ne coïncident pas</strong> : un cube de 2,50 m de côté représente 15,6 m³, pas 12 m³ ; le texte ne dit pas laquelle prévaut : <strong>à vérifier</strong>, on ne retient pas « 12 m³ = cube de 2,50 m ». Arbres plantés d’au moins <strong>1,50 m</strong> de hauteur ; arbres de moyen et grand développement à <strong>2 m minimum des limites séparatives</strong>.</li>';
  a+='<li><strong>Arbres existants et constructions neuves</strong> : distance entre l’axe du tronc et les façades de <strong>7 m</strong> (grand développement, 15 m et plus à maturité), <strong>6 m</strong> (moyen, 8 à 15 m) ou <strong>5 m</strong> (petit, 5 à 8 m).</li>';
  a+='<li><strong>Aires de stationnement</strong> de plus de 4 places : un arbre au moins par 50 m² de surface de stationnement, matériaux infiltrants majoritaires.</li>';
  a+='<li>Si la construction est en retrait de l’alignement, au moins 50 % de l’espace entre la construction et l’alignement doit être végétalisé (sauf rez-de-chaussée hors habitation).</li></ul>';
  a+='<p class="note">'+B_PAR+' PLUi, art. 3.3.1, p. 350 à 352 du PDF. <strong>Conditions d’application</strong> : ces dispositions de traitement des espaces non bâtis <strong>ne s’appliquent pas aux travaux de réhabilitation des constructions existantes</strong> (p. 352) ; l’obligation de planter un arbre par 100 m² ne s’applique pas aux équipements publics ou d’intérêt collectif lorsque des dispositions de sécurité ou de fonctionnement l’imposent (p. 351). Le règlement ne précise pas ici la définition exacte des « espaces libres » : à vérifier. <strong>Ancien PLU</strong> (art. 13 des zones UA, UB, UE, UH) : arbres abattus remplacés par <strong>un nombre égal</strong> d’arbres de développement équivalent (13.2) ; <strong>1 arbre à grand développement par 100 m²</strong> d’espace libre (13.9) ; stationnement non couvert : 1 arbre à moyen développement pour 4 places (5 en UA2). <strong>Comparaison partielle</strong> : le remplacement passe de 1 pour 1 à 2 pour 1 ; le PLUi exige un arbre (de tout développement) par 100 m² planté dans un volume de pleine terre minimal, là où l’ancien PLU visait des arbres à grand développement ; les autres seuils sont de même ordre. Les essences à privilégier et les espèces à proscrire figurent en annexe du règlement. L’abattage d’un arbre non protégé peut relever d’autres règles (autorisation, code civil pour les distances) : non traité ici.</p>';
  h+=sec('Arbres et plantations (règles pour tous les terrains)',a,false)}

 // Eaux usées, eaux pluviales, séparation des réseaux : règles communes
 {const S=p.s||0,vol=S*10/1000,deb=Math.max(1,2*S/10000),fr=x=>x.toLocaleString('fr-FR',{maximumFractionDigits:2});
  let e='<ul>';
  e+='<li><strong>Séparer les eaux usées et les eaux pluviales à l’intérieur du terrain</strong> : c’est impératif. Quand le réseau public est séparatif, les deux sont évacuées par <strong>deux branchements distincts</strong>, avec un écoulement libre (sans stagnation, obstacle ni contre-pente). Les eaux usées doivent être raccordées au réseau collectif par des canalisations souterraines.</li>';
  e+='<li><strong>Le réseau public de Gentilly est surtout « unitaire »</strong> : d’après le tableau du règlement, <strong>94 % unitaire, 6 % séparatif</strong> (bassin de la Bièvre). Dans un réseau unitaire, eaux usées et eaux de pluie circulent dans la même canalisation publique ; c’est pourquoi le règlement cherche à <strong>limiter ce qui part de la parcelle vers le réseau</strong> par temps de pluie.</li>';
  e+='<li><strong>Eaux pluviales : d’abord à la parcelle</strong> (infiltration, absorption, évapotranspiration par la végétation, réduction des surfaces imperméables), au plus près de l’endroit où elles tombent. La <strong>pluie courante de 10 mm</strong> doit être gérée sur la parcelle <strong>sans dérogation possible</strong>, avec un ouvrage qui se vide en 48 h ; l’objectif est de retenir <strong>au minimum une pluie de période de retour 20 ans et de 4 heures</strong>.'+(S?' Pour ce terrain, <strong>10 mm sur '+fr(S)+' m² représentent environ '+fr(vol)+' m³ ('+fr(S*10)+' litres)</strong> si le projet porte sur toute la surface (ordre de grandeur calculé par l’observatoire ; pour une extension, la règle porte sur la surface remaniée).':'')+'</li>';
  e+='<li><strong>Rejet au réseau : seulement par dérogation</strong>, si des difficultés techniques détaillées le justifient. Le débit est alors limité à <strong>2 litres par seconde et par hectare à Gentilly</strong>, avec un minimum de 1 litre par seconde'+(S?' : soit <strong>'+fr(deb)+' l/s</strong> pour ce terrain':'')+'. Aucune surverse ni by-pass n’est accepté. Les ouvrages centralisés enterrés avec pompage sont eux-mêmes dérogatoires.</li>';
  e+='<li><strong>Qui est concerné</strong> : toute construction nouvelle ou artificialisation (règle sur toute la surface du terrain) ; extension, démolition-reconstruction (règle sur la surface remaniée) ; pour la rénovation sans changement d’emprise, application recommandée, <strong>obligatoire si la construction existante n’est pas conforme</strong>, notamment en cas de rejet d’eaux usées dans le réseau d’eaux pluviales.</li>';
  e+='<li><strong>Pollution</strong> : les eaux pluviales polluées passent par un système adapté (décantation, filtre planté, débourbeur-déshuileur…). Les rejets d’eaux claires (pompage de nappe, pompes à chaleur) sont interdits dans les réseaux d’eaux usées et unitaires.</li>';
  const z=zrr(p);
  if(z)e+='<li><strong>Zone '+z+' du plan « carrières »</strong> : l’infiltration totale peut ne pas être possible ou autorisée ; le règlement prévoit alors une dérogation pour le rejet au réseau, <strong>après expertise</strong> attestant l’impossibilité (art. 4.3.3.4). À lire avec l’onglet « Les carrières ».</li>';
  e+='</ul><p class="note"><strong>Avant, dans l’ancien PLU</strong> (art. UB2-4) : déjà la collecte séparée des eaux pluviales et des eaux usées à l’intérieur d’une même propriété, le raccordement obligatoire au réseau collectif quand il est possible, un traitement par débourbage-déshuilage pour les parkings de plus de 5 places, et la recommandation d’intégrer des dispositifs alternatifs limitant ou écrêtant les débits. <strong>Aucun volume ni débit chiffré dans l’article lui-même</strong>. Mais l’annexe 575 du PLU de 2024 contient un règlement d’assainissement du Val de Bièvre (délibération de 2005) qui posait déjà le principe du « zéro rejet », un rejet limité à <strong>2 l/s/ha si l’exutoire est la Bièvre (8 l/s/ha sinon)</strong> et un stockage dimensionné sur la pluie décennale. Sa page de garde précise toutefois que ce règlement « n’est pas approuvé » et « devra être annexé dès qu’il le sera » : <strong>sa portée réelle est à vérifier</strong>. Le PLUi reprend un débit voisin (2 l/s/ha à Gentilly) et ajoute la pluie courante de 10 mm sans dérogation et la rétention sur 20 ans.</p><p class="note">Source : PLUi, art. 4.3.2 à 4.3.3, p. 367-372 du PDF ; tableau « système de collecte » p. 371. Les choix techniques et les études restent à la charge du porteur de projet ; le règlement d’assainissement du gestionnaire de réseau s’applique en plus (non lu ici). Cette rubrique décrit des règles, pas une étude de faisabilité.</p>';
  h+=sec('Eaux usées, eaux pluviales et séparation des réseaux',e,false)}
 // 3. usages
 const dz=p.dz,rows=DEST[dz];
 if(rows){const g={A:[],C:[],X:[]};rows.forEach(r=>{(r[1]==='A'?g.A:r[1]==='C'?g.C:g.X).push(r)});
  let u=`<p class="note">Zone <strong>${dz}</strong> du PLUi (règlement, tableau des destinations, p. ${rows[0][3]}). Un usage existant interdit peut continuer ; les travaux sans extension sont permis.</p>`;
  u+=`<p><span class="badge" style="background:#b5452b">interdit</span> ${g.X.length?g.X.map(r=>r[0]+(r[1]==='X*'?' (sauf l’existant)':'')).join(' · '):'—'}</p>`;
  u+=`<p><span class="badge" style="background:#c98a1b">sous conditions</span><br>${g.C.length?g.C.map(r=>`${r[0]}${r[2]?' : <span class="note">'+r[2].replace(/^Sont (uniquement )?autorisées? (sous condition )?/i,'')+'</span>':''}`).join('<br>'):'—'}</p>`;
  u+=`<p><span class="badge" style="background:#3e8c50">autorisé</span> ${g.A.map(r=>r[0]).join(' · ')}</p>`;
  if(p.pk&&PAIRS[p.pk]){const nett=t=>t.replace(/^Sont (uniquement )?autorisées? (sous condition )?(les constructions à destination d’|les constructions à destination de |les constructions à usage d’)?/i,'');
   u+=`<p><strong>Ce qui change par rapport à l’ancien PLU</strong> (zone ${p.pk.replace('>',' → ')}) ${B_PAR}</p><ul>${PAIRS[p.pk].map(r=>{const nc=r[5]==='nc';return `<li>${r[0]} : ${nc?'<strong>non comparable</strong> — '+(/^Cuisine/.test(r[0])?'sous-destination créée par le décret n° 2023-195 et l’arrêté du 22 mars 2023 (JO du 24 mars 2023), absente de la nomenclature de l’ancien PLU ; dans le PLUi elle est « '+SD[r[2]][0]+' », mais aucune comparaison historique n’est possible : ne pas en déduire une interdiction nouvelle':'nomenclature différente'):SD[r[1]][0]+' → <strong>'+SD[r[2]][0]+'</strong>'}${!nc&&r[5]==='ap'?' <span class="note">(correspondance approximative entre anciennes et nouvelles destinations)</span>':''}${r[4]&&!nc?` <span class="note">(${nett(r[4])})</span>`:''}</li>`}).join('')}</ul><p class="note"><strong>Limites de la comparaison.</strong> L’ancien PLU (articles 1 et 2 de chaque zone) raisonne avec l’ancienne nomenclature des destinations ; le rapprochement avec les sous-destinations du PLUi est une lecture de l’observatoire. Un usage non cité comme interdit dans l’ancien PLU n’est pas pour autant prouvé autorisé (autres articles, autres règles) : « autorisé → interdit » se lit comme <em>comparaison partielle</em>, jamais comme une certitude, et rien ne doit être déduit d’une sous-destination « non comparable ».</p>`}
  else u+=`<p class="note">Pas de changement d’usage relevé par rapport à l’ancien PLU pour ce couple de zones (${F(p.az)} → ${dz}), ou couple non comparé.</p>`;
  h+=sec(`Usages autorisés : ${g.A.length} autorisés, ${g.C.length} sous conditions, ${g.X.length} interdits`,u,false)}
 // 4. stationnement
 {const pp=p.p5?(p.p5p&&p.p5p<100?`<em>Une partie du terrain (${p.p5p} %) est dans un périmètre de 500 m autour d’une gare ou station : la règle s’applique alors à <strong>toute l’unité foncière</strong> (art. 4.1.2).</em>`:'<em>Ce terrain est dans un périmètre de 500 m autour d’une gare ou station.</em>'):'<em>Ce terrain n’est pas dans un périmètre de 500 m autour d’une gare ou station.</em>';
  let sp=`<p class="note">${B_PAR} Les ratios ci-dessous sont lus dans le règlement écrit (art. 4.1, p. 358 à 364 du PDF) et, pour les valeurs chiffrées des logements et des bureaux, dans les plans de stationnement du règlement graphique (n° 25, pages 6 et 7 du PDF) ; ces plans ont été relus directement le 12 novembre 2026 : Gentilly figure parmi les communes limitrophes de Paris, bureaux 90 m² (périmètre de 500 m) et 70 m² (au-delà), logement 0,8 à Gentilly. <strong>Résultats arrondis à l’unité supérieure ; toute tranche commencée est due</strong> (art. 4.1.2, p. 360).</p><ul>
  <li><strong>Logement</strong> — <em>« est exigé au minimum »</em> : <strong>0,8 place par logement</strong> à Gentilly (plan « règles de stationnement à destination du logement » : 0,8 lu à Gentilly, dans et hors des périmètres de 500 m). <strong>Studios et T1</strong> : 1 place minimum par logement ; le texte est placé dans la colonne « hors périmètre » mais commence par « à l’ensemble du territoire » : <strong>portée exacte à confirmer</strong>. <strong>Logements locatifs aidés</strong> : 0,8 place par logement à Gentilly (tableau p. 360-361). ${pp}</li>
  <li><strong>Bureaux</strong> : norme de <strong>1 place pour ${p.p5?'90':'70'} m²</strong> de plancher (${p.p5?'dans':'hors'} périmètre de 500 m ; plan « règles de stationnement à destination d’activité »). Le tableau écrit « est exigé » sans préciser <strong>minimum ou maximum : non établi</strong> (l’ancien PLU parlait d’un maximum).</li>
  <li><strong>Commerces, restauration, services avec accueil de clientèle, commerce de gros</strong> : aucune place pour les 200 premiers m² de plancher <strong>de chaque local</strong>, puis 1 place par tranche de 150 m² (communes limitrophes de Paris, d’après le plan d’activité) ; une aire de livraison au-delà de 500 m² (« est exigé au minimum »).</li>
  <li><strong>Vélos</strong> : 0,75 m² par logement jusqu’à 2 pièces, 1,5 m² au-delà (3 m² au minimum) ; bureaux : 1,5 m² pour 100 m² (art. 4.1.3, p. 363).</li></ul>
  <p><strong>Exceptions et règles de forme</strong></p><ul>
  <li>Toute création de logement, <strong>même par division en volume</strong>, est soumise à la règle ; en cas de changement de destination, ce sont les normes de la nouvelle destination ; en cas d’extension, les normes du neuf (art. 4.1.1.1, p. 358).</li>
  <li>Des bureaux ou activités transformés en logements : seuls les logements créés par surélévation ou extension sont assujettis ; les places existantes peuvent être comptées (art. 4.1.1.6, p. 359).</li>
  <li><strong>Suppression</strong> de places existantes interdite si elle fait passer sous l’obligation (art. 4.1.1.2) ; places commandées interdites dès 2 logements (4.1.1.4) ; places pour personnes à mobilité réduite : 5 % au moins pour les opérations de 3 logements et plus (4.1.1.3).</li>
  <li><strong>Mutualisation</strong> (Gentilly) : jusqu’à 25 % de places en moins si le besoin atteint au moins 20 places, places non attribuées, notice justificative (4.1.1.7, p. 359-360) ; réduction minimale de 15 % possible en contrepartie d’autopartage (4.1.1.5).</li>
  <li>Dimensions minimales d’une place : 5 m × 2,50 m avec 5 m de dégagement (4.1.1.3).</li></ul>
  <p class="note"><strong>Ancien PLU</strong> (titre I, art. 3 « dispositions relatives à l’article 12 », communes à toutes les zones urbaines ; carte du plan local de déplacements p. 133 du règlement de 2019) : logements collectifs 1 place pour 100 m² de plancher (par tranche complète) ou 1 place par logement de 4 pièces ou moins ; bureaux <strong>au plus</strong> 1 place pour 90 ou 70 m² ; commerces : rien sous 250 m², puis 15 à 25 % de la surface. <strong>Comparaison partielle</strong> : méthode de calcul différente (par logement et par tranche commencée contre par tranche complète de surface) ; les écarts dépendent de la taille des logements. Voir le document du dépôt <code>docs/stationnement.md</code>.</p>`;
  h+=sec('Stationnement',sp,false)}
 // 5. mixité
 {const mx=[];
  if(p.mxs)mx.push(`${B_PG} <strong>Mixité sociale (secteur GE1)</strong> : ${p.mxs} % du terrain est dans le secteur${p.mxs<100?' (<strong>application partielle</strong> : à confirmer sur le plan)':''}. Texte (règlement 2.2.4.3, p. 76 du PDF) : « les opérations de logements comprenant 30 logements ou d’une surface de plancher de 2 000 m² de surface de plancher doivent comprendre une part d’au moins 30 % de logements locatifs sociaux ». Le texte n’écrit ni « au moins » ni « plus de » devant 30 logements ou 2 000 m² : <strong>sens exact du seuil (inclusif ou non, et « ou » entre les deux conditions) à vérifier</strong> ; il vise des <strong>opérations</strong> de logements, pas un logement isolé. Il renvoie à l’article L. 302-4 du code de la construction et de l’habitation (les autres communes citent L. 302-5).`);
  if(p.mxt)mx.push(`${B_PG} <strong>Taille minimale des logements (secteur GE1)</strong> : ${p.mxt} % du terrain dans le secteur. Texte (2.2.4.4, p. 78 du PDF) : dans les opérations visant à créer <strong>10 logements ou plus</strong> (construction neuve, changement de destination, division), <strong>90 % des logements doivent comporter au moins 2 pièces</strong>. Règle d’arrondi du nombre de logements : un logement est compté « dès lors que la décimale est supérieure à 5 » (p. 77 ; le texte ne précise pas s’il s’agit de 0,5 : à vérifier).`);
  if(!p.mxs&&!p.mxt&&p.mx&&/sociale|taille/.test(p.mx))mx.push(`${B_VER} Un secteur de mixité sociale ou de taille minimale touche ce terrain d’après une lecture antérieure, sans mesure de la part du terrain concernée : à vérifier sur le plan.`);
  if(p.mf)mx.push(`${B_PG} <strong>Mixité fonctionnelle (${p.mf})</strong> : ${({GE1:'10',GE2:'25',GE3:'75'})[p.mf]} % de la surface de plancher doit être destinée à de l’activité économique et/ou à des équipements d’intérêt collectif et services publics (2.2.4.2, p. 75).`);
  if(mx.length)h+=sec(`Mixité sociale et taille des logements (${mx.length})`,`<ul>${mx.map(x=>`<li>${x}</li>`).join('')}</ul><p class="note">${B_PAR} <strong>Ancien PLU</strong> : aucune disposition équivalente n’a été trouvée dans les articles des zones UA1, UA2, UB1, UB2, UE, UH, UI, UZa, UZb et N, ni de secteur correspondant dans les couches graphiques de 2019. Les dispositions générales (titre I) et les programmes de logements des orientations d’aménagement n’ont pas été relus intégralement : on ne peut donc pas écrire « nouvelle obligation » avec certitude ; il s’agit d’une <strong>absence de règle équivalente relevée</strong>.</p>`,false)}
 // 6. emplacement réservé
 if(p.erx){const [st,ao,an,po,pn]=p.erx;const lib=ids=>ids?ids.split(';').filter(Boolean).map(x=>{const[k]=x.split(':');return (ERANC[k]||ERNEW[k]||'')+` (${k})`}).join(' ; '):'';
  let e=`<p><strong>${st==='maintenu'?'Maintenu':st==='supprimé'?'Supprimé dans le PLUi':'Nouveau dans le PLUi'}</strong>`;
  if(ao)e+=`<br>Ancien PLU : ${ao.split(';').filter(Boolean).map(x=>{const[k,v]=x.split(':');return (ERANC[k]||k)+' ('+k+', '+v+', '+po+' % du terrain)'}).join(' ; ')}`;
  if(an)e+=`<br>PLUi : ${an.split(';').filter(Boolean).map(x=>{const[k,v]=x.split(':');return (ERNEW[k]||k)+' (n° '+k+', '+v+', '+pn+' % du terrain)'}).join(' ; ')}`;
  e+=`</p><p class="note">Bénéficiaire : la commune. Un emplacement réservé décrit une emprise, pas un projet ni un calendrier (liste du règlement, p. 2107 du PDF).</p>`;
  h+=sec('Emplacement réservé',e,true)}
 else if(p.er)h+=sec('Emplacement réservé','<p class="note">Un emplacement réservé est repéré à moins de 5 m de ce terrain.</p>',false);
 // 7. OAP
 if(p.on)h+=sec(`Orientation d’aménagement (${p.on.length})`,p.on.map(n=>`<p><strong>${n}</strong><br>${OAPT[n]||''}</p>`).join('')+'<p class="note">Un projet doit être compatible avec l’OAP et conforme au règlement : l’OAP s’ajoute au règlement, elle ne le remplace pas. Les schémas sont indicatifs.</p>',true);
 else if(p.oap)h+=sec('Orientation d’aménagement','<p class="note">Le terrain est dans les orientations d’aménagement stratégiques de l’ensemble du territoire (principes généraux, sans programme pour ce terrain).</p>',false);
 // 8. carrières
 const k=p.c26,k9=p.c19,zr=p.zr;
 const ze=zr[0]||zr[1]?'zone rouge ou rouge hachuré : en principe inconstructible, avec des exceptions limitées (règlement du plan, p. 16 à 18)':zr[2]>0?'zone bleue : construction possible, avec étude géotechnique, prescriptions et attestation jointe à la demande de permis (règlement du plan, p. 18)':'hors zonage du plan';
 h+=sec('Anciennes carrières (plan de prévention 2026)',`<p>Zonage : ${[zr[0]?`rouge ${zr[0]} %`:'',zr[1]?`rouge hachuré ${zr[1]} %`:'',zr[2]?`bleue ${zr[2]} %`:''].filter(Boolean).join(', ')||'hors zonage'}<br><span class="note">${ze}</span></p><p class="note">Aléas 2026 : ${al(k)} · aléas 2019 : ${al(k9)}. Une différence entre 2019 et 2026 ne prouve pas une aggravation du danger.</p>${p.cinc?`<div class="avert">${B_VER} <strong>Une limite de zone ou d’aléa 2026 passe à moins de 3 m de ce terrain.</strong> Les couches 2026 sont <strong>reconstituées à partir de plans PDF</strong> (précision d’environ 3 m) : le classement de ce terrain n’est pas établi avec certitude, ne pas conclure sans la carte officielle et l’arrêté préfectoral n° 2026/00715 du 19 février 2026. Les aléas 2019 sont des données officielles.</div>`:`<p class="note">${B_PAR} Couches 2026 reconstituées à environ 3 m près ; aucune limite 2026 à moins de 3 m de ce terrain : le classement affiché est probable, à confirmer sur la carte officielle. Le niveau d’une parcelle n’est pas déduit d’une seule image.</p>`}`,true);
 {const g=p.arg||0,N=['','faible','moyenne','forte'][g];
  let ar=g?`<p><strong>Exposition au retrait-gonflement des argiles : ${N}</strong> <span class="note">(carte nationale d’exposition du BRGM, interrogée via Géorisques le 12/11/2026 en un point du terrain)</span></p>`:`<p>${B_VER} Exposition non disponible pour ce terrain : <strong>résultat non déterminé</strong>, à vérifier sur Géorisques.</p>`;
  if(g>=2)ar+='<p>Dans les zones d’exposition <strong>moyenne ou forte</strong>, le code de la construction et de l’habitation (art. L. 132-4 et L. 132-5, issus de la loi ELAN de 2018) impose, <strong>pour la vente d’un terrain non bâti constructible</strong> et <strong>pour un contrat de construction d’une maison individuelle</strong>, une étude géotechnique préalable et le respect de techniques de construction adaptées. Texte et arrêté d’application (22 juillet 2020) à confirmer sur Légifrance : '+B_VER+'</p>';
  ar+='<p class="note">Ce n’est <strong>pas une règle du PLU</strong>, ni un plan de prévention : le plan départemental des argiles approuvé le 21 novembre 2018 ne couvre pas Gentilly (règlement du PLUi 1.5.3.2, p. 20). Le tableau de la DRIEAT annexé au PLUi (65,9 % d’aléa faible, 0,25 % fort) est <strong>plus ancien</strong> que la carte nationale actuelle (majoritairement « moyenne ») : l’écart est à vérifier. L’exposition est lue en <strong>un seul point</strong> : près d’une limite d’aléa, le terrain peut être à cheval. '+B_PAR+'</p>';
  h+=sec('Retrait-gonflement des argiles',ar,false)}
 // 9. servitudes, patrimoine et périmètres
 const q=[];
 if(p.bp||p.pat)q.push(`<strong>Bâti patrimonial repéré</strong>${p.pat?` (${p.pat.join(' ; ')})`:''} : l’annexe du règlement compte 54 fiches pour 62 surfaces ; fiche détaillée non lue ici`);
 if(!p.dp||p.dp==='hors')q.push('<strong>Droit de préemption urbain</strong> : la commune urbaine est entièrement concernée (droit de préemption simple ici ; le périmètre renforcé ne couvre pas ce terrain). Zones naturelles exclues.');
 if(p.dp&&p.dp!=='hors')q.push('<strong>Droit de préemption urbain renforcé</strong> : '+({maintenu:'dans le périmètre avant (ancien PLU) et après (PLUi)',entre:'<strong>entre</strong> dans le périmètre avec le PLUi',sort:'<strong>sort</strong> du périmètre avec le PLUi (zone naturelle)'})[p.dp]+' ; voir l’onglet « Droit de préemption »');else if(p.dpu)q.push('<strong>Droit de préemption urbain renforcé</strong> sur ce terrain');
 if(p.sup)q.push('<strong>Servitudes d’utilité publique</strong> dont l’<strong>assiette publiée au Géoportail de l’urbanisme recouvre le terrain</strong> (servitude établie par un acte ; l’assiette est une représentation, l’acte fait foi) :<ul>'+p.sup.map(x=>`<li>${x}${p.supp&&p.supp[x]!=null?` — ${p.supp[x]} % du terrain${p.supp[x]<10?' (<strong>effleure seulement le terrain : résultat non déterminé</strong>)':''}`:''}${/Maison internationale/.test(x)?' <span class="note">(périmètre récent, acte non relu : à vérifier)</span>':''}</li>`).join('')+'</ul><span class="note">Seules les servitudes dont l’assiette recouvre le terrain sont listées : une simple proximité d’un monument historique n’est pas une servitude. Les actes ne sont pas relus un par un : '+B_VER+'</span>');
 if(p.supn)q.push('<strong>Servitudes dont le périmètre passe à moins de 5 m sans recouvrir le terrain</strong> : '+p.supn.join(' ; ')+' — <strong>résultat non déterminé</strong> : l’assiette publiée est approximative, vérifier sur l’acte ou le Géoportail de l’urbanisme.');
 if(p.ap)p.ap.forEach(x=>q.push('<strong>Autre périmètre ou prescription du PLUi</strong> : '+x));
 if(p.sur)q.push('<strong>Sursis à statuer</strong> : périmètre de 19,7 ha');
 if(q.length)h+=sec(`Servitudes, protections et périmètres (${q.length})`,`<ul>${q.map(x=>`<li>${x}</li>`).join('')}</ul>`,false);
 // 10. références et traçabilité
 {const A=REG.RA[p.az],Nn=REG.RN[p.z],man=REG.sources,urlZ=A?(man['plu_2024/'+A.fichier]||{}).url:null,urlP=(man['plui/200058014_reglement_20251216.pdf']||{}).url||'https://www.geoportail-urbanisme.gouv.fr/',cc=Nn&&Nn.conc?Nn.conc:null;
  const lk=(u,t)=>u?`<a href="${u}" target="_blank" rel="noopener">${t}</a>`:t;
  const ok=cc&&cc.h&&cc.e&&cc.pt;
  const ligne=(r,doc,art,pg,gr,lien,fi)=>`<tr><td>${r}</td><td>${doc}</td><td>${art}</td><td>${pg}</td><td>${gr}</td><td>${lien}</td><td>${fi}</td></tr>`;
  const DOCA=A?`PLU de Gentilly, modification n° 6 approuvée le 12/03/2024 — zone ${p.az} (téléchargé le ${(man['plu_2024/'+A.fichier]||{}).telecharge_le||'—'})`:`PLU de Gentilly (mars 2024), zone ${F(p.az)} : <em>zone non relue en détail</em>`;
  const DOCN='PLUi GOSB, règlement écrit approuvé le 16/12/2025, exécutoire le 21/02/2026';
  let t='<table class="refs"><tr><th>Règle</th><th>Document et version</th><th>Article</th><th>Page du PDF</th><th>Prescription graphique</th><th>Lien</th><th>Fiabilité de l’interprétation</th></tr>';
  [['h','Hauteur'],['e','Emprise'],['pt','Pleine terre']].forEach(([k,n])=>{const x=C[k],a=A&&A[k],nn=Nn&&Nn[k];
   t+=ligne(n+' — ancien PLU',DOCA,a?a.art:'—',a&&a.p_pdf_zone?`${a.p_pdf_zone} (zone) ; page imprimée ${a.p_imprimee||'—'}`:'—',k==='h'?((p.ha&&p.ha.length)?'ligne '+p.ha.join(', '):'aucune à moins de 5 m'):'—',lk(urlZ,'PDF de la zone'),a?'texte relu ; exceptions relues à la main':'général seulement (CSV) : à vérifier');
   t+=ligne(n+' — PLUi',DOCN,nn?nn.art:'—',nn?nn.p:'—',k==='h'?(p.hs?'hauteur spécifique '+p.hs:'aucune à moins de 5 m'):'—',lk(urlP,'PDF du règlement'),nn&&nn.txt?(cc&&cc[k]?'relu ; deux lectures concordantes':'<strong>deux lectures divergentes : à vérifier</strong>'):'à vérifier')});
  t+=ligne('Implantation, vues','PLUi (même document) ; ancien PLU art. 6 à 8 et annexe 1','3.1.2.x, 3.1.2.1.1 ; lexique','118 ; 141-142 ou 168-169 ; 397-399','document graphique des implantations',lk(urlP,'PDF du règlement'),'résumé ; comparaison partielle');
  t+=ligne('Plantations','PLUi ; ancien PLU art. 13','3.3.1','350-352','—',lk(urlP,'PDF du règlement'),'relu ; ambiguïté 12 m³ / 2,50 m signalée');
  t+=ligne('Stationnement','PLUi ; ancien PLU titre I art. 3','4.1','358-364 ; plans 25 (p. 6-7)','plans de stationnement',lk(urlP,'PDF du règlement'),'texte et plans relus (valeurs confirmées) ; portée « studios/T1 » à confirmer');
  t+=ligne('Mixité','PLUi','2.2.4.2 à 2.2.4.4','75-78','secteurs GE1 (part du terrain mesurée)',lk(urlP,'PDF du règlement'),'relu ; seuil exact à vérifier');
  t+=ligne('Eaux pluviales','PLUi ; ancien PLU art. 4 et annexe 575','4.3.2-4.3.3','367-372','—',lk(urlP,'PDF du règlement'),'relu ; portée de l’annexe 575 à vérifier');
  t+=ligne('Carrières','Plan de prévention, arrêté préfectoral n° 2026/00715 du 19/02/2026 ; atlas 2019','règlement du plan','16-18','zonage et aléas 2026 reconstitués (≈ 3 m) ; aléas 2019 officiels','—',p.cinc?'<strong>à vérifier (limite proche)</strong>':'probable, à confirmer');
  t+=ligne('Servitudes','Géoportail de l’urbanisme (assiettes SUP)','—','—','assiette recouvrant le terrain','—','assiette officielle ; actes non relus');
  t+='</table>';
  h+=sec('Références, sources et niveau de fiabilité',`<p class="note">Chaque règle importante est reliée à son document, sa version, son article et sa page. Les pages sont celles du fichier PDF (la page imprimée porte un numéro inférieur d’une unité pour le règlement du PLUi). ${ok?'Le décodage du code <code>'+p.z+'</code> a été contrôlé par deux lectures indépendantes (décodage initial et relecture du texte de l’indice) : elles concordent.':'<strong>Le code '+p.z+' n’a pas été contrôlé par deux lectures concordantes : à vérifier.</strong>'}</p>${t}`,false)}
 h+=sec('Notes, sources et limites',`<ul class="note"><li><strong>Règles générales et exceptions</strong> : les trois règles de base sont lues dans le règlement écrit du PLUi (référence indiquée sur chaque ligne) et dans le règlement de l’ancien PLU (articles 9, 10 et 13 de la zone). Les <strong>exceptions</strong> (amélioration de l’existant, petits terrains, adossement, rez-de-chaussée commercial, annexes…) sont comparées séparément ; pour les zones de l’ancien PLU non relues en détail (UI, UZa, UZb, UA2p, N, Ne) seules les règles générales sont comparées. Une règle générale identique ne prouve pas que les droits à construire sont inchangés.</li><li><strong>Zone</strong> : seule la zone majoritaire du terrain est retenue ; un terrain coupé par une limite de zone peut relever de deux régimes.</li><li><strong>Prescriptions sur le plan</strong> : lues dans les couches graphiques du Géoportail de l’urbanisme (PLUi) et dans le paquet de 2019 de l’ancien PLU, rattachées au terrain à moins de 3 à 5 m selon la nature ; la rue ou le terrain voisin peuvent donc être en cause.</li><li><strong>Anciennes carrières</strong> : zonage et aléas 2026 reconstitués à partir des plans du préfet ; précision d’environ 3 m ; le niveau d’une parcelle n’est pas déduit d’une seule image. Aléas 2019 : données officielles de la préfecture.</li><li><strong>Servitudes et périmètres</strong> : Géoportail de l’urbanisme, à vérifier sur les actes.</li><li><strong>Données cadastrales</strong> : cadastre Etalab ; les surfaces peuvent différer de quelques m² de l’acte (important près d’un seuil, par exemple 150 m²).</li><li><strong>Voisinage et hauteur</strong> : au-delà de la hauteur maximale, les règles d’implantation peuvent limiter ce que l’on peut construire. Dans l’ancien PLU, l’article 6.1 de la zone UB2 permettait d’imposer l’implantation dans le prolongement des constructions voisines et l’article 7 fixait des prospects ; les équivalents de l’article 6 du PLUi ne sont pas détaillés ici : à vérifier dans le règlement.</li><li>Le document officiel fait foi ; les mentions « à vérifier » ne sont pas établies avec certitude.</li></ul>`,false);
 h+=`<div class="avert">Règles de base et exceptions principales seulement. Un potentiel réglementaire n'est ni un permis ni un projet. À vérifier sur les documents officiels et auprès d’un professionnel avant toute décision.</div>`;
 return h}
function al(a){const n=['faible','modéré','fort','très fort'];const t=a.map((v,i)=>v?`${n[i]} ${v} %`:'').filter(Boolean);return t.length?t.join(', '):'hors aléa cartographié'}
function choisir(l){if(sel)couche.resetStyle(sel);sel=l;l.setStyle({color:'#000',weight:3});l.bringToFront();document.getElementById('fiche').innerHTML='<button class="imprimer" data-act="imprimer" style="float:right">🖨 Imprimer / PDF</button><button class="retour" data-act="carte">↑ Retour à la carte</button>'+fiche(l.feature.properties)+'<div class="srcimp"><strong>Sources</strong> : règlement et zonage du PLUi Grand-Orly Seine Bièvre (approuvé le 16 décembre 2025, en vigueur le 21 février 2026), Géoportail de l’urbanisme ; PLU de Gentilly (modification n° 6, mars 2024) ; cadastre Etalab ; Base Adresse Nationale ; PPRN anciennes carrières (arrêté préfectoral n° 2026/00715 du 19 février 2026 ; couches 2026 reconstituées à partir des plans PDF, précision limitée) ; atlas des carrières 2019 (préfecture du Val-de-Marne). Édité le '+new Date().toLocaleDateString('fr-FR')+'. Première version, sujette à erreurs : le document officiel fait foi ; les données signalées « à vérifier » ne sont pas établies avec certitude.</div>';if(innerWidth<=1050)document.getElementById('fiche').scrollIntoView({behavior:'smooth',block:'start'})}
// recherche d'adresse
function dseg(p,a,b){const k=Math.cos(48.81*Math.PI/180),px=(p[0]-a[0])*k*111320,py=(p[1]-a[1])*111320,bx=(b[0]-a[0])*k*111320,by=(b[1]-a[1])*111320,l=bx*bx+by*by;let t=l?(px*bx+py*by)/l:0;t=Math.max(0,Math.min(1,t));return Math.hypot(px-t*bx,py-t*by)}
function dans(pt,g){const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;return polys.some(p=>{if(!ray(pt,p[0]))return false;for(let i=1;i<p.length;i++)if(ray(pt,p[i]))return false;return true})}
function ray(pt,r){let d=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const[xi,yi]=r[i],[xj,yj]=r[j];if((yi>pt[1])!==(yj>pt[1])&&pt[0]<(xj-xi)*(pt[1]-yi)/(yj-yi)+xi)d=!d}return d}
let marq=null;
document.getElementById('ok').onclick=async()=>{const q=document.getElementById('adr').value.trim(),r=document.getElementById('res');if(!q){r.textContent='Saisissez une adresse.';return}r.textContent='Recherche…';
 try{const j=await(await fetch('https://api-adresse.data.gouv.fr/search/?q='+encodeURIComponent(q)+'&postcode=94250&limit=1')).json();
  if(!j.features.length){r.textContent='Adresse non trouvée à Gentilly.';return}
  const f=j.features[0],pt=f.geometry.coordinates;let trouve=null,dist=0;couche.eachLayer(l=>{if(!trouve&&dans(pt,l.feature.geometry))trouve=l});
  if(!trouve){let best=1e9;couche.eachLayer(l=>{const g=l.feature.geometry,polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;polys.forEach(p=>p.forEach(r=>{for(let i=0;i<r.length-1;i++){const d=dseg(pt,r[i],r[i+1]);if(d<best){best=d;trouve=l}}}))});if(best>12)trouve=null;else dist=Math.round(best)}
  if(marq)map.removeLayer(marq);marq=L.marker([pt[1],pt[0]]).addTo(map);map.setView([pt[1],pt[0]],18);
  if(trouve){choisir(trouve);r.textContent=f.properties.label+' : '+(dist?'terrain le plus proche ('+dist+' m du point d’adresse) : ':'terrain ')+trouve.feature.properties.id.slice(-5)+' ; vérifier si l’adresse est proche d’une limite.'}else r.textContent=f.properties.label+' : aucun terrain trouvé au point (voie ou domaine public).'}catch(e){r.textContent='Recherche indisponible.'}};


// ===== Numéros de rue (Base adresse nationale) =====
function couchenum(m){
 const g=L.layerGroup();let actif=false;
 function maj(){g.clearLayers();if(!actif||m.getZoom()<17)return;const b=m.getBounds().pad(.05);let n=0;
  for(const a of ADR){if(n>900)break;if(b.contains([a[1],a[0]])){n++;
   g.addLayer(L.marker([a[1],a[0]],{interactive:false,icon:L.divIcon({className:'',html:`<span class="numrue">${a[2]}</span>`,iconSize:[0,0]})}))}}}
 m.on('moveend zoomend',maj);
 return {on(v){actif=v;maj();v?g.addTo(m):m.removeLayer(g)},maj}}


// ===== Liste UB2 -> UM =====

(function(){const tb=document.querySelector('#tubum tbody');if(!tb)return;
 const PM={};P.features.forEach(f=>PM[f.properties.id]=f.properties);
 const lig=UBUM.map(r=>{const q=PM[r[0]],c=MOTEUR.cmp(q,REG),a=x=>x.rows[0].a+' → '+x.rows[0].n;return {r,q,c,h:c.h.rows[0].a.replace(/ \(.*\)/,'')+' → '+c.h.rows[0].n.replace(/ \(.*\)/,''),g:c.h.rows[1]?c.h.rows[1].a+' → '+c.h.rows[1].n:'—',e:a(c.e),p:a(c.pt)}});
 const petits=lig.filter(x=>x.q.s<150),autres=lig.filter(x=>x.q.s>=150);
 const mod=(L,k)=>[...new Set(L.map(x=>x[k]))].join(' ; ');
 document.getElementById('ubumtxt').innerHTML=`Dans l’ancien PLU, la zone <strong>UB2</strong> était la zone pavillonnaire. Pour <strong>${UBUM.length} terrains (1,59 ha)</strong>, le PLUi la remplace par une zone <strong>UM</strong> (indice H) : <strong>faîtage ${mod(lig,'h')}</strong>, égout ou acrotère ${mod(lig,'g')}, pleine terre ${mod(autres,'p')}. <strong>Emprise au sol : ${mod(autres,'e')} pour les ${autres.length} terrains de 150 m² ou plus</strong>${petits.length?` ; <strong>${mod(petits,'e')} pour les ${petits.length} terrains de moins de 150 m²</strong> (l’ancienne zone UB2 autorisait 80 % sous 150 m², la zone UM n’a pas cette règle : <strong>c’est une diminution</strong>, pas une augmentation ; pleine terre de ces petits terrains : ${mod(petits,'p')})`:''}. Le règlement UM (indice H, art. 3.1.7.4, p. 299) ajoute une <strong>possibilité conditionnelle jusqu’à 15 m</strong> (un étage supplémentaire) si la construction <strong>s’adosse de part et d’autre à des bâtiments voisins en bon état et plus hauts</strong> (absente de l’ancienne zone UB2). Le détail (exceptions, annexes, amélioration du bâti) est dans la fiche de chaque terrain.`;
 tb.innerHTML=lig.map(x=>`<tr><td><a href="#" data-id="${x.r[0]}">${x.r[1]}</a></td><td>${x.r[2]||'—'}</td><td>${(+x.r[3]).toLocaleString('fr-FR')} m²</td><td>${x.h}</td><td>${x.g}</td><td>${x.e}</td><td>${x.p}</td><td>${NIVL2[MOTEUR.nivGlobal(x.c)]}</td></tr>`).join('');
 tb.onclick=e=>{const a=e.target.closest('a[data-id]');if(!a)return;e.preventDefault();document.querySelector('button[data-p="pc"]').click();setTimeout(()=>{let l;couche.eachLayer(x=>{if(x.feature.properties.id===a.dataset.id)l=x});if(l){choisir(l);map.fitBounds(l.getBounds(),{maxZoom:19})}},150)};
 document.getElementById('csvubum').onclick=()=>{const L=['parcelle;adresses;surface_m2;faitage_ancien_vers_PLUi;egout_ancien_vers_PLUi;emprise_ancien_vers_PLUi;pleine_terre_ancien_vers_PLUi'].concat(lig.map(x=>[x.r[0],x.r[2],x.r[3],x.h,x.g,x.e,x.p].join(';')));
  const b=new Blob(['\ufeff'+L.join('\n')],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='gentilly_UB2_vers_UM.csv';a.click()};
})();
// ===== Onglet droit de préemption renforcé =====
let md=null,dcalque=null,dparc=null;
function initD(){
 if(md){md.invalidateSize();return}
 md=L.map('md',{scrollWheelZoom:true}).setView([48.8135,2.3455],14);
 L.tileLayer('https://data.geopf.fr/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',{maxZoom:18,attribution:'Fond : © IGN (Plan IGN)'}).addTo(md);
 dparc=L.geoJSON(P,{style:()=>({color:'#243',weight:.5,fill:false}),interactive:false});
 document.getElementById('dp').onchange=e=>e.target.checked?dparc.addTo(md):md.removeLayer(dparc);
 document.querySelectorAll('input[name=dl]').forEach(e=>e.onchange=majD);majD();
 const S=DPUS,pc=(a,b)=>`${a.toString().replace('.',',')} ha (${b.toString().replace('.',',')} % de la commune)`;
 document.getElementById('dstats').innerHTML=`<h2>En chiffres</h2><table><tr><th></th><th>Ancien PLU</th><th>PLUi</th></tr><tr><td>Périmètre</td><td>${pc(S.ancien.ha,S.ancien.pct)}</td><td>${pc(S.nouveau.ha,S.nouveau.pct)}</td></tr><tr><td>Terrains concernés</td><td>${S.parcelles.ancien}</td><td>${S.parcelles.nouveau}</td></tr></table><p class="note">${S.retire_ha.toString().replace('.',',')} ha sortent (${S.parcelles.sortent} terrains), ${S.ajoute_ha.toString().replace('.',',')} ha entrent (${S.parcelles.entrent} terrains) : le périmètre est <strong>quasi stable</strong>. Terrains comptés lorsque plus de la moitié de leur surface est dans le périmètre.</p>`;
 const O=S.oap,lib=Object.entries(O).map(([n,v])=>`<li>${n} : ${v.part_dans_dpur_nouveau_pct} % du secteur d’OAP dans le périmètre</li>`).join('');
 document.getElementById('dsect').innerHTML=`<h2>Les secteurs cités par la délibération</h2><p class="note">La délibération du 16 décembre 2025 motive le droit renforcé à Gentilly par six secteurs :</p><ul><li><strong>Centre-ville</strong> : centralités avec commerces et services, entrée de ville par la rue Albert-Guilpin, parc Picasso, réouverture de la Bièvre « par endroits »</li><li><strong>Avenue Paul-Vaillant-Couturier</strong> : réduire les coupures des infrastructures, requalifier l’avenue, accès aux gares</li><li><strong>Îlot rue de la Paix / rue de Reims</strong> : friche au cœur du Plateau, polarité autour de la gare sud du RER B, espace vert</li><li><strong>Gabriel Péri</strong> : programmes mixtes, nouveau groupe scolaire, espaces publics</li><li><strong>Porte de Gentilly</strong> : requalifier l’entrée de ville en place végétalisée</li></ul><p class="note">Part de chaque secteur d’OAP couverte :</p><ul>${lib}</ul><p class="note">La délibération cite aussi des lots de copropriété de plus de dix ans et des locaux d’activités détenus par des sociétés comme motifs.</p>`;
 setTimeout(()=>md.invalidateSize(),100)}
function majD(){if(dcalque)md.removeLayer(dcalque);const v=document.querySelector('input[name=dl]:checked').value;
 const st=(c,o)=>({color:c,weight:.8,fillColor:c,fillOpacity:o});
 if(v==='nouveau'){dcalque=L.geoJSON(DPU.dpur_nouveau,{style:()=>st('#2f6db5',.35),interactive:false});document.getElementById('cled').innerHTML='<span><span class="pastille" style="background:#2f6db5"></span> périmètre du PLUi</span>'}
 else if(v==='ancien'){dcalque=L.geoJSON(DPU.dpur_ancien,{style:()=>st('#6f8fbf',.35),interactive:false});document.getElementById('cled').innerHTML='<span><span class="pastille" style="background:#6f8fbf"></span> périmètre de l’ancien PLU</span>'}
 else{dcalque=L.layerGroup([L.geoJSON(DPU.dpur_nouveau,{style:()=>({color:'#2f6db5',weight:0,fillColor:'#2f6db5',fillOpacity:.12}),interactive:false}),L.geoJSON(DPU.dpur_retire,{style:()=>st('#8a5cc2',.75),interactive:false}),L.geoJSON(DPU.dpur_ajoute,{style:()=>st('#d9822b',.75),interactive:false})]);document.getElementById('cled').innerHTML='<span><span class="pastille" style="background:#8a5cc2"></span> sort du périmètre (1,6 ha)</span><span><span class="pastille" style="background:#d9822b"></span> entre dans le périmètre (1,1 ha)</span><span><span class="pastille" style="background:#9db5d9"></span> inchangé</span>'}
 dcalque.addTo(md)}
// ===== Comparateur carrières 2019 / 2026 (curseur) =====
let mk=null;
function initK(){
 if(mk){mk.invalidateSize();clipK();return}
 mk=L.map('mk',{scrollWheelZoom:true}).setView([48.8135,2.3455],14);
 L.tileLayer('https://data.geopf.fr/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',{maxZoom:18,attribution:'Fond : © IGN (Plan IGN)'}).addTo(mk);
 mk.createPane('p19');mk.createPane('p26');mk.createPane('pz');mk.getPane('pz').style.zIndex=450;mk.getPane('p19').style.zIndex=410;mk.getPane('p26').style.zIndex=411;
 const sv=(pane)=>L.svg({pane});
 const mkc=(d,pane)=>L.geoJSON(d,{pane,renderer:sv(pane),style:f=>({color:COULC[f.properties.niveau],weight:.4,fillColor:COULC[f.properties.niveau],fillOpacity:.62}),interactive:false}).addTo(mk);
 mkc(C.a2019,'p19');mkc(C.a2026,'p26');
 window.kz=L.geoJSON(C.zonage,{pane:'pz',renderer:sv('pz'),style:f=>({color:COULC[f.properties.zone],weight:1.8,fillColor:COULC[f.properties.zone],fillOpacity:.3}),interactive:false});
 window.kp=L.geoJSON(P,{pane:'pz',renderer:sv('pz'),style:()=>({color:'#243',weight:.6,fill:false}),interactive:false});
 document.getElementById('kz').onchange=e=>e.target.checked?kz.addTo(mk):mk.removeLayer(kz);
 document.getElementById('kp').onchange=e=>e.target.checked?kp.addTo(mk):mk.removeLayer(kp);
 numK=couchenum(mk);document.getElementById('kn').onchange=e=>numK.on(e.target.checked);
 document.getElementById('curseur').oninput=clipK;mk.on('move zoom resize',clipK);clipK();
 mk.on('click',e=>pointK(e.latlng));
 document.getElementById('clek').innerHTML='<div class="note" style="width:100%"><strong>Aléas (niveau de risque)</strong></div>'+['faible','modere','fort','tres_fort'].map(k=>`<span><span class="pastille" style="background:${COULC[k]}"></span> ${LIBK[k]} — ${RISQ[k]}</span>`).join('')+'<div class="note" style="width:100%;margin-top:6px"><strong>Zonage réglementaire (contour épais)</strong></div>'+['bleue','rouge','rouge_hachure'].map(k=>`<span><span class="pastille" style="background:${COULC[k]}"></span> ${LIBK[k]} — ${RISQ[k]}</span>`).join('');
 setTimeout(()=>{mk.invalidateSize();clipK()},120)}
const LIBK={faible:'Aléa faible',modere:'Aléa modéré',fort:'Aléa fort',tres_fort:'Aléa très fort',bleue:'Zone bleue',rouge:'Zone rouge',rouge_hachure:'Zone rouge hachuré'};
function clipK(){const sz=mk.getSize(),v=+document.getElementById('curseur').value/100,x=v*sz.x;
 const nw=mk.containerPointToLayerPoint([0,0]),se=mk.containerPointToLayerPoint(sz),mid=mk.containerPointToLayerPoint([x,0]).x;
 mk.getPane('p19').style.clip=`rect(${nw.y}px,${mid}px,${se.y}px,${nw.x}px)`;
 mk.getPane('p26').style.clip=`rect(${nw.y}px,${se.x}px,${se.y}px,${mid}px)`;
 document.getElementById('ligne').style.left=`calc(${v*100}% - 1.5px)`}
let mkm=null;
function niv(pt,d,c){return d.features.filter(f=>dans(pt,f.geometry)).map(f=>f.properties[c])}
function pointK(ll){const pt=[ll.lng,ll.lat];
 const a9=niv(pt,C.a2019,'niveau'),a6=niv(pt,C.a2026,'niveau'),z=niv(pt,C.zonage,'zone');
 const cle=q=>JSON.stringify([niv(q,C.a2019,'niveau'),niv(q,C.a2026,'niveau'),niv(q,C.zonage,'zone')]);const ref=cle(pt);let proche=false;
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[.7,.7],[-.7,.7],[.7,-.7],[-.7,-.7]]){if(cle([pt[0]+dx*0.00009,pt[1]+dy*0.00006])!==ref){proche=true;break}}
 const nm=k=>k.length?k.map(x=>LIBK[x]).join(', '):'hors zone cartographiée';
 if(mkm)mk.removeLayer(mkm);mkm=L.circleMarker(ll,{radius:6,color:'#000',weight:2,fillColor:'#fff',fillOpacity:1}).addTo(mk);document.getElementById('kmini').innerHTML='<strong>Au point cliqué :</strong> 2019 : '+nm(a9)+' · 2026 : '+nm(a6)+' · plan : '+nm(z)+(proche?' <strong>(près d’une limite : ne pas conclure)</strong>':'');
 let terrain=null;couche.eachLayer(l=>{if(!terrain&&dans(pt,l.feature.geometry))terrain=l.feature.properties});
 document.getElementById('fk').innerHTML=`<h2>Au point cliqué</h2><ul style="margin:4px 0 0 18px;padding:0"><li>Aléas 2019 : <strong>${nm(a9)}</strong></li><li>Aléas 2026 : <strong>${nm(a6)}</strong></li><li>Zonage du plan 2026 : <strong>${nm(z)}</strong></li></ul>${terrain?`<p class="note">Terrain ${terrain.id.slice(-5)} (${terrain.s} m²) : voir la fiche dans « La carte ».</p>`:''}${proche?'<div class="avert"><strong>Attention :</strong> ce point est à moins de 6 à 8 m d’une limite de zone ou de niveau. Les couches 2026 sont reconstituées à environ 3 m près : ne pas conclure, vérifier sur la carte officielle.</div>':''}<p class="note">Position du point cliqué, non du terrain entier.</p>`}
// blocs repliables sur petit écran (dynamique : suit la largeur de la fenêtre)
const mq=matchMedia('(max-width:1050px)');
['bCol','bAjo'].forEach(id=>{const b=document.getElementById(id),h=b.querySelector('h2');h.insertAdjacentHTML('beforeend',' <span class="note hint">(toucher pour réduire ou ouvrir)</span>');h.onclick=()=>{if(document.body.classList.contains('compact'))b.classList.toggle('ferme')}});
let etatCompact=null;
function compact(){const c=matchMedia('(max-width:1050px)').matches;if(c===etatCompact)return;etatCompact=c;document.body.classList.toggle('compact',c);['bCol','bAjo'].forEach(id=>document.getElementById(id).classList.remove('ferme'))}
mq.addEventListener('change',compact);addEventListener('resize',compact);compact();
// onglets

document.getElementById('gq').oninput=e=>{const nf=x=>x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');const q=nf(e.target.value);let n=0;document.querySelectorAll('#pg .gl').forEach(d=>{const ok=!q||nf(d.textContent).includes(q);d.style.display=ok?'':'none';if(ok)n++});document.querySelectorAll('#pg .gt').forEach(h=>{let x=h.nextElementSibling,v=false;while(x&&x.classList.contains('gl')){if(x.style.display!=='none')v=true;x=x.nextElementSibling}h.style.display=v?'':'none'});document.getElementById('gn').textContent=q?(n+' résultat'+(n>1?'s':'')):''};
function versGloss(id){document.querySelector('button[data-p="pg"]').click();setTimeout(()=>{const el=document.getElementById(id);if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('cible');setTimeout(()=>el.classList.remove('cible'),2500)}},60)}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button').forEach(x=>x.setAttribute('aria-selected',x===b));document.querySelectorAll('.pan').forEach(p=>p.classList.toggle('on',p.id===b.dataset.p));if(b.dataset.p==='pc')setTimeout(()=>map.invalidateSize(),50);if(b.dataset.p==='pk')setTimeout(initK,60);if(b.dataset.p==='pd')setTimeout(initD,60)});
// chiffres
(function(){const F=P.features.map(f=>f.properties),T=F.length,n=(k,v)=>F.filter(q=>q[k]===v).length,ha=(k,v)=>F.filter(q=>q[k]===v).reduce((a,q)=>a+q.s,0)/1e4,pc=x=>(Math.round(1000*x/T)/10).toLocaleString('fr-FR')+' %',fr=x=>x.toLocaleString('fr-FR',{maximumFractionDigits:1});
 const petits=F.filter(q=>q.az==='UB2'&&/^UM/.test(q.z)&&q.s<150&&q.xe==='baisse').length;
 STATS2=[{t:'Hauteur maximale (règle générale)',v:pc(n('xh','inchangée'))+' inchangée',d:`${pc(n('xh','baisse'))} en baisse, ${pc(n('xh','hausse'))} en hausse, ${n('xh','non comparable')} non comparables, ${n('xh','non déterminé')} non déterminés (terrains à cheval sur plusieurs zones)`},
  {t:'Emprise au sol (règle générale)',v:pc(n('xe','inchangée'))+' inchangée',d:`${n('xe','hausse')} en hausse, ${n('xe','baisse')} en baisse ; les exceptions (annexes, petits terrains, amélioration) sont comparées dans chaque fiche ; ${n('xe','non déterminé')} non déterminés (terrains à cheval)`},
  {t:'Pleine terre (règle générale)',v:pc(n('xp','inchangée'))+' inchangée',d:`${n('xp','non comparable')} non comparables (règle de l’ancienne zone portant sur les espaces libres ou qualitative), ${n('xp','mixte')} mixtes`},
  STATS[3]];
 const li=(id,h)=>{const e=document.getElementById(id);if(e)e.innerHTML=h};
 li('rt-h',`<strong>Hauteur</strong> : <strong>${n('xh','baisse')} terrains en baisse</strong> (${fr(ha('xh','baisse'))} ha), notamment l’ancien centre-ville (21 m → 18 m) ; <strong>${n('xh','hausse')} terrains en hausse</strong> (${fr(ha('xh','hausse'))} ha), surtout une partie de l’ancienne zone pavillonnaire passée en zone mixte (9,5 m → 12 m).`);
 li('rt-e',`<strong>Emprise au sol</strong> : règle générale identique pour ${pc(n('xe','inchangée'))} des terrains ; ${n('xe','hausse')} hausses et ${n('xe','baisse')} baisses${petits?` (dont ${petits} petits terrains de moins de 150 m² passés de l’ancienne zone UB2 à la zone UM : 80 % → 55 %)`:''}. Les exceptions (annexe unique de 9 m², amélioration du bâti) diffèrent presque partout : voir la fiche.`);
 li('rt-p',`<strong>Pleine terre</strong> : ${pc(n('xp','inchangée'))} des terrains inchangés, ${n('xp','moins exigeante')} moins exigeants, ${n('xp','mixte')} mixtes, ${n('xp','non comparable')} non comparables (anciens grands ensembles : ancien calcul sur les espaces libres).`)})();
document.getElementById('stats').innerHTML=STATS2.map(s=>`<div class="carte4"><span class="note">${s.t}</span><strong>${s.v}</strong><span class="note">${s.d}</span></div>`).join('');
// ouverture directe d'une fiche (contrôles et PDF) : index.html?fiche=D63
(function(){const m=/[?&#]fiche=([A-Za-z]+\d+)/.exec(location.href);if(!m)return;const id=m[1].toUpperCase();couche.eachLayer(l=>{const q=l.feature.properties;if(q.s_+q.n_===id){choisir(l);document.querySelectorAll('#fiche details').forEach(d=>d.open=true)}})})();
document.addEventListener('click',e=>{const a=e.target.closest('[data-act]');if(!a)return;const t=a.dataset.act;if(t==='imprimer')imprimerFiche();else if(t==='carte')document.getElementById('cMap').scrollIntoView({behavior:'smooth'})});
