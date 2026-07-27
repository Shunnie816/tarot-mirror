import * as z from "zod";

/**
 * Deck data validation.
 *
 * Deck JSON is authored by hand, so the schema is the contract that stops a
 * malformed card from reaching the engine. `pnpm validate:decks` runs these
 * as tests — a card missing a reversed keyword fails the build, not a user's
 * reading.
 */

const keywordId = z.string().regex(/^kw\.[a-zA-Z][a-zA-Z0-9]*$/, "must look like kw.someName");
const themeId = z.string().regex(/^theme\.[a-zA-Z][a-zA-Z0-9]*$/, "must look like theme.someName");
const questionId = z.string().regex(/^q\.[a-zA-Z][a-zA-Z0-9]*$/, "must look like q.someName");

export const ELEMENTS = ["fire", "water", "air", "earth"] as const;
export const SUITS = ["wands", "cups", "swords", "pentacles"] as const;
export const COURTS = ["page", "knight", "queen", "king"] as const;

/**
 * The engine's numeric representation of a card.
 *
 * Deliberately contains no good/bad axis. `friction` measures resistance, not
 * misfortune — without that discipline the L2 rules drift into fortune-telling.
 */
export const AxisVectorSchema = z.object({
  /** -2 委ねる/受け取る .. +2 自ら動かす */
  agency: z.number().int().min(-2).max(2),
  /** -2 静止・待機 .. +2 加速・展開 */
  tempo: z.number().int().min(-2).max(2),
  /** 0 滑らか .. 4 抵抗が大きい */
  friction: z.number().int().min(0).max(4),
  /** -2 外界・関係 .. +2 内面・自己 */
  focus: z.number().int().min(-2).max(2),
});

export const CardSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+\.[a-z]+\.[a-z0-9]+$/, "must look like deck.group.slot"),
    arcana: z.enum(["major", "minor"]),
    suit: z.enum(SUITS).optional(),
    rank: z.number().int().min(1).max(10).optional(),
    court: z.enum(COURTS).optional(),
    element: z.enum(ELEMENTS),
    keywords: z.object({
      // Three keywords per orientation keeps rendered sentences readable and
      // caps the token budget handed to the LLM.
      upright: z.array(keywordId).min(3).max(4),
      reversed: z.array(keywordId).min(3).max(4),
    }),
    themes: z.array(themeId).min(1).max(3),
    reflectionSeeds: z.array(questionId).min(2).max(3),
    axes: AxisVectorSchema,
  })
  .superRefine((card, ctx) => {
    if (card.arcana === "major") {
      for (const field of ["suit", "rank", "court"] as const) {
        if (card[field] !== undefined) {
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: `major arcana must not define "${field}"`,
          });
        }
      }
      return;
    }

    if (card.suit === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["suit"],
        message: "minor arcana must define a suit",
      });
    }
    const hasRank = card.rank !== undefined;
    const hasCourt = card.court !== undefined;
    if (hasRank === hasCourt) {
      ctx.addIssue({
        code: "custom",
        path: ["rank"],
        message: "minor arcana must define exactly one of rank or court",
      });
    }
  });

export const DeckSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    /** Card back / cover art path, relative to the web app's public dir. */
    coverImage: z.string().optional(),
    kind: z.enum(["tarot", "oracle"]),
    /**
     * How often a card from this deck lands reversed, 0–1.
     *
     * A deck property because it is a property of the deck: an oracle deck
     * has no reversed reading to give, so it sets 0 rather than relying on
     * every caller to remember. Omitted means "use the engine's default";
     * a user preference still overrides whatever is set here.
     */
    reversalRate: z.number().min(0).max(1).optional(),
    cards: z.array(CardSchema).min(1),
  })
  .superRefine((deck, ctx) => {
    const seen = new Set<string>();
    for (const [index, card] of deck.cards.entries()) {
      if (seen.has(card.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["cards", index, "id"],
          message: `duplicate card id "${card.id}"`,
        });
      }
      seen.add(card.id);

      if (!card.id.startsWith(`${deck.id}.`)) {
        ctx.addIssue({
          code: "custom",
          path: ["cards", index, "id"],
          message: `card id must be namespaced with deck id "${deck.id}"`,
        });
      }
    }
  });

export type AxisVector = z.infer<typeof AxisVectorSchema>;
export type Card = z.infer<typeof CardSchema>;
export type Deck = z.infer<typeof DeckSchema>;
export type Element = (typeof ELEMENTS)[number];
export type Suit = (typeof SUITS)[number];
export type Court = (typeof COURTS)[number];
