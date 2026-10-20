/**
 * Collecte des réponses du relevé de la pleine terre et des commentaires de l'Observatoire.
 *
 * Installation (une seule fois, avec le compte Google du groupe) : voir collecte/LISEZMOI.md.
 * - Les réponses arrivent dans l'onglet « Releve », les commentaires dans « Commentaires ».
 * - Un commentaire n'est publié sur le site que si la case « publie » est cochée (modération).
 * - Le site récupère chaque nuit les réponses et les commentaires publiés, avec une clé secrète.
 */

const LIMITE_REPONSES_PAR_ENVOI = 300;
const LIMITE_TEXTE = 1500;

function installer() {
  const ss = SpreadsheetApp.getActive();
  const releve = ss.getSheetByName('Releve') || ss.insertSheet('Releve');
  if (releve.getLastRow() === 0) releve.appendRow(['recu_le', 'participant_id', 'pseudo', 'terrain', 'reponse_json']);
  const com = ss.getSheetByName('Commentaires') || ss.insertSheet('Commentaires');
  if (com.getLastRow() === 0) com.appendRow(['recu_le', 'id', 'permis', 'pseudo', 'texte', 'publie']);
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('CLE_EXPORT')) props.setProperty('CLE_EXPORT', Utilities.getUuid());
  Logger.log('Clé à copier dans GitHub (secret RELEVE_CLE) : ' + props.getProperty('CLE_EXPORT'));
}

/** Inscriptions aux informations : onglet privé, jamais renvoyé par doGet ni publié sur le site. */
function creerAbonnes(ss) {
  const f = ss.insertSheet('Abonnes');
  f.appendRow(['recu_le', 'email', 'resultats_observatoire', 'infos_bien_commun', 'source']);
  return f;
}

function repondre(objet) {
  return ContentService.createTextOutput(JSON.stringify(objet)).setMimeType(ContentService.MimeType.JSON);
}

function texte(v, max) {
  return String(v == null ? '' : v).slice(0, max || 200);
}

function doPost(e) {
  let d;
  try {
    d = JSON.parse(e.postData.contents);
  } catch (err) {
    return repondre({ ok: false, erreur: 'format' });
  }
  const verrou = LockService.getScriptLock();
  verrou.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActive();
    const maintenant = new Date();
    if (d.type === 'releve' && Array.isArray(d.reponses)) {
      const lignes = d.reponses.slice(0, LIMITE_REPONSES_PAR_ENVOI).map(function (r) {
        return [maintenant, texte(d.participant_id, 60), texte(d.pseudo, 40), texte(r.terrain, 120), texte(JSON.stringify(r), 20000)];
      });
      if (lignes.length) {
        const f = ss.getSheetByName('Releve');
        f.getRange(f.getLastRow() + 1, 1, lignes.length, 5).setValues(lignes);
      }
      return repondre({ ok: true, recues: lignes.length });
    }
    if (d.type === 'commentaire' && d.texte && d.permis) {
      const f = ss.getSheetByName('Commentaires');
      f.appendRow([maintenant, Utilities.getUuid(), texte(d.permis, 40), texte(d.pseudo, 40), texte(d.texte, LIMITE_TEXTE), false]);
      f.getRange(f.getLastRow(), 6).insertCheckboxes();
      return repondre({ ok: true });
    }
    if (d.type === 'abonne') {
      const adresse = texte(d.email, 120).trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adresse) || (!d.resultats && !d.bien_commun)) return repondre({ ok: false, erreur: 'donnees' });
      const f = ss.getSheetByName('Abonnes') || creerAbonnes(ss);
      const lignes = f.getLastRow() > 1 ? f.getRange(2, 2, f.getLastRow() - 1, 1).getValues() : [];
      const ligne = lignes.findIndex(function (l) { return String(l[0]).toLowerCase() === adresse; });
      const valeurs = [maintenant, adresse, !!d.resultats, !!d.bien_commun, texte(d.source, 40)];
      if (ligne >= 0) f.getRange(ligne + 2, 1, 1, 5).setValues([valeurs]);  // une seule ligne par adresse : le dernier choix l'emporte
      else f.appendRow(valeurs);
      return repondre({ ok: true });
    }
    return repondre({ ok: false, erreur: 'type' });
  } finally {
    verrou.releaseLock();
  }
}

function doGet(e) {
  const cle = PropertiesService.getScriptProperties().getProperty('CLE_EXPORT');
  if (!cle || !e.parameter || e.parameter.cle !== cle) return repondre({ ok: false, erreur: 'cle' });
  const ss = SpreadsheetApp.getActive();
  const lire = function (nom) {
    const v = ss.getSheetByName(nom).getDataRange().getValues();
    const entetes = v.shift();
    return v.map(function (ligne) {
      const o = {};
      entetes.forEach(function (h, i) { o[h] = ligne[i] instanceof Date ? ligne[i].toISOString() : ligne[i]; });
      return o;
    });
  };
  const commentaires = lire('Commentaires').filter(function (c) { return c.publie === true; })
    .map(function (c) { return { id: c.id, permis: c.permis, pseudo: c.pseudo, texte: c.texte, date: c.recu_le }; });
  return repondre({ ok: true, releve: lire('Releve'), commentaires: commentaires });
}
