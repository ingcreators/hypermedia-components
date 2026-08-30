// lifecycle.js — shared instance-lifecycle helpers for the install()
// observers.
//
// Every installX() keeps a Map<Element, detach> of live attachments
// and a MutationObserver that attaches newly-ADDED instances. Nothing
// ever handled REMOVALS: an instance swapped out of the document
// stayed in the Map forever — its detacher never ran, so listeners on
// shared targets stayed registered (the datagrid's `window` hashchange
// listener, its shared overflow-tooltip node) and the Map pinned the
// whole detached subtree against garbage collection. On a long-lived
// hypermedia page that swaps instances in and out, that grows without
// bound.
//
// pruneDetachers(detachers) runs the detacher of every instance that
// is no longer connected and drops it from the Map. Call it from the
// install observer whenever a mutation batch removed nodes (gate with
// hasRemovals so pure-insertion batches pay nothing). An element that
// merely MOVED inside the same batch is connected again by the time
// the observer callback runs, so it is left alone — only genuine
// departures are detached.
//
// Internal module — not exported from the package entry.

/**
 * @param {MutationRecord[]} records
 * @returns {boolean} true when any record in the batch removed nodes.
 */
export function hasRemovals(records) {
  for (const rec of records) {
    if (rec.removedNodes.length > 0) return true;
  }
  return false;
}

/**
 * Detach and forget every instance that left the document.
 *
 * @param {Map<Element, () => void>} detachers
 */
export function pruneDetachers(detachers) {
  for (const [el, detach] of detachers) {
    if (el.isConnected) continue;
    detachers.delete(el);
    detach();
  }
}
