# Tarot Mirror

## Project Concept

Tarot Mirror is **not a fortune-telling application**.

It is a **self-reflection application** that uses Tarot and Oracle cards as a tool for dialogue with oneself.

The purpose is **not to predict the future**, but to help users organize their thoughts, emotions, and current situation through symbolic interpretation.

The AI is not an oracle.

The AI is a conversation partner that helps users reflect on themselves.

---

# Vision

Draw a card.

↓

Understand yourself.

↓

Reflect.

↓

Take action.

Tarot Mirror should become a place where users can regularly return to understand themselves better.

---

# Core Principles

## 1. Self Reflection First

The application should never claim to know the user's future.

Instead, readings should be presented as symbolic interpretations that help users think.

Examples:

- "This card may suggest..."
- "One possible interpretation is..."
- "You may want to reflect on..."

Avoid deterministic language such as:

- "This will definitely happen."
- "Your future is..."
- "You will meet..."

---

## 2. AI is an Interpreter

AI should not invent Tarot meanings.

Card meanings should come from structured application data.

The AI's responsibility is:

- organize
- summarize
- explain naturally
- connect cards together
- ask reflective questions

---

## 3. Rule Based First

Interpretations should primarily come from application logic.

The recommended pipeline:

Cards

↓

Rule Engine

↓

Reading JSON

↓

LLM (optional)

↓

Natural Reading

This minimizes API cost while improving consistency.

---

# MVP

The first version should support:

- Tarot deck
- Oracle deck
- Random card drawing
- Reading history
- Reflection journal

---

# Reading Flow

User

↓

Question

↓

Select Spread

↓

Draw Cards

↓

Rule Engine

↓

Reading JSON

↓

LLM formatting (optional)

↓

Reading Screen

↓

Reflection Questions

↓

Journal

---

# Supported Decks (MVP)

## Tarot

- Rider-Waite Tarot

## Oracle

- The Animal Spirit Oracle

The architecture should allow adding more decks later.

---

# Supported Spreads (MVP)

## One Card

Purpose

Daily reflection.

---

## Three Cards

Past

Present

Future

---

## Relationship Spread (8 Cards)

Self

1. Past

2. Present

3. Future

Partner

4. Past

5. Present

6. Future

Relationship

7. Trigger of Progress

8. Final Outcome

---

# Oracle Positions

Optional.

Relationship Theme

Advice

The spread engine should support optional Oracle positions.

---

# Reading Philosophy

A reading is not a prediction.

It is a structured interpretation of symbols.

The reading should encourage:

- awareness
- reflection
- emotional organization
- decision support

The premise has to reach the reader **before the first card**, not only after.

MVP feedback (Issue #54) found that the app opens straight into "what are you
thinking about", which reads exactly like a fortune-telling intake. It was
possible to go all the way through still expecting to be told something, and
then find the result underwhelming. Nothing was broken — the premise had just
never been handed over. The question screen states it now.

---

# Cost Strategy

Knowledge should live inside the application.

The LLM should receive:

- Question
- Spread
- Drawn Cards
- Reading JSON

The LLM should NOT receive:

- Entire Tarot dictionary
- Entire Oracle dictionary

This minimizes token usage.

---

# Future Features

- Reading history
- AI comparison between readings
- Reflection journal
- Favorite spreads
- Multiple decks
- Statistics
- Card encyclopedia
- User-created spreads
- User-created decks

---

# Suggested Domain Model

Deck

Card

Spread

SpreadPosition

DrawSession

Reading

ReadingEngine

RuleEngine

Journal

Reflection

ThemeAnalysis

LLMFormatter

---

# Design Philosophy

The application should feel:

- warm
- calm
- reflective
- gentle

It should never feel like gambling or sensational fortune telling.

The UI should encourage users to slow down and think.

---

# Goal

The application succeeds when users say:

"I understand myself a little better."

not

"The app predicted my future."
