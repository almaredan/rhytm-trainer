import {
  Beam,
  Dot,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  StaveTie,
  Tuplet,
  Voice,
} from "vexflow";

const BEATS_PER_BAR = 4;
const TICKS_PER_BEAT = 24;
const TICKS_PER_WHOLE = 96;
const TICKS_PER_BAR = BEATS_PER_BAR * TICKS_PER_BEAT;

const STANDARD_TICK_TO_DURATION = new Map([
  [96, "w"],
  [48, "h"],
  [24, "q"],
  [12, "8"],
  [6, "16"],
  [3, "32"],
]);

const TRIPLET_TICK_TO_DURATION = new Map([
  [32, "h"],
  [16, "q"],
  [8, "8"],
  [4, "16"],
]);

const DECOMPOSE_TICKS_DESC = [96, 72, 48, 36, 32, 24, 18, 16, 12, 9, 8, 6, 4, 3];
const STAFF_RENDER_WIDTH_SCALE = 1;
const INTERNAL_OUTPUT_IDS = {
  drum: "__internal_drum",
  bass: "__internal_bass",
};

const RHYTHM_MODES = {
  straight: {
    label: "Straight 16ths",
    unitTicks: 3,
    timing: "straight",
    valueHint: "Use standard values 1, 1/2, 1/4, 1/8, 1/16 with optional dots and ligatures.",
  },
  swing8: {
    label: "Swing 8ths",
    unitTicks: 3,
    timing: "swing8",
    valueHint: "Use standard values with swing playback feel (long-short 8ths).",
  },
  triplet: {
    label: "Triplets (3 per beat)",
    unitTicks: 4,
    timing: "triplet",
    valueHint: "Use triplet-ready values (including 1/3, 1/6, 1/12, 1/24) plus dots/ligatures.",
  },
};

const DENSITY_PRESETS = {
  simple: {
    restChance: 0.34,
    hitRatioRange: [0.16, 0.35],
  },
  medium: {
    restChance: 0.24,
    hitRatioRange: [0.26, 0.52],
  },
  busy: {
    restChance: 0.14,
    hitRatioRange: [0.34, 0.7],
  },
};

const elements = {
  generateBtn: document.getElementById("generateBtn"),
  playTargetBtn: document.getElementById("playTargetBtn"),
  playAttemptBtn: document.getElementById("playAttemptBtn"),
  stopBtn: document.getElementById("stopBtn"),
  tempoInput: document.getElementById("tempoInput"),
  tempoValue: document.getElementById("tempoValue"),
  metronomeToggle: document.getElementById("metronomeToggle"),
  barsSelect: document.getElementById("barsSelect"),
  rhythmModeSelect: document.getElementById("rhythmModeSelect"),
  densitySelect: document.getElementById("densitySelect"),
  valueSelect: document.getElementById("valueSelect"),
  dottedToggle: document.getElementById("dottedToggle"),
  restToggle: document.getElementById("restToggle"),
  tieToggle: document.getElementById("tieToggle"),
  addValueBtn: document.getElementById("addValueBtn"),
  undoValueBtn: document.getElementById("undoValueBtn"),
  entryProgress: document.getElementById("entryProgress"),
  notationStyleSelect: document.getElementById("notationStyleSelect"),
  enableMidiBtn: document.getElementById("enableMidiBtn"),
  midiOutputSelect: document.getElementById("midiOutputSelect"),
  clearBtn: document.getElementById("clearBtn"),
  checkBtn: document.getElementById("checkBtn"),
  revealBtn: document.getElementById("revealBtn"),
  targetGrid: document.getElementById("targetGrid"),
  userGrid: document.getElementById("userGrid"),
  targetStaff: document.getElementById("targetStaff"),
  userStaff: document.getElementById("userStaff"),
  staffPromptBackdrop: document.getElementById("staffPromptBackdrop"),
  staffPromptType: document.getElementById("staffPromptType"),
  staffPromptValue: document.getElementById("staffPromptValue"),
  staffPromptVariant: document.getElementById("staffPromptVariant"),
  staffPromptPosition: document.getElementById("staffPromptPosition"),
  staffPromptCancelBtn: document.getElementById("staffPromptCancelBtn"),
  staffPromptPlaceBtn: document.getElementById("staffPromptPlaceBtn"),
  notationHint: document.getElementById("notationHint"),
  trainerTabBtn: document.getElementById("trainerTabBtn"),
  quizTabBtn: document.getElementById("quizTabBtn"),
  trainerTabPanel: document.getElementById("trainerTabPanel"),
  quizTabPanel: document.getElementById("quizTabPanel"),
  generateQuizBtn: document.getElementById("generateQuizBtn"),
  playQuizBtn: document.getElementById("playQuizBtn"),
  quizDifficultySelect: document.getElementById("quizDifficultySelect"),
  quizOptions: document.getElementById("quizOptions"),
  quizStatus: document.getElementById("quizStatus"),
  quizFollowup: document.getElementById("quizFollowup"),
  quizFollowupText: document.getElementById("quizFollowupText"),
  quizReplayBtn: document.getElementById("quizReplayBtn"),
  quizNextRoundBtn: document.getElementById("quizNextRoundBtn"),
  feedbackCard: document.getElementById("feedbackCard"),
  statusText: document.getElementById("statusText"),
  exerciseStat: document.getElementById("exerciseStat"),
  accuracyStat: document.getElementById("accuracyStat"),
  hintStat: document.getElementById("hintStat"),
};

const targetCells = [];
const userCells = [];
let valueOptions = [];

let bars = 2;
let rhythmMode = "straight";
let notationStyle = "compact";
let metronomeEnabled = false;

let hasRhythm = false;
let revealAnswer = false;

let targetTokens = [];
let targetSegments = [];
let targetPattern = [];

let userTokens = [];
let userSegments = [];
let userPattern = [];
let userCursorTick = 0;

let hasQuizRound = false;
let quizDifficulty = "medium";
let quizPattern = [];
let quizCorrectSegments = [];
let quizOptionSets = [];
let quizCorrectIndex = -1;
let quizSelectedIndex = -1;
let activeAppTab = "trainer";

let isPlaying = false;
let playbackTimer = null;
let playbackTick = 0;
let currentPlaybackPattern = null;
let currentPlaybackOnsetDurations = null;
let playbackSource = null;
let lastCursorUnit = -1;

let audioContext = null;
let masterGain = null;
let beatFlashTimer = null;

let midiAccess = null;
let selectedMidiOutputId = INTERNAL_OUTPUT_IDS.bass;
let staffRenderQueued = false;
let staffPromptOpen = false;
let tabPanelMinHeight = 0;

init();

function init() {
  syncSettingsFromControls();
  wireEvents();
  refreshMidiOutputs();
  rebuildExerciseBoard();
  setActiveAppTab("trainer");
  updateTempoLabel();
  window.addEventListener("resize", queueStaffRender);
  setStatus("Generate a rhythm to begin.", "neutral");
}

function wireEvents() {
  bindActionButton(elements.generateBtn, generateRhythm);
  bindActionButton(elements.playTargetBtn, () => playPattern(targetPattern, "target"));
  bindActionButton(elements.playAttemptBtn, () => playPattern(userPattern, "attempt"));
  bindActionButton(elements.stopBtn, () => stopPlayback(true));

  bindActionButton(elements.generateQuizBtn, generateQuizRound);
  bindActionButton(elements.playQuizBtn, playQuizPattern);
  bindActionButton(elements.quizReplayBtn, playQuizPattern);
  bindActionButton(elements.quizNextRoundBtn, generateQuizRound);
  elements.quizDifficultySelect.addEventListener("change", onQuizDifficultyChanged);
  bindActionButton(elements.trainerTabBtn, () => setActiveAppTab("trainer"));
  bindActionButton(elements.quizTabBtn, () => setActiveAppTab("quiz"));

  bindActionButton(elements.clearBtn, clearNotation);
  bindActionButton(elements.checkBtn, checkAnswer);
  bindActionButton(elements.revealBtn, toggleRevealAnswer);

  elements.tempoInput.addEventListener("input", updateTempoLabel);
  elements.barsSelect.addEventListener("change", onExerciseConfigChanged);
  elements.rhythmModeSelect.addEventListener("change", onExerciseConfigChanged);
  elements.notationStyleSelect.addEventListener("change", onExerciseConfigChanged);

  bindActionButton(elements.addValueBtn, insertValueFromControls);
  bindActionButton(elements.undoValueBtn, undoUserValue);
  elements.restToggle.addEventListener("change", onRestToggleChanged);

  elements.userStaff.addEventListener("click", onUserStaffClick);
  bindActionButton(elements.staffPromptCancelBtn, closeStaffPrompt);
  bindActionButton(elements.staffPromptPlaceBtn, placeFromStaffPrompt);
  elements.staffPromptBackdrop.addEventListener("click", (event) => {
    if (event.target === elements.staffPromptBackdrop) {
      closeStaffPrompt();
    }
  });

  bindActionButton(elements.enableMidiBtn, enableMidi);
  elements.midiOutputSelect.addEventListener("change", (event) => {
    selectedMidiOutputId = event.target.value;
  });

  if (elements.metronomeToggle) {
    elements.metronomeToggle.addEventListener("change", () => {
      metronomeEnabled = elements.metronomeToggle.checked;
    });
  }
}

function bindActionButton(button, handler) {
  if (!button) {
    return;
  }

  button.addEventListener("click", (event) => {
    event.preventDefault();
    const preservedX = window.scrollX;
    const preservedY = window.scrollY;

    Promise.resolve(handler(event)).finally(() => {
      window.requestAnimationFrame(() => {
        if (Math.abs(window.scrollY - preservedY) > 1 || Math.abs(window.scrollX - preservedX) > 1) {
          window.scrollTo({ left: preservedX, top: preservedY, behavior: "auto" });
        }
      });
    });
  });
}

function onExerciseConfigChanged() {
  if (isPlaying) {
    stopPlayback(false);
  }

  syncSettingsFromControls();
  rebuildExerciseBoard();
  setStatus(`Exercise set to ${formatExerciseLabel()}. Generate a new rhythm.`, "neutral");
}

function setActiveAppTab(tab) {
  syncTabPanelMinHeight();

  activeAppTab = tab === "quiz" ? "quiz" : "trainer";
  const trainerActive = activeAppTab === "trainer";

  elements.trainerTabBtn.classList.toggle("active", trainerActive);
  elements.trainerTabBtn.setAttribute("aria-selected", String(trainerActive));

  elements.quizTabBtn.classList.toggle("active", !trainerActive);
  elements.quizTabBtn.setAttribute("aria-selected", String(!trainerActive));

  elements.trainerTabPanel.classList.toggle("hidden-tab", !trainerActive);
  elements.quizTabPanel.classList.toggle("hidden-tab", trainerActive);

  window.requestAnimationFrame(syncTabPanelMinHeight);
  queueStaffRender();
}

