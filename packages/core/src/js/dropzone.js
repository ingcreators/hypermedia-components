// dropzone behavior — the drag path of hc-dropzone.
//
//   <label class="hc-dropzone">
//     <input class="hc-dropzone__input" type="file" name="doc">
//     <span class="hc-dropzone__body">
//       <span class="hc-dropzone__hint">Drop a file here, or click to browse</span>
//       <span class="hc-dropzone__files"></span>
//     </span>
//   </label>
//
// Click-to-browse and keyboard are 100 % native (the label opens the
// picker; focus lives on the hidden-but-focusable input). This behavior
// only adds the pointer enhancement:
//
//   - while a file drags over the zone, `data-dragover` is set (styled
//     by hc-dropzone.css; cleared on leave/drop/dragend, with the
//     classic relatedTarget guard against child-element flicker);
//   - a drop assigns `dataTransfer.files` to the input (a single-file
//     input takes only the first file) and dispatches a bubbling
//     `change` — from that point the browser cannot tell the files
//     weren't picked normally, so form serialization, validation, the
//     upload-progress bridge and the file-upload contract all work
//     unchanged;
//   - on every `change` (drop or native browse) the selected file names
//     are rendered into `.hc-dropzone__files` (names are data — no i18n).
//
// installDropzone(root = document) returns an uninstaller. Idempotent.

const INSTALL_KEY = '__hcDropzoneUninstall';
const ZONE = '.hc-dropzone';

function zoneOf(event) {
  return event.target?.closest?.(ZONE) ?? null;
}

function inputOf(zone) {
  return zone.querySelector('.hc-dropzone__input, input[type="file"]');
}

function draggingFiles(event) {
  const types = event.dataTransfer?.types;
  return !!types && Array.prototype.includes.call(types, 'Files');
}

function renderNames(zone, input) {
  const out = zone.querySelector('.hc-dropzone__files');
  if (!out) return;
  const names = [...(input.files ?? [])].map((f) => f.name);
  out.textContent = names.join(', ');
}

/**
 * Install the hc-dropzone drag enhancement: `.hc-dropzone` zones set
 * `data-dragover` while a file drags over, and a drop assigns the files
 * to the wrapped input (respecting `multiple`) and fires a bubbling
 * `change`. Selected file names render into `.hc-dropzone__files` on
 * every change, dropped or browsed.
 *
 * @param {Document|Element} [root]
 *   The root to listen on. Defaults to the global document.
 * @returns {() => void} an idempotent uninstaller.
 *
 * @example
 * import { installDropzone } from '@hypermedia-components/core';
 * installDropzone();
 */
export function installDropzone(
  root = typeof document !== 'undefined' ? document : null,
) {
  if (!root) return () => {};
  if (root[INSTALL_KEY]) return root[INSTALL_KEY];

  function onDragover(event) {
    const zone = zoneOf(event);
    if (!zone || !draggingFiles(event)) return;
    if (inputOf(zone)?.disabled) return;
    event.preventDefault(); // required to allow the drop
    zone.setAttribute('data-dragover', '');
  }

  function onDragleave(event) {
    const zone = zoneOf(event);
    if (!zone) return;
    // Moving between the zone's own children fires dragleave too — only
    // clear when the pointer actually left the zone.
    if (event.relatedTarget && zone.contains(event.relatedTarget)) return;
    zone.removeAttribute('data-dragover');
  }

  function onDragend(event) {
    zoneOf(event)?.removeAttribute('data-dragover');
  }

  function onDrop(event) {
    const zone = zoneOf(event);
    if (!zone) return;
    zone.removeAttribute('data-dragover');
    if (!draggingFiles(event)) return;
    const input = inputOf(zone);
    if (!input || input.disabled) return;
    event.preventDefault();

    let files = event.dataTransfer.files;
    if (!input.multiple && files.length > 1 && typeof DataTransfer === 'function') {
      const single = new DataTransfer();
      single.items.add(files[0]);
      files = single.files;
    }
    input.files = files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function onChange(event) {
    const zone = zoneOf(event);
    if (!zone) return;
    const input = inputOf(zone);
    if (input && event.target === input) renderNames(zone, input);
  }

  root.addEventListener('dragover', onDragover);
  root.addEventListener('dragleave', onDragleave);
  root.addEventListener('dragend', onDragend);
  root.addEventListener('drop', onDrop);
  root.addEventListener('change', onChange);

  const uninstall = () => {
    if (root[INSTALL_KEY] !== uninstall) return;
    root.removeEventListener('dragover', onDragover);
    root.removeEventListener('dragleave', onDragleave);
    root.removeEventListener('dragend', onDragend);
    root.removeEventListener('drop', onDrop);
    root.removeEventListener('change', onChange);
    delete root[INSTALL_KEY];
  };
  root[INSTALL_KEY] = uninstall;
  return uninstall;
}
