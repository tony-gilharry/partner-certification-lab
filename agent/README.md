# Maya agent setup for the two-track lab

Create a dedicated public demo agent in your own ElevenLabs account. The app uses the official `@elevenlabs/client` JavaScript SDK with a public agent ID. It never needs an API key in browser code or browser storage. Verify live behavior in your own account before recording or sharing a demonstration.

Official SDK reference: https://elevenlabs.io/docs/eleven-agents/libraries/java-script

## 1. Create Maya

1. Open https://elevenlabs.io/app/agents and create an agent for the fictional Maya persona.
2. Open `agent/system-prompt.md` and copy only the content between the two dividers into System prompt.
3. Set the first message to the suggested message in that file.
4. Confirm the agent treats the learner as an external SI partner and accepts the track sent by the app's contextual update.
5. Choose a clear English voice and keep the fictional Northstar scenario. Test latency with a model available in your account.
6. Compare the prompt facts with `agent/northstar-dossier.md` before recording.

The seller and solutions-consultant tracks share one agent. The app sends a contextual update after connection. This is application context, not native track switching or a separate agent configuration.

## 2. Configure public SDK access and events

1. Keep authentication disabled only for this public fictional demo agent.
2. In Security, allow the local origins used for development and preview, including `http://127.0.0.1:8765` and `http://localhost:8765`. For the macOS desktop app, also allow `http://127.0.0.1:8766`. Add any other verification port used for that session.
3. In Advanced events, enable the events needed for connection status, mode changes, messages, and errors. The SDK documentation notes that not all client events are enabled by default.
4. Use voice with WebRTC. The app explains microphone access before calling `getUserMedia` and `Conversation.startSession`.
5. Copy the public agent ID, never an API key.

The app calls `Conversation.startSession({ agentId, connectionType: "webrtc" })`, stores the real ID from `getId()`, sends the selected track with `sendContextualUpdate`, supports `sendUserMessage` and `sendUserActivity`, and samples `getInputVolume()` and `getOutputVolume()` locally.

## 3. Add common and track-specific native evaluation

Open Analysis and add the criteria in `agent/evaluation-criteria.json`:

- `common_claim_safety`
- All four `seller_*` criteria
- All four `sc_*` criteria

One native agent can hold both track definitions. Irrelevant track criteria should return `unknown`. The portal and FDE use only the selected track's four rubric items plus the shared claim-safety boundary. Do not claim that ElevenLabs automatically switches criteria by track.

Add the six string data-collection fields from the same JSON:

1. `identified_customer_problem`
2. `partner_value_hypothesis`
3. `technical_validation_need`
4. `proposed_next_step`
5. `possible_buying_signals`
6. `unsupported_claims`

Native evaluation remains in ElevenLabs. The portal does not fetch native results, and opening history does not prove analysis finished.

## 4. Optional official knowledge base

`resources/manifest.json` lists the verified official ElevenLabs URLs and the date each was reviewed. Add selected sources to the agent knowledge base only if they improve the exercise. Keep Maya's source boundary in the prompt: official product claims, benchmarks, and customer stories are not Northstar proof.

Source caveats verified on 2026-10-26:

- The English Deutsche Telekom URL was verified, so the resource is included conservatively.
- Amazon Connect is documented as limited availability with account and workspace prerequisites.
- Real-time monitoring is documented as enterprise-only and is not used by this app.
- Evaluation-framework benchmarks are source-specific discussion material, not Northstar targets.
- Amazon Connect and Genesys references never imply Northstar uses either vendor.

## 5. Verify before recording

1. Run `npm install`, then `npm run dev` and open the configured local origin.
2. Select Partner seller and start a real session. Check microphone access, transcript updates, the first-person verbatim script, optional editing, real conversation ID, and text sending.
3. Stay in the 10-to-15-minute session arc. Check volume-based listening estimates and native history after ending.
4. Repeat with Partner solutions consultant. Confirm Maya changes her concerns after the contextual track update.
5. Test a technical-handoff moment and an intentionally unsupported ROI or customer-proof claim.
6. Inspect common and selected-track native criteria, irrelevant-track `unknown` results, and collected data.
7. Refine the prompt or criteria as needed and rerun the real checks.

Do not mark live verification complete from a build, mocked session, screenshot, or saved review. Usage charges and retention depend on your account and current ElevenLabs settings. Use fictional information only.
