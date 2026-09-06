/**
 * The power switch. `crt` is passed in (never imported) so the machine layer
 * stays below the scene. Imports nothing.
 */

/** `deps` is `{ machine, snd, boot, crt }`. */
export function createPower(deps) {
  const { machine, snd, boot, crt } = deps;
  return function togglePower() {
    machine.powered = !machine.powered;
    snd.power(machine.powered);
    if (machine.powered) boot.coldStart();
    else {
      crt.target = 0;
      boot.stop();
      snd.drive(false);
    }
  };
}
