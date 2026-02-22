import './style.css';

// --- Characters Asset List ---
const characters = [
  'tralalero_tralala.png',
  'bombardiro_crocodilo.png',
  'tung_tung_sahur.png',
  'lirili_larila.png',
  'brr_brr_patapim.png',
  'glorbo_fruttodrillo.png',
  'ballerina_cappuccina.png',
  'spaghetto_machetto.png',
  'ninja_tortellini.png',
  'pizzaboi_mamma_mia.png'
];

// --- State Management ---
let state = {
  currentScreen: 'main-menu',
  // 사용자가 제공한 단어/음절 리스트 + 추출된 자음들 (ㅇ, ㅈ, ㅂ, ㅅ, ㅎ, ㄹ)
  words: ['왕자', '백조', '손', '윤우', '윤하', '라', '자', '조', 'ㄹ', 'ㅇ', 'ㅈ', 'ㅂ', 'ㅅ', 'ㅎ'],
  stars: parseInt(localStorage.getItem('yoonu-stars')) || 0,
  currentRoundWords: [], // The 4 words shown
  targetWord: '', // The correct answer
  isParentMode: false,
  isProcessingClick: false // Prevent multiple rapid clicks
};

const screens = {
  loading: document.getElementById('loading-screen'),
  main: document.getElementById('main-menu'),
  game: document.getElementById('game-screen'),
  syllable: document.getElementById('syllable-game-screen')
};

const modals = {
  parent: document.getElementById('parent-modal'),
  password: document.getElementById('password-modal')
};

// --- Initialization ---
function init() {
  updateStars();
  renderWordList();

  document.getElementById('start-game').addEventListener('click', () => switchScreen('game'));
  document.getElementById('start-syllable-game').addEventListener('click', () => switchScreen('syllable'));
  document.getElementById('back-to-menu').addEventListener('click', () => switchScreen('main'));
  document.getElementById('back-to-menu-syllable').addEventListener('click', () => switchScreen('main'));
  document.getElementById('open-parent-mode').addEventListener('click', () => showPasswordModal());
  document.getElementById('close-parent-mode').addEventListener('click', () => closeModal('parent'));
  document.getElementById('add-word').addEventListener('click', addWord);
  document.getElementById('verify-password').addEventListener('click', verifyPassword);
  document.getElementById('cancel-password').addEventListener('click', () => closeModal('password'));
  document.getElementById('replay-tts').addEventListener('click', playTTS);
  document.getElementById('replay-tts-syllable').addEventListener('click', () => {
    if (state.syllableTarget) playTTSForSyllable(state.syllableTarget.char);
  });

  setTimeout(() => {
    switchScreen('main');
  }, 1500);
}

// --- Navigation ---
function switchScreen(screenName) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  screens[screenName].classList.remove('hidden');
  state.currentScreen = screenName;

  if (screenName === 'game') {
    startNewRound();
  } else if (screenName === 'syllable') {
    startSyllableRound();
  }
}

function showModal(modalName) {
  modals[modalName].classList.remove('hidden');
}

function closeModal(modalName) {
  modals[modalName].classList.add('hidden');
}

// --- Hangul Utilities ---
const CHOSEONG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const JUNGSEONG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const JONGSEONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

function getHangulComponents(strChar) {
  const code = strChar.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) return null; // Not a basic Hangul syllable
  const jong = code % 28;
  const jung = ((code - jong) / 28) % 21;
  const cho = ((code - jong) / 28 - jung) / 21;
  return { cho: CHOSEONG[cho], jung: JUNGSEONG[jung], jong: JONGSEONG[jong] };
}

// --- Text transformation for TTS ---
const consonantNameMap = {
  'ㄱ': '기역', 'ㄴ': '니은', 'ㄷ': '디귿', 'ㄹ': '리을',
  'ㅁ': '미음', 'ㅂ': '비읍', 'ㅅ': '시옷', 'ㅇ': '이응',
  'ㅈ': '지읒', 'ㅊ': '치읓', 'ㅋ': '키읔', 'ㅌ': '티읕',
  'ㅍ': '피읖', 'ㅎ': '히읗'
};

function getTTSReadText(word) {
  return consonantNameMap[word] || word;
}