function syncTabPanelMinHeight() {
  const currentPanel = activeAppTab === "quiz" ? elements.quizTabPanel : elements.trainerTabPanel;
  if (!currentPanel) {
    return;
  }

  const measured = Math.ceil(currentPanel.getBoundingClientRect().height);
  if (!Number.isFinite(measured) || measured <= 0) {
    return;
  }

  tabPanelMinHeight = Math.max(tabPanelMinHeight, measured);
  const minHeight = `${tabPanelMinHeight}px`;
  elements.trainerTabPanel.style.minHeight = minHeight;
  elements.quizTabPanel.style.minHeight = minHeight;
}

function onRestToggleChanged() {
  if (elements.restToggle.checked) {
    elements.tieToggle.checked = false;
  }

  updateEntryUI();
}

function syncSettingsFromControls() {
  const parsedBars = Number(elements.barsSelect.value);
  bars = Number.isFinite(parsedBars) && parsedBars > 0 ? parsedBars : 2;

  const selectedMode = elements.rhythmModeSelect.value;
  rhythmMode = RHYTHM_MODES[selectedMode] ? selectedMode : "straight";

  const selectedStyle = elements.notationStyleSelect.value;
  notationStyle = selectedStyle === "expanded" ? "expanded" : "compact";

  metronomeEnabled = Boolean(elements.metronomeToggle?.checked);

  const selectedQuizDifficulty = elements.quizDifficultySelect?.value;
  quizDifficulty = ["easy", "medium", "hard"].includes(selectedQuizDifficulty)
    ? selectedQuizDifficulty
    : "medium";

  elements.barsSelect.value = String(bars);
  elements.rhythmModeSelect.value = rhythmMode;
  elements.notationStyleSelect.value = notationStyle;
  elements.quizDifficultySelect.value = quizDifficulty;
}

function rebuildExerciseBoard() {
  hasRhythm = false;
  revealAnswer = false;

  targetTokens = [];
  targetSegments = [];
  targetPattern = createEmptyPattern();

  resetQuizRound();

  resetUserNotation();

  buildGrid(elements.targetGrid, targetCells, false);
  buildGrid(elements.userGrid, userCells, true);
  renderValueOptions();
  applyGridStyle();
  clearUserHints();
  setStats("--", "--", "Correct Segments");
  updateExerciseLabels();
  updateEntryUI();
  renderAll();
  elements.revealBtn.textContent = "Reveal Answer";
}

function buildGrid(container, cellStore, interactive) {
  container.innerHTML = "";
  cellStore.length = 0;

  const unitsPerBar = getUnitsPerBar();
  const totalUnits = getTotalUnits();
  const unitsPerBeat = getUnitsPerBeat();

  container.style.setProperty("--units-per-bar", String(unitsPerBar));
  container.dataset.style = notationStyle;

  for (let unit = 0; unit < totalUnits; unit += 1) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "rhythm-cell";
    cell.dataset.unit = String(unit);

    const label = document.createElement("span");
    label.className = "token-label";
    cell.appendChild(label);

    if (unit % unitsPerBeat === 0) {
      cell.classList.add("beat-start");
    }

    if (unit % unitsPerBar === 0) {
      cell.classList.add("bar-start");
    }

    if ((unit + 1) % unitsPerBar === 0) {
      cell.classList.add("bar-end");
    }

    if (!interactive) {
      cell.disabled = true;
    }

    container.appendChild(cell);
    cellStore.push(cell);
  }
}

function createEmptyPattern() {
  return Array.from({ length: getTotalTicks() }, () => false);
}

function getModeConfig() {
  return RHYTHM_MODES[rhythmMode] || RHYTHM_MODES.straight;
}

function getTotalTicks() {
  return bars * TICKS_PER_BAR;
}

function getUnitTicks() {
  return getModeConfig().unitTicks;
}

function getUnitsPerBeat() {
  return TICKS_PER_BEAT / getUnitTicks();
}

function getUnitsPerBar() {
  return TICKS_PER_BAR / getUnitTicks();
}

function getTotalUnits() {
  return getTotalTicks() / getUnitTicks();
}

function formatExerciseLabel() {
  const barLabel = bars === 1 ? "bar" : "bars";
  return `${bars} ${barLabel}, ${getModeConfig().label}`;
}

function applyGridStyle() {
  elements.targetGrid.dataset.style = notationStyle;
  elements.userGrid.dataset.style = notationStyle;
}

function updateExerciseLabels() {
  elements.notationHint.textContent = "Click on Your Staff to place note/rest values (normal, dot, ligature).";
  elements.exerciseStat.textContent = `Exercise: ${formatExerciseLabel()}`;
}

function renderValueOptions() {
  const previousValue = Number(elements.valueSelect.value);
  valueOptions = getBaseValueOptions();

  elements.valueSelect.innerHTML = "";
  valueOptions.forEach((option) => {
    const element = document.createElement("option");
    element.value = String(option.ticks);
    element.textContent = option.label;
    elements.valueSelect.appendChild(element);
  });

  const hasPrevious = valueOptions.some((option) => option.ticks === previousValue);
  elements.valueSelect.value = String(hasPrevious ? previousValue : valueOptions[0]?.ticks || "24");
  elements.dottedToggle.checked = false;
  elements.restToggle.checked = false;
  elements.tieToggle.checked = false;

  renderPromptValueOptions();
}

function renderPromptValueOptions() {
  if (!elements.staffPromptValue) {
    return;
  }

  const previous = Number(elements.staffPromptValue.value);
  elements.staffPromptValue.innerHTML = "";

  valueOptions.forEach((option) => {
    const item = document.createElement("option");
    item.value = String(option.ticks);
    item.textContent = option.label;
    elements.staffPromptValue.appendChild(item);
  });

  const hasPrevious = valueOptions.some((option) => option.ticks === previous);
  elements.staffPromptValue.value = String(hasPrevious ? previous : valueOptions[0]?.ticks || "24");
}

function getBaseValueOptions() {
  if (rhythmMode === "triplet") {
    return [
      { label: "1", ticks: 96 },
      { label: "1/2", ticks: 48 },
      { label: "1/4", ticks: 24 },
      { label: "1/3", ticks: 32 },
      { label: "1/6", ticks: 16 },
      { label: "1/12", ticks: 8 },
      { label: "1/24", ticks: 4 },
    ];
  }

  return [
    { label: "1", ticks: 96 },
    { label: "1/2", ticks: 48 },
    { label: "1/4", ticks: 24 },
    { label: "1/8", ticks: 12 },
    { label: "1/16", ticks: 6 },
  ];
}

function getSelectedDurationTicks() {
  const baseTicks = Number(elements.valueSelect.value);
  if (!Number.isFinite(baseTicks) || baseTicks <= 0) {
    return null;
  }

  if (!elements.dottedToggle.checked) {
    return baseTicks;
  }

  if (baseTicks % 2 !== 0) {
    return null;
  }

  const dottedDuration = (baseTicks * 3) / 2;
  return Number.isInteger(dottedDuration) ? dottedDuration : null;
}

function updateEntryUI() {
  const totalUnits = getTotalUnits();
  const filledUnits = Math.floor(userCursorTick / getUnitTicks());
  const complete = userCursorTick >= getTotalTicks();

  elements.entryProgress.textContent = complete
    ? `Filled: ${totalUnits} / ${totalUnits} units (complete)`
    : `Filled: ${filledUnits} / ${totalUnits} units`;

  const canInsert = hasRhythm && !isPlaying;
  elements.addValueBtn.disabled = !canInsert;
  elements.undoValueBtn.disabled = !canInsert || userTokens.length === 0;

  if (elements.restToggle.checked) {
    elements.tieToggle.checked = false;
  }

  elements.tieToggle.disabled = elements.restToggle.checked || isPlaying;
  elements.valueSelect.disabled = isPlaying;
  elements.dottedToggle.disabled = isPlaying;
  elements.restToggle.disabled = isPlaying;
}

function resetUserNotation() {
  userTokens = [];
  userSegments = [];
  userPattern = createEmptyPattern();
  userCursorTick = 0;
  lastCursorUnit = -1;
}

function resetQuizRound(statusMessage) {
  hasQuizRound = false;
  quizPattern = createEmptyPattern();
  quizCorrectSegments = [];
  quizOptionSets = [];
  quizCorrectIndex = -1;
  quizSelectedIndex = -1;

  elements.playQuizBtn.disabled = true;
  renderQuizOptions();
  renderQuizFollowup();
  setQuizStatus(statusMessage || "Generate a quiz round, play it, then pick the matching notation.", "neutral");
}

function insertValueFromControls() {
  if (!hasRhythm) {
    setStatus("Generate a rhythm before entering notation.", "warning");
    return false;
  }

  if (isPlaying) {
    return false;
  }

  const durationTicks = getSelectedDurationTicks();
  if (!durationTicks) {
    setStatus("Selected dotted value is not valid in this rhythm mode.", "warning");
    return false;
  }

  if (durationTicks % getUnitTicks() !== 0) {
    setStatus("This value cannot be represented on the active note grid.", "warning");
    return false;
  }

  const totalTicks = getTotalTicks();
  if (userCursorTick + durationTicks > totalTicks) {
    setStatus("This value exceeds available bars. Choose a smaller value.", "warning");
    return false;
  }

  const isRest = elements.restToggle.checked;
  const tieToNext = !isRest && elements.tieToggle.checked;
  const valueLabel = formatValueLabel(durationTicks, elements.dottedToggle.checked);

  userTokens.push({
    startTick: userCursorTick,
    durationTicks,
    isRest,
    tieToNext,
    label: valueLabel,
  });

  userCursorTick += durationTicks;
  userSegments = tokensToCanonicalSegments(userTokens);
  userPattern = segmentsToOnsetPattern(userSegments);

  clearUserHints();
  renderUserGrid();
  renderStaffPanels();
  updateEntryUI();

  if (userCursorTick === totalTicks) {
    setStatus("Notation complete. Check your answer.", "neutral");
    return true;
  }

  if (userCursorTick % TICKS_PER_BAR === 0) {
    const closedBar = userCursorTick / TICKS_PER_BAR;
    setStatus(`Bar ${closedBar} closed automatically. Continue placing values.`, "neutral");
    return true;
  }

  return true;
}

