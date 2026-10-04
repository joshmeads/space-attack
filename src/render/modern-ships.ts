import { Graphics } from 'pixi.js';
import type { VectorPath, VectorShipDesign } from '../themes/modern/design';
import { MODERN_EFFECTS } from '../themes/modern/design';
import { MODERN_PALETTE } from '../themes/modern/palette';

function path(graphics: Graphics, points: VectorPath, closed: boolean): void {
  graphics.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index++) {
    const point = points[index];
    if (point) graphics.lineTo(point[0], point[1]);
  }
  if (closed) graphics.closePath();
}

export function createVectorShip(design: VectorShipDesign, color: number): Graphics {
  const ship = new Graphics();
  ship.eventMode = 'none';
  path(ship, design.hull, true);
  ship.fill(MODERN_PALETTE.hull).stroke({ color, width: MODERN_EFFECTS.hullStroke, join: 'round' });
  for (const panel of design.panels) {
    path(ship, panel, true);
    ship.fill({ color, alpha: MODERN_EFFECTS.panelAlpha });
  }
  for (const seam of design.seams) {
    path(ship, seam, false);
    ship.stroke({ color, alpha: 0.65, width: MODERN_EFFECTS.seamStroke });
  }
  for (const light of design.lights) {
    path(ship, light, false);
    ship.stroke({ color: MODERN_PALETTE.white, width: MODERN_EFFECTS.lightStroke });
  }
  return ship;
}
