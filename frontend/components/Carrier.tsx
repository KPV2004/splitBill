import { formatCents } from "@/lib/money";
import type { MemberColor } from "@/lib/members";

export interface CarrierTier {
  member: string;
  cents: number;
  color: MemberColor;
}

interface CarrierProps {
  tiers: CarrierTier[];
  /** Exact split: cents not yet assigned, drawn as an open dashed tier. */
  remainingCents?: number;
  /** Exact split: cents assigned beyond the total, drawn spilling over the rim. */
  overCents?: number;
  /**
   * No amount yet: the carrier shows one open, unlabelled tier per roommate who
   * will share the bill, outlined in their colour (`ghosts`), so the stack is
   * ready to fill before the first keystroke.
   */
  empty?: boolean;
  ghosts?: MemberColor[];
}

/** Fixed carrier height in px; tiers share it in proportion to their cents. */
const HEIGHT = 248;
/** A tier shorter than this hides its label (the legend still has it). */
const MIN_LABEL_HEIGHT = 26;

/**
 * The pinto carrier: one bill as a fixed-height stack, each roommate's share a
 * tier in their enamel colour, proportional to the cents. The stack can never
 * overflow its rim, so an over-assigned exact split spills above it: an ink
 * label over a hatched, ink-ringed carrier (state never borrows a roommate colour).
 * Decorative for assistive tech — the legend beside it carries the numbers.
 */
export function Carrier(props: CarrierProps) {
  const { overCents = 0, empty = false, ghosts = [] } = props;
  const tiers = empty ? [] : props.tiers;
  const remainingCents = empty ? 1 : (props.remainingCents ?? 0);
  const filled = tiers.reduce((sum, tier) => sum + tier.cents, 0);
  const capacity = Math.max(filled + remainingCents, 1);
  const spilling = overCents > 0;

  return (
    <div className="relative w-20 shrink-0 pt-7 @xs:w-28" aria-hidden="true">
      {spilling && (
        <div className="num absolute inset-x-0 top-0 rounded-full bg-ink px-2 py-0.5 text-center text-xs font-semibold text-white">
          +{formatCents(overCents)}
        </div>
      )}
      <div
        className={`flex flex-col gap-1 rounded-[1.25rem] p-1.5 ${
          spilling ? "carrier-over bg-sunken ring-2 ring-ink" : "bg-sunken"
        }`}
        style={{ height: HEIGHT }}
      >
        {empty &&
          ghosts.map((ghost, index) => (
            <div
              key={index}
              className="tier min-h-0 rounded-tier border-2 border-dashed opacity-60"
              style={{ flexGrow: 1, flexBasis: 0, borderColor: ghost.fill }}
            />
          ))}
        {tiers.map((tier) => {
          const height = (tier.cents / capacity) * HEIGHT;
          return (
            <div
              key={tier.member}
              className="tier num flex min-h-0 items-center justify-center overflow-hidden rounded-tier text-xs font-semibold"
              style={{
                flexGrow: tier.cents,
                flexBasis: 0,
                backgroundColor: tier.color.fill,
                color: tier.color.on,
              }}
            >
              {height >= MIN_LABEL_HEIGHT ? formatCents(tier.cents) : null}
            </div>
          );
        })}
        <div
          className="tier num flex min-h-0 items-center justify-center overflow-hidden rounded-tier border-2 border-dashed border-steel-400 text-xs font-medium text-ink-3"
          style={{
            flexGrow: empty && ghosts.length > 0 ? 0 : remainingCents,
            flexBasis: 0,
            borderWidth: remainingCents > 0 && !(empty && ghosts.length > 0) ? 2 : 0,
          }}
        >
          {!empty && (remainingCents / capacity) * HEIGHT >= MIN_LABEL_HEIGHT ? formatCents(remainingCents) : null}
        </div>
      </div>
    </div>
  );
}

/** The same carrier at row scale, for the bills table. */
export function MiniCarrier({ tiers }: { tiers: CarrierTier[] }) {
  return (
    <div
      className="flex h-8 w-3.5 flex-col gap-px overflow-hidden rounded-[0.3rem] bg-sunken"
      aria-hidden="true"
    >
      {tiers.map((tier) => (
        <div
          key={tier.member}
          className="min-h-px"
          style={{ flexGrow: tier.cents, flexBasis: 0, backgroundColor: tier.color.fill }}
        />
      ))}
    </div>
  );
}