function undoUserValue() {
  if (isPlaying || userTokens.length === 0) {
    return;
  }

  userTokens.pop();
  userCursorTick = userTokens.reduce((sum, token) => sum + token.durationTicks, 0);
  userSegments = tokensToCanonicalSegments(userTokens);
  userPattern = segmentsToOnsetPattern(userSegments);

  clearUserHints();
  renderUserGrid();
  renderStaffPanels();
  updateEntryUI();
  setStatus("Last value removed.", "neutral");
}

function clearNotation() {
  if (!hasRhythm || isPlaying) {
    return;
  }

  resetUserNotation();
  setStats("--", "--", "Correct Segments");
  clearUserHints();
  renderUserGrid();
  renderStaffPanels();
  updateEntryUI();
  setStatus("Notation cleared.", "neutral");
}

function generateRhythm() {
  stopPlayback(false);

  const generated = generateCanonicalRhythm();
  targetSegments = generated.segments;
  targetTokens = segmentsToDisplayTokens(targetSegments);
  targetPattern = generated.pattern;

  hasRhythm = true;
  revealAnswer = false;
  elements.revealBtn.textContent = "Reveal Answer";

  resetUserNotation();
  clearUserHints();
  setStats("--", "--", "Correct Segments");
  renderAll();
  updateEntryUI();
  setStatus(`New ${formatExerciseLabel()} rhythm ready. Listen first, then notate it below.`, "neutral");
}

function generateCanonicalRhythm() {
  const preset = DENSITY_PRESETS[elements.densitySelect.value] || DENSITY_PRESETS.medium;
  const totalTicks = getTotalTicks();
  const hitBounds = getHitBounds(preset.hitRatioRange, totalTicks);

  let nextSegments = [];
  let nextPattern = createEmptyPattern();

  for (let attempt = 0; attempt < 50; attempt += 1) {
    nextSegments = generateSegmentsFromPreset(preset);
    nextPattern = segmentsToOnsetPattern(nextSegments);
    const hitCount = nextPattern.filter(Boolean).length;

    if (hitCount >= hitBounds.minHits && hitCount <= hitBounds.maxHits) {
      break;
    }
  }

  const segments = canonicalizeSegments(nextSegments);
  return {
    segments,
    pattern: segmentsToOnsetPattern(segments),
  };
}

function getHitBounds(hitRatioRange, totalTicks) {
  const minHits = Math.max(bars, Math.round((totalTicks * hitRatioRange[0]) / getUnitTicks()));
  const maxHits = Math.max(minHits + 1, Math.round((totalTicks * hitRatioRange[1]) / getUnitTicks()));
  return {
    minHits,
    maxHits,
  };
}

function onQuizDifficultyChanged() {
  const selected = elements.quizDifficultySelect.value;
  quizDifficulty = ["easy", "medium", "hard"].includes(selected) ? selected : "medium";

  if (hasQuizRound) {
    setQuizStatus("Difficulty changed. Generate a new quiz round to apply it.", "neutral");
  }
}

function generateQuizRound() {
  stopPlayback(false);

  const generated = generateCanonicalRhythm();
  quizCorrectSegments = generated.segments;
  quizPattern = generated.pattern;

  const quizChoices = createQuizChoices(quizCorrectSegments, quizDifficulty);
  if (!quizChoices) {
    resetQuizRound("Quiz generation failed. Try again.");
    setStatus("Could not build quiz options. Try again.", "warning");
    return;
  }

  quizOptionSets = quizChoices.options;
  quizCorrectIndex = quizChoices.correctIndex;
  quizSelectedIndex = -1;
  hasQuizRound = true;

  elements.playQuizBtn.disabled = false;
  renderQuizOptions();
  renderQuizFollowup();

  const range = getQuizDifficultyRange(quizDifficulty);
  const rangeText = range.min === range.max ? `${range.min}` : `${range.min}-${range.max}`;
  const label = formatQuizDifficulty(quizDifficulty);
  setQuizStatus(`${label} quiz ready. Incorrect answers differ by about ${rangeText} sixteenths.`, "neutral");
  setStatus("Quiz round generated. Play it and choose the matching notation.", "neutral");
}

async function playQuizPattern() {
  if (!hasQuizRound) {
    setQuizStatus("Generate a quiz round first.", "warning");
    return;
  }

  await playPattern(quizPattern, "quiz");
}

function pickQuizOption(index) {
  if (!hasQuizRound || isPlaying || quizSelectedIndex >= 0) {
    return;
  }

  quizSelectedIndex = index;
  const isCorrect = index === quizCorrectIndex;

  if (isCorrect) {
    setQuizStatus("Correct. Replay rhythm or start another round.", "success");
    setStatus("Quiz solved.", "success");
  } else {
    const answer = String.fromCharCode(65 + quizCorrectIndex);
    setQuizStatus(`Not correct. The right answer is option ${answer}. Replay rhythm or start another round.`, "warning");
    setStatus("Quiz answer was incorrect.", "warning");
  }

  renderQuizOptions();
  renderQuizFollowup();
}

function renderQuizOptions() {
  if (!elements.quizOptions) {
    return;
  }

  elements.quizOptions.innerHTML = "";

  if (!hasQuizRound || quizOptionSets.length === 0) {
    const placeholder = document.createElement("p");
    placeholder.className = "quiz-placeholder";
    placeholder.textContent = "No quiz yet. Generate a round to see four notation choices.";
    elements.quizOptions.appendChild(placeholder);
    syncTabPanelMinHeight();
    return;
  }

  quizOptionSets.forEach((option, index) => {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "quiz-option";
    choice.setAttribute("role", "radio");
    choice.setAttribute("aria-checked", String(quizSelectedIndex === index));
    choice.disabled = isPlaying || quizSelectedIndex >= 0;

    if (quizSelectedIndex === index) {
      choice.classList.add("selected");
    }

    if (quizSelectedIndex >= 0) {
      if (index === quizCorrectIndex) {
        choice.classList.add("correct");
      } else if (index === quizSelectedIndex) {
        choice.classList.add("wrong");
      }
    }

    const head = document.createElement("div");
    head.className = "quiz-option-head";

    const tag = document.createElement("span");
    tag.className = "quiz-option-tag";
    tag.textContent = `Option ${String.fromCharCode(65 + index)}`;
    head.appendChild(tag);
    choice.appendChild(head);

    const staffWrap = document.createElement("div");
    staffWrap.className = "staff-canvas-wrap";
    choice.appendChild(staffWrap);

    bindActionButton(choice, () => pickQuizOption(index));
    elements.quizOptions.appendChild(choice);

    // Render after mount so staff width uses the real card width instead of fallback.
    renderStaffPanel(staffWrap, option.tokens);
  });

  syncTabPanelMinHeight();
}

function renderQuizFollowup() {
  if (!elements.quizFollowup || !elements.quizFollowupText) {
    return;
  }

  const answered = hasQuizRound && quizSelectedIndex >= 0;
  elements.quizFollowup.classList.toggle("hidden", !answered);

  if (!answered) {
    elements.quizFollowup.dataset.tone = "neutral";
    elements.quizFollowupText.textContent = "";
    if (elements.quizReplayBtn) {
      elements.quizReplayBtn.disabled = true;
    }
    if (elements.quizNextRoundBtn) {
      elements.quizNextRoundBtn.disabled = false;
    }
    syncTabPanelMinHeight();
    return;
  }

  const isCorrect = quizSelectedIndex === quizCorrectIndex;
  const answer = String.fromCharCode(65 + quizCorrectIndex);

  elements.quizFollowup.dataset.tone = isCorrect ? "success" : "warning";
  elements.quizFollowupText.textContent = isCorrect
    ? "Nice work. Replay the rhythm or start another round."
    : `Correct option: ${answer}. Replay the rhythm or start another round.`;

  if (elements.quizReplayBtn) {
    elements.quizReplayBtn.disabled = isPlaying;
  }
  if (elements.quizNextRoundBtn) {
    elements.quizNextRoundBtn.disabled = isPlaying;
  }

  syncTabPanelMinHeight();
}

function createQuizChoices(correctSegments, difficulty) {
  const signatures = new Set();
  const options = [];

  const clonedCorrect = cloneSegments(correctSegments);
  const correctSignature = getSegmentSignature(clonedCorrect);

  signatures.add(correctSignature);
  options.push({
    tokens: segmentsToDisplayTokens(clonedCorrect),
    isCorrect: true,
  });

  const baseRange = getQuizDifficultyRange(difficulty);
  let activeRange = { ...baseRange };
  let misses = 0;

  while (options.length < 4 && misses < 540) {
    let distractor = createBoundaryShiftDistractor(clonedCorrect, activeRange, signatures);
    if (!distractor) {
      distractor = createQuizDistractor(clonedCorrect, activeRange, signatures);
    }

    if (!distractor) {
      misses += 1;

      if (misses % 24 === 0) {
        activeRange = widenQuizRange(activeRange, 1);
      }

      continue;
    }

    signatures.add(getSegmentSignature(distractor));
    options.push({
      tokens: segmentsToDisplayTokens(distractor),
      isCorrect: false,
    });
    misses = 0;
  }

  if (options.length < 4) {
    const emergencyRange = {
      min: 1,
      max: Math.max(baseRange.max + 4, Math.round(getTotalTicks() / 6)),
    };

    let emergencyMisses = 0;
    while (options.length < 4 && emergencyMisses < 900) {
      let distractor = createBoundaryShiftDistractor(clonedCorrect, emergencyRange, signatures);
      if (!distractor) {
        distractor = createQuizDistractor(clonedCorrect, emergencyRange, signatures);
      }

      if (!distractor) {
        emergencyMisses += 1;
        continue;
      }

      signatures.add(getSegmentSignature(distractor));
      options.push({
        tokens: segmentsToDisplayTokens(distractor),
        isCorrect: false,
      });
      emergencyMisses = 0;
    }
  }

  if (options.length < 4) {
    return null;
  }

  const shuffled = shuffleArray(options);
  return {
    options: shuffled,
    correctIndex: shuffled.findIndex((option) => option.isCorrect),
  };
}

