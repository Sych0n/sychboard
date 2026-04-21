const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

function createPNG(width, height, getPixel) {
  const channels = 4
  const raw = Buffer.alloc(height * (1 + width * channels))
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * channels)] = 0 // filter type
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height)
      const i = y * (1 + width * channels) + 1 + x * channels
      raw[i] = r; raw[i+1] = g; raw[i+2] = b; raw[i+3] = a
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 })
  function chunk(type, data) {
    const buf = Buffer.alloc(12 + data.length)
    buf.writeUInt32BE(data.length, 0)
    buf.write(type, 4, 'ascii')
    data.copy(buf, 8)
    const crc = crc32(Buffer.concat([Buffer.from(type, 'ascii'), data]))
    buf.writeInt32BE(crc, 8 + data.length)
    return buf
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const sig = Buffer.from([137,80,78,71,13,10,26,10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))])
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return c ^ -1
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
function mix(a, b, t) { return a + (b - a) * t }

// Draw the "S" using a set of bezier curves approximated as line segments
// Returns signed distance from the "S" shape
function sDistToS(px, py) {
  // Normalized coords: center at 0,0, roughly -0.5 to 0.5
  const x = px, y = py

  // S is drawn as a stroke path; we compute distance to segments
  // Upper arc of S: top half curves right-to-left
  // Lower arc of S: bottom half curves left-to-right
  // We'll use a thick-stroke approach with polyline approximation

  const strokeW = 0.085

  // Upper bowl: bezier from (0.18, -0.04) through (0.22, -0.38) to (-0.18, -0.38) then to (-0.22, -0.18) to (0, 0)
  const upperPts = bezierPoly([
    [0.0, 0.04],
    [0.22, 0.04],
    [0.25, -0.32],
    [0.0, -0.36],
    [-0.22, -0.36],
    [-0.25, -0.08],
    [0.0, 0.0]
  ])

  // Lower bowl: bezier from (0, 0) through (-0.25, 0.08) to (0, 0.36) to (0.25, 0.36) to (0.25, 0.08) to (0, -0.04)
  const lowerPts = bezierPoly([
    [0.0, 0.0],
    [0.25, 0.08],
    [0.25, 0.36],
    [0.0, 0.38],
    [-0.22, 0.36],
    [-0.25, 0.08],
    [0.0, -0.04]
  ])

  let minDist = Infinity

  for (const pts of [upperPts, lowerPts]) {
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distToSegment(x, y, pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1])
      if (d < minDist) minDist = d
    }
  }

  return minDist - strokeW
}

function bezierPoly(pts) {
  // Treat as catmull-rom style polyline with subdivision
  const out = []
  const steps = 24
  for (let i = 0; i < pts.length - 1; i++) {
    for (let t = 0; t <= steps; t++) {
      const tt = t / steps
      // Hermite-style: just lerp between pts for now (piecewise linear)
      // For smoother curves, do cubic bezier with control points
      const x = pts[i][0] + (pts[i+1][0] - pts[i][0]) * tt
      const y = pts[i][1] + (pts[i+1][1] - pts[i][1]) * tt
      out.push([x, y])
    }
  }
  return out
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay
  const lenSq = dx*dx + dy*dy
  if (lenSq === 0) return Math.hypot(px - ax, py - ay)
  const t = clamp(((px-ax)*dx + (py-ay)*dy) / lenSq, 0, 1)
  return Math.hypot(px - (ax + t*dx), py - (ay + t*dy))
}

// Better S path using cubic beziers
function sCubicDist(px, py) {
  const strokeW = 0.09
  // Sample many points along the S shape
  const pts = genSPath()
  let minD = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment(px, py, pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1])
    if (d < minD) minD = d
  }
  return minD - strokeW
}

function cubicBezier(p0, p1, p2, p3, t) {
  const mt = 1 - t
  return [
    mt*mt*mt*p0[0] + 3*mt*mt*t*p1[0] + 3*mt*t*t*p2[0] + t*t*t*p3[0],
    mt*mt*mt*p0[1] + 3*mt*mt*t*p1[1] + 3*mt*t*t*p2[1] + t*t*t*p3[1]
  ]
}

