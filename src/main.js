import { dossier } from "./data/dossier.js";
import { tracks, commonHandoffCues, buyingSignalPatterns } from "./data/tracks.js";
import { verbatimResponse, inspectTranscript, compassMessage } from "./data/coaching.js";
import { createConversationController } from "./conversation.js";
import resourceManifest from "../resources/manifest.json";

const AGENT_KEY = "partnerCertificationLab.agentId";
const CONTEXT_KEY = "partnerCertificationLab.sessionContext";
const REVIEW_KEY = "partnerCertificationLab.sessionReview";
const TRACK_KEY = "partnerCertificationLab.selectedTrack";
const decisionLabels = { pass: "Pass", revise: "Revise", needs_review: "Needs review" };
const $ = id => document.getElementById(id);
const elements = Object.fromEntries([
  "workspace", "setup-panel", "session-panel", "evaluation-panel", "review-stage", "coach-content", "fde-panel",
  "agent-form", "agent-id", "agent-error", "start-session", "setup-message", "track-outcome", "session-status",
  "voice-mode", "conversation-id", "transcript", "response-coach", "coach-ready", "verbatim-script", "use-script", "response-context", "composer", "send-text",
  "session-error", "reconnect-session", "end-session", "session-timer", "time-cue", "talk-share", "ratio-fill",
  "compass-copy", "handoff-cues", "evidence-title", "track-evidence", "buying-signals", "evaluation-summary", "open-evaluation",
  "evaluation-opened", "continue-review", "review-stage-title", "review-stage-copy", "saved-decision", "return-evaluation",
  "review-form", "review-criteria", "reviewer-notes", "overall-decision", "human-confirmation", "review-error",
  "print-record", "save-status", "fde-title", "fde-outcome", "print-sheet", "print-content", "print-footer",
  "practice-review", "restart-lab", "reset-lab", "stage-note", "state-announcement"
].map(id => [id, $(id)]));

let selectedTrack = "seller";
let agentId = "";
let phase = "setup";
let context = null;
let savedReview = null;
let thread = [];
let latestMayaText = "";
let coaching = { evidence: {}, signals: {}, handoffs: {} };
let metrics = { elapsedSeconds: 0, talkSeconds: 0, listenSeconds: 0, talkShare: null, conversationId: "" };
let lastPersistSecond = -1;

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}
function storageRemove(key) {
  try { localStorage.removeItem(key); } catch { /* Storage can be unavailable. */ }
}
function loadJson(key) {
  try { return JSON.parse(storageGet(key) || "null"); } catch { return null; }
}
function createAttemptId() {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return `lab_${id}`;
}
function newContext(mode = "attempt") {
  return {
    version: 3,
    mode,
    track: selectedTrack,
    localAttemptId: createAttemptId(),
    callStarted: false,
    conversationId: "",
    sessionState: "idle",
    evaluationOpened: false,
    phase: mode === "practice" ? "review" : "configured",
    elapsedSeconds: 0,
    talkSeconds: 0,
    listenSeconds: 0,
    evidenceIds: [],
    buyingSignalIds: [],
    handoffCueIds: []
  };
}
function validContext(value) {
  return Boolean(value && value.version === 3 && ["attempt", "practice"].includes(value.mode) && tracks[value.track] && typeof value.localAttemptId === "string" && Array.isArray(value.evidenceIds) && Array.isArray(value.buyingSignalIds));
}
function hasQualifyingSession(value) {
  return Boolean(value && value.callStarted && value.conversationId && value.sessionState === "terminal" && Number(value.elapsedSeconds) >= 600);
}
function persistContext() {
  if (!context) return;
  const safe = {
    version: 3,
    mode: context.mode,
    track: context.track,
    localAttemptId: context.localAttemptId,
    callStarted: Boolean(context.callStarted),
    conversationId: String(context.conversationId || ""),
    sessionState: String(context.sessionState || "legacy_unverified"),
    evaluationOpened: Boolean(context.evaluationOpened),
    phase: context.phase,
    elapsedSeconds: Number(context.elapsedSeconds) || 0,
    talkSeconds: Number(context.talkSeconds) || 0,
    listenSeconds: Number(context.listenSeconds) || 0,
    evidenceIds: [...new Set(context.evidenceIds || [])],
    buyingSignalIds: [...new Set(context.buyingSignalIds || [])],
    handoffCueIds: [...new Set(context.handoffCueIds || [])]
  };
  context = { ...context, ...safe };
  storageSet(CONTEXT_KEY, JSON.stringify(safe));
}
function ratioText(value = metrics) {
  if (value.talkShare === null || value.talkShare === undefined) return "No voiced audio";
  const talk = Math.round(value.talkShare * 100);
  return `${talk}% talking / ${100 - talk}% listening`;
}
function formatDuration(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[character]);
}
function evidenceDefinitions(trackId = selectedTrack) {
  return tracks[trackId].evidenceGroups.flatMap(group => group.items.map(([id, label]) => ({ id, label })));
}
function signalDefinition(id) {
  return buyingSignalPatterns.find(item => item.id === id);
}

