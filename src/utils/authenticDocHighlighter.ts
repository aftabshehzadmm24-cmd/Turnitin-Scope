import { ScanReport } from '../types';
import {
  isTableOfContentsHeading,
  isTableOfContentsEntry,
  isTableOfContentsText,
  isTableHeadingOrCaption,
  isTableRowOrData,
  isTableText,
  isQuoteText,
  isBibliographyHeading,
  isCitationLine,
  isBibliographyOrReferenceText,
  isExcludedFromHighlighting,
  clampSimilarityScore,
} from './documentParser';

export interface RawTextItem {
  str: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
}

export interface DocHighlightBox {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  type: 'plagiarized' | 'ai';
  sourceIndex: number; // 1 to 4
  isBlueUnderlined?: boolean;
  showBadge?: boolean;
  badgeNumber?: number;
  badgeLeft?: number;
  badgeTop?: number;
}

export interface HighlightColorTheme {
  bg: string;
  pdfColor: { r: number; g: number; b: number };
  badgeBg: string;
  textColor: string;
  isUnderlined: boolean;
}

/**
 * 4 Turnitin official highlight themes for Similarity reports:
 * 1: Pink/Red
 * 2: Blue with bottom underline
 * 3: Emerald/Green
 * 4: Purple/Violet
 */
export const SIMILARITY_THEMES: Record<number, HighlightColorTheme> = {
  1: {
    bg: 'rgba(254, 165, 165, 0.70)', // slightly richer, prominent red/pink highlight
    pdfColor: { r: 0.99, g: 0.65, b: 0.65 },
    badgeBg: '#dc2626',
    textColor: '#991b1b',
    isUnderlined: false,
  },
  2: {
    bg: 'rgba(147, 197, 253, 0.70)', // slightly richer, prominent blue highlight
    pdfColor: { r: 0.58, g: 0.78, b: 0.98 },
    badgeBg: '#2563eb',
    textColor: '#1d4ed8',
    isUnderlined: false,
  },
  3: {
    bg: 'rgba(134, 239, 172, 0.65)', // slightly richer emerald/green
    pdfColor: { r: 0.55, g: 0.92, b: 0.70 },
    badgeBg: '#059669',
    textColor: '#065f46',
    isUnderlined: false,
  },
  4: {
    bg: 'rgba(216, 180, 254, 0.68)', // slightly richer purple/violet
    pdfColor: { r: 0.82, g: 0.68, b: 0.98 },
    badgeBg: '#7c3aed',
    textColor: '#5b21b6',
    isUnderlined: false,
  },
};

/**
 * AI Writing highlight theme:
 * Distinct light-blue wash.
 */
export const AI_THEME: HighlightColorTheme = {
  bg: 'rgba(147, 197, 253, 0.70)', // prominent light blue wash
  pdfColor: { r: 0.58, g: 0.78, b: 0.98 },
  badgeBg: '#3b82f6',
  textColor: '#1e40af',
  isUnderlined: false,
};

export function getHighlightTheme(
  type: 'plagiarized' | 'ai',
  sourceIndex = 1
): HighlightColorTheme {
  if (type === 'ai') {
    return AI_THEME;
  }
  return SIMILARITY_THEMES[sourceIndex] || SIMILARITY_THEMES[1];
}

interface VisualLine {
  items: RawTextItem[];
  lineText: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
}

/**
 * Groups raw PDF text fragments into unified visual lines
 */
function groupItemsIntoLines(
  items: RawTextItem[],
  pageHeight: number
): VisualLine[] {
  if (!items || items.length === 0) return [];

  // Filter out running header and footer area (top 50px, bottom 50px)
  const contentItems = items.filter(
    item => item.top >= 48 && item.top <= pageHeight - 48 && item.str.trim().length > 0
  );

  // Sort by top, then left
  contentItems.sort((a, b) => {
    const topDiff = a.top - b.top;
    if (Math.abs(topDiff) > 3) return topDiff;
    return a.left - b.left;
  });

  const lines: VisualLine[] = [];
  let currentGroup: RawTextItem[] = [];
  let currentTop = -999;
  let currentFontSize = 12;

  for (const item of contentItems) {
    const threshold = Math.max(currentFontSize, item.fontSize, 10) * 0.45;
    if (currentGroup.length === 0 || Math.abs(item.top - currentTop) <= threshold) {
      currentGroup.push(item);
      if (currentGroup.length === 1) {
        currentTop = item.top;
        currentFontSize = item.fontSize;
      }
    } else {
      // Finalize previous line
      lines.push(buildVisualLine(currentGroup));
      currentGroup = [item];
      currentTop = item.top;
      currentFontSize = item.fontSize;
    }
  }

  if (currentGroup.length > 0) {
    lines.push(buildVisualLine(currentGroup));
  }

  return lines;
}

