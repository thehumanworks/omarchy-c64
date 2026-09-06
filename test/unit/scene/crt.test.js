import test from 'node:test';
import assert from 'node:assert/strict';
import { createCrt } from '../../../src/scene/crt.js';

test('grid resizing replaces and disposes the uploaded canvas texture', () => {
  const painter = { canvas: { width: 256, height: 496 }, width: 256, height: 496 };
  const tube = createCrt(painter);
  let material;
  const blit = (mat) => {
    material = mat;
  };
  tube.accumulate(blit);
  for (const [width, height] of [
    [336, 216],
    [256, 496],
  ]) {
    const previous = material.uniforms.uNew.value;
    let disposed = false;
    previous.addEventListener('dispose', () => {
      disposed = true;
    });
    painter.canvas.width = width;
    painter.canvas.height = height;
    tube.setResolution(width, height);
    tube.accumulate(blit);
    assert.equal(disposed, true);
    assert.notEqual(material.uniforms.uNew.value, previous);
    assert.equal(material.uniforms.uNew.value.image, painter.canvas);
    assert.deepEqual(tube.crt.uniforms.uRes.value.toArray(), [width, height]);
    assert.equal(tube.crt.uniforms.uTex.value.image.width, width);
    assert.equal(tube.crt.uniforms.uTex.value.image.height, height);
  }
});
