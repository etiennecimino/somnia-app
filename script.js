// script.js
// JS-Logik für Somniva - Full Version mit Atemübung
// ---------------------------------------------------------------

// Globale DOM-Elemente
const messageModal = document.getElementById('message-modal');
const modalText = document.getElementById('modal-text');
const loadingOverlay = document.getElementById('loading-overlay');
const countdownTimerEl = document.getElementById('countdown-timer');
const currentContentTitleEl = document.getElementById('current-content-title');
const currentContentGenreEl = document.getElementById('current-content-genre');
const loadingStatusEl = document.getElementById('loading-status');
const breathingTextEl = document.getElementById('breathing-text');

// ✅ Vibration Helper
function vibrate(pattern = 25) {
    if ("vibrate" in navigator) {
        navigator.vibrate(pattern);
    }
}

// Profile Stats
let profileStats = {
    routinesStarted: 0,
    totalMinutesListened: 0,
    lastGenre: "–"
};

// Screens
const screens = {
    'splash-screen': document.getElementById('splash-screen'),
    'main-menu': document.getElementById('main-menu-screen'),
    'settings-menu': document.getElementById('settings-menu-screen'),
    'genre-selection': document.getElementById('genre-selection-screen'),
    'voice-selection-screen': document.getElementById('voice-selection-screen'),
    'sleeptimer-selection-screen': document.getElementById('sleeptimer-selection-screen'),
    'breathing': document.getElementById('breathing-screen'),
    'playback': document.getElementById('playback-screen'),
    'sleep-checkin': document.getElementById('sleep-checkin-screen'),
};

let currentScreenId = 'splash-screen';

// ------------------------------------------------------
// ✅ SLEEP CHECK-IN (bei JEDEM Reload wieder fragen)
// ------------------------------------------------------
function loadSleepMoods() {
  try {
    return JSON.parse(localStorage.getItem("somniva_sleep_moods") || "[]");
  } catch {
    return [];
  }
}

function saveSleepMoods(list) {
  localStorage.setItem("somniva_sleep_moods", JSON.stringify(list));
}

function saveSleepMood(mood) {
  const list = loadSleepMoods();
  const entry = { date: new Date().toISOString(), mood }; // mood: 1..3

  list.push(entry);

  // optional: auf max 30 Einträge begrenzen
  while (list.length > 30) list.shift();

  saveSleepMoods(list);

  // danach ins Menü
  transitionToScreen('main-menu');
}

function skipSleepMood() {
  transitionToScreen('main-menu');
}

// Einstellungen
let selectedTimerMinutes = 15;
let selectedGenre = 'Hörbuch';
let selectedVoice = 1;
let playbackSpeed = 1;

let selectedContent = null;
let currentAudio = null;

// ⏱️ Timer-Status
let countdownInterval = null;
let routineTimeout = null;
let remainingSeconds = 0;
let isTimerRunning = false;

let isPlaying = false;

// Atemübung
let breathingInterval = null;
let breathingTimeout = null;

// Playback Buttons
const playButton = document.getElementById('play-button');
const pauseButton = document.getElementById('pause-button');
const stopButton = document.getElementById('stop-button');

// ------------------------------------------------------
// PLAYBACK DIM / UNDIM (Stufen, Start nach 10s)
// ------------------------------------------------------
const DIM_START_DELAY_MS = 10000;   // ✅ startet 10 Sekunden nach Audiostart
const DIM_STEP_INTERVAL_MS = 2000;  // ✅ alle 2s nächste Stufe
const DIM_MAX_STEP = 5;

let dimDelayTimeout = null;
let dimStepInterval = null;
let dimStep = 0;

function applyDimStep(step) {
    const screen = screens['playback'];
    if (!screen) return;

    for (let i = 1; i <= DIM_MAX_STEP; i++) {
        screen.classList.remove(`playback-dim-${i}`);
    }

    if (step >= 1) {
        screen.classList.add(`playback-dim-${step}`);
    }
}

