import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.min.js';
import { createLayout } from '../../../src/scene/layout.js';
import { TextBuffer } from '../../../src/screen/text-buffer.js';

function fixture(t) {
  globalThis.window = { devicePixelRatio: 1 };
  t.after(() => {
    delete globalThis.window;
  });
  const canvas = { clientWidth: 390, clientHeight: 844 };
  const renderer = {
    domElement: canvas,
    setPixelRatio: t.mock.fn(),
    setSize: t.mock.fn(),
  };
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const monitor = new THREE.Mesh(new THREE.BufferGeometry());
  const post = { sizeTargets: t.mock.fn() };
  const buffer = new TextBuffer(40, 25);
  const tube = {
    crt: { uniforms: { uDpr: { value: 1 }, uFit: { value: new THREE.Vector2() } } },
    setResolution() {},
    fitAperture() {},
    touch() {},
  };
  const painter = { width: 336, height: 216, sync() {}, render() {} };
  const result = createLayout({
    renderer,
    camera,
    monitor,
    post,
    buffer,
    tube,
    painter,
    rig: new THREE.Group(),
    ledPower: new THREE.Object3D(),
    machine: { sel: 0 },
    content: { menu: [1] },
    repaint() {},
    relayoutDoc() {},
  });
  return { ...result, canvas, renderer, camera, monitor, post, buffer, tube };
}

test('layout keeps camera, grid and targets current across rotation and late DPR', (t) => {
  const f = fixture(t);
  f.layout();
  assert.ok(f.buffer.cols < 40);
  assert.equal(f.camera.aspect, 390 / 844);
  const portraitProjection = f.camera.projectionMatrix.clone();
  f.canvas.clientWidth = 844;
  f.canvas.clientHeight = 390;
  f.layout();
  assert.equal(f.camera.aspect, 844 / 390);
  assert.equal(f.buffer.cols, 40);
  globalThis.window.devicePixelRatio = 3;
  f.layout();
  assert.equal(f.tube.crt.uniforms.uDpr.value, 2);
  assert.deepEqual(f.post.sizeTargets.mock.calls.at(-1).arguments, [1688, 780]);
  f.canvas.clientWidth = 390;
  f.canvas.clientHeight = 844;
  f.layout();
  assert.ok(f.buffer.cols < 40);
  assert.deepEqual(f.camera.projectionMatrix, portraitProjection);
  assert.deepEqual(f.post.sizeTargets.mock.calls.at(-1).arguments, [780, 1688]);
});

test('unchanged or zero dimensions do not allocate or corrupt the last layout', (t) => {
  const f = fixture(t);
  f.layout();
  const geometry = f.monitor.geometry;
  const projection = f.camera.projectionMatrix.clone();
  for (let i = 0; i < 20; i++) f.layout();
  f.canvas.clientHeight = 0;
  f.layout();
  assert.equal(f.monitor.geometry, geometry);
  assert.deepEqual(f.camera.projectionMatrix, projection);
  assert.equal(f.post.sizeTargets.mock.callCount(), 1);
  assert.equal(f.renderer.setSize.mock.callCount(), 1);
  f.canvas.clientHeight = 844;
  f.layout();
  assert.equal(f.post.sizeTargets.mock.callCount(), 1);
});
