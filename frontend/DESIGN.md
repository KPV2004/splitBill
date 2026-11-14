---
name: SplitBill
description: Shared household bills in THB, split equally or by exact amounts, to the satang.
colors:
  rail: "#12493d"
  rail-hover: "#1a5a4b"
  rail-active: "#216a58"
  rail-line: "#2a6a5b"
  rail-text: "#eef6f2"
  rail-muted: "#a9cbbf"
  ground: "#f1f4f2"
  surface: "#ffffff"
  sunken: "#e8edea"
  line: "#d9e1dd"
  line-soft: "#e9eeeb"
  steel-400: "#a3b0ab"
  ink: "#17231f"
  ink-2: "#45554f"
  ink-3: "#5f6e68"
  positive: "#1b7650"
  ok-soft: "#e3f2ea"
  negative: "#b4372b"
  negative-soft: "#fbeae7"
  warn: "#7a5410"
  warn-soft: "#fbf1d9"
  enamel-jade: "#2a7f63"
  enamel-cobalt: "#2f5fb3"
  enamel-marigold: "#e2a527"
  enamel-plum: "#8a4fa0"
  enamel-teal: "#1f7f8c"
  enamel-rose: "#b8476e"
typography:
  display:
    fontFamily: "Anuphan, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  figure:
    fontFamily: "Anuphan, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\" 1, \"lnum\" 1"
  headline:
    fontFamily: "Anuphan, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  statement:
    fontFamily: "Anuphan, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.375
  wordmark:
    fontFamily: "Anuphan, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Anuphan, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
  title-sm:
    fontFamily: "Anuphan, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
  body:
    fontFamily: "Anuphan, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "Anuphan, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Anuphan, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
  caption:
    fontFamily: "Anuphan, Noto Sans Thai, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
rounded:
  sm: "6px"
  md: "8px"
  tier: "12px"
  card: "16px"
  carrier: "20px"
  pill: "9999px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "20px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.rail-text}"
    typography: "{typography.body}"
    rounded: "{rounded.tier}"
    padding: "12px 16px"
  button-primary-hover:
    backgroundColor: "{colors.rail-hover}"
  button-primary-disabled:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink-3}"
  button-quiet:
    textColor: "{colors.ink-3}"
    typography: "{typography.caption}"
    rounded: "{rounded.md}"
    padding: "4px 8px"
  button-destructive-confirm:
    backgroundColor: "{colors.negative}"
    textColor: "{colors.surface}"
    typography: "{typography.caption}"
    rounded: "{rounded.md}"
    padding: "4px 10px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.tier}"
    padding: "10px 14px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "24px"
  segmented-track:
    backgroundColor: "{colors.sunken}"
    rounded: "{rounded.tier}"
    padding: "4px"
  segmented-option-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  language-toggle:
    backgroundColor: "{colors.sunken}"
    rounded: "{rounded.pill}"
    padding: "2px"
  language-toggle-option-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  rail-item:
    textColor: "{colors.rail-text}"
    typography: "{typography.body}"
    rounded: "{rounded.tier}"
    padding: "10px 12px"
  rail-item-hover:
    backgroundColor: "{colors.rail-hover}"
  rail-item-active:
    backgroundColor: "{colors.rail-active}"
    textColor: "{colors.surface}"
  banner-error:
    backgroundColor: "{colors.negative-soft}"
    textColor: "{colors.negative}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.tier}"
    padding: "12px 16px"
  banner-success:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.positive}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.tier}"
    padding: "12px 16px"
  carrier:
    backgroundColor: "{colors.sunken}"
    rounded: "{rounded.carrier}"
    padding: "6px"
    height: "248px"
    width: "112px"
  carrier-tier:
    rounded: "{rounded.tier}"
    typography: "{typography.caption}"
---

# Design System: SplitBill

## Overview

**Creative North Star: "The Pinto Carrier"**

Every bill is one pinto enamel tiffin carrier: a fixed-height stack in which each roommate's share is an enamel tier, sized in exact proportion to its satang, filling the carrier to the rim and never past it. The world around the carrier is quiet and industrial-domestic: a deep enamel-green rail holds the households and the account, a cool brushed-steel ground sits behind white work surfaces, and the only saturated colour on a screen belongs to the people sharing the bill.

The tool is calm and dense, and it is used at household scale. Amounts are the content. They are set in tabular, lining figures, aligned right, and stay in ink, so the sign and the words say which way money flows. Depth is soft and tinted with the rail's green. Corners are rounded like pressed enamel: generous on containers, softer on tiers, and fully round on toggles and identity dots. Thai and English share one typeface (Anuphan) and one taller line height, so neither language reads as the afterthought.

