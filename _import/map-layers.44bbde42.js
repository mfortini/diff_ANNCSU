// Configurazione tier multiscala:
//   t2: z6-7   r~2.4km → visibile z2–8.5 (tile z6 overzoomate sotto z6)
//   t3: z8-9   r~611m  → visibile z7.5–10.5
//   t4: z10-11 r~153m  → visibile z9.5–12.5
//   t5: z12-13 r~38m   → visibile z11.5–14.5
//   points: z14+        → visibile z13+

export const BLOB_TIERS = [
  { src: "occ_t2", zmin:  2,   zmax:  8.5, fadeIn: null,         fadeOut: [8, 8.5]   },
  { src: "occ_t3", zmin:  7.5, zmax: 10.5, fadeIn: [7.5, 8],     fadeOut: [10, 10.5] },
  { src: "occ_t4", zmin:  9.5, zmax: 12.5, fadeIn: [9.5, 10],    fadeOut: [12, 12.5] },
  { src: "occ_t5", zmin: 11.5, zmax: 14.5, fadeIn: [11.5, 12],   fadeOut: [14, 14.5] },
];

export function tierOpacity(tier, maxVal) {
  const stops = [];
  if (tier.fadeIn)  stops.push(tier.fadeIn[0],  0,      tier.fadeIn[1],  maxVal);
  else              stops.push(tier.zmin, maxVal);
  if (tier.fadeOut) stops.push(tier.fadeOut[0], maxVal, tier.fadeOut[1], 0);
  else              stops.push(tier.zmax, maxVal);
  return ["interpolate", ["linear"], ["zoom"], ...stops];
}

export const POINTS_PAINT = {
  "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 4, 16, 5, 18, 6],
  "circle-stroke-width": 0,
  "circle-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 14, 1]
};

export const dateSlug = (d) => d.replace(/[^0-9]/g, "");