function renderDossier() {
  $("panel-dossier").innerHTML = `
    <h2>${dossier.company}</h2>
    <p class="dossier-persona">${dossier.persona}</p>
    <p class="dossier-disclaimer">${dossier.disclaimer}</p>
    ${dossier.sections.map(section => `<section class="dossier-section"><h3>${section.title}</h3><ul>${section.facts.map(fact => `<li>${fact}</li>`).join("")}</ul></section>`).join("")}
  `;
}
function renderTrack() {
  const track = tracks[selectedTrack];
  elements["track-outcome"].textContent = track.outcome;
  elements["compass-copy"].textContent = track.compass;
  elements["evidence-title"].textContent = selectedTrack === "seller" ? "Methodology evidence" : "Technical discovery evidence";
  document.querySelectorAll("[data-track]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.track === selectedTrack));
    button.disabled = Boolean(context?.callStarted || phase === "evaluation" || phase === "review");
  });
  $("panel-talk").innerHTML = `<h2>${track.label}</h2><p>${track.outcome}</p>${track.talkTrack.map(step => `<section class="talk-step"><h3>${step.title}</h3><p>${step.text}</p></section>`).join("")}`;
  const resources = resourceManifest.filter(resource => resource.track === selectedTrack);
  $("panel-resources").innerHTML = `<h2>Official resources</h2><p>Learning notes link to primary ElevenLabs sources. Capabilities and availability can change.</p>${resources.map(resource => `<article class="resource-item"><h3>${resource.title}</h3><p>${resource.note}</p><p><strong>When to use:</strong> ${resource.when}</p><p class="resource-date">Source reviewed ${resource.verified}</p><a href="${resource.url}" target="_blank" rel="noopener">Read the official source<span class="visually-hidden"> for ${resource.title}</span></a></article>`).join("")}`;
  renderEvidence();
  renderReviewCriteria();
  renderResponseScript();
}
function renderResponseScript() {
  if (!latestMayaText) {
    elements["verbatim-script"].hidden = true;
    elements["verbatim-script"].firstElementChild.textContent = "";
    elements["use-script"].hidden = true;
    elements["response-context"].textContent = "After Maya speaks, your role-specific script will appear here.";
    elements["coach-ready"].hidden = true;
    return;
  }
  const script = verbatimResponse(selectedTrack, latestMayaText);
  elements["response-context"].textContent = `${tracks[selectedTrack].label} script. Read this verbatim, or make it your own below.`;
  elements["verbatim-script"].firstElementChild.textContent = script;
  elements["verbatim-script"].hidden = false;
  elements["use-script"].hidden = false;
  elements["coach-ready"].hidden = false;
}
const transcriptNodes = new Map();
const announcedFinalIds = new Set();

function renderTranscript() {
  transcriptNodes.clear();
  announcedFinalIds.clear();
  elements.transcript.replaceChildren();
  $("transcript-announcement").textContent = "";
  const empty = document.createElement("div");
  empty.className = "transcript-empty";
  empty.textContent = "Maya's first message and your live transcript will appear here.";
  elements.transcript.appendChild(empty);
}

function syncTranscript(messages) {
  elements.transcript.querySelector(".transcript-empty")?.remove();
  const ids = new Set(messages.map(message => message.id));
  for (const [id, node] of transcriptNodes) {
    if (!ids.has(id)) {
      node.article.remove();
      transcriptNodes.delete(id);
    }
  }
  let latestFinal = null;
  messages.forEach((message, index) => {
    let node = transcriptNodes.get(message.id);
    if (!node) {
      const article = document.createElement("article");
      article.dataset.turnId = message.id;
      const speaker = document.createElement("span");
      speaker.className = "speaker";
      const text = document.createElement("p");
      article.append(speaker, text);
      node = { article, speaker, text, signature: "" };
      transcriptNodes.set(message.id, node);
    }
    const className = `transcript-turn ${message.role === "user" ? "user" : "agent"}${message.tentative ? " tentative" : ""}`;
    const signature = `${className}|${message.speaker}|${message.text}|${message.tentative}`;
    if (node.signature !== signature) {
      node.article.className = className;
      node.speaker.textContent = `${message.speaker}${message.tentative ? ", tentative" : ""}`;
      node.text.textContent = message.text;
      node.signature = signature;
    }
    const childAtIndex = elements.transcript.children[index];
    if (childAtIndex !== node.article) {
      elements.transcript.insertBefore(node.article, childAtIndex || null);
    }
    if (!message.tentative && !announcedFinalIds.has(message.id)) {
      announcedFinalIds.add(message.id);
      latestFinal = message;
    }
  });
  if (latestFinal) {
    $("transcript-announcement").textContent = `${latestFinal.speaker}: ${latestFinal.text}`;
  }
  elements.transcript.scrollTop = elements.transcript.scrollHeight;
}

