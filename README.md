# 🍄 FindMush

Carnet **local** de tes coins à champignons, avec position GPS. C'est une petite
application web (PWA) à installer sur l'écran d'accueil de ton iPhone. **Gratuit, sans
compte, sans abonnement, fonctionne hors-ligne.**

## Fonctionnement

- **📍 Marquer ce coin** : enregistre ta position GPS actuelle (latitude, longitude,
  précision en mètres, date/heure) avec la **couleur** choisie dans la palette.
- **Carte plein écran** : tes coins + ta position en temps réel (fond de carte
  OpenStreetMap, nécessite le réseau). Le panneau du bas se fait glisser avec le doigt
  (replié / mi-hauteur / déployé), le bouton ⌖ recentre sur ta position, et l'app suit
  automatiquement le **mode sombre** du téléphone.
- **Suivi par année** : tes coins sont rangés par saison. Les pastilles **2026 / 2025 / …**
  n'affichent qu'une année à la fois ; le bouton **⤢ Tout cadrer** zoome la carte sur tous
  les coins de l'année.
- **Revisite** 🍄 : de retour sur un coin, le bouton 🍄 demande « des champignons trouvés
  cette année ? ». Si **oui**, le coin est recopié sur la saison en cours (ou sa date est
  mise à jour s'il existe déjà cette année) — tu gardes ainsi l'historique de productivité
  d'un même lieu d'une année sur l'autre.
- **Liste** : chaque coin avec sa date ; appui pour recentrer la carte ; ✏️ pour
  renommer / recolorer, 🧭 pour ouvrir dans **Plans**, 🗑️ pour supprimer.
- **Sauvegarde** : ⬇️ exporte un fichier JSON, ⬆️ le réimporte. Bouton **GPX** pour
  exporter au format des apps de rando.

Les données restent **uniquement sur ton téléphone** (stockage du navigateur). Rien n'est
envoyé sur Internet.

## Tester en local (sur le Mac)

La géolocalisation n'est autorisée que sur `https://` ou `localhost`.

```bash
cd FindMush
python3 -m http.server 8000
```

Puis ouvre http://localhost:8000 dans Safari ou Chrome et autorise la localisation.

## Installer sur l'iPhone

1. **Héberge les fichiers** sur une URL en HTTPS. Le plus simple, gratuit : **GitHub Pages**.
   - Crée un dépôt GitHub, pousse le contenu de ce dossier.
   - Dépôt ▸ **Settings ▸ Pages** ▸ source = branche `main`, dossier `/ (root)`.
   - GitHub te donne une URL du type `https://<utilisateur>.github.io/FindMush/`.
   - _(Alternatives équivalentes : Netlify ou Cloudflare Pages en glisser-déposer.)_
2. Ouvre cette URL dans **Safari** sur l'iPhone.
3. Bouton **Partager** ▸ **Sur l'écran d'accueil**. L'app s'installe comme une vraie app.
4. Lance-la depuis l'icône 🍄.

## ⚠️ Important : sauvegarde tes données

iOS peut effacer le stockage d'une web app peu utilisée. Pour ne rien perdre :

- **Garde l'app sur l'écran d'accueil** (le stockage y est plus durable).
- **Exporte de temps en temps** avec le bouton ⬇️ (par ex. après chaque belle sortie, et
  avant/après la saison). Garde le fichier JSON dans tes Fichiers/iCloud.

## Structure

```
index.html              page unique
css/style.css           style mobile
js/storage.js           stockage local + export/import (JSON & GPX)
js/app.js               géoloc, carte, liste
vendor/leaflet/         librairie carto (servie en local → hors-ligne)
manifest.webmanifest    métadonnées PWA
sw.js                   service worker (cache hors-ligne)
icons/                  icônes de l'app
```

Aucune dépendance à installer, aucun build : ce sont des fichiers statiques.
