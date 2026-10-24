# Gloss Tools product interface design contract

Status: canonical for new user-facing work
Version: 1.0
Applies to: every product in the Gloss Tools by GlossQuote family

## 1. Purpose

This file is the shared product-design source of truth for Gloss Tools. It
defines the family resemblance, interaction model, safety presentation, and
quality floor. It does not require every product to use the same page layout.

The system is Apple-inspired in product thinking, not Apple-styled. We adopt
task focus, clarity, familiarity, direct feedback, forgiveness, and
responsible handling of data. We do not imitate Apple hardware, translucent
materials, platform chrome, proprietary icons, or marketing layouts.

In this document:

- **MUST** is a release requirement.
- **SHOULD** is the default; a product-specific surface brief can record a
  reason to differ.
- **MAY** is optional and must still serve the user's job.

When this document conflicts with a product's security contract, the stricter
security rule wins. When a third-party design skill conflicts with this file,
this file wins.

## 2. The product promise

Gloss Tools turns complicated automation into a small number of clear,
controlled decisions. The interface should make people feel:

1. **I can see the work.** The current artifact, decision, or result owns the
   largest and calmest part of the screen.
2. **I know what happens next.** The primary action is specific and the system
   shows its effect before a consequential change.
3. **I remain in control.** The product reveals scope, cost, recipients,
   reversibility, and data handling at the point they matter.
4. **I can recover.** Back, cancel, edit, retry, revoke, and undo are available
   when the underlying action permits them.
5. **I do not need to learn the implementation.** Labels describe the
   person's goal, not an API, database table, agent run, or internal module.

Simplicity does not mean removing useful capability. It means showing the
right capability at the right moment with a predictable path to the rest.

## 3. Visual idea: the precision worksheet

The Gloss Tools visual world comes from inspection sheets, estimate cards,
calibration marks, and well-kept workshop tools:

- warm paper is the working surface;
- ink represents committed information and final output;
- acid green marks a safe selection, readiness, or a primary completion path;
- coral marks attention and editorial emphasis, not danger;
- monospaced type is reserved for measured values, identifiers, and compact
  machine state;
- rules, dots, and labels explain structure instead of decorating empty space.

The palette alone is not the identity. Combining warm paper, acid green,
monospace labels, giant type, hard shadows, and card grids on every surface
would look generated. Spend visual emphasis once per view, and let the real
work provide the rest of the character.

## 4. Surface modes

Every surface MUST name one mode before design begins.

### 4.1 Marketing

Goal: help a visitor understand, trust, and decide.

- Large editorial type, the Georgia accent face, offset shadows, expressive
  crops, and one memorable visual gesture MAY be used.
- The first viewport SHOULD show the product doing real work, not an abstract
  illustration or generic metric cards.
- Claims MUST be true and evidenced. Examples MUST be labeled as examples.
- A page gets one dominant call to action per decision point.

### 4.2 Product app

Goal: help a person complete a task.

- The task canvas MUST dominate. Persistent brand decoration MUST recede.
- Use flat surfaces, precise separators, restrained elevation, and familiar
  controls. Do not import landing-page spectacle into the workspace.
- Frequent controls remain visible; contextual controls sit next to what they
  affect; advanced controls are one disclosure layer away.
- The interface MUST preserve function on smaller screens rather than hiding
  it without an alternative.

### 4.3 Customer embed

Goal: let the host business's customer complete one narrow interaction.

- Host-brand content and the customer's task take priority.
- GlossQuote identity MAY appear only as a quiet attribution at the end.
- The host accent can replace the configurable accent token, but structure,
  focus, contrast, state, and safety rules remain fixed.
- No unrelated upsell may interrupt task completion. A creator-product link,
  when contractually allowed, stays secondary to the host's primary action.

Documentation and long-form help use Product App restraint with a reading
measure of 60–75 characters and persistent orientation.

## 5. Information hierarchy

### 5.1 Give the task the room

The task canvas MUST be the largest single contiguous region and the only
column that grows with available width. In the Wide shell it receives at least
50% of content width when both side regions are open; in Standard it receives
at least 65% when one side region is open; in Compact it receives the full
width until the person explicitly opens another region.

The default desktop shell is:

