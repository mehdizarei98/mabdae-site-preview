/* Sample coordinates are not the office location. Replace the provider and coordinates before release. */
(() => {
  const map = document.querySelector('[data-map]');
  if (!map) return;
  document.querySelector('[data-contact-print]')?.addEventListener('click', () => window.print());
  const providers = {
    'osm-sample': { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors', keyRequired: false }
  };
  const config = JSON.parse(map.dataset.map), provider = providers[config.provider];
  if (!provider || (provider.keyRequired && (!config.apiKey || config.apiKey.startsWith('[')))) return;
  const view = map.querySelector('.ct-map-view'), controls = map.querySelector('.ct-map-controls');
  const activate = map.querySelector('.ct-map-activate'), credit = map.querySelector('.ct-credit');
  const tileSize = 256, lat = Math.max(-85.0511, Math.min(85.0511, config.lat));
  let zoom = Math.max(config.minZoom, Math.min(config.maxZoom, config.zoom));
  const point = { x: (config.lng + 180) / 360, y: (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 };
  const center = { ...point }, pointers = new Map();
  let lastDistance = 0;
  credit.textContent = provider.attribution;
  view.hidden = controls.hidden = activate.hidden = false;
  function draw() {
    const world = tileSize * 2 ** zoom, width = view.clientWidth, height = view.clientHeight;
    const left = center.x * world - width / 2, top = center.y * world - height / 2;
    const count = 2 ** zoom, layer = document.createElement('div');
    layer.className = 'ct-map-tiles';
    for (let y = Math.floor(top / tileSize); y <= Math.floor((top + height) / tileSize); y++) {
      if (y < 0 || y >= count) continue;
      for (let x = Math.floor(left / tileSize); x <= Math.floor((left + width) / tileSize); x++) {
        const img = document.createElement('img');
        img.alt = ''; img.draggable = false;
        img.style.left = `${x * tileSize - left}px`; img.style.top = `${y * tileSize - top}px`;
        img.onerror = () => { layer.hidden = true; };
        img.src = provider.url.replace('{z}', zoom).replace('{x}', ((x % count) + count) % count).replace('{y}', y).replace('{key}', encodeURIComponent(config.apiKey));
        layer.append(img);
      }
    }
    const marker = document.createElement('span');
    marker.className = 'ct-map-marker'; marker.setAttribute('aria-hidden', 'true');
    marker.style.left = `${(point.x - center.x) * world + width / 2}px`;
    marker.style.top = `${(point.y - center.y) * world + height / 2}px`;
    view.replaceChildren(layer, marker);
  }
  function pan(dx, dy) {
    const world = tileSize * 2 ** zoom;
    center.x = ((center.x - dx / world) % 1 + 1) % 1;
    center.y = Math.max(0, Math.min(1, center.y - dy / world));
    draw();
  }
  function changeZoom(delta) { zoom = Math.max(config.minZoom, Math.min(config.maxZoom, zoom + delta)); draw(); }
  controls.addEventListener('click', e => { const button = e.target.closest('[data-map-zoom]'); if (button) changeZoom(Number(button.dataset.mapZoom)); });
  activate.addEventListener('click', () => {
    const active = activate.getAttribute('aria-pressed') !== 'true';
    activate.setAttribute('aria-pressed', String(active)); map.classList.toggle('is-active', active);
  });
  view.addEventListener('wheel', e => { if (e.ctrlKey) { e.preventDefault(); changeZoom(e.deltaY < 0 ? 1 : -1); } }, { passive: false });
  view.addEventListener('keydown', e => {
    const moves = { ArrowLeft: [48, 0], ArrowRight: [-48, 0], ArrowUp: [0, 48], ArrowDown: [0, -48] };
    if (moves[e.key]) { e.preventDefault(); pan(...moves[e.key]); }
    else if (e.key === '+' || e.key === '-') { e.preventDefault(); changeZoom(e.key === '+' ? 1 : -1); }
  });
  view.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' && !map.classList.contains('is-active')) return;
    e.preventDefault(); view.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]); lastDistance = 0;
  });
  view.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    const old = pointers.get(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) pan(e.clientX - old[0], e.clientY - old[1]);
    else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], distance = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (lastDistance && Math.abs(distance - lastDistance) > 48) { changeZoom(distance > lastDistance ? 1 : -1); lastDistance = distance; }
      else if (!lastDistance) lastDistance = distance;
    }
  });
  function release(e) { pointers.delete(e.pointerId); lastDistance = 0; }
  view.addEventListener('pointerup', release); view.addEventListener('pointercancel', release);
  new ResizeObserver(draw).observe(view);
  draw();
})();
