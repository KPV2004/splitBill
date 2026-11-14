---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["app/login/page.tsx","app/register/page.tsx"]
---

# Surface: SplitBill app (household ledger) + login/register

Scope: `/` (household ledger), `/login`, `/register`. Visitor mode: **Operate**.
Audience: roommates on desktop, monthly bill-splitting; Thai + English toggle.
Task: see where you stand, record a bill with an equal or exact split, delete your own bills, sign in / create an account.
Constraints: groups are seeded (no create-group); auth runs against the mock backend this phase.
Chosen sketch: `.impeccable/mocks/decision/assigned.html`.

## Direction contract

THESIS: Every bill is one pinto carrier; each roommate's share is an enamel tier stacked to the exact total. Refuses the fintech default of white cards with green/red figures and a grey sidebar.

OWN-WORLD: Deep enamel-green rail (#12493d) over a cool brushed-steel ground (#f3f5f2); white work surfaces with soft offset shadow; roommates each own one enamel colour (jade, cobalt, tomato, marigold, plum) used only for identity: tiers, dots, balance bars. Anuphan for Thai and Latin; all amounts tabular, right-aligned. Rounded tier bands (12px), pill toggles.

STORY: The member sees their balance and everyone's at once, understands each bill by its mini tier stack, and records a new bill knowing the stack will be exact before saving.

FIRST VIEWPORT: Left 248px green rail: SplitBill, household list with your balance each, you + sign-out + language at the foot. Centre: household title; two panels: your balance sentence and per-member diverging balance bars; below, the bills table with a mini tier stack per row. Right 400px panel: new-bill form with the live carrier stack and the save button.

FORM: Pinto enamel tiffin carrier, candidate 4 of 7 on my ordered list; seed:9a5bdf62b03b8395. Signature interaction: the carrier stack fills tier by tier as amounts are typed, an exact split's unassigned remainder is a dashed open tier, and overflow spills red above the rim.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Raises
- From terminal-yellow wayfinding: enamel colours do one job only, identifying a roommate.
- From the cassette j-card: the carrier has a fixed height; exact splits visibly cannot overflow.
- From datamatics: every amount in strict tabular columns, right-aligned to the satang.

## Recorded adaptations (after finish review)
- Balances are one card, not two panels: the sentence and the member scale state one fact ("where everyone stands") and read together; the card is a container that lays them side by side only when it is wide.
- Three columns start at the `wide` breakpoint (80rem) with a clamp(21rem, 26vw, 25rem) panel, so the bills table stays in the first viewport on 1280–1399px laptops; below it, one column (balances, new bill, bills).
- Balance figures are ink; direction is carried by the sign and the words. Enamel colours stay identity-only.
- Over-assigned state is an ink label over a hatched, ink-ringed carrier, never red-on-roommate. Rose is the 6th enamel (nearest the error red), marigold the 3rd.
- Phones: bills render as stacked rows; the login screen shows a compact band with the tagline and the carrier laid on its side.

## Unresolved
- Dark theme not in scope for this pass.
