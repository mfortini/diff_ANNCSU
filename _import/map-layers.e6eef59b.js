// Configurazione tier multiscala:
//   t2: z6-7   r~2.4km → visibile z2–8.5 (tile z6 overzoomate sotto z6)
//   t3: z8-9   r~611m  → visibile z7.5–10.5
//   t4: z10-11 r~153m  → visibile z9.5–12.5
//   t5: z12-13 r~38m   → visibile z11.5–14.5
//   points: z14+  — anncsu_points_RR.pmtiles.gz oppure anncsu_points_RR_SS.pmtiles.gz (shard)

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

function listRegionPointFiles(region, pointsManifest) {
  const listed = pointsManifest?.points_by_region?.[region.code];
  if (listed?.length) return listed;
  return [`anncsu_points_${region.code}.pmtiles.gz`];
}

function isShardedPointFiles(files, regionCode) {
  if (files.length > 1) return true;
  const file = files[0] ?? "";
  if (!file) return false;
  return shardKeyFromFilename(file, regionCode) !== null;
}

function shardKeyFromFilename(filename, regionCode) {
  const match = filename.match(new RegExp(`^anncsu_points_${regionCode}_(\\d{2})\\.pmtiles\\.gz$`));
  return match ? match[1] : null;
}

// Factory: crea un gestore layer per una pagina.
export function createLayerManager({
  DATES,
  MOST_RECENT_DATE,
  REGIONS,
  DATE_COLORS,
  resolveUrl,
  pointsManifest = null
}) {
  const _visibleDatesByPrefix = new Map();
  const _mapsByPrefix = new Map();
  const _loadedDatesByPrefix = new Map();
  const _regionSourcesByPrefix = new Map();
  const _filterRefreshByPrefix = new Map();

  function getVisibleDates(prefix) {
    let visible = _visibleDatesByPrefix.get(prefix);
    if (!visible) {
      visible = new Set(MOST_RECENT_DATE ? [MOST_RECENT_DATE] : []);
      _visibleDatesByPrefix.set(prefix, visible);
    }
    return visible;
  }

  function forEachDatePointLayerId(prefix, date, fn) {
    const ds = dateSlug(date);
    for (const tier of BLOB_TIERS) {
      fn(`${prefix}_d${ds}_${tier.src}_fill`);
      fn(`${prefix}_d${ds}_${tier.src}_line`);
    }
    for (const region of REGIONS) {
      const files = listRegionPointFiles(region, pointsManifest);
      if (isShardedPointFiles(files, region.code)) {
        for (const file of files) {
          const shard = shardKeyFromFilename(file, region.code) ?? "00";
          fn(`${prefix}_d${ds}_r${region.code}_s${shard}_points`);
        }
      } else {
        fn(`${prefix}_d${ds}_r${region.code}_points`);
      }
    }
  }

  function setDateVisibility(targetMap, prefix) {
    const visibleDates = getVisibleDates(prefix);
    for (const date of DATES) {
      const visibility = visibleDates.has(date) ? "visible" : "none";
      forEachDatePointLayerId(prefix, date, (layerId) => {
        if (targetMap.getLayer(layerId)) {
          targetMap.setLayoutProperty(layerId, "visibility", visibility);
        }
      });
    }
  }

  function getRegionSourcesMap(prefix) {
    let sources = _regionSourcesByPrefix.get(prefix);
    if (!sources) {
      sources = new Map();
      _regionSourcesByPrefix.set(prefix, sources);
    }
    return sources;
  }

  function addPointLayer(targetMap, { layerId, sourceId, date, visibleDates, useDateFilter }) {
    if (targetMap.getLayer(layerId)) return;
    const layerDef = {
      id: layerId,
      type: "circle",
      source: sourceId,
      "source-layer": "points",
      paint: { ...POINTS_PAINT, "circle-color": DATE_COLORS[date] ?? "#888888" },
      minzoom: 13,
      maxzoom: 22,
      layout: { visibility: visibleDates.has(date) ? "visible" : "none" }
    };
    if (useDateFilter) {
      layerDef.filter = ["==", ["get", "date"], date];
    }
    targetMap.addLayer(layerDef);
  }

  async function ensureRegionPointSources(targetMap, prefix) {
    const sources = getRegionSourcesMap(prefix);

    await Promise.all(REGIONS.map(async (region) => {
      if (sources.has(region.code)) return;

      const files = listRegionPointFiles(region, pointsManifest);
      if (isShardedPointFiles(files, region.code)) {
        let loadedAny = false;
        for (const file of files) {
          const shard = shardKeyFromFilename(file, region.code);
          if (!shard) continue;
          const sourceId = `${prefix}_r${region.code}_s${shard}_points_src`;
          if (targetMap.getSource(sourceId)) {
            loadedAny = true;
            continue;
          }
          const url = await resolveUrl(file);
          if (!url) continue;
          targetMap.addSource(sourceId, { type: "vector", url: `pmtiles://${url}` });
          loadedAny = true;
        }
        if (loadedAny) sources.set(region.code, "sharded");
        return;
      }

      const sourceId = `${prefix}_r${region.code}_points_src`;
      const url = await resolveUrl(files[0]);
      if (!url) return;
      if (!targetMap.getSource(sourceId)) {
        targetMap.addSource(sourceId, { type: "vector", url: `pmtiles://${url}` });
      }
      sources.set(region.code, "consolidated");
    }));
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
    const regionSources = getRegionSourcesMap(prefix);

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

    await ensureRegionPointSources(targetMap, prefix);

    for (const region of REGIONS) {
      const mode = regionSources.get(region.code);
      const files = listRegionPointFiles(region, pointsManifest);

      if (mode === "sharded") {
        for (const file of files) {
          const shard = shardKeyFromFilename(file, region.code);
          if (!shard) continue;
          const sourceId = `${prefix}_r${region.code}_s${shard}_points_src`;
          const layerId = `${prefix}_d${ds}_r${region.code}_s${shard}_points`;
          if (!targetMap.getSource(sourceId)) continue;
          addPointLayer(targetMap, {
            layerId, sourceId, date, visibleDates, useDateFilter: true
          });
        }
        continue;
      }

      if (mode === "consolidated") {
        const sourceId = `${prefix}_r${region.code}_points_src`;
        const layerId = `${prefix}_d${ds}_r${region.code}_points`;
        if (targetMap.getSource(sourceId)) {
          addPointLayer(targetMap, {
            layerId, sourceId, date, visibleDates, useDateFilter: true
          });
        }
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
    await ensureRegionPointSources(targetMap, prefix);
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
