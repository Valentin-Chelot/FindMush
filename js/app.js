/* app.js — géolocalisation, carte Leaflet, liste, couleurs et édition. */

(() => {
  // Palette proposée pour catégoriser les coins (à toi d'attribuer un sens :
  // type de champignon, abondance, terrain…).
  const PALETTE = [
    { name: 'Marron', value: '#8a5a2b' },
    { name: 'Rouge', value: '#c0392b' },
    { name: 'Orange', value: '#e67e22' },
    { name: 'Jaune', value: '#e1b12c' },
    { name: 'Vert', value: '#4e8d3e' },
    { name: 'Bleu', value: '#2980b9' },
    { name: 'Violet', value: '#8e44ad' },
    { name: 'Gris', value: '#7f8c8d' }
  ];
  let selectedColor = PALETTE[0].value; // couleur du prochain coin marqué

  const els = {
    map: document.getElementById('map'),
    mark: document.getElementById('btn-mark'),
    markPalette: document.getElementById('mark-palette'),
    status: document.getElementById('status'),
    spots: document.getElementById('spots'),
    empty: document.getElementById('empty'),
    count: document.getElementById('count'),
    export: document.getElementById('btn-export'),
    gpx: document.getElementById('btn-gpx'),
    import: document.getElementById('btn-import'),
    file: document.getElementById('file-import'),
    editor: document.getElementById('editor'),
    editName: document.getElementById('edit-name'),
    editPalette: document.getElementById('edit-palette'),
    editSave: document.getElementById('edit-save'),
    editCancel: document.getElementById('edit-cancel'),
    yearFilter: document.getElementById('year-filter'),
    fit: document.getElementById('btn-fit'),
    revisit: document.getElementById('revisit'),
    revisitText: document.getElementById('revisit-text'),
    revisitYes: document.getElementById('revisit-yes'),
    revisitNo: document.getElementById('revisit-no')
  };

  let selectedYear = null; // année affichée (déduite des données au 1er rendu)

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

  // Marqueur en forme d'épingle, dans la couleur du coin.
  function pinIcon(color) {
    const c = color || PALETTE[0].value;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">` +
      `<path d="M14 0C6.3 0 0 6.3 0 14c0 10 14 26 14 26s14-16 14-26C28 6.3 21.7 0 14 0z" fill="${c}" stroke="#fff" stroke-width="2"/>` +
      `<circle cx="14" cy="14" r="5" fill="#fff"/></svg>`;
    return L.divIcon({
      className: 'pin',
      html: svg,
      iconSize: [28, 40],
      iconAnchor: [14, 40],
      popupAnchor: [0, -36]
    });
  }

  // Construit une rangée de pastilles cliquables dans un conteneur.
  // onPick(color) est appelé à la sélection.
  function buildPalette(container, current, onPick) {
    container.innerHTML = '';
    for (const c of PALETTE) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch' + (c.value === current ? ' selected' : '');
      b.style.background = c.value;
      b.title = c.name;
      b.setAttribute('aria-label', c.name);
      b.addEventListener('click', () => {
        container.querySelectorAll('.swatch').forEach((s) => s.classList.remove('selected'));
        b.classList.add('selected');
        onPick(c.value);
      });
      container.appendChild(b);
    }
  }

  function spotTitle(s) {
    return s.note && s.note.trim() ? s.note : formatDate(s.timestamp);
  }

  // Pastilles des années présentes (récentes d'abord) ; clic = change l'année affichée.
  function buildYearFilter(years) {
    els.yearFilter.innerHTML = '';
    for (const y of years) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'year-chip' + (y === selectedYear ? ' selected' : '');
      b.textContent = y;
      b.addEventListener('click', () => {
        selectedYear = y;
        render();
      });
      els.yearFilter.appendChild(b);
    }
  }

  function render() {
    const all = Storage.load();
    // Années présentes, de la plus récente à la plus ancienne.
    const years = [...new Set(all.map(yearOf))].sort((a, b) => b - a);
    // Année affichée : garder le choix s'il existe encore, sinon la plus récente.
    if (selectedYear == null || !years.includes(selectedYear)) {
      selectedYear = years[0] ?? new Date().getFullYear();
    }
    buildYearFilter(years);

    const spots = all
      .filter((s) => yearOf(s) === selectedYear)
      .sort((a, b) => b.timestamp - a.timestamp);
    els.count.textContent = `(${spots.length})`;
    els.empty.classList.toggle('hidden', all.length > 0);

    // Liste
    els.spots.innerHTML = '';
    for (const s of spots) {
      const li = document.createElement('li');
      li.className = 'spot';

      const main = document.createElement('div');
      main.className = 'spot-main';
      const acc = s.accuracy != null ? ` · ±${Math.round(s.accuracy)} m` : '';
      const titled = s.note && s.note.trim();
      const meta = titled
        ? `${formatDate(s.timestamp)} · ${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`
        : `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`;
      main.innerHTML =
        `<div class="spot-title">` +
        `<span class="color-dot" style="background:${s.color || PALETTE[0].value}"></span>` +
        `<span class="spot-title-text">${escapeHtml(spotTitle(s))}</span></div>` +
        `<div class="spot-meta">${meta}<span class="${accuracyClass(s.accuracy)}">${acc}</span></div>`;
      main.addEventListener('click', () => focusSpot(s));

      const actions = document.createElement('div');
      actions.className = 'spot-actions';

      const here = document.createElement('button');
      here.textContent = '🍄';
      here.title = 'J\'y suis : signaler une cueillette';
      here.addEventListener('click', (e) => {
        e.stopPropagation();
        openRevisit(s);
      });

      const edit = document.createElement('button');
      edit.textContent = '✏️';
      edit.title = 'Renommer / changer la couleur';
      edit.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditor(s);
      });

      const open = document.createElement('a');
      open.textContent = '🧭';
      open.title = 'Ouvrir dans Plans';
      open.href = `https://maps.apple.com/?ll=${s.lat},${s.lng}&q=${encodeURIComponent(spotTitle(s))}`;
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

      actions.append(here, edit, open, del);
      li.append(main, actions);
      els.spots.appendChild(li);
    }

    // Marqueurs carte
    markers.forEach((m) => map.removeLayer(m));
    markers.clear();
    for (const s of spots) {
      const m = L.marker([s.lat, s.lng], { icon: pinIcon(s.color) }).addTo(map);
      m.bindPopup(`<b>${escapeHtml(spotTitle(s))}</b><br>${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`);
      markers.set(s.id, m);
    }
  }

  function focusSpot(s) {
    map.setView([s.lat, s.lng], 16);
    const m = markers.get(s.id);
    if (m) m.openPopup();
    els.map.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Cadre la carte sur tous les coins actuellement affichés (année sélectionnée).
  function fitAll() {
    const lls = [];
    markers.forEach((m) => lls.push(m.getLatLng()));
    if (lls.length === 0) {
      setStatus('Aucun coin à afficher pour cette année.', 'error');
    } else if (lls.length === 1) {
      map.setView(lls[0], 15);
    } else {
      map.fitBounds(L.latLngBounds(lls), { padding: [40, 40] });
    }
    els.map.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* --- Revisite (cueillette de l'année) --- */
  let revisitLocationId = null;

  function openRevisit(s) {
    revisitLocationId = s.locationId;
    els.revisitText.textContent =
      `« ${spotTitle(s)} » : des champignons trouvés ici cette année ?`;
    els.revisit.hidden = false;
  }

  function closeRevisit() {
    els.revisit.hidden = true;
    revisitLocationId = null;
  }

  function confirmRevisit() {
    if (!revisitLocationId) return;
    const res = Storage.registerFind(revisitLocationId);
    closeRevisit();
    if (!res) return;
    selectedYear = new Date().getFullYear(); // on bascule sur la saison en cours
    render();
    setStatus(
      res.action === 'updated'
        ? `Date mise à jour pour ${selectedYear} ✓`
        : `Nouveau coin enregistré pour ${selectedYear} 🍄`,
      'success'
    );
    focusSpot(res.spot);
  }

  /* --- Édition (renommer / recolorer) --- */
  let editingId = null;
  let editColor = null;

  function openEditor(s) {
    editingId = s.id;
    editColor = s.color || PALETTE[0].value;
    els.editName.value = s.note || '';
    buildPalette(els.editPalette, editColor, (c) => { editColor = c; });
    els.editor.hidden = false;
    els.editName.focus();
  }

  function closeEditor() {
    els.editor.hidden = true;
    editingId = null;
  }

  function saveEditor() {
    if (!editingId) return;
    Storage.update(editingId, { note: els.editName.value.trim(), color: editColor });
    closeEditor();
    render();
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
          color: selectedColor,
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

  function escapeHtml(s) {
    return String(s).replace(/[<>&"]/g, (c) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])
    );
  }

  // Événements
  buildPalette(els.markPalette, selectedColor, (c) => { selectedColor = c; });
  els.mark.addEventListener('click', mark);
  els.fit.addEventListener('click', fitAll);
  els.editSave.addEventListener('click', saveEditor);
  els.editCancel.addEventListener('click', closeEditor);
  els.editor.addEventListener('click', (e) => { if (e.target === els.editor) closeEditor(); });
  els.revisitYes.addEventListener('click', confirmRevisit);
  els.revisitNo.addEventListener('click', closeRevisit);
  els.revisit.addEventListener('click', (e) => { if (e.target === els.revisit) closeRevisit(); });
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
  Storage.migrate(); // assure un locationId à chaque coin existant
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