// --- TTS Logic (Web Speech API) ---
function playTTS() {
  if (!window.speechSynthesis) return;
  // Cancel previous utterances
  window.speechSynthesis.cancel();

  const targetText = getTTSReadText(state.targetWord);
  const playConfiguredTTS = () => {
    let voices = window.speechSynthesis.getVoices();
    // 우선적으로 한국어 화자를 찾음 (구글, 혹은 로컬 기반)
    let kVoice = voices.find(v => (v.lang === 'ko-KR' || v.lang === 'ko_KR') && v.name.includes('Google')) ||
      voices.find(v => v.lang === 'ko-KR' || v.lang === 'ko_KR');

    const msg = new SpeechSynthesisUtterance(targetText);
    if (kVoice) msg.voice = kVoice;
    msg.lang = 'ko-KR';
    msg.rate = 1.0; // 속도 100 (정상 속도)
    msg.pitch = 1.0;
    window.speechSynthesis.speak(msg);
  };

  playConfiguredTTS();

  // 2초 뒤에 한 번 더 읽어주기
  setTimeout(() => {
    // 2초 뒤 상태가 여전히 현재 라운드 진행 중이면 읽어줌
    if (!state.isProcessingClick && targetText === getTTSReadText(state.targetWord)) {
      playConfiguredTTS();
    }
  }, 2000);
}

// --- Game Logic ---
function startNewRound() {
  state.isProcessingClick = false;
  const cardContainer = document.getElementById('card-container');
  cardContainer.innerHTML = '';

  if (state.words.length < 4) {
    cardContainer.innerHTML = '<p>아빠 메뉴에서 글자를 4개 이상 추가해주세요!</p>';
    return;
  }

  // Pick 4 random distinct words
  const shuffledWords = [...state.words].sort(() => 0.5 - Math.random());
  state.currentRoundWords = shuffledWords.slice(0, 4);

  // Pick 1 as target
  state.targetWord = state.currentRoundWords[Math.floor(Math.random() * 4)];

  // Generate Characters randomly for these 4 words
  const shuffledChars = [...characters].sort(() => 0.5 - Math.random());

  // Render cards
  state.currentRoundWords.forEach((word, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.word = word;

    // Character Image
    const img = document.createElement('img');
    img.className = 'card-image';
    img.src = `/characters/${shuffledChars[idx % shuffledChars.length]}`;
    img.alt = 'Character';
    card.appendChild(img);

    // Text Label
    const text = document.createElement('div');
    text.className = 'card-text';
    text.innerText = word;
    card.appendChild(text);

    card.addEventListener('click', handleCardClick);
    cardContainer.appendChild(card);
  });

  // Play TTS
  setTimeout(playTTS, 500);
}

// --- Sound Effects ---
const successSound = new Audio('/sounds/success.ogg');
const failSound = new Audio('/sounds/fail.ogg');

function handleCardClick(e) {
  if (state.isProcessingClick) return;

  const card = e.currentTarget;
  const clickedWord = card.dataset.word;

  if (clickedWord === state.targetWord) {
    // Correct Answer
    state.isProcessingClick = true;
    card.classList.add('correct');

    // Play funny success sound
    successSound.currentTime = 0;
    successSound.play().catch(e => console.log('Audio play failed:', e));

    const feedback = document.getElementById('feedback-message');
    feedback.innerText = '정답이에요! 참 잘했어요!';
    feedback.classList.remove('hidden');

    // Show dancing brainrot
    const brainrot = document.getElementById('dancing-brainrot');
    const randomChar = characters[Math.floor(Math.random() * characters.length)];
    brainrot.src = `/characters/${randomChar}`;
    brainrot.classList.remove('hidden');
    brainrot.classList.add('tada');

    state.stars++;
    updateStars();
    saveData();

    // Next round after 2.5s to allow dance animation to finish
    setTimeout(() => {
      feedback.classList.add('hidden');
      brainrot.classList.remove('tada');
      brainrot.classList.add('hidden');
      startNewRound();
    }, 2500);
  } else {
    // Wrong Answer
    card.classList.add('wrong');

    // Play TTS correctly again instead of fail sound
    playTTS();

    setTimeout(() => {
      card.classList.remove('wrong');
    }, 500);
  }
}

