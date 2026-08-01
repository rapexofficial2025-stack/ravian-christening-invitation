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
const rotatePrompt = document.querySelector('.rotate-prompt');

let angle = 0, coverDrag = null, noteDrag = null, musicFade = null;
let noteOffset = { x: 0, y: 0 };
let noteRotation = 0;
let isCardOpen = false, isPlaying = false, isStickyRemoved = false;
let isInteractionLocked = false, isMuted = false, typingCancelled = false, musicStarted = false;

/* Split into 3 parts and paced to the ~45s video/voice length (VIDEO_DURATION_MS below). */
const message1 = `Greetings\nBuenas Dias! Mi Querido Tito y Tita.\n\nSa araw nang aking unang iyak at hinga,\nsinalubong agad ako nina Mama at Papa\nng pagmamahal, pag aaruga, at maraming pangarap para sa aking kinabukasan.`;
const message2 = `Ngunit naniniwala sila\nna mas magiging maganda ang aking paglalakbay\nsa buhay kung may mabubuting taong\ngagabay at mamahal din sa akin tulad ninyo.\n\nKaya po, Tita at Tito,\nmay munting kahilingan ako sa inyo.\nSana ay tanggapin ninyo ang natatanging papel na maging aking Ninong at Ninang.`;
const message3 = `Samahan ninyo ako sa aking paglaki, gabayan ninyo ako sa tamang landas, ipagdasal ako,\nat maging inspirasyon ko sa bawat hakbang ng aking buhay.\nAng inyong pagmamahal at patnubay ay magiging isang regalong habang buhay kong iingatan sa aking puso.\n\nNagmamahal nang marami,\nRayvian Cael`;
const VIDEO_DURATION_MS = 45000;
const MESSAGE_PAUSE_MS = 700;
const MESSAGE_PARTS = [message1, message2, message3];
const MESSAGE_DELAY = Math.round((VIDEO_DURATION_MS - MESSAGE_PAUSE_MS * (MESSAGE_PARTS.length - 1)) / MESSAGE_PARTS.reduce((sum, part) => sum + part.length, 0));
const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));

