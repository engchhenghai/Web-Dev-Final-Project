var audioCtx = null;
var playTimer = null;
var currentStep = 0;
var isPlaying = false;
var tickFunction = null;
var isDragging = false;
var paintMode = true;
var NOTE_VOLUME = 0.8;

var noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function makeNotes(startOctave) {
  var list = [];
  for (var o = startOctave + 1; o >= startOctave; o--) {
    for (var n = 11; n >= 0; n--) {
      var midi = (o + 1) * 12 + n;
      var freq = 440 * Math.pow(2, (midi - 69) / 12);
      list.push({
        name: noteNames[n] + o,
        freq: freq,
        black: noteNames[n].length === 2
      });
    }
  }
  return list;
}

var instrumentNotes = {
  drums: [
    { name: "Crash", freq: 800, black: false },
    { name: "Hi-Hat", freq: 600, black: true },
    { name: "Clap", freq: 450, black: false },
    { name: "Snare", freq: 250, black: true },
    { name: "Tom", freq: 160, black: false },
    { name: "Kick", freq: 70, black: false }
  ],
  guitar: makeNotes(3),
  piano: makeNotes(4),
  bass: makeNotes(2)
};

var trackNames = ["drums", "guitar", "piano", "bass"];

function getAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function getBpm() {
  var saved = localStorage.getItem("daw_bpm");
  if (saved) {
    return parseInt(saved, 10);
  }
  return 120;
}

// Length of one 1/16 step in seconds
function getStepTime() {
  return 60 / getBpm() / 4;
}

function startTimer() {
  clearInterval(playTimer);
  playTimer = setInterval(tickFunction, getStepTime() * 1000);
}

function setupBpmSlider() {
  var slider = document.getElementById("bpmSlider");
  var display = document.getElementById("bpmDisplay");
  if (!slider) return;

  slider.value = getBpm();
  display.innerText = "BPM: " + getBpm();

  slider.oninput = function() {
    localStorage.setItem("daw_bpm", slider.value);
    display.innerText = "BPM: " + slider.value;
    if (isPlaying) {
      startTimer();
    }
  };
}

// One button that switches between Play and Pause.
// Pausing remembers the current step, so pressing Play again carries on from there.
function setupPlayPause(button, playLabel, onTick) {
  button.onclick = function() {
    if (isPlaying) {
      isPlaying = false;
      clearInterval(playTimer);
      button.innerText = playLabel;
    } else {
      isPlaying = true;
      tickFunction = onTick;
      button.innerText = "Pause";
      tickFunction();
      startTimer();
    }
  };
}

// Move the white playhead outline to the given column
function highlightStep(selector, step) {
  var boxes = document.querySelectorAll(selector);
  for (var i = 0; i < boxes.length; i++) {
    if (parseInt(boxes[i].dataset.col, 10) === step) {
      boxes[i].classList.add("playing");
    } else {
      boxes[i].classList.remove("playing");
    }
  }
}

function getTrackData(inst) {
  var raw = localStorage.getItem("daw_" + inst);
  var rows = instrumentNotes[inst].length;
  if (raw) {
    var saved = JSON.parse(raw);
    if (saved.length === rows) {
      return saved;
    }
  }
  var grid = [];
  for (var r = 0; r < rows; r++) {
    var rowArr = [];
    for (var c = 0; c < 16; c++) {
      rowArr.push(0);
    }
    grid.push(rowArr);
  }
  return grid;
}

function saveTrackData(inst, grid) {
  localStorage.setItem("daw_" + inst, JSON.stringify(grid));
}

// A cell is a note if it holds anything above 0
function hasNote(value) {
  return value > 0;
}

// Quantize = how many 1/16 steps one grid slot covers (1 = 1/16, 2 = 1/8, 4 = 1/4)
function getQuantize(inst) {
  var saved = parseInt(localStorage.getItem("daw_quant_" + inst), 10);
  if (saved === 1 || saved === 2 || saved === 4) {
    return saved;
  }
  return 1;
}

function snapToGrid(col, quant) {
  return col - (col % quant);
}

