# Observatoire de l'urbanisme de Gentilly

Site réalisé par les membres du Bien Commun pour Gentilly, qui recense les permis de construire, de démolir et d'aménager de Gentilly (94) publiés par l'État depuis 2013 : carte, liste filtrable, fiche par autorisation et sélection des grands projets.

## Licences

Code sous **GNU AGPL v3** ([LICENSE](LICENSE)), textes et mise en forme sous **CC BY-SA 4.0**, données sous la Licence Ouverte 2.0 de leurs sources. Le nom et les logos du Bien Commun pour Gentilly ne sont pas concédés. Détail dans [LICENCE.md](LICENCE.md).

## Habillage : charte « Vert équilibré — Atlas urbain »

- **Fichier :** `assets/observatoire-vert-equilibre.css`, chargé après `assets/style.css`. Toutes les couleurs y sont des variables, en tête du fichier.
- **Couleurs de l'interface :** vert forêt `#304E43` (titres, boutons), vert sauge `#658C79` (pictogrammes, indicateurs ; variante `#4F7463` pour les liens, plus lisible), vert clair `#DFEADD`, ivoire `#FAFAF6` (fond), blanc (cartes), gris minéral `#64736C` (texte secondaire).
- **Couleurs des données,** distinctes de l'interface et vérifiées pour les daltonismes : bleu `#2F6DB5` (habitat, créations), ocre `#C98A1B` (activités), brique `#B5452B` (démolitions, pertes), gris `#7A847F` (aménagement).
- **Polices :** Manrope (titres), Inter (texte), IBM Plex Mono (numéros de permis), hébergées dans `assets/polices/` (licence SIL Open Font License) : aucun appel à Google Fonts.
- **Pictogramme :** `assets/picto.svg`, repris dans l'icône d'onglet.
- **Mention :** « Réalisé par les membres du Bien Commun pour Gentilly » sous le nom, et « Une initiative du Bien Commun pour Gentilly » en pied de page.

## Voir le site sur son ordinateur

Double-cliquez sur `index.html`. Il s'ouvre dans le navigateur ; une connexion Internet est nécessaire pour les fonds de carte.

## Mettre à jour les données

