const state = {
  streak: 3,
  nextSession: 'Tuesday · 4:00 PM',
  todayFocus: 'Grounding and sleep routine',
  checkIns: [],
  tonight: [
    {
      title: '10-min evening wind-down',
      tag: 'Sleep hygiene',
      detail: 'Dim lights, stretch, silence notifications, and run a 4-7-8 cycle before bed.'
    },
    {
      title: 'Capture 3 small wins',
      tag: 'Reflection',
      detail: 'Note moments of calm or progress to share in session.'
    },
    {
      title: 'Micro-joy check',
      tag: 'Mood lift',
      detail: 'Walk, drink water, and text one supportive friend.'
    }
  ],
  nextSessionPrep: [
    {
      title: 'Bring one obstacle',
      helper: 'Write down a friction you want to process.'
    },
    {
      title: 'Track a trigger',
      helper: 'Add one example of when stress spiked.'
    },
    {
      title: 'Celebrate a win',
      helper: 'Capture something that surprised you—in a good way.'
    }
  ]
};

const storageKey = 'between-sessions-checkins';

const formatTime = (date) =>
  date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

const loadCheckIns = () => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((entry) => ({
      ...entry,
      createdAt: new Date(entry.createdAt)
    }));
  } catch (error) {
    console.warn('Unable to load check-ins', error);
    return [];
  }
};

const saveCheckIns = (entries) => {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify(entries.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString()
      })))
    );
  } catch (error) {
    console.warn('Unable to save check-ins', error);
  }
};

const hydrateState = () => {
  const defaults = [
    {
      mood: 6,
      note: 'Energy stabilized after sleep reset. Breathing helped before bed.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20),
      tag: 'Sleep'
    },
    {
      mood: 5,
      note: 'Noticed tension before meetings; grounding in car worked 2/3 times.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 44),
      tag: 'Work'
    }
  ];

  const stored = loadCheckIns();
  state.checkIns = stored.length ? stored : defaults;
};

const moodCopy = (score) => {
  if (score >= 8) return 'Uplifted';
  if (score >= 6) return 'Steady';
  if (score >= 4) return 'Processing';
  return 'Tender';
};

const moodColor = (score) => {
  if (score >= 8) return 'pill--focus';
  if (score >= 6) return 'pill--calm';
  if (score >= 4) return 'pill--active';
  return '';
};

const renderPlan = () => {
  const tonightList = document.getElementById('tonightList');
  tonightList.innerHTML = '';

  state.tonight.forEach((item) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <p class="panel__title">${item.title}</p>
        <p class="caption">${item.detail}</p>
      </div>
      <span class="tag">${item.tag}</span>
    `;
    tonightList.appendChild(li);
  });

  const prepList = document.getElementById('sessionPrep');
  prepList.innerHTML = '';
  state.nextSessionPrep.forEach((item) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <p class="panel__title">${item.title}</p>
        <p class="caption">${item.helper}</p>
      </div>
      <span class="tag">Prep</span>
    `;
    prepList.appendChild(li);
  });
};

