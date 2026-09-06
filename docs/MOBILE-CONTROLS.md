# Mobile monitor controls

Touch devices use a four-way rocker and Enter push button photographed into
its lower bezel. Tap a direction to change selection; hold to repeat, or drag
to another direction. In documents the rocker scrolls. Enter opens the selected
menu entry, and returns from a document to the menu. The hardware also works
while booting or powered off through the existing keyboard preflight.

Ordinary tube taps and links do not open a keyboard. READY still offers
optional native typing; there is no custom keyboard, KBD toggle, or mobile
hover badge. Desktop retains its original brightness/contrast/volume knobs.

## Artwork and mapping

- Edit target: `assets/monitor.webp`.
- Generated asset: `assets/monitor-navigation.webp` (1162 × 1000).
- Generated with the built-in imagegen tool, then resized and encoded as WebP
  quality 82 with `sharp-cli@6.1.0`. No new runtime dependency.
- The hardware shader uses only its lower control panel. The original texture
  retains the tube, outer edges and alpha silhouette; the generated file's
  checkerboard outside the monitor is never used as the page background.
- Rocker centre: (738, 905); Enter centre: (891, 914); power LED: (1024, 881).
  These coordinates are texels, projected through the case's **strip** bands,
  not its tube bands. `src/scene/control-bounds.js` owns the mapping.
- `src/input/monitor-controls.js` overlays transparent native buttons on the
  photographed controls, with at least 44px touch targets and press feedback.
  The render loop updates their positions after rendering so the camera's
  movement and rotation/resizing cannot detach the buttons from the artwork.

## Generation prompt

> Use case: precise-object-edit. Asset type: front-facing Commodore 1702 monitor texture for a WebGL website. Input image is the EDIT TARGET. Edit ONLY the bottom control panel below the glass, keeping the monitor silhouette, entire tube aperture, outer case, lighting, beige aged plastic, texture, straight-on orthographic perspective and transparent outside background unchanged. Preserve the original image aspect ratio and dimensions as closely as possible (1162 by 1000). Replace the three small BRIGHT/CONTRAST/VOLUME knobs with a tactile navigation cluster: one substantial round dark-charcoal four-way directional rocker knob, subtle engraved up/down/left/right triangles around its outer rim, and to its right one rectangular dark charcoal mechanical push button with a beveled recessed beige surround and the clearly printed label ENTER above it. Both controls should look like real factory-installed 1980s monitor hardware with real inset shadows and highlights, not a digital UI overlay. Keep the existing small power button and LED at the far right, and the Commodore rainbow 1702 nameplate at the left, though the nameplate may be slightly reduced in width to give the new controls comfortable spacing. Directional knob centered near x=720,y=925, ENTER button centered near x=910,y=925, existing power remains x=1037,y=923. No pill badges, no floating text, no keyboard, no extra buttons. Only change the lower panel hardware; absolutely preserve all geometry above y=850. Output the complete edited monitor texture, not a scene or a mockup.

## Verification

Run `npm run check`. `monitor-controls.spec.js` exercises navigation without
native input, repeat/cancellation, boot and touch target alignment.
`touch.spec.js` covers optional native input and stable keyboard geometry.
Inspect `phone-monitor-controls.png`, `phone-cursor.png` and
`phone-native-input.png` after changing either the asset or its mapping.
Headless browsers do not show an actual iPhone/iPad system keyboard; report
physical-device testing separately from viewport simulation.