The system rejects the fintech default: white cards with green/red figures beside a grey sidebar. Balance direction never comes from red-or-green numerals, and state never borrows a roommate's colour.

**Key Characteristics:**
- A deep enamel-green rail over a cool steel ground; white surfaces carry the work.
- Six roommate enamels, each assigned by member order and used only to mark identity.
- The carrier (and the MiniCarrier at row scale) is the signature form for any split.
- Every amount is tabular and right-aligned, with exactly two decimals.
- One family, Anuphan, sets both Thai and Latin text, with a 1.6 body line height.
- Soft, green-tinted shadows. No hard offsets and no borders around cards.

## Colors

A restrained steel-and-enamel-green field in which the only vivid hues are the six roommate enamels, plus a small set of muted state colours.

### Primary
- **Pinto Rail Green** (rail): the household rail, the auth-screen panel, the mobile tagline band, and every primary action button. It is the brand's one structural colour. Hover deepens toward **Rail Hover** (rail-hover). **Rail Active** (rail-active) fills the selected household. **Rail Line** (rail-line) separates the rail's account foot.
- **Rail Mist** (rail-text) and **Rail Sage** (rail-muted): text on the rail. Mist is for primary labels and button text. Sage is for secondary labels, balances shown on the rail, and inactive toggle options.

### Secondary: Roommate Enamels (identity only)
Assigned by each member's index in the household list (lib/members.ts), in this order:
1. **Jade** (enamel-jade): white text on fill.
2. **Cobalt** (enamel-cobalt): white text on fill.
3. **Marigold** (enamel-marigold): ink text on fill. It is the only light enamel.
4. **Plum** (enamel-plum): white text on fill.
5. **Teal** (enamel-teal): white text on fill.
6. **Rose** (enamel-rose): white text on fill. It comes last because it sits nearest the error red, so it appears only in six-person households.

An unknown member falls back to **Steel** (steel-400) with ink text.

### Tertiary: State
- **Ledger Green** (positive) on **Mint Wash** (ok-soft): success banners and the "shares add up" confirmation.
- **Brick** (negative) on **Blush Wash** (negative-soft): errors, the over-assigned message, field error text, delete confirmation, and the delete hover.
- **Ochre** (warn) on **Cream Wash** (warn-soft): "still to assign" while an exact split is short.

### Neutral
- **Brushed Steel Ground** (ground): the page behind everything.
- **Enamel White** (surface): cards, inputs, active segmented options.
- **Sunken Steel** (sunken): carrier shells, balance-bar tracks, segmented and toggle tracks, the disabled primary button, and quiet hover fills.
- **Line** (line) and **Soft Line** (line-soft): table header rule and input stroke; row dividers.
- **Steel** (steel-400): dashed open tiers, the balance-scale zero mark, input hover stroke, and the scrollbar thumb.
- **Ink** (ink), **Ink 2** (ink-2), **Ink 3** (ink-3): primary text and every amount; labels and secondary cells; captions, placeholders and hints.

### Named Rules
**The One Job Rule.** A roommate enamel marks whose share, payment or balance something is (tiers, dots, balance bars, ghost-tier outlines), and nothing else. It never signals owed/owes, over, error or success.

**The Jade Interaction Exception.** Jade is also the build's interaction accent: the focus outline, the input focus ring, the caret, the text selection, checkbox accents and inline links ("Everyone", "Create an account"). That is the only non-identity use of any enamel, and it covers interaction affordance only, never data state. Because it overlaps roommate 1's identity colour, treat it as provisional: do not extend jade to any new role.

**The Ink Figures Rule.** Balance and bill amounts are always ink. Direction comes from the sign (+ / −) and the words ("is owed", "owes"), not from red or green numerals.

**The Rail Owns Action Rule.** Primary actions are filled with rail green, never with an enamel. Enamels identify people. The rail is the voice of the tool.

## Typography

**Display Font:** Anuphan (with Noto Sans Thai, system-ui, sans-serif)
**Body Font:** Anuphan (same family)

**Character:** One humanist sans covers Thai and Latin, so a household name in Thai and a figure in Latin read as one voice. Hierarchy comes from weight (400 / 500 / 600 / 700) and size, with tight tracking (-0.025em) on headlines and the wordmark.

