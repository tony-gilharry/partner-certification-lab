---
name: Partner Readiness Lab
description: A two-track ElevenLabs-inspired readiness room with one continuous live conversation and quiet supporting rails.
colors:
  white: "#ffffff"
  canvas: "#f5f5f4"
  stone: "#f5f2ef"
  ink: "#000000"
  body: "#4e4e4e"
  muted: "#6f6a64"
  danger: "#b42318"
  success: "#18794e"
  warning: "#8a5a00"
  focus: "#2563eb"
typography:
  family: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
  display: "300 36 to 52px, line-height 1.06"
  body: "400 14px, line-height 1.55"
  label: "600 11px"
rounded:
  surfaces: "16px"
  fields: "12px"
  controls: "999px"
---

# Design system: Partner Readiness Lab

## Direction

The center conversation is the product. This is an ElevenLabs-native SI readiness room, not a widget wrapper, generic course, or cosmetic persona switch. Partner seller and partner solutions consultant tracks share one customer and one calm visual system while changing content, coaching, evidence, evaluation, and review.

The established white and warm-stone surfaces, black ink, light Inter display type, pill controls, 12 to 16px radii, and low-opacity structural edges remain authoritative. Voice and live state supply the expressive material. Semantic green, amber, red, and blue belong to assessment, error, and focus states.

## Layout

The page has a quiet header, compact title and session facts, and a four-stage loop. The workspace contains three sibling surfaces:

- Left: Dossier, Talk track, and Resources tabs. The rail supports preparation without interrupting the conversation.
- Center: track and agent setup, live voice/transcript, one verbatim role-specific script, optional composer, and session controls. Evaluation and review use the same continuous surface.
- Right: timer, listening estimate, compass, FDE handoffs, track evidence, possible buying signals, and the human review form.

At 1240px the coach rail spans the second row and its sections become a two-column grid. At 860px the layout becomes one column. During connecting and live sessions the center comes first. During setup the dossier stays first. Script text and inputs remain at least 16px, and all workflow controls remain reachable. At 480px track choices, agent controls, and composer actions stack.

## Typography and copy

Inter serves every role with system fallbacks. Display text is light and fluid, with balanced wrapping and tracking no tighter than -.04em. Body text stays readable at working density and line lengths remain bounded. Timers and IDs use tabular numerals where useful.

Copy names real actions and limitations: Configure, Start live conversation, Cancel connection, Edit this script, Send as text, End conversation, Open ElevenLabs history, and Continue to FDE review. Start sits directly below agent configuration. Cancel and End sit at the top of the live panel and remain available during connection and live sessions. Sessions under 10 minutes do not qualify for attempt evaluation. Configured never means live-ready. Possible buying signals never mean purchase intent. Practice never means completion.

## Components

### Track picker

Two adjacent choices expose the actual readiness roles and outcomes. Selected uses black with white text. Choices lock during connection, live session, evaluation, and review so a session cannot change rubric midstream.

### Transcript and responses

The thread sits on warm canvas with bounded height and local scrolling. Maya uses white turns, learner turns use black, and tentative text is explicitly labeled and italicized at full opacity. SDK updates patch only affected turns. A separate polite live region announces final messages only. One first-person verbatim script appears below the thread after Maya's completed turn. Its 16px readable text contains the complete response, including questions and handoffs, rather than framework labels or competing choices. A ready shortcut leads to the script. Optional editing fills the composer. Nothing auto-sends or auto-speaks. Cancel connection and End conversation remain at the top of the live panel throughout connection and live sessions.

### Session evidence

The timer uses light 36px numerals. The listening bar is a simple measurement track, not a progress ring or gamified score. The goal and volume-estimation caveat stay beside it. Evidence lists use text and small heard markers with short in-memory excerpts. No transcript excerpt is persisted.

### Evaluation and FDE

Evaluation shows track, real conversation ID, elapsed time, listening estimate, evidence counts, and possible-signal counts. History opening is a gate, not a verification claim. FDE criteria are generated from the selected track. Native radios sit in 44px pills. Overall decision and responsibility confirmation remain explicit.

### Accessibility and browser surfaces

The app provides semantic landmarks, tabs, fieldsets, labels, a skip link, visible focus, alert errors, live status regions, reduced-motion behavior, custom scrollbar colors, text selection, caret color, underline offsets, and 44px targets. These are implementation provisions, not a completed accessibility audit.

### Print

Print hides the app and shows a dedicated record with track, mode, local and real IDs, duration, listening estimate, ratings, evidence labels, possible signals, notes, and disclaimer. Practice always prints a practice title. Attempt completion requires a real conversation ID, opened history, and human pass.

## Boundaries

Do not add gradients, decorative cards, a popup coach, another AI service, sentiment scoring, or a visual-world detour. Do not persist transcript text or audio. Do not imply that local rules are native ElevenLabs evaluation, that history opening verifies results, or that a build or mock proves live behavior.

## Verification record

The expanded app uses Vite and the official `@elevenlabs/client`. Normal build and mocked browser checks are the required local gate. Desktop and mobile captures live in `.impeccable/review/` with the `coach-*` filenames. Live WebRTC, Maya behavior, and native evaluation remain separate account verification tasks.
