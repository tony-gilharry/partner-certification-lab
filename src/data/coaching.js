import { buyingSignalPatterns, commonHandoffCues, tracks } from "./tracks.js";

const verbatimScripts = {
  discovery: {
    seller: "Maya, I'd like to understand one common repeat call before I suggest anything. When a customer calls about an outage update, what happens from the moment your agent answers to the moment the issue is closed? Where does the customer wait, and what work does your agent have to repeat? If we can establish that baseline together, I can help you test whether an ElevenLabs voice agent should handle the routine part while your team keeps the complex or sensitive conversations.",
    "solutions-consultant": "Maya, I'd like to trace one routine outage-update call end to end. Which system identifies the customer, where does your agent find the outage status, and what does the agent update before closing the call? I also need to understand what happens when the information is unavailable or the customer becomes frustrated. Once I know those steps and failure points, I can tell you what we need to validate for an ElevenAgents voice workflow and where a human handoff belongs."
  },
  value: {
    seller: "I can't responsibly promise Northstar the results another customer reported. What I can suggest is a small validation around one repeat-contact type. We would baseline customer wait time, repeat calls, and agent effort, then test whether ElevenAgents can resolve the routine requests with a clear handoff to your team. If that works, our SI team can help with discovery, integration, implementation, and optimization. Would that be a useful way to assess value without getting ahead of the evidence?",
    "solutions-consultant": "I can help you define the evidence, but I can't turn another customer's results into a Northstar business case. For a first validation, I would measure containment, successful task completion, transfer quality, latency, and failure rates on one routine workflow. I would also compare those results with your current baseline and agree on acceptable thresholds before testing. Which of those measures would matter most to you and your support operations team?"
  },
  technical: {
    seller: "I don't want to guess at your architecture or make a security commitment on this call. I can bring our solutions consultant and an ElevenLabs FDE into a working session with your IT and security teams. Before then, could you tell me which CRM, ticketing, and telephony systems you use, who owns them, and what a handoff to a human agent must preserve? I'll make sure those constraints shape the validation rather than showing you a generic demo.",
    "solutions-consultant": "I can outline the discovery, but I shouldn't confirm your integration or production readiness without the system details. Which CRM, ticketing, and telephony platforms are involved, and can they expose the customer and outage data through APIs or webhooks? I also need your identity, permissions, retention, latency, and human-handoff requirements. I'll bring an ElevenLabs FDE and your security owner into the design session so we can validate the architecture and failure handling rather than assume they will work."
  },
  close: {
    seller: "I'd like to suggest a 45-minute working session with you, someone from support operations, and the IT or security owner for one repeat-contact workflow. My solutions consultant and I will map the current process, the baseline you want to improve, and what a safe validation would require. You do not need to commit to a rollout. If there is a useful case after that session, we can define the next step together. Would Tuesday or Thursday work better for you?",
    "solutions-consultant": "For the next step, I'd like to schedule a technical validation session with your support operations, IT, and security owners. I'll bring our ElevenLabs FDE. We'll map one workflow, confirm the available APIs and data permissions, define the human-handoff behavior, and write down the test cases and acceptance criteria. If any of those inputs are unavailable, I'll record them as open validation items rather than make a commitment. Who should we include from your side?"
  }
};

export function messageCategory(text) {
  const value = text.toLowerCase();
  if (/next step|working session|pilot|invitation|timeline|follow up/.test(value)) return "close";
  if (/ROI|return on investment|percent|save|cost|revenue|proof|customer story|Revolut|Deutsche/i.test(text)) return "value";
  if (/integration|CRM|ticketing|telephony|security|compliance|testing|monitor|reliability|deployment|API|SIP|architecture/i.test(text)) return "technical";
  return "discovery";
}

export function verbatimResponse(trackId, latestMayaText) {
  return verbatimScripts[messageCategory(latestMayaText || "")][trackId];
}

function excerpt(text) {
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

export function inspectTranscript(trackId, messages, prior = { evidence: {}, signals: {}, handoffs: {} }) {
  const evidence = { ...prior.evidence };
  const signals = { ...prior.signals };
  const handoffs = { ...prior.handoffs };
  const items = tracks[trackId].evidenceGroups.flatMap(group => group.items);
  for (const message of messages) {
    const text = message.text;
    for (const [id, label, pattern] of items) {
      if (!evidence[id] && new RegExp(pattern, "i").test(text)) {
        evidence[id] = { id, label, excerpt: excerpt(text), speaker: message.speaker };
      }
    }
    if (message.speaker === "Maya") {
      for (const signal of buyingSignalPatterns) {
        if (!signals[signal.id] && new RegExp(signal.pattern, "i").test(text)) {
          signals[signal.id] = { ...signal, excerpt: excerpt(text) };
        }
      }
    }
    for (const cue of commonHandoffCues) {
      if (!handoffs[cue.id] && new RegExp(cue.pattern, "i").test(text)) {
        handoffs[cue.id] = { ...cue, excerpt: excerpt(text) };
      }
    }
  }
  return { evidence, signals, handoffs };
}

export function compassMessage(trackId, latestMayaText) {
  const category = messageCategory(latestMayaText || "");
  const messages = {
    seller: {
      discovery: "Ask about current work and impact. Do not pitch yet.",
      value: "Separate customer value, SI service hypotheses, and sourced proof.",
      technical: "Clarify stakeholders and constraints. Use a specialist before commitments.",
      close: "Seek a bounded action, owner, and timing without inventing agreement."
    },
    "solutions-consultant": {
      discovery: "Trace the workflow, systems, data, and handoffs.",
      value: "Turn the claim into evidence required for validation.",
      technical: "Map constraints, tests, failure paths, and specialist needs.",
      close: "Close on technical discovery or validation with the right stakeholders."
    }
  };
  return messages[trackId][category];
}
