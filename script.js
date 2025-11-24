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
};

let currentScreenId = 'splash-screen';

// *** Globale Einstellungen ***
let selectedTimerMinutes = 15;
let selectedGenre = 'Hörbuch';
let selectedVoice = 1;
let playbackSpeed = 1;

let selectedContent = null;
let currentAudio = null;
let countdownInterval = null;
let routineTimeout = null;
let isPlaying = false;

let breathingInterval = null;
let breathingTimeout = null;

// Playback Controls
const playButton = document.getElementById('play-button');
const pauseButton = document.getElementById('pause-button');
const stopButton = document.getElementById('stop-button');


// DATEN – jetzt mit Voice 1 + Voice 2
function getAudioSource(genre, voice) {
    if (genre === "Märchen") {
        return voice === 1 ? "audio/marchen1.mp3" : "audio/marchen2.mp3";
    }
    if (genre === "Hörbuch") {
        return voice === 1 ? "audio/geschichte1.mp3" : "audio/geschichte2.mp3";
    }
    if (genre === "White Noise") {
        return "audio/whitenoise1.mp3";
    }
    if (genre === "Naturgeräusche") {
        return "audio/animal1.mp3";
    }
    return "audio/geschichte1.mp3";
}


// VOICE + SPEED
function updateVoiceSetting() {
    selectedVoice = parseInt(document.getElementById("voice-select").value, 10);
}

document.getElementById("speed-slider").addEventListener("input", (e) => {
    playbackSpeed = parseFloat(e.target.value);
    if (currentAudio) currentAudio.playbackRate = playbackSpeed;
});


// ------------------------------------------------------
//  UI + Navigation
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

function transitionToScreen(targetScreenId) {
    if (targetScreenId === currentScreenId || !screens[targetScreenId]) return;

    screens[currentScreenId].classList.remove('visible-screen');
    screens[currentScreenId].classList.add('hidden-screen');

    screens[targetScreenId].classList.remove('hidden-screen');
    screens[targetScreenId].classList.add('visible-screen');

    currentScreenId = targetScreenId;

    if (lucide && lucide.createIcons) lucide.createIcons();
}

function transitionToMainMenu() {
    transitionToScreen('main-menu');
}


// GENRE
function selectGenre(genre) {
    selectedGenre = genre;
    const buttons = document.querySelectorAll('#genre-selection-screen .genre-button');
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.textContent.trim() === genre);
    });
}


// TIMER
function setTimerActive(button, minutes) {
    selectedTimerMinutes = parseInt(minutes, 10);
    const buttons = document.querySelectorAll('.timer-button');
    buttons.forEach(b => b.classList.remove('active'));
    button.classList.add('active');
}


// BACK
function goBack() {
    const map = {
        'settings-menu': 'main-menu',
        'genre-selection': 'settings-menu',
        'voice-selection-screen': 'settings-menu',
        'sleeptimer-selection-screen': 'main-menu',
        'breathing': 'sleeptimer-selection-screen',
        'playback': 'sleeptimer-selection-screen',
    };
    const prev = map[currentScreenId];
    if (prev) {
        stopRoutine();
        profileStats.routinesStarted++;
profileStats.lastGenre = selectedGenre;
profileStats.totalMinutesListened += selectedTimerMinutes;

        transitionToScreen(prev);
    }
}


// ------------------------------------------------------
// Atemübung
// ------------------------------------------------------
function startBreathingExercise() {
    stopRoutine();
    transitionToScreen('breathing');

    breathingTextEl.textContent = "Einatmen";

    let inhale = true;

    breathingInterval = setInterval(() => {
        inhale = !inhale;
        breathingTextEl.textContent = inhale ? "Einatmen" : "Ausatmen";
    }, 4000);

    breathingTimeout = setTimeout(skipBreathing, 24000);
}

function skipBreathing() {
    clearInterval(breathingInterval);
    clearTimeout(breathingTimeout);
    startRoutine();
}


// ------------------------------------------------------
// AUDIO ROUTINE
// ------------------------------------------------------
function startRoutine() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }

    const src = getAudioSource(selectedGenre, selectedVoice);

    selectedContent = {
        title: selectedGenre + " (" + (selectedVoice === 1 ? "Stimme 1" : "Stimme 2") + ")",
        genre: selectedGenre,
        audioSrc: src,
    };

    currentContentTitleEl.textContent = selectedContent.title;
    currentContentGenreEl.textContent = selectedContent.genre;

    transitionToScreen('playback');

    currentAudio = new Audio(src);
    currentAudio.playbackRate = playbackSpeed;

    currentAudio.oncanplaythrough = () => {
        if (loadingStatusEl) loadingStatusEl.textContent = "";
    };

    currentAudio.onerror = () => {
        loadingStatusEl.textContent = "Fehler beim Laden.";
    };

    currentAudio.onended = () => {
        stopRoutine();
        showMessage("Die Geschichte ist zu Ende. Schlaf gut!");
    };

    const playPromise = currentAudio.play();
    playPromise?.then(() => {
        isPlaying = true;
        updatePlaybackControls();
        startCountdown();
        loadingStatusEl.textContent = "Spielt...";
    }).catch(() => {
        isPlaying = false;
        updatePlaybackControls();
        showMessage("Bitte Play drücken.");
    });
}

function resumeRoutine() {
    currentAudio.play();
    isPlaying = true;
    updatePlaybackControls();
}

function pauseRoutine() {
    currentAudio.pause();
    isPlaying = false;
    updatePlaybackControls();
}


// ------------------------------------------------------
// TIMER
// ------------------------------------------------------
function startCountdown() {
    clearInterval(countdownInterval);
    clearTimeout(routineTimeout);

    if (selectedTimerMinutes === 0) {
        countdownTimerEl.textContent = "∞";
        return;
    }

    let sec = selectedTimerMinutes * 60;

    function update() {
        const m = String(Math.floor(sec / 60)).padStart(2, "0");
        const s = String(sec % 60).padStart(2, "0");
        countdownTimerEl.textContent = `${m}:${s}`;
    }
    update();

    countdownInterval = setInterval(() => {
        sec--;
        update();
        if (sec <= 0) {
            stopRoutine();
            showMessage("Schlafenszeit!");
        }
    }, 1000);

    routineTimeout = setTimeout(stopRoutine, selectedTimerMinutes * 60000);
}

function stopRoutine() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
    isPlaying = false;

    clearInterval(countdownInterval);
    clearTimeout(routineTimeout);

    countdownTimerEl.textContent = "00:00";
    updatePlaybackControls();
}


// ------------------------------------------------------
// INIT
// ------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {

    for (const id in screens) {
        if (id !== "splash-screen") {
            screens[id].classList.add('hidden-screen');
        }
    }

    selectGenre(selectedGenre);

    playButton.onclick = resumeRoutine;
    pauseButton.onclick = pauseRoutine;
    stopButton.onclick = () => {
        stopRoutine();
        transitionToScreen("sleeptimer-selection-screen");
        showMessage("Routine beendet.");
    };

    if (lucide) lucide.createIcons();
    updatePlaybackControls();
});
function showProfile() {
    const modal = document.getElementById('profile-modal');

    document.getElementById('profile-routines').textContent = profileStats.routinesStarted;
    document.getElementById('profile-time').textContent = profileStats.totalMinutesListened;
    document.getElementById('profile-last-genre').textContent = profileStats.lastGenre;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function hideProfile() {
    const modal = document.getElementById('profile-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}
