// BeatMarker AE for EffectCraft
// -----------------------------------------------------------------------------
// Port of BeatMarker AE v1.1.0 (https://github.com/samaBR85/BeatMarker-AEPlugin)
// Original author: samaBR. Extended edition: VDD63. License: GPL-3.0.
//
// What changed compared with the After Effects CEP panel:
//   * ScriptUI panel instead of HTML/CEP; lives in Window > BeatMarker.jsx.
//   * No file pickers, no Web Audio, no PCM decoders: EffectCraft decodes the
//     audio for us (Convert Audio to Keyframes on a temporary composition), so
//     every format EffectCraft imports works - WAV, MP3, AIFF, FLAC, OGG,
//     Opus, M4A/AAC, WebM.
//   * Beat detection runs on the amplitude envelope (onset novelty ->
//     autocorrelation tempo -> comb phase -> onset refinement). A PCM-domain
//     tracker such as music-tempo would take minutes in this script engine.
//   * Markers are written through EffectCraft's command layer so beat numbers
//     round-trip exactly (markers.list keeps cuePoint params).
//
// Install: copy this file to
//   %APPDATA%\EffectCraft\Scripts\ScriptUI Panels\
// or run install.ps1, then open Window > BeatMarker.jsx.
// -----------------------------------------------------------------------------

