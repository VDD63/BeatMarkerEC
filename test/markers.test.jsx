// Marker creation, phase rotation and cleanup, exercised through the real UI
// handlers. Runs headless: effectcraft-cli script test/markers.test.jsx --empty

$.global.BM_HEADLESS = true;
var HERE = File($.fileName).parent.fsName;
$.evalFile(new File(HERE + "/.BeatMarker.test.jsx"));

var BM = $.global.BeatMarkerTest;

function assert(ok, msg) {
  if (!ok) throw new Error("ASSERT: " + msg);
}

function find(c, name) {
  if (c.name === name) return c;
  var kids = c.children || [];
  for (var i = 0; i < kids.length; i++) {
    var r = find(kids[i], name);
    if (r) return r;
  }
  return null;
}

var ui = BM.buildUI();
var drawErrors = [];
(function runDraws(c) {
  if (typeof c.onDraw === "function") {
    try { c.onDraw.call(c, { type: "draw", target: c }); }
    catch (e) { drawErrors.push((c.name || c.type) + ": " + (e && e.message ? e.message : e)); }
  }
  var kids = c.children || [];
  for (var i = 0; i < kids.length; i++) runDraws(kids[i]);
})(ui);
assert(drawErrors.length === 0, "onDraw errors: " + drawErrors.join("; "));

// Audio layer at comp time 2: every marker must be offset by startTime.
var item = app.project.importFile(new ImportOptions(new File(HERE + "/samples/click.flac")));
var comp = app.project.items.addComp("Beat Test", 640, 360, 1, 24, 30);
var layer = comp.layers.add(item);
layer.startTime = 2;
layer.selected = true;
comp.openInViewer();

find(ui, "analyze").onClick();
assert(BM.state.bpm && Math.abs(BM.state.bpm - 128) < 0.3, "analysis BPM");
assert(BM.state.beats.length === 52, "analysis beats");
assert(BM.state.sourceStart === 2, "layer start offset captured");

// Timeline markers ----------------------------------------------------------
find(ui, "create-timeline").onClick();
var compMarkers = BM.listMarkers("comp");
assert(compMarkers.length === 52, "52 timeline markers, got " + compMarkers.length);
assert(Math.abs(compMarkers[0].time - 2) < 0.001, "first timeline marker at 2 s");
assert(Math.abs(compMarkers[1].time - 2.467) < 0.005, "second timeline marker");
assert(compMarkers[0].label === "Red", "beat 1 is Red");
assert(compMarkers[1].label === "Blue", "beat 2 is Blue");
assert(compMarkers[2].label === "Yellow", "beat 3 is Yellow");
assert(compMarkers[3].label === "Aqua", "beat 4 is Aqua");
assert(compMarkers[4].label === "Red", "beat 5 is Red again");
assert(compMarkers[0].comment === "", "markers have no visible comment");
assert(BM.markerBeatPos(compMarkers[0]) === 1, "beat position stored in cuePoint");
assert(BM.markerBeatPos(compMarkers[3]) === 4, "fourth beat position");
assert(BM.markerBeatPos(compMarkers[4]) === 1, "beat position wraps");

// Clip markers -------------------------------------------------------------
find(ui, "create-clip").onClick();
var layerMarkers = BM.listMarkers("layer");
assert(layerMarkers.length === 52, "52 clip markers, got " + layerMarkers.length);
assert(Math.abs(layerMarkers[0].time - 2) < 0.001, "clip marker at comp time 2");

// Phase shift keeps every marker, only the colours rotate (delta -1: 1 -> 4).
var before = layerMarkers.map(function (m) { return [Math.round(m.time * 1000), BM.markerBeatPos(m)]; });
find(ui, "phase-next").onClick();
var shifted = BM.listMarkers("layer");
assert(shifted.length === before.length, "phase keeps the marker count");
assert(BM.markerBeatPos(shifted[0]) === 4, "beat 1 shifted to 4");
assert(BM.markerBeatPos(shifted[1]) === 1, "beat 2 shifted to 1");
assert(Math.round(shifted[0].time * 1000) === before[0][0], "phase does not move markers");
assert(BM.state.beatOffset === 3, "phase offset tracked");

// Beat 3 off: recreate the timeline set with 3 of 4 beats = 39 markers.
find(ui, "beat-3").notify("onClick");
assert(BM.state.activeBeats[2] === false, "beat 3 toggled off");
find(ui, "create-timeline").onClick();
var toggled = BM.listMarkers("comp");
assert(toggled.length === 39, "39 timeline markers with beat 3 off, got " + toggled.length);
for (var t = 0; t < toggled.length; t++) {
  assert(BM.markerBeatPos(toggled[t]) !== 3, "no beat 3 marker after toggle");
}

// A phase step rotates the pattern: same count, still no disabled colour.
find(ui, "phase-prev").onClick();
var rotated = BM.listMarkers("comp");
assert(rotated.length === 39, "phase rotation keeps 39 markers, got " + rotated.length);
for (t = 0; t < rotated.length; t++) {
  assert(BM.markerBeatPos(rotated[t]) !== 3, "disabled beat 3 stays absent");
}

// Beat 3 on again: back to 52.
find(ui, "beat-3").notify("onClick");
find(ui, "create-timeline").onClick();
assert(BM.listMarkers("comp").length === 52, "52 markers after re-enabling beat 3");

// Remove -------------------------------------------------------------------
find(ui, "remove-timeline").onClick();
find(ui, "remove-clip").onClick();
assert(BM.listMarkers("comp").length === 0, "timeline markers removed");
assert(BM.listMarkers("layer").length === 0, "clip markers removed");

JSON.stringify({
  ok: true,
  bpm: Math.round(BM.state.bpm * 100) / 100,
  markers: 52,
  phase: "ok",
  toggled: 39,
  cleared: true
});
