// Finding things on a 3D monitor from the outside.
//
// The tube and the hardware live on a mesh, so their screen coordinates depend on
// the camera, the viewport and the case layout — there is no DOM box to click.
// What the page does give us is #hint, which names whatever the pointer is over.
// So: sweep a region, watch the hint, and stop where it names the thing we want.
//
// The sweep runs *inside* the page. Real `page.mouse.move` calls are throttled to
// one browser frame each, and SwiftShader renders at ~10 fps, so a thousand-point
// grid would take two minutes; dispatching the same pointermove events from JS
// takes under a second. The point that comes back is then confirmed with a real
// mouse move, so the click that follows is genuine user input.
/* Callbacks in page.evaluate/addInitScript run in the browser, not in Node. */

/** The current #hint text ('' when the pill is off). */
export function hintText(page) {
  return page.evaluate(() => document.getElementById('hint').textContent.trim());
}

/** Coarse sweep, in-page: first grid point whose hint equals `label`, or null. */
function sweep(page, region, label) {
  return page.evaluate(
    (o) => {
      const canvas = document.getElementById('gl');
      const hint = document.getElementById('hint');
      for (let y = o.y0; y <= o.y1; y += o.step) {
        for (let x = o.x0; x <= o.x1; x += o.step) {
          const ev = new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true });
          canvas.dispatchEvent(ev);
          if (hint.textContent.trim() === o.label) return { x, y };
        }
      }
      return null;
    },
    { ...region, label },
  );
}

/**
 * Locate the point where the pointer is over `label` and leave the real mouse
 * hovering there. Returns {x, y}, or null if the label never shows up.
 */
export async function probeHint(page, region, label) {
  const found = await sweep(page, region, label);
  if (!found) return null;

  // Confirm with the real pointer: the in-page sweep ran against one static
  // frame, so nudge around the hit if the live hover disagrees.
  const d = Math.max(2, Math.round(region.step / 3));
  const candidates = [found];
  for (const dy of [-d, 0, d]) {
    for (const dx of [-d, 0, d]) candidates.push({ x: found.x + dx, y: found.y + dy });
  }
  for (const point of candidates) {
    await page.mouse.move(point.x, point.y);
    if ((await hintText(page)) === label) return point;
  }
  return null;
}

/** The lower-right quadrant of the case, where the power switch sits. */
export function switchRegion({ width, height }) {
  return {
    x0: Math.round(width * 0.5),
    y0: Math.round(height * 0.5),
    x1: width - 2,
    y1: height - 2,
    step: 12,
  };
}

/** The middle of the frame, where the tube is. */
export function tubeRegion({ width, height }) {
  return {
    x0: Math.round(width * 0.08),
    y0: Math.round(height * 0.15),
    x1: Math.round(width * 0.92),
    y1: Math.round(height * 0.88),
    step: 12,
  };
}
