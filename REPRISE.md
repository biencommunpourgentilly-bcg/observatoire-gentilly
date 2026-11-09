# Reprendre le projet sur un autre ordinateur

## 1. Outils à installer (une fois)
- Git, GitHub CLI (`gh`), Python 3.12, Claude Code (ou l'app Claude).
- Pour le dépôt `observatoire-patrimoine` seulement : `pip install duckdb`.

## 2. Connexion GitHub (vous-même, jamais de mot de passe partagé)
```
gh auth login
```
Compte : `biencommunpourgentilly-bcg`. Activer la double authentification.

## 3. Cloner
```
gh repo clone biencommunpourgentilly-bcg/observatoire-gentilly
gh repo clone biencommunpourgentilly-bcg/observatoire-patrimoine   # privé
```
Le dépôt `observatoiregentilly-accueil` (simple redirection) ne se clone que pour le modifier.

## 4. Ouvrir le dossier dans Claude Code
`CLAUDE.md` décrit l'architecture, les scripts et les consignes : la session repart avec le contexte.

## 5. Ce qui n'est pas dans git (volontairement)
- `reponses/` : relevés et synthèses, données de participants. À copier à la main si besoin (support privé).
- Secrets : `RELEVE_CLE` dans GitHub (Settings > Secrets and variables > Actions) ; clé d'export dans Apps Script (`CLE_EXPORT`).
- Aucune adresse e-mail d'abonné ne doit entrer dans un dépôt.

## 6. Travailler sur plusieurs ordinateurs
- Arrivée : `git pull`. Départ : `git add`, `git commit`, `git push`.
- Les workflows automatiques committent aussi sur le dépôt (données Sitadel, relevés) : toujours faire le `git pull` avant de modifier.

## 7. Rien à publier sans accord
Le suivi du patrimoine reste privé tant que le groupe n'a pas relu les formulations et les mentions légales.