```text
┌──────────────────────────── concise top bar ────────────────────────────┐
│ product / location                           status        key action   │
├───────────────┬───────────────────────────────────┬─────────────────────┤
│ tool rail     │                                   │ inspector (optional)│
│ 224–240 px    │            task canvas            │ 300–320 px          │
│               │          flexible + primary       │ contextual details  │
│               │                                   │                     │
└───────────────┴───────────────────────────────────┴─────────────────────┘
```

- Show no more than two persistent side regions.
- The inspector is absent until it has relevant content.
- On tablet, collapse the inspector into an explicit panel.
- On mobile, use a full-width canvas and a labeled bottom sheet or routed
  detail view. Do not silently delete the rail's capabilities.
- A command palette or search MAY accelerate navigation, but MUST NOT be the
  only way to discover a core function.

### 5.2 Three discovery tiers

1. **Always visible:** the current object, current state, primary action,
   safety-critical facts, and the two or three most frequent controls.
2. **Adjacent:** actions that apply to the selected object, placed in its
   toolbar, row, panel, or inspector.
3. **Progressive:** rare configuration, bulk tools, and expert detail behind a
   plainly named disclosure, never behind a mystery icon or hidden gesture.

A person SHOULD reach any core function in one interaction and any advanced
function in two. Destructive or permission-expanding actions may require a
separate review step.

### 5.3 One state, one primary action

Each state has one visually primary action. Other actions use secondary or
quiet styling according to consequence, not business preference. Equal visual
weight means the options are genuinely equal.

Controls MUST be placed near their result. A change that can be previewed MUST
update the preview immediately or clearly offer **Preview changes**.

## 6. AI interaction contract

AI is a capability inside the product, not the information architecture.

- Organize screens around the user's artifact and outcome, never around
  agents, chains, runs, prompts, or model internals unless those are the task.
- A chat composer MUST NOT displace the artifact when direct manipulation is
  clearer. Put instructions beside or below the work they affect.
- Before a high-impact action, show a compact review of **who**, **what**,
  **where**, **cost**, **recipients**, **data sent**, and **reversibility**.
- Separate proposed, needs-input, ready, running, completed, blocked, and
  failed states. Never use a spinner as the only explanation.
- Show meaningful progress and make cancellation available when technically
  safe.
- Never imply that generated output is verified when it is not.

When intent is materially unclear:

1. ask one question at a time;
2. provide two or three mutually exclusive options;
3. put the safest recommended option first and mark it visibly;
4. explain the consequence of each option in one short sentence;
5. do not invent a free-form path that bypasses the safety boundary;
6. resubmit the resulting complete request through the normal decision path.

Routine low-impact settings MAY use sensible defaults when the choice is
reversible and visibly editable. Cost, publication, recipients, credentials,
permissions, deletion, and legal commitments MUST NOT be guessed.

## 7. Safety and secrets in the interface

The safest workflow should also be the easiest workflow.

### 7.1 Credential entry

- Request a credential only in a dedicated setup surface, never in chat,
  ordinary notes, a URL, a command example, or a support message.
- State why it is needed, the minimum scope, where it is stored, which service
  receives it, and how to revoke it before showing the field.
- Secret fields are masked by default. Reveal is deliberate and temporary;
  it MUST NOT change the stored value or copy automatically.
- Never prefill a realistic-looking secret. Examples use unmistakable text
  such as `YOUR_API_KEY`.
- A secret MUST NOT enter a model prompt, agent context, tool result, model
  memory, or retrieval index. The agent receives only fixed connection status,
  capability, scope, and redacted error codes.
- If persistence is genuinely required, use only an explicitly approved OS
  credential store, native secret vault, or encrypted store whose encryption
  key is held separately. Never persist plaintext in source, config, a database,
  browser storage, command arguments, environment variables, or temporary
  files.
- Decrypt only at the final trusted integration boundary, as late as possible,
  and clear transient buffers after use. Do not return the value through the
  agent to reach the provider.
- After saving, show connection state and last successful check, not the
  secret. Provide **Replace credential** and **Disconnect** paths.
- Do not place secrets in toast text, logs, receipts, analytics, URLs, browser
  storage, screenshots, or copyable error details.
