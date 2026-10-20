// Sensitivity maths. Pure functions, no DOM / Electron, so it runs in the
// renderer (window.GamingSens) and under `node --test` (require).
//
//   inches per 360 = 360 / (yaw * sens * DPI)
//   cm per 360     = inches per 360 * 2.54
//   eDPI           = DPI * sens
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.GamingSens = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  // Degrees of view rotation per mouse count at sens 1. Add a game by adding a row.
  const GAMES = {
    valorant: { name: 'Valorant', yaw: 0.07 },
    cs2: { name: 'CS2', yaw: 0.022 },
    apex: { name: 'Apex Legends', yaw: 0.022 },
    ow2: { name: 'Overwatch 2', yaw: 0.0066 }
  }

  function posNum(v, label) {
    const n = Number(v)
    if (!Number.isFinite(n) || n <= 0) throw new RangeError(`${label} must be a positive number`)
    return n
  }

  function yawFor(gameKey) {
    const g = Object.prototype.hasOwnProperty.call(GAMES, gameKey) ? GAMES[gameKey] : null
    if (!g) throw new RangeError(`Unknown game: ${gameKey}`)
    return g.yaw
  }

  function inchesPer360(gameKey, sens, dpi) {
    return 360 / (yawFor(gameKey) * posNum(sens, 'Sensitivity') * posNum(dpi, 'DPI'))
  }

  function cmPer360(gameKey, sens, dpi) {
    return inchesPer360(gameKey, sens, dpi) * 2.54
  }

  function eDpi(sens, dpi) {
    return posNum(sens, 'Sensitivity') * posNum(dpi, 'DPI')
  }

  // Sens in targetGame that gives the same physical distance per 360 at the same DPI.
  // (DPI cancels out: sens_t = sens_s * yaw_s / yaw_t.)
  function convertSens(fromGame, sens, toGame) {
    return posNum(sens, 'Sensitivity') * yawFor(fromGame) / yawFor(toGame)
  }

  // Everything the UI shows for one input, for every known game.
  function convertAll(fromGame, sens, dpi) {
    const d = posNum(dpi, 'DPI')
    const s = posNum(sens, 'Sensitivity')
    const inches = inchesPer360(fromGame, s, d)
    return {
      source: fromGame,
      dpi: d,
      eDpi: eDpi(s, d),
      inchesPer360: inches,
      cmPer360: inches * 2.54,
      games: Object.keys(GAMES).map(key => ({
        key,
        name: GAMES[key].name,
        sens: convertSens(fromGame, s, key),
        eDpi: convertSens(fromGame, s, key) * d
      }))
    }
  }

  return { GAMES, yawFor, inchesPer360, cmPer360, eDpi, convertSens, convertAll }
})