### Hierarchy
- **Display** (700, 2.5rem, 1.2): the auth-panel tagline only, balanced wrap, max about 26rem.
- **Figure** (700, 2.25rem, tabular): the headline amount in the balance sentence.
- **Headline** (700, 1.75rem, 1.25): household title and auth-screen title.
- **Statement** (600, 1.5rem, 1.375): the "You're owed / You owe" sentence around the figure.
- **Wordmark** (700, 1.375rem): "SplitBill" on the rail. Set as text, because no logo exists.
- **Title** (700, 1.25rem): panel titles such as "New bill" and the empty-state heading. **Title-sm** (700, 1.125rem): the "Bills" table heading.
- **Body** (400, 0.9375rem, 1.6): inputs, primary buttons, rail items, lead paragraphs.
- **Body-sm** (400, 0.875rem, 1.6): table cells, member lists, banners, secondary copy.
- **Label** (600, 0.875rem, ink-2): field labels and in-card section headings, in sentence case.
- **Caption** (400–600, 0.75rem): column headers, tier labels, hints, row meta, quiet buttons.

### Named Rules
**The Tabular Satang Rule.** Every amount carries tabular, lining figures ("tnum", "lnum") and right alignment within its column. Amounts always show two decimals.

**The Thai Line Rule.** Body line height stays at 1.6 so Thai vowels and tone marks above and below the line never collide. A phrase and its figure each stay unbroken (no wrapping), so Thai never breaks mid-phrase.

## Layout

The app shell is a fixed 15.5rem rail plus a fluid work area. From the `wide` breakpoint (80rem) the work area splits into two columns: the ledger column (header, banners, balances, bills) and a new-bill panel sized clamp(21rem, 26vw, 25rem). That panel sticks 2rem from the top. Below `wide`, everything collapses to one column in task order: header, balances, new bill, bills. Below `lg` (1024px) the rail becomes a top bar, and its household list scrolls horizontally. Below `sm` (640px) the bills table becomes stacked rows with the amount pinned right.

Components adapt with container queries, not viewport width. The balance card puts its sentence and member scale side by side only at a container width of 56rem. The new-bill form puts inputs and carrier side by side at 48rem. The carrier widens from 80px to 112px at 20rem.

Auth screens split into a rail-green promise panel (tagline plus a live carrier showcase) and a form column capped at 25rem. On narrow screens, a compact rail band carries the tagline and the carrier laid on its side.

The rhythm runs on 4px steps. Card padding is 24px. The gap between stacked cards is 20px, or 24px between columns at `wide`. Form fields sit 20px apart, and labels sit 6px above their fields. Page gutters are 20px (32px from `sm`), and vertical padding is 24px (32px from `lg`).

## Elevation & Depth

The system is a hybrid of tonal layering and soft lift. The ground, white surfaces and sunken steel wells carry most of the depth. Shadows are diffuse and tinted with rail green (never neutral black) and give white surfaces a gentle lift off the steel.

### Shadow Vocabulary
- **Surface** (`box-shadow: 0 1px 2px rgb(18 73 61 / 0.06), 0 4px 16px -6px rgb(18 73 61 / 0.12)`): balance and bills cards, the active segmented option, the active language option, the enabled primary button.
- **Raised** (`box-shadow: 0 2px 4px rgb(18 73 61 / 0.08), 0 12px 32px -12px rgb(18 73 61 / 0.22)`): only the new-bill panel, the one surface where work is being composed.

### Named Rules
**The One Raised Panel Rule.** Only the composing surface (the new-bill panel) is raised. Everything else stays at surface lift or flat.

## Shapes

The form language is pressed enamel. Cards are rounded to 16px. Inputs, buttons, banners and tiers are rounded to 12px, the shared "tier" radius. Small controls, rail sign-out and segmented options are rounded to 8px. The carrier shell is rounded to 20px, so tiers nest inside it with a 6px inset. Toggles, the over-assigned label, balance bars and identity dots are fully round. Cards have no borders. Strokes appear only on inputs (1px line), on dashed open tiers (2px steel or roommate colour), and as the 2px ink ring on an over-assigned carrier.

## Components

### Buttons
Buttons are solid and quiet. Rail green does the talking.
- **Shape:** tier radius (12px).
- **Primary:** rail-green fill with Rail Mist text, body size at 600 weight, 12px × 16px padding, surface shadow. It is full width in forms.
- **Hover / Focus:** fill shifts to rail-hover over a colour transition. Focus is a 2px jade outline offset 2px (Rail Mist on the rail).
- **Disabled:** sunken fill, ink-3 text, no shadow, a not-allowed cursor. A one-line caption below explains what is still missing.
- **Quiet:** ink-3 caption text with an icon, 8px radius. Hover fills with sunken, or with Blush Wash and Brick for delete.
- **Destructive confirm:** a small Brick fill with white text, paired with a quiet "cancel". Delete always takes two steps, inline.