function undimPlaybackUI() {
    clearTimeout(dimDelayTimeout);
    clearInterval(dimStepInterval);
    dimDelayTimeout = null;
    dimStepInterval = null;
    dimStep = 0;

    applyDimStep(0);
}

function startDimSequenceAfterDelay() {
    // reset falls schon aktiv
    undimPlaybackUI();

    dimDelayTimeout = setTimeout(() => {
        dimStep = 1;
        applyDimStep(dimStep);

        dimStepInterval = setInterval(() => {
            dimStep++;
            if (dimStep > DIM_MAX_STEP) {
                clearInterval(dimStepInterval);
                dimStepInterval = null;
                return;
            }
            applyDimStep(dimStep);
        }, DIM_STEP_INTERVAL_MS);

    }, DIM_START_DELAY_MS);
}

// ------------------------------------------------------
// AUDIO-QUELLEN
// ------------------------------------------------------
function getAudioSource(genre, voice) {
    switch (genre) {
        case "Märchen":
            return voice === 1 ? "marchen/marchen1.mp3" : "marchen/marchen2.mp3";
        case "Hörbuch":
            return voice === 1 ? "audio/geschichte1.mp3" : "audio/geschichte2.mp3";
        case "White Noise":
            return "whitenoise/whitenoise1.mp3";
        case "Naturgeräusche":
            return "whitenoise/animal1.mp3";
    }
    return "audio/geschichte1.mp3";
}

// ------------------------------------------------------
// VOICE + SPEED
// ------------------------------------------------------
function updateVoiceSetting() {
    selectedVoice = parseInt(document.getElementById("voice-select").value, 10);
}

document.getElementById("speed-slider")?.addEventListener("input", e => {
    playbackSpeed = parseFloat(e.target.value);
    if (currentAudio) currentAudio.playbackRate = playbackSpeed;
});

// ------------------------------------------------------
// UI / Navigation
// ------------------------------------------------------
function updatePlaybackControls() {
    if (!playButton || !pauseButton) return;

    if (isPlaying) {
        playButton.classList.add('hidden');
        pauseButton.classList.remove('hidden');
    } else {
        playButton.classList.remove('hidden');
        pauseButton.classList.add('hidden');
    }
}

function transitionToScreen(target) {
    if (!screens[target] || target === currentScreenId) return;

    screens[currentScreenId].classList.remove('visible-screen');
    screens[currentScreenId].classList.add('hidden-screen');

    screens[target].classList.remove('hidden-screen');
    screens[target].classList.add('visible-screen');

    currentScreenId = target;
    lucide?.createIcons();
}

// ✅ Nach "Los geht's": IMMER zuerst Check-in (bei jedem Reload neu)
function transitionToMainMenu() {
    transitionToScreen('sleep-checkin');
}

// ------------------------------------------------------
// GENRE / TIMER
// ------------------------------------------------------
function selectGenre(genre) {
    selectedGenre = genre;
    document.querySelectorAll('#genre-selection-screen .genre-button')
        .forEach(btn => btn.classList.toggle('active', btn.textContent.trim() === genre));
}

function setTimerActive(button, minutes) {
    selectedTimerMinutes = parseInt(minutes, 10);
    document.querySelectorAll('.timer-button').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
}

// ------------------------------------------------------
// BACK
// ------------------------------------------------------
function goBack() {
    const map = {
        'settings-menu': 'main-menu',
        'genre-selection': 'settings-menu',
        'voice-selection-screen': 'settings-menu',
        'sleeptimer-selection-screen': 'main-menu',
        'breathing': 'sleeptimer-selection-screen',
        'playback': 'sleeptimer-selection-screen',
        'sleep-checkin': 'splash-screen',
    };

    const prev = map[currentScreenId];
    if (!prev) return;

    stopRoutine();
    transitionToScreen(prev);
}