// Factory: crea un gestore layer per una pagina.
// resolveUrl(filename) → Promise<string|null>: risolve il nome file PMTiles nel suo URL Observable.
// Se ritorna null, il file non è nel manifest e il layer viene saltato silenziosamente.
export function createLayerManager({ DATES, MOST_RECENT_DATE, REGIONS, DATE_COLORS, resolveUrl }) {
  const _visibleDatesByPrefix = new Map();
  const _mapsByPrefix = new Map();
  const _loadedDatesByPrefix = new Map();
  const _filterRefreshByPrefix = new Map();

  function getVisibleDates(prefix) {
    let visible = _visibleDatesByPrefix.get(prefix);
    if (!visible) {
      visible = new Set(MOST_RECENT_DATE ? [MOST_RECENT_DATE] : []);
      _visibleDatesByPrefix.set(prefix, visible);
    }
    return visible;
  }

  function forEachDateLayerId(prefix, date, fn) {
    const ds = dateSlug(date);
    for (const tier of BLOB_TIERS) {
      fn(`${prefix}_d${ds}_${tier.src}_fill`);
      fn(`${prefix}_d${ds}_${tier.src}_line`);
    }
    for (const region of REGIONS) {
      fn(`${prefix}_d${ds}_r${region.code}_points`);
    }
  }

  function setDateVisibility(targetMap, prefix) {
    const visibleDates = getVisibleDates(prefix);
    for (const date of DATES) {
      const visibility = visibleDates.has(date) ? "visible" : "none";
      forEachDateLayerId(prefix, date, (layerId) => {
        if (targetMap.getLayer(layerId)) {
          targetMap.setLayoutProperty(layerId, "visibility", visibility);
        }
      });
    }
  }

  async function ensureDateLayersForMap(targetMap, prefix, date) {
    if (!date) return;
    const visibleDates = getVisibleDates(prefix);
    let loaded = _loadedDatesByPrefix.get(prefix);
    if (!loaded) {
      loaded = new Set();
      _loadedDatesByPrefix.set(prefix, loaded);
    }
    if (loaded.has(date)) return;

    const ds = dateSlug(date);

    const coarseSourceId = `${prefix}_d${ds}_coarse_src`;
    if (!targetMap.getSource(coarseSourceId)) {
      const coarseFileUrl = await resolveUrl(`anncsu_it_${date}.pmtiles.gz`);
      if (!coarseFileUrl) { loaded.add(date); return; }
      targetMap.addSource(coarseSourceId, { type: "vector", url: `pmtiles://${coarseFileUrl}` });
    }

    for (const tier of BLOB_TIERS) {
      const fillId = `${prefix}_d${ds}_${tier.src}_fill`;
      const lineId = `${prefix}_d${ds}_${tier.src}_line`;
      if (!targetMap.getLayer(fillId)) {
        targetMap.addLayer({
          id: fillId,
          type: "fill",
          source: coarseSourceId,
          "source-layer": tier.src,
          paint: { "fill-color": DATE_COLORS[date] ?? "#888888", "fill-opacity": tierOpacity(tier, 0.65) },
          minzoom: tier.zmin,
          maxzoom: tier.zmax,
          layout: { visibility: visibleDates.has(date) ? "visible" : "none" }
        });
      }
      if (!targetMap.getLayer(lineId)) {
        targetMap.addLayer({
          id: lineId,
          type: "line",
          source: coarseSourceId,
          "source-layer": tier.src,
          paint: { "line-color": DATE_COLORS[date] ?? "#888888", "line-opacity": tierOpacity(tier, 0.9), "line-width": 0.7 },
          minzoom: tier.zmin,
          maxzoom: tier.zmax,
          layout: { visibility: visibleDates.has(date) ? "visible" : "none" }
        });
      }
    }

    for (const region of REGIONS) {
      const sourceId = `${prefix}_d${ds}_r${region.code}_src`;
      const layerId = `${prefix}_d${ds}_r${region.code}_points`;
      if (!targetMap.getSource(sourceId)) {
        const pointFileUrl = await resolveUrl(`anncsu_reg_${region.code}_${date}.pmtiles.gz`);
        if (!pointFileUrl) continue;
        targetMap.addSource(sourceId, { type: "vector", url: `pmtiles://${pointFileUrl}` });
      }
      if (!targetMap.getLayer(layerId)) {
        targetMap.addLayer({
          id: layerId,
          type: "circle",
          source: sourceId,
          "source-layer": "points",
          paint: { ...POINTS_PAINT, "circle-color": DATE_COLORS[date] ?? "#888888" },
          minzoom: 13,
          maxzoom: 22,
          layout: { visibility: visibleDates.has(date) ? "visible" : "none" }
        });
      }
    }

    loaded.add(date);
  }

  function registerDateFilteredMap(prefix, targetMap) {
    _mapsByPrefix.set(prefix, targetMap);
  }

  function registerFilterRefresh(prefix, refreshFilters) {
    if (refreshFilters) _filterRefreshByPrefix.set(prefix, refreshFilters);
    else _filterRefreshByPrefix.delete(prefix);
  }

  async function initDateLayersForMap(targetMap, prefix, options = {}) {
    const { refreshFilters } = options;
    registerDateFilteredMap(prefix, targetMap);
    registerFilterRefresh(prefix, refreshFilters);
    const visibleDates = getVisibleDates(prefix);
    const initialDates = visibleDates.size ? [...visibleDates] : (MOST_RECENT_DATE ? [MOST_RECENT_DATE] : []);
    await Promise.all(initialDates.map((d) => ensureDateLayersForMap(targetMap, prefix, d)));
    _filterRefreshByPrefix.get(prefix)?.(targetMap);
    setDateVisibility(targetMap, prefix);
  }

  function buildLayerGroupsForMap(prefix) {
    const visibleDates = getVisibleDates(prefix);
    return [{
      title: "Date",
      _prefix: prefix,
      layers: DATES.map(date => ({
        name: date,
        layerId: `date-${prefix}-${date.replace(/[^a-z0-9]+/gi, "-")}`,
        color: DATE_COLORS[date] ?? "#888888",
        visible: visibleDates.has(date),
        _date: date,
        onToggle: (checked) => {
          const targetVisibleDates = getVisibleDates(prefix);
          if (checked) targetVisibleDates.add(date);
          else targetVisibleDates.delete(date);
          void (async () => {
            const targetMap = _mapsByPrefix.get(prefix);
            if (!targetMap) return;
            if (checked) await ensureDateLayersForMap(targetMap, prefix, date);
            _filterRefreshByPrefix.get(prefix)?.(targetMap);
            setDateVisibility(targetMap, prefix);
          })();
        }
      }))
    }];
  }

  return { initDateLayersForMap, buildLayerGroupsForMap, registerFilterRefresh };
}
