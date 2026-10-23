// Median / percentile over an ascending-sorted numeric array. Pure, shared by framemetrics.js
// and presentpath.js so the two don't each carry their own copy (renderer: window.GamingStatsMath,
// node: require).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.GamingStatsMath = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  function median(sortedAsc) {
    const n = sortedAsc.length
    if (!n) return null
    return n % 2 ? sortedAsc[(n - 1) / 2] : (sortedAsc[n / 2 - 1] + sortedAsc[n / 2]) / 2
  }

  // The value at the p-th position of the sorted-ascending array (e.g. p=0.95 for the 95th
  // percentile): 100*p % of entries are at or below it.
  function percentile(sortedAsc, p) {
    if (!sortedAsc.length) return null
    return sortedAsc[Math.min(sortedAsc.length - 1, Math.floor(sortedAsc.length * p))]
  }

  return { median, percentile }
})