function appendHeardState(item, heard) {
  if (!heard) return;
  const state = document.createElement("span");
  state.className = "visually-hidden evidence-heard";
  state.textContent = ", Heard";
  item.appendChild(state);
}
function renderHandoffs() {
  elements["handoff-cues"].replaceChildren(...commonHandoffCues.map(cue => {
    const item = document.createElement("li");
    const heard = coaching.handoffs[cue.id] || context?.handoffCueIds?.includes(cue.id);
    item.classList.toggle("is-heard", Boolean(heard));
    item.textContent = cue.label;
    appendHeardState(item, heard);
    if (coaching.handoffs[cue.id]?.excerpt) {
      const excerpt = document.createElement("span");
      excerpt.className = "evidence-excerpt";
      excerpt.textContent = coaching.handoffs[cue.id].excerpt;
      item.appendChild(excerpt);
    }
    return item;
  }));
}
function renderEvidence() {
  const track = tracks[selectedTrack];
  elements["track-evidence"].replaceChildren(...track.evidenceGroups.map(group => {
    const wrapper = document.createElement("div");
    wrapper.className = "evidence-group";
    const title = document.createElement("h3");
    title.textContent = group.label;
    const list = document.createElement("ul");
    for (const [id, label] of group.items) {
      const item = document.createElement("li");
      const evidence = coaching.evidence[id];
      const heard = evidence || context?.evidenceIds?.includes(id);
      item.classList.toggle("is-heard", Boolean(heard));
      item.textContent = label;
      appendHeardState(item, heard);
      if (evidence?.excerpt) {
        const excerpt = document.createElement("span");
        excerpt.className = "evidence-excerpt";
        excerpt.textContent = evidence.excerpt;
        item.appendChild(excerpt);
      }
      list.appendChild(item);
    }
    wrapper.append(title, list);
    return wrapper;
  }));
  const signals = Object.values(coaching.signals);
  const persistedSignals = context?.buyingSignalIds || [];
  elements["buying-signals"].replaceChildren();
  if (!signals.length && !persistedSignals.length) {
    const empty = document.createElement("li");
    empty.className = "empty-evidence";
    empty.textContent = "No signals detected yet.";
    elements["buying-signals"].appendChild(empty);
  } else {
    const ids = new Set([...persistedSignals, ...signals.map(signal => signal.id)]);
    for (const id of ids) {
      const definition = signalDefinition(id);
      const item = document.createElement("li");
      item.className = "is-heard";
      item.textContent = definition?.label || id;
      appendHeardState(item, true);
      if (coaching.signals[id]?.excerpt) {
        const excerpt = document.createElement("span");
        excerpt.className = "evidence-excerpt";
        excerpt.textContent = coaching.signals[id].excerpt;
        item.appendChild(excerpt);
      }
      elements["buying-signals"].appendChild(item);
    }
  }
  renderHandoffs();
}
function renderMetrics() {
  elements["session-timer"].textContent = formatDuration(metrics.elapsedSeconds);
  elements["talk-share"].textContent = metrics.talkShare === null ? "No audio yet" : `${Math.round(metrics.talkShare * 100)}%`;
  elements["ratio-fill"].style.transform = `scaleX(${metrics.talkShare || 0})`;
  elements["end-session"].disabled = !["connecting", "in-progress"].includes(phase);
  elements["end-session"].textContent = phase === "ending" ? "Ending conversation..." : phase === "connecting" ? "Cancel connection" : "End conversation";
  const elapsed = metrics.elapsedSeconds;
  let cue = "End any time. Sessions under 10 minutes return to setup without attempt evaluation.";
  if (elapsed >= 840) cue = "Final minute. Confirm the next step and stop adding topics.";
  else if (elapsed >= 720) cue = "12 minutes. Wrap-up warning. Move to the next step.";
  else if (elapsed >= 600) cue = "10 minutes reached. This session can qualify for attempt evaluation when you end it.";
  else if (elapsed >= 480) cue = "8 minutes. Soft cue: check discovery coverage and listening.";
  if (phase === "connecting") cue = "Connecting. Cancel connection is available at the top of the conversation panel.";
  if (phase === "ending") cue = "Ending the SDK session and stopping audio.";
  if (context?.mode === "practice") cue = "Practice review has no live session clock.";
  elements["time-cue"].textContent = cue;
}
function renderEvaluation() {
  const real = hasQualifyingSession(context);
  const values = [
    ["Track", tracks[selectedTrack].label],
    ["Real conversation ID", real ? context.conversationId : "No real session"],
    ["Elapsed time", formatDuration(context?.elapsedSeconds || 0)],
    ["Listening estimate", ratioText({ ...context, talkShare: context && context.talkSeconds + context.listenSeconds > 0 ? context.talkSeconds / (context.talkSeconds + context.listenSeconds) : null })],
    ["Track evidence", `${context?.evidenceIds?.length || 0} topics marked by local rules`],
    ["Possible signals", `${context?.buyingSignalIds?.length || 0} Maya-message patterns`]
  ];
  elements["evaluation-summary"].innerHTML = values.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  const opened = Boolean(context?.evaluationOpened);
  elements["continue-review"].disabled = !opened || !real;
  elements["evaluation-opened"].textContent = opened
    ? "History opened. The portal cannot confirm native evaluation results or completion."
    : "Open history to unlock FDE review for this real attempt.";
}
function setStatus(label, state) {
  elements["session-status"].dataset.state = state;
  elements["session-status"].lastChild.textContent = label;
  elements["state-announcement"].textContent = `Session status: ${label}`;
}
function setPhase(nextPhase) {
  phase = nextPhase;
  if (context) {
    context.phase = nextPhase;
    persistContext();
  }
  const isPractice = context?.mode === "practice";
  const real = hasQualifyingSession(context);
  const active = {
    configured: "conversation",
    connecting: "conversation",
    "in-progress": "conversation",
    ending: "conversation",
    evaluation: "evaluation",
    review: "review"
  }[nextPhase] || "prepare";
  const complete = {
    prepare: nextPhase !== "setup" && !isPractice,
    conversation: (nextPhase === "evaluation" || nextPhase === "review") && real,
    evaluation: nextPhase === "review" && real && context.evaluationOpened
  };
  document.querySelectorAll("[data-loop]").forEach(step => {
    const name = step.dataset.loop;
    step.classList.toggle("is-active", name === active);
    step.classList.toggle("is-complete", Boolean(complete[name]));
    if (name === active) step.setAttribute("aria-current", "step");
    else step.removeAttribute("aria-current");
  });
  elements["setup-panel"].hidden = !["setup", "configured"].includes(nextPhase);
  elements["session-panel"].hidden = !["connecting", "in-progress", "ending"].includes(nextPhase);
  elements["evaluation-panel"].hidden = nextPhase !== "evaluation";
  elements["review-stage"].hidden = nextPhase !== "review";
  elements["coach-content"].hidden = nextPhase === "review";
  elements["fde-panel"].hidden = nextPhase !== "review";
  elements.workspace.classList.toggle("session-active", ["connecting", "in-progress", "ending"].includes(nextPhase));
  elements["start-session"].disabled = !agentId || nextPhase === "connecting";
  elements["send-text"].disabled = nextPhase !== "in-progress";
  elements["reconnect-session"].disabled = nextPhase === "ending";
  document.querySelectorAll("[data-track]").forEach(button => {
    button.disabled = ["connecting", "in-progress", "ending", "evaluation", "review"].includes(nextPhase);
  });
  if (nextPhase === "setup") setStatus("Setup", "setup");
  if (nextPhase === "configured") setStatus("Configured", "configured");
  if (nextPhase === "connecting") setStatus("Connecting", "configured");
  if (nextPhase === "in-progress") setStatus("Live", "live");
  if (nextPhase === "ending") setStatus("Ending", "configured");
  if (nextPhase === "evaluation") setStatus("Evaluation", "configured");
  if (nextPhase === "review") setStatus(isPractice ? "Practice review" : "Review", "review");
  if (nextPhase === "evaluation") renderEvaluation();
  if (nextPhase === "review") renderReviewMode();
  renderMetrics();
}

