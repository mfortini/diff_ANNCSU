export function readHotspotFragment(keys = ["istat", "cell", "cluster"]) {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (!params.get("istat")) return null;
  const data = {};
  for (const key of keys) {
    const value = params.get(key);
    if (value != null && value !== "") data[key] = value;
  }
  return data;
}

export function writeHotspotFragment(data) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value != null && value !== "") params.set(key, String(value));
  }
  const nextHash = params.toString();
  const url = location.pathname + location.search + (nextHash ? `#${nextHash}` : "");
  if (location.pathname + location.search + location.hash !== url) {
    history.replaceState(null, "", url);
  }
}

export function bindHotspotShareUrl({keys, rowToFragment, findRow, invalidation}) {
  let focusHandler = () => {};

  const syncFragment = (row) => writeHotspotFragment(rowToFragment(row));

  const applyFragment = () => {
    const data = readHotspotFragment(keys);
    if (!data) return;
    const row = findRow(data);
    if (row) focusHandler(row);
  };

  const onHashChange = () => applyFragment();
  window.addEventListener("hashchange", onHashChange);
  if (invalidation) invalidation.then(() => window.removeEventListener("hashchange", onHashChange));

  return {
    setFocusHandler(fn) {
      focusHandler = fn;
    },
    syncFragment,
    applyFragment
  };
}
