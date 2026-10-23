/* Mesure d'audience GoatCounter, sans cookie ni donnée personnelle. Inactive tant que
   data/config.js ne contient pas de code. Pour ne pas vous compter vous-même, ouvrez une fois
   le site avec #toggle-goatcounter à la fin de l'adresse. */
(function () {
  "use strict";
  const code = (window.CONFIG || {}).goatcounter;
  if (!code) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.js";
  s.dataset.goatcounter = `https://${code}.goatcounter.com/count`;
  document.head.appendChild(s);
  const mention = document.getElementById("mention-audience");
  if (mention) mention.hidden = false;
})();