- **Sur Windows :** double-cliquez sur `mettre_a_jour.bat`. Il faut que [Python 3](https://www.python.org/downloads/) soit installé .
- **En ligne de commande :** `python scripts/maj_donnees.py`
- **Automatiquement :** une fois le site publié sur GitHub (voir ci-dessous), le fichier `.github/workflows/mise-a-jour.yml` relance la mise à jour le 3 de chaque mois.

Le script télécharge les quatre fichiers Sitadel filtrés sur Gentilly (code INSEE 94037). Il localise chaque autorisation par ses parcelles cadastrales (API Carto de l'IGN), ou à défaut par son adresse (Base Adresse Nationale). Il écrit ensuite :

| Fichier | Contenu |
| --- | --- |
| `data/permis.js` | Les données lues par le site |
| `data/permis.json` | Les mêmes données, pour réutilisation |
| `data/permis.csv` | Tableur (séparateur `;`, s'ouvre dans Excel) |
| `data/cache_geocodage.json` | Localisations déjà trouvées, pour aller plus vite la fois suivante |

## Bureaux et pleine terre

- **Bureaux :** les surfaces de bureaux créées, démolies et transformées viennent directement des permis (base Sitadel). La page « Bureaux » en fait le bilan depuis 2013.
- **Pleine terre :** aucune base publique ne la donne, et une mesure automatique sur photos aériennes s'est révélée trop imprécise (jardins sur dalle, toitures, ombres). Elle est donc relevée par des habitants (voir ci-dessous). Tant que le relevé n'a pas été traité, la page « Pleine terre » n'affiche que des explications.

## Relevé en ligne et commentaires

Le relevé peut recevoir les réponses directement, et les fiches accueillir des commentaires modérés, grâce à une feuille Google du groupe : voir `collecte/LISEZMOI.md` (10 minutes, une seule fois). Une fois l'adresse de la collecte inscrite dans `data/config.js` et les secrets `RELEVE_URL` et `RELEVE_CLE` ajoutés sur GitHub :

- chaque réponse au relevé part toute seule à chaque terrain ;
- chaque nuit, `.github/workflows/releve.yml` regroupe les réponses et publie les résultats anonymes ;
- un terrain n'apparaît dans les résultats qu'à partir de 3 réponses (réglable dans `data/config.js`) ;
- un commentaire n'est publié que si sa case « publie » est cochée dans la feuille.

## Relevé collaboratif de la pleine terre

La page `releve-pleine-terre.html` (non reliée au reste du site) permet à plusieurs personnes de relever, terrain par terrain, la part de pleine terre visible sur les photos aériennes avant et après chaque projet, et d'y dessiner au doigt les zones disparues ou créées. Elle fonctionne sur téléphone.

1. Envoyez l'adresse de la page aux participants : `https://<votre-compte>.github.io/observatoire-gentilly/releve-pleine-terre.html`.
2. Chacun saisit son prénom et relève autant de terrains qu'il veut. Les réponses restent sur son téléphone ou son ordinateur.
3. Chacun touche « Envoyer » : le fichier part par WhatsApp, e-mail…, ou se télécharge.
4. Placez tous les fichiers reçus dans le dossier `reponses/` (jamais publié : il contient les prénoms), puis lancez :

   `python scripts/traiter_releve.py`

5. Vous obtenez `reponses/synthese-releve.xlsx` (détail par terrain, avis divergents, commentaires) et `data/releve_pleine_terre.js` (résultats anonymes). Le site affiche automatiquement ces résultats dès que ce fichier est publié : chiffres sur l'accueil, graphique sur la page « Pleine terre », résultat dans chaque fiche, filtre sur la carte.

Si une personne envoie plusieurs fichiers, seul le plus récent compte : chaque envoi contient toutes ses réponses.

## Ajouter des informations sur un projet

Le fichier `data/complements.js` permet d'ajouter, pour un numéro de permis, un titre, un texte, des photos et des liens. Ces notes s'affichent dans la fiche du projet. La mise à jour automatique ne touche jamais ce fichier. Un exemple commenté se trouve en tête du fichier.

Les photos se placent dans un dossier `images/` à créer. Ne publiez pas de plans d'architecte sans l'accord de leur auteur : ils sont protégés par le droit d'auteur.

## Publier le site gratuitement (GitHub Pages)

1. Créez un compte sur [github.com](https://github.com), puis un dépôt public, par exemple `observatoire-gentilly`.
2. Envoyez-y le contenu de ce dossier (bouton « uploading an existing file », ou GitHub Desktop).
3. Dans le dépôt : **Settings → Pages → Source : Deploy from a branch → main / (root)**.
4. Le site est en ligne à l'adresse `https://<votre-compte>.github.io/observatoire-gentilly/`.
5. Dans **Settings → Actions → General**, autorisez « Read and write permissions » pour que la mise à jour mensuelle puisse enregistrer les nouvelles données.

Un nom de domaine (par exemple `observatoire-gentilly.fr`) peut ensuite être relié au site dans **Settings → Pages → Custom domain**.

## À compléter avant publication

- Des mentions légales : nom et adresse de l'hébergeur (GitHub), et un moyen de contact. Une personne qui publie à titre non professionnel peut rester anonyme, à condition d'avoir donné son identité à l'hébergeur (loi pour la confiance dans l'économie numérique).

## Ce que les données ne disent pas

Sitadel ne contient ni les plans, ni les arrêtés, ni les demandes en cours d'instruction ou refusées, ni les petits travaux sans création de surface. Les dossiers complets se demandent à la mairie, au titre du droit d'accès aux documents administratifs ; la CADA peut être saisie en cas de refus.

## Structure

```
index.html              page unique (accueil, carte, grands projets, liste, fiches, à propos)
assets/style.css        mise en forme (thèmes clair et sombre)
assets/app.js           affichage, filtres, carte Leaflet, graphique
data/                   données générées + compléments manuels
scripts/maj_donnees.py  mise à jour depuis Sitadel (Python 3, sans dépendance)
```
