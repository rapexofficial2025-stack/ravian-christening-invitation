const book = document.getElementById('book');
const cover = document.getElementById('cover');
const coverFront = document.querySelector('.cover-front');
const coverBack = document.querySelector('.cover-back');
const hint = document.getElementById('openingHint');
const note = document.getElementById('stickyNote');
const tape = document.getElementById('tape');
const play = document.getElementById('playMessage');
const typed = document.getElementById('typedMessage');
const muteButton = document.getElementById('muteButton');
const music = document.getElementById('backgroundMusic');
const voice = document.getElementById('ravianVoice');
const ravianVideo = document.getElementById('ravianVideo');
const ninongChoice = document.getElementById('ninongChoice');
const btnNinong = document.getElementById('btnNinong');
const btnNinang = document.getElementById('btnNinang');
const finalMessage = document.getElementById('finalMessage');

let angle = 0, coverDrag = null, noteDrag = null;
let noteOffset = { x: 5, y: 0 };
let isCardOpen = false, isPlaying = false, isStickyRemoved = false, isInteractionLocked = false, isMuted = false, typingCancelled = false, musicFade = null;

const openingMessage = `Greetings\nBuenas Dias! Mi Querido Tito y Tita.\n\nSa araw nang aking unang iyak at hinga,\nsinalubong agad ako nina Mama at Papa\nng pagmamahal, pag aaruga, at maraming pangarap para sa aking kinabukasan.\n\nNgunit naniniwala sila\nna mas magiging maganda ang aking paglalakbay\nsa buhay kung may mabubuting taong\ngagabay at mamahal din sa akin tulad ninyo.`;
const endingMessage = `Kaya po, Tita at Tito,\nmay munting kahilingan ako sa inyo.\nSana ay tangapin ninyo ang natatanging papel na maging aking Ninong at Ninang.\n\nSamahan ninyo ako sa aking paglaki, gabayan! ninyo ako sa tamang landas, ipagdasal ako,\nat maging inspirasyon ko sa bawat hakbang ng aking buhay.\nAng inyong pagmamahal at patnubay ay magiging isang regalong habang buhay kong iingatan sa aking puso.\n\nNag mamahal ng marami\nRayvian Cael`;

const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));

// ---------- COVER ----------
function setCoverAngle(value) {
  angle = Math.max(-180, Math.min(0, value));
  const bend = Math.sin((Math.abs(angle) / 180) * Math.PI);
  book.style.setProperty('--open', `${angle}deg`);
  cover.style.setProperty('--bend', bend.toFixed(3));
  cover.style.setProperty('--bend-shadow', `${Math.round(bend * 26)}px`);
  cover.style.setProperty('--bend-scale', (1 - bend * .024).toFixed(3));
  cover.style.setProperty('--bend-radius', `${Math.round(bend * 9)}%`);

  const showBack = angle <= -90;
  coverFront.style.visibility = showBack ? 'hidden' : 'visible';
  coverBack.style.visibility = showBack ? 'visible' : 'hidden';
}

function finishCover() {
  if (!coverDrag || isInteractionLocked) return;
  coverDrag = null; isCardOpen = angle <= -90;
  cover.classList.add('snapping'); setCoverAngle(isCardOpen ? -180 : 0); fadeMusic(isCardOpen); hint.style.opacity = '0';
  window.setTimeout(() => cover.classList.remove('snapping'), 900);
}
cover.addEventListener('pointerdown', event => {
  if (isInteractionLocked || event.target.closest('.sticky-note, .play-message, .mute-button')) return;
  event.preventDefault(); cover.setPointerCapture(event.pointerId); cover.classList.remove('snapping');
  coverDrag = { x: event.clientX, angle, width: book.getBoundingClientRect().width / 2 };
});
cover.addEventListener('pointermove', event => { if (coverDrag && !isInteractionLocked) setCoverAngle(coverDrag.angle + ((event.clientX - coverDrag.x) / coverDrag.width) * 180); });
cover.addEventListener('pointerup', finishCover);
cover.addEventListener('pointercancel', finishCover);