function createQuizDistractor(correctSegments, range, signatures) {
  const totalUnits = getTotalUnits();
  const targetState = buildTickState(correctSegments, getTotalTicks());
  const baseUnits = segmentsToUnitState(correctSegments);

  const unitTicks = getUnitTicks();
  const minReadableRunUnits = unitTicks === 3 ? 2 : 1;
  const minUnits = Math.max(1, Math.round((range.min * 6) / unitTicks));
  const maxUnits = Math.max(minUnits, Math.round((range.max * 6) / unitTicks));
  const maxAllowedUnits = Math.min(totalUnits, maxUnits);
  const smallDiffMode = range.max <= 4;
  const minChunkUnits = smallDiffMode ? 1 : Math.max(1, Math.ceil(6 / unitTicks));
  const maxChunkUnits = Math.max(minChunkUnits, minChunkUnits * 3);
  const correctRestTicks = getRestTicks(correctSegments);
  const correctNoteTicks = getNoteTicks(correctSegments);
  const correctNoteStarts = getNoteSegmentCount(correctSegments);
  const difficultyShare = range.max / Math.max(1, Math.round(getTotalTicks() / 6));
  const maxRestDeltaTicks = Math.max(
    unitTicks * 2,
    Math.round(getTotalTicks() * (difficultyShare > 0.35 || smallDiffMode ? 0.3 : 0.2))
  );
  const maxNoteTickDelta = Math.max(
    unitTicks * 2,
    Math.round(getTotalTicks() * (difficultyShare > 0.35 || smallDiffMode ? 0.3 : 0.16))
  );
  const maxSegmentDelta = Math.max(smallDiffMode ? 6 : 4, Math.ceil(totalUnits / (smallDiffMode ? 10 : 12)));
  const minSegmentCount = Math.max(1, correctSegments.length - maxSegmentDelta);
  const maxSegmentCount = correctSegments.length + maxSegmentDelta;
  const maxNoteStartDelta = Math.max(
    smallDiffMode ? 3 : 2,
    Math.ceil(correctNoteStarts * (difficultyShare > 0.35 || smallDiffMode ? 0.5 : 0.35))
  );

  for (let attempt = 0; attempt < 900; attempt += 1) {
    const flipCount = randomInt(minUnits, maxAllowedUnits);
    const units = [...baseUnits];
    const flippedUnits = flipUnitsByChunks(units, flipCount, minChunkUnits, maxChunkUnits);
    if (flippedUnits < minUnits) {
      continue;
    }

    const minRunUnits = Math.max(minReadableRunUnits, smallDiffMode ? 1 : minChunkUnits);
    smoothShortRuns(units, minRunUnits);

    if (hasRunsShorterThan(units, minReadableRunUnits)) {
      continue;
    }

    if (isUniformState(units)) {
      continue;
    }

    const candidate = unitStateToSegments(units);
    if (rhythmMode === "triplet" && !satisfiesTripletEighthConstraint(candidate)) {
      continue;
    }

    if (candidate.length < minSegmentCount || candidate.length > maxSegmentCount) {
      continue;
    }

    const restDeltaTicks = Math.abs(getRestTicks(candidate) - correctRestTicks);
    if (restDeltaTicks > maxRestDeltaTicks) {
      continue;
    }

    const noteTickDelta = Math.abs(getNoteTicks(candidate) - correctNoteTicks);
    if (noteTickDelta > maxNoteTickDelta) {
      continue;
    }

    const noteStartDelta = Math.abs(getNoteSegmentCount(candidate) - correctNoteStarts);
    if (noteStartDelta > maxNoteStartDelta) {
      continue;
    }

    const signature = getSegmentSignature(candidate);

    if (signatures.has(signature)) {
      continue;
    }

    const diffSixteenths = getDiffInSixteenths(targetState, candidate);
    if (diffSixteenths < range.min || diffSixteenths > range.max) {
      continue;
    }

    return candidate;
  }

  return null;
}

function createBoundaryShiftDistractor(correctSegments, range, signatures) {
  if (correctSegments.length < 2) {
    return null;
  }

  const targetState = buildTickState(correctSegments, getTotalTicks());
  const unitTicks = getUnitTicks();
  const minReadableTicks = Math.max(unitTicks, Math.ceil(6 / unitTicks) * unitTicks);
  const totalSixteenths = Math.max(1, Math.round(getTotalTicks() / 6));
  const difficultyShare = range.max / totalSixteenths;

  const correctRestTicks = getRestTicks(correctSegments);
  const correctNoteStarts = getNoteSegmentCount(correctSegments);
  const maxRestDeltaTicks = Math.max(
    unitTicks * 2,
    Math.round(getTotalTicks() * (difficultyShare > 0.35 ? 0.24 : 0.16))
  );
  const maxNoteStartDelta = Math.max(2, Math.ceil(correctNoteStarts * (difficultyShare > 0.35 ? 0.4 : 0.25)));
  const maxOperations = range.max <= 4 ? 2 : range.max <= 8 ? 4 : 6;

  for (let attempt = 0; attempt < 700; attempt += 1) {
    let candidate = cloneSegments(correctSegments);
    const operationCount = randomInt(1, maxOperations);
    let changed = false;

    for (let operation = 0; operation < operationCount; operation += 1) {
      const boundaries = getMutableBoundaryIndexes(candidate, minReadableTicks, unitTicks);
      if (!boundaries.length) {
        break;
      }

      const boundary = boundaries[Math.floor(Math.random() * boundaries.length)];
      if (shiftBoundary(candidate, boundary, range, minReadableTicks, unitTicks)) {
        changed = true;
      }
    }

    if (!changed) {
      continue;
    }

    candidate = recalculateSegmentTimeline(candidate);
    if (!isValidSegmentTimeline(candidate)) {
      continue;
    }

    if (rhythmMode === "triplet" && !satisfiesTripletEighthConstraint(candidate)) {
      continue;
    }

    const signature = getSegmentSignature(candidate);
    if (signatures.has(signature)) {
      continue;
    }

    const restDeltaTicks = Math.abs(getRestTicks(candidate) - correctRestTicks);
    if (restDeltaTicks > maxRestDeltaTicks) {
      continue;
    }

    const noteStartDelta = Math.abs(getNoteSegmentCount(candidate) - correctNoteStarts);
    if (noteStartDelta > maxNoteStartDelta) {
      continue;
    }

    const diffSixteenths = getDiffInSixteenths(targetState, candidate);
    if (diffSixteenths < range.min || diffSixteenths > range.max) {
      continue;
    }

    return candidate;
  }

  return null;
}

function getMutableBoundaryIndexes(segments, minReadableTicks, unitTicks) {
  const indexes = [];

  for (let index = 1; index < segments.length; index += 1) {
    const left = segments[index - 1];
    const right = segments[index];

    const leftSpare = left.durationTicks - minReadableTicks;
    const rightSpare = right.durationTicks - minReadableTicks;

    if (leftSpare >= unitTicks || rightSpare >= unitTicks) {
      indexes.push(index);
    }
  }

  return indexes;
}

function shiftBoundary(segments, boundaryIndex, range, minReadableTicks, unitTicks) {
  const left = segments[boundaryIndex - 1];
  const right = segments[boundaryIndex];

  const leftShiftCapacity = Math.floor((left.durationTicks - minReadableTicks) / unitTicks);
  const rightShiftCapacity = Math.floor((right.durationTicks - minReadableTicks) / unitTicks);

  const directions = [];
  if (rightShiftCapacity > 0) {
    directions.push(1);
  }

  if (leftShiftCapacity > 0) {
    directions.push(-1);
  }

  if (!directions.length) {
    return false;
  }

  const direction = directions[Math.floor(Math.random() * directions.length)];
  const maxShiftUnits = direction > 0 ? rightShiftCapacity : leftShiftCapacity;
  const unitLimit = range.max <= 4
    ? Math.max(1, Math.ceil(6 / unitTicks))
    : Math.max(2, Math.ceil(range.max / 2));
  const shiftUnits = randomInt(1, Math.min(maxShiftUnits, unitLimit));
  const shiftTicks = shiftUnits * unitTicks;

  if (direction > 0) {
    left.durationTicks += shiftTicks;
    right.durationTicks -= shiftTicks;
  } else {
    left.durationTicks -= shiftTicks;
    right.durationTicks += shiftTicks;
  }

  return true;
}

function recalculateSegmentTimeline(segments) {
  let cursor = 0;

  return segments.map((segment) => {
    const updated = {
      startTick: cursor,
      durationTicks: segment.durationTicks,
      isRest: segment.isRest,
    };

    cursor += segment.durationTicks;
    return updated;
  });
}

function isValidSegmentTimeline(segments) {
  if (!segments.length) {
    return false;
  }

  let cursor = 0;
  for (const segment of segments) {
    if (segment.durationTicks <= 0 || segment.startTick !== cursor) {
      return false;
    }

    cursor += segment.durationTicks;
  }

  return cursor === getTotalTicks();
}

function widenQuizRange(range, step) {
  const totalSixteenths = Math.max(1, Math.round(getTotalTicks() / 6));
  return {
    min: Math.max(1, range.min - step),
    max: Math.min(totalSixteenths, range.max + step),
  };
}

function flipUnitsByChunks(units, budget, minChunkUnits, maxChunkUnits) {
  let flipped = 0;
  let guard = 0;

  while (flipped < budget && guard < 420) {
    guard += 1;
    const remaining = budget - flipped;
    const upper = Math.max(minChunkUnits, Math.min(maxChunkUnits, remaining));
    const chunkSize = randomInt(minChunkUnits, upper);

    if (chunkSize <= 0 || chunkSize > units.length) {
      break;
    }

    const maxStart = units.length - chunkSize;
    if (maxStart < 0) {
      break;
    }

    const start = randomInt(0, maxStart);
    for (let index = start; index < start + chunkSize; index += 1) {
      units[index] = units[index] ? 0 : 1;
    }

    flipped += chunkSize;
  }

  return flipped;
}

function smoothShortRuns(units, minRunUnits) {
  if (minRunUnits <= 1 || units.length === 0) {
    return;
  }

  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false;
    const runs = getUnitRuns(units);

    runs.forEach((run, index) => {
      if (run.length >= minRunUnits) {
        return;
      }

      const left = runs[index - 1];
      const right = runs[index + 1];
      let fillValue = run.value;

      if (left && right && left.value === right.value) {
        fillValue = left.value;
      } else if (left && right) {
        fillValue = left.length >= right.length ? left.value : right.value;
      } else if (left) {
        fillValue = left.value;
      } else if (right) {
        fillValue = right.value;
      }

      if (fillValue === run.value) {
        return;
      }

      for (let unit = run.start; unit < run.end; unit += 1) {
        units[unit] = fillValue;
      }

      changed = true;
    });

    if (!changed) {
      break;
    }
  }
}

function getUnitRuns(units) {
  if (!units.length) {
    return [];
  }

  const runs = [];
  let start = 0;
  let value = units[0];

  for (let index = 1; index <= units.length; index += 1) {
    if (index < units.length && units[index] === value) {
      continue;
    }

    runs.push({
      start,
      end: index,
      length: index - start,
      value,
    });

    start = index;
    value = units[index];
  }

  return runs;
}