function buildVisualLine(items: RawTextItem[]): VisualLine {
  items.sort((a, b) => a.left - b.left);
  const left = Math.min(...items.map(i => i.left));
  const top = Math.min(...items.map(i => i.top));
  const right = Math.max(...items.map(i => i.left + i.width));
  const bottom = Math.max(...items.map(i => i.top + i.height));
  const maxFontSize = Math.max(...items.map(i => i.fontSize));
  const lineText = items.map(i => i.str.trim()).filter(Boolean).join(' ');

  return {
    items,
    lineText,
    left,
    top,
    width: Math.max(10, right - left),
    height: Math.max(maxFontSize, bottom - top),
    fontSize: maxFontSize,
  };
}

/**
 * Checks if a visual line represents tabular content (columns with wide spacing, numeric tables, etc.)
 */
function isTabularVisualLine(line: VisualLine): boolean {
  if (isTableText(line.lineText)) return true;

  // Check horizontal column gaps between items in the line
  if (line.items.length >= 2) {
    let columnGaps = 0;
    for (let i = 0; i < line.items.length - 1; i++) {
      const cur = line.items[i];
      const next = line.items[i + 1];
      const gap = next.left - (cur.left + cur.width);
      if (gap >= 20 || gap >= Math.max(10, line.fontSize) * 2.0) {
        columnGaps++;
      }
    }
    if (columnGaps >= 1 && (line.items.length >= 3 || columnGaps >= 2)) {
      return true;
    }
  }

  // Check if line consists mostly of numbers, currency, percentages, or status tokens
  const tokens = line.lineText.trim().split(/\s+/);
  if (tokens.length >= 3) {
    const numericOrMetric = tokens.filter(
      t =>
        /^(\$|€|£|₹)?\d+(\.\d+)?%?$/.test(t) ||
        /^[-–—+*]+$/.test(t) ||
        /^(N\/A|NaN|None|Total|Sum|Avg|Mean|SD|Min|Max)$/i.test(t)
    );
    if (numericOrMetric.length / tokens.length >= 0.4) {
      return true;
    }
  }

  return false;
}

/**
 * Computes Turnitin highlight overlay rectangles directly on the authentic PDF document page.
 * Strictly respects:
 * - Plagiarism Similarity 1% to 12% limit with 4-color rotation and badge indicators.
 * - Excludes Table of Contents, Tables, References, and Quotes.
 * - AI Writing: 0% highlight for scores <= 20% (*% rule), light blue highlights for >= 21%.
 */