// --- Syllable Game Logic ---
function startSyllableRound() {
  state.isProcessingClick = false;
  clearTimeout(state.hintTimer);

  // Extract all valid basic syllables from words to use as target
  let validSyllables = [];
  state.words.forEach(word => {
    for (let char of word) {
      let comps = getHangulComponents(char);
      if (comps && comps.cho && comps.jung) {
        validSyllables.push({ char, comps });
      }
    }
  });

  if (validSyllables.length === 0) {
    // Default fallback if no words have valid syllables
    validSyllables = [
      { char: '가', comps: { cho: 'ㄱ', jung: 'ㅏ' } },
      { char: '고', comps: { cho: 'ㄱ', jung: 'ㅗ' } },
      { char: '나', comps: { cho: 'ㄴ', jung: 'ㅏ' } },
      { char: '다', comps: { cho: 'ㄷ', jung: 'ㅏ' } }
    ];
  }

  const targetData = validSyllables[Math.floor(Math.random() * validSyllables.length)];
  state.syllableTarget = targetData;
  state.syllableState = 'cho'; // wait for choseong

  // Clear slots
  const slotCho = document.getElementById('slot-consonant');
  const slotJung = document.getElementById('slot-vowel');
  const slotJong = document.getElementById('slot-jongseong');

  slotCho.innerText = '?';
  slotCho.classList.remove('filled');
  slotJung.innerText = '?';
  slotJung.classList.remove('filled');

  if (state.syllableTarget.comps.jong) {
    slotJong.style.display = 'flex';
    slotJong.innerText = '?';
    slotJong.classList.remove('filled');
  } else {
    slotJong.style.display = 'none';
  }

  document.getElementById('syllable-feedback-message').classList.add('hidden');

  renderSyllableOptions('cho');

  // Play target char TTS
  playTTSForSyllable(state.syllableTarget.char);
  resetSyllableHintTimer('cho');
}

function renderSyllableOptions(type) {
  const container = document.getElementById('syllable-options-container');
  container.innerHTML = '';

  let options = [];
  if (type === 'cho') {
    options = [...CHOSEONG].sort(() => 0.5 - Math.random()).slice(0, 5);
    if (!options.includes(state.syllableTarget.comps.cho)) {
      options[0] = state.syllableTarget.comps.cho;
    }
  } else if (type === 'jung') {
    options = [...JUNGSEONG].sort(() => 0.5 - Math.random()).slice(0, 5);
    if (!options.includes(state.syllableTarget.comps.jung)) {
      options[0] = state.syllableTarget.comps.jung;
    }
  } else if (type === 'jong') {
    let validJongseongs = JONGSEONG.filter(j => j !== '');
    options = [...validJongseongs].sort(() => 0.5 - Math.random()).slice(0, 5);
    if (!options.includes(state.syllableTarget.comps.jong)) {
      options[0] = state.syllableTarget.comps.jong;
    }
  }
  options = options.sort(() => 0.5 - Math.random());

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'syllable-option-btn';
    btn.innerText = opt;
    btn.dataset.val = opt;
    btn.addEventListener('click', () => handleSyllableOptionClick(btn));
    container.appendChild(btn);
  });
}

function handleSyllableOptionClick(btn) {
  if (state.isProcessingClick) return;
  const val = btn.dataset.val;

  if (state.syllableState === 'cho') {
    if (val === state.syllableTarget.comps.cho) {
      // Correct Choseong
      clearTimeout(state.hintTimer);
      document.getElementById('slot-consonant').innerText = val;
      document.getElementById('slot-consonant').classList.add('filled');
      successSound.currentTime = 0;
      successSound.play().catch(e => console.log(e));

      state.syllableState = 'jung';
      state.isProcessingClick = true;
      setTimeout(() => {
        state.isProcessingClick = false;
        renderSyllableOptions('jung');
        resetSyllableHintTimer('jung');
      }, 500);
    } else {
      playWrongSyllableAnim(btn);
    }
  } else if (state.syllableState === 'jung') {
    if (val === state.syllableTarget.comps.jung) {
      // Correct Jungseong
      clearTimeout(state.hintTimer);
      document.getElementById('slot-vowel').innerText = val;
      document.getElementById('slot-vowel').classList.add('filled');

      successSound.currentTime = 0;
      successSound.play().catch(e => console.log(e));

      if (state.syllableTarget.comps.jong) {
        state.syllableState = 'jong';
        state.isProcessingClick = true;
        setTimeout(() => {
          state.isProcessingClick = false;
          renderSyllableOptions('jong');
          resetSyllableHintTimer('jong');
        }, 500);
      } else {
        handleSyllableSuccess();
      }
    } else {
      playWrongSyllableAnim(btn);
    }
  } else if (state.syllableState === 'jong') {
    if (val === state.syllableTarget.comps.jong) {
      // Correct Jongseong
      clearTimeout(state.hintTimer);
      document.getElementById('slot-jongseong').innerText = val;
      document.getElementById('slot-jongseong').classList.add('filled');

      successSound.currentTime = 0;
      successSound.play().catch(e => console.log(e));

      handleSyllableSuccess();
    } else {
      playWrongSyllableAnim(btn);
    }
  }
}