function showRecovery(message) {
  if (context) {
    context.sessionState = "recovery";
    context.phase = "configured";
    persistContext();
  }
  setPhase(agentId ? "configured" : "setup");
  elements["setup-message"].textContent = message;
}
function showEvaluation() {
  if (!hasQualifyingSession(context)) {
    showRecovery("Session ended and audio is off. It did not reach 10 minutes, so this attempt is not eligible for evaluation. Start a new conversation when ready, or use Practice FDE.");
    return;
  }
  metrics = {
    elapsedSeconds: context.elapsedSeconds,
    talkSeconds: context.talkSeconds,
    listenSeconds: context.listenSeconds,
    conversationId: context.conversationId,
    talkShare: context.talkSeconds + context.listenSeconds > 0 ? context.talkSeconds / (context.talkSeconds + context.listenSeconds) : null
  };
  elements["stage-note"].textContent = `Local attempt ${context.localAttemptId}. Transcript content is not persisted.`;
  setPhase("evaluation");
}
function renderReviewMode() {
  const practice = context?.mode === "practice";
  const track = tracks[selectedTrack];
  elements["fde-title"].textContent = practice ? `Practice FDE, ${track.shortLabel}` : `FDE review, ${track.shortLabel}`;
  elements["fde-outcome"].textContent = track.outcome;
  elements["review-stage-title"].textContent = practice ? "Practice the human review" : "Make the human decision";
  elements["review-stage-copy"].textContent = practice
    ? "Practice mode has no live session, real conversation ID, native evaluation, or completion claim."
    : "Compare the local session evidence and native ElevenLabs results with the selected track rubric. Neither local rules nor native evaluation auto-pass the learner.";
  elements["return-evaluation"].textContent = practice ? "Return to setup" : "Return to evaluation";
  elements["stage-note"].textContent = practice ? `Practice ${context.localAttemptId}. No transcript or real session attached.` : `Attempt ${context.localAttemptId}. Human review only.`;
  renderSavedDecision();
}
function showReview() {
  if (!context) {
    startPractice();
    return;
  }
  if (context.mode === "attempt" && (!hasQualifyingSession(context) || !context.evaluationOpened)) {
    showEvaluation();
    return;
  }
  setPhase("review");
}
function startPractice() {
  savedReview = null;
  storageRemove(REVIEW_KEY);
  context = newContext("practice");
  metrics = { elapsedSeconds: 0, talkSeconds: 0, listenSeconds: 0, talkShare: null, conversationId: "" };
  coaching = { evidence: {}, signals: {}, handoffs: {} };
  populateReview(null);
  preparePrint();
  showReview();
}
function renderSavedDecision() {
  if (!savedReview) {
    elements["saved-decision"].hidden = true;
    elements["saved-decision"].replaceChildren();
    return;
  }
  const practice = savedReview.mode === "practice";
  elements["saved-decision"].hidden = false;
  const title = document.createElement("strong");
  title.textContent = `${practice ? "Saved practice decision" : "Saved decision"}: ${decisionLabels[savedReview.overall]}`;
  const detail = document.createElement("span");
  detail.textContent = `${formatDate(savedReview.reviewedAt)}. ${tracks[savedReview.track].label}. ${practice ? "Not a completion record." : "Prototype record only."}`;
  elements["saved-decision"].replaceChildren(title, detail);
}
function renderReviewCriteria() {
  const track = tracks[selectedTrack];
  elements["review-criteria"].innerHTML = track.rubric.map(criterion => `
    <fieldset class="review-criterion" data-criterion="${criterion.id}" aria-describedby="review-error">
      <legend>${criterion.label}</legend>
      <p>${criterion.description}</p>
      <div class="rating-options">
        <label><input type="radio" name="${criterion.id}" value="pass"><span>Pass</span></label>
        <label><input type="radio" name="${criterion.id}" value="revise"><span>Revise</span></label>
        <label><input type="radio" name="${criterion.id}" value="needs_review"><span>Needs review</span></label>
      </div>
    </fieldset>
  `).join("");
}
function populateReview(review) {
  elements["review-form"].reset();
  clearReviewError();
  if (!review) return;
  for (const criterion of tracks[review.track].rubric) {
    const input = elements["review-form"].querySelector(`input[name="${criterion.id}"][value="${review.scores[criterion.id]}"]`);
    if (input) input.checked = true;
  }
  elements["reviewer-notes"].value = review.notes;
  elements["overall-decision"].value = review.overall;
  elements["human-confirmation"].checked = true;
}
function clearReviewError() {
  elements["review-error"].hidden = true;
  elements["review-form"].querySelectorAll("[aria-invalid]").forEach(control => control.removeAttribute("aria-invalid"));
}
function markReviewChanged() {
  savedReview = null;
  elements["save-status"].textContent = "Unsaved changes";
  clearReviewError();
  preparePrint();
  renderSavedDecision();
}
function validateReview() {
  for (const criterion of tracks[selectedTrack].rubric) {
    if (!elements["review-form"].querySelector(`input[name="${criterion.id}"]:checked`)) {
      const fieldset = elements["review-form"].querySelector(`[data-criterion="${criterion.id}"]`);
      return { message: `Choose a rating for ${criterion.label}.`, invalid: fieldset, target: fieldset.querySelector("input") };
    }
  }
  if (!elements["overall-decision"].value) return { message: "Choose an overall human decision.", invalid: elements["overall-decision"], target: elements["overall-decision"] };
  if (!elements["human-confirmation"].checked) return { message: "Confirm that a human reviewed the evidence.", invalid: elements["human-confirmation"], target: elements["human-confirmation"] };
  return null;
}
function preparePrint() {
  if (!savedReview) {
    elements["print-sheet"].hidden = true;
    elements["print-record"].disabled = true;
    return;
  }
  const review = savedReview;
  const practice = review.mode === "practice";
  const real = Boolean(review.callStarted && review.conversationId);
  const completed = !practice && hasQualifyingSession(review) && review.evaluationOpened && review.overall === "pass";
  const title = practice ? "Practice FDE review record" : completed ? "Prototype completion record" : "Prototype review record";
  const voiced = review.talkSeconds + review.listenSeconds;
  const share = voiced > 0 ? review.talkSeconds / voiced : null;
  const evidence = review.evidenceIds.map(id => evidenceDefinitions(review.track).find(item => item.id === id)?.label || id);
  const signals = review.buyingSignalIds.map(id => signalDefinition(id)?.label || id);
  const summary = [
    ["Track", tracks[review.track].label],
    ["Mode", practice ? "Practice, no real session" : "Attempt"],
    ["Local attempt ID", review.localAttemptId],
    ["Real conversation ID", real ? review.conversationId : "None"],
    ["Elapsed time", formatDuration(review.elapsedSeconds)],
    ["Listening estimate", ratioText({ talkShare: share })]
  ];
  const rows = tracks[review.track].rubric.map(criterion => `<tr><th>${criterion.label}</th><td>${decisionLabels[review.scores[criterion.id]]}</td></tr>`).join("");
  elements["print-content"].innerHTML = `
    <h2>${title}</h2>
    <p>Reviewed ${escapeHtml(formatDate(review.reviewedAt))}</p>
    <dl>${summary.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>
    <div class="record-decision">${practice ? "Practice decision" : "Overall decision"}: ${decisionLabels[review.overall]}</div>
    <table><tbody>${rows}</tbody></table>
    <h2>Track evidence</h2><p>${escapeHtml(evidence.join(", ") || "No local rule matches recorded.")}</p>
    <h2>Possible buying signals</h2><p>${escapeHtml(signals.join(", ") || "No possible signals recorded. This does not indicate purchase intent.")}</p>
    <h2>Reviewer notes</h2><p>${escapeHtml(review.notes || "No notes supplied.").replace(/\n/g, "<br>")}</p>
  `;
  elements["print-footer"].textContent = practice
    ? "Independent fictional rehearsal. No live session or native evaluation is attached. This is not a completion record, official ElevenLabs certification, accredited credential, or production deployment."
    : "Independent fictional rehearsal. Native ElevenLabs evaluation is separate evidence, not an automatic pass. This prototype record is not an official ElevenLabs certification, accredited credential, or production deployment. No transcript content is included.";
  elements["print-sheet"].hidden = false;
  elements["print-record"].disabled = false;
}