function setCoverAngle(value) {
  angle = Math.max(-180, Math.min(0, value));
  const bend = Math.sin((Math.abs(angle) / 180) * Math.PI);
  const openAmount = Math.abs(angle) / 180;
  book.style.setProperty('--open', `${angle}deg`);
  cover.style.setProperty('--bend', bend.toFixed(3));
  cover.style.setProperty('--bend-shadow', `${Math.round(bend * 26)}px`);
  cover.style.setProperty('--bend-scale', (1 - bend * .024).toFixed(3));
  cover.style.setProperty('--bend-radius', `${Math.round(bend * 9)}%`);
  const showBack = angle <= -90;
  coverFront.style.visibility = showBack ? 'hidden' : 'visible';
  coverBack.style.visibility = showBack ? 'visible' : 'hidden';
  if (openAmount >= .1 && !musicStarted) { musicStarted = true; fadeMusic(true); }
  if (openAmount < .1 && musicStarted && !isCardOpen) { musicStarted = false; fadeMusic(false); }
}
function finishCover() {
  if (!coverDrag || isInteractionLocked) return;
  coverDrag = null;
  isCardOpen = angle <= -90;
  cover.classList.add('snapping');
  setCoverAngle(isCardOpen ? -180 : 0);
  fadeMusic(isCardOpen);
  hint.style.opacity = isCardOpen ? '0' : '1.5';
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

const PEEL_THRESHOLD = 60;
note.addEventListener('pointerdown', event => {
  if (!isCardOpen || isStickyRemoved || isInteractionLocked) return;
  event.preventDefault(); note.setPointerCapture(event.pointerId);
  noteDrag = { y: event.clientY };
});
note.addEventListener('pointermove', event => {
  if (!noteDrag || isStickyRemoved) return;
  const dy = Math.min(0, event.clientY - noteDrag.y);
  const progress = Math.max(0, Math.min(1, -dy / PEEL_THRESHOLD));
  note.style.setProperty('--peel', progress.toFixed(3));
  note.style.transform = `translateY(${dy * .4}px) perspective(600px) rotateX(${-progress * 34}deg) rotate(3deg)`;
  tape.style.transform = `rotate(-4deg) scaleX(${Math.max(.18, 1 - progress)})`;
});
function releasePeel() {
  if (!noteDrag || isStickyRemoved) { noteDrag = null; return; }
  noteDrag = null;
  const progress = parseFloat(note.style.getPropertyValue('--peel')) || 0;
  if (progress >= 1) { tape.style.transform = ''; tape.classList.add('snapped'); fallNote(); }
  else { note.style.removeProperty('--peel'); note.style.transform = ''; tape.style.transform = ''; }
}
note.addEventListener('pointerup', releasePeel);
note.addEventListener('pointercancel', releasePeel);

/* The note keeps its original CSS width and height. It is only re-parented to
   .book after its fall, using the rendered pivot position to prevent jumps.
   .sticky-note rotates around its top-left corner (transform-origin: top left),
   so that corner - not the rotated box's centre - is what must be preserved. */
const FALL_ROTATION = -14;
function fallNote() {
  const noteWidth = note.offsetWidth;
  const noteHeight = note.offsetHeight;
  const bookHeight = book.offsetHeight;
  const fallX = -noteWidth * 1.08, fallY = bookHeight * .52;
  note.style.transition = 'transform 900ms cubic-bezier(.24,.72,.28,1)';
  note.style.transform = `translate(${fallX}px, ${fallY}px) rotate(${FALL_ROTATION}deg)`;
  note.addEventListener('transitionend', function handler(event) {
    if (event.propertyName !== 'transform') return;
    note.removeEventListener('transitionend', handler);
    note.style.transition = 'none';
    /* Rotation about the top-left corner never moves that corner, so measuring
       the pivot with the rotation stripped out gives its exact landed screen position. */
    note.style.transform = `translate(${fallX}px, ${fallY}px)`;
    const pivotRect = note.getBoundingClientRect();
    const bookRect = book.getBoundingClientRect();
    const scale = bookRect.width / book.offsetWidth || 1;
    const pivotX = (pivotRect.left - bookRect.left) / scale;
    const pivotY = (pivotRect.top - bookRect.top) / scale;
    book.appendChild(note);
    note.classList.add('tossed');
    /* These values preserve the note's pre-fall size and rotation after its parent changes,
       so it lands and stays exactly where the fall animation left it. */
    note.style.width = `${noteWidth}px`;
    note.style.height = `${noteHeight}px`;
    note.style.left = `${pivotX}px`;
    note.style.top = `${pivotY}px`;
    note.style.right = 'auto';
    noteOffset = { x: 0, y: 0 };
    noteRotation = FALL_ROTATION;
    note.style.transform = `rotate(${noteRotation}deg)`;
    requestAnimationFrame(() => { note.style.transition = ''; });
    isStickyRemoved = true;
    book.classList.add('note-removed');
  }, { once: true });
}
function drawNote() { note.style.transform = `translate(${noteOffset.x}px, ${noteOffset.y}px) rotate(${(noteRotation + noteOffset.x / 18).toFixed(1)}deg)`; }
note.addEventListener('pointerdown', event => {
  if (!isStickyRemoved) return;
  event.preventDefault(); note.setPointerCapture(event.pointerId);
  noteDrag = { x: event.clientX, y: event.clientY, offsetX: noteOffset.x, offsetY: noteOffset.y };
  note.classList.add('dragging');
});
note.addEventListener('pointermove', event => {
  if (!noteDrag || !isStickyRemoved) return;
  noteOffset = { x: noteDrag.offsetX + (event.clientX - noteDrag.x), y: noteDrag.offsetY + (event.clientY - noteDrag.y) };
  drawNote();
});
function stopNoteDrag() { noteDrag = null; note.classList.remove('dragging'); }
note.addEventListener('pointerup', stopNoteDrag);
note.addEventListener('pointercancel', stopNoteDrag);

async function typeTimed(text, delay) { for (const letter of text) { if (typingCancelled) return false; typed.textContent += letter; await wait(delay); } return true; }
async function typeInvitationMessage() {
  typed.textContent = '';
  for (let i = 0; i < MESSAGE_PARTS.length; i++) {
    if (!await typeTimed(MESSAGE_PARTS[i], MESSAGE_DELAY)) return false;
    if (i === MESSAGE_PARTS.length - 1) break;
    typed.classList.add('fading'); await wait(MESSAGE_PAUSE_MS);
    if (typingCancelled) return false;
    typed.textContent = ''; typed.classList.remove('fading');
  }
  return true;
}
async function safePlay(audio) { if (!audio.currentSrc && !audio.src) return false; try { await audio.play(); return true; } catch (error) { console.warn('Playback failed:', error); return false; } }
function fadeMusic(opening) {
  window.clearInterval(musicFade);
  const target = opening ? .22 : 0;
  if (opening) safePlay(music);
  musicFade = window.setInterval(() => {
    music.volume = Math.max(0, Math.min(target, music.volume + (opening ? .010 : -.025)));
    if (music.volume === target) { window.clearInterval(musicFade); if (!opening) music.pause(); }
  }, 45);
}
function mediaEnded(media) { return new Promise(resolve => { if (!media.currentSrc && !media.src) return resolve(); if (media.ended) return resolve(); media.addEventListener('ended', resolve, { once: true }); media.addEventListener('error', resolve, { once: true }); }); }

play.addEventListener('click', async () => {
  if (isPlaying || !isCardOpen || !isStickyRemoved) return;
  isPlaying = true; isInteractionLocked = true; play.disabled = true; typingCancelled = true;
  ninongChoice.classList.remove('visible', 'fading'); finalMessage.classList.remove('visible');
  typed.textContent = ''; typed.classList.remove('fading'); typingCancelled = false;
  try { ravianVideo.currentTime = 0; voice.currentTime = 0; } catch (_) { }
  const videoWillPlay = await safePlay(ravianVideo);
  const voiceWillPlay = await safePlay(voice);
  await Promise.all([typeInvitationMessage(), videoWillPlay ? mediaEnded(ravianVideo) : Promise.resolve(), voiceWillPlay ? mediaEnded(voice) : Promise.resolve()]);
  isPlaying = false; isInteractionLocked = false; play.disabled = false;
  ninongChoice.classList.add('visible');
});
ravianVideo.addEventListener('loadedmetadata', () => { ravianVideo.currentTime = .01; });
function chooseRole(role) {
  ninongChoice.classList.add('fading');
  window.setTimeout(() => { ninongChoice.classList.remove('visible', 'fading'); finalMessage.innerHTML = `THANK YOU<br>${role.toUpperCase()} ♥`; finalMessage.classList.add('visible'); }, 400);
}
btnNinong.addEventListener('click', () => chooseRole('ninong'));
btnNinang.addEventListener('click', () => chooseRole('ninang'));
muteButton.addEventListener('click', () => { isMuted = !isMuted; music.muted = isMuted; voice.muted = isMuted; ravianVideo.muted = isMuted; muteButton.setAttribute('aria-pressed', String(isMuted)); muteButton.setAttribute('aria-label', isMuted ? 'Unmute audio' : 'Mute audio'); });
setCoverAngle(0); music.volume = 0;
if (rotatePrompt) window.setTimeout(() => rotatePrompt.classList.add('dismissed'), 4000);
