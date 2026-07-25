/**
 * Print a sample reading to stdout.
 *
 * Deliberately runs the whole L0→L4a pipeline with no network, no API key and
 * no LLM — which is the fastest way to confirm the app is complete without one.
 *
 *   pnpm demo:reading            # random seed
 *   pnpm demo:reading -- <seed>  # reproduce a specific reading
 */
import {
  createReading,
  generateSeed,
  renderTemplate,
  RELATIONSHIP_8,
  THREE_CARDS,
  toPlainText,
} from "@tarot-mirror/engine";
import { riderWaite } from "@tarot-mirror/decks";

const seed = process.argv[2] ?? generateSeed();

for (const spread of [THREE_CARDS, RELATIONSHIP_8]) {
  const reading = createReading({
    spread,
    deck: riderWaite,
    seed,
    question: "いまの働き方を続けるかどうか迷っている",
  });

  console.log("=".repeat(64));
  console.log(toPlainText(renderTemplate(reading)));
  console.log();
  console.log(
    `-- seed: ${reading.seed} / insights: ${reading.insights.length} / ` +
      `ReadingJSON: ${JSON.stringify(reading).length} bytes`,
  );
  console.log();
}