(function (thisObj) {
  "use strict";

  var BM_VERSION = "1.0.0-ec";
  var BM_NAME = "BeatMarker AE";

  // Beat 1..4 labels. EffectCraft (like After Effects 2026) has these names.
  var BEAT_LABELS = ["Red", "Blue", "Yellow", "Aqua"];
  // sRGB for the panel drawing (labels above are what the timeline uses).
  var BEAT_RGB = [
    [0.71, 0.22, 0.22],
    [0.40, 0.49, 0.88],
    [0.89, 0.85, 0.30],
    [0.66, 0.80, 0.78]
  ];

  var HEADLESS = false;
  try {
    HEADLESS = typeof $ !== "undefined" && $.global && !!$.global.BM_HEADLESS;
  } catch (e) {
    HEADLESS = false;
  }

  // ── i18n ──────────────────────────────────────────────────────────────────

  var isPT = false;
  try {
    isPT = String(app.isoLanguage || "").toLowerCase().indexOf("pt") === 0;
  } catch (e) {
    isPT = false;
  }

  var S = {
    clipHint: isPT ? "Selecione uma layer de áudio na composição" : "Select an audio layer in the active composition",
    clipHintSub: isPT ? "ou um footage de áudio no Project panel" : "or an audio footage item in the Project panel",
    beatsHint: isPT ? "Toque nos beats para ativar/desativar" : "Tap beats to toggle on/off",
    btnAnalyze: isPT ? "Analisar Layer/Footage Selecionado" : "Analyze Selected Layer/Footage",
    btnCreateClip: isPT ? "Criar no Clip" : "Create on Clip",
    btnCreateComp: isPT ? "Criar na Timeline" : "Create on Timeline",
    btnRemoveClip: isPT ? "Remover do Clip" : "Remove from Clip",
    btnRemoveComp: isPT ? "Remover da Timeline" : "Remove from Timeline",
    phaseClip: isPT ? "Clipe" : "Clip",
    phaseComp: "Timeline",
    clearLog: isPT ? "limpar log" : "clear log",
    analyzing: isPT ? "Analisando..." : "Analyzing...",
    analysisOk: isPT ? "Análise concluída" : "Analysis complete",
    noAnalysis: isPT ? "Analise o áudio primeiro." : "Analyze audio first.",
    noBeats: isPT ? "Nenhum beat detectado neste áudio." : "No beats detected in this audio.",
    noComp: isPT ? "Abra uma composição antes de analisar." : "Open a composition before analyzing.",
    noAudio: isPT ? "Nenhum áudio selecionado ou na composição." : "No audio selected or in the composition.",
    noLayer: isPT ? "A layer analisada não está na composição ativa." : "The analyzed layer is not in the active composition.",
    tooLong: isPT ? "Áudio com mais de 20 minutos não é suportado." : "Audio longer than 20 minutes is not supported.",
    noAudioData: isPT ? "O áudio está mudo ou vazio." : "The audio is silent or empty.",
    fileModeHint: isPT ? "footage avulso · markers na timeline" : "standalone footage · timeline markers",
    createdFmt: function (n) { return isPT ? n + " markers criados" : n + " markers created"; },
    removedFmt: function (n) { return isPT ? n + " markers removidos." : n + " markers removed."; },
    phaseAdj: isPT ? "Fase ajustada" : "Phase adjusted",
    ready: isPT ? "Pronto" : "Ready",
    clearError: isPT ? "Erro ao limpar markers." : "Error clearing markers.",
    unknownError: isPT ? "Erro desconhecido" : "Unknown error",
    analysisFailed: isPT ? "Falha na análise" : "Analysis failed",
    footer: isPT ? "EffectCraft · painel ScriptUI" : "EffectCraft · ScriptUI panel",
    phaseHint: isPT
      ? "Desloca as cores dos beats (fase) no conjunto escolhido"
      : "Shifts the beat colors (phase) of the chosen marker set",
    logTitle: isPT ? "Log" : "Log"
  };

  // Confidence phrases, kept from the original panel (Whiplash themed).
  var CONFIDENCE = {
    high: {
      statusPT: "Pronto — crie seus markers abaixo",
      statusEN: "Ready — create your markers below",
      phrases: [
        { quote: "Not rushing, not dragging.", subtitlePT: "Consistência de tempo perfeita", subtitleEN: "Perfect tempo consistency" },
        { quote: "In the pocket.", subtitlePT: "Markers vão cair exatamente no beat", subtitleEN: "Markers will land exactly on beat" },
        { quote: "Fletcher would approve.", subtitlePT: "Confiança de análise muito alta", subtitleEN: "Analysis confidence is very high" },
        { quote: "That's the one.", subtitlePT: "BPM detectado com precisão", subtitleEN: "BPM detected with precision" },
        { quote: "Like a metronome.", subtitlePT: "Variação de tempo praticamente zero", subtitleEN: "Virtually zero tempo variation" },
        { quote: "Studio take.", subtitlePT: "Tempo limpo e consistente detectado", subtitleEN: "Clean, consistent tempo detected" },
        { quote: "One take wonder.", subtitlePT: "Beat grid sólido como rocha", subtitleEN: "Beat grid is rock solid" },
        { quote: "This is what we came for.", subtitlePT: "Excelente consistência de beats", subtitleEN: "Excellent beat consistency" },
        { quote: "Now we're cooking.", subtitlePT: "Markers confiáveis a caminho", subtitleEN: "Reliable markers ahead" },
        { quote: "Tight.", subtitlePT: "Alta confiança — markers prontos", subtitleEN: "High confidence — markers ready" }
      ]
    },
    medium: {
      statusPT: "Verifique a fase antes de criar",
      statusEN: "Check phase before creating",
      phrases: [
        { quote: "Were you rushing or were you dragging?", subtitlePT: "Alguma variação de tempo detectada", subtitleEN: "Some tempo variation detected" },
        { quote: "Close enough for jazz?", subtitlePT: "Consistência moderada — verifique os markers", subtitleEN: "Moderate consistency — check the markers" },
        { quote: "A little loosey-goosey.", subtitlePT: "Intervalos de beat levemente irregulares", subtitleEN: "Beat intervals are slightly uneven" },
        { quote: "Almost there. Almost.", subtitlePT: "Boa confiança, pequenas inconsistências", subtitleEN: "Good confidence, minor inconsistencies" },
        { quote: "The feel is there, the grid isn't.", subtitlePT: "Tempo varia levemente", subtitleEN: "Tempo varies slightly" },
        { quote: "Human, but maybe too human.", subtitlePT: "Feel de performance ao vivo detectado", subtitleEN: "Live performance feel detected" },
        { quote: "I can work with this.", subtitlePT: "Utilizável, mas verifique pontos-chave", subtitleEN: "Usable, but verify key points" },
        { quote: "Somewhere between a click and a vibe.", subtitlePT: "Consistência de tempo mista", subtitleEN: "Mixed tempo consistency" },
        { quote: "Not bad. Not great.", subtitlePT: "Média confiança — revise os markers", subtitleEN: "Medium confidence — review markers" },
        { quote: "It's giving... approximately.", subtitlePT: "BPM aproximado — possível drift", subtitleEN: "Approximate BPM — some drift possible" }
      ]
    },
    low: {
      statusPT: "Resultado pode estar errado",
      statusEN: "Result may be inaccurate",
      phrases: [
        { quote: "Not quite my tempo.", subtitlePT: "Alta variação — markers podem ser imprecisos", subtitleEN: "High tempo variation — markers may be unreliable" },
        { quote: "This is not a tempo, it's a suggestion.", subtitlePT: "Algoritmo lutou para achar um beat estável", subtitleEN: "Algorithm struggled to find a steady beat" },
        { quote: "Rubato nightmare.", subtitlePT: "Tempo livre — markers vão driftar", subtitleEN: "Free tempo — markers will drift" },
        { quote: "Charlie Parker would've done something with this.", subtitlePT: "Irregular demais para detecção confiável", subtitleEN: "Too irregular for reliable detection" },
        { quote: "Were you even playing to a click?", subtitlePT: "Nenhum tempo consistente encontrado", subtitleEN: "No consistent tempo found" },
        { quote: "Bold choice.", subtitlePT: "Variação de tempo muito alta detectada", subtitleEN: "Very high tempo variation detected" },
        { quote: "This one's on you.", subtitlePT: "Baixa confiança — use os markers por sua conta", subtitleEN: "Low confidence — use markers at your own risk" },
        { quote: "The grid has left the building.", subtitlePT: "Consistência de beat baixa demais", subtitleEN: "Beat consistency too low for reliable markers" },
        { quote: "Even Fletcher couldn't save this.", subtitlePT: "Análise falhou em achar um tempo estável", subtitleEN: "Analysis failed to find a steady tempo" },
        { quote: "Somewhere, a drummer is being yelled at.", subtitlePT: "Inconsistência de tempo extrema detectada", subtitleEN: "Extreme tempo inconsistency detected" }
      ]
    }
  };

  // ── State ────────────────────────────────────────────────────────────────

  var state = {
    beats: null,          // seconds, relative to the source
    bpm: null,
    confidence: 0,
    sourceName: null,
    sourceLayerId: null,  // id of the layer in the active comp, when the source came from one
    sourceStart: 0,       // layer.startTime, the marker offset
    source: "layer",      // "layer" | "file"
    beatOffset: 0,
    activeBeats: [true, true, true, true]
  };

  // ── Host helpers ─────────────────────────────────────────────────────────

  function activeComp() {
    var c = app.project ? app.project.activeItem : null;
    return c && c instanceof CompItem ? c : null;
  }

  function selectedAudioLayer(comp) {
    if (!comp) return null;
    var sel = comp.selectedLayers || [], i;
    for (i = 0; i < sel.length; i++) {
      if (sel[i].hasAudio && sel[i].source) return sel[i];
    }
    for (i = 1; i <= comp.numLayers; i++) {
      var l = comp.layer(i);
      if (l.hasAudio && l.source) return l;
    }
    return null;
  }

  function selectedAudioItem() {
    var sel = app.project && app.project.selection ? app.project.selection : [];
    for (var i = 0; i < sel.length; i++) {
      var it = sel[i];
      if (it && it.hasAudio && it.duration > 0) return it;
    }
    return null;
  }

  function layerById(comp, id) {
    if (!comp || id === null) return null;
    for (var i = 1; i <= comp.numLayers; i++) {
      var l = comp.layer(i);
      if (l.id === id) return l;
    }
    return null;
  }

  function targetLayer() {
    var comp = activeComp();
    if (!comp) return null;
    if (state.sourceLayerId !== null) {
      // Only the analyzed layer is a valid target once analysis has run.
      return layerById(comp, state.sourceLayerId);
    }
    return selectedAudioLayer(comp);
  }

  function markerTargetName() {
    if (state.source === "file") return "comp";
    return state.markerTarget === "comp" ? "comp" : "layer";
  }

  function targetParam(target, extra) {
    var p = extra || {};
    if (target === "layer") {
      var l = targetLayer();
      if (!l) throw new Error(S.noLayer);
      p.layer = l.id;
    }
    return p;
  }

  function markerOffset() {
    return state.sourceStart;
  }

  // ── Analysis: EffectCraft decodes, we read the envelope ──────────────────

  // Target ~30k keyframes. Short tracks get up to 240 fps, long ones never go
  // below 60 fps (a 20 minute track ends up with ~72k keys).
  function analysisFps(duration) {
    var fps = Math.floor(30000 / Math.max(0.5, duration));
    if (fps > 240) fps = 240;
    if (fps < 60) fps = 60;
    return fps;
  }

  function childNamed(list, name) {
    if (!list) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].name === name) return list[i];
    }
    return null;
  }

  function envelopeFromTree(tree) {
    var props = tree && tree.properties && tree.properties.children;
    var fx = childNamed(props, "Effects");
    if (!fx) throw new Error("analysis: no effects group");
    var both = childNamed(fx.children, "Both Channels");
    if (!both) both = childNamed(fx.children, "Left Channel");
    var slider = both && both.children ? both.children[0] : null;
    var keys = slider ? slider.keys : null;
    if (!keys || keys.length < 8) throw new Error("analysis: no amplitude keys");

    var values = new Float64Array(keys.length);
    var peak = 0;
    for (var i = 0; i < keys.length; i++) {
      var v = +keys[i].value || 0;
      values[i] = v;
      if (v > peak) peak = v;
    }
    if (peak <= 0.001) throw new Error("silent");
    return { values: values, peak: peak };
  }

  // Decode an item into an amplitude envelope by asking the engine for
  // "Convert Audio to Keyframes" on a temporary composition.
  function envelopeOfItem(item) {
    if (!item) throw new Error("no item");
    var duration = item.duration;
    if (!(duration > 0.05)) throw new Error("no duration");
    if (duration > 1200) throw new Error(S.tooLong);
    var fps = analysisFps(duration);
    var comp = null;
    app.beginUndoGroup(BM_NAME + ": Analyze Audio");
    try {
      comp = app.project.items.addComp("__BeatMarker Analysis", 320, 180, 1, duration, fps);
      comp.layers.add(item);
      var r = app.run("keys.audioToKeyframes", { comp: comp.id });
      if (!r || !r.layer) throw new Error("analysis: no amplitude layer");
      var tree = app.run("layer.tree", { comp: comp.id, layer: r.layer, depth: 4 });
      var env = envelopeFromTree(tree);
      env.fps = fps;
      env.duration = duration;
      return env;
    } finally {
      if (comp) {
        try { comp.remove(); } catch (e) {}
      }
      app.endUndoGroup();
    }
  }

  // ── Detector ─────────────────────────────────────────────────────────────

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  // Positive log-energy difference: where the amplitude rises.
  function novelty(env) {
    var n = env.length;
    var d = new Float64Array(n);
    // Treat the very first sample as an onset out of silence so a track that
    // starts on a hit keeps its first beat.
    d[0] = env[0] > 0 ? Math.log(1 + env[0] * 0.2) : 0;
    var prev = Math.log(1 + env[0] * 0.2);
    for (var i = 1; i < n; i++) {
      var cur = Math.log(1 + env[i] * 0.2);
      var diff = cur - prev;
      d[i] = diff > 0 ? diff : 0;
      prev = cur;
    }
    return d;
  }

  function meanOf(a) {
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i];
    return a.length ? s / a.length : 0;
  }

  function detectTempo(d, fps) {
    // Decimate the novelty to ~40 Hz: the tempo search is the expensive part.
    var k = Math.max(1, Math.round(fps / 40));
    var m = Math.floor(d.length / k);
    if (m < 16) return null;

    var e = new Float64Array(m);
    for (var i = 0; i < m; i++) {
      var s = 0, end = Math.min(d.length, (i + 1) * k);
      for (var j = i * k; j < end; j++) s += d[j];
      e[i] = s;
    }
    // Remove the mean so silent stretches do not dominate the correlation.
    var mu = meanOf(e);
    for (i = 0; i < m; i++) e[i] = Math.max(0, e[i] - mu * 0.5);

    var fr = fps / k;
    var minLag = Math.max(2, Math.round((fr * 60) / 200)); // 200 BPM
    var maxLag = Math.min(m - 2, Math.round((fr * 60) / 55)); // 55 BPM
    if (maxLag <= minLag) return null;

    var ac = new Float64Array(maxLag + 2);
    for (var lag = minLag - 1; lag <= maxLag + 1; lag++) {
      if (lag < 1 || lag >= m) continue;
      var num = 0, aa = 0, bb = 0;
      for (i = 0; i + lag < m; i++) {
        num += e[i] * e[i + lag];
        aa += e[i] * e[i];
        bb += e[i + lag] * e[i + lag];
      }
      ac[lag] = aa > 0 && bb > 0 ? num / Math.sqrt(aa * bb) : 0;
    }

    var bestLag = minLag, bestScore = -1;
    for (lag = minLag; lag <= maxLag; lag++) {
      var score = ac[lag];
      if (lag * 2 <= maxLag) score += 0.5 * ac[lag * 2]; // prefer the fundamental
      if (lag % 2 === 0 && lag / 2 >= minLag) score += 0.2 * ac[lag / 2];
      // Mild prior around 120 BPM keeps 60/240 readings from winning.
      var bpm = (60 * fr) / lag;
      score *= 1 - 0.10 * Math.min(1, Math.abs(Math.log(bpm / 120)));
      if (score > bestScore) {
        bestScore = score;
        bestLag = lag;
      }
    }

    var y0 = ac[bestLag - 1] || 0, y1 = ac[bestLag] || 0, y2 = ac[bestLag + 1] || 0;
    var den = y0 - 2 * y1 + y2;
    var refined = bestLag + (den !== 0 ? (0.5 * (y0 - y2)) / den : 0);
    if (!(refined > 1)) refined = bestLag;

    var period = refined * k;
    return {
      period: period,
      bpm: (60 * fps) / period,
      score: clamp01(y1)
    };
  }

  function detectPhase(d, period, stepCount) {
    var n = d.length;
    var steps = stepCount || Math.max(16, Math.round(period * 8));
    var bestOffset = 0, bestScore = -1;
    for (var s = 0; s < steps; s++) {
      var offset = (s * period) / steps;
      var sum = 0, count = 0;
      for (var t = offset; t < n; t += period) {
        var idx = Math.round(t);
        if (idx >= 0 && idx < n) {
          sum += d[idx];
          count++;
        }
      }
      var avg = count ? sum / count : 0;
      if (avg > bestScore) {
        bestScore = avg;
        bestOffset = offset;
      }
    }
    return { offset: bestOffset, score: bestScore };
  }

  // Autocorrelation puts us within a few percent of the real period. Search a
  // narrow band around it with a phase-compensated comb: the period that keeps
  // the most onsets on the grid over the whole track wins.
  function refineTempo(d, period0) {
    if (!(period0 > 2)) return null;
    var lo = period0 * 0.90;
    var hi = period0 * 1.10;
    var steps = 61;
    var bestPeriod = period0;
    var bestScore = -1;
    for (var s = 0; s < steps; s++) {
      var p = lo + ((hi - lo) * s) / (steps - 1);
      var ph = detectPhase(d, p, 12);
      if (ph.score > bestScore) {
        bestScore = ph.score;
        bestPeriod = p;
      }
    }
    var phase = detectPhase(d, bestPeriod);
    return { period: bestPeriod, offset: phase.offset, score: phase.score };
  }

  // Least-squares fit of the beat grid to the actual onsets. Restricting the
  // onsets to those close to the grid keeps syncopated material from pulling
  // the period away; the tolerance tightens on each pass.
  function fitPeriod(d, period, offset, tolerance) {
    var n = d.length;
    var maxD = 0, i;
    for (i = 0; i < n; i++) if (d[i] > maxD) maxD = d[i];
    if (!(maxD > 0)) return null;

    var sumX = 0, sumY = 0, sumXX = 0, sumXY = 0, used = 0;
    for (i = 1; i < n - 1; i++) {
      if (d[i] < maxD * 0.25) continue;
      if (d[i] < d[i - 1] || d[i] < d[i + 1]) continue;
      var k = Math.round((i - offset) / period);
      if (k < 0) continue;
      var grid = offset + k * period;
      if (Math.abs(i - grid) > tolerance * period) continue;
      sumX += k;
      sumY += i;
      sumXX += k * k;
      sumXY += k * i;
      used++;
    }
    if (used < 4) return null;
    var den = used * sumXX - sumX * sumX;
    if (!(Math.abs(den) > 1e-9)) return null;
    var periodFit = (used * sumXY - sumX * sumY) / den;
    if (!(periodFit > 2)) return null;
    var offsetFit = (sumY - periodFit * sumX) / used;
    return { period: periodFit, offset: offsetFit, used: used };
  }

  // Pull each beat onto the nearest onset when that onset is clearly stronger.
  function refineBeats(d, period, offset) {
    var n = d.length;
    var out = [];
    var limit = Math.max(1, Math.round(period * 0.10));
    var overall = meanOf(d);
    var start = offset > period * 0.5 ? offset - period : offset;
    for (var t = start; t < n; t += period) {
      if (t < -0.5) continue;
      var grid = Math.round(t);
      var bestIdx = grid, bestVal = grid >= 0 && grid < n ? d[grid] : 0;
      var lo = Math.max(0, grid - limit), hi = Math.min(n - 1, grid + limit);
      for (var i = lo; i <= hi; i++) {
        if (d[i] > bestVal) {
          bestVal = d[i];
          bestIdx = i;
        }
      }
      // Only leave the grid for a genuinely stronger onset.
      if (bestIdx !== grid && bestVal > (d[grid] || 0) * 1.25 && bestVal > overall * 2) {
        out.push(bestIdx);
      } else {
        out.push(Math.max(0, grid));
      }
    }
    return out;
  }

  function intervalsOf(samples, fps) {
    var out = [];
    for (var i = 1; i < samples.length; i++) out.push((samples[i] - samples[i - 1]) / fps);
    return out;
  }

  function confidenceOf(samples, d, fps) {
    if (samples.length < 3) return 0;
    var iv = intervalsOf(samples, fps);
    var mean = meanOf(iv);
    if (!(mean > 0)) return 0;
    var variance = 0;
    for (var i = 0; i < iv.length; i++) {
      var dev = iv[i] - mean;
      variance += dev * dev;
    }
    variance /= iv.length;
    var cv = Math.sqrt(variance) / mean;

    var overall = meanOf(d);
    var atBeats = 0, count = 0;
    for (i = 0; i < samples.length; i++) {
      var idx = samples[i];
      for (var k = -1; k <= 1; k++) {
        var j = idx + k;
        if (j >= 0 && j < d.length) {
          atBeats += d[j];
          count++;
        }
      }
    }
    var beatMean = count ? atBeats / count : 0;
    var align = clamp01((beatMean / (overall + 1e-9) - 1) / 2);
    var steadiness = clamp01(1 - cv * 4);
    var score = 0.45 * steadiness + 0.55 * align;
    return Math.round(100 * clamp01(score));
  }

  function analyzeEnvelope(env, fps, duration) {
    var d = novelty(env);
    var coarse = detectTempo(d, fps);
    if (!coarse || !(coarse.period > 1)) {
      throw new Error(S.noBeats);
    }

    var grid = refineTempo(d, coarse.period);
    if (!grid) {
      grid = { period: coarse.period, offset: detectPhase(d, coarse.period).offset };
    }
    // Three passes: a wide tolerance catches the beat at the start, then the
    // fit tightens so syncopated hits cannot bias the period.
    var tolerances = [0.35, 0.22, 0.14];
    for (var pass = 0; pass < tolerances.length; pass++) {
      var fit = fitPeriod(d, grid.period, grid.offset, tolerances[pass]);
      if (fit) grid = fit;
    }

    var samples = refineBeats(d, grid.period, grid.offset);
    if (samples.length < 2) throw new Error(S.noBeats);

    var beats = [];
    for (var i = 0; i < samples.length; i++) {
      var t = samples[i] / fps;
      if (t <= duration + 0.5) beats.push(t);
    }
    if (beats.length < 2) throw new Error(S.noBeats);

    return {
      bpm: (60 * fps) / grid.period,
      beats: beats,
      confidence: confidenceOf(samples, d, fps),
      period: grid.period / fps,
      onset: d
    };
  }

  function analyzeItem(item) {
    var env = envelopeOfItem(item);
    return analyzeEnvelope(env.values, env.fps, env.duration);
  }

  // ── Markers ──────────────────────────────────────────────────────────────

  function listMarkers(target) {
    var p = target === "layer" ? targetParam("layer") : {};
    return app.run("markers.list", p) || [];
  }

  function markerBeatPos(m) {
    var q = m && m.cuePoint;
    if (q && q.params) {
      for (var i = 0; i < q.params.length; i++) {
        if (q.params[i] && q.params[i][0] === "b") {
          var n = parseInt(q.params[i][1], 10);
          return n >= 1 && n <= 4 ? n : 0;
        }
      }
    }
    return 0;
  }

  function markerPayload(target, time, beatPos, extra) {
    var p = targetParam(target, extra);
    p.comment = "";
    p.label = BEAT_LABELS[beatPos - 1];
    p.cuePoint = { name: "", navigation: true, params: [["b", String(beatPos)]] };
    if (time !== null && time !== undefined) p.time = time;
    return p;
  }

  function addMarker(target, time, beatPos) {
    var p = markerPayload(target, time, beatPos);
    p["new"] = true;
    app.run("markers.set", p);
  }

  function updateMarker(target, index, beatPos) {
    var p = markerPayload(target, null, beatPos, { index: index });
    app.run("markers.set", p);
  }

  function deleteMarker(target, index) {
    var p = targetParam(target, { index: index });
    app.run("markers.delete", p);
  }

  function clearBeatMarkers(target) {
    var list = listMarkers(target);
    var removed = 0;
    app.beginUndoGroup(BM_NAME + ": Remove Markers");
    try {
      for (var i = list.length - 1; i >= 0; i--) {
        if (markerBeatPos(list[i])) {
          deleteMarker(target, i);
          removed++;
        }
      }
    } finally {
      app.endUndoGroup();
    }
    return removed;
  }

  function createBeatMarkers(target, beats, offset, activeBeats, timeOffset) {
    var created = 0;
    app.beginUndoGroup(BM_NAME + ": Create Markers");
    try {
      for (var i = 0; i < beats.length; i++) {
        var pos = (((i + offset) % 4) + 4) % 4 + 1;
        if (!activeBeats[pos - 1]) continue;
        addMarker(target, beats[i] + timeOffset, pos);
        created++;
      }
    } finally {
      app.endUndoGroup();
    }
    return created;
  }

  // Differential phase shift: markers that stay active are relabelled in place,
  // only the ones that switch on/off are added/removed.
  function adjustPhase(target, delta, activeBeats, timesToAdd, timeOffset) {
    var list = listMarkers(target);
    app.beginUndoGroup(BM_NAME + ": Adjust Phase");
    try {
      for (var i = list.length - 1; i >= 0; i--) {
        var cur = markerBeatPos(list[i]);
        if (!cur) continue;
        var next = (((cur - 1 + delta) % 4) + 4) % 4 + 1;
        if (activeBeats[next - 1]) updateMarker(target, i, next);
        else deleteMarker(target, i);
      }
      for (var j = 0; j < timesToAdd.length; j++) {
        addMarker(target, timesToAdd[j].t + timeOffset, timesToAdd[j].beatPos);
      }
    } finally {
      app.endUndoGroup();
    }
    return true;
  }

  function recolorMarkers(target, delta) {
    var list = listMarkers(target);
    var n = 0;
    app.beginUndoGroup(BM_NAME + ": Adjust Phase");
    try {
      for (var i = list.length - 1; i >= 0; i--) {
        var cur = markerBeatPos(list[i]);
        if (!cur) continue;
        var next = (((cur - 1 + delta) % 4) + 4) % 4 + 1;
        updateMarker(target, i, next);
        n++;
      }
    } finally {
      app.endUndoGroup();
    }
    return n;
  }

  // ── Panel ────────────────────────────────────────────────────────────────

  function buildUI(thisObj) {
    var ui = thisObj instanceof Panel
      ? thisObj
      : new Window("palette", BM_NAME, undefined, { resizeable: true });
    ui.orientation = "column";
    ui.alignChildren = ["fill", "top"];
    ui.spacing = 8;

    var el = {};

    // Header ----------------------------------------------------------------
    var header = ui.add("group");
    header.orientation = "column";
    header.alignChildren = ["left", "top"];
    header.spacing = 0;
    var title = header.add("statictext", undefined, BM_NAME);
    var subtitle = header.add("statictext", undefined, S.footer);

    // Clip card -------------------------------------------------------------
    var card = ui.add("panel");
    card.orientation = "column";
    card.alignChildren = ["fill", "top"];
    card.spacing = 6;
    card.margins = [10, 10, 10, 8];

    el.clipName = card.add("statictext", undefined, S.clipHint, { name: "clip-name" });
    el.clipSub = card.add("statictext", undefined, S.clipHintSub, { name: "clip-sub" });

    var bpmBox = card.add("panel");
    bpmBox.preferredSize = [-1, 46];
    bpmBox.alignment = ["fill", "top"];
    bpmBox.onDraw = function () {
      drawBpm(this);
    };
    el.bpmBox = bpmBox;

    el.confBar = card.add("progressbar", undefined, 0, 100, { name: "confidence" });
    el.confBar.preferredSize = [-1, 6];
    el.confQuote = card.add("statictext", undefined, "", { name: "confidence-quote" });
    el.confDesc = card.add("statictext", undefined, "", { name: "confidence-desc" });

    // Analyze ---------------------------------------------------------------
    el.analyze = ui.add("button", undefined, S.btnAnalyze, { name: "analyze" });
    el.analyze.preferredSize = [-1, 26];

    // Beats -----------------------------------------------------------------
    var beatsPanel = ui.add("panel");
    beatsPanel.orientation = "column";
    beatsPanel.alignChildren = ["fill", "top"];
    beatsPanel.spacing = 6;
    var beatsHint = beatsPanel.add("statictext", undefined, S.beatsHint);
    var beatRow = beatsPanel.add("group");
    beatRow.orientation = "row";
    beatRow.alignChildren = ["left", "center"];
    beatRow.spacing = 6;
    el.beatButtons = [];
    for (var b = 0; b < 4; b++) {
      el.beatButtons.push(makeBeatButton(beatRow, b));
    }

    // Phase -----------------------------------------------------------------
    var phaseRow = ui.add("group");
    phaseRow.orientation = "row";
    phaseRow.alignChildren = ["left", "center"];
    phaseRow.spacing = 6;
    var prev = phaseRow.add("button", undefined, "◀", { name: "phase-prev" });
    prev.preferredSize = [34, 24];
    prev.helpTip = S.phaseHint;
    el.phaseTarget = phaseRow.add("dropdownlist", undefined, [S.phaseClip, S.phaseComp], { name: "phase-target" });
    el.phaseTarget.preferredSize = [110, 22];
    el.phaseTarget.helpTip = S.phaseHint;
    el.phaseTarget.selection = 0;
    var next = phaseRow.add("button", undefined, "▶", { name: "phase-next" });
    next.preferredSize = [34, 24];
    next.helpTip = S.phaseHint;

    // Create / remove -------------------------------------------------------
    var applyRow = ui.add("group");
    applyRow.orientation = "row";
    applyRow.alignChildren = ["fill", "center"];
    applyRow.spacing = 6;
    el.applyClip = applyRow.add("button", undefined, S.btnCreateClip, { name: "create-clip" });
    el.applyComp = applyRow.add("button", undefined, S.btnCreateComp, { name: "create-timeline" });

    var clearRow = ui.add("group");
    clearRow.orientation = "row";
    clearRow.alignChildren = ["fill", "center"];
    clearRow.spacing = 6;
    el.clearClip = clearRow.add("button", undefined, S.btnRemoveClip, { name: "remove-clip" });
    el.clearComp = clearRow.add("button", undefined, S.btnRemoveComp, { name: "remove-timeline" });

    // Status + log ----------------------------------------------------------
    el.status = ui.add("statictext", undefined, S.ready, { name: "status" });
    el.status.characters = 36;

    var logHeader = ui.add("group");
    logHeader.orientation = "row";
    logHeader.alignChildren = ["left", "center"];
    logHeader.spacing = 6;
    var logTitle = logHeader.add("statictext", undefined, S.logTitle);
    var clearLog = logHeader.add("button", undefined, S.clearLog, { name: "clear-log" });
    clearLog.preferredSize = [70, 20];

    el.log = ui.add("listbox", undefined, [], { name: "log" });
    el.log.preferredSize = [-1, 88];

    // Behavior --------------------------------------------------------------

    function log(msg) {
      var d = new Date();
      var hh = ("0" + d.getHours()).slice(-2);
      var mm = ("0" + d.getMinutes()).slice(-2);
      var ss = ("0" + d.getSeconds()).slice(-2);
      var line = "[" + hh + ":" + mm + ":" + ss + "] " + msg;
      try {
        el.log.add("item", line);
        el.log.selection = el.log.items.length - 1;
      } catch (e) {}
    }

    function setStatus(msg) {
      el.status.text = msg || "";
    }

    function refresh() {
      try { ui.layout.layout(true); } catch (e) {}
    }

    function refreshLabels() {
      var ready = !!(state.beats && state.beats.length > 1);
      var comp = activeComp();
      var canLayer = ready && state.source === "layer" && !!targetLayer();
      el.applyClip.enabled = canLayer;
      el.applyComp.enabled = ready && !!comp;
      el.clearClip.enabled = state.source !== "file";
      el.clearComp.enabled = !!comp;
      el.phaseTarget.enabled = state.source !== "file" && !!comp;
      if (state.source === "file") {
        state.markerTarget = "comp";
        el.phaseTarget.selection = 1;
      }
      el.clipName.text = state.sourceName || S.clipHint;
      el.clipSub.text = state.beats
        ? (state.source === "file" ? S.fileModeHint + " · " : "") + state.beats.length + " beats"
        : S.clipHintSub;
    }

    function onAnalyze() {
      var comp = activeComp();
      if (!comp) {
        setStatus(S.noComp);
        log(S.noComp);
        return;
      }
      var layer = selectedAudioLayer(comp);
      var item = null;
      var fromLayer = false;
      if (layer && layer.source) {
        item = layer.source;
        fromLayer = true;
      } else {
        item = selectedAudioItem();
      }
      if (!item) {
        setStatus(S.noAudio);
        log(S.noAudio);
        return;
      }

      el.analyze.enabled = false;
      var saved = state.sourceName;
      state.sourceName = item.name || (isPT ? "áudio" : "audio");
      el.clipName.text = S.analyzing + " " + state.sourceName;
      el.clipSub.text = "";
      el.confBar.value = 0;
      el.confQuote.text = "";
      el.confDesc.text = "";
      setStatus(S.analyzing);
      refresh();

      try {
        log((isPT ? "Analisando " : "Analyzing ") + state.sourceName + " ...");
        var res = analyzeItem(item);
        state.beats = res.beats;
        state.bpm = res.bpm;
        state.confidence = res.confidence;
        state.source = fromLayer ? "layer" : "file";
        state.sourceLayerId = fromLayer ? layer.id : null;
        state.sourceStart = fromLayer ? layer.startTime : 0;
        state.beatOffset = 0;

        showConfidence(res.confidence);
        refreshLabels();
        refresh();
        setStatus(S.analysisOk + " · " + res.beats.length + " beats");
        log("BPM " + Number(res.bpm).toFixed(2) + " · " + res.beats.length +
          (isPT ? " beats · confiança " : " beats · confidence ") + res.confidence + "%");
      } catch (e) {
        state.beats = null;
        state.bpm = null;
        state.confidence = 0;
        state.sourceName = saved;
        state.source = "layer";
        state.sourceLayerId = null;
        state.sourceStart = 0;
        el.confBar.value = 0;
        el.confQuote.text = "";
        el.confDesc.text = "";
        refreshLabels();
        refresh();
        var msg = (e && e.message) ? e.message : String(e);
        if (msg === "silent") msg = S.noAudioData;
        setStatus(S.analysisFailed + ": " + msg);
        log(S.analysisFailed + ": " + msg);
      } finally {
        el.analyze.enabled = true;
      }
    }

    function showConfidence(pct) {
      var level = pct > 85 ? "high" : pct >= 60 ? "medium" : "low";
      var cfg = CONFIDENCE[level];
      var pick = cfg.phrases[Math.floor(Math.random() * cfg.phrases.length)];
      el.confBar.value = pct;
      el.confQuote.text = "\"" + pick.quote + "\"";
      el.confDesc.text = isPT ? pick.subtitlePT : pick.subtitleEN;
      el.confBar.helpTip = pct + "%";
      setStatus(isPT ? cfg.statusPT : cfg.statusEN);
      log((isPT ? "Confiança: " : "Confidence: ") + pct + "% (" + level + ")");
    }

    function doCreate(target) {
      if (!state.beats) {
        setStatus(S.noAnalysis);
        return;
      }
      try {
        // Re-read the layer offset: the user may have moved the layer since analysis.
        if (state.source === "layer") {
          var l = targetLayer();
          if (l) state.sourceStart = l.startTime;
        }
        clearBeatMarkers(target);
        var created = createBeatMarkers(target, state.beats, state.beatOffset, state.activeBeats, markerOffset());
        // Phase now acts on the set the user just created.
        state.markerTarget = target;
        el.phaseTarget.selection = target === "comp" ? 1 : 0;
        setStatus(S.createdFmt(created));
        log(S.createdFmt(created));
      } catch (e) {
        setStatus(String((e && e.message) || e));
        log(String((e && e.message) || e));
      }
    }

    function doClear(target) {
      try {
        var removed = clearBeatMarkers(target);
        setStatus(S.removedFmt(removed));
        log(S.removedFmt(removed));
      } catch (e) {
        setStatus(S.clearError);
        log(S.clearError + " " + String((e && e.message) || e));
      }
    }

    function doPhase(delta) {
      var target = markerTargetName();
      var oldOffset = state.beatOffset;
      state.beatOffset = (state.beatOffset + delta + 4) % 4;
      try {
        if (state.beats) {
          var timesToAdd = [];
          for (var i = 0; i < state.beats.length; i++) {
            var oldPos = (i + oldOffset) % 4;
            var newPos = (i + state.beatOffset) % 4;
            if (!state.activeBeats[oldPos] && state.activeBeats[newPos]) {
              timesToAdd.push({ t: state.beats[i], beatPos: newPos + 1 });
            }
          }
          adjustPhase(target, delta, state.activeBeats, timesToAdd, markerOffset());
        } else {
          recolorMarkers(target, delta);
        }
        setStatus(S.phaseAdj);
        log(S.phaseAdj + " (" + (delta > 0 ? "+" : "") + delta + ")");
      } catch (e) {
        state.beatOffset = oldOffset;
        setStatus(String((e && e.message) || e));
        log(String((e && e.message) || e));
      }
    }

    el.analyze.onClick = onAnalyze;
    el.applyClip.onClick = function () { doCreate("layer"); };
    el.applyComp.onClick = function () { doCreate("comp"); };
    el.clearClip.onClick = function () { doClear("layer"); };
    el.clearComp.onClick = function () { doClear("comp"); };
    prev.onClick = function () { doPhase(1); };
    next.onClick = function () { doPhase(-1); };
    el.phaseTarget.onChange = function () {
      var sel = el.phaseTarget.selection;
      state.markerTarget = sel && sel.index === 1 ? "comp" : "layer";
      refresh();
    };
    el.phaseTarget.selection = 0;
    clearLog.onClick = function () {
      try { el.log.removeAll(); } catch (e) {}
    };

    function makeBeatButton(parent, index) {
      var btn = parent.add("panel");
      btn.name = "beat-" + (index + 1);
      btn.preferredSize = [34, 30];
      btn.onDraw = function () {
        drawBeat(this, index);
      };
      btn.addEventListener("click", function () {
        state.activeBeats[index] = !state.activeBeats[index];
        refresh();
      });
      return btn;
    }

    function drawBpm(control) {
      var g = control.graphics;
      var h = control.size.height || 46;
      var dim = g.newPen(g.PenType.SOLID_COLOR, [0.60, 0.62, 0.66], 1);
      var ink = g.newPen(g.PenType.SOLID_COLOR, [0.92, 0.92, 0.94], 1);
      g.drawString("BPM", dim, 2, 2, ScriptUI.newFont("dialog", "REGULAR", 10));
      var text = state.bpm ? Number(state.bpm).toFixed(1) : "--";
      var size = Math.min(24, Math.max(14, h - 22));
      g.drawString(text, ink, 2, h - size - 6, ScriptUI.newFont("dialog", "BOLD", size));
    }

    function drawBeat(control, index) {
      var g = control.graphics;
      var w = control.size.width || 34;
      var h = control.size.height || 30;
      var on = state.activeBeats[index];
      var rgb = BEAT_RGB[index];
      var fill = g.newBrush(g.BrushType.SOLID_COLOR, on ? [rgb[0], rgb[1], rgb[2], 1] : [0.28, 0.29, 0.32, 1]);
      var pen = g.newPen(g.PenType.SOLID_COLOR, on ? [rgb[0] * 1.2 > 1 ? 1 : rgb[0] * 1.2, rgb[1] * 1.2 > 1 ? 1 : rgb[1] * 1.2, rgb[2] * 1.2 > 1 ? 1 : rgb[2] * 1.2, 1] : [0.42, 0.43, 0.46, 1], 1);
      g.newPath();
      g.ellipsePath(2, 2, Math.min(w - 4, h - 4), Math.min(w - 4, h - 4));
      g.fillPath(fill);
      g.strokePath(pen);
      var ink = g.newPen(g.PenType.SOLID_COLOR, on ? [0.08, 0.08, 0.09] : [0.65, 0.66, 0.70], 1);
      g.drawString(String(index + 1), ink, Math.max(9, w / 2 - 4), (h - 12) / 2,
        ScriptUI.newFont("dialog", "BOLD", 12));
    }

    log(BM_NAME + " " + BM_VERSION + " · " + (isPT ? "pronto" : "ready"));
    refreshLabels();
    refresh();

    if (ui instanceof Window) {
      if (!HEADLESS) {
        ui.center();
        ui.show();
      }
    } else {
      ui.layout.layout(true);
    }
    return ui;
  }

  // ── Test hook ────────────────────────────────────────────────────────────

  if (HEADLESS) {
    $.global.BeatMarkerTest = {
      version: BM_VERSION,
      state: state,
      activeComp: activeComp,
      selectedAudioLayer: selectedAudioLayer,
      analysisFps: analysisFps,
      envelopeOfItem: envelopeOfItem,
      analyzeItem: analyzeItem,
      analyzeEnvelope: analyzeEnvelope,
      novelty: novelty,
      detectTempo: detectTempo,
      refineTempo: refineTempo,
      fitPeriod: fitPeriod,
      detectPhase: detectPhase,
      refineBeats: refineBeats,
      confidenceOf: confidenceOf,
      listMarkers: listMarkers,
      markerBeatPos: markerBeatPos,
      createBeatMarkers: createBeatMarkers,
      clearBeatMarkers: clearBeatMarkers,
      adjustPhase: adjustPhase,
      recolorMarkers: recolorMarkers,
      buildUI: function () { return buildUI(null); },
      labels: BEAT_LABELS
    };
    return;
  }

  buildUI(thisObj);
})(this);
