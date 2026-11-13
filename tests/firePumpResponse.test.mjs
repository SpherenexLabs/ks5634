import assert from 'node:assert/strict'
import { createFirePumpResponse } from '../src/firePumpResponse.js'
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
function setup(writeImpl) {
  const writes = []
  let timer = null
  const controller = createFirePumpResponse({
    write: (on) => { writes.push(on); return writeImpl?.(on) },
    schedule: (callback, ms) => { assert.equal(ms, 3000); timer = callback; return 1 },
    cancel: () => { timer = null },
  })
  return { controller, writes, expire: () => { const callback = timer; timer = null; callback() }, hasTimer: () => timer !== null }
}
// ON is issued in the detection call, held through continuing fire, OFF on clear.
{
 const t = setup(); t.controller.setFire(true); assert.deepEqual(t.writes, [true]);
 await flush(); t.controller.setFire(true); assert.deepEqual(t.writes, [true]);
 t.expire(); await flush(); assert.deepEqual(t.writes, [true]);
 t.controller.setFire(false); assert.deepEqual(t.writes, [true, false]); await flush();
 t.controller.setFire(true); assert.deepEqual(t.writes, [true, false, true]);
}
// A brief detection gets the full pulse, starting after write acknowledgement.
{
 let acknowledge; const t = setup((on) => on ? new Promise(resolve => { acknowledge = resolve }) : undefined);
 t.controller.setFire(true); t.controller.setFire(false); assert.equal(t.hasTimer(), false);
 acknowledge(); await flush(); assert.equal(t.hasTimer(), true); assert.deepEqual(t.writes, [true]);
 t.expire(); await flush(); assert.deepEqual(t.writes, [true, false]);
}
// External OFF while fire is active reasserts ON without duplicate pending writes.
{
 let acknowledge; const t = setup(() => new Promise(resolve => { acknowledge = resolve }));
 t.controller.setFire(true); t.controller.observeRelay(false); assert.deepEqual(t.writes, [true]);
 acknowledge(); await flush(); t.controller.observeRelay(false); assert.deepEqual(t.writes, [true, true]);
}
// A failed write can retry on the next detection update without an unhandled rejection.
{
 let fail = true; const t = setup(() => fail ? Promise.reject(new Error('denied')) : undefined);
 t.controller.setFire(true); await flush(); fail = false; t.controller.setFire(true); await flush();
 assert.deepEqual(t.writes, [true, true]); assert.equal(t.hasTimer(), true);
 t.controller.dispose(); assert.equal(t.hasTimer(), false);
}
// A new detection during an in-flight OFF must immediately turn back ON after it completes.
{
 let finishOff; const t = setup(on => on ? undefined : new Promise(resolve => { finishOff = resolve }));
 t.controller.setFire(true); await flush(); t.expire(); t.controller.setFire(false);
 t.controller.setFire(true); finishOff(); await flush(); assert.deepEqual(t.writes, [true, false, true]);
}
console.log('Fire response regression checks passed: immediate ON, sustained fire, minimum pulse, slow acknowledgement, external overwrite, write failure, and re-detection.')