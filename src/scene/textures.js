/**
 * Texture loading: the case photograph from a base64 data URL, and the live
 * canvas texture the painter draws into. Imports three.js and touches `Image`.
 */

import * as THREE from '../../vendor/three.module.min.js';

/** Decode a data URL into a mipmapped, anisotropic texture. */
export function loadTexture(renderer, dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.NoColorSpace;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      t.generateMipmaps = true;
      t.needsUpdate = true;
      resolve(t);
    };
    img.src = dataUrl;
  });
}

/** The painter's canvas as a texture: nearest-neighbour, no mipmaps. */
export function canvasTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = false;
  return t;
}