export function computeHighlightsForPage(
  items: RawTextItem[],
  pageWidth: number,
  pageHeight: number,
  pageIndex: number, // 0-based index
  report: ScanReport,
  mode: 'ai' | 'similarity'
): DocHighlightBox[] {
  const isSimilarity = mode === 'similarity';
  const plagScore = clampSimilarityScore(report.plagiarismScore || 0);
  const aiScore = report.aiScore || 0;

  // If Similarity mode and 0% plagiarism score, nothing to highlight
  if (isSimilarity && plagScore === 0) return [];

  // Official Turnitin rule: AI scores <= 20% (*% rule) display NO highlights at all
  if (!isSimilarity && aiScore <= 20) return [];

  const lines = groupItemsIntoLines(items, pageHeight);
  if (lines.length === 0) return [];

  // 1. PAGE-LEVEL EXCLUSION: TABLE OF CONTENTS
  // If the page contains a TOC heading, or >= 2 lines ending with page numbers/dot leaders,
  // or >= 20% of the lines are TOC entries -> Entire page is a Table of Contents (0 highlights).
  const hasTocHeading = lines.some(l => isTableOfContentsHeading(l.lineText));
  const tocEntries = lines.filter(l => isTableOfContentsEntry(l.lineText));
  if (
    hasTocHeading ||
    tocEntries.length >= 2 ||
    (lines.length >= 3 && tocEntries.length / lines.length >= 0.2)
  ) {
    return [];
  }

  // 2. DOCUMENT & PAGE-LEVEL EXCLUSION: REFERENCES / BIBLIOGRAPHY
  const reportObj = report as any;
  if (reportObj._bibStartPageIndex !== undefined && pageIndex > reportObj._bibStartPageIndex) {
    // Current page is completely within the References / Bibliography section
    return [];
  }

  const bibHeadingLineIdx = lines.findIndex(l => isBibliographyHeading(l.lineText));
  const citationLines = lines.filter(l => isCitationLine(l.lineText));

  // If the page has 3+ citations, or >= 30% of its lines are citations -> Entire page is References
  if (citationLines.length >= 3 || (lines.length >= 3 && citationLines.length / lines.length >= 0.3)) {
    if (reportObj._bibStartPageIndex === undefined || pageIndex < reportObj._bibStartPageIndex) {
      reportObj._bibStartPageIndex = pageIndex;
    }
    return [];
  }

  if (bibHeadingLineIdx !== -1) {
    if (reportObj._bibStartPageIndex === undefined || pageIndex < reportObj._bibStartPageIndex) {
      reportObj._bibStartPageIndex = pageIndex;
    }
  }

  // 3. LINE-BY-LINE FILTERING (TABLES, REMAINING REFERENCES, TOC, AND QUOTES)
  const excludeQuotes = report.excludeQuotes !== false;
  let inBib = false;
  let inTableBlock = false;
  let tableEndCountdown = 0;

  const eligibleLineIndices: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const { lineText } = line;

    // References: Once bibliography heading is reached, all remaining lines on page are excluded
    if (bibHeadingLineIdx !== -1 && i >= bibHeadingLineIdx) {
      inBib = true;
    }
    if (isBibliographyHeading(lineText)) inBib = true;
    if (inBib || isBibliographyOrReferenceText(lineText)) continue;

    // Table of Contents
    if (isTableOfContentsText(lineText)) continue;

    // Tables: check for captions, headers, tabular columns, or table blocks
    if (isTableHeadingOrCaption(lineText)) {
      inTableBlock = true;
      tableEndCountdown = 4;
      continue;
    }

    if (isTabularVisualLine(line)) {
      inTableBlock = true;
      tableEndCountdown = 3;
      continue;
    }

    if (inTableBlock) {
      tableEndCountdown--;
      if (tableEndCountdown <= 0) {
        inTableBlock = false;
      } else {
        continue;
      }
    }

    // Never allow either AI or similarity highlights on TOC, table, or reference lines.
    if (
      isTableOfContentsText(lineText) ||
      isTableHeadingOrCaption(lineText) ||
      isTableRowOrData(lineText) ||
      isTabularVisualLine(line) ||
      isBibliographyOrReferenceText(lineText) ||
      isExcludedFromHighlighting(lineText)
    ) continue;
    if (excludeQuotes && isQuoteText(lineText)) continue;

    // Skip very short headings or single numbers
    if (lineText.length < 8 && !/[a-zA-Z]{3,}/.test(lineText)) continue;
    // Skip lines that look like page numbering
    if (/^page\s+\d+/i.test(lineText) || /^\d+\s*$/i.test(lineText)) continue;

    eligibleLineIndices.push(i);
  }

  if (eligibleLineIndices.length === 0) return [];

  type SentenceRange = {
    text: string;
    sourceIndex?: number;
    lineRanges: Array<{ lineIdx: number; start: number; end: number }>;
  };
  const sentences: SentenceRange[] = [];
  const lineGroups: number[][] = [];
  for (const lineIdx of eligibleLineIndices) {
    const lastGroup = lineGroups[lineGroups.length - 1];
    if (!lastGroup || lastGroup[lastGroup.length - 1] !== lineIdx - 1) {
      lineGroups.push([lineIdx]);
    } else {
      lastGroup.push(lineIdx);
    }
  }

  for (const lineGroup of lineGroups) {
    const offsets: Array<{ lineIdx: number; start: number; end: number }> = [];
    let combinedText = '';
    for (const lineIdx of lineGroup) {
      const lineText = lines[lineIdx].lineText;
      offsets.push({ lineIdx, start: combinedText.length, end: combinedText.length + lineText.length });
      combinedText += `${lineText} `;
    }

    const sentencePattern = /[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g;
    for (const match of combinedText.matchAll(sentencePattern)) {
      const rawSentence = match[0];
      const leadingWhitespace = rawSentence.length - rawSentence.trimStart().length;
      const sentenceStart = (match.index ?? 0) + leadingWhitespace;
      const sentenceText = rawSentence.trim();
      const sentenceEnd = sentenceStart + sentenceText.length;
      if (sentenceText.length < 15 || isExcludedFromHighlighting(sentenceText)) continue;
      if (excludeQuotes && isQuoteText(sentenceText)) continue;

      const lineRanges = offsets
        .filter(offset => offset.end > sentenceStart && offset.start < sentenceEnd)
        .map(offset => ({
          lineIdx: offset.lineIdx,
          start: Math.max(0, sentenceStart - offset.start),
          end: Math.min(lines[offset.lineIdx].lineText.length, sentenceEnd - offset.start),
        }))
        .filter(range => range.end > range.start);

      if (lineRanges.length === 0) continue;
      const normalizedSentence = sentenceText.toLowerCase();
      const matchingSnippet = report.snippets?.find(snippet => {
        const expectedType = isSimilarity ? 'plagiarized' : 'ai_generated';
        return snippet.type === expectedType &&
          (normalizedSentence.includes(snippet.text.toLowerCase()) ||
            snippet.text.toLowerCase().includes(normalizedSentence));
      });
      sentences.push({
        text: sentenceText,
        sourceIndex: matchingSnippet?.sourceIndex,
        lineRanges,
      });
    }
  }

  if (sentences.length === 0) return [];
  const matchingSentences = sentences.filter(sentence => sentence.sourceIndex !== undefined);
  const selectionPool = matchingSentences.length > 0 ? matchingSentences : sentences;
  const score = isSimilarity ? plagScore : aiScore;
  const targetCount = Math.max(1, Math.min(selectionPool.length, Math.round(score / 100 * sentences.length)));
  const selectedPositions = new Set<number>();
  for (let i = 0; i < targetCount; i++) {
    selectedPositions.add(Math.min(
      selectionPool.length - 1,
      Math.round(((i + 0.5) * selectionPool.length) / targetCount),
    ));
  }

  const highlightBoxes: DocHighlightBox[] = [];
  const selectedSentences = Array.from(selectedPositions)
    .sort((a, b) => a - b)
    .map(position => selectionPool[position]);

  selectedSentences.forEach((sentence, sentenceIndex) => {
    sentence.lineRanges.forEach((range, rangeIndex) => {
      const line = lines[range.lineIdx];
      let textOffset = 0;
      let left = Number.POSITIVE_INFINITY;
      let right = Number.NEGATIVE_INFINITY;
      let top = Number.POSITIVE_INFINITY;
      let bottom = Number.NEGATIVE_INFINITY;

      for (const item of line.items) {
        const itemText = item.str.trim();
        const itemStart = textOffset;
        const itemEnd = itemStart + itemText.length;
        const overlapStart = Math.max(range.start, itemStart);
        const overlapEnd = Math.min(range.end, itemEnd);
        if (overlapEnd > overlapStart && itemText.length > 0) {
          const itemLeft = item.left + item.width * ((overlapStart - itemStart) / itemText.length);
          const itemRight = item.left + item.width * ((overlapEnd - itemStart) / itemText.length);
          left = Math.min(left, itemLeft);
          right = Math.max(right, itemRight);
          top = Math.min(top, item.top);
          bottom = Math.max(bottom, item.top + item.height);
        }
        textOffset = itemEnd + 1;
      }

      if (!Number.isFinite(left) || right <= left) return;
      const padding = 1;
      const boxLeft = Math.max(30, left - padding);
      const boxTop = Math.max(48, top - padding);
      const boxRight = Math.min(pageWidth - 30, right + padding);
      const boxBottom = Math.min(pageHeight - 48, bottom + padding);
      const showBadge = isSimilarity && rangeIndex === 0;
      const sourceIndex = isSimilarity ? sentence.sourceIndex || ((sentenceIndex % 4) + 1) : 1;

      highlightBoxes.push({
        id: `hl-${pageIndex}-${sentenceIndex}-${range.lineIdx}`,
        left: boxLeft,
        top: boxTop,
        width: Math.max(1, boxRight - boxLeft),
        height: Math.max(11, boxBottom - boxTop),
        type: isSimilarity ? 'plagiarized' : 'ai',
        sourceIndex,
        showBadge,
        badgeNumber: sourceIndex,
        badgeLeft: Math.max(10, boxLeft - 15),
        badgeTop: boxTop + (Math.max(11, boxBottom - boxTop) - 12) / 2,
      });
    });
  });

  return highlightBoxes;
}
