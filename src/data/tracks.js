export const tracks = {
  seller: {
    id: "seller",
    label: "Partner seller",
    shortLabel: "Seller",
    outcome: "Establish the customer problem, connect voice AI to customer and partner value, handle the conversation honestly, and earn a concrete commercial next step.",
    compass: "Discover before pitching. Link customer outcomes to a bounded SI services hypothesis.",
    talkTrack: [
      { title: "Opening", text: "Introduce yourself as an external SI partner, not ElevenLabs staff. Ask permission to understand Northstar's current service operation before discussing a solution." },
      { title: "Discovery", text: "Explore repeat contacts, the human workflow, customer waiting, repetitive work, stakeholders, decision process, and the missing success baseline." },
      { title: "Customer value", text: "Connect voice and chat agents to faster routine answers and more time for human judgment. Treat outcomes as hypotheses to validate, not promised ROI." },
      { title: "SI services and revenue hypothesis", text: "Explain how the SI could support paid discovery, validation, implementation, and ongoing optimization. Do not promise a higher billable rate, a deployment, or partner revenue." },
      { title: "Proof discipline", text: "Use official ElevenLabs sources and named customer results only as their own stories. Never project Revolut or Deutsche Telekom outcomes onto Northstar." },
      { title: "Commercial close", text: "Ask for a specific working session with an owner and timing. A paid discovery or validation discussion is a useful next step only if Maya sees value in it." }
    ],
    rubric: [
      { id: "seller_customer_problem", label: "Customer problem and discovery", description: "Established the repeat-contact problem, human workflow, impact, stakeholders, and unknowns before recommending a path." },
      { id: "seller_customer_partner_value", label: "Customer and partner value", description: "Connected voice AI to customer outcomes and honest SI discovery, validation, implementation, or support opportunities without inventing ROI or revenue." },
      { id: "seller_commercial_discipline", label: "Commercial and proof discipline", description: "Used MEDDPICC and Command of the Message where useful, handled proof accurately, and avoided unsupported commitments." },
      { id: "seller_next_step", label: "Concrete commercial next step", description: "Earned a specific action with an owner and timing tied to a customer need, without fabricating agreement." }
    ],
    evidenceGroups: [
      {
        label: "MEDDPICC",
        items: [
          ["metrics", "Metrics", "baseline|success metric|measure|measurement|waiting|repeat contact"],
          ["economic_buyer", "Economic buyer", "economic buyer|budget owner|budget|procurement|purchasing"],
          ["decision_criteria", "Decision criteria", "decision criteria|requirement|priorit|success criteria|must have"],
          ["decision_process", "Decision process", "decision process|approval|who decides|evaluation process|next stage"],
          ["paper_process", "Paper process", "paper process|contract|legal|procurement|security review"],
          ["identify_pain", "Identify pain", "waiting|repetitive|repeat|friction|pressure|problem"],
          ["champion", "Champion", "champion|sponsor|support operations|operations lead|advocate"],
          ["competition", "Competition", "compet|alternative|existing vendor|build in.house|current provider"]
        ]
      },
      {
        label: "Command of the Message",
        items: [
          ["current_pain", "Current-state pain", "current workflow|today|currently|waiting|repetitive"],
          ["desired_outcomes", "Desired outcomes", "desired outcome|faster|improve|goal|priority|customer experience"],
          ["required_capabilities", "Required capabilities", "required capabilities|integration|handoff|guardrail|monitor|testing"],
          ["differentiation", "Differentiation", "different|why eleven|natural voice|orchestration|partner"],
          ["proof", "Proof", "proof|evidence|Revolut|Deutsche Telekom|case study|source"],
          ["command_next_step", "Next step", "next step|working session|follow.up|invitation|Tuesday|validation"]
        ]
      }
    ]
  },
  "solutions-consultant": {
    id: "solutions-consultant",
    label: "Partner solutions consultant",
    shortLabel: "Solutions consultant",
    outcome: "Gather enough accurate technical information to justify solution design or a validation step, without overcommitting.",
    compass: "Map the workflow and constraints. Validate unknowns and bring in a specialist before making commitments.",
    talkTrack: [
      { title: "Workflow", text: "Trace one repeat-contact request from customer intent through agent lookup, response, documentation, and human escalation." },
      { title: "Systems and data", text: "Discover CRM, ticketing, telephony, service-status data, identity, permissions, and the context a human handoff needs. Do not assume vendors or available APIs." },
      { title: "Integration constraints", text: "Ask about existing architecture, security review, data access, regional requirements, latency expectations, and operational ownership." },
      { title: "Testing and monitoring", text: "Explore reply, tool-invocation, and simulation testing, plus quality review, alerting, transcripts, and operational controls." },
      { title: "Reliability and handoff", text: "Map unavailable data, low confidence, service failure, customer requests for a person, and graceful fallback. Bring in an FDE for detailed architecture or commitments." },
      { title: "Validation close", text: "Propose a bounded technical discovery or validation session with the right stakeholders, explicit unknowns, and evidence required for solution design." }
    ],
    rubric: [
      { id: "sc_workflow_discovery", label: "Workflow and systems discovery", description: "Mapped the current workflow, systems, data, handoffs, stakeholders, and integration constraints without assuming vendors." },
      { id: "sc_validation_coverage", label: "Validation and reliability coverage", description: "Explored testing, monitoring, failure paths, reliability, deployment constraints, and evidence required for design." },
      { id: "sc_technical_discipline", label: "Technical and handoff discipline", description: "Separated known facts from unknowns and used an FDE or specialist for architecture, security, proof, and commitments." },
      { id: "sc_next_step", label: "Concrete validation next step", description: "Established a specific technical discovery or validation action with an owner, timing, and required inputs." }
    ],
    evidenceGroups: [
      {
        label: "Technical discovery",
        items: [
          ["current_workflow", "Current workflow", "workflow|current process|CRM|ticketing|telephony|handoff"],
          ["systems_data", "Systems and data", "data|system|API|customer record|service status|permission"],
          ["integration_constraints", "Integration constraints", "integration|constraint|architecture|vendor|security|region"],
          ["failure_paths", "Failure paths", "failure|unavailable|fallback|low confidence|error|escalat"],
          ["testing_monitoring", "Testing and monitoring", "test|simulation|monitor|analytics|alert|quality"],
          ["reliability", "Reliability", "reliability|latency|uptime|load|degradation|recovery"],
          ["deployment_constraints", "Deployment constraints", "deployment|production|rollout|privacy|retention|residency"],
          ["validation_next_step", "Validation next step", "validation|technical discovery|working session|solution design|next step"]
        ]
      }
    ]
  }
};

export const commonHandoffCues = [
  { id: "architecture", label: "Detailed telephony or integration architecture", pattern: "telephony|SIP|architecture|Amazon Connect|Genesys|API" },
  { id: "security", label: "Security or compliance commitments", pattern: "security|compliance|HIPAA|PCI|GDPR|residency|retention" },
  { id: "proof", label: "Unsupported ROI or customer proof", pattern: "ROI|guarantee|Revolut|Deutsche Telekom|percent|case study" },
  { id: "production", label: "Production-readiness judgment", pattern: "production.ready|production|scale|load|uptime" },
  { id: "implementation", label: "Implementation commitment", pattern: "implementation date|delivery date|weeks|deadline|commitment|pricing" }
];

export const buyingSignalPatterns = [
  { id: "working_session", label: "Possible interest in a working session", pattern: "working session|workshop|discovery session" },
  { id: "validation", label: "Possible interest in validation or a pilot", pattern: "pilot|validation|proof of concept|test case" },
  { id: "stakeholders", label: "Possible stakeholder alignment", pattern: "operations lead|technical team|security team|procurement|stakeholder" },
  { id: "follow_up", label: "Possible follow-up action", pattern: "send the invitation|send.*advance|follow up|next step|Tuesday|schedule" }
];
