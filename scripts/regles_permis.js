// Règles d'urbanisme actuelles (PLUi) des parcelles citées par les permis : génère data/regles_urbanisme.js.
// Copié dans le dépôt de l'observatoire par scripts/export_observatoire.py (scripts/regles_permis.js) ; aucune dépendance (Node 18+).
// Entrées : data/permis.json, data/urbanisme_donnees.js (parcelles et règles), assets/urbanisme-moteur.js (même moteur que la page Urbanisme).
// Usage : node scripts/regles_permis.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.resolve(__dirname, '..');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(R, 'data/urbanisme_donnees.js'), 'utf8').replace(/^const /gm, 'var '), ctx);
const { P, REG, NATURE } = ctx;
const M = require(path.join(R, 'assets/urbanisme-moteur.js'));
const permis = JSON.parse(fs.readFileSync(path.join(R, 'data/permis.json'), 'utf8')).permis;
const par = {};
P.features.forEach(f => { const q = f.properties; par[q.s_ + ' ' + q.n_] = q; });
const cles = [...new Set(permis.flatMap(p => p.parcelles))];
const NIV = { f: 'comparaison fiable', p: 'comparaison partielle', v: 'à vérifier' };
const ARG = ['non disponible', 'faible', 'moyenne', 'forte'];
const out = {}; let trouves = 0;
for (const k of cles) {
  const q = par[k]; if (!q) continue; trouves++;
  const c = M.cmp(q, REG);
  const ex = [];
  ['h', 'e', 'pt'].forEach(kk => c[kk].exn.forEach(l => ex.push(l.t.replace(/ \(.*$/, ''))));
  const zr = q.zr || [0, 0, 0];
  const car = zr[0] || zr[1] ? (zr[0] >= zr[1] ? 'rouge' : 'rouge hachuré') : zr[2] > 50 ? 'bleue' : zr[2] > 0 ? 'bleue (partielle)' : 'hors zonage';
  out[k] = {
    id: q.s_ + q.n_, s: q.s, z: q.dz || q.z, zc: q.z, nat: NATURE[q.z] || '', az: q.az || '',
    h: c.h.rows[0].n.replace(/ \(.*\)/, '') + (c.h.rows[1] ? ' (au faîtage) ; ' + c.h.rows[1].n.replace(/ \(.*\)/, '') + ' à l’égout ou à l’acrotère' : ''),
    e: c.e.rows[0].n, ea: c.e.rows[1] ? c.e.rows[1].n : null, pt: c.pt.rows[0].n,
    ev: { h: c.h.label, e: c.e.label, pt: c.pt.label },
    niv: NIV[M.nivGlobal(c)], ch: q.ch ? 1 : 0, zp: q.zp,
    car, cinc: q.cinc ? 1 : 0, arg: ARG[q.arg || 0], sup: (q.sup || []).length, supn: (q.supn || []).length,
    pk: q.p5 ? 1 : 0, mxs: q.mxs || 0, exc: ex
  };
}
const dateGen = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(R, 'data/regles_urbanisme.js'), '/* Règles d\'urbanisme actuelles (PLUi en vigueur depuis le 21/02/2026) des parcelles citées par les permis. Généré le ' + dateGen + ' par scripts/regles_permis.js. Ne pas modifier à la main. */\nwindow.REGLES_URBANISME = ' + JSON.stringify(out) + ';\n');
console.log(trouves + '/' + cles.length + ' parcelles retrouvées dans les règles ; ' + Object.keys(out).length + ' fiches écrites.');