- A product that does not need the secret MUST not accept it. GlossGate v0.1,
  for example, has no credential field at all.

### 7.2 Consequential actions

- Review screens use plain facts, not alarmist decoration.
- The primary button names the effect: **Publish 1 post**, **Send to 3
  recipients**, or **Delete policy**, not **Continue**.
- Irreversible actions need explicit wording and a separated danger action.
- Reversible actions SHOULD offer undo near the success feedback.
- Blocked states explain the reason and the safest available next step.
- Risk state MUST use an icon and text in addition to color.

## 8. Canonical tokens

Products SHOULD consume semantic tokens instead of literal values. A product
may add tokens but MUST NOT redefine a shared token's meaning.

```css
:root {
  color-scheme: light;

  /* Family color */
  --gq-color-ink: #111410;
  --gq-color-paper: #f3f0e8;
  --gq-color-paper-subtle: #e7e4dc;
  --gq-color-surface: #ffffff;
  --gq-color-acid: #c8f56a;
  --gq-color-coral: #ff6846;

  /* Text and structure */
  --gq-color-text: #111410;
  --gq-color-text-muted: #55594f;
  --gq-color-separator: #b8bbb2;
  --gq-color-control-border: #60645c;
  --gq-color-border-strong: #111410;
  --gq-color-dark-text: #f7f5ef;
  --gq-color-dark-muted: #c2c6bc;
  --gq-color-dark-separator: #3b4037;
  --gq-color-dark-control-border: #60645c;

  /* Semantic state; pair with words and icons */
  --gq-color-success-text: #245c16;
  --gq-color-success-surface: #e8f8c7;
  --gq-color-warning-text: #713f00;
  --gq-color-warning-surface: #fff0d5;
  --gq-color-danger-text: #8f2119;
  --gq-color-danger-surface: #ffe6e1;
  --gq-color-info-text: #254f75;
  --gq-color-info-surface: #e6f1fa;

  /* Type */
  --gq-font-ui: "Geist", "Segoe UI", system-ui, sans-serif;
  --gq-font-data: "Geist Mono", "Cascadia Mono", ui-monospace, monospace;
  --gq-font-editorial: Georgia, "Times New Roman", serif;
  --gq-text-xs: 0.75rem;
  --gq-text-sm: 0.875rem;
  --gq-text-md: 1rem;
  --gq-text-lg: 1.25rem;
  --gq-text-xl: 1.75rem;
  --gq-text-2xl: clamp(2rem, 4vw, 3.5rem);

  /* Space */
  --gq-space-1: 0.25rem;
  --gq-space-2: 0.5rem;
  --gq-space-3: 0.75rem;
  --gq-space-4: 1rem;
  --gq-space-6: 1.5rem;
  --gq-space-8: 2rem;
  --gq-space-12: 3rem;
  --gq-space-16: 4rem;
  --gq-space-24: 6rem;

  /* Shape and motion */
  --gq-radius-control: 0.375rem;
  --gq-radius-panel: 0.625rem;
  --gq-radius-pill: 999px;
  --gq-border-thin: 1px;
  --gq-shadow-marketing: 0.75rem 0.75rem 0 #111410;
  --gq-shadow-floating: 0 1rem 3rem rgb(17 20 16 / 12%);
  --gq-duration-fast: 120ms;
  --gq-duration-standard: 180ms;
  --gq-ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);

  /* Product App layout */
  --gq-layout-content-max: 90rem;
  --gq-layout-reading-max: 72ch;
  --gq-layout-topbar-height: 3.5rem;
  --gq-layout-rail-width: 15rem;
  --gq-layout-inspector-width: 20rem;
  --gq-layout-canvas-min: 30rem;
  --gq-layout-gutter-compact: 1rem;
  --gq-layout-gutter-standard: 1.5rem;
  --gq-layout-gutter-wide: 2rem;
}
```

Rules:

- Acid green uses ink text; it is not body-copy color on a light surface.
- Coral is decoration or large emphasis. It MUST NOT carry small text on paper.
- The separator tokens are for nonessential grouping and dividers only. A
  control whose boundary is necessary to recognize it MUST use the matching
  control-border token or another verified color with at least 3:1 contrast
  against its surface. `#60645c` has at least 3:1 contrast against the family
  white, paper, and ink surfaces.