function genSPath() {
  const pts = []
  const N = 60

  // Upper arc: top-right going counter-clockwise to middle
  const upper = [
    [0.08, 0.03],   // start (middle, slightly below center)
    [0.26, 0.02],   // control 1
    [0.28, -0.36],  // control 2
    [-0.08, -0.38]  // end (top left area)
  ]
  // Continue upper arc
  const upper2 = [
    [-0.08, -0.38],
    [-0.30, -0.38],
    [-0.30, -0.08],
    [0.0, 0.0]
  ]

  // Lower arc: from middle going to bottom
  const lower = [
    [0.0, 0.0],
    [0.30, 0.06],
    [0.30, 0.36],
    [0.08, 0.38]
  ]
  const lower2 = [
    [0.08, 0.38],
    [-0.26, 0.38],
    [-0.26, 0.04],
    [-0.08, -0.03]
  ]

  for (const seg of [upper, upper2, lower, lower2]) {
    for (let i = 0; i <= N; i++) {
      pts.push(cubicBezier(seg[0], seg[1], seg[2], seg[3], i/N))
    }
  }
  return pts
}

function makeIconPixel(maskable) {
  const sPts = genSPath()
  return function(x, y, w, h) {
    // Normalized coords -0.5..0.5
    const nx = (x + 0.5) / w - 0.5
    const ny = (y + 0.5) / h - 0.5

    // Background
    const bgR = 17, bgG = 17, bgB = 24

    // Purple accent
    const acR = 139, acG = 92, acB = 246

    // Rounded rect mask (for non-maskable)
    const radius = maskable ? 0.5 : 0.18
    const inShape = roundedRectSDF(nx, ny, 0.46, 0.46, radius) < 0

    if (!inShape) return [0,0,0,0]

    // Subtle radial gradient bg
    const dist = Math.hypot(nx, ny)
    const bgBlend = clamp(1 - dist * 1.2, 0, 1)
    const bgR2 = Math.round(mix(bgR, 22, bgBlend))
    const bgG2 = Math.round(mix(bgG, 22, bgBlend))
    const bgB2 = Math.round(mix(bgB, 32, bgBlend))

    // Distance to S shape (anti-aliased)
    let minD = Infinity
    for (let i = 0; i < sPts.length - 1; i++) {
      const d = distToSegment(nx, ny, sPts[i][0], sPts[i][1], sPts[i+1][0], sPts[i+1][1])
      if (d < minD) minD = d
    }
    const strokeW = 0.085
    const aa = 1.5 / w // anti-alias width in normalized units
    const sDist = minD - strokeW
    const sAlpha = clamp((-sDist) / aa, 0, 1)

    // Glow effect
    const glowR = 0.18
    const glow = clamp(1 - minD / glowR, 0, 1) * 0.3

    const r = Math.round(mix(bgR2, acR, sAlpha) + (acR - bgR2) * glow * (1 - sAlpha))
    const g = Math.round(mix(bgG2, acG, sAlpha) + (acG - bgG2) * glow * (1 - sAlpha))
    const b = Math.round(mix(bgB2, acB, sAlpha) + (acB - bgB2) * glow * (1 - sAlpha))

    return [clamp(r,0,255), clamp(g,0,255), clamp(b,0,255), 255]
  }
}

function roundedRectSDF(x, y, hw, hh, r) {
  const qx = Math.abs(x) - hw + r
  const qy = Math.abs(y) - hh + r
  return Math.hypot(Math.max(qx,0), Math.max(qy,0)) + Math.min(Math.max(qx,qy),0) - r
}

const outDir = path.join(__dirname, '..', 'src', 'icons')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

const sizes = [72, 96, 128, 144, 180, 192, 512]
console.log('Generating icons...')

for (const size of sizes) {
  const px = makeIconPixel(false)
  const buf = createPNG(size, size, px)
  const file = path.join(outDir, `icon-${size}.png`)
  fs.writeFileSync(file, buf)
  console.log(`  icon-${size}.png (${buf.length} bytes)`)
}

// Maskable version (full-bleed, no padding)
const mPx = makeIconPixel(true)
const mBuf = createPNG(512, 512, mPx)
fs.writeFileSync(path.join(outDir, 'icon-maskable-512.png'), mBuf)
console.log('  icon-maskable-512.png')

console.log('Done.')