### Segmented control and language toggle
- **Split type:** a sunken track (12px radius, 4px inset). The active option is an enamel-white chip with surface shadow. Inactive options are ink-3 and darken to ink on hover.
- **Language:** a fully round pill track with fully round options. On the rail the track is rail-hover and the active option is Rail Mist with rail-green text.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** Enamel White on the steel ground.
- **Shadow Strategy:** surface lift. The raised level is reserved for the new-bill panel.
- **Border:** none.
- **Internal Padding:** 24px. Table cards bleed rows to the edge with 24px cell insets.

### Inputs / Fields
- **Style:** Enamel White fill, 1px line stroke, 12px radius, 10px × 14px padding, body size. Amount inputs are tabular and right-aligned.
- **Hover / Focus:** stroke moves to steel on hover. On focus the stroke turns jade, with a 2px jade ring at 25% opacity.
- **Error:** Brick stroke, a Brick ring at 20% opacity, and 0.75rem Brick text below the field.
- **Selects:** native, with appearance removed and an SVG chevron icon at the right.

### Navigation (household rail)
- **Style:** a rail-green column. The wordmark sits at the top, the "Households" label is in Rail Sage, and each household item shows its name with your signed balance in Sage tabular figures.
- **States:** default Rail Mist; hover rail-hover fill; active rail-active fill, white, 600 weight, `aria-current`.
- **Foot:** the language toggle, "signed in as", and sign-out above a rail-line rule.
- **Mobile:** below 1024px it becomes a top bar with a horizontally scrolling household strip and icon-only sign-out.

### Banner
A single dismissible banner for all messages. Errors use Blush Wash with Brick text and an alert icon. Successes use Mint Wash with Ledger Green text and a check icon. Both are 12px radius with 12px × 16px padding at body-sm size.

### Balance scale
Each roommate gets one row: an identity dot and name, then a diverging bar on a sunken track with a steel zero mark at the centre (bars run right when owed money, left when owing), filled with the roommate's enamel. A right-aligned signed ink figure with a caption state ("is owed" / "owes") ends the row.

### The Carrier (signature)
The carrier is a fixed 248px-tall sunken shell (20px radius, 6px inset, 4px gaps). Tiers are rounded to 12px and filled with each roommate's enamel. Their heights follow their satang (flex-grow = cents). Tiers shorter than 26px drop their label, because the legend beside the carrier carries the numbers. States:
- **Empty:** one dashed ghost tier per sharing roommate, outlined in their enamel at 60% opacity.
- **Short (exact split):** the unassigned remainder is an open dashed steel tier.
- **Over (exact split):** the stack cannot exceed the rim. An ink pill shows the overflow amount above it, and the shell gets a 2px ink ring and diagonal ink hatching. Red and roommate colours are never used for this state.
- **Motion:** tiers grow and shrink over 320ms on an expo-out curve (cubic-bezier(0.16, 1, 0.3, 1)), with fills crossfading over 200ms. Motion is turned off under reduced motion.
- **MiniCarrier:** the same stack at row scale (14px × 32px, 1px gaps) leads every bill row.

### Icons
A small inline SVG set: 24px grid, 1.75 stroke, round caps and joins, sized in em and inheriting currentColor. Icons are decorative, and the control around each one carries the accessible name.

## Do's and Don'ts

### Do:
- **Do** give each roommate exactly one enamel, chosen by their position in the household member list, and reuse it for every tier, dot and bar of theirs.
- **Do** render any split as a carrier (or MiniCarrier) whose tiers sum exactly to the rim.
- **Do** set every amount in tabular, lining figures, right-aligned, in ink, with two decimals.
- **Do** fill primary actions with rail green (#12493d) and deepen to rail-hover on hover.
- **Do** keep body text at line height 1.6 and set Thai and English in Anuphan.
- **Do** tint shadows with rail green and reserve the raised shadow for the composing panel.
- **Do** switch component layouts on container width, not viewport width.

### Don't:
- **Don't** use a roommate enamel to signal data state: no green-for-owed, no red-for-owes, no enamel on errors or overflow. Jade's interaction role (focus, links, checkbox accent) is the single recorded exception.
- **Don't** colour balance or bill figures red or green; direction comes from the sign and the words.
- **Don't** draw the over-assigned state in red on a roommate's colour; use the ink pill, ink ring and hatching.
- **Don't** let a carrier grow taller than its fixed height to fit more satang.
- **Don't** add borders around cards or use hard, offset, untinted shadows.
- **Don't** set a separate Latin display face beside Anuphan; Thai and English share one family.
