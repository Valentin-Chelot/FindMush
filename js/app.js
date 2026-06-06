/* app.js — géolocalisation, carte Leaflet, liste et événements. */

(() => {
  // Pointer Leaflet vers nos images vendorisées (sinon il cherche sur un CDN).
  L.Icon.Default.prototype.options.imagePath = 'vendor/leaflet/images/';

  const els = {
    map: document.getElementById('map'),
    mark: document.getElementById('btn-mark'),
    status: document.getElementById('status'),
    spots: document.getElementById('spots'),
    empty: document.getElementById('empty'),
    count: document.getElementById('count'),
    export: document.getElementById('btn-export'),
    gpx: document.getElementById('btn-gpx'),
    import: document.getElementById('btn-import'),
    file: document.getElementById('file-import')
  };

  // France métropolitaine par défaut tant qu'on n'a pas de point ni de position.
  const map = L.map('map', { zoomControl: true }).setView([46.6, 2.5], 5);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  const markers = new Map(); // id -> L.marker
  let meMarker = null;

  function setStatus(msg, kind) {
    els.status.textContent = msg || '';
    els.status.className = 'status' + (kind ? ' ' + kind : '');
  }

  function accuracyClass(acc) {
    if (acc == null) return '';
    return acc <= 20 ? 'accuracy-good' : 'accuracy-poor';
  }

  function render() {
    const spots = Storage.load().sort((a, b) => b.timestamp - a.timestamp);
    els.count.textContent = `(${spots.length})`;
    els.empty.classList.toggle('hidden', spots.length > 0);

    // Liste
    els.spots.innerHTML = '';
    for (const s of spots) {
      const li = document.createElement('li');
      li.className = 'spot';

      const main = document.createElement('div');
      main.className = 'spot-main';
      const acc = s.accuracy != null ? ` · ±${Math.round(s.accuracy)} m` : '';
      main.innerHTML =
        `<div class="spot-date">${formatDate(s.timestamp)}</div>` +
        `<div class="spot-meta">${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}` +
        `<span class="${accuracyClass(s.accuracy)}">${acc}</span></div>`;
      main.addEventListener('click', () => focusSpot(s));

      const actions = document.createElement('div');
      actions.className = 'spot-actions';

      const open = document.createElement('a');
      open.textContent = '🧭';
      open.title = 'Ouvrir dans Plans';
      open.href = `https://maps.apple.com/?ll=${s.lat},${s.lng}&q=Coin%20champignons`;
      open.target = '_blank';
      open.rel = 'noopener';

      const del = document.createElement('button');
      del.className = 'del';
      del.textContent = '🗑️';
      del.title = 'Supprimer';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Supprimer ce coin ?')) {
          Storage.remove(s.id);
          render();
        }
      });

      actions.append(open, del);
      li.append(main, actions);
      els.spots.appendChild(li);
    }

    // Marqueurs carte
    markers.forEach((m) => map.removeLayer(m));
    markers.clear();
    for (const s of spots) {
      const m = L.marker([s.lat, s.lng]).addTo(map);
      m.bindPopup(`<b>${formatDate(s.timestamp)}</b><br>${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`);
      markers.set(s.id, m);
    }
  }

  function focusSpot(s) {
    map.setView([s.lat, s.lng], 16);
    const m = markers.get(s.id);
    if (m) m.openPopup();
    els.map.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function mark() {
    if (!('geolocation' in navigator)) {
      setStatus('Géolocalisation non disponible sur cet appareil.', 'error');
      return;
    }
    els.mark.disabled = true;
    setStatus('Localisation en cours…');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const spot = Storage.add({
          lat: latitude,
          lng: longitude,
          accuracy,
          timestamp: pos.timestamp || Date.now()
        });
        render();
        focusSpot(spot);
        const note = accuracy != null ? ` (précision ±${Math.round(accuracy)} m)` : '';
        setStatus('Coin enregistré ✓' + note, 'success');
        els.mark.disabled = false;
      },
      (err) => {
        const msgs = {
          1: "Localisation refusée. Autorise-la dans Réglages ▸ Safari ▸ Localisation.",
          2: 'Position indisponible (signal GPS faible ?). Réessaie.',
          3: 'Délai dépassé. Réessaie en extérieur dégagé.'
        };
        setStatus(msgs[err.code] || 'Échec de la localisation.', 'error');
        els.mark.disabled = false;
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }

  // Montre la position courante en continu (sans l'enregistrer) si autorisé.
  function watchMe() {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.watchPosition(
      (pos) => {
        const ll = [pos.coords.latitude, pos.coords.longitude];
        if (!meMarker) {
          meMarker = L.circleMarker(ll, {
            radius: 7,
            color: '#1a73e8',
            fillColor: '#1a73e8',
            fillOpacity: 0.9
          })
            .addTo(map)
            .bindPopup('Ma position');
          if (Storage.load().length === 0) map.setView(ll, 15);
        } else {
          meMarker.setLatLng(ll);
        }
      },
      () => {}, // silencieux : l'utilisateur verra l'erreur au moment de marquer
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
  }

  // Événements
  els.mark.addEventListener('click', mark);
  els.export.addEventListener('click', () => Storage.exportJSON());
  els.gpx.addEventListener('click', () => {
    if (Storage.load().length === 0) {
      setStatus('Rien à exporter pour l’instant.', 'error');
    } else {
      Storage.exportGPX();
    }
  });
  els.import.addEventListener('click', () => els.file.click());
  els.file.addEventListener('change', async () => {
    const f = els.file.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      const added = Storage.importJSON(text);
      render();
      setStatus(`${added} coin(s) importé(s).`, 'success');
    } catch (e) {
      setStatus(e.message || 'Import impossible.', 'error');
    }
    els.file.value = '';
  });

  // Démarrage
  render();
  watchMe();
  setTimeout(() => map.invalidateSize(), 200); // recalcul taille carte après layout

  // Service worker (PWA / hors-ligne)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW non enregistré', e));
    });
  }
})();
