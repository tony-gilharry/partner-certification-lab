# Partner Readiness Lab product requirements

## Product boundary

A two-track SI partner-readiness rehearsal built around one fictional downstream customer, Northstar Telecom. The learner is always from an external ElevenLabs SI partner organization, never ElevenLabs staff. This is an independent hiring-proof project, not an official ElevenLabs product, production deployment, or accredited certification.

The seller track is primary. The solutions-consultant track is secondary. They share the Northstar dossier but have different talk tracks, official resources, verbatim scripts, evidence rules, native rubrics, FDE decisions, and print records.

## Users and readiness outcomes

### Partner seller

The seller learns value proposition, discovery, commercial progression, and honest SI service/revenue hypotheses. Voice AI may create opportunities for paid discovery, validation, implementation, and optimization when the customer case justifies them. The app must never promise higher billable rates, partner revenue, or customer ROI.

Readiness outcome: establish the customer problem, connect voice AI to customer and partner value, handle the conversation honestly, and earn a concrete next step. MEDDPICC and Command of the Message support the conversation rather than becoming a robotic checklist.

### Partner solutions consultant

The solutions consultant learns technical discovery, validation discipline, and specialist handoffs. Readiness outcome: gather enough accurate technical information to justify solution design or validation without overcommitting.

## Core experience

1. Select a track and review the dossier, track talk track, and official resource notes.
2. Configure a public agent ID and start the official SDK session from the button directly below configuration. Keep Cancel connection and End conversation at the top of the live panel. Stop the temporary permission stream immediately after the microphone check, and allow cancellation while the SDK is still connecting.
3. Read one live Maya and learner transcript with voice state, timer, connection state, and real conversation ID.
4. After Maya's turn, show one prominent first-person script that the learner can read verbatim. Local rules select a role-specific response for discovery, value, technical questions, or next steps. Include discovery questions and specialist handoffs in the spoken wording rather than presenting a framework. A ready shortcut brings the learner to the script. Optional editing fills the composer only. Nothing auto-sends or auto-speaks.
5. Keep track-specific compass, evidence, handoff cues, and possible buying signals beside the conversation.
6. Target 12 minutes with soft cues at 8 and 10, wrap-up at 12, and automatic end at 15. Allow manual end at any time. Ending before 10 minutes stops audio and returns to setup without attempt evaluation.
7. Estimate learner talk share from SDK input/output volume samples. Exclude silence and show the estimation limitation. Do not describe this as transcript-word analysis.
8. End into local evaluation and separate ElevenLabs native history. Require a terminal SDK session of at least 10 minutes, a real conversation ID, and opened history before attempt review. Early disconnects and active-session reloads enter recovery, not evaluation.
9. Record track-specific human FDE ratings, notes, overall decision, and confirmation. Print a prototype record with track, real ID, local ID, duration, listening estimate, evidence labels, and possible signals.

## Coaching and evidence rules

All coaching is deterministic local JavaScript. Keyword categories select pre-authored verbatim scripts. Transcript patterns mark evidence topics and possible Maya buying signals and retain short excerpts in memory. No sentiment, emotion, open-ended AI coach, custom LLM, or backend AI service is permitted.

Seller evidence covers MEDDPICC and Command of the Message. Technical evidence covers workflow, systems and data, integration constraints, failure paths, testing and monitoring, reliability, deployment constraints, and validation next step. FDE cues cover architecture, security and compliance, unsupported proof, production readiness, and implementation commitments. Possible signals never declare purchase intent.

## Data and persistence

Persist the public agent ID, selected track, local attempt context, metrics, real conversation ID, evidence and signal IDs, and saved human review. Never persist full transcript content or evidence excerpts. Transcript text and excerpts remain in memory. Do not persist audio.

Practice review remains distinct and never prints completion. A real session is required for an attempt completion record. Native evaluation and local rules are evidence, never an automatic pass.

## Toolchain and architecture

Vite with vanilla JavaScript and the official `@elevenlabs/client` package. No React and no application backend. Normal commands are `npm install`, `npm run dev`, `npm run build`, and `npm run preview`. Development defaults to port 8765. The legacy static app and Python server remain available.

`npm run app` builds a self-contained macOS 12+ app with an AppKit/WKWebView shell, packaged production files, and a Python standard-library server bound to `127.0.0.1:8766`. The app supports microphone permission, persistent local settings, external links, and printing. Node and Docker are not required at runtime. The app stops only its owned server process.

The SDK uses public-agent WebRTC, real conversation IDs, message/mode/status/error callbacks, contextual track updates, text messaging, user activity, and input/output volume. Data modules separate dossier, tracks, resources, and local coaching from SDK session control.

## Content and source requirements

The shared fictional dossier covers the 420-agent service organization, repeat-contact drivers, vendor-neutral human workflow, unquantified pressure, Maya's priorities, likely stakeholders, explicit unknowns, and safe discovery paths.

Every product learning claim links to an official ElevenLabs source and includes a concise use note and review date. SI services and revenue hypotheses remain separate from official product claims and named customer stories. Recheck changing capabilities before recording.

## Acceptance evidence

Normal install and production build pass. The built app is exercised with a mocked SDK for both tracks, response editing/sending, evidence and signals, handoffs, timing boundaries, listening ratio, automatic end, evaluation gating, persistence without transcript content, and reset. Session tests also cover temporary microphone-track cleanup, cancellation while connecting, and cleanup of a late SDK response after cancellation. Desktop and mobile screenshots receive one bounded review and one fix batch.

The native macOS app compiles, passes plist and ad-hoc signature validation, renders the production lab, returns the expected health response and safety headers, rejects POST requests, preserves configuration across launches, clears smoke-test data, and stops its owned server on exit. These checks do not verify live microphone capture or ElevenLabs WebRTC inside WKWebView.

Live WebRTC, real Maya behavior, native evaluation, and real conversation history require separate verification in Tony's account. Builds, mocks, and saved local reviews never satisfy that gate. The desktop origin `http://127.0.0.1:8766` must be allowed on the public agent before the desktop live check.