const controller = createConversationController({
  onStatus(status, message) {
    elements["setup-message"].textContent = message;
    if (status === "connected" && context?.callStarted) setPhase("in-progress");
  },
  onMode(mode) {
    elements["voice-mode"].textContent = mode === "speaking" ? "Maya speaking" : "Listening";
  },
  onConversationId(id) {
    if (!context || context.mode !== "attempt") return;
    context.callStarted = true;
    context.conversationId = id;
    context.sessionState = "active";
    metrics.conversationId = id;
    elements["conversation-id"].textContent = `ID ${id}`;
    elements["conversation-id"].title = id;
    elements["stage-note"].textContent = "Live session. Transcript stays in memory only.";
    persistContext();
  },
  onThread(messages) {
    thread = messages;
    syncTranscript(messages);
    const finalMessages = messages.filter(message => !message.tentative);
    const latestMaya = [...finalMessages].reverse().find(message => message.role === "agent");
    const nextMayaText = latestMaya?.text || "";
    if (nextMayaText !== latestMayaText) {
      latestMayaText = nextMayaText;
      renderResponseScript();
      elements["compass-copy"].textContent = compassMessage(selectedTrack, latestMayaText);
    }
    coaching = inspectTranscript(selectedTrack, finalMessages, coaching);
    if (context && context.mode === "attempt") {
      context.evidenceIds = Object.keys(coaching.evidence);
      context.buyingSignalIds = Object.keys(coaching.signals);
      context.handoffCueIds = Object.keys(coaching.handoffs);
      persistContext();
    }
    renderEvidence();
  },
  onTick(nextMetrics) {
    metrics = nextMetrics;
    if (context && context.mode === "attempt") {
      context.elapsedSeconds = nextMetrics.elapsedSeconds;
      context.talkSeconds = nextMetrics.talkSeconds;
      context.listenSeconds = nextMetrics.listenSeconds;
      if (nextMetrics.elapsedSeconds !== lastPersistSecond && nextMetrics.elapsedSeconds % 5 === 0) {
        lastPersistSecond = nextMetrics.elapsedSeconds;
        persistContext();
      }
    }
    renderMetrics();
  },
  onSessionEnd(finalMetrics, details) {
    metrics = finalMetrics;
    if (context?.mode === "attempt") {
      context.elapsedSeconds = finalMetrics.elapsedSeconds;
      context.talkSeconds = finalMetrics.talkSeconds;
      context.listenSeconds = finalMetrics.listenSeconds;
      context.sessionState = details?.terminal && finalMetrics.elapsedSeconds >= 600 ? "terminal" : "recovery";
      persistContext();
      if (details?.reason === "time-limit") elements["session-error"].textContent = "The 15-minute session limit was reached, so the session ended automatically.";
      showEvaluation();
    } else {
      setPhase(agentId ? "configured" : "setup");
    }
  },
  onError(message) {
    elements["session-error"].hidden = false;
    elements["session-error"].textContent = `${message}. Check microphone permission, network, public-agent settings, and the domain allowlist. Reconnect starts a new conversation ID.`;
    setStatus("Connection error", "error");
  }
}, () => window.__PARTNER_LAB_NOW__ || Date.now());

