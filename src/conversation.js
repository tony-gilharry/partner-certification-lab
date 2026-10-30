import { Conversation } from "@elevenlabs/client";

const sdkStartSession = (options) => {
  if (typeof window.__PARTNER_LAB_MOCK_START__ === "function") {
    return window.__PARTNER_LAB_MOCK_START__(options);
  }
  return Conversation.startSession(options);
};

export function createConversationController(callbacks, clock = () => Date.now()) {
  let session = null;
  let timer = null;
  let startedAt = 0;
  let lastSample = 0;
  let conversationId = "";
  let ending = false;
  let starting = false;
  let startVersion = 0;
  let closeRequested = false;
  let thread = [];
  let lastActivityAt = 0;
  const metrics = { elapsedSeconds: 0, talkSeconds: 0, listenSeconds: 0 };

  function currentMetrics() {
    const voiced = metrics.talkSeconds + metrics.listenSeconds;
    return {
      ...metrics,
      conversationId,
      talkShare: voiced > 0 ? metrics.talkSeconds / voiced : null
    };
  }

  function emitThread() {
    callbacks.onThread([...thread]);
  }

  function receiveMessage(payload) {
    const text = String(payload.message || "").trim();
    if (!text) return;
    const role = payload.role === "user" || payload.source === "user" ? "user" : "agent";
    const eventId = payload.event_id ?? payload.eventId ?? payload.response_id ?? `${thread.length}`;
    const tentative = Boolean(payload.tentative || payload.is_tentative || payload.final === false);
    const id = `${role}_${eventId}`;
    const message = {
      id,
      speaker: role === "user" ? "You" : "Maya",
      role,
      text,
      tentative
    };
    const existing = thread.findIndex(item => item.id === id);
    if (existing >= 0) {
      if (thread[existing].text === text && thread[existing].tentative === tentative) return;
      thread[existing] = message;
    } else {
      const tentativeIndex = thread.findIndex(item => item.role === role && item.tentative);
      if (!tentative && tentativeIndex >= 0) thread[tentativeIndex] = message;
      else {
        const duplicate = !tentative && thread.some(item => item.role === role && item.text === text && !item.tentative);
        if (duplicate) return;
        thread.push(message);
      }
    }
    if (thread.length > 100) thread = thread.slice(-100);
    emitThread();
  }

  async function sample(now) {
    if (!session) return;
    const input = Number(session.getInputVolume()) || 0;
    const output = Number(session.getOutputVolume()) || 0;
    const sampleSeconds = Math.min(Math.max((now - lastSample) / 1000, 0), 1);
    lastSample = now;
    const threshold = 0.08;
    if (input >= threshold || output >= threshold) {
      if (input >= output) metrics.talkSeconds += sampleSeconds;
      else metrics.listenSeconds += sampleSeconds;
    }
  }

  async function tick() {
    if (!session || ending || closeRequested) return;
    const now = clock();
    metrics.elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
    await sample(now);
    callbacks.onTick(currentMetrics());
    if (metrics.elapsedSeconds >= 900) {
      await endSession(true, "time-limit");
    }
  }

  async function finish(details) {
    if (ending) return;
    ending = true;
    starting = false;
    closeRequested = true;
    if (timer) window.clearInterval(timer);
    timer = null;
    if (startedAt) metrics.elapsedSeconds = Math.max(0, Math.floor((clock() - startedAt) / 1000));
    const finalMetrics = currentMetrics();
    session = null;
    callbacks.onTick(finalMetrics);
    callbacks.onSessionEnd(finalMetrics, { ...details, terminal: true });
  }

  async function start({ agentId, trackLabel }) {
    if (session || starting) throw new Error("A conversation is already active.");
    const version = ++startVersion;
    starting = true;
    ending = false;
    closeRequested = false;
    thread = [];
    conversationId = "";
    startedAt = 0;
    lastSample = 0;
    metrics.elapsedSeconds = 0;
    metrics.talkSeconds = 0;
    metrics.listenSeconds = 0;
    let candidate = null;
    emitThread();
    try {
      callbacks.onStatus("connecting", "Requesting microphone access");
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach(track => track.stop());
      if (version !== startVersion) return "";
      callbacks.onStatus("connecting", "Connecting to ElevenLabs");
      candidate = await sdkStartSession({
        agentId,
        connectionType: "webrtc",
        onConnect: ({ conversationId: id } = {}) => {
          if (version !== startVersion || closeRequested) return;
          if (id) {
            conversationId = id;
            callbacks.onConversationId(id);
          }
          callbacks.onStatus("connected", "Connected");
        },
        onDisconnect: details => {
          if (version === startVersion) finish(details);
        },
        onMessage: payload => {
          if (version === startVersion && !closeRequested) receiveMessage(payload);
        },
        onModeChange: ({ mode } = {}) => {
          if (version === startVersion && !closeRequested) callbacks.onMode(mode || "listening");
        },
        onStatusChange: ({ status } = {}) => {
          if (version === startVersion && !closeRequested) callbacks.onStatus(status || "connecting", status || "Connecting");
        },
        onError: (message, context) => {
          if (version === startVersion && !closeRequested) callbacks.onError(message || "Conversation error", context);
        }
      });
      if (version !== startVersion || closeRequested) {
        await candidate.endSession().catch(() => {});
        return "";
      }
      conversationId = candidate.getId() || conversationId;
      if (!conversationId) throw new Error("The SDK did not return a conversation ID.");
      session = candidate;
      starting = false;
      callbacks.onConversationId(conversationId);
      session.sendContextualUpdate(`The learner is from an external ElevenLabs SI partner organization, not an ElevenLabs employee. Their selected learning track is ${trackLabel}. Adjust your concerns to that track while staying in the fictional Northstar scenario.`);
      startedAt = clock();
      lastSample = startedAt;
      timer = window.setInterval(tick, 250);
      callbacks.onStatus("connected", "Connected");
      callbacks.onTick(currentMetrics());
      return conversationId;
    } catch (error) {
      if (version !== startVersion) {
        if (candidate) await candidate.endSession().catch(() => {});
        return "";
      }
      starting = false;
      if (candidate) await candidate.endSession().catch(() => {});
      session = null;
      throw error;
    }
  }

  async function endSession(automatic = false, reason = "") {
    const closeReason = reason || (automatic ? "time-limit" : "manual");
    if (starting && !session) {
      startVersion += 1;
      starting = false;
      await finish({ reason: closeReason });
      return;
    }
    if (!session) return;
    const activeSession = session;
    closeRequested = true;
    try {
      await activeSession.endSession();
      await finish({ reason: closeReason });
    } catch (error) {
      if (!session) return;
      closeRequested = false;
      throw error;
    }
  }

  function sendText(text) {
    if (!session) throw new Error("Start a conversation before sending text.");
    const value = text.trim();
    if (!value) return false;
    session.sendUserMessage(value);
    return true;
  }

  function sendActivity() {
    const now = Date.now();
    if (session && now - lastActivityAt > 1000) {
      session.sendUserActivity();
      lastActivityAt = now;
    }
  }

  return {
    start,
    endSession,
    sendText,
    sendActivity,
    isActive: () => Boolean(session || starting),
    getMetrics: currentMetrics
  };
}
