/**
 * Symbolic identifiers — the vocabulary the Rule Engine speaks.
 *
 * The engine never produces prose. It produces these IDs, and a locale
 * dictionary turns them into text at the very last step. That is what keeps
 * the LLM's job bounded (rewrite supplied meanings, invent nothing) and what
 * makes adding a locale a matter of dropping in one more dictionary file.
 *
 * Template-literal types give us prefix safety at zero runtime cost and stay
 * JSON-friendly, so deck data can be authored as plain JSON.
 */

/** A single unit of meaning, e.g. `kw.newBeginning`. */
export type KeywordId = `kw.${string}`;

/** A broader motif shared across cards, e.g. `theme.threshold`. */
export type ThemeId = `theme.${string}`;

/** A reflective question posed to the user, e.g. `q.whatAreYouHolding`. */
export type QuestionId = `q.${string}`;

/** A cross-card observation emitted by an L2 rule, e.g. `insight.suitDominance.cups`. */
export type InsightId = `insight.${string}`;

/** How a card is framed in a given position, e.g. `framing.origin.upright`. */
export type FramingId = `framing.${string}`;

/** A slot within a spread, e.g. `pos.past`. */
export type PositionId = `pos.${string}`;

/** A spread's display name, e.g. `spread.threeCards`. */
export type SpreadLabelId = `spread.${string}`;

/** A side of a spread that is read as a unit, e.g. `group.self`. */
export type GroupId = `group.${string}`;

/** Chrome and connective copy used by renderers, e.g. `ui.upright`. */
export type UiId = `ui.${string}`;

/**
 * A piece of the LLM system prompt, e.g. `prompt.lens.origin`.
 *
 * The prompt is copy, so it lives here rather than in the renderer. That keeps
 * the rule "文言はすべて packages/content にしかない" true of the LLM path too,
 * and it is what makes the promise in the README real: adding a locale means
 * adding a dictionary, including the instructions the model is given.
 */
export type PromptId = `prompt.${string}`;

/** A card, namespaced by deck, e.g. `rw.major.00`. */
export type CardId = string;

/** Locales the app can render. MVP ships `ja` only; the shape is already plural. */
export type Locale = "ja";
