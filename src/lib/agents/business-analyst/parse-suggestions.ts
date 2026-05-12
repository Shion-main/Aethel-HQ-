const TRIGGER_PHRASE =
  "Some examples (pick any that fit, add your own, or describe in your own words):";

export interface ParsedMessage {
  cleanText: string;
  suggestions: string[] | null;
}

export function parseSuggestions(messageText: string): ParsedMessage {
  const triggerIndex = messageText.lastIndexOf(TRIGGER_PHRASE);

  if (triggerIndex === -1) {
    return { cleanText: messageText, suggestions: null };
  }

  const beforeTrigger = messageText.slice(0, triggerIndex).trim();
  const afterTrigger = messageText.slice(triggerIndex + TRIGGER_PHRASE.length);

  const suggestions = afterTrigger
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((s) => s.length > 0);

  if (suggestions.length === 0) {
    return { cleanText: messageText, suggestions: null };
  }

  return {
    cleanText: beforeTrigger,
    suggestions,
  };
}

export function composeUserMessage(
  selectedChips: string[],
  typedText: string
): string {
  const chipsText = selectedChips.join(", ");
  const trimmedTyped = typedText.trim();

  if (chipsText && trimmedTyped) {
    return `${chipsText}. Also: ${trimmedTyped}`;
  }
  if (chipsText) {
    return chipsText;
  }
  return trimmedTyped;
}