async function startSession() {
  if (!agentId) {
    elements["agent-error"].hidden = false;
    elements["agent-error"].textContent = "Configure a public agent ID before starting.";
    elements["agent-id"].focus();
    return;
  }
  savedReview = null;
  storageRemove(REVIEW_KEY);
  context = newContext("attempt");
  coaching = { evidence: {}, signals: {}, handoffs: {} };
  thread = [];
  latestMayaText = "";
  metrics = { elapsedSeconds: 0, talkSeconds: 0, listenSeconds: 0, talkShare: null, conversationId: "" };
  elements["session-error"].hidden = true;
  elements["conversation-id"].textContent = "Conversation ID pending";
  renderTranscript();
  renderEvidence();
  renderResponseScript();
  setPhase("connecting");
  try {
    const conversationId = await controller.start({ agentId, trackLabel: tracks[selectedTrack].label });
    if (conversationId) setPhase("in-progress");
  } catch (error) {
    context = newContext("attempt");
    elements["setup-message"].textContent = `${error.message}. Check microphone permission, network, public-agent settings, and the domain allowlist, then try again.`;
    setPhase("configured");
  }
}
async function endActiveForControl(reason = "abandon") {
  if (controller.isActive()) await controller.endSession(true, reason);
}
function hasWork() {
  return Boolean(agentId || context || savedReview || elements.composer.value || elements["reviewer-notes"].value);
}

