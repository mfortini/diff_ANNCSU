function expandLogicalLayerIds(logicalId) {
  return [logicalId];
}

export class LayerControl {
  constructor(layerGroups) {
    this._layerGroups = layerGroups;
  }

  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

    const wrapper = document.createElement('div');
    wrapper.style.backgroundColor = 'white';
    wrapper.style.padding = '10px';
    wrapper.style.maxHeight = '400px';
    wrapper.style.overflowY = 'auto';
    wrapper.style.minWidth = '200px';

    this._layerGroups.forEach((group, idx) => {
      if (idx > 0) {
        const separator = document.createElement('hr');
        separator.style.margin = '10px 0';
        separator.style.border = 'none';
        separator.style.borderTop = '1px solid #ddd';
        wrapper.appendChild(separator);
      }

      if (group.title) {
        if (group.layers.length > 1) {
          const groupToggle = this._createGroupToggle(group);
          wrapper.appendChild(groupToggle);
        } else {
          const title = document.createElement('div');
          title.style.fontWeight = 'bold';
          title.style.marginBottom = '5px';
          title.style.fontSize = '13px';
          title.textContent = group.title;
          wrapper.appendChild(title);
        }
      }

      const layersContainer = document.createElement('div');
      layersContainer.style.paddingLeft = group.layers.length > 1 ? '20px' : '0';

      group.layers.forEach((layer) => {
        const layerDiv = this._createLayerToggle(layer, group);
        layersContainer.appendChild(layerDiv);
      });

      if (group._groupCheckbox) {
        const allVisible = group.layers.every(l => l.visible !== false);
        const anyVisible = group.layers.some(l => l.visible !== false);
        group._groupCheckbox.checked = allVisible;
        group._groupCheckbox.indeterminate = !allVisible && anyVisible;
      }

      wrapper.appendChild(layersContainer);
    });

    this._container.appendChild(wrapper);
    return this._container;
  }

  _createGroupToggle(group) {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '8px';
    div.style.padding = '4px 0';
    div.style.cursor = 'pointer';
    div.style.fontWeight = 'bold';
    div.style.fontSize = '13px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = false;
    checkbox.id = `group-ctrl-${group._prefix || "m"}-${group.title.replace(/\s+/g, '-')}`;

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.textContent = group.title;
    label.style.cursor = 'pointer';
    label.style.flex = '1';

    checkbox.addEventListener('click', () => {
      const newState = checkbox.indeterminate ? true : checkbox.checked;
      checkbox.indeterminate = false;

      group.layers.forEach(({layerId}) => {
        const layerCheckbox = document.getElementById(`layer-ctrl-${layerId}`);
        if (layerCheckbox) {
          layerCheckbox.checked = newState;
          layerCheckbox.dispatchEvent(new Event('change'));
        }
      });
    });

    group._groupCheckbox = checkbox;

    div.appendChild(checkbox);
    div.appendChild(label);

    return div;
  }

  _createLayerToggle(layer, group) {
    const { name, layerId, color, visible, onToggle } = layer;
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '8px';
    div.style.padding = '4px 0';
    div.style.cursor = 'pointer';
    div.style.fontSize = '12px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = visible;
    checkbox.id = `layer-ctrl-${layerId}`;

    const colorCircle = document.createElement('span');
    colorCircle.style.width = '10px';
    colorCircle.style.height = '10px';
    colorCircle.style.borderRadius = '50%';
    colorCircle.style.backgroundColor = color;
    colorCircle.style.display = 'inline-block';
    colorCircle.style.flexShrink = '0';

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.textContent = name;
    label.style.cursor = 'pointer';
    label.style.flex = '1';

    checkbox.addEventListener('change', () => {
      if (onToggle) {
        onToggle(checkbox.checked);
      } else {
        const visibility = checkbox.checked ? 'visible' : 'none';
        const targetIds = expandLogicalLayerIds(layerId);
        targetIds.forEach((id) => {
          if (this._map.getLayer(id)) {
            this._map.setLayoutProperty(id, 'visibility', visibility);
          }
        });
      }

      if (group && group._groupCheckbox && group.layers.length > 1) {
        const checkedLayers = group.layers.filter((l) => {
          const cb = document.getElementById(`layer-ctrl-${l.layerId}`);
          return cb && cb.checked;
        }).length;

        if (checkedLayers === 0) {
          group._groupCheckbox.checked = false;
          group._groupCheckbox.indeterminate = false;
        } else if (checkedLayers === group.layers.length) {
          group._groupCheckbox.checked = true;
          group._groupCheckbox.indeterminate = false;
        } else {
          group._groupCheckbox.checked = false;
          group._groupCheckbox.indeterminate = true;
        }
      }
    });

    div.appendChild(checkbox);
    div.appendChild(colorCircle);
    div.appendChild(label);

    return div;
  }

  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}