function hasRunsShorterThan(units, minRunUnits) {
  if (minRunUnits <= 1) {
    return false;
  }

  return getUnitRuns(units).some((run) => run.length < minRunUnits);
}

function isUniformState(units) {
  if (!units.length) {
    return true;
  }

  const first = units[0];
  return units.every((value) => value === first);
}

function getRestTicks(segments) {
  return segments.reduce((sum, segment) => sum + (segment.isRest ? segment.durationTicks : 0), 0);
}

function satisfiesTripletEighthConstraint(segments) {
  const split = splitSegmentsAtBarBoundaries(segments);
  return split.every((segment) => {
    return segment.durationTicks === 8 || segment.durationTicks % 24 === 0;
  });
}

function splitSegmentsAtBarBoundaries(segments) {
  const split = [];

  segments.forEach((segment) => {
    let localStart = segment.startTick;
    let remaining = segment.durationTicks;

    while (remaining > 0) {
      const barEnd = Math.floor(localStart / TICKS_PER_BAR) * TICKS_PER_BAR + TICKS_PER_BAR;
      const chunkDuration = Math.min(remaining, barEnd - localStart);

      split.push({
        startTick: localStart,
        durationTicks: chunkDuration,
        isRest: segment.isRest,
      });

      localStart += chunkDuration;
      remaining -= chunkDuration;
    }
  });

  return split;
}

function getNoteTicks(segments) {
  return segments.reduce((sum, segment) => sum + (segment.isRest ? 0 : segment.durationTicks), 0);
}

function getNoteSegmentCount(segments) {
  return segments.reduce((sum, segment) => sum + (segment.isRest ? 0 : 1), 0);
}

function getQuizDifficultyRange(difficulty) {
  const totalSixteenths = Math.max(1, Math.round(getTotalTicks() / 6));

  if (difficulty === "easy") {
    const halfTotal = Math.max(1, Math.round(totalSixteenths / 2));
    return {
      min: halfTotal,
      max: halfTotal,
    };
  }

  if (difficulty === "hard") {
    return {
      min: 1,
      max: Math.min(4, totalSixteenths),
    };
  }

  const min = Math.min(6, totalSixteenths);
  const max = Math.min(8, totalSixteenths);
  return {
    min,
    max: Math.max(min, max),
  };
}

function getDiffInSixteenths(targetState, candidateSegments) {
  const candidateState = buildTickState(candidateSegments, getTotalTicks());
  let diffTicks = 0;

  for (let tick = 0; tick < targetState.length; tick += 1) {
    if (targetState[tick] !== candidateState[tick]) {
      diffTicks += 1;
    }
  }

  if (diffTicks === 0) {
    return 0;
  }

  return Math.max(1, Math.round(diffTicks / 6));
}

function segmentsToUnitState(segments) {
  const units = Array.from({ length: getTotalUnits() }, () => 0);
  const unitTicks = getUnitTicks();

  segments.forEach((segment) => {
    const startUnit = Math.floor(segment.startTick / unitTicks);
    const endUnit = Math.min(units.length, Math.floor((segment.startTick + segment.durationTicks) / unitTicks));

    for (let unit = startUnit; unit < endUnit; unit += 1) {
      units[unit] = segment.isRest ? 0 : 1;
    }
  });

  return units;
}

function unitStateToSegments(units) {
  if (!units.length) {
    return [];
  }

  const segments = [];
  const unitTicks = getUnitTicks();

  let start = 0;
  let value = units[0];

  for (let index = 1; index <= units.length; index += 1) {
    if (index < units.length && units[index] === value) {
      continue;
    }

    segments.push({
      startTick: start * unitTicks,
      durationTicks: (index - start) * unitTicks,
      isRest: value === 0,
    });

    start = index;
    value = units[index];
  }

  return segments;
}

function pickRandomIndexes(total, count) {
  const picks = new Set();
  const desired = Math.max(1, Math.min(total, count));

  while (picks.size < desired) {
    picks.add(Math.floor(Math.random() * total));
  }

  return [...picks];
}

function randomInt(min, max) {
  const low = Math.ceil(Math.min(min, max));
  const high = Math.floor(Math.max(min, max));
  return low + Math.floor(Math.random() * (high - low + 1));
}

function getSegmentSignature(segments) {
  return segments
    .map((segment) => `${segment.isRest ? "R" : "N"}${segment.durationTicks}`)
    .join("|");
}

function cloneSegments(segments) {
  return segments.map((segment) => ({ ...segment }));
}

function shuffleArray(values) {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[pick]] = [shuffled[pick], shuffled[index]];
  }

  return shuffled;
}

function formatQuizDifficulty(value) {
  if (value === "easy") {
    return "Easy";
  }

  if (value === "hard") {
    return "Hard";
  }

  return "Medium";
}

function setQuizStatus(message, tone) {
  if (!elements.quizStatus) {
    return;
  }

  elements.quizStatus.textContent = message;
  elements.quizStatus.dataset.tone = tone;
}

function getGenerationDurations() {
  const density = elements.densitySelect.value;

  if (rhythmMode === "triplet") {
    if (density === "simple") {
      return [8, 24, 48, 72];
    }

    if (density === "busy") {
      return [8, 24];
    }

    return [8, 24, 48];
  }

  if (rhythmMode === "swing8") {
    if (density === "simple") {
      return [12, 18, 24, 36, 48, 72];
    }

    if (density === "busy") {
      return [6, 12, 18, 24, 36];
    }

    return [6, 12, 18, 24, 36, 48];
  }

  if (density === "simple") {
    return [12, 18, 24, 36, 48, 72];
  }

  if (density === "busy") {
    return [6, 12, 18, 24, 36];
  }

  return [6, 12, 18, 24, 36, 48];
}

function generateSegmentsFromPreset(preset) {
  const segments = [];
  const totalTicks = getTotalTicks();
  const durations = getGenerationDurations();

  let cursorTick = 0;
  while (cursorTick < totalTicks) {
    const remaining = totalTicks - cursorTick;
    let allowed = durations.filter((duration) => duration <= remaining);
    if (allowed.length === 0) {
      allowed = [remaining];
    }

    const durationTicks = pickWeightedDuration(allowed);
    const onBarStart = cursorTick % TICKS_PER_BAR === 0;
    const onStrongBeat = cursorTick % TICKS_PER_BEAT === 0;

    const forceNote = onBarStart || (onStrongBeat && Math.random() < 0.58);
    const makeRest = !forceNote && Math.random() < preset.restChance;

    segments.push({
      startTick: cursorTick,
      durationTicks,
      isRest: makeRest,
    });

    cursorTick += durationTicks;
  }

  return segments;
}

function pickWeightedDuration(durations) {
  // Bias toward shorter durations while still allowing long values.
  const weights = durations.map((duration) => Math.max(1, 80 / duration));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);

  let roll = Math.random() * totalWeight;
  for (let index = 0; index < durations.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) {
      return durations[index];
    }
  }

  return durations[durations.length - 1];
}

function tokensToCanonicalSegments(tokens) {
  const canonical = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const segment = {
      startTick: token.startTick,
      durationTicks: token.durationTicks,
      isRest: token.isRest,
    };

    const previousCanonical = canonical[canonical.length - 1];
    const previousToken = tokens[index - 1];

    if (
      segment.isRest
      && previousCanonical
      && previousCanonical.isRest
      && previousCanonical.startTick + previousCanonical.durationTicks === segment.startTick
    ) {
      previousCanonical.durationTicks += segment.durationTicks;
      continue;
    }

    if (
      !segment.isRest
      && previousCanonical
      && !previousCanonical.isRest
      && previousToken
      && !previousToken.isRest
      && previousToken.tieToNext
      && previousCanonical.startTick + previousCanonical.durationTicks === segment.startTick
    ) {
      previousCanonical.durationTicks += segment.durationTicks;
      continue;
    }

    canonical.push(segment);
  }

  return canonical;
}

function canonicalizeSegments(segments) {
  const sorted = [...segments].sort((left, right) => left.startTick - right.startTick);
  const canonical = [];

  sorted.forEach((segment) => {
    const previous = canonical[canonical.length - 1];

    if (
      segment.isRest
      && previous
      && previous.isRest
      && previous.startTick + previous.durationTicks === segment.startTick
    ) {
      previous.durationTicks += segment.durationTicks;
      return;
    }

    canonical.push({ ...segment });
  });

  return canonical;
}

function segmentsToDisplayTokens(segments) {
  const tokens = [];

  segments.forEach((segment) => {
    let localStart = segment.startTick;
    let remaining = segment.durationTicks;

    while (remaining > 0) {
      const barBoundary = Math.floor(localStart / TICKS_PER_BAR) * TICKS_PER_BAR + TICKS_PER_BAR;
      const chunkDuration = Math.min(remaining, barBoundary - localStart);
      const tieToNext = !segment.isRest && chunkDuration < remaining;

      tokens.push({
        startTick: localStart,
        durationTicks: chunkDuration,
        isRest: segment.isRest,
        tieToNext,
        label: formatValueLabel(chunkDuration, false),
      });

      localStart += chunkDuration;
      remaining -= chunkDuration;
    }
  });

  return tokens;
}

function segmentsToOnsetPattern(segments) {
  const pattern = createEmptyPattern();

  segments.forEach((segment) => {
    if (!segment.isRest && pattern[segment.startTick] !== undefined) {
      pattern[segment.startTick] = true;
    }
  });

  return pattern;
}

function formatValueLabel(durationTicks, dottedHint) {
  const known = getKnownValueLabels();
  if (known.has(durationTicks)) {
    return dottedHint && !known.get(durationTicks).endsWith(".")
      ? `${known.get(durationTicks)}.`
      : known.get(durationTicks);
  }

  return simplifyAsFraction(durationTicks, TICKS_PER_WHOLE);
}

function getKnownValueLabels() {
  const map = new Map();

  getBaseValueOptions().forEach((value) => {
    map.set(value.ticks, value.label);

    if (value.ticks % 2 === 0) {
      const dotted = (value.ticks * 3) / 2;
      if (Number.isInteger(dotted) && dotted % getUnitTicks() === 0) {
        map.set(dotted, `${value.label}.`);
      }
    }
  });

  return map;
}

function simplifyAsFraction(numerator, denominator) {
  const divisor = gcd(numerator, denominator);
  const reducedNumerator = numerator / divisor;
  const reducedDenominator = denominator / divisor;

  if (reducedNumerator === reducedDenominator) {
    return "1";
  }

  return `${reducedNumerator}/${reducedDenominator}`;
}

function gcd(a, b) {
  let left = Math.abs(a);
  let right = Math.abs(b);

  while (right !== 0) {
    const next = left % right;
    left = right;
    right = next;
  }

  return left || 1;
}