function handleSyllableSuccess() {
  state.isProcessingClick = true;

  const feedback = document.getElementById('syllable-feedback-message');
  feedback.classList.remove('hidden');

  const brainrot = document.getElementById('dancing-brainrot');
  if (brainrot) {
    const randomChar = characters[Math.floor(Math.random() * characters.length)];
    brainrot.src = `/characters/${randomChar}`;
    brainrot.classList.remove('hidden');
    brainrot.classList.add('tada');
  }

  state.stars++;
  updateStars();
  saveData();

  setTimeout(() => {
    if (brainrot) {
      brainrot.classList.remove('tada');
      brainrot.classList.add('hidden');
    }
    startSyllableRound();
  }, 2500);
}

function playWrongSyllableAnim(btn) {
  failSound.currentTime = 0;
  failSound.play().catch(e => console.log(e));
  btn.classList.add('wrong-anim');
  setTimeout(() => {
    btn.classList.remove('wrong-anim');
  }, 500);
}

function resetSyllableHintTimer(type) {
  clearTimeout(state.hintTimer);
  state.hintTimer = setTimeout(() => {
    let correctVal = state.syllableTarget.comps.cho;
    if (type === 'jung') correctVal = state.syllableTarget.comps.jung;
    if (type === 'jong') correctVal = state.syllableTarget.comps.jong;

    const btns = document.querySelectorAll('.syllable-option-btn');
    btns.forEach(b => {
      if (b.dataset.val === correctVal) {
        b.classList.add('hint-glow');
      }
    });
  }, 5000);
}

function playTTSForSyllable(char) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  let voices = window.speechSynthesis.getVoices();
  let kVoice = voices.find(v => (v.lang === 'ko-KR' || v.lang === 'ko_KR') && v.name.includes('Google')) ||
    voices.find(v => v.lang === 'ko-KR' || v.lang === 'ko_KR');

  const msg = new SpeechSynthesisUtterance(char);
  if (kVoice) msg.voice = kVoice;
  msg.lang = 'ko-KR';
  msg.rate = 1.0;
  msg.pitch = 1.0;

  let playFunc = () => window.speechSynthesis.speak(msg);
  playFunc();

  setTimeout(() => {
    if (state.currentScreen === 'syllable' && !state.isProcessingClick) {
      playFunc();
    }
  }, 2000);
}

function updateStars() {
  document.getElementById('star-count').innerText = state.stars;
  if (document.getElementById('syllable-star-count')) {
    document.getElementById('syllable-star-count').innerText = state.stars;
  }
}

// --- Parent Mode / Data Management ---
function showPasswordModal() {
  const num1 = Math.floor(Math.random() * 5) + 1;
  const num2 = Math.floor(Math.random() * 5) + 1;
  state.correctAnswer = num1 + num2;

  document.getElementById('math-problem').innerText = `${num1} + ${num2} = ?`;
  document.getElementById('password-input').value = '';
  showModal('password');
}

function verifyPassword() {
  const input = parseInt(document.getElementById('password-input').value);
  if (input === state.correctAnswer) {
    closeModal('password');
    showModal('parent');
  } else {
    alert('다시 한번 계산해볼까요?');
  }
}

function addWord() {
  const input = document.getElementById('new-word');
  const word = input.value.trim();

  if (word && !state.words.includes(word)) {
    state.words.push(word);
    input.value = '';
    renderWordList();
    saveData();
  }
}

function deleteWord(index) {
  // Prevent deleting if < 4 words left to ensure game has choices
  if (state.words.length <= 4) {
    alert('게임을 위해 최소 4개의 단어가 필요합니다!');
    return;
  }
  state.words.splice(index, 1);
  renderWordList();
  saveData();
}

function renderWordList() {
  const list = document.getElementById('word-list');
  list.innerHTML = '';

  state.words.forEach((word, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${word}</span>
      <button class="delete-btn" data-index="${index}">삭제</button>
    `;
    list.appendChild(li);
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      deleteWord(e.target.dataset.index);
    });
  });
}

function saveData() {
  localStorage.setItem('yoonu-words', JSON.stringify(state.words));
  localStorage.setItem('yoonu-stars', state.stars.toString());
}

init();
