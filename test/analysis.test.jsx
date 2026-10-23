// Audio analysis regression test.
// Runs headless: effectcraft-cli script test/analysis.test.jsx --empty
// The runner copies BeatMarker.jsx next to this file as .BeatMarker.test.jsx.

$.global.BM_HEADLESS = true;
var HERE = File($.fileName).parent.fsName;
$.evalFile(new File(HERE + "/.BeatMarker.test.jsx"));

var BM = $.global.BeatMarkerTest;

function assert(ok, msg) {
  if (!ok) throw new Error("ASSERT: " + msg);
}

// Adaptive analysis rate: 30k keyframes max, 60..240 fps.
assert(BM.analysisFps(10) === 240, "fps for 10 s");
assert(BM.analysisFps(200) === 150, "fps for 200 s");
assert(BM.analysisFps(600) === 60, "fps for 600 s");

var item = app.project.importFile(new ImportOptions(new File(HERE + "/samples/click.flac")));
assert(item.hasAudio, "fixture has audio");

var t0 = new Date().getTime();
var env = BM.envelopeOfItem(item);
var t1 = new Date().getTime();
assert(env.fps === 240, "analysis fps");
assert(env.values.length > 5000, "amplitude keys");
assert(env.peak > 1, "audio peak");

var res = BM.analyzeEnvelope(env.values, env.fps, env.duration);
var t2 = new Date().getTime();

assert(Math.abs(res.bpm - 128) < 0.3, "BPM is 128, got " + res.bpm);
assert(res.beats.length === 52, "52 beats, got " + res.beats.length);
assert(res.confidence >= 90, "confidence >= 90, got " + res.confidence);
assert(Math.abs(res.beats[0]) < 0.02, "starts on the first click, got " + res.beats[0]);
assert(Math.abs(res.beats[1] - 0.46875) < 0.01, "second beat at 0.469 s, got " + res.beats[1]);
assert(Math.abs(res.beats[res.beats.length - 1] - 23.90625) < 0.02, "last beat near 23.9 s");

// Practically every beat sits on a click: intervals stay within a few ms.
var maxDev = 0;
for (var i = 1; i < res.beats.length; i++) {
  var dev = Math.abs(res.beats[i] - res.beats[i - 1] - 1 / 128 * 60);
  if (dev > maxDev) maxDev = dev;
}
assert(maxDev < 0.012, "beat grid deviation " + maxDev);

JSON.stringify({
  ok: true,
  bpm: Math.round(res.bpm * 100) / 100,
  beats: res.beats.length,
  confidence: res.confidence,
  maxDeviationMs: Math.round(maxDev * 10000) / 10,
  envelopeMs: t1 - t0,
  detectorMs: t2 - t1
});