// ---------- NOTE: PEEL PHASE (while still stuck under the tape) ----------
const PEEL_THRESHOLD = 60;

note.addEventListener('pointerdown', event => {
  if (!isCardOpen || isStickyRemoved) return;
  event.preventDefault(); note.setPointerCapture(event.pointerId);
  noteDrag = { y: event.clientY };
  note.classList.add('peeling'); tape.classList.add('bending');
});

note.addEventListener('pointermove', event => {
  if (!noteDrag || isStickyRemoved) return;
  const dy = Math.min(0, event.clientY - noteDrag.y);
  const progress = Math.max(0, Math.min(1, -dy / PEEL_THRESHOLD));
  note.style.setProperty('--peel', progress.toFixed(1));
 note.style.transform =
`translateY(${dy * 0.4}px)
 perspective(600px)
 rotateX(${progress +5}deg)`;
  tape.style.transform = `rotate(-3deg) scaleX(${Math.max(.2, 1 - progress)})`;
});

function releasePeel() {
  if (!noteDrag || isStickyRemoved) { noteDrag = null; return; }
  noteDrag = null;
  note.classList.remove('peeling');
  const progress = parseFloat(note.style.getPropertyValue('--peel')) || 0;
  if (progress >= 1) {
    tape.style.transform = ''; tape.classList.add('snapped');
    fallNote();
  } else {
    note.style.setProperty('--peel', 0);
    note.style.transform = '';
    tape.style.transform = '';
  }
}
note.addEventListener('pointerup', releasePeel);
note.addEventListener('pointercancel', releasePeel);

// ---------- NOTE: FALLS OFF, THEN GETS FREED FROM THE FLIPPED COVER ----------
function fallNote() {
  note.style.transition = 'transform 999ms cubic-bezier(0.2, 0.8, 0.2, 1)';
  note.style.transform = `translateY(${book.getBoundingClientRect().height * 0.9}px) rotate(-16deg)`;

  note.addEventListener('transitionend', function handler() {
    note.removeEventListener('transitionend', handler);

    // Freeze the note's exact current on-screen box, then move it out
    // of the rotated cover into the flat .book element. This is what
    // stops it from flipping shut with the cover, and makes free dragging
    // track the cursor correctly (no more mirrored-parent math).
    const bookRect = book.getBoundingClientRect();
    const noteRect = note.getBoundingClientRect();

    const originalWidth = note.offsetWidth;
    const originalHeight = note.offsetHeight;
    

    note.style.transition = '';

    book.appendChild(note);
    note.classList.add('tossed');

    note.style.left = `${noteRect.left - bookRect.left}px`;
    note.style.top = `${noteRect.top - bookRect.top}px`;

    note.style.transform = "none";
    note.classList.add('tossed');
    note.style.left = `${noteRect.left - bookRect.left}px`;
    note.style.top = `${noteRect.top - bookRect.top}px`;
    note.style.right = 'auto';
    note.style.width = `${originalWidth}px`;
    note.style.height = `${originalHeight}px`;

    isStickyRemoved = true;
    noteOffset = { x: 0, y: 0 };
  }, { once: true });
}

function drawNote() {
  if (!isStickyRemoved) return;
  note.style.transform = `translate(${noteOffset.x}px, ${noteOffset.y}px) rotate(${(noteOffset.x / 16 + 8).toFixed(1)}deg)`;
}

