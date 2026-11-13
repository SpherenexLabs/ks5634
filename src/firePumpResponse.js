// Keep a minimum pulse measured from the acknowledged ON write, and hold ON
// for as long as either fire source remains active.
export function createFirePumpResponse({ write, holdMs = 3000, schedule = setTimeout, cancel = clearTimeout }) {
  let fire = false
  let automatic = false
  let minimumElapsed = false
  let observedOn = false
  let pending = null
  let timer = null
  let generation = 0

  function send(on) {
    if (pending !== null) return
    const token = { generation }
    pending = token
    // Call write synchronously so detection starts the Firebase command immediately.
    let result
    try {
      result = write(on)
    } catch {
      pending = null
      return
    }
    Promise.resolve(result).then(() => {
      if (token.generation !== generation) return
      pending = null
      observedOn = on
      if (on && !minimumElapsed && timer === null) {
        timer = schedule(() => {
          timer = null
          minimumElapsed = true
          reconcile()
        }, holdMs)
      }
      if (!on) {
        automatic = fire
        if (fire) minimumElapsed = false
      }
      reconcile()
    }).catch(() => {
      if (token.generation === generation) pending = null
      // The write adapter reports errors. A later detection/relay update can retry.
    })
  }

  function reconcile() {
    if (!automatic) return
    if (fire || !minimumElapsed) {
      if (!observedOn) send(true)
    } else if (observedOn) {
      send(false)
    } else {
      automatic = false
    }
  }

  return {
    setFire(detected) {
      fire = detected
      if (fire && !automatic) {
        automatic = true
        minimumElapsed = false
        observedOn = false
      }
      reconcile()
    },
    observeRelay(on) {
      observedOn = on
      reconcile()
    },
    dispose() {
      generation++
      if (timer !== null) cancel(timer)
      timer = null
      pending = null
      automatic = false
      fire = false
      observedOn = false
      minimumElapsed = false
    },
  }
}
