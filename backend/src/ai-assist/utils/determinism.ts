const STOP_WORDS = new Set([
  "the",
  "and",
  "with",
  "from",
  "that",
  "this",
  "your",
  "have",
  "been",
  "were",
  "when",
  "what",
  "how",
  "about",
  "into",
  "over",
  "then",
  "them",
  "they",
  "their",
  "there",
  "which",
  "would",
  "could",
  "should",
  "did",
  "does",
  "doing",
  "also",
  "more",
  "less",
  "than",
  "able",
  "because",
  "while",
  "just",
  "like",
]);

export const normalizeText = (value: string) => value.toLowerCase();

export const extractKeywords = (input: string, minLength = 4) => {
  const words = (normalizeText(input).match(/[a-z]+/g) ?? []).filter(
    (word) => word.length >= minLength && !STOP_WORDS.has(word),
  );
  const unique: string[] = [];
  for (const word of words) {
    if (!unique.includes(word)) unique.push(word);
  }
  return unique;
};

export const countOccurrences = (text: string, keyword: string) => {
  if (!keyword) return 0;
  let count = 0;
  let index = 0;
  const lowered = normalizeText(text);
  const target = keyword.toLowerCase();
  while (true) {
    const next = lowered.indexOf(target, index);
    if (next === -1) break;
    count += 1;
    index = next + target.length;
  }
  return count;
};

export const scoreText = (text: string, keywords: string[]) => {
  return keywords.reduce((sum, keyword) => sum + countOccurrences(text, keyword), 0);
};
