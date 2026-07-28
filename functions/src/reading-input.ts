import { getResolver, type Locale } from "@tarot-mirror/content";
import { getSpread, type ReadingJSON, type SpreadId } from "@tarot-mirror/engine";
import * as z from "zod";

/**
 * The trust boundary.
 *
 * Anyone who can sign in anonymously can call this function, so the request is
 * hostile input until proven otherwise. The point of validating here is not
 * tidiness — it is that a caller must not be able to turn a paid model into a
 * general-purpose text generator. Every id has to exist in the dictionary and
 * the positions have to be exactly the ones the spread declares, so the worst
 * a determined caller can do is generate tarot readings.
 *
 * The only free text is the user's own question, and it is capped.
 */

/** Long enough for a real question, short enough not to be a prompt. */
export const MAX_QUESTION_LENGTH = 400;

const SPREAD_IDS = ["oneCard", "threeCards", "relationship8"] as const;

const axesSchema = z.object({
  agency: z.number(),
  tempo: z.number(),
  friction: z.number(),
  focus: z.number(),
});

const positionSchema = z.object({
  positionId: z.string().startsWith("pos."),
  cardId: z.string(),
  orientation: z.enum(["upright", "reversed"]),
  lens: z.enum([
    "origin",
    "currentState",
    "trajectory",
    "advice",
    "catalyst",
    "theme",
  ]),
  group: z.enum(["self", "partner", "relationship"]).optional(),
  keywords: z.array(z.string().startsWith("kw.")).min(1).max(3),
  framing: z.string().startsWith("framing."),
  axes: axesSchema,
});

const readingSchema = z.object({
  version: z.literal(1),
  seed: z.string().min(1).max(200),
  spreadId: z.enum(SPREAD_IDS),
  question: z.string().max(MAX_QUESTION_LENGTH).optional(),
  positions: z.array(positionSchema).min(1).max(12),
  insights: z
    .array(
      z.object({
        id: z.string().startsWith("insight."),
        subjects: z.array(z.string()).max(12),
        strength: z.number(),
      }),
    )
    .max(8),
  reflection: z.array(z.string().startsWith("q.")).max(8),
  meta: z.object({
    deckIds: z.array(z.string()).max(4),
    drawnAt: z.string(),
  }),
});

export const requestSchema = z.object({
  reading: readingSchema,
  locale: z.literal("ja").default("ja"),
});

export interface ParsedRequest {
  readonly reading: ReadingJSON;
  readonly locale: Locale;
}

export type ParseResult =
  | { readonly ok: true; readonly request: ParsedRequest }
  | { readonly ok: false; readonly problem: string };

/**
 * Check that the reading is one this deployment could actually have produced.
 *
 * A shape-valid reading full of ids nobody has ever heard of would still be
 * rendered by the model — it would just be rendered from words we did not
 * write. Resolving every id through the dictionary closes that.
 */
function checkAgainstDictionary(
  reading: z.infer<typeof readingSchema>,
  locale: Locale,
): string | null {
  const resolver = getResolver(locale);
  const spread = getSpread(reading.spreadId as SpreadId);

  const expected = spread.positions.map((p) => p.id).join(",");
  const actual = reading.positions.map((p) => p.positionId).join(",");
  if (expected !== actual) {
    return `positions do not match spread ${reading.spreadId}`;
  }

  for (const position of reading.positions) {
    if (!resolver.has("cards", position.cardId)) {
      return `unknown card ${position.cardId}`;
    }
    if (!resolver.has("framings", position.framing)) {
      return `unknown framing ${position.framing}`;
    }
    for (const keyword of position.keywords) {
      if (!resolver.has("keywords", keyword)) {
        return `unknown keyword ${keyword}`;
      }
    }
  }

  for (const insight of reading.insights) {
    if (!resolver.has("insights", insight.id)) {
      return `unknown insight ${insight.id}`;
    }
  }

  for (const question of reading.reflection) {
    if (!resolver.has("questions", question)) {
      return `unknown question ${question}`;
    }
  }

  return null;
}

export function parseReadingRequest(data: unknown): ParseResult {
  const parsed = requestSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, problem: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const { reading, locale } = parsed.data;
  const problem = checkAgainstDictionary(reading, locale);
  if (problem !== null) return { ok: false, problem };

  return {
    ok: true,
    request: { reading: reading as ReadingJSON, locale },
  };
}
