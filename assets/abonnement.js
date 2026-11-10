/* Inscription facultative aux informations (adresse e-mail), partagée par l'accueil et le relevé.
   L'adresse est enregistrée dans un onglet à part de la feuille Google : jamais liée aux réponses du relevé,
   jamais publiée. Désinscription immédiate (type « desabonne »), effacement sous 30 jours. Aucune case n'est cochée d'avance ; au moins une est nécessaire pour s'inscrire. */
(function () {
  "use strict";
  const CONFIG = window.CONFIG || {};
  const zones = document.querySelectorAll("[data-abonnement]");
  if (!zones.length) return;
  if (!CONFIG.collecte) { zones.forEach((z) => (z.hidden = true)); return; }
  const EN_LIGNE = CONFIG.desinscription_en_ligne === true;
  let n = 0;
  zones.forEach((zone) => {
    const id = `abo${++n}`;
    zone.innerHTML = `<form class="form-abonnement">
      <h2>Rester informé (facultatif)</h2>
      <p>Laissez votre adresse e-mail si vous souhaitez être prévenu. Elle ne sert pas à répondre au relevé et n'est jamais publiée.</p>
      <label for="${id}-mail">Adresse e-mail</label>
      <input type="email" id="${id}-mail" autocomplete="email" maxlength="120" placeholder="prenom.nom@exemple.fr">
      <label class="case"><input type="checkbox" name="resultats"> Être prévenu(e) de la publication des résultats et des mises à jour de l'observatoire</label>
      <label class="case"><input type="checkbox" name="bien_commun"> Recevoir aussi les informations de l'association Bien Commun pour Gentilly, y compris ses prises de position</label>
      <p class="note">Ces deux choix sont séparés : la première case ne vous inscrit pas aux communications de l'association.</p>
      <button type="submit" class="bouton">M'inscrire</button> <span class="note etat"></span>
      <p class="note">Responsable : l'association Bien Commun pour Gentilly. Votre adresse, la date et vos choix sont enregistrés, jamais publiés, ni vendus, ni transmis. Vous pouvez vous désinscrire à tout moment, avec effet immédiat, ${EN_LIGNE ? "ci-dessous ou en écrivant à" : "en écrivant à"}
        <a href="mailto:biencommunpourgentilly@gmail.com">biencommunpourgentilly@gmail.com</a> ; l'adresse est effacée dans les 30 jours. <a href="confidentialite.html">Confidentialité</a></p>
    </form>
    ${EN_LIGNE ? `<details class="desinscription"><summary>Se désinscrire</summary>
      <form class="form-desinscription">
        <label for="${id}-mail-off">Adresse e-mail à désinscrire</label>
        <input type="email" id="${id}-mail-off" autocomplete="email" maxlength="120">
        <button type="submit" class="bouton contour-bleu">Me désinscrire</button> <span class="note etat-off" role="status"></span>
      </form>
    </details>` : ""}`;
    const form = zone.querySelector(".form-abonnement");
    const formOff = zone.querySelector(".form-desinscription");
    const etatOff = formOff && formOff.querySelector(".etat-off");
    if (formOff) formOff.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = formOff.querySelector("input[type=email]").value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { etatOff.textContent = "Adresse e-mail non valide."; return; }
      etatOff.textContent = "Envoi…";
      try {
        const rep = await fetch(CONFIG.collecte, { method: "POST", body: JSON.stringify({ type: "desabonne", email }) });
        const d = await rep.json();
        if (!d.ok) throw new Error(d.erreur);
        formOff.reset();
        etatOff.textContent = "C'est fait : vous ne recevrez plus rien. Votre adresse sera effacée dans les 30 jours.";
      } catch (err) {
        etatOff.textContent = "La désinscription a échoué : écrivez à biencommunpourgentilly@gmail.com, nous la ferons aussitôt.";
      }
    });
    const etat = form.querySelector(".etat");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = form.querySelector("input[type=email]").value.trim();
      const resultats = form.querySelector("[name=resultats]").checked;
      const bienCommun = form.querySelector("[name=bien_commun]").checked;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { etat.textContent = "Adresse e-mail non valide."; return; }
      if (!resultats && !bienCommun) { etat.textContent = "Cochez au moins une case pour vous inscrire."; return; }
      etat.textContent = "Envoi…";
      try {
        const rep = await fetch(CONFIG.collecte, { method: "POST", body: JSON.stringify({ type: "abonne", email, resultats, bien_commun: bienCommun, source: location.pathname.split("/").pop() || "accueil" }) });
        const d = await rep.json();
        if (!d.ok) throw new Error(d.erreur);
        form.reset();
        etat.textContent = "Merci, vous êtes inscrit(e).";
      } catch (e) {
        etat.textContent = "L'inscription a échoué, réessayez plus tard.";
      }
    });
  });
})();