// ---------- NOTE: FREE DRAG (after it's fallen off) ----------
note.addEventListener('pointerdown', event => {
  if (!isStickyRemoved) return;
  event.preventDefault(); note.setPointerCapture(event.pointerId);
  noteDrag = { x: event.clientX, y: event.clientY, offsetX: noteOffset.x, offsetY: noteOffset.y };
  note.classList.add('dragging');
});
note.addEventListener('pointermove', event => {
  if (!noteDrag || !isStickyRemoved) return;
  noteOffset = {
    x: noteDrag.offsetX + (event.clientX - noteDrag.x),
    y: noteDrag.offsetY + (event.clientY - noteDrag.y)
  };
  drawNote();
});
note.addEventListener('pointerup', () => { noteDrag = null; note.classList.remove('dragging'); });
note.addEventListener('pointercancel', () => { noteDrag = null; note.classList.remove('dragging'); });

// ---------- TYPING ----------
async function typeTimed(text, letterDelay) {
  for (const letter of text) { if (typingCancelled) return; typed.textContent += letter; await wait(letterDelay); }
}
async function typeInvitationMessage() {
  const fadeDuration = 600;
  const typingDuration = 40000 - 300 - fadeDuration;
  const letterDelay = typingDuration / (openingMessage.length + endingMessage.length);
  typed.textContent = '';
  await typeTimed(openingMessage, letterDelay);
  if (typingCancelled) return;
  typed.classList.add('fading');
  await wait(fadeDuration);
  typed.textContent = '';
  typed.classList.remove('fading');
  await typeTimed(endingMessage, letterDelay);
}

// ---------- AUDIO ----------
async function safePlay(audio) {
  if (!audio.src && !audio.currentSrc) return;
  try { await audio.play(); } catch (err) { console.warn('Playback failed:', err); }
}
function fadeMusic(opening) {
  window.clearInterval(musicFade);
  const target = opening ? 1 : 0;
  if (opening) safePlay(music);
  musicFade = window.setInterval(() => {
    const next = Math.max(0, Math.min(1, music.volume + (opening ? .05 : -.05)));
    music.volume = next;
    if (next === target) { window.clearInterval(musicFade); if (!opening) music.pause(); }
  }, 45);
}

// ---------- PLAY BUTTON ----------
play.addEventListener('click', async () => {
  if (isPlaying || !isCardOpen) return;
  isPlaying = true; isInteractionLocked = true; typingCancelled = true;

  ninongChoice.classList.remove('visible', 'fading');
  finalMessage.classList.remove('visible');

  await wait(50);
  typed.textContent = '';
  typed.classList.remove('fading');
  typingCancelled = false;

  await wait(250);
  try {
    if (ravianVideo.readyState >= 1) ravianVideo.currentTime = 0;
    if (voice.readyState >= 1) voice.currentTime = 0;
  } catch (err) { console.warn('currentTime reset failed:', err); }

  safePlay(ravianVideo);
  safePlay(voice);
  await typeInvitationMessage();
});

ravianVideo.addEventListener('loadedmetadata', () => {
  ravianVideo.currentTime = 0.01; // paints frame 1 instead of a black box
});

ravianVideo.addEventListener('ended', () => {
  ravianVideo.pause();
  ravianVideo.currentTime = 0.01;
  isPlaying = false;
  isInteractionLocked = false;
  ninongChoice.classList.add('visible');
});

// ---------- NINONG / NINANG CHOICE ----------
function chooseRole(role) {
  ninongChoice.classList.add('fading');
  window.setTimeout(() => {
    ninongChoice.classList.remove('visible', 'fading');
    finalMessage.textContent = role === 'ninong' ? 'THANK YOU NINONG!' : 'THANK YOU NINANG!';
    finalMessage.classList.add('visible');
  }, 400);
}
btnNinong.addEventListener('click', () => chooseRole('ninong'));
btnNinang.addEventListener('click', () => chooseRole('ninang'));

// ---------- MUTE ----------
muteButton.addEventListener('click', () => {
  isMuted = !isMuted; music.muted = isMuted; voice.muted = isMuted;
  muteButton.setAttribute('aria-pressed', String(isMuted));
  muteButton.setAttribute('aria-label', isMuted ? 'Unmute audio' : 'Mute audio');
});

// ---------- INIT ----------
setCoverAngle(0);
music.volume = 0;