async function playPattern(pattern, source) {
  if (!hasRhythm && source !== "quiz") {
    setStatus("Generate a rhythm before playback.", "warning");
    return;
  }

  if (pattern.length !== getTotalTicks()) {
    setStatus("Exercise settings changed. Generate a new rhythm.", "warning");
    return;
  }

  if (!pattern.some(Boolean)) {
    const message = source === "attempt"
      ? "Your notation has no note onsets yet."
      : source === "quiz"
        ? "Quiz rhythm is empty. Generate another round."
        : "Generated rhythm is empty. Generate again.";
    setStatus(message, "warning");
    return;
  }

  if (isPlaying) {
    stopPlayback(false);
  }

  await ensureAudioReady();

  isPlaying = true;
  playbackTick = 0;
  currentPlaybackPattern = pattern;
  currentPlaybackOnsetDurations = buildOnsetDurationMap(pattern);
  playbackSource = source;
  lastCursorUnit = -1;
  setControlsLocked(true);

  const playbackLabel = source === "target"
    ? "Playing generated rhythm."
    : source === "attempt"
      ? "Playing your notation."
      : "Playing quiz rhythm.";
  setStatus(playbackLabel, "neutral");

  const runTick = () => {
    if (!isPlaying) {
      return;
    }

    if (playbackTick >= getTotalTicks()) {
      stopPlayback(false);
      setStatus("Playback complete.", "neutral");
      return;
    }

    const unitIndex = Math.floor(playbackTick / getUnitTicks());
    if (unitIndex !== lastCursorUnit) {
      paintCursor(unitIndex);
      lastCursorUnit = unitIndex;
    }

    if (metronomeEnabled && playbackTick % TICKS_PER_BEAT === 0) {
      triggerMetronomeClick(playbackTick);
    }

    if (currentPlaybackPattern[playbackTick]) {
      const tickMs = getTickDurationMs(playbackTick);
      const onsetDurationMs = currentPlaybackOnsetDurations?.get(playbackTick);
      triggerRhythmHit(onsetDurationMs || Math.max(75, tickMs * 2));
    }

    const waitMs = getTickDurationMs(playbackTick);
    playbackTick += 1;
    playbackTimer = window.setTimeout(runTick, waitMs);
  };

  runTick();
}

function getTickDurationMs(tickIndex) {
  const bpm = Number(elements.tempoInput.value);
  const quarterMs = 60_000 / bpm;

  if (getModeConfig().timing !== "swing8") {
    return quarterMs / TICKS_PER_BEAT;
  }

  const inBeat = tickIndex % TICKS_PER_BEAT;
  if (inBeat < 12) {
    return quarterMs / 18;
  }

  return quarterMs / 36;
}

function stopPlayback(userStopped) {
  if (playbackTimer) {
    window.clearTimeout(playbackTimer);
    playbackTimer = null;
  }

  isPlaying = false;
  playbackTick = 0;
  currentPlaybackPattern = null;
  currentPlaybackOnsetDurations = null;
  playbackSource = null;
  lastCursorUnit = -1;
  clearCursor();
  setControlsLocked(false);

  if (userStopped) {
    setStatus("Playback stopped.", "neutral");
  }
}

function setControlsLocked(isLocked) {
  const lockingQuizPlayback = isLocked && playbackSource === "quiz";

  elements.generateBtn.disabled = isLocked;
  elements.playTargetBtn.disabled = isLocked;
  elements.playAttemptBtn.disabled = isLocked;
  elements.generateQuizBtn.disabled = isLocked;
  elements.playQuizBtn.disabled = lockingQuizPlayback ? !hasQuizRound : isLocked || !hasQuizRound;
  if (elements.quizReplayBtn) {
    elements.quizReplayBtn.disabled = !hasQuizRound || quizSelectedIndex < 0 || isLocked;
  }
  if (elements.quizNextRoundBtn) {
    elements.quizNextRoundBtn.disabled = isLocked;
  }
  elements.stopBtn.disabled = !isLocked;
  elements.clearBtn.disabled = isLocked;
  elements.checkBtn.disabled = isLocked;
  elements.revealBtn.disabled = isLocked;
  elements.barsSelect.disabled = isLocked;
  elements.rhythmModeSelect.disabled = isLocked;
  elements.densitySelect.disabled = isLocked;
  elements.quizDifficultySelect.disabled = isLocked;
  elements.tempoInput.disabled = isLocked;
  if (elements.metronomeToggle) {
    elements.metronomeToggle.disabled = isLocked;
  }
  elements.notationStyleSelect.disabled = isLocked;

  elements.userGrid.classList.toggle("locked", isLocked);
  elements.quizOptions.classList.toggle("locked", isLocked);
  updateEntryUI();
  syncQuizOptionsLockState();

  if (isLocked && staffPromptOpen) {
    closeStaffPrompt();
  }
}

function syncQuizOptionsLockState() {
  const disableOptions = isPlaying || quizSelectedIndex >= 0;
  const options = elements.quizOptions.querySelectorAll(".quiz-option");

  options.forEach((option) => {
    option.disabled = disableOptions;
    option.setAttribute("aria-disabled", String(disableOptions));
  });
}

function paintCursor(unit) {
  clearCursor();

  if (targetCells[unit]) {
    targetCells[unit].classList.add("cursor");
  }

  if (userCells[unit]) {
    userCells[unit].classList.add("cursor");
  }
}

function clearCursor() {
  targetCells.forEach((cell) => cell.classList.remove("cursor"));
  userCells.forEach((cell) => cell.classList.remove("cursor"));
}

async function ensureAudioReady() {
  if (!audioContext) {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextConstructor();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.42;
    masterGain.connect(audioContext.destination);
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
}

function triggerRhythmHit(durationMs) {
  const midiOutput = getSelectedMidiOutput();
  if (midiOutput) {
    sendMidiNote(midiOutput, 9, 38, 108, durationMs);
  } else if (selectedMidiOutputId === INTERNAL_OUTPUT_IDS.bass) {
    playBassSynth(durationMs);
  } else {
    playFallbackDrum(durationMs);
  }

  flashBeat();
}

function flashBeat() {
  document.body.classList.add("beat-hit");
  if (beatFlashTimer) {
    window.clearTimeout(beatFlashTimer);
  }

  beatFlashTimer = window.setTimeout(() => {
    document.body.classList.remove("beat-hit");
  }, 70);
}

function triggerMetronomeClick(playbackTickValue) {
  const isBarStart = playbackTickValue % TICKS_PER_BAR === 0;
  playMetronomeClick(isBarStart);
}

function playMetronomeClick(isBarStart) {
  if (!audioContext || !masterGain) {
    return;
  }

  const now = audioContext.currentTime;
  const clickDuration = isBarStart ? 0.09 : 0.07;

  const oscillator = audioContext.createOscillator();
  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(isBarStart ? 1760 : 1320, now);

  const highpass = audioContext.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 920;

  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(isBarStart ? 0.11 : 0.08, now + 0.003);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + clickDuration);

  oscillator.connect(highpass);
  highpass.connect(gainNode);
  gainNode.connect(masterGain);

  oscillator.start(now);
  oscillator.stop(now + clickDuration + 0.01);
}

function playFallbackDrum(durationMs) {
  if (!audioContext || !masterGain) {
    return;
  }

  const now = audioContext.currentTime;
  const hitDuration = Math.min(0.22, Math.max(0.07, durationMs / 1000));

  const oscillator = audioContext.createOscillator();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(220, now);
  oscillator.frequency.exponentialRampToValueAtTime(95, now + hitDuration * 0.8);

  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.46, now + 0.008);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + hitDuration);

  oscillator.connect(gainNode);
  gainNode.connect(masterGain);

  oscillator.start(now);
  oscillator.stop(now + hitDuration + 0.02);
}

function playBassSynth(durationMs) {
  if (!audioContext || !masterGain) {
    return;
  }

  const now = audioContext.currentTime;
  const sustainTime = Math.min(2.8, Math.max(0.16, (durationMs / 1000) * 0.95));
  const releaseTime = Math.min(0.55, Math.max(0.18, sustainTime * 0.3));
  const stopTime = now + sustainTime + releaseTime;
  const c2 = 65.4064;

  const carrier = audioContext.createOscillator();
  carrier.type = "sawtooth";
  carrier.frequency.setValueAtTime(c2, now);

  const overtone = audioContext.createOscillator();
  overtone.type = "square";
  overtone.frequency.setValueAtTime(c2 * 2, now);

  const overtoneGain = audioContext.createGain();
  overtoneGain.gain.value = 0.16;

  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(280, now);
  filter.frequency.exponentialRampToValueAtTime(120, now + sustainTime);

  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.23, now + 0.024);
  gainNode.gain.linearRampToValueAtTime(0.14, now + sustainTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime);

  carrier.connect(filter);
  overtone.connect(overtoneGain);
  overtoneGain.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(masterGain);

  carrier.start(now);
  overtone.start(now);
  carrier.stop(stopTime + 0.03);
  overtone.stop(stopTime + 0.03);
}

function getSelectedMidiOutput() {
  if (!midiAccess || !selectedMidiOutputId) {
    return null;
  }

  if (selectedMidiOutputId === INTERNAL_OUTPUT_IDS.drum || selectedMidiOutputId === INTERNAL_OUTPUT_IDS.bass) {
    return null;
  }

  return midiAccess.outputs.get(selectedMidiOutputId) || null;
}

function sendMidiNote(output, channel, note, velocity, durationMs) {
  const noteOn = 0x90 + channel;
  const noteOff = 0x80 + channel;
  const now = performance.now();

  output.send([noteOn, note, velocity], now);
  output.send([noteOff, note, 0], now + Math.max(70, Math.min(durationMs, 2400)));
}

async function enableMidi() {
  if (!navigator.requestMIDIAccess) {
    setStatus("Web MIDI is not available in this browser, using internal synth.", "warning");
    return;
  }

  try {
    midiAccess = await navigator.requestMIDIAccess();
    midiAccess.onstatechange = refreshMidiOutputs;
    refreshMidiOutputs();
    setStatus("MIDI enabled. Select an output or keep the synth fallback.", "neutral");
  } catch (error) {
    setStatus("Could not access MIDI outputs, using internal synth.", "warning");
  }
}

