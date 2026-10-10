# Observatoire de l'urbanisme de Gentilly

Site réalisé par le Bien Commun pour Gentilly, qui recense les permis de construire, de démolir et d'aménager de Gentilly (94) publiés par l'État depuis 2013 : carte, liste filtrable, fiche par autorisation et sélection des grands projets.

## Charte graphique

Le site suit la charte du Bien Commun pour Gentilly :

- **Couleurs :** bleu roi `#3155a6` pour les aplats et les titres, cyan `#00c0f3` pour les éléments graphiques, rouge réservé aux démolitions, blanc pour le texte sur fond bleu. Elles sont définies en tête de `assets/style.css`.
- **Typographie :** Arial, titres en Arial Black.
- **Obliques montantes** de gauche à droite sous l'en-tête, les bandeaux et au-dessus du pied de page.
- **Sous-titres** commençant par « POUR » en cyan.
- **Logo :** déposez le logo BCG sous le nom `assets/logo-bcg.png`, de préférence sur fond transparent. Il remplace alors automatiquement le bloc typographique incliné « Bien Commun pour Gentilly », dans l'en-tête, l'accueil (un tiers de la largeur) et le pied de page.

Les données viennent de la base **Sitadel** du ministère de la Transition écologique, via son [API publique DiDo](https://www.statistiques.developpement-durable.gouv.fr/catalogue?page=dataset&datasetId=6513f0189d7d312c80ec5b5b). Elle est mise à jour chaque mois, sans inscription, sous Licence Ouverte.

## Voir le site sur son ordinateur

Double-cliquez sur `index.html`. Il s'ouvre dans le navigateur ; une connexion Internet est nécessaire pour les fonds de carte.

## Mettre à jour les données

- **Sur Windows :** double-cliquez sur `mettre_a_jour.bat`. Il faut que [Python 3](https://www.python.org/downloads/) soit installé ; le fichier installe au besoin Pillow, utilisé pour mesurer la végétation.
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
- **Pleine terre :** aucune base publique ne donne la pleine terre. Le script `scripts/vegetation.py` mesure donc la végétation visible sur chaque terrain, sur les photos aériennes infrarouges de l'IGN (2014, 2018, 2021, 2024, et les suivantes dès leur publication). Il compare la photo précédant l'autorisation d'un projet à la dernière photo. Le seuil de détection est recalculé pour chaque photo, car la lumière varie d'une campagne à l'autre.
- **Limite à garder en tête :** la végétation visible n'est pas la pleine terre. Un jardin sur la dalle d'un parking souterrain paraît vert vu du ciel. Les vraies surfaces de pleine terre sont dans les dossiers de permis, à demander à la mairie.
- La première mesure télécharge environ 2 000 images (quelques minutes). Les résultats sont gardés dans `data/cache_geocodage.json` : les mises à jour suivantes ne mesurent que les nouveaux terrains et les nouvelles photos.

## Relevé collaboratif de la pleine terre

La page `releve-pleine-terre.html` (non reliée au reste du site) permet à plusieurs personnes de relever, terrain par terrain, la part de pleine terre visible sur les photos aériennes avant et après chaque projet, et d'y dessiner au doigt les zones disparues ou créées. Elle fonctionne sur téléphone.

1. Envoyez l'adresse de la page aux participants : `https://<votre-compte>.github.io/observatoire-gentilly/releve-pleine-terre.html`.
2. Chacun saisit son prénom et relève autant de terrains qu'il veut. Les réponses restent sur son téléphone ou son ordinateur.
3. Chacun touche « Envoyer » : le fichier part par WhatsApp, e-mail…, ou se télécharge.
4. Placez tous les fichiers reçus dans le dossier `reponses/` (jamais publié : il contient les prénoms), puis lancez :

   `python scripts/traiter_releve.py`

5. Vous obtenez `reponses/synthese-releve.xlsx` (détail par terrain, avis divergents, commentaires) et `data/releve_pleine_terre.js` (résultats anonymes, prêts à être affichés sur le site).

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

- L'adresse de contact, dans la page « À propos » (`index.html`, texte surligné).
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
