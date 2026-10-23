// Footage mode: no audio layer in the comp, the source comes from the Project
// panel selection. Timeline markers only.
// Runs headless: effectcraft-cli script test/footage.test.jsx --empty

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
var comp = app.project.items.addComp("Footage Test", 640, 360, 1, 30, 30);
comp.openInViewer();

var item = app.project.importFile(new ImportOptions(new File(HERE + "/samples/click.flac")));
app.project.selection = [item];

find(ui, "analyze").onClick();
assert(BM.state.source === "file", "source is a standalone footage item");
assert(BM.state.sourceLayerId === null, "no layer bound");
assert(BM.state.sourceStart === 0, "no layer offset");
assert(Math.abs(BM.state.bpm - 128) < 0.3, "BPM");
assert(BM.state.beats.length === 52, "beats");
assert(find(ui, "create-clip").enabled === false, "clip creation disabled");
assert(find(ui, "create-timeline").enabled === true, "timeline creation enabled");
assert(find(ui, "phase-target").enabled === false, "phase target locked to the timeline");
assert(find(ui, "phase-target").selection.index === 1, "phase target is Timeline");
assert(find(ui, "clip-sub").text.indexOf("standalone footage") === 0, "footage hint shown");

find(ui, "create-timeline").onClick();
var markers = BM.listMarkers("comp");
assert(markers.length === 52, "52 timeline markers");
assert(Math.abs(markers[0].time) < 0.001, "first marker at 0 s");
assert(Math.abs(markers[1].time - 0.467) < 0.005, "second marker at 0.467 s");
assert(BM.markerBeatPos(markers[0]) === 1, "beat data present");

find(ui, "remove-timeline").onClick();
assert(BM.listMarkers("comp").length === 0, "markers removed");

JSON.stringify({
  ok: true,
  source: "footage",
  bpm: Math.round(BM.state.bpm * 100) / 100,
  beats: 52,
  cleared: true
});