// ------------------------------------------------------
// 🫁 ATEMÜBUNG + VIBRATION BEIM EINATMEN
// ------------------------------------------------------
function startBreathingExercise() {
    stopRoutine();
    transitionToScreen('breathing');

    const circle = document.querySelector('.breathing-circle');
    if (!circle || !breathingTextEl) return;

    let inhale = true;

    function setPhase(isInhale) {
        circle.classList.toggle('inhale', isInhale);
        circle.classList.toggle('exhale', !isInhale);

        breathingTextEl.classList.add('fade-out');
        setTimeout(() => {
            breathingTextEl.textContent = isInhale ? "Einatmen" : "Ausatmen";
            breathingTextEl.classList.remove('fade-out');
        }, 220);

        if (isInhale) vibrate(40);
    }

    clearInterval(breathingInterval);
    clearTimeout(breathingTimeout);

    setPhase(true);

    breathingInterval = setInterval(() => {
        inhale = !inhale;
        setPhase(inhale);
    }, 4000);

    breathingTimeout = setTimeout(skipBreathing, 24000);
}

function skipBreathing() {
    clearInterval(breathingInterval);
    clearTimeout(breathingTimeout);
    startRoutine();
}

// ------------------------------------------------------
// 🎧 AUDIO ROUTINE
// ------------------------------------------------------
function startRoutine() {
    // Reset evtl. altes Audio
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }

    undimPlaybackUI();

    const src = getAudioSource(selectedGenre, selectedVoice);

    selectedContent = {
        title: `${selectedGenre} (Stimme ${selectedVoice})`,
        genre: selectedGenre,
        audioSrc: src,
    };

    currentContentTitleEl.textContent = selectedContent.title;
    currentContentGenreEl.textContent = selectedContent.genre;

    transitionToScreen('playback');

    currentAudio = new Audio(src);
    currentAudio.playbackRate = playbackSpeed;

    currentAudio.onended = () => {
        stopRoutine();
        showMessage("Die Geschichte ist zu Ende. Schlaf gut!");
    };

    currentAudio.onerror = () => {
        if (loadingStatusEl) loadingStatusEl.textContent = "Fehler beim Laden.";
        undimPlaybackUI();
    };

    currentAudio.play().then(() => {
        isPlaying = true;
        updatePlaybackControls();
        startCountdown();
        if (loadingStatusEl) loadingStatusEl.textContent = "Spielt...";

        // ✅ 10 Sekunden warten -> dann Stufen-Dim
        startDimSequenceAfterDelay();
    }).catch(() => {
        isPlaying = false;
        updatePlaybackControls();
        undimPlaybackUI();
        showMessage("Bitte Play drücken.");
    });
}

function pauseRoutine() {
    if (!currentAudio) return;

    currentAudio.pause();
    isPlaying = false;

    // Timer stoppt beim Pausieren ✅
    isTimerRunning = false;
    clearTimeout(routineTimeout);

    updatePlaybackControls();

    // ✅ Dim sofort weg + Sequenz stoppen
    undimPlaybackUI();
}

function resumeRoutine() {
    if (!currentAudio) return;

    currentAudio.play().then(() => {
        isPlaying = true;

        // Timer läuft weiter ✅
        isTimerRunning = true;

        // Stop nach Restzeit
        clearTimeout(routineTimeout);
        if (selectedTimerMinutes !== 0 && remainingSeconds > 0) {
            routineTimeout = setTimeout(() => {
                stopRoutine();
                showMessage("Schlafenszeit!");
            }, remainingSeconds * 1000);
        }

        updatePlaybackControls();

        // ✅ nach Resume wieder: 10s warten, dann Stufen-Dim
        startDimSequenceAfterDelay();
    }).catch(() => {
        isPlaying = false;
        updatePlaybackControls();
        undimPlaybackUI();
    });
}

