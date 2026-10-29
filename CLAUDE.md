# Observatoire de l'urbanisme de Gentilly : notes pour reprendre le projet

Site statique (HTML, CSS, JavaScript, sans framework) publié par GitHub Pages sur https://urbanisme.observatoiregentilly.fr. Réalisé par les membres du Bien Commun pour Gentilly. Langue : français, ton sobre et factuel.

## Organisation
- `index.html` : application à vues (accueil, carte, bureaux, pleine terre, grands projets, liste, autrefois, fiches, à propos), navigation par `#ancre`. `assets/app.js` fait tout l'affichage.
- `releve-pleine-terre.html` + `assets/releve.js` : relevé collaboratif de la pleine terre (photos aériennes avant/après, réponses envoyées à une feuille Google).
- `assets/style.css` puis `assets/observatoire-vert-equilibre.css` (charte « Vert équilibré » : couleurs en variables CSS, polices dans `assets/polices/`). Les couleurs des **données** (bleu, ocre, brique, gris) sont volontairement distinctes de celles de l'interface.
- `data/permis.js|json|csv` : générés par `scripts/maj_donnees.py` à partir de la base Sitadel (API DiDo) ; ne pas modifier à la main. `data/quartiers.json` : grille des quartiers. `data/complements.js` : notes éditoriales manuelles, jamais écrasées. `data/config.js` : réglages (collecte Google, GoatCounter, seuil de publication).
- `scripts/traiter_releve.py` : regroupe les réponses du relevé (fichiers `reponses/*.json` et/ou collecte en ligne) et écrit `data/releve_pleine_terre.js` et `data/commentaires.js`.
- `collecte/Code.gs` : programme Google Apps Script (réponses, commentaires, inscriptions). Mode d'emploi dans `collecte/LISEZMOI.md`.
- `.github/workflows/` : mise à jour mensuelle des données (le 3) et traitement nocturne du relevé.

## Travailler en local
- Aperçu : `python -m http.server 8765` dans le dossier, puis http://localhost:8765. Le navigateur garde les fichiers en cache : recharger sans cache après chaque modification.
- Mettre à jour les données : `python scripts/maj_donnees.py` (Python 3.9+, aucune dépendance). Le tableur de synthèse du relevé utilise `openpyxl` s'il est installé, sinon un CSV.
- Publier : `git push` sur `main` ; GitHub Pages reconstruit le site en 1 à 2 minutes.

## À ne jamais publier
- Le dossier `reponses/` (pseudos des participants) est dans `.gitignore`. Les adresses e-mail des inscrits restent dans la feuille Google, jamais dans ce dépôt.
- Aucune clé ni mot de passe dans le dépôt : la clé de collecte est un secret GitHub (`RELEVE_CLE`).

## Règles de conception déjà décidées
- Pas de Google Fonts, pas de cookies ; mesure d'audience GoatCounter sans cookie.
- Politique de sécurité (CSP) en balise meta : toute nouvelle ressource externe doit y être autorisée.
- Pas d'estimation automatique de la pleine terre : seule la mesure par relevé d'habitants est publiée, avec un minimum de 3 réponses par terrain.
- Les commentaires sont modérés (case « publie » dans la feuille) et affichés la nuit suivante.

## Domaine
`urbanisme.observatoiregentilly.fr` (CNAME vers GitHub), `observatoiregentilly.fr` redirigé par le dépôt `observatoiregentilly-accueil` (page d'accueil provisoire, futurs autres observatoires).
