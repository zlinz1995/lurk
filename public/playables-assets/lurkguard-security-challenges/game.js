(() => {
  const sdk = window.LurkPlayables || { init() {}, ready() {}, start() {}, score() {}, gameOver() {}, on() {} };

  const questions = [
    {
      category: "Phishing recognition",
      short: "Phishing",
      question: "A message says your Lurk account will be closed in one hour.",
      scenario: "It includes a shortened link and asks you to sign in immediately. The sender name looks right, but the address is unfamiliar. What is the safest first move?",
      answers: [
        "Open the link, but only if the page uses HTTPS.",
        "Reply and ask the sender whether the message is real.",
        "Open Lurk from your saved app or bookmark and check account notices there.",
        "Forward the message to a friend and use their opinion."
      ],
      correct: 2,
      explanation: "Urgency, a shortened link, and an unfamiliar sender are warning signs. Navigate through a trusted app or saved address instead of using the message link."
    },
    {
      category: "Account recovery planning",
      short: "Recovery",
      question: "Which recovery setup is most resilient if your phone is lost?",
      scenario: "Choose a plan that still lets you recover your account without depending on the missing phone.",
      answers: [
        "Keep recovery codes only in a screenshot on the phone.",
        "Store backup codes offline and register an independent passkey or security key.",
        "Use the same password for email and Lurk so it is easier to remember.",
        "Send your password to yourself in a text message."
      ],
      correct: 1,
      explanation: "Offline recovery codes plus an independent authenticator create separate recovery paths. A backup that exists only on the lost device cannot help."
    },
    {
      category: "Privacy decision",
      short: "Privacy",
      question: "A photo app requests contacts, precise location, microphone, and call logs.",
      scenario: "You only want to crop a picture already on your phone. What should you do?",
      answers: [
        "Allow everything because installed apps are already trusted.",
        "Grant only the photo access needed for the selected image and deny unrelated permissions.",
        "Allow the permissions temporarily and assume the app will remove stored data later.",
        "Turn off the screen lock before opening the photo."
      ],
      correct: 1,
      explanation: "Use least privilege: grant only what the immediate feature needs. Contacts, location, microphone, and call logs are unrelated to cropping one selected photo."
    },
    {
      category: "Device security",
      short: "Device",
      question: "Your phone reports that a critical system update is ready.",
      scenario: "You are on public Wi-Fi and need to keep working. Which response best limits risk?",
      answers: [
        "Ignore updates permanently because they can change settings.",
        "Install an update offered by a pop-up ad to save time.",
        "Confirm the update in Android Settings, back up important data, and install it promptly on trusted power and networking.",
        "Disable the screen lock until the update is complete."
      ],
      correct: 2,
      explanation: "Verify updates through system settings, protect important data, and apply security fixes promptly. Ads and unrelated pop-ups are not trusted update sources."
    },
    {
      category: "Incident response",
      short: "Response",
      question: "You approved a sign-in prompt that you did not initiate.",
      scenario: "What is the best immediate response sequence?",
      answers: [
        "Wait a day to see whether anything changes.",
        "Secure the account from a trusted device, revoke active sessions, change the password, and review recovery methods and activity.",
        "Delete the notification and clear browser history.",
        "Post the account password in a private room so someone can check it."
      ],
      correct: 1,
      explanation: "Treat the approval as a possible compromise. Use a trusted device to contain access, replace credentials, inspect recovery settings, and review account activity."
    }
  ];

  const $ = (id) => document.getElementById(id);
  const els = {
    intro: $("intro-panel"), questionPanel: $("question-panel"), result: $("result-panel"),
    start: $("start-button"), restart: $("restart-button"), next: $("next-button"),
    category: $("category"), question: $("question"), scenario: $("scenario"), answers: $("answers"),
    feedback: $("feedback"), feedbackIcon: $("feedback-icon"), feedbackTitle: $("feedback-title"), feedbackCopy: $("feedback-copy"),
    score: $("score"), progressLabel: $("progress-label"), progressBar: $("progress-bar"), categoryTrack: $("category-track"),
    selectionHelp: $("selection-help"), bestScore: $("best-score"), finalScore: $("final-score"), resultTitle: $("result-title"),
    resultMessage: $("result-message"), resultBreakdown: $("result-breakdown")
  };

  const state = { index: 0, score: 0, selected: null, checked: false, results: [] };
  const key = "lurkguard-security-challenge-best";

  const readBest = () => {
    try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; }
  };

  const writeBest = (value) => {
    try { localStorage.setItem(key, String(value)); } catch {}
  };

  const renderTrack = () => {
    els.categoryTrack.innerHTML = questions.map((_, index) => {
      const cls = index < state.index ? "done" : index === state.index ? "current" : "";
      return `<span class="category-dot ${cls}"></span>`;
    }).join("");
  };

  const selectAnswer = (index) => {
    if (state.checked) return;
    state.selected = index;
    [...els.answers.children].forEach((button, buttonIndex) => {
      button.classList.toggle("selected", buttonIndex === index);
      button.setAttribute("aria-checked", buttonIndex === index ? "true" : "false");
    });
    els.next.disabled = false;
    els.selectionHelp.textContent = "Ready to check your decision.";
  };

  const renderQuestion = () => {
    const item = questions[state.index];
    state.selected = null;
    state.checked = false;
    els.category.textContent = item.category;
    els.question.textContent = item.question;
    els.scenario.textContent = item.scenario;
    els.answers.innerHTML = "";
    item.answers.forEach((answer, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "answer";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", "false");
      button.innerHTML = `<span class="answer-index">${String.fromCharCode(65 + index)}</span><span class="answer-copy"></span>`;
      button.querySelector(".answer-copy").textContent = answer;
      button.addEventListener("click", () => selectAnswer(index));
      els.answers.appendChild(button);
    });
    els.feedback.hidden = true;
    els.feedback.className = "feedback";
    els.next.textContent = "Check answer";
    els.next.disabled = true;
    els.selectionHelp.textContent = "Choose the safest response.";
    els.progressLabel.textContent = `Challenge ${state.index + 1} of ${questions.length}`;
    els.progressBar.style.width = `${(state.index / questions.length) * 100}%`;
    renderTrack();
  };

  const checkAnswer = () => {
    if (state.selected === null) return;
    const item = questions[state.index];
    const correct = state.selected === item.correct;
    state.checked = true;
    if (correct) state.score += 20;
    state.results.push({ short: item.short, correct });
    [...els.answers.children].forEach((button, index) => {
      button.disabled = true;
      if (index === item.correct) button.classList.add("correct");
      if (index === state.selected && !correct) button.classList.add("wrong");
    });
    els.feedback.hidden = false;
    els.feedback.classList.add(correct ? "good" : "bad");
    els.feedbackIcon.textContent = correct ? "✓" : "!";
    els.feedbackTitle.textContent = correct ? "Good decision" : "A safer choice is highlighted";
    els.feedbackCopy.textContent = item.explanation;
    els.score.textContent = state.score;
    els.selectionHelp.textContent = correct ? "+20 points" : "Review the explanation before continuing.";
    els.next.textContent = state.index === questions.length - 1 ? "See results" : "Next challenge";
    sdk.score({ value: state.score, completed: state.index + 1, total: questions.length });
  };

  const showResults = () => {
    els.questionPanel.hidden = true;
    els.result.hidden = false;
    els.progressBar.style.width = "100%";
    els.progressLabel.textContent = "Complete";
    state.index = questions.length;
    renderTrack();
    els.finalScore.textContent = state.score;
    const best = Math.max(readBest(), state.score);
    writeBest(best);
    els.bestScore.textContent = `Best: ${best}`;
    if (state.score === 100) {
      els.resultTitle.textContent = "Excellent security judgment.";
      els.resultMessage.textContent = "You chose the strongest response in every scenario. Replay later to keep the decisions familiar.";
    } else if (state.score >= 60) {
      els.resultTitle.textContent = "Strong foundation.";
      els.resultMessage.textContent = "You handled most scenarios well. Review the missed topics and try again when you are ready.";
    } else {
      els.resultTitle.textContent = "Useful practice complete.";
      els.resultMessage.textContent = "The explanations are the training. Try another pass and focus on trusted paths, independent recovery, and fast containment.";
    }
    els.resultBreakdown.innerHTML = state.results.map((result) => `<span>${result.correct ? "✓" : "○"} ${result.short}</span>`).join("");
    sdk.gameOver({ score: state.score, total: 100, completedAt: Date.now() });
  };

  const next = () => {
    if (!state.checked) { checkAnswer(); return; }
    if (state.index >= questions.length - 1) { showResults(); return; }
    state.index += 1;
    renderQuestion();
  };

  const start = () => {
    state.index = 0; state.score = 0; state.selected = null; state.checked = false; state.results = [];
    els.score.textContent = "0";
    els.bestScore.textContent = readBest() ? `Best: ${readBest()}` : "Best: —";
    els.intro.hidden = true;
    els.result.hidden = true;
    els.questionPanel.hidden = false;
    renderQuestion();
    sdk.start({ challengeCount: questions.length });
  };

  els.start.addEventListener("click", start);
  els.restart.addEventListener("click", start);
  els.next.addEventListener("click", next);
  sdk.on("pause", () => document.body.classList.add("is-paused"));
  sdk.on("resume", () => document.body.classList.remove("is-paused"));
  sdk.init({ id: "lurkguard-security-challenges", title: "LurkGuard Security Challenges" });
  sdk.ready({ challengeCount: questions.length });
  els.bestScore.textContent = readBest() ? `Best: ${readBest()}` : "Best: —";
  renderTrack();
})();