// ------------------------------------------------------
// ⏱️ TIMER (FIXED: pausiert wirklich)
// ------------------------------------------------------
function startCountdown() {
    clearInterval(countdownInterval);
    clearTimeout(routineTimeout);

    if (selectedTimerMinutes === 0) {
        countdownTimerEl.textContent = "∞";
        remainingSeconds = 0;
        isTimerRunning = false;
        return;
    }

    remainingSeconds = selectedTimerMinutes * 60;
    isTimerRunning = true;

    function render() {
        const m = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
        const s = String(remainingSeconds % 60).padStart(2, "0");
        countdownTimerEl.textContent = `${m}:${s}`;
    }

    render();

    countdownInterval = setInterval(() => {
        if (!isTimerRunning) return;

        remainingSeconds--;
        render();

        if (remainingSeconds <= 0) {
            stopRoutine();
            showMessage("Schlafenszeit!");
        }
    }, 1000);

    routineTimeout = setTimeout(() => {
        stopRoutine();
        showMessage("Schlafenszeit!");
    }, remainingSeconds * 1000);
}

function stopRoutine() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }

    isPlaying = false;
    isTimerRunning = false;
    remainingSeconds = 0;

    clearInterval(countdownInterval);
    clearTimeout(routineTimeout);

    countdownTimerEl.textContent = "00:00";
    updatePlaybackControls();

    // ✅ Dim weg + Sequenz stoppen
    undimPlaybackUI();
}

// ------------------------------------------------------
// INIT
// ------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    Object.keys(screens).forEach(id => {
        if (id !== 'splash-screen') screens[id].classList.add('hidden-screen');
    });

    selectGenre(selectedGenre);

    playButton.onclick = resumeRoutine;
    pauseButton.onclick = pauseRoutine;
    stopButton.onclick = () => {
        stopRoutine();
        transitionToScreen('sleeptimer-selection-screen');
        showMessage("Routine beendet.");
    };

    lucide?.createIcons();
    updatePlaybackControls();
});

// ------------------------------------------------------
// MODALS
// ------------------------------------------------------
function showMessage(text) {
    modalText.textContent = text;
    messageModal.classList.remove('hidden');
    messageModal.classList.add('flex');
}

function hideMessage() {
    messageModal.classList.add('hidden');
    messageModal.classList.remove('flex');
}

function showProfile() {
    document.getElementById('profile-routines').textContent = profileStats.routinesStarted;
    document.getElementById('profile-time').textContent = profileStats.totalMinutesListened;
    document.getElementById('profile-last-genre').textContent = profileStats.lastGenre;

    renderSleepChart();

    const modal = document.getElementById('profile-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function hideProfile() {
    const modal = document.getElementById('profile-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function renderSleepChart() {
  const el = document.getElementById("sleep-chart");
  if (!el) return;

  const list = loadSleepMoods();
  const last7 = list.slice(-7);

  el.innerHTML = "";

  const pad = 7 - last7.length;
  for (let i = 0; i < pad; i++) {
    const bar = document.createElement("div");
    bar.className = "sleep-bar mood-1";
    bar.style.height = "10px";
    bar.style.opacity = "0.1";
    el.appendChild(bar);
  }

  last7.forEach(entry => {
    const bar = document.createElement("div");
    bar.className = `sleep-bar mood-${entry.mood}`;

    const h = entry.mood === 1 ? 25 : entry.mood === 2 ? 50 : 80;
    bar.style.height = `${h}px`;
    bar.title = `${entry.date} – ${entry.mood === 1 ? "schlecht" : entry.mood === 2 ? "mittel" : "gut"}`;
    el.appendChild(bar);
  });
}

// ---------------------------------------------
// 👆 TAP / CLICK RESETTET DIM (Playback Screen)
// ---------------------------------------------
const playbackScreen = screens['playback'];

if (playbackScreen) {
    playbackScreen.addEventListener('click', (e) => {
        if (e.target.closest('#stop-button')) return;

        undimPlaybackUI();

        if (isPlaying) {
            startDimSequenceAfterDelay();
        }
    });
}
