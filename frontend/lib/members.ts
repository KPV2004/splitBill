/**
 * Roommate identity colours. Each member of a household owns one enamel colour,
 * assigned by their position in the group's member list, and that colour is
 * used for exactly one job: showing which roommate something belongs to
 * (tiers, dots, balance bars). It never signals state.
 */

export interface MemberColor {
  /** Enamel fill. */
  fill: string;
  /** Text colour that reads on the fill (≥4.5:1). */
  on: string;
}

export const MEMBER_COLORS: readonly MemberColor[] = [
  { fill: "var(--color-enamel-jade)", on: "#ffffff" },
  { fill: "var(--color-enamel-cobalt)", on: "#ffffff" },
  { fill: "var(--color-enamel-marigold)", on: "var(--color-ink)" },
  { fill: "var(--color-enamel-plum)", on: "#ffffff" },
  { fill: "var(--color-enamel-teal)", on: "#ffffff" },
  // Rose is last: nearest to the state red, so it only appears in 6-person households,
  // and the over state no longer relies on red alone.
  { fill: "var(--color-enamel-rose)", on: "#ffffff" },
];

const UNKNOWN_MEMBER: MemberColor = { fill: "var(--color-steel-400)", on: "var(--color-ink)" };

/** Colour for `member`, by their index in the household member list. */
export function memberColor(members: readonly string[], member: string): MemberColor {
  const index = members.indexOf(member);
  if (index < 0) return UNKNOWN_MEMBER;
  return MEMBER_COLORS[index % MEMBER_COLORS.length];
}
