(() => {
  "use strict";

  const AGENT_KEY = "partnerCertificationLab.agentId";
  const REVIEW_KEY = "partnerCertificationLab.review";
  const CONTEXT_KEY = "partnerCertificationLab.attemptContext";
  const criteria = [
    ["customer_discovery", "Customer discovery"],
    ["business_value", "Business value"],
    ["technical_accuracy", "Technical accuracy"],
    ["next_step", "Concrete next step"]
  ];
  const decisionLabels = {
    pass: "Pass",
    revise: "Revise",
    needs_review: "Needs review"
  };
  const phases = ["configured", "in-progress", "evaluation", "review"];

  const elements = {
    agentForm: document.getElementById("agent-form"),
    agentInput: document.getElementById("agent-id"),
    agentError: document.getElementById("agent-error"),
    connectionPanel: document.getElementById("connection-panel"),
    readyPanel: document.getElementById("ready-panel"),
    evaluationStage: document.getElementById("evaluation-stage"),
    evaluationOpened: document.getElementById("evaluation-opened"),
    continueReview: document.getElementById("continue-review"),
    reviewStage: document.getElementById("review-stage"),
    reviewContext: document.getElementById("review-context"),
    reviewTitle: document.getElementById("review-title"),
    reviewInstruction: document.querySelector(".review-instruction"),
    criteriaPanel: document.getElementById("criteria-panel"),
    reviewPanel: document.getElementById("review-panel"),
    reviewForm: document.getElementById("review-form"),
    reviewError: document.getElementById("review-error"),
    notes: document.getElementById("reviewer-notes"),
    overall: document.getElementById("overall-decision"),
    confirmation: document.getElementById("human-confirmation"),
    printButton: document.getElementById("print-record"),
    printSheet: document.getElementById("print-record-sheet"),
    printContent: document.getElementById("print-record-content"),
    printFooter: document.getElementById("print-record-footer"),
    saveStatus: document.getElementById("save-status"),
    savedDecision: document.getElementById("saved-decision"),
    widgetMount: document.getElementById("widget-mount"),
    widgetRecoveryStatus: document.getElementById("widget-recovery-status"),
    reconnectWidget: document.getElementById("reconnect-widget"),
    status: document.getElementById("attempt-status"),
    stageFootnote: document.getElementById("stage-footnote"),
    announcement: document.getElementById("state-announcement"),
    openReview: document.getElementById("open-review"),
    finishAttempt: document.getElementById("finish-attempt"),
    returnConversation: document.getElementById("return-conversation"),
    inProgressActions: document.getElementById("in-progress-actions"),
    restart: document.getElementById("restart-lab"),
    reset: document.getElementById("reset-lab")
  };

  let state = "disconnected";
  let agentId = "";
  let currentContext = null;
  let savedReview = null;

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function storageRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      return false;
    }
    return true;
  }

  function isValidAgentId(value) {
    const looksLikeApiKey = /^sk_/i.test(value) || /^[a-f0-9]{32,}$/i.test(value);
    return !looksLikeApiKey && /^[A-Za-z0-9_-]{6,128}$/.test(value);
  }

  function createAttemptId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `lab_${window.crypto.randomUUID()}`;
    }
    return `lab_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function newContext(mode) {
    return {
      version: 2,
      mode,
      localAttemptId: createAttemptId(),
      callStarted: false,
      evaluationOpened: false,
      phase: mode === "attempt" ? "configured" : "review"
    };
  }

  function hasValidContextFields(value) {
    return Boolean(
      value &&
      value.version === 2 &&
      ["attempt", "practice"].includes(value.mode) &&
      typeof value.localAttemptId === "string" &&
      value.localAttemptId.length > 0 &&
      value.localAttemptId.length <= 100 &&
      typeof value.callStarted === "boolean" &&
      typeof value.evaluationOpened === "boolean" &&
      phases.includes(value.phase) &&
      (value.mode === "attempt" || (!value.callStarted && !value.evaluationOpened))
    );
  }

  function hasValidDecision(value) {
    return Boolean(
      value &&
      value.confirmed === true &&
      criteria.every(([id]) => Object.prototype.hasOwnProperty.call(decisionLabels, value.scores && value.scores[id])) &&
      Object.prototype.hasOwnProperty.call(decisionLabels, value.overall) &&
      typeof value.notes === "string" &&
      typeof value.reviewedAt === "string"
    );
  }

  function loadJson(key) {
    const raw = storageGet(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function loadReview() {
    const parsed = loadJson(REVIEW_KEY);
    if (!parsed || !hasValidDecision(parsed)) return null;
    if (hasValidContextFields(parsed) && parsed.phase === "review") return parsed;
    if (parsed.version === 1) {
      return {
        ...newContext("practice"),
        scores: parsed.scores,
        notes: parsed.notes,
        overall: parsed.overall,
        confirmed: true,
        reviewedAt: parsed.reviewedAt
      };
    }
    return null;
  }

  function loadContext() {
    const parsed = loadJson(CONTEXT_KEY);
    return hasValidContextFields(parsed) ? parsed : null;
  }

  function persistContext() {
    if (!currentContext) return true;
    return storageSet(CONTEXT_KEY, JSON.stringify(currentContext));
  }

  function contextFromReview(review) {
    return {
      version: 2,
      mode: review.mode,
      localAttemptId: review.localAttemptId,
      callStarted: review.callStarted,
      evaluationOpened: review.evaluationOpened,
      phase: "review"
    };
  }

  function setStatus(nextState) {
    state = nextState;
    const isPractice = currentContext && currentContext.mode === "practice";
    const labels = {
      disconnected: "Disconnected",
      configured: "Configured",
      "in-progress": "In progress",
      evaluation: "Evaluation",
      review: isPractice ? "Practice review" : "Review"
    };
    const activeStep = {
      disconnected: "brief",
      configured: "voice",
      "in-progress": "voice",
      evaluation: "evaluation",
      review: "review"
    }[nextState];
    const complete = {
      brief: nextState !== "disconnected" && !(nextState === "review" && isPractice),
      voice: nextState === "evaluation" || (nextState === "review" && !isPractice),
      evaluation: nextState === "review" && !isPractice
    };
    document.querySelectorAll("[data-loop]").forEach((step) => {
      step.classList.toggle("is-active", step.dataset.loop === activeStep);
      step.classList.toggle("is-complete", Boolean(complete[step.dataset.loop]));
      if (step.dataset.loop === activeStep) {
        step.setAttribute("aria-current", "step");
      } else {
        step.removeAttribute("aria-current");
      }
    });
    elements.status.dataset.state = nextState;
    elements.status.lastChild.textContent = labels[nextState];
    elements.announcement.textContent = `Lab status: ${labels[nextState]}`;
  }

  function createWidget() {
    elements.widgetMount.replaceChildren();
    if (!agentId) return;
    const widget = document.createElement("elevenlabs-convai");
    widget.setAttribute("agent-id", agentId);
    widget.setAttribute("variant", "expanded");
    widget.setAttribute("dismissible", "false");
    widget.addEventListener("elevenlabs-convai:call", () => {
      if (!currentContext || currentContext.mode !== "attempt") {
        currentContext = newContext("attempt");
      }
      currentContext.callStarted = true;
      currentContext.phase = "in-progress";
      persistContext();
      showConversation("in-progress");
    });
    elements.widgetMount.appendChild(widget);
  }

  function showConversation(nextState) {
    const activeState = nextState || (agentId ? "configured" : "disconnected");
    setStatus(activeState);
    elements.connectionPanel.hidden = activeState !== "disconnected";
    elements.readyPanel.hidden = !["configured", "in-progress"].includes(activeState);
    elements.evaluationStage.hidden = true;
    elements.reviewStage.hidden = true;
    elements.criteriaPanel.hidden = false;
    elements.reviewPanel.hidden = true;
    elements.inProgressActions.hidden = activeState !== "in-progress";
    elements.restart.disabled = !agentId && !currentContext && !savedReview;

    if (activeState === "disconnected") {
      elements.stageFootnote.textContent = "No conversation has started.";
    } else if (activeState === "configured") {
      elements.stageFootnote.textContent = "Agent ID configured locally. Widget loading and live readiness are not verified.";
    } else if (activeState === "in-progress") {
      elements.stageFootnote.textContent = "A voice call started. End it in the widget before continuing to evaluation.";
    }
  }

  function updateEvaluationGate() {
    const opened = Boolean(currentContext && currentContext.evaluationOpened);
    elements.continueReview.disabled = !opened;
    elements.evaluationOpened.textContent = opened
      ? "History opened for this local attempt. The portal cannot confirm whether analysis finished or what it contains."
      : "Open ElevenLabs history to unlock FDE review for this attempt. Opening history does not verify evaluation results.";
  }

  function showEvaluation() {
    if (!currentContext || currentContext.mode !== "attempt" || !currentContext.callStarted) {
      showConversation();
      return;
    }
    currentContext.phase = "evaluation";
    persistContext();
    setStatus("evaluation");
    elements.connectionPanel.hidden = true;
    elements.readyPanel.hidden = true;
    elements.evaluationStage.hidden = false;
    elements.reviewStage.hidden = true;
    elements.criteriaPanel.hidden = false;
    elements.reviewPanel.hidden = true;
    elements.inProgressActions.hidden = true;
    elements.restart.disabled = false;
    elements.stageFootnote.textContent = `Local attempt ${currentContext.localAttemptId}. Native results remain in ElevenLabs.`;
    updateEvaluationGate();
  }

  function renderReviewMode() {
    const practice = currentContext.mode === "practice";
    elements.reviewTitle.textContent = practice ? "Practice FDE review" : "Human review";
    elements.reviewInstruction.textContent = practice
      ? "Practice the scoring workflow without voice or native evaluation evidence. This cannot produce a completion record."
      : "Compare the transcript and native evaluation with the rubric. Unknown means the evidence is insufficient, not a pass.";
    elements.reviewContext.textContent = practice
      ? "Practice mode only. No voice conversation or automated evaluation is attached, and this review cannot produce a completion record."
      : "Compare the ElevenLabs transcript and native evaluation with the rubric. Opening history was required, but the portal cannot verify its contents or completion.";
    elements.stageFootnote.textContent = practice
      ? `Practice review ${currentContext.localAttemptId}. No conversation evidence is attached.`
      : `Attempt review ${currentContext.localAttemptId}. Native evidence remains in ElevenLabs.`;
  }

  function showReview() {
    if (!currentContext) {
      startPracticeReview();
      return;
    }
    if (currentContext.mode === "attempt" && (!currentContext.callStarted || !currentContext.evaluationOpened)) {
      showEvaluation();
      return;
    }
    currentContext.phase = "review";
    persistContext();
    setStatus("review");
    elements.connectionPanel.hidden = true;
    elements.readyPanel.hidden = true;
    elements.evaluationStage.hidden = true;
    elements.reviewStage.hidden = false;
    elements.criteriaPanel.hidden = true;
    elements.reviewPanel.hidden = false;
    elements.inProgressActions.hidden = true;
    elements.restart.disabled = false;
    renderReviewMode();
    renderSavedDecision();
    if (window.matchMedia("(max-width: 800px)").matches) {
      elements.reviewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function startPracticeReview() {
    if (!savedReview || savedReview.mode !== "practice") {
      savedReview = null;
      populateReview(null);
      preparePrintRecord();
    }
    currentContext = savedReview ? contextFromReview(savedReview) : newContext("practice");
    persistContext();
    showReview();
  }

  function renderSavedDecision() {
    if (!savedReview) {
      elements.savedDecision.hidden = true;
      elements.savedDecision.replaceChildren();
      return;
    }
    elements.savedDecision.hidden = false;
    const practice = savedReview.mode === "practice";
    const decision = document.createElement("strong");
    decision.textContent = `${practice ? "Saved practice decision" : "Saved decision"}: ${decisionLabels[savedReview.overall]}`;
    const date = document.createElement("span");
    date.textContent = `${formatDate(savedReview.reviewedAt)}. ${practice ? "Practice only, not a completion record." : "Prototype record only."}`;
    elements.savedDecision.replaceChildren(decision, date);
  }

  function populateReview(review) {
    elements.reviewForm.reset();
    clearReviewErrors();
    if (!review) return;
    criteria.forEach(([id]) => {
      const input = elements.reviewForm.querySelector(`input[name="${id}"][value="${review.scores[id]}"]`);
      if (input) input.checked = true;
    });
    elements.notes.value = review.notes;
    elements.overall.value = review.overall;
    elements.confirmation.checked = review.confirmed;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function preparePrintRecord() {
    if (!savedReview) {
      elements.printSheet.hidden = true;
      elements.printButton.disabled = true;
      return;
    }
    const rows = criteria.map(([id, label]) => (
      `<tr><th scope="row">${label}</th><td>${decisionLabels[savedReview.scores[id]]}</td></tr>`
    )).join("");
    const practice = savedReview.mode === "practice";
    const completedAttempt = !practice && savedReview.callStarted && savedReview.evaluationOpened && savedReview.overall === "pass";
    const recordTitle = practice ? "Practice FDE review record" : completedAttempt ? "Prototype completion record" : "Prototype review record";
    const modeLabel = practice ? "Practice, no voice or evaluation evidence" : "Attempt, ElevenLabs history opened";
    elements.printContent.innerHTML = `
      <h2>${recordTitle}</h2>
      <p>Reviewed: ${escapeHtml(formatDate(savedReview.reviewedAt))}</p>
      <p>Mode: ${modeLabel}<br>Local attempt ID: ${escapeHtml(savedReview.localAttemptId)}</p>
      <div class="record-decision">${practice ? "Practice decision" : "Overall decision"}: ${decisionLabels[savedReview.overall]}</div>
      <table><tbody>${rows}</tbody></table>
      <h2>Reviewer notes</h2>
      <p>${escapeHtml(savedReview.notes || "No reviewer notes supplied.").replace(/\n/g, "<br>")}</p>
      <p>Human confirmation: The reviewer explicitly confirmed this decision.</p>
    `;
    elements.printFooter.textContent = practice
      ? "Independent project and fictional scenario. This practice record has no voice or automated evaluation evidence. It is not a completion record, an official ElevenLabs certification, an accredited credential, or evidence of production deployment."
      : "Independent project and fictional scenario. This prototype record is not an official ElevenLabs certification, an accredited credential, or evidence of production deployment. Automated evaluation supplied evidence only. Opening history did not verify its contents. The decision above was confirmed by a human reviewer.";
    elements.printSheet.hidden = false;
    elements.printButton.disabled = false;
  }

  function clearReviewErrors() {
    elements.reviewError.hidden = true;
    elements.reviewForm.querySelectorAll("[aria-invalid]").forEach((control) => control.removeAttribute("aria-invalid"));
  }

  function markReviewChanged() {
    savedReview = null;
    elements.saveStatus.textContent = "Unsaved changes";
    clearReviewErrors();
    preparePrintRecord();
    renderSavedDecision();
  }

  function validateReview() {
    const missingCriterion = criteria.find(([id]) => !elements.reviewForm.querySelector(`input[name="${id}"]:checked`));
    if (missingCriterion) {
      const fieldset = elements.reviewForm.querySelector(`[data-criterion="${missingCriterion[0]}"]`);
      return {
        message: `Choose a rating for ${missingCriterion[1]}.`,
        invalid: fieldset,
        target: fieldset.querySelector("input")
      };
    }
    if (!elements.overall.value) {
      return { message: "Choose an overall human decision.", invalid: elements.overall, target: elements.overall };
    }
    if (!elements.confirmation.checked) {
      return { message: "Confirm that a human reviewed the available evidence.", invalid: elements.confirmation, target: elements.confirmation };
    }
    return null;
  }

  function hasReviewInput() {
    return Boolean(
      elements.reviewForm.querySelector("input[type=radio]:checked") ||
      elements.notes.value.trim() ||
      elements.overall.value ||
      elements.confirmation.checked
    );
  }

  function hasLocalWork() {
    return Boolean(agentId || currentContext || savedReview || hasReviewInput());
  }

  elements.agentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = elements.agentInput.value.trim();
    if (!isValidAgentId(value)) {
      elements.agentError.textContent = "Enter a valid agent ID using 6 to 128 letters, numbers, underscores, or hyphens. Do not enter an API key.";
      elements.agentError.hidden = false;
      elements.agentInput.setAttribute("aria-invalid", "true");
      elements.agentInput.focus();
      showConversation("disconnected");
      return;
    }

    agentId = value;
    currentContext = newContext("attempt");
    savedReview = null;
    storageRemove(REVIEW_KEY);
    populateReview(null);
    preparePrintRecord();
    elements.agentInput.value = value;
    elements.agentInput.removeAttribute("aria-invalid");
    elements.agentError.hidden = true;
    elements.widgetRecoveryStatus.textContent = "";
    const agentStored = storageSet(AGENT_KEY, value);
    const contextStored = persistContext();
    createWidget();
    showConversation("configured");
    if (!agentStored || !contextStored) {
      elements.stageFootnote.textContent = "Configured for this tab. Browser storage is unavailable.";
    }
  });

  elements.agentInput.addEventListener("input", () => {
    elements.agentError.hidden = true;
    elements.agentInput.removeAttribute("aria-invalid");
  });

  elements.reconnectWidget.addEventListener("click", () => {
    if (currentContext && currentContext.callStarted) {
      const proceed = window.confirm("End any active call before reconnecting. Reinserting the widget cannot recover an interrupted conversation. Continue?");
      if (!proceed) return;
    }
    createWidget();
    elements.widgetRecoveryStatus.textContent = "Widget reinserted. Live readiness is not verified. Start a new call if needed.";
  });

  elements.finishAttempt.addEventListener("click", () => {
    if (!currentContext || !currentContext.callStarted) return;
    showEvaluation();
  });

  document.querySelectorAll("[data-open-evaluation]").forEach((link) => {
    link.addEventListener("click", () => {
      if (state !== "evaluation" || !currentContext || currentContext.mode !== "attempt" || !currentContext.callStarted) return;
      currentContext.evaluationOpened = true;
      persistContext();
      updateEvaluationGate();
    });
  });

  elements.continueReview.addEventListener("click", () => {
    if (!currentContext || !currentContext.evaluationOpened) return;
    showReview();
  });

  elements.openReview.addEventListener("click", () => {
    if (currentContext && currentContext.mode === "attempt" && currentContext.callStarted) {
      if (currentContext.evaluationOpened) showReview();
      else showEvaluation();
      return;
    }
    startPracticeReview();
  });

  elements.returnConversation.addEventListener("click", () => {
    if (currentContext && currentContext.mode === "attempt" && currentContext.callStarted) {
      showEvaluation();
      return;
    }
    if (currentContext && currentContext.mode === "practice") {
      currentContext.phase = agentId ? "configured" : "review";
      persistContext();
    }
    showConversation();
  });

  elements.reviewForm.addEventListener("change", markReviewChanged);
  elements.notes.addEventListener("input", markReviewChanged);

  elements.reviewForm.addEventListener("submit", (event) => {
    event.preventDefault();
    clearReviewErrors();
    const error = validateReview();
    if (error) {
      elements.reviewError.textContent = error.message;
      elements.reviewError.hidden = false;
      error.invalid.setAttribute("aria-invalid", "true");
      elements.saveStatus.textContent = "";
      error.target.focus();
      return;
    }
    if (!currentContext || (currentContext.mode === "attempt" && (!currentContext.callStarted || !currentContext.evaluationOpened))) {
      elements.reviewError.textContent = "This attempt needs a started call and opened ElevenLabs history before review.";
      elements.reviewError.hidden = false;
      return;
    }

    const scores = {};
    criteria.forEach(([id]) => {
      scores[id] = elements.reviewForm.querySelector(`input[name="${id}"]:checked`).value;
    });
    currentContext.phase = "review";
    const review = {
      ...currentContext,
      scores,
      notes: elements.notes.value.trim(),
      overall: elements.overall.value,
      confirmed: true,
      reviewedAt: new Date().toISOString()
    };
    savedReview = review;
    const reviewStored = storageSet(REVIEW_KEY, JSON.stringify(review));
    const contextStored = persistContext();
    clearReviewErrors();
    elements.saveStatus.textContent = reviewStored && contextStored
      ? "Review saved in this browser."
      : "Review is available for printing, but browser storage is unavailable.";
    preparePrintRecord();
    renderSavedDecision();
    showReview();
  });

  elements.printButton.addEventListener("click", () => {
    if (!savedReview) return;
    preparePrintRecord();
    window.print();
  });

  elements.restart.addEventListener("click", () => {
    if (hasLocalWork() && !window.confirm("Restart clears the current local review and attempt context. ElevenLabs history is not changed. Continue?")) return;
    savedReview = null;
    storageRemove(REVIEW_KEY);
    populateReview(null);
    elements.saveStatus.textContent = "";
    preparePrintRecord();
    renderSavedDecision();
    currentContext = agentId ? newContext("attempt") : null;
    persistContext();
    createWidget();
    showConversation(agentId ? "configured" : "disconnected");
    document.getElementById("conversation-title").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  elements.reset.addEventListener("click", () => {
    if (hasLocalWork() && !window.confirm("Reset clears the agent ID, local review, and attempt context from this browser. Continue?")) return;
    agentId = "";
    currentContext = null;
    savedReview = null;
    storageRemove(AGENT_KEY);
    storageRemove(REVIEW_KEY);
    storageRemove(CONTEXT_KEY);
    elements.agentForm.reset();
    populateReview(null);
    elements.agentError.hidden = true;
    elements.saveStatus.textContent = "";
    elements.widgetRecoveryStatus.textContent = "";
    elements.agentInput.removeAttribute("aria-invalid");
    preparePrintRecord();
    renderSavedDecision();
    createWidget();
    showConversation("disconnected");
    elements.agentInput.focus();
  });

  const storedAgentId = storageGet(AGENT_KEY) || "";
  if (isValidAgentId(storedAgentId)) {
    agentId = storedAgentId;
    elements.agentInput.value = storedAgentId;
    createWidget();
  }

  savedReview = loadReview();
  currentContext = savedReview ? contextFromReview(savedReview) : loadContext();
  populateReview(savedReview);
  preparePrintRecord();

  if (savedReview) {
    persistContext();
    showReview();
  } else if (currentContext) {
    if (currentContext.phase === "review") {
      showReview();
    } else if (currentContext.phase === "evaluation" && currentContext.callStarted) {
      showEvaluation();
    } else if (currentContext.phase === "in-progress" && currentContext.callStarted) {
      showConversation("in-progress");
    } else if (agentId) {
      showConversation("configured");
    } else {
      showConversation("disconnected");
    }
  } else {
    if (agentId) {
      currentContext = newContext("attempt");
      persistContext();
    }
    showConversation();
  }
})();
