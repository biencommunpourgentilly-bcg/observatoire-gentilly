/* Mise en forme des adresses Sitadel (en majuscules, parfois tronquées), partagée par le site et le relevé. */
(function () {
  "use strict";
  // Adresses Sitadel en majuscules, parfois tronquées → forme lisible (« 9 RUE D ARCUEIL » → « 9 rue d'Arcueil »).
  const CORRECTIONS = [
    [/\bPAUL VAILL[A-Z]*(?:[ -]COUT[A-Z]*)?/g, "PAUL VAILLANT-COUTURIER"],
    [/\bRAYMOND LEFEB[A-Z]*/g, "RAYMOND LEFEBVRE"],
    [/\bMOULIN DE LA R[A-Z]*/g, "MOULIN DE LA ROCHE"],
    [/\bARCEUIL\b/g, "ARCUEIL"],
    [/\b(?:AVENUR|AVENU|AVNUE|AVE|AV)\b\.?/g, "AVENUE"],
    [/\bBD\b/g, "BOULEVARD"],
    [/\bIMP\b/g, "IMPASSE"],
    [/\bR\b(?= )/g, "RUE"],
    [/\bSTE\b/g, "SAINTE"],
    [/\bLE LA\b/g, "DE LA"],
    [/\b(\d+) ?EME\b/g, "$1E"],
    [/\b(\d+) ?B\b/g, "$1 BIS"],
    [/\b(\d+) ?T\b/g, "$1 TER"],
    [/(\d) A (\d)/g, "$1 À $2"],
    [/\b([DL]) (?=[AEIOUYH])/g, "$1'"],
  ];
  const ACCENTS = {
    PERI: "PÉRI", LENINE: "LÉNINE", FREROT: "FRÉROT", HELENE: "HÉLÈNE", REPUBLIQUE: "RÉPUBLIQUE",
    PRESIDENT: "PRÉSIDENT", TENINE: "TÉNINE", BENOIT: "BENOÎT", CLEMENT: "CLÉMENT", JAURES: "JAURÈS",
    ELYSEES: "ÉLYSÉES", REMOND: "RÉMOND", ECU: "ÉCU", ELOI: "ÉLOI", LURCAT: "LURÇAT", ILOT: "ÎLOT",
    RENE: "RENÉ", VAILLANT: "VAILLANT",
  };
  const MINUSCULES = new Set(["rue", "avenue", "boulevard", "place", "allée", "impasse", "chemin", "quai", "sentier", "villa", "passage", "square", "cours", "de", "du", "des", "la", "le", "les", "et", "au", "aux", "en", "sur", "à", "bis", "ter"]);
  function casse(texte) {
    if (!texte) return "";
    let t = String(texte).toUpperCase();
    CORRECTIONS.forEach(([re, rep]) => (t = t.replace(re, rep)));
    t = t.replace(/[A-Z]+/g, (mot) => ACCENTS[mot] || mot);
    t = t
      .toLowerCase()
      .replace(/(^|[\s(\-'/])([a-zàâäéèêëîïôöùûüç]+)/g, (m, sep, mot, pos) => {
        if (pos > 0 && sep !== "-" && MINUSCULES.has(mot)) return sep + mot;
        if ((mot === "d" || mot === "l") && sep !== "-") return sep + mot;
        return sep + mot.charAt(0).toUpperCase() + mot.slice(1);
      });
    t = t.charAt(0).toUpperCase() + t.slice(1);
    // Lieu-dit identique à l'adresse (« 9 rue d'Arcueil (9 rue d'Arcueil) ») : inutile de le répéter
    const m = t.match(/^(.*) \((.*)\)$/);
    const simple = (x) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    return m && simple(m[1]) === simple(m[2]) ? m[1] : t;
  }
  window.casseAdresse = casse;
})();