const renderTimeline = () => {
  const timeline = document.getElementById('timeline');
  timeline.innerHTML = '';

  state.checkIns
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach((entry) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="badge">
          <strong>${moodCopy(entry.mood)}</strong>
          <span>·</span>
          <span>${entry.mood}/10</span>
        </div>
        <p>${entry.note || 'Check-in saved without note.'}</p>
        <time datetime="${entry.createdAt.toISOString()}">${formatTime(entry.createdAt)}</time>
      `;
      timeline.appendChild(li);
    });

  const progressSummary = document.getElementById('progressSummary');
  progressSummary.textContent = `${state.checkIns.length} logged`;

  const last = state.checkIns[0];
  if (last) {
    document.getElementById('moodBadge').textContent = moodCopy(last.mood);
    document
      .getElementById('moodBadge')
      .setAttribute('class', `pill ${moodColor(last.mood)}`.trim());
  }
};

const renderHighlights = () => {
  document.getElementById('nextSession').textContent = state.nextSession;
  document.getElementById('todayFocus').textContent = state.todayFocus;
  document.getElementById('streak').textContent = `${state.streak} days checking in`;
};

const renderChecklist = () => {
  const checklist = document.getElementById('prepChecklist');
  checklist.innerHTML = '';

  const steps = [
    { id: 'review', label: 'Review last session notes', detail: 'Re-read insights and highlight questions.' },
    { id: 'collect', label: 'Collect one story', detail: 'Pick a specific example to unpack.' },
    { id: 'notice', label: 'Notice one body cue', detail: 'Where did you feel stress? Note it.' }
  ];

  steps.forEach((step) => {
    const label = document.createElement('label');
    label.innerHTML = `
      <div class="stack">
        <div style="display:flex; align-items:center; gap:10px;">
          <input type="checkbox" data-step="${step.id}" />
          <div>
            <strong>${step.label}</strong>
            <small>${step.detail}</small>
          </div>
        </div>
      </div>
    `;
    checklist.appendChild(label);
  });

  const status = document.getElementById('prepStatus');
  const updateStatus = () => {
    const inputs = Array.from(checklist.querySelectorAll('input[type="checkbox"]'));
    const completed = inputs.filter((input) => input.checked).length;
    const label = completed === inputs.length ? 'Ready' : `${completed}/${inputs.length} ready`;
    status.textContent = label;
  };

  checklist.addEventListener('change', updateStatus);
  updateStatus();
};

const renderQuickActions = () => {
  const actions = [
    { label: '2-min box breathing', detail: 'Calm body before a call', action: 'breathing' },
    { label: 'Ground in 5 senses', detail: 'Name what you see, hear, feel, smell, taste', action: 'grounding' },
    { label: 'Micro-step toward goal', detail: 'Send the email, write one sentence', action: 'micro' }
  ];

  const container = document.getElementById('quickActions');
  container.innerHTML = '';

  actions.forEach((item) => {
    const button = document.createElement('button');
    button.className = 'secondary';
    button.innerHTML = `
      <span>${item.label}</span>
      <small>${item.detail}</small>
    `;

    button.addEventListener('click', () => {
      const note = `Started: ${item.label}`;
      state.checkIns.unshift({ mood: 6, note, createdAt: new Date(), tag: item.action });
      saveCheckIns(state.checkIns);
      renderTimeline();
    });

    container.appendChild(button);
  });
};

const renderResources = () => {
  const resources = [
    {
      title: 'Grounding audio (5 min)',
      detail: 'Follow a voice prompt to settle before sleep.',
      tag: 'Audio'
    },
    {
      title: 'Session prep worksheet',
      detail: 'One-page template for next session talking points.',
      tag: 'PDF'
    },
    {
      title: 'Micro-action menu',
      detail: 'Pick a 2-minute win when energy is low.',
      tag: 'List'
    }
  ];

  const container = document.getElementById('resourceList');
  container.innerHTML = '';

  resources.forEach((resource) => {
    const article = document.createElement('article');
    article.innerHTML = `
      <div class="meta">
        <span class="badge">${resource.tag}</span>
        <strong>${resource.title}</strong>
      </div>
      <p class="caption">${resource.detail}</p>
      <button class="ghost">Open</button>
    `;
    container.appendChild(article);
  });
};

const attachCheckInForm = () => {
  const form = document.getElementById('checkinForm');
  const moodInput = document.getElementById('moodInput');
  const moodValue = document.getElementById('moodValue');
  const noteInput = document.getElementById('noteInput');
  const addMicroAction = document.getElementById('addMicroAction');

  moodInput.addEventListener('input', () => {
    moodValue.textContent = moodInput.value;
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const mood = Number(moodInput.value);
    const note = noteInput.value.trim();
    state.checkIns.unshift({ mood, note, createdAt: new Date(), tag: 'manual' });
    saveCheckIns(state.checkIns);
    renderTimeline();
    noteInput.value = '';
    moodValue.textContent = moodInput.value;
  });

  addMicroAction.addEventListener('click', () => {
    const ideas = [
      'Text one support person your focus today.',
      'Drink water and stand for 2 minutes.',
      'Pick a song that calms you and press play.'
    ];
    const suggestion = ideas[Math.floor(Math.random() * ideas.length)];
    state.tonight.unshift({
      title: 'New micro-action',
      tag: 'Quick win',
      detail: suggestion
    });
    renderPlan();
  });
};

const setupBreathing = () => {
  const button = document.getElementById('breathToggle');
  const instruction = document.getElementById('breathInstruction');
  const status = document.getElementById('breathStatus');
  const circle = document.getElementById('breathCircle');

  const phases = [
    { label: 'Inhale', duration: 4, tip: 'Breathe in through your nose.' },
    { label: 'Hold', duration: 7, tip: 'Relax shoulders; hold gently.' },
    { label: 'Exhale', duration: 8, tip: 'Release slowly through your mouth.' }
  ];

  let timer = null;
  let phaseIndex = 0;
  let remaining = phases[0].duration;

  const stop = () => {
    clearInterval(timer);
    timer = null;
    instruction.textContent = 'Press start to begin a calming cycle.';
    button.textContent = 'Start';
    status.textContent = 'Ready';
    status.className = 'pill pill--calm';
    circle.classList.remove('is-active');
  };

  const tick = () => {
    const phase = phases[phaseIndex];
    instruction.textContent = `${phase.label} · ${remaining}s · ${phase.tip}`;
    circle.classList.add('is-active');

    remaining -= 1;
    if (remaining < 0) {
      phaseIndex = (phaseIndex + 1) % phases.length;
      remaining = phases[phaseIndex].duration;
    }
  };

  const start = () => {
    phaseIndex = 0;
    remaining = phases[0].duration;
    status.textContent = 'In progress';
    status.className = 'pill pill--active';
    button.textContent = 'Pause';
    tick();
    timer = setInterval(tick, 1000);
  };

  button.addEventListener('click', () => {
    if (timer) {
      stop();
    } else {
      start();
    }
  });

  document.getElementById('startBreathing').addEventListener('click', start);
};

const wireNav = () => {
  const scrollTo = (selector) => {
    document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  document.getElementById('openToday').addEventListener('click', () => scrollTo('#tonightList'));
  document.getElementById('openWeekly').addEventListener('click', () => scrollTo('#timeline'));
  document.getElementById('startQuick').addEventListener('click', () => scrollTo('#quickActions'));
  document.getElementById('startCheckIn').addEventListener('click', () => scrollTo('#checkinForm'));
};

const init = () => {
  hydrateState();
  renderPlan();
  renderTimeline();
  renderHighlights();
  renderChecklist();
  renderQuickActions();
  renderResources();
  attachCheckInForm();
  setupBreathing();
  wireNav();
};

init();