renderDossier();
const preparationTabs = [...document.querySelectorAll("[data-tab]")];
function activatePreparationTab(button, moveFocus = false) {
  preparationTabs.forEach(tab => {
    const selected = tab === button;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll(".rail-panel").forEach(panel => {
    panel.hidden = panel.id !== `panel-${button.dataset.tab}`;
  });
  if (moveFocus) button.focus();
}
preparationTabs.forEach(button => {
  button.addEventListener("click", () => activatePreparationTab(button));
});
document.querySelector(".rail-tabs").addEventListener("keydown", event => {
  const current = event.target.closest("[data-tab]");
  if (!current) return;
  const currentIndex = preparationTabs.indexOf(current);
  let nextIndex = null;
  if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % preparationTabs.length;
  if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + preparationTabs.length) % preparationTabs.length;
  if (event.key === "Home") nextIndex = 0;
  if (event.key === "End") nextIndex = preparationTabs.length - 1;
  if (nextIndex === null) return;
  event.preventDefault();
  activatePreparationTab(preparationTabs[nextIndex], true);
});
document.querySelectorAll("[data-track]").forEach(button => {
  button.addEventListener("click", () => {
    if (context?.callStarted || phase === "evaluation" || phase === "review") return;
    selectedTrack = button.dataset.track;
    storageSet(TRACK_KEY, selectedTrack);
    if (context) {
      context.track = selectedTrack;
      persistContext();
    }
    coaching = { evidence: {}, signals: {}, handoffs: {} };
    renderTrack();
  });
});
elements["agent-form"].addEventListener("submit", event => {
  event.preventDefault();
  const value = elements["agent-id"].value.trim();
  const looksLikeKey = /^sk_/i.test(value) || /^[a-f0-9]{32,}$/i.test(value);
  if (looksLikeKey || !/^[A-Za-z0-9_-]{6,128}$/.test(value)) {
    elements["agent-error"].hidden = false;
    elements["agent-error"].textContent = "Enter a valid public agent ID, not an API key. Use letters, numbers, underscores, or hyphens.";
    elements["agent-id"].setAttribute("aria-invalid", "true");
    elements["agent-id"].focus();
    return;
  }
  agentId = value;
  storageSet(AGENT_KEY, value);
  elements["agent-id"].removeAttribute("aria-invalid");
  elements["agent-error"].hidden = true;
  context = newContext("attempt");
  savedReview = null;
  storageRemove(REVIEW_KEY);
  populateReview(null);
  preparePrint();
  setPhase("configured");
  elements["setup-message"].textContent = "Configured locally. Live readiness is verified only when you start the SDK session.";
});
elements["agent-id"].addEventListener("input", () => {
  elements["agent-error"].hidden = true;
  elements["agent-id"].removeAttribute("aria-invalid");
});
elements["start-session"].addEventListener("click", startSession);
elements["coach-ready"].addEventListener("click", () => {
  elements["response-coach"].scrollIntoView({ behavior: "smooth", block: "center" });
  elements["use-script"].focus({ preventScroll: true });
});
elements["use-script"].addEventListener("click", () => {
  elements.composer.value = elements["verbatim-script"].firstElementChild.textContent;
  elements["response-context"].textContent = "Your script is ready to edit. Speak it naturally or send it as text when you are ready.";
  elements.composer.focus();
  controller.sendActivity();
});
elements["end-session"].addEventListener("click", async () => {
  if (!["connecting", "in-progress"].includes(phase)) return;
  setPhase("ending");
  elements["voice-mode"].textContent = "Session ending";
  try { await controller.endSession(false); }
  catch (error) {
    if (controller.isActive()) setPhase("in-progress");
    elements["session-error"].hidden = false;
    elements["session-error"].textContent = `${error.message}. If audio continues, use Reset to close the session, then reload the browser tab.`;
  }
});
elements["reconnect-session"].addEventListener("click", async () => {
  if (!window.confirm("Reconnect ends this SDK session and starts a new conversation ID. Local transcript and audio metrics reset. Continue?")) return;
  await endActiveForControl("recovery");
  context = null;
  setPhase("configured");
  await startSession();
});
elements.composer.addEventListener("input", () => controller.sendActivity());
elements.composer.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && phase === "in-progress") {
    event.preventDefault();
    elements["send-text"].click();
  }
});
elements["send-text"].addEventListener("click", () => {
  try {
    if (controller.sendText(elements.composer.value)) {
      elements.composer.value = "";
      elements["session-error"].hidden = true;
    }
  } catch (error) {
    elements["session-error"].hidden = false;
    elements["session-error"].textContent = error.message;
  }
});
elements["open-evaluation"].addEventListener("click", () => {
  if (!hasQualifyingSession(context)) return;
  context.evaluationOpened = true;
  persistContext();
  renderEvaluation();
});
elements["continue-review"].addEventListener("click", () => {
  if (hasQualifyingSession(context) && context.evaluationOpened) showReview();
});
elements["practice-review"].addEventListener("click", async () => {
  if (["connecting", "in-progress"].includes(phase) || controller.isActive()) {
    if (!window.confirm("End the live session and enter practice? Audio and the timer will stop. Cancel keeps the current attempt.")) return;
    await endActiveForControl("practice");
    startPractice();
    return;
  }
  if (context?.mode === "attempt" && hasQualifyingSession(context)) {
    if (context.evaluationOpened) showReview();
    else showEvaluation();
  } else {
    startPractice();
  }
});
elements["return-evaluation"].addEventListener("click", () => {
  if (context?.mode === "practice") {
    context = null;
    setPhase(agentId ? "configured" : "setup");
  } else showEvaluation();
});
elements["review-form"].addEventListener("change", markReviewChanged);
elements["reviewer-notes"].addEventListener("input", markReviewChanged);
elements["review-form"].addEventListener("submit", event => {
  event.preventDefault();
  clearReviewError();
  const error = validateReview();
  if (error) {
    elements["review-error"].textContent = error.message;
    elements["review-error"].hidden = false;
    error.invalid.setAttribute("aria-invalid", "true");
    error.target.focus();
    return;
  }
  if (!context || (context.mode === "attempt" && (!hasQualifyingSession(context) || !context.evaluationOpened))) {
    elements["review-error"].textContent = "A terminal session of at least 10 minutes and opened ElevenLabs history are required for attempt review.";
    elements["review-error"].hidden = false;
    return;
  }
  const scores = {};
  for (const criterion of tracks[selectedTrack].rubric) {
    scores[criterion.id] = elements["review-form"].querySelector(`input[name="${criterion.id}"]:checked`).value;
  }
  savedReview = {
    ...context,
    phase: "review",
    scores,
    notes: elements["reviewer-notes"].value.trim(),
    overall: elements["overall-decision"].value,
    confirmed: true,
    reviewedAt: new Date().toISOString()
  };
  context.phase = "review";
  storageSet(REVIEW_KEY, JSON.stringify(savedReview));
  persistContext();
  elements["save-status"].textContent = "Review saved locally. Transcript content was not stored.";
  preparePrint();
  renderSavedDecision();
});
elements["print-record"].addEventListener("click", () => {
  if (!savedReview) return;
  preparePrint();
  window.print();
});
elements["restart-lab"].addEventListener("click", async () => {
  if (hasWork() && !window.confirm("Restart clears the local session and review but keeps the agent ID and track. Continue?")) return;
  await endActiveForControl();
  context = newContext("attempt");
  savedReview = null;
  storageRemove(REVIEW_KEY);
  thread = [];
  latestMayaText = "";
  coaching = { evidence: {}, signals: {}, handoffs: {} };
  metrics = { elapsedSeconds: 0, talkSeconds: 0, listenSeconds: 0, talkShare: null, conversationId: "" };
  populateReview(null);
  preparePrint();
  renderTranscript();
  renderEvidence();
  renderResponseScript();
  elements.composer.value = "";
  setPhase(agentId ? "configured" : "setup");
});
elements["reset-lab"].addEventListener("click", async () => {
  if (hasWork() && !window.confirm("Reset clears the agent ID, local session, metrics, and review from this browser. Continue?")) return;
  await endActiveForControl();
  for (const key of [AGENT_KEY, CONTEXT_KEY, REVIEW_KEY, TRACK_KEY, "partnerCertificationLab.attemptContext", "partnerCertificationLab.review"]) storageRemove(key);
  agentId = "";
  context = null;
  savedReview = null;
  selectedTrack = "seller";
  thread = [];
  latestMayaText = "";
  coaching = { evidence: {}, signals: {}, handoffs: {} };
  metrics = { elapsedSeconds: 0, talkSeconds: 0, listenSeconds: 0, talkShare: null, conversationId: "" };
  elements["agent-form"].reset();
  populateReview(null);
  preparePrint();
  renderTranscript();
  renderTrack();
  setPhase("setup");
});