// ctx and when are optional: normally the sound plays right now through the speakers,
// but the MP3 export passes an offline context and a time in the song instead.
function playSound(inst, freq, vol, ctx, when) {
  ctx = ctx || getAudio();
  var now = when !== undefined ? when : ctx.currentTime;
  var gain = ctx.createGain();
  gain.connect(ctx.destination);
  var volumeVal = vol !== undefined ? vol : 0.5;

  if (inst === "drums") {
    if (freq <= 80) {
      var osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.15);
      gain.gain.setValueAtTime(volumeVal, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (freq <= 260) {
      var osc2 = ctx.createOscillator();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(volumeVal * 0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc2.connect(gain);
      osc2.start(now);
      osc2.stop(now + 0.15);
    } else {
      var osc3 = ctx.createOscillator();
      osc3.type = "square";
      osc3.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(volumeVal * 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc3.connect(gain);
      osc3.start(now);
      osc3.stop(now + 0.08);
    }
  } else if (inst === "guitar") {
    var oscG = ctx.createOscillator();
    oscG.type = "sawtooth";
    oscG.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(volumeVal * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    oscG.connect(gain);
    oscG.start(now);
    oscG.stop(now + 0.35);
  } else if (inst === "piano") {
    var oscP = ctx.createOscillator();
    oscP.type = "triangle";
    oscP.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(volumeVal * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    oscP.connect(gain);
    oscP.start(now);
    oscP.stop(now + 0.4);
  } else if (inst === "bass") {
    var oscB = ctx.createOscillator();
    oscB.type = "sawtooth";
    oscB.frequency.setValueAtTime(freq, now);
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(300, now);
    gain.gain.setValueAtTime(volumeVal * 0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    oscB.connect(filter);
    filter.connect(gain);
    oscB.start(now);
    oscB.stop(now + 0.3);
  }
}

function countNotes(grid) {
  var total = 0;
  for (var r = 0; r < grid.length; r++) {
    for (var c = 0; c < grid[r].length; c++) {
      if (hasNote(grid[r][c])) {
        total++;
      }
    }
  }
  return total;
}

function initMenuPage() {
  var form = document.getElementById("settingsForm");
  if (!form) return;

  var savedName = localStorage.getItem("daw_song_name");
  var savedBpm = localStorage.getItem("daw_bpm");
  if (savedName) document.getElementById("songName").value = savedName;
  if (savedBpm) document.getElementById("bpmInput").value = savedBpm;

  form.onsubmit = function(e) {
    e.preventDefault();
    var nameVal = document.getElementById("songName").value;
    var bpmVal = document.getElementById("bpmInput").value;
    localStorage.setItem("daw_song_name", nameVal);
    localStorage.setItem("daw_bpm", bpmVal);
    document.getElementById("saveMsg").innerText = "Saved! Ready to play.";
  };
}

function initPianoRoll(inst) {
  var rollGrid = document.getElementById("pianoRollGrid");
  if (!rollGrid) return;

  var notes = instrumentNotes[inst];
  var gridData = getTrackData(inst);
  var noteCountEl = document.getElementById("noteCount");
  var quantSelect = document.getElementById("quantizeSelect");
  var quant = getQuantize(inst);
  var cellRefs = [];

  setupBpmSlider();

  function updateOffGridCells() {
    for (var r = 0; r < cellRefs.length; r++) {
      for (var c = 0; c < cellRefs[r].length; c++) {
        if (c % quant === 0) {
          cellRefs[r][c].classList.remove("off-grid");
        } else {
          cellRefs[r][c].classList.add("off-grid");
        }
      }
    }
  }

  if (quantSelect) {
    quantSelect.value = String(quant);
    quantSelect.onchange = function() {
      quant = parseInt(quantSelect.value, 10);
      localStorage.setItem("daw_quant_" + inst, quant);
      updateOffGridCells();
    };
  }
  noteCountEl.innerText = countNotes(gridData) + " Notes";

  function paintCell(cell, adding) {
    var rr = parseInt(cell.dataset.row, 10);
    var cc = parseInt(cell.dataset.col, 10);
    if (adding) {
      // New notes snap to the quantize grid
      cc = snapToGrid(cc, quant);
      cell = cellRefs[rr][cc];
      if (hasNote(gridData[rr][cc])) return;
      gridData[rr][cc] = 1;
      cell.classList.add("active");
      playSound(inst, notes[rr].freq, NOTE_VOLUME);
    } else {
      // Erasing works on any cell
      if (!hasNote(gridData[rr][cc])) return;
      gridData[rr][cc] = 0;
      cell.classList.remove("active");
    }
    saveTrackData(inst, gridData);
    noteCountEl.innerText = countNotes(gridData) + " Notes";
  }

  rollGrid.onselectstart = function() {
    return false;
  };

  document.onmouseup = function() {
    isDragging = false;
  };

  rollGrid.innerHTML = "";
  for (var r = 0; r < notes.length; r++) {
    var rowDiv = document.createElement("div");
    rowDiv.className = "roll-row";
    cellRefs.push([]);

    var keyDiv = document.createElement("div");
    keyDiv.className = "piano-key" + (notes[r].black ? " black-key" : "");
    keyDiv.innerText = notes[r].name;
    rowDiv.appendChild(keyDiv);

    for (var c = 0; c < 16; c++) {
      var cell = document.createElement("div");
      cell.className = "grid-cell";
      if (c % 4 === 0) cell.className += " beat-start";
      if (hasNote(gridData[r][c])) cell.className += " active";
      cell.dataset.row = r;
      cell.dataset.col = c;

      cell.onmousedown = function(e) {
        e.preventDefault();
        var rr = parseInt(this.dataset.row, 10);
        var cc = parseInt(this.dataset.col, 10);
        isDragging = true;
        // Clicking an existing note starts erasing, clicking empty space starts adding
        paintMode = !hasNote(gridData[rr][cc]);
        paintCell(this, paintMode);
      };

      cell.onmouseenter = function() {
        if (isDragging) {
          paintCell(this, paintMode);
        }
      };

      rowDiv.appendChild(cell);
      cellRefs[r].push(cell);
    }
    rollGrid.appendChild(rowDiv);
  }
  updateOffGridCells();

  setupPlayPause(document.getElementById("playBtn"), "Play", function() {
    highlightStep(".grid-cell", currentStep);
    for (var r = 0; r < notes.length; r++) {
      if (hasNote(gridData[r][currentStep])) {
        playSound(inst, notes[r].freq, NOTE_VOLUME);
      }
    }
    currentStep = (currentStep + 1) % 16;
  });

  document.getElementById("clearBtn").onclick = function() {
    for (var r = 0; r < notes.length; r++) {
      for (var c = 0; c < 16; c++) {
        gridData[r][c] = 0;
      }
    }
    saveTrackData(inst, gridData);
    var allCells = document.querySelectorAll(".grid-cell");
    for (var i = 0; i < allCells.length; i++) {
      allCells[i].classList.remove("active");
    }
    noteCountEl.innerText = "0 Notes";
  };
}

// Restore a track's saved Mute / Vol settings and save them whenever they change
function setupMixerControls(inst) {
  var muteBox = document.getElementById("mute-" + inst);
  var volSlider = document.getElementById("vol-" + inst);
  if (!muteBox || !volSlider) return;

  var saved = JSON.parse(localStorage.getItem("daw_mix_" + inst) || "null");
  if (saved) {
    muteBox.checked = saved.mute;
    volSlider.value = saved.vol;
  }

  function save() {
    localStorage.setItem("daw_mix_" + inst, JSON.stringify({
      mute: muteBox.checked,
      vol: parseInt(volSlider.value, 10)
    }));
  }
  muteBox.onchange = save;
  volSlider.oninput = save;
}

// Mixer volume for a track (0 when muted)
function getTrackVolume(inst) {
  var muteBox = document.getElementById("mute-" + inst);
  if (muteBox && muteBox.checked) return 0;
  var volSlider = document.getElementById("vol-" + inst);
  return volSlider ? parseInt(volSlider.value, 10) / 100 : 0.6;
}

// ---------- MP3 export ----------

// Build the whole song into an audio buffer (faster than real time, nothing is played out loud)
function renderSong(loops) {
  var stepTime = getStepTime();
  var totalSteps = 16 * loops;
  var sampleRate = 44100;
  var seconds = totalSteps * stepTime + 1; // +1 second so the last notes can ring out
  var OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  var offline = new OfflineCtx(1, Math.ceil(seconds * sampleRate), sampleRate);

  for (var t = 0; t < trackNames.length; t++) {
    var inst = trackNames[t];
    var vol = getTrackVolume(inst);
    if (vol === 0) continue;
    var grid = getTrackData(inst);
    var notes = instrumentNotes[inst];
    for (var step = 0; step < totalSteps; step++) {
      for (var r = 0; r < notes.length; r++) {
        if (hasNote(grid[r][step % 16])) {
          playSound(inst, notes[r].freq, vol, offline, step * stepTime);
        }
      }
    }
  }
  return offline.startRendering();
}

// Turn the audio buffer into an MP3 file using the lamejs library
function encodeMp3(audioBuffer) {
  var samples = audioBuffer.getChannelData(0);

  // Turn it down if tracks stacked up louder than the maximum (stops crackling)
  var peak = 0;
  for (var i = 0; i < samples.length; i++) {
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  var scale = peak > 0.99 ? 0.99 / peak : 1;

  // MP3 encoders want 16-bit whole numbers instead of decimals between -1 and 1
  var pcm = new Int16Array(samples.length);
  for (var j = 0; j < samples.length; j++) {
    pcm[j] = samples[j] * scale * 32767;
  }

  var encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 128);
  var chunks = [];
  for (var k = 0; k < pcm.length; k += 1152) {
    var chunk = encoder.encodeBuffer(pcm.subarray(k, k + 1152));
    if (chunk.length > 0) chunks.push(chunk);
  }
  var last = encoder.flush();
  if (last.length > 0) chunks.push(last);

  return new Blob(chunks, { type: "audio/mpeg" });
}

function downloadFile(blob, fileName) {
  var link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function() {
    URL.revokeObjectURL(link.href);
  }, 1000);
}

function setupExport(songTitle) {
  var exportBtn = document.getElementById("exportBtn");
  var loopSelect = document.getElementById("loopSelect");
  var msg = document.getElementById("exportMsg");
  if (!exportBtn) return;

  exportBtn.onclick = function() {
    if (typeof lamejs === "undefined") {
      msg.innerText = "MP3 encoder didn't load. Check your internet connection.";
      return;
    }
    var total = 0;
    for (var t = 0; t < trackNames.length; t++) {
      total += countNotes(getTrackData(trackNames[t]));
    }
    if (total === 0) {
      msg.innerText = "Add some notes first!";
      return;
    }

    var fileName = (songTitle.replace(/[^a-z0-9 _-]/gi, "").trim() || "my-beat") + ".mp3";
    exportBtn.disabled = true;
    msg.innerText = "Rendering...";

    renderSong(parseInt(loopSelect.value, 10))
      .then(function(buffer) {
        msg.innerText = "Encoding MP3...";
        // Short wait so the message shows before the encoder keeps the page busy
        return new Promise(function(resolve) {
          setTimeout(function() {
            resolve(encodeMp3(buffer));
          }, 30);
        });
      })
      .then(function(mp3) {
        downloadFile(mp3, fileName);
        msg.innerText = "Saved " + fileName;
      })
      .catch(function(err) {
        msg.innerText = "Couldn't save: " + err.message;
      })
      .then(function() {
        exportBtn.disabled = false;
      });
  };
}

function initMixerPage() {
  var mixerArea = document.getElementById("mixerArea");
  if (!mixerArea) return;

  var songTitle = localStorage.getItem("daw_song_name") || "Untitled Beat";
  document.getElementById("mixerTitle").innerText = "Mixer - " + songTitle;
  setupBpmSlider();

  for (var t = 0; t < trackNames.length; t++) {
    var inst = trackNames[t];
    var grid = getTrackData(inst);
    var mini = document.getElementById("mini-" + inst);
    mini.innerHTML = "";
    for (var c = 0; c < 16; c++) {
      var stepBox = document.createElement("div");
      stepBox.className = "mini-step";
      stepBox.dataset.col = c;
      var hasAny = false;
      for (var r = 0; r < grid.length; r++) {
        if (hasNote(grid[r][c])) hasAny = true;
      }
      if (hasAny) stepBox.className += " has-note";
      mini.appendChild(stepBox);
    }
    document.getElementById("count-" + inst).innerText = countNotes(grid);
    setupMixerControls(inst);
  }

  setupPlayPause(document.getElementById("playAllBtn"), "Play All", function() {
    highlightStep(".mini-step", currentStep);
    for (var t = 0; t < trackNames.length; t++) {
      var inst = trackNames[t];
      var vol = getTrackVolume(inst);
      if (vol === 0) continue;
      var grid = getTrackData(inst);
      var notes = instrumentNotes[inst];
      for (var r = 0; r < notes.length; r++) {
        if (hasNote(grid[r][currentStep])) {
          playSound(inst, notes[r].freq, vol);
        }
      }
    }
    currentStep = (currentStep + 1) % 16;
  });

  setupExport(songTitle);
}
