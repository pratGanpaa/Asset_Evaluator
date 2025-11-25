// ---------- Fuzzy Helpers ----------
function fuzzyLow(x, min, max) {
  if (x <= min) return 1;
  if (x >= max) return 0;
  return Math.pow((max - x) / (max - min), 0.7);
}

function fuzzyMedium(x, min, mid, max) {
  if (x <= min || x >= max) return 0;
  if (x === mid) return 1;
  return x < mid
    ? Math.pow((x - min) / (mid - min), 0.8)
    : Math.pow((max - x) / (max - mid), 0.8);
}

function fuzzyHigh(x, min, max) {
  if (x <= min) return 0;
  if (x >= max) return 1;
  return Math.pow((x - min) / (max - min), 0.7);
}

// ---------- Normalization ----------
const normalizeGrowth = (g) =>
  Math.max(0, Math.min(1, (parseFloat(g) + 50) / 100));
const normalizeVol = (v) => Math.max(0, Math.min(1, v / 100));
const normalizeEco = (e) => Math.max(0, Math.min(1, (parseFloat(e) + 10) / 20));
const normalizeTrend = (t) =>
  Math.max(0, Math.min(1, (parseFloat(t) + 5) / 10));

// ---------- Neural Network ----------
function neuralProcess(x) {
  const w1 = {
    growth: [0.4, -0.15, 0.25, 0.3],
    volatility: [-0.25, -0.3, 0.1, -0.2],
    economic: [0.3, 0.35, -0.1, 0.25],
    industry: [0.25, 0.2, 0.3, 0.15],
  };
  const w2 = [0.35, 0.3, 0.2, 0.15];
  const b1 = [0.1, -0.05, 0.15, 0.08];
  const b2 = 0.05;
  let h = [],
    out = b2;
  for (let i = 0; i < 4; i++) {
    let s =
      b1[i] +
      x.growth * w1.growth[i] +
      x.volatility * w1.volatility[i] +
      x.economic * w1.economic[i] +
      x.industry * w1.industry[i];
    h.push(Math.max(0, s));
    out += h[i] * w2[i];
  }
  let z = Math.tanh(out * 1.2) + x.growth * 0.15;
  return Math.tanh(z);
}

// ---------- Fuzzy Inference ----------
function fuzzyInference(nOut, vol, growth, eco) {
  let gL = fuzzyLow(nOut, -0.6, 0.2),
    gM = fuzzyMedium(nOut, -0.2, 0.5, 0.85),
    gH = fuzzyHigh(nOut, 0.3, 1);
  let vL = fuzzyLow(vol, 0, 0.35),
    vM = fuzzyMedium(vol, 0.25, 0.5, 0.75),
    vH = fuzzyHigh(vol, 0.65, 1);
  let eP = fuzzyHigh(eco, 0.4, 1),
    eN = fuzzyMedium(eco, 0.2, 0.5, 0.8),
    eNeg = fuzzyLow(eco, 0, 0.6);

  let growthState = gH >= gM && gH >= gL ? "high" : gM >= gL ? "medium" : "low";
  let volState = vH >= vM && vH >= vL ? "high" : vM >= vL ? "medium" : "low";
  let ecoState =
    eP >= eN && eP >= eNeg ? "positive" : eN >= eNeg ? "neutral" : "negative";

  let output = 0.5,
    confidence = "Moderate";
  if (growthState === "high") {
    if (volState === "low")
      output =
        ecoState === "positive" ? 0.95 : ecoState === "neutral" ? 0.9 : 0.82;
    else if (volState === "medium")
      output =
        ecoState === "positive" ? 0.85 : ecoState === "neutral" ? 0.78 : 0.68;
    else
      output =
        ecoState === "positive" ? 0.7 : ecoState === "neutral" ? 0.6 : 0.48;
  } else if (growthState === "medium") {
    if (volState === "low")
      output =
        ecoState === "positive" ? 0.8 : ecoState === "neutral" ? 0.72 : 0.62;
    else if (volState === "medium")
      output =
        ecoState === "positive" ? 0.68 : ecoState === "neutral" ? 0.55 : 0.42;
    else
      output =
        ecoState === "positive" ? 0.5 : ecoState === "neutral" ? 0.38 : 0.28;
  } else {
    if (volState === "low")
      output =
        ecoState === "positive" ? 0.45 : ecoState === "neutral" ? 0.35 : 0.25;
    else if (volState === "medium")
      output =
        ecoState === "positive" ? 0.32 : ecoState === "neutral" ? 0.22 : 0.15;
    else
      output =
        ecoState === "positive" ? 0.2 : ecoState === "neutral" ? 0.12 : 0.05;
  }

  const act = Math.min(
    Math.max(gL, gM, gH),
    Math.max(vL, vM, vH),
    Math.max(eP, eN, eNeg)
  );
  const adj = 0.5 + (output - 0.5) * Math.pow(act, 0.85);
  const certainty = Math.min(1, act * 1.2);
  return { crisp: adj * (0.85 + certainty * 0.15), certainty };
}

// ---------- Main Calculation ----------
function calculate() {
  const curr = parseFloat(document.getElementById("currentValue").value);
  const g = parseFloat(document.getElementById("growth").value);
  const v = parseFloat(document.getElementById("volatility").value);
  const e = parseFloat(document.getElementById("economic").value);
  const i = parseFloat(document.getElementById("industry").value);
  const T = parseInt(document.getElementById("horizon").value);

  const input = {
    growth: normalizeGrowth(g),
    volatility: normalizeVol(v),
    economic: normalizeEco(e),
    industry: normalizeTrend(i),
  };

  const neural = neuralProcess(input);
  const fuz = fuzzyInference(
    neural,
    input.volatility,
    input.growth,
    input.economic
  );

  const base = 1 + (fuz.crisp - 0.5) * 2 * 0.35;
  const boost = (input.industry - 0.5) * 0.15;
  const final = curr * Math.pow(base * (1 + boost), T);

  const volAdj = input.volatility * 0.18 * (1.2 - fuz.certainty * 0.4);
  const low = final * (1 - volAdj);
  const high = final * (1 + volAdj);

  document.getElementById("output").innerHTML = `
  <div class='resultBox'>
    <div class='value'>Predicted Value: ₹ ${final.toFixed(2)}</div>
    <div class='small'>Range: ₹${low.toFixed(2)} — ₹${high.toFixed(2)}</div><br>
    <div>Estimated Growth Rate: ${((100 * (final - curr)) / curr).toFixed(
      2
    )}%</div>
  </div>`;
}