- Marketing MAY use the hard offset shadow. Product App uses it only for a
  deliberate drag/preview affordance; ordinary panels stay flat.
- Product UI body copy is 15–17 px. Supplementary text MUST be at least 12 px.
- Product headings normally stop at 32–36 px. Marketing display type may grow
  larger when the page still works at 200% zoom.
- UI labels use the UI face. Data identifiers use the mono face. The editorial
  face belongs to Marketing emphasis, never form labels or operational data.
- Use the spacing scale. Do not invent 17 px, 23 px, or other one-off gaps to
  patch weak grouping.
- Controls use the control radius, containers use the panel radius, and true
  status/filter chips use the pill radius. Do not round every rectangle.

### 8.1 Responsive layout constants

CSS custom properties cannot be used directly as media-query conditions, so
implementations MUST use these exact shared breakpoint constants:

| Range | Width | App-shell behavior | Inline gutter |
|---|---:|---|---:|
| Compact | `< 48rem` | Canvas only; rail becomes labeled navigation; inspector becomes a routed detail view or bottom sheet. | `1rem` |
| Standard | `48rem–74.999rem` | Canvas plus one collapsible side region. Never show rail and inspector persistently together. | `1.5rem` |
| Wide | `≥ 75rem` | `15rem` rail, flexible canvas with a `30rem` minimum, optional `20rem` inspector. | `2rem` |

The top bar is `3.5rem` in Product App mode. The shell is capped at `90rem`
only when extra width would reduce comprehension; dense canvases such as code,
tables, and diagrams MAY extend wider. A layout MAY collapse earlier when real
content would otherwise clip, but MUST NOT postpone collapse beyond the shared
breakpoint to preserve decoration.

## 9. Component contracts

Shared names describe behavior, not a required framework.

| Component | Required behavior |
|---|---|
| `AppShell` | Keeps location, task canvas, optional rail, optional inspector, status, and primary action predictable. |
| `TopBar` | Shows product/location and current global state; contains no marketing slogan. |
| `ToolRail` | Contains frequent destinations with text labels; collapses without removing access. |
| `TaskCanvas` | Owns available space, real content, selection, and direct manipulation. |
| `Inspector` | Shows properties/actions for the current selection; absent when irrelevant. |
| `ActionBar` | Places one primary action near the affected content and preserves keyboard order. |
| `Button` | Has default, hover, pressed, focus, disabled, busy, and error-adjacent behavior; label names the result. |
| `IconButton` | Uses a familiar symbol, accessible name, tooltip on hover/focus, and at least a 44 px target for touch contexts. |
| `Field` | Keeps a visible label, optional help, value, and field-specific error together; placeholder is never the label. |
| `SecretField` | Follows the credential contract and never displays saved secret material. |
| `ChoiceGroup` | Presents two or three mutually exclusive options with consequence text and an explicit recommendation. |
| `StatusBadge` | Uses word + icon + color; reserves monospace for short machine state. |
| `InlineNotice` | Explains relevance and next action without blocking unrelated work. |
| `DecisionPanel` | Shows effect, target, scope, cost, recipients, reversibility, reason, and next step. |
| `ReceiptRow` | Shows fixed metadata and hashes without prompts, secrets, or personal data. |
| `EmptyState` | Explains why the space is empty and offers one useful next action. |
| `Dialog` | Is reserved for interruption, confirmation, or a short focused choice; it restores focus on close. |
| `Toast` | Confirms a completed low-risk result; it never contains the only copy of an error or required action. |

Avoid nested cards. Prefer whitespace, alignment, headings, and separators.
Use a container only when its boundary changes behavior, selection, background,
scrolling, or ownership.

## 10. State model

Every data-bearing or asynchronous surface MUST be designed and tested for:

- initial/idle;
- loading or running with a meaningful label;
- partially available data;
- empty with a next step;
- success with the changed state visible;
- recoverable error with a recovery action;
- blocked with reason and safe next step;
- permission or authentication loss;
- offline/timeout when relevant;
- dense and long-content cases.

GlossGate maps decisions as follows:

