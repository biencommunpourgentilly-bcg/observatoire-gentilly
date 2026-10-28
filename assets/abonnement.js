/* Inscription facultative aux informations (adresse e-mail), partagée par l'accueil et le relevé.
   L'adresse est enregistrée dans un onglet à part de la feuille Google : jamais liée aux réponses du relevé,
   jamais publiée. Aucune case n'est cochée d'avance ; au moins une est nécessaire pour s'inscrire. */
(function () {
  "use strict";
  const CONFIG = window.CONFIG || {};
  const zones = document.querySelectorAll("[data-abonnement]");
  if (!zones.length) return;
  if (!CONFIG.collecte) { zones.forEach((z) => (z.hidden = true)); return; }
  let n = 0;
  zones.forEach((zone) => {
    const id = `abo${++n}`;
    zone.innerHTML = `<form class="form-abonnement">
      <h2>Rester informé (facultatif)</h2>
      <p>Laissez votre adresse e-mail si vous souhaitez être prévenu. Elle ne sert pas à répondre au relevé et n'est jamais publiée.</p>
      <label for="${id}-mail">Adresse e-mail</label>
      <input type="email" id="${id}-mail" autocomplete="email" maxlength="120" placeholder="prenom.nom@exemple.fr">
      <label class="case"><input type="checkbox" name="resultats"> Être prévenu(e) de la publication des résultats de l'observatoire</label>
      <label class="case"><input type="checkbox" name="bien_commun"> Recevoir aussi les informations du Bien Commun pour Gentilly (groupe d'élus municipaux d'opposition)</label>
      <button type="submit" class="bouton">M'inscrire</button> <span class="note etat"></span>
      <p class="note">Responsable : Bien Commun pour Gentilly. Votre adresse est conservée jusqu'à votre désinscription, et vous pouvez la retirer à tout moment en écrivant à
        <a href="mailto:biencommunpourgentilly@gmail.com">biencommunpourgentilly@gmail.com</a>. Elle n'est ni vendue ni transmise. <a href="index.html#a-propos">Détails</a></p>
    </form>`;
    const form = zone.querySelector("form");
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