const storedTrack = storageGet(TRACK_KEY);
if (tracks[storedTrack]) selectedTrack = storedTrack;
const storedAgent = storageGet(AGENT_KEY) || "";
if (/^[A-Za-z0-9_-]{6,128}$/.test(storedAgent) && !/^sk_/i.test(storedAgent)) {
  agentId = storedAgent;
  elements["agent-id"].value = storedAgent;
}
const storedReview = loadJson(REVIEW_KEY);
if (storedReview && storedReview.version === 3 && tracks[storedReview.track]) {
  savedReview = storedReview;
  selectedTrack = storedReview.track;
  context = { ...storedReview };
} else {
  const storedContext = loadJson(CONTEXT_KEY);
  if (validContext(storedContext)) {
    context = storedContext;
    selectedTrack = context.track;
  }
}
if (context && !context.sessionState) context.sessionState = "legacy_unverified";
renderTrack();
renderTranscript();
if (savedReview) {
  populateReview(savedReview);
  preparePrint();
  showReview();
} else if (context?.mode === "practice" && context.phase === "review") {
  showReview();
} else if (hasQualifyingSession(context)) {
  showEvaluation();
} else if (context?.callStarted) {
  showRecovery("Reload ended local SDK control. This attempt needs a new terminal session of at least 10 minutes before evaluation.");
} else {
  if (context) metrics = { ...metrics, elapsedSeconds: context.elapsedSeconds || 0 };
  setPhase(agentId ? "configured" : "setup");
}