- **Allow:** acid/success surface, check symbol, `Allowed`, matched rule, and the
  exact low-impact scope. Green never means that GlossGate executed the action.
- **Ask:** warning surface, one question, two or three choices, safest choice
  first, and a statement that no action proceeds yet.
- **Block:** danger surface, stop symbol, `Blocked`, stable reason, and a safe
  path such as editing the request or policy. Never offer a bypass button.

## 11. Interaction and motion

- Default hover/press micro-feedback uses 120–180 ms and translates no more
  than 4 px. A spatial transition such as opening a sheet MAY travel from its
  real origin to destination when that movement explains where content went.
- Motion explains state, spatial origin, or direct response. Do not animate
  every section into view or give every card a hover lift.
- A custom button MUST show pressed feedback.
- Activation changes the control's pressed or busy state synchronously before
  awaited work. If work continues, show a meaningful progress state and
  preserve layout to avoid shifting controls.
- Honor `prefers-reduced-motion`; essential state changes remain visible
  without movement.
- Dragging MUST have a single-pointer or keyboard alternative unless the
  gesture is intrinsic to the task.
- Never use an infinite decorative animation inside Product App mode.

## 12. Accessibility and responsive floor

Every release targets WCAG 2.2 AA and MUST meet these observable checks:

- All workflows operate by keyboard in a logical order.
- Every focusable control has a visible, unobscured focus indicator. Use a
  two-layer focus treatment that remains visible on paper, white, acid, and
  ink surfaces, for example a 2 px ink outline plus a 4 px acid outer ring.
- Normal text contrast is at least 4.5:1; large text and non-text controls are
  at least 3:1.
- Primary and touch controls target 44 × 44 CSS px. No pointer target falls
  below WCAG's 24 × 24 CSS px minimum without an allowed spacing/equivalent
  exception.
- Status, selection, validation, and risk never rely on color alone.
- Text can resize to 200% without loss of content or function.
- At 320 CSS px viewport width, content reflows without two-dimensional page
  scrolling. Essential two-dimensional regions such as a data table, diagram,
  code editor, or spatial canvas MAY scroll within their own labeled region;
  surrounding instructions and actions still reflow and remain reachable.
- Labels remain visible while typing. Errors are programmatically associated
  with their fields and focus moves only when it helps recovery.
- Dynamic updates use appropriate status semantics without repeatedly
  interrupting assistive technology.
- Touch, pointer, keyboard, and screen-reader paths receive the same function.
- Layout tolerates at least 40% longer translated labels. Numbers, dates,
  currencies, and pluralization use locale-aware formatting.
- Mobile safe areas, virtual keyboards, sticky regions, and dialogs never
  obscure the focused control or primary action.

## 13. Voice and interface writing

- Use the user's terms and active, concise, sentence-case language.
- Name the same action consistently from control to result.
- Buttons state the outcome: **Save policy**, not **Submit**; **Try again**, not
  **OK**.
- Error copy says what happened, what remains safe, and what the person can do.
- Do not apologize, blame the person, or expose a raw exception.
- Do not use filler such as *seamless*, *revolutionary*, *supercharge*, or
  *AI-powered* when a concrete benefit can be stated.
- Avoid decorative eyebrow labels, all-caps section labels, arbitrary `01/02/03`
  numbering, and arrows appended to every link. Use them only when they encode
  real hierarchy, status, or sequence.
- Never invent testimonials, customer counts, savings, security certification,
  benchmark results, or integration support.

## 14. Anti-template test

Before a surface is accepted, answer each question from the rendered result:

1. Does the first view show the person's real task or a generic SaaS hero?
2. Could the same layout and copy be pasted into an unrelated AI product?
3. Is content chopped into equal cards even though its relationships differ?
4. Are cards nested, every corner rounded, or every section animated?
5. Do gradients, glows, fake browser chrome, floating orbs, or abstract 3D
   objects appear without explaining the product?
6. Are mono labels, acid green, editorial italics, and hard shadows all
   competing at once?
7. Are fake charts or sample records replacing a real empty state?
8. Is a mystery icon, hover-only affordance, or command palette hiding a core
   function?
9. Is the AI conversation larger than the artifact the person came to work on?
10. Can one decorative element be removed without losing meaning? Remove it.