function refreshMidiOutputs() {
  const previous = selectedMidiOutputId;
  const outputOptions = [];

  if (midiAccess) {
    for (const output of midiAccess.outputs.values()) {
      outputOptions.push(output);
    }
  }

  elements.midiOutputSelect.innerHTML = "";

  const bass = document.createElement("option");
  bass.value = INTERNAL_OUTPUT_IDS.bass;
  bass.textContent = "Internal bass synth (C2)";
  elements.midiOutputSelect.appendChild(bass);

  const drum = document.createElement("option");
  drum.value = INTERNAL_OUTPUT_IDS.drum;
  drum.textContent = "Internal drum synth (fallback)";
  elements.midiOutputSelect.appendChild(drum);

  outputOptions.forEach((output, index) => {
    const option = document.createElement("option");
    option.value = output.id;
    option.textContent = output.name || `MIDI Output ${index + 1}`;
    elements.midiOutputSelect.appendChild(option);
  });

  const previousIsInternal = previous === INTERNAL_OUTPUT_IDS.drum || previous === INTERNAL_OUTPUT_IDS.bass;
  const previousIsMidi = outputOptions.some((output) => output.id === previous);
  selectedMidiOutputId = previousIsInternal || previousIsMidi ? previous : INTERNAL_OUTPUT_IDS.bass;
  elements.midiOutputSelect.value = selectedMidiOutputId;
}

function buildOnsetDurationMap(pattern) {
  const durations = new Map();

  if (!pattern.length) {
    return durations;
  }

  const prefixMs = [0];
  for (let tick = 0; tick < pattern.length; tick += 1) {
    prefixMs.push(prefixMs[tick] + getTickDurationMs(tick));
  }

  const onsets = [];
  for (let tick = 0; tick < pattern.length; tick += 1) {
    if (pattern[tick]) {
      onsets.push(tick);
    }
  }

  for (let index = 0; index < onsets.length; index += 1) {
    const start = onsets[index];
    const end = index < onsets.length - 1 ? onsets[index + 1] : pattern.length;
    const durationMs = Math.max(80, (prefixMs[end] - prefixMs[start]) * 0.94);
    durations.set(start, durationMs);
  }

  return durations;
}

function checkAnswer() {
  if (!hasRhythm) {
    setStatus("Generate a rhythm first.", "warning");
    return;
  }

  if (userCursorTick !== getTotalTicks()) {
    setStatus("Complete the whole bar range before checking.", "warning");
    return;
  }

  const result = evaluateAnswer(targetSegments, userSegments);
  applyUserFeedback(result);

  setStats(`${result.accuracy}%`, `${result.correctSegments}/${result.targetSegments}`, "Correct Segments");

  if (result.exactMatch) {
    setStatus("Perfect. Rhythm values, dots, rests, and ligatures match.", "success");
  } else {
    setStatus(
      `Not exact yet: ${result.missingStarts.length} missing and ${result.extraStarts.length} extra segments.`,
      "warning"
    );
  }
}

function evaluateAnswer(targetInput, userInput) {
  const target = canonicalizeSegments(targetInput);
  const attempt = canonicalizeSegments(userInput);

  const maxLength = Math.max(target.length, attempt.length);
  const missingStarts = [];
  const extraStarts = [];
  const correctStarts = [];
  let correctSegments = 0;

  for (let index = 0; index < maxLength; index += 1) {
    const targetSegment = target[index];
    const userSegment = attempt[index];

    if (targetSegment && userSegment && sameSegment(targetSegment, userSegment)) {
      correctSegments += 1;
      correctStarts.push(userSegment.startTick);
      continue;
    }

    if (targetSegment) {
      missingStarts.push(targetSegment.startTick);
    }

    if (userSegment) {
      extraStarts.push(userSegment.startTick);
    }
  }

  const targetState = buildTickState(target, getTotalTicks());
  const attemptState = buildTickState(attempt, getTotalTicks());
  let equalTicks = 0;

  for (let tick = 0; tick < targetState.length; tick += 1) {
    if (targetState[tick] === attemptState[tick]) {
      equalTicks += 1;
    }
  }

  const stateAccuracy = targetState.length === 0 ? 100 : Math.round((equalTicks / targetState.length) * 100);
  const exactMatch = target.length === attempt.length && correctSegments === target.length;

  return {
    accuracy: stateAccuracy,
    exactMatch,
    correctSegments,
    targetSegments: target.length,
    missingStarts,
    extraStarts,
    correctStarts,
  };
}

function sameSegment(left, right) {
  return left.isRest === right.isRest && left.durationTicks === right.durationTicks;
}

function buildTickState(segments, totalTicks) {
  const state = Array.from({ length: totalTicks }, () => 0);

  segments.forEach((segment) => {
    for (let tick = segment.startTick; tick < segment.startTick + segment.durationTicks; tick += 1) {
      if (tick >= totalTicks) {
        break;
      }

      state[tick] = segment.isRest ? 0 : 1;
    }
  });

  return state;
}

function applyUserFeedback(result) {
  clearUserHints();

  result.correctStarts.forEach((startTick) => {
    const unit = Math.floor(startTick / getUnitTicks());
    if (userCells[unit]) {
      userCells[unit].classList.add("correct");
    }
  });

  result.extraStarts.forEach((startTick) => {
    const unit = Math.floor(startTick / getUnitTicks());
    if (userCells[unit]) {
      userCells[unit].classList.add("extra");
    }
  });

  result.missingStarts.forEach((startTick) => {
    const unit = Math.floor(startTick / getUnitTicks());
    if (userCells[unit]) {
      userCells[unit].classList.add("missed");
    }
  });
}

function clearUserHints() {
  userCells.forEach((cell) => {
    cell.classList.remove("correct", "missed", "extra");
  });
}

function toggleRevealAnswer() {
  if (!hasRhythm || isPlaying) {
    return;
  }

  revealAnswer = !revealAnswer;
  elements.revealBtn.textContent = revealAnswer ? "Hide Answer" : "Reveal Answer";
  renderTargetGrid();
  renderStaffPanels();
}

function updateTempoLabel() {
  elements.tempoValue.textContent = `${elements.tempoInput.value} BPM`;
}

function setStatus(message, tone) {
  elements.statusText.textContent = message;
  elements.feedbackCard.dataset.tone = tone;
}

function setStats(accuracy, detail, metricLabel) {
  elements.accuracyStat.textContent = `Accuracy: ${accuracy}`;
  elements.hintStat.textContent = `${metricLabel}: ${detail}`;
}

function renderAll() {
  renderTargetGrid();
  renderUserGrid();
  renderStaffPanels();
  syncTabPanelMinHeight();
}

function renderTargetGrid() {
  elements.targetGrid.classList.toggle("revealed", revealAnswer);
  clearGridVisuals(targetCells);

  if (revealAnswer) {
    paintTokensOnGrid(targetCells, targetTokens);
  }
}

function renderUserGrid() {
  clearGridVisuals(userCells);
  paintTokensOnGrid(userCells, userTokens);
}

function clearGridVisuals(cells) {
  cells.forEach((cell) => {
    cell.classList.remove("note-start", "note-span", "rest-start", "rest-span", "tie-out", "active");

    const label = cell.querySelector(".token-label");
    if (label) {
      label.textContent = "";
    }
  });
}

function paintTokensOnGrid(cells, tokens) {
  tokens.forEach((token) => {
    if (token.startTick % getUnitTicks() !== 0 || token.durationTicks % getUnitTicks() !== 0) {
      return;
    }

    const startUnit = token.startTick / getUnitTicks();
    const spanUnits = token.durationTicks / getUnitTicks();

    const startCell = cells[startUnit];
    if (!startCell) {
      return;
    }

    if (token.isRest) {
      startCell.classList.add("rest-start");
    } else {
      startCell.classList.add("note-start", "active");
    }

    if (!token.isRest && token.tieToNext) {
      startCell.classList.add("tie-out");
    }

    const label = startCell.querySelector(".token-label");
    if (label) {
      label.textContent = token.isRest ? `R ${token.label}` : token.label;
    }

    for (let offset = 1; offset < spanUnits; offset += 1) {
      const cell = cells[startUnit + offset];
      if (!cell) {
        break;
      }

      cell.classList.add(token.isRest ? "rest-span" : "note-span");
    }
  });
}

function queueStaffRender() {
  if (staffRenderQueued) {
    return;
  }

  staffRenderQueued = true;
  window.requestAnimationFrame(() => {
    staffRenderQueued = false;
    renderStaffPanels();
    renderQuizOptions();
  });
}

function renderStaffPanels() {
  renderStaffPanel(elements.targetStaff, revealAnswer ? targetTokens : []);
  renderStaffPanel(elements.userStaff, userTokens);
}

function renderStaffPanel(container, tokens) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  const splitTokens = splitTokensAtBarBoundaries(tokens);
  const viewportWidth = Math.max(420, Math.floor(container.clientWidth || 760));
  const renderWidth = Math.max(520, Math.floor(viewportWidth * STAFF_RENDER_WIDTH_SCALE));
  const barsPerRow = Math.max(1, Math.min(4, bars));
  const rowCount = Math.max(1, Math.ceil(bars / barsPerRow));
  const rowHeight = 136;
  const height = Math.max(132, rowCount * rowHeight);

  const mount = document.createElement("div");
  mount.className = "staff-svg";
  mount.style.width = `${viewportWidth}px`;
  mount.style.height = `${height}px`;
  container.appendChild(mount);

  const renderer = new Renderer(mount, Renderer.Backends.SVG);
  renderer.resize(renderWidth, height);
  const context = renderer.getContext();
  context.setBackgroundFillStyle("#ffffff");
  context.clear();

  for (let row = 0; row < rowCount; row += 1) {
    const firstBar = row * barsPerRow;
    const rowBars = Math.min(barsPerRow, bars - firstBar);
    const rowPadding = 10;
    const rowTop = 16 + row * rowHeight;
    const availableWidth = renderWidth - rowPadding * 2;
    const barWidth = Math.max(160, Math.floor(availableWidth / rowBars));

    for (let rowBar = 0; rowBar < rowBars; rowBar += 1) {
      const barIndex = firstBar + rowBar;
      const x = rowPadding + rowBar * barWidth;
      const staveWidth = Math.max(140, barWidth - 8);
      const stave = new Stave(x, rowTop, staveWidth);

      if (barIndex === 0) {
        stave.addClef("percussion");
        stave.addTimeSignature("4/4");
      }

      stave.setContext(context).draw();

      const barTokens = splitTokens
        .filter((token) => Math.floor(token.startTick / TICKS_PER_BAR) === barIndex)
        .sort((left, right) => left.startTick - right.startTick);

      const barData = buildVexBarData(barTokens);
      if (barData.notes.length === 0) {
        continue;
      }

      const voice = new Voice({ num_beats: 4, beat_value: 4 }).setMode(Voice.Mode.SOFT);
      voice.addTickables(barData.notes);

      const formatter = new Formatter();
      const reserved = barIndex === 0 ? 100 : 30;
      formatter.joinVoices([voice]).format([voice], Math.max(62, staveWidth - reserved));

      const beams = buildVexBeams(barData.notes, barData.noteMeta);

      voice.draw(context, stave);
      beams.forEach((beam) => beam.setContext(context).draw());
      barData.tuplets.forEach((tuplet) => tuplet.setContext(context).draw());

      barData.ties.forEach((pair) => {
        if (!pair.first || !pair.last) {
          return;
        }

        const tie = new StaveTie({
          firstNote: pair.first,
          lastNote: pair.last,
          firstIndexes: [0],
          lastIndexes: [0],
        });

        tie.setContext(context).draw();
      });
    }
  }
}

