// Small helpers for the item models: a mesh of painted parts, merged, with the shared material. An item is seen for a moment at
// speed, so few parts and a clear shape. The pool clones the group per live shot or spill; children keep their names.
import { extras, SHINY } from '../karts/_kit.js';

export function itemKit(ctx) {
  const { THREE, mat, shapes } = ctx, x = extras(ctx), { place, paint, merge } = shapes;
  const piece = (g, color, where, shade) => { if (where) place(g, where); if (color) paint(g, color, 0, shade || null); return g; };
  const mesh = (name, list, opts = SHINY) => { const m = new THREE.Mesh(merge(list), mat('#ffffff', opts)); m.name = name; return m; };
  return { THREE, shapes, x, piece, mesh, group: new THREE.Group() };
}
export const child = (group, name) => group.getObjectByName(name);
// time for a clone that has none: the item's own clock, or a tick of its own
export const clock = (group, s, dt) => { group.userData.t = (group.userData.t ?? Math.random() * 10) + (dt || 0); return group.userData.t; };