One signature gesture may remain when it is specific to the product's job. The
rest of the design should feel inevitable rather than decorated.

## 15. Bounded design workflow

Future UI tasks follow this order:

1. **Frame the job.** Record user, context, primary job, success state,
   frequency, risk, platform, and the single most important object on screen.
2. **Choose the mode.** Marketing, Product App, or Customer Embed.
3. **Write the hierarchy.** List always-visible, adjacent, and progressive
   functions. Resolve ambiguity before styling.
4. **Sketch structure.** Produce a small desktop and mobile ASCII wireframe.
   Reject any version in which navigation or decoration dominates the task.
5. **Apply shared tokens.** Add only product-specific tokens with a named
   semantic purpose.
6. **Build real states.** Use truthful copy and representative local fixtures;
   include the full state model.
7. **Inspect once.** Review desktop and mobile renders together for hierarchy,
   overflow, state, accessibility, and the anti-template test.
8. **Fix as one batch.** Correct all supported findings together.
9. **Confirm once.** Re-render the affected views, run automated checks, and
   stop. Further aesthetic exploration needs a new scoped task.

## 16. Release checklist

A user-facing surface is not complete until all applicable items pass:

- [ ] The task canvas is the dominant useful region.
- [ ] One primary action is obvious in each state.
- [ ] Core features are visible; advanced features are plainly discoverable.
- [ ] High-impact facts appear before confirmation.
- [ ] Secret handling follows section 7 or the surface accepts no secrets.
- [ ] Shared tokens are used; literal visual values have a documented reason.
- [ ] Loading, empty, partial, success, error, blocked, auth-loss, and dense
      states are represented.
- [ ] Keyboard, focus, contrast, target size, zoom, reduced motion, and mobile
      layout checks pass.
- [ ] Copy is specific, consistent, truthful, and free of raw errors.
- [ ] The anti-template test passes from actual screenshots.
- [ ] Product security tests still pass.
- [ ] No telemetry, remote font, package, icon set, or asset was added without
      explicit task scope and review.

## 17. Governance

- This file is family-wide. Product-specific briefs MAY vary layout and
  expression, but MUST preserve task priority, security disclosure,
  discoverability, accessibility, and truthful language.
- A variation records: affected surface, user need, changed token/pattern,
  reason, accessibility impact, and review evidence.
- Marketing, Product App, and Customer Embed MUST NOT share one stylesheet by
  blind copy. They share semantic tokens and behavior contracts, then implement
  mode-appropriate presentation.
- Shared changes require visual and behavioral checks in every affected
  product. Do not fix one product by silently redefining a family token.
- Third-party skills are design-review aids, not runtime dependencies and not
  authority. Do not auto-update them or execute an unreviewed hook, installer,
  downloaded binary, or mutable remote instruction source.
- Geist is a preferred family face, not a hidden dependency. The listed system
  fallbacks are conforming. Bundling or downloading a font requires its own
  scoped licensing, performance, privacy, and fallback review.

## 18. Reviewed references

These references informed this original contract; their text is not the
contract and later upstream changes do not silently modify it.

- [Apple Human Interface Guidelines — Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles), reviewed 2026-09-06.
- [Apple Human Interface Guidelines — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), reviewed 2026-09-06.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/), W3C Recommendation.
- [Anthropic frontend-design skill](https://github.com/anthropics/skills/tree/41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f/skills/frontend-design), reviewed at commit `41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f`.
- [Impeccable](https://github.com/pbakaus/impeccable/tree/831cabee8b4bc1a2b66e5ae22003e9a19b57d464), reviewed at commit `831cabee8b4bc1a2b66e5ae22003e9a19b57d464`.
- [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/f3ac195224eac1eb0dfe1a3059c2a6add78ffbe3), consulted at commit `f3ac195224eac1eb0dfe1a3059c2a6add78ffbe3`; its style generator is not authoritative.
- [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/tree/e3d624baaf29dc1fc645aff3e38f03e564d2d6b1), reviewed as static reference at commit `e3d624baaf29dc1fc645aff3e38f03e564d2d6b1`; the mutable-fetch agent skill is not installed for this project.