function splitTokensAtBarBoundaries(tokens) {
  const split = [];

  tokens.forEach((token) => {
    let localStart = token.startTick;
    let remaining = token.durationTicks;

    while (remaining > 0) {
      const barEnd = Math.floor(localStart / TICKS_PER_BAR) * TICKS_PER_BAR + TICKS_PER_BAR;
      const chunkDuration = Math.min(remaining, barEnd - localStart);
      const continues = remaining > chunkDuration;

      split.push({
        ...token,
        startTick: localStart,
        durationTicks: chunkDuration,
        tieToNext: !token.isRest && (continues || (!continues && token.tieToNext)),
      });

      localStart += chunkDuration;
      remaining -= chunkDuration;
    }
  });

  return split;
}

function buildVexBarData(tokens) {
  const notes = [];
  const noteMeta = [];
  const tiePairs = [];

  let pendingTieIndex = -1;

  tokens.forEach((token) => {
    const chunks = expandTokenToVexChunks(token);

    chunks.forEach((chunk, chunkIndex) => {
      const note = createVexNote(chunk);
      notes.push(note);
      noteMeta.push({
        isRest: chunk.isRest,
        triplet: chunk.triplet,
        duration: chunk.duration,
        dots: chunk.dots,
      });

      const noteIndex = notes.length - 1;
      if (pendingTieIndex >= 0 && !chunk.isRest) {
        tiePairs.push({ first: notes[pendingTieIndex], last: notes[noteIndex] });
      }

      if (chunk.isRest) {
        pendingTieIndex = -1;
        return;
      }

      if (chunkIndex < chunks.length - 1 || token.tieToNext) {
        pendingTieIndex = noteIndex;
      } else {
        pendingTieIndex = -1;
      }
    });
  });

  const tuplets = buildTripletTuplets(notes, noteMeta);

  return {
    notes,
    noteMeta,
    ties: tiePairs,
    tuplets,
  };
}

function buildTripletTuplets(notes, noteMeta) {
  const tuplets = [];
  let index = 0;

  while (index < notes.length) {
    if (!noteMeta[index]?.triplet || noteMeta[index]?.isRest) {
      index += 1;
      continue;
    }

    const runStart = index;
    const runKey = getTupletValueKey(noteMeta[index]);

    while (
      index < notes.length
      && noteMeta[index]?.triplet
      && !noteMeta[index]?.isRest
      && getTupletValueKey(noteMeta[index]) === runKey
    ) {
      index += 1;
    }

    const run = notes.slice(runStart, index);
    let offset = 0;

    // Only annotate complete triplet groups to avoid stray 1/2 labels.
    while (offset + 3 <= run.length) {
      const group = run.slice(offset, offset + 3);
      const tuplet = createTripletTuplet(group);

      if (tuplet) {
        tuplets.push(tuplet);
      }

      offset += 3;
    }
  }

  return tuplets;
}

function getTupletValueKey(meta) {
  if (!meta) {
    return "";
  }

  return `${meta.duration}:${meta.dots}`;
}

function buildVexBeams(notes, noteMeta) {
  const beams = [];
  let runStart = -1;

  const flushRun = (runEndExclusive) => {
    if (runStart < 0) {
      return;
    }

    let groupStart = runStart;
    while (groupStart < runEndExclusive) {
      const groupKey = getBeamGroupKey(noteMeta[groupStart]);
      let groupEndExclusive = groupStart + 1;

      while (
        groupEndExclusive < runEndExclusive
        && getBeamGroupKey(noteMeta[groupEndExclusive]) === groupKey
      ) {
        groupEndExclusive += 1;
      }

      if (groupEndExclusive - groupStart > 1) {
        const generated = Beam.generateBeams(notes.slice(groupStart, groupEndExclusive));
        generated.forEach((beam) => beams.push(beam));
      }

      groupStart = groupEndExclusive;
    }

    runStart = -1;
  };

  for (let index = 0; index < notes.length; index += 1) {
    if (isBeamableNoteMeta(noteMeta[index])) {
      if (runStart < 0) {
        runStart = index;
      }

      continue;
    }

    flushRun(index);
  }

  flushRun(notes.length);
  return beams;
}

function isBeamableNoteMeta(meta) {
  if (!meta || meta.isRest) {
    return false;
  }

  return meta.duration === "8" || meta.duration === "16" || meta.duration === "32";
}

function getBeamGroupKey(meta) {
  if (!meta) {
    return "";
  }

  return `${meta.triplet ? "t" : "s"}:${meta.duration}:${meta.dots}`;
}

function createTripletTuplet(notes) {
  if (notes.length !== 3) {
    return null;
  }

  try {
    return new Tuplet(notes, {
      num_notes: 3,
      notes_occupied: 2,
      bracketed: true,
      ratioed: false,
    });
  } catch (error) {
    return null;
  }
}

function expandTokenToVexChunks(token) {
  const tripletChunks = getForcedEighthTripletChunks(token.durationTicks);
  if (tripletChunks) {
    return tripletChunks.map(() => ({
      duration: "8",
      dots: 0,
      triplet: true,
      isRest: token.isRest,
    }));
  }

  const resolved = resolveVexDuration(token.durationTicks);
  if (resolved) {
    return [{ ...resolved, isRest: token.isRest }];
  }

  return splitDurationTicks(token.durationTicks).map((chunkTicks) => {
    const chunkDuration = resolveVexDuration(chunkTicks) || {
      duration: "16",
      dots: 0,
      triplet: false,
    };

    return {
      ...chunkDuration,
      isRest: token.isRest,
    };
  });
}

function getForcedEighthTripletChunks(durationTicks) {
  if (rhythmMode !== "triplet") {
    return null;
  }

  if (durationTicks === 8) {
    return [8];
  }

  if (durationTicks % 24 === 0) {
    return null;
  }

  if (durationTicks % 8 !== 0) {
    return null;
  }

  return Array.from({ length: durationTicks / 8 }, () => 8);
}

function splitDurationTicks(durationTicks) {
  const chunks = [];
  let remaining = durationTicks;

  DECOMPOSE_TICKS_DESC.forEach((candidate) => {
    while (remaining >= candidate) {
      chunks.push(candidate);
      remaining -= candidate;
    }
  });

  if (remaining > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

function resolveVexDuration(durationTicks) {
  const direct = STANDARD_TICK_TO_DURATION.get(durationTicks);
  if (direct) {
    return {
      duration: direct,
      dots: 0,
      triplet: false,
    };
  }

  for (const [baseTicks, duration] of STANDARD_TICK_TO_DURATION.entries()) {
    if (baseTicks % 2 === 0 && durationTicks === (baseTicks * 3) / 2) {
      return {
        duration,
        dots: 1,
        triplet: false,
      };
    }
  }

  const tripletDirect = TRIPLET_TICK_TO_DURATION.get(durationTicks);
  if (tripletDirect) {
    return {
      duration: tripletDirect,
      dots: 0,
      triplet: true,
    };
  }

  for (const [baseTicks, duration] of TRIPLET_TICK_TO_DURATION.entries()) {
    if (baseTicks % 2 === 0 && durationTicks === (baseTicks * 3) / 2) {
      return {
        duration,
        dots: 1,
        triplet: true,
      };
    }
  }

  return null;
}

function createVexNote(chunk) {
  const duration = chunk.isRest ? `${chunk.duration}r` : chunk.duration;
  const note = new StaveNote({
    clef: "percussion",
    keys: [chunk.isRest ? "b/4" : "g/4"],
    duration,
  });

  for (let dot = 0; dot < chunk.dots; dot += 1) {
    note.addModifier(new Dot(), 0);
  }

  return note;
}

function onUserStaffClick() {
  if (!hasRhythm) {
    setStatus("Generate a rhythm first.", "warning");
    return;
  }

  if (isPlaying) {
    return;
  }

  if (userCursorTick >= getTotalTicks()) {
    setStatus("All bars are full. Undo or clear to continue.", "warning");
    return;
  }

  openStaffPrompt();
}

function openStaffPrompt() {
  if (!elements.staffPromptBackdrop) {
    return;
  }

  renderPromptValueOptions();

  const barIndex = Math.floor(userCursorTick / TICKS_PER_BAR) + 1;
  const beatIndex = Math.floor((userCursorTick % TICKS_PER_BAR) / TICKS_PER_BEAT) + 1;
  elements.staffPromptPosition.textContent = `Bar ${barIndex}, Beat ${beatIndex}`;

  elements.staffPromptType.value = "note";
  elements.staffPromptVariant.value = "normal";

  elements.staffPromptBackdrop.classList.remove("hidden");
  staffPromptOpen = true;
}

function closeStaffPrompt() {
  if (!elements.staffPromptBackdrop) {
    return;
  }

  elements.staffPromptBackdrop.classList.add("hidden");
  staffPromptOpen = false;
}

function placeFromStaffPrompt() {
  if (!hasRhythm || isPlaying) {
    closeStaffPrompt();
    return;
  }

  const selectedType = elements.staffPromptType.value;
  const selectedVariant = elements.staffPromptVariant.value;

  const valueTicks = Number(elements.staffPromptValue.value);
  if (!Number.isFinite(valueTicks) || valueTicks <= 0) {
    setStatus("Invalid value selected.", "warning");
    return;
  }

  elements.valueSelect.value = String(valueTicks);

  const isRest = selectedType === "rest";
  const wantsDotted = selectedVariant === "dotted";
  let wantsLigature = selectedVariant === "ligature";

  if (isRest && wantsLigature) {
    wantsLigature = false;
    setStatus("Ligature applies to notes only. Rest placed as normal.", "neutral");
  }

  elements.restToggle.checked = isRest;
  elements.dottedToggle.checked = wantsDotted;
  elements.tieToggle.checked = !isRest && wantsLigature;

  const placed = insertValueFromControls();
  if (placed) {
    closeStaffPrompt();
  }
}
