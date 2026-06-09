/* storage.js — persistance locale des coins + export/import.
   Données dans localStorage, clé "findmush.spots".
   Un coin : { id, lat, lng, accuracy, timestamp, note, color, locationId }
   locationId = identifiant du lieu, partagé entre un coin et ses duplicatas annuels. */

export const Storage = (() => {
  const KEY = 'findmush.spots';
  const DEFAULT_COLOR = '#8a5a2b'; // marron, couleur par défaut d'un coin

  function newId() {
    return (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random());
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.error('Lecture stockage impossible', e);
      return [];
    }
  }

  function save(spots) {
    localStorage.setItem(KEY, JSON.stringify(spots));
  }

  // Migration : tout coin sans locationId reçoit son propre id comme lieu. Idempotent.
  function migrate() {
    const spots = load();
    let changed = false;
    for (const s of spots) {
      if (!s.locationId) { s.locationId = s.id; changed = true; }
    }
    if (changed) save(spots);
  }

  function add(spot) {
    const spots = load();
    const id = newId();
    const full = {
      id,
      locationId: id, // nouveau coin = nouveau lieu
      lat: spot.lat,
      lng: spot.lng,
      accuracy: spot.accuracy ?? null,
      timestamp: spot.timestamp || Date.now(),
      note: spot.note || '',
      color: spot.color || DEFAULT_COLOR
    };
    spots.push(full);
    save(spots);
    return full;
  }

  // Revisite : enregistre une cueillette pour l'année en cours sur un lieu.
  // Si le lieu a déjà une fiche cette année → met à jour sa date ;
  // sinon → duplique le coin source (mêmes coordonnées/nom/couleur) sur l'année en cours.
  function registerFind(locationId) {
    const spots = load();
    const year = new Date().getFullYear();
    const group = spots.filter((s) => s.locationId === locationId);
    if (group.length === 0) return null;

    const sameYear = group.find((s) => yearOf(s) === year);
    if (sameYear) {
      sameYear.timestamp = Date.now();
      save(spots);
      return { action: 'updated', spot: sameYear };
    }

    // Coin source = le plus récent du lieu, sert de modèle.
    const tpl = group.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
    const dup = {
      id: newId(),
      locationId,
      lat: tpl.lat,
      lng: tpl.lng,
      accuracy: tpl.accuracy ?? null,
      timestamp: Date.now(),
      note: tpl.note || '',
      color: tpl.color || DEFAULT_COLOR
    };
    spots.push(dup);
    save(spots);
    return { action: 'duplicated', spot: dup };
  }

  function remove(id) {
    save(load().filter((s) => s.id !== id));
  }

  // Met à jour le nom (note) et/ou la couleur d'un coin existant.
  function update(id, fields) {
    const spots = load();
    const s = spots.find((x) => x.id === id);
    if (!s) return;
    if ('note' in fields) s.note = fields.note;
    if ('color' in fields) s.color = fields.color;
    save(spots);
  }

  /* --- Export / import (sauvegarde) --- */

  function exportJSON() {
    const data = { app: 'FindMush', version: 1, exportedAt: Date.now(), spots: load() };
    download(
      JSON.stringify(data, null, 2),
      'application/json',
      `findmush-${dateStamp()}.json`
    );
  }

  // Fusionne l'import avec l'existant en évitant les doublons d'id.
  function importJSON(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error('Fichier JSON illisible.');
    }
    const incoming = Array.isArray(parsed) ? parsed : parsed.spots;
    if (!Array.isArray(incoming)) throw new Error('Aucun coin trouvé dans ce fichier.');

    const current = load();
    const known = new Set(current.map((s) => s.id));
    let added = 0;
    for (const s of incoming) {
      if (typeof s.lat !== 'number' || typeof s.lng !== 'number') continue;
      let id = s.id;
      if (id && known.has(id)) continue; // déjà présent → on ignore (pas de doublon)
      if (!id) id = newId();
      current.push({
        id,
        locationId: s.locationId || id,
        lat: s.lat,
        lng: s.lng,
        accuracy: s.accuracy ?? null,
        timestamp: s.timestamp || Date.now(),
        note: s.note || '',
        color: s.color || DEFAULT_COLOR
      });
      known.add(id);
      added++;
    }
    save(current);
    return added;
  }

  function exportGPX() {
    const spots = load();
    const wpts = spots
      .map((s) => {
        const t = new Date(s.timestamp).toISOString();
        const name = escapeXml(s.note || `Coin ${formatDate(s.timestamp)}`);
        return `  <wpt lat="${s.lat}" lon="${s.lng}">\n    <time>${t}</time>\n    <name>${name}</name>${s.note ? `\n    <desc>${escapeXml(s.note)}</desc>` : ''}\n  </wpt>`;
      })
      .join('\n');
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="FindMush" xmlns="http://www.topografix.com/GPX/1/1">\n${wpts}\n</gpx>\n`;
    download(gpx, 'application/gpx+xml', `findmush-${dateStamp()}.gpx`);
  }

  /* --- Helpers --- */

  function download(content, mime, filename) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function dateStamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  }

  function escapeXml(s) {
    return String(s).replace(/[<>&'"]/g, (c) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])
    );
  }

  return { load, add, update, remove, registerFind, migrate, exportJSON, importJSON, exportGPX };
})();

// Année d'un coin, déduite de sa date. Réutilisé par app.js et storage.js.
export function yearOf(spot) {
  return new Date(spot.timestamp).getFullYear();
}

// Format de date lisible, réutilisé par app.js
export function formatDate(ts) {
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
