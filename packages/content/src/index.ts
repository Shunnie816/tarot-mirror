import cards from "./ja/cards.json" with { type: "json" };
import framings from "./ja/framings.json" with { type: "json" };
import insights from "./ja/insights.json" with { type: "json" };
import keywords from "./ja/keywords.json" with { type: "json" };
import positions from "./ja/positions.json" with { type: "json" };
import questions from "./ja/questions.json" with { type: "json" };
import spreads from "./ja/spreads.json" with { type: "json" };
import themes from "./ja/themes.json" with { type: "json" };
import ui from "./ja/ui.json" with { type: "json" };

import type { Dictionary } from "./dictionary.js";
import { createResolver } from "./dictionary.js";
import type { Locale } from "./ids.js";

export * from "./ids.js";
export * from "./dictionary.js";
export * from "./tone.js";

export const ja: Dictionary = {
  locale: "ja",
  cards,
  keywords,
  themes,
  questions,
  framings,
  insights,
  positions,
  spreads,
  ui,
};

const DICTIONARIES: Readonly<Record<Locale, Dictionary>> = { ja };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

export function getResolver(locale: Locale) {
  return createResolver(getDictionary(locale));
}

/** Default locale for the MVP. */
export const DEFAULT_LOCALE: Locale = "ja";
