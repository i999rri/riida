import { CJK_RADICAL_MAP } from "./cjk-radical-map.ts";

export type PdfSearchNormChar = {
  itemIndex: number;
  origOffset: number;
  origOffsetEnd: number;
};

export type PdfSearchPageIndex = {
  normalizedText: string;
  normChars: PdfSearchNormChar[];
};

export type PdfSearchMatch = {
  pageNumber: number;
  normalizedStart: number;
  normalizedEnd: number;
};

/**
 * Normalize a string for PDF text search:
 * - NFD + strip combining marks (so "ñ" matches "n")
 * - NFKC (so half-width katakana matches full-width)
 * - lower-case (so "ABC" matches "abc")
 * - map CJK radicals to their canonical ideograph
 *
 * The output is pure ASCII / canonical CJK and is safe to use both as
 * the indexed body of a page and as the search query.
 */
export function searchNormalize(str: string): string {
  return [
    ...str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .normalize("NFKC")
      .toLowerCase(),
  ]
    .map((c) => CJK_RADICAL_MAP[c] ?? c)
    .join("");
}

/**
 * Keep only the text-content items that PDF.js's `TextLayer` renders as
 * a text `<span>` in the DOM, preserving their order.
 *
 * `TextLayer` skips two kinds of items when building the text layer:
 *
 * - marked-content markers (`str === undefined`; they become
 *   `span.markedContent` wrappers, never text spans), and
 * - empty items (`str === ""`, typically the `hasEOL` line-end markers):
 *   a span object is created but, because `hasText` is false, it is
 *   never appended to the container.
 *
 * The search index uses `itemIndex` as a direct index into the page's
 * text spans, so it must count exactly the same items. Feeding anything
 * else to `buildPdfSearchPageIndex` shifts every highlight after the
 * first skipped item by one span (the classic "highlight lands a few
 * characters to the right" bug).
 */
export function collectPdfTextLayerItems(
  items: ReadonlyArray<{ str?: unknown }>,
): Array<{ str: string }> {
  const result: Array<{ str: string }> = [];
  for (const item of items) {
    if (typeof item.str === "string" && item.str !== "") {
      result.push({ str: item.str });
    }
  }
  return result;
}

/**
 * Build a per-page search index from PDF.js text items.
 *
 * The returned `normalizedText` is what the user query is matched
 * against; `normChars` is a parallel array that maps each normalized
 * codepoint back to its source `(itemIndex, origOffset, origOffsetEnd)`
 * so that highlight ranges can be reconstructed against the actual
 * DOM text spans.
 *
 * `itemIndex` is the position within `items`, and the highlighter
 * resolves it against the page's text spans in DOM order, so `items`
 * must be exactly the span-producing items (see
 * `collectPdfTextLayerItems`).
 */
export function buildPdfSearchPageIndex(items: Array<{ str: string }>): PdfSearchPageIndex {
  const normChars: PdfSearchNormChar[] = [];
  let normalizedText = "";

  for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
    const item = items[itemIndex];
    if (!item) continue;
    const str = item.str;
    let origOffset = 0;
    for (const cp of str) {
      const origOffsetEnd = origOffset + cp.length;
      const normalized = searchNormalize(cp);
      for (const nc of normalized) {
        normChars.push({ itemIndex, origOffset, origOffsetEnd });
        normalizedText += nc;
      }
      origOffset = origOffsetEnd;
    }
  }

  return { normalizedText, normChars };
}

/**
 * Find all non-overlapping match positions of `normalizedQuery` inside
 * the page's `normalizedText`. Step-by-1 (not by query length) is
 * intentional so that overlapping matches are still found.
 *
 * Returns an empty array when the query is empty so callers don't
 * accidentally produce a "match at every position" run.
 */
export function findPdfSearchMatchesInPage(
  normalizedText: string,
  normalizedQuery: string,
  pageNumber: number,
): PdfSearchMatch[] {
  const matches: PdfSearchMatch[] = [];
  if (!normalizedQuery) return matches;

  let pos = 0;
  while (pos <= normalizedText.length - normalizedQuery.length) {
    const found = normalizedText.indexOf(normalizedQuery, pos);
    if (found === -1) break;
    matches.push({
      pageNumber,
      normalizedStart: found,
      normalizedEnd: found + normalizedQuery.length,
    });
    pos = found + 1;
  }

  return matches;
}

/**
 * Pick the best initial match index given the user's current page.
 * Returns the first match at or after `currentPage`, or 0 when no
 * match is on/after that page but matches exist, or -1 when there
 * are no matches at all.
 */
export function pickInitialMatchIndex(matches: PdfSearchMatch[], currentPage: number): number {
  if (matches.length === 0) return -1;
  const idx = matches.findIndex((m) => m.pageNumber >= currentPage);
  return idx >= 0 ? idx : 0;
}
