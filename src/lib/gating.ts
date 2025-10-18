// /lib/gating.ts
export type Gate = {
  framed: number;        // 0..1 edge density (max of border/inner rings)
  brightnessOk: boolean;
  glareOk: boolean;
  sharpOk: boolean;
  ok: boolean;
};

/**
 * Center-friendly framing:
 * - Framing = max(edge density of OUTER ring, INNER ring inset ~8%).
 * - Corner fallback samples inset corners (helps when card is centered).
 * Slightly stricter on sharpness, light, and glare.
 */
export function evaluateGate(
  data: ImageData,
  _aspect: number, // API compatibility
  opts?: {
    frameCoverage?: number;  // min density (default 0.30)
    minSharp?: number;       // default 4.0
    glareMax?: number;       // default 0.16
    brightnessMin?: number;  // default 0.14
    brightnessMax?: number;  // default 0.94
    ringPx?: number;         // ring thickness (auto)
    insetRatio?: number;     // inner ring inset ratio of min(W,H), default 0.08
  }
): Gate {
  const { width: W, height: H, data: px } = data;

  // Slightly stricter defaults
  const cfg = {
    frameCoverage: 0.30,
    minSharp: 4.0,
    glareMax: 0.16,
    brightnessMin: 0.14,
    brightnessMax: 0.94,
    ringPx: Math.max(3, Math.min(12, Math.floor(Math.min(W, H) * 0.025))), // 3..12px
    insetRatio: 0.08, // 8% inset for inner ring
    ...opts,
  };

  const STRIDE = 2; // sample every 2px

  const lumaAt = (i: number) => px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722;

  // --- Global stats: brightness & gradient (lenient-but-fair sharpness)
  let sumY = 0, cnt = 0, gradSum = 0, gradN = 0;
  for (let y = 0; y < H; y += STRIDE) {
    for (let x = 0; x < W; x += STRIDE) {
      const i = (y * W + x) * 4, Y = lumaAt(i);
      sumY += Y; cnt++;
      if (x + STRIDE < W) { gradSum += Math.abs(Y - lumaAt(i + STRIDE * 4)); gradN++; }
      if (y + STRIDE < H) { gradSum += Math.abs(Y - lumaAt(i + STRIDE * W * 4)); gradN++; }
    }
  }
  const brightness = cnt ? (sumY / cnt) / 255 : 0;
  const brightnessOk = brightness > cfg.brightnessMin && brightness < cfg.brightnessMax;

  const avgGrad = gradN ? (gradSum / gradN) : 0;
  const sharpOk = avgGrad > cfg.minSharp;

  // --- Glare (near-white coverage)
  let whites = 0;
  for (let y = 0; y < H; y += STRIDE) {
    for (let x = 0; x < W; x += STRIDE) {
      const i = (y * W + x) * 4;
      if (lumaAt(i) > 245) whites++;
    }
  }
  const glareOk = (whites / cnt) < cfg.glareMax;

  // --- Edge helper (slightly stricter)
  const edgeThresh = Math.max(6, avgGrad * 0.8 + 6);
  const isEdge = (Y: number, i: number, x: number, y: number) => {
    let g = 0, m = 0;
    if (x + STRIDE < W) { g += Math.abs(Y - lumaAt(i + STRIDE * 4)); m++; }
    if (y + STRIDE < H) { g += Math.abs(Y - lumaAt(i + STRIDE * W * 4)); m++; }
    return m ? (g / m) > edgeThresh : false;
  };

  // --- Ring sampler (outer & inner)
  function ringDensity(insetPx: number, ringPx: number) {
    let hits = 0, tot = 0;

    const xL0 = insetPx, xL1 = Math.min(insetPx + ringPx, W);
    const xR0 = Math.max(0, W - insetPx - ringPx), xR1 = Math.max(0, W - insetPx);
    const yT0 = insetPx, yT1 = Math.min(insetPx + ringPx, H);
    const yB0 = Math.max(0, H - insetPx - ringPx), yB1 = Math.max(0, H - insetPx);

    // top
    for (let y = yT0; y < yT1; y += STRIDE) for (let x = insetPx; x < W - insetPx; x += STRIDE) {
      const i = (y * W + x) * 4, Y = lumaAt(i); if (isEdge(Y, i, x, y)) hits++; tot++;
    }
    // bottom
    for (let y = yB0; y < yB1; y += STRIDE) for (let x = insetPx; x < W - insetPx; x += STRIDE) {
      const i = (y * W + x) * 4, Y = lumaAt(i); if (isEdge(Y, i, x, y)) hits++; tot++;
    }
    // left
    for (let x = xL0; x < xL1; x += STRIDE) for (let y = insetPx; y < H - insetPx; y += STRIDE) {
      const i = (y * W + x) * 4, Y = lumaAt(i); if (isEdge(Y, i, x, y)) hits++; tot++;
    }
    // right
    for (let x = xR0; x < xR1; x += STRIDE) for (let y = insetPx; y < H - insetPx; y += STRIDE) {
      const i = (y * W + x) * 4, Y = lumaAt(i); if (isEdge(Y, i, x, y)) hits++; tot++;
    }

    return tot ? hits / tot : 0;
  }

  const insetPx = Math.max(0, Math.floor(Math.min(W, H) * cfg.insetRatio));
  const ringPx = Math.min(cfg.ringPx, Math.floor(Math.min(W, H) / 3));
  const outerDensity = ringDensity(0, ringPx);
  const innerDensity = ringDensity(insetPx, ringPx);
  const framedDensity = Math.max(outerDensity, innerDensity);

  // --- Inset corner fallback (slightly stricter)
  const cornerSize = Math.max(10, Math.floor(Math.min(W, H) * 0.08));
  function cornerDensity(x0: number, y0: number) {
    let hits = 0, tot = 0;
    const x1 = Math.min(W, x0 + cornerSize), y1 = Math.min(H, y0 + cornerSize);
    for (let y = y0; y < y1; y += STRIDE) {
      for (let x = x0; x < x1; x += STRIDE) {
        const i = (y * W + x) * 4, Y = lumaAt(i);
        if (isEdge(Y, i, x, y)) hits++;
        tot++;
      }
    }
    return tot ? hits / tot : 0;
  }
  const cTL = cornerDensity(insetPx, insetPx);
  const cTR = cornerDensity(Math.max(0, W - insetPx - cornerSize), insetPx);
  const cBL = cornerDensity(insetPx, Math.max(0, H - insetPx - cornerSize));
  const cBR = cornerDensity(Math.max(0, W - insetPx - cornerSize), Math.max(0, H - insetPx - cornerSize));

  const CORNER_MIN = 0.09; // a bit stricter than before
  const cornerCount =
    (cTL > CORNER_MIN ? 1 : 0) +
    (cTR > CORNER_MIN ? 1 : 0) +
    (cBL > CORNER_MIN ? 1 : 0) +
    (cBR > CORNER_MIN ? 1 : 0);

  // --- Acceptance (slightly stricter)
  const framedOk   = framedDensity >= cfg.frameCoverage || cornerCount >= 1;
  const framedNear = framedDensity >= cfg.frameCoverage * 0.90 || cornerCount >= 1;

  const passCount =
    (brightnessOk ? 1 : 0) +
    (glareOk ? 1 : 0) +
    (sharpOk ? 1 : 0) +
    (framedOk ? 1 : 0);

  const ok =
    passCount >= 3 ||
    ((brightnessOk && glareOk) && (framedOk || framedNear)) ||
    (framedOk && avgGrad > cfg.minSharp * 0.75); // require a bit more sharpness on fallback

  return {
    framed: framedDensity,
    brightnessOk,
    glareOk,
    sharpOk,
    ok,
  };
}
