# Installer la collecte des réponses (Google Sheets)

À faire une seule fois, avec le compte Google du groupe. Environ 10 minutes.

## 1. Créer la feuille et le programme

1. Sur [sheets.google.com](https://sheets.google.com), créez une feuille vide nommée « Observatoire – réponses ».
2. Menu **Extensions → Apps Script**.
3. Effacez le contenu de `Code.gs`, puis collez-y tout le fichier `collecte/Code.gs` de ce dossier. Enregistrez (icône disquette).
4. En haut, choisissez la fonction **installer**, puis cliquez sur **Exécuter**. Acceptez les autorisations demandées (« Paramètres avancés → Accéder au projet » si Google affiche un avertissement : c'est votre propre programme).
5. Ouvrez le **Journal d'exécution** : il affiche une **clé**. Copiez-la, elle sert à l'étape 3.

Deux onglets sont apparus dans la feuille : « Releve » et « Commentaires ».

## 2. Publier le programme

1. Bouton **Déployer → Nouveau déploiement**, type **Application Web**.
2. « Exécuter en tant que » : **Moi**. « Qui a accès » : **Tout le monde**.
3. Cliquez sur **Déployer**, puis copiez l'**URL de l'application Web** (elle se termine par `/exec`).

Envoyez cette URL à Claude, ou collez-la dans `data/config.js` à la place des guillemets vides de `collecte`.

## 3. Permettre la mise à jour automatique du site

Sur GitHub, dans le dépôt : **Settings → Secrets and variables → Actions → New repository secret**.

- `RELEVE_URL` : l'URL de l'étape 2.
- `RELEVE_CLE` : la clé de l'étape 1.

Chaque nuit, le site récupère alors les réponses, recalcule les résultats et publie les commentaires validés.

## Modérer les commentaires

Dans l'onglet « Commentaires », cochez la case **publie** d'un commentaire pour l'afficher sur le site (à la mise à jour suivante, la nuit). Laissez-la décochée pour le garder privé. Supprimez la ligne pour l'effacer.

## Ce qui est enregistré

Pour le relevé : un identifiant tiré au hasard sur l'appareil du participant, le pseudo qu'il a choisi (facultatif) et ses réponses. Pour les commentaires : le pseudo (facultatif), le texte et la fiche concernée. Aucune adresse e-mail, aucun nom obligatoire. Les pseudos et les commentaires non validés ne sont jamais publiés.
