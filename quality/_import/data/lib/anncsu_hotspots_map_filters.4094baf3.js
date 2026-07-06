export function normalizeIstat(value) {
  return String(value ?? "").padStart(6, "0");
}

export function gridRowKey(codiceIstat, cellId) {
  return `${normalizeIstat(codiceIstat)}:${String(cellId ?? "")}`;
}

export function dbscanRowKey(codiceIstat, clusterId) {
  return `${normalizeIstat(codiceIstat)}:${String(clusterId ?? "")}`;
}

export function dbscanClusterIdMatch(clusterId) {
  const text = String(clusterId ?? "");
  const number = Number(clusterId);
  if (Number.isFinite(number)) {
    return ["any",
      ["==", ["get", "dbscan_cluster_id"], number],
      ["==", ["to-string", ["get", "dbscan_cluster_id"]], text]
    ];
  }
  return ["==", ["to-string", ["get", "dbscan_cluster_id"]], text];
}

export function gridRowsPointFilter(rows) {
  const keys = rows.map((row) => gridRowKey(row.codice_istat, row.cell_id));
  if (!keys.length) return ["literal", false];
  return ["in", ["concat", ["get", "codice_istat"], ":", ["get", "grid_cell_id"]], ["literal", keys]];
}

export function dbscanRowsPointFilter(rows) {
  const keys = rows.map((row) => dbscanRowKey(row.codice_istat, row.cluster_id));
  if (!keys.length) return ["literal", false];
  return ["in", ["concat", ["get", "codice_istat"], ":", ["to-string", ["get", "dbscan_cluster_id"]]], ["literal", keys]];
}

export function gridCellFilterForRow(row) {
  return ["all",
    ["==", ["get", "codice_istat"], normalizeIstat(row.codice_istat)],
    ["==", ["get", "grid_cell_id"], String(row.cell_id ?? row.grid_cell_id ?? "")]
  ];
}

export function dbscanClusterFilterForRow(row) {
  return ["all",
    ["==", ["get", "codice_istat"], normalizeIstat(row.codice_istat)],
    dbscanClusterIdMatch(row.cluster_id ?? row.dbscan_cluster_id)
  ];
}

export function hotspotClusterFilter(row) {
  const parts = [];
  const cellId = row.grid_cell_id ?? row.cell_id;
  if (cellId) parts.push(["==", ["get", "grid_cell_id"], String(cellId)]);
  if (row.dbscan_cluster_id != null && row.dbscan_cluster_id !== "") {
    parts.push(dbscanClusterIdMatch(row.dbscan_cluster_id));
  }
  if (!parts.length) return null;
  const inner = parts.length === 1 ? parts[0] : ["any", ...parts];
  return ["all", ["==", ["get", "codice_istat"], normalizeIstat(row.codice_istat)], inner];
}

export const hotspotPointPaint = {
  "circle-color": "#ea580c",
  "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 1.2, 10, 1.6, 14, 2.2, 18, 3.0],
  "circle-opacity": 0.55,
  "circle-stroke-color": "#111827",
  "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 5, 0.2, 14, 0.5, 18, 0.8]
};
