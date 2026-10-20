// Phase 1a placeholders. Each card is replaced by its real implementation in its
// own file as the sub-phases land; a later registerCard() with the same id wins.
(function () {
  'use strict'
  const G = window.Gaming
  G.registerCard({ id: 'mouse', title: 'Mouse', order: 30, render: b => G.placeholder(b, 'Mouse tools (DPI / polling rate)') })
})()
