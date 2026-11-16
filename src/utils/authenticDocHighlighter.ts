import { ScanReport } from '../types';
import {
  isTableOfContentsHeading,
  isTableOfContentsEntry,
  isTableOfContentsText,
  isTableHeadingOrCaption,
  isTableRowOrData,
  isTableText,
  isFigureOrGraphText,
  isMainHeadingText,
  isGlossaryOrTermTableText,
  isQuoteText,
  isBibliographyHeading,
  isCitationLine,
  isBibliographyOrReferenceText,
  isExcludedFromHighlighting,
  clampSimilarityScore,
  countWords,
  selectIndicesForWordShare,
  splitIntoSentencesWithSpans,
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
 * Turquoise-cyan highlight for AI-detected text.
 */
export const AI_THEME: HighlightColorTheme = {
  bg: '#AFEBF0',
  pdfColor: { r: 175 / 255, g: 235 / 255, b: 240 / 255 },
  badgeBg: '#0891b2',
  textColor: '#000000',
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
  if (isGlossaryOrTermTableText(line.lineText)) return true;

  // Check horizontal column gaps between items in the line (Term | Meaning style)
  if (line.items.length >= 2) {
    let columnGaps = 0;
    let maxGap = 0;
    for (let i = 0; i < line.items.length - 1; i++) {
      const cur = line.items[i];
      const next = line.items[i + 1];
      const gap = next.left - (cur.left + cur.width);
      maxGap = Math.max(maxGap, gap);
      if (gap >= 14 || gap >= Math.max(8, line.fontSize) * 1.4) {
        columnGaps++;
      }
    }
    // Two clusters with a clear gutter = table/card row
    if (columnGaps >= 1 || maxGap >= 28) {
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

/** True when the page is mostly a glossary / 2-column table / card grid (no AI highlights). */
function isMostlyTabularOrGlossaryPage(lines: VisualLine[], pageWidth: number): boolean {
  if (lines.length < 3) return false;

  const hasTermMeaningHeader = lines.some(l => {
    const t = l.lineText.toLowerCase();
    return (
      /\bterm\b/.test(t) && /\b(meaning|definition)\b/.test(t)
    ) || /^term$/i.test(l.lineText.trim()) || /^meaning$/i.test(l.lineText.trim());
  });

  const glossaryHits = lines.filter(l => isGlossaryOrTermTableText(l.lineText)).length;
  const tabularHits = lines.filter(l => isTabularVisualLine(l)).length;

  // Mid-page split: many lines start in left half AND many in right half (card grid / 2-col table)
  const midX = pageWidth * 0.42;
  const leftOnly = lines.filter(l => l.left + l.width < midX + 20).length;
  const rightOnly = lines.filter(l => l.left > midX - 10).length;
  const dualColumnLayout = leftOnly >= 3 && rightOnly >= 3 && leftOnly + rightOnly >= lines.length * 0.55;

  // Short promotional / card-style lines dominate (cover pages)
  const shortLines = lines.filter(l => l.lineText.trim().length > 0 && l.lineText.trim().length <= 55).length;
  const longProse = lines.filter(l => l.lineText.trim().length >= 90).length;
  const coverOrCardPage = shortLines >= 6 && longProse <= 1 && lines.length <= 20;

  if (hasTermMeaningHeader && longProse <= 1) return true;
  if ((glossaryHits >= 3 || glossaryHits / lines.length >= 0.25) && longProse <= 1) return true;
  if ((tabularHits >= 3 || tabularHits / lines.length >= 0.45) && longProse <= 1) return true;
  if (dualColumnLayout && longProse <= 1) return true;
  if (coverOrCardPage && (dualColumnLayout || tabularHits >= 2 || shortLines >= 8)) return true;

  return false;
}

/**
 * Computes Turnitin highlight overlay rectangles directly on the authentic PDF document page.
 * Strictly respects:
 * - Plagiarism Similarity 1% to 40% limit with 4-color rotation and badge indicators.
 * - Excludes TOC, Tables, Images, Graphs/Figures, References, and main headings in both AI and Similarity.
 * - AI Writing: highlights the score-matched share of eligible words above 20%.
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
  const aiScore = Number.isFinite(report.aiScore) ? Math.max(0, report.aiScore) : 0;

  // If Similarity mode and 0% plagiarism score, nothing to highlight
  if (isSimilarity && plagScore === 0) return [];

  // Official Turnitin rule: AI scores <= 20% (*% rule) display NO highlights at all
  if (!isSimilarity && aiScore <= 20) return [];

  const lines = groupItemsIntoLines(items, pageHeight);
  if (lines.length === 0) return [];

  // Median body font size — lines notably larger are treated as bold/main headings
  const fontSizes = [...lines.map(l => l.fontSize)].sort((a, b) => a - b);
  const medianFontSize = fontSizes[Math.floor(fontSizes.length / 2)] || 12;
  const isVisuallyBoldHeading = (line: VisualLine): boolean => {
    if (line.fontSize < medianFontSize * 1.15) return false;
    const trimmed = line.lineText.trim();
    if (trimmed.length < 2 || trimmed.length > 100) return false;
    if (/[.!?]$/.test(trimmed) && trimmed.length > 40) return false;
    return true;
  };

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

  // 1b. PAGE-LEVEL EXCLUSION: glossary tables, Term/Meaning grids, cover card layouts
  if (isMostlyTabularOrGlossaryPage(lines, pageWidth)) {
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
  const glossaryHeadingLineIdx = lines.findIndex(l => {
    const t = l.lineText.trim().toLowerCase();
    return (
      t === 'glossary' ||
      t.startsWith('glossary ') ||
      /^\d+(\.\d+)*\.?\s+glossary\b/i.test(l.lineText.trim()) ||
      /\bglossary and further (learning|reading)\b/i.test(l.lineText)
    );
  });

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

  // Glossary / term-table pages: never highlight in AI or Similarity
  if (glossaryHeadingLineIdx !== -1) {
    return [];
  }

  // 3. LINE-BY-LINE FILTERING (TABLES, GRAPHS, HEADINGS, REFERENCES, TOC, QUOTES)
  const excludeQuotes = report.excludeQuotes !== false;
  let inBib = false;
  let inTableBlock = false;
  let inFigureBlock = false;
  let inGlossaryBlock = glossaryHeadingLineIdx !== -1;
  const looksLikeSectionHeading = (text: string, visualLine: VisualLine): boolean =>
    isMainHeadingText(text) ||
    isVisuallyBoldHeading(visualLine) ||
    /^\d+(\.\d+)*\.?\s+[A-Z]/.test(text.trim());

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

    // Glossary / further learning blocks
    if (glossaryHeadingLineIdx !== -1 && i >= glossaryHeadingLineIdx) {
      inGlossaryBlock = true;
    }
    if (/^(glossary|further learning|further reading|key terms)\b/i.test(lineText.trim())) {
      inGlossaryBlock = true;
    }
    if (inGlossaryBlock || isGlossaryOrTermTableText(lineText)) continue;

    // Table of Contents
    if (isTableOfContentsText(lineText)) continue;

    // Graphs / figures / charts / images — skip caption and nearby labels until body/heading
    if (isFigureOrGraphText(lineText)) {
      inFigureBlock = true;
      continue;
    }
    if (inFigureBlock) {
      const isBodyProse = lineText.trim().length >= 90 && /[.!?]/.test(lineText);
      if (
        looksLikeSectionHeading(lineText, line) ||
        isTableHeadingOrCaption(lineText) ||
        isBodyProse
      ) {
        inFigureBlock = false;
      } else {
        continue;
      }
    }

    // Tables stay excluded until the next real section heading
    if (isTableHeadingOrCaption(lineText) || /^(term|meaning|definition)s?\b/i.test(lineText.trim())) {
      inTableBlock = true;
      continue;
    }
    if (isTabularVisualLine(line)) {
      inTableBlock = true;
      continue;
    }
    if (inTableBlock) {
      if (looksLikeSectionHeading(lineText, line) && !isTableHeadingOrCaption(lineText) && !isTabularVisualLine(line)) {
        inTableBlock = false;
      } else {
        continue;
      }
    }

    // Main / bold headings — never highlighted in AI or Similarity
    if (looksLikeSectionHeading(lineText, line)) continue;

    // Cover taglines with multiple mid-line bullets, not body list items
    const bulletCount = (lineText.match(/[•·▪]/g) || []).length;
    if (bulletCount >= 2 && lineText.length <= 120) continue;

    // Never allow AI/similarity highlights on TOC, table, graph, heading, or reference lines.
    if (
      isTableOfContentsText(lineText) ||
      isTableHeadingOrCaption(lineText) ||
      isTableRowOrData(lineText) ||
      isTabularVisualLine(line) ||
      isFigureOrGraphText(lineText) ||
      isGlossaryOrTermTableText(lineText) ||
      isMainHeadingText(lineText) ||
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

    for (const span of splitIntoSentencesWithSpans(combinedText)) {
      const sentenceStart = span.start;
      const sentenceText = span.text;
      const sentenceEnd = span.end;
      if (sentenceText.length < 8 || isExcludedFromHighlighting(sentenceText)) continue;
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
      const matchingSnippet = report.snippets?.find(snippet =>
        snippet.type === 'plagiarized' &&
        (normalizedSentence.includes(snippet.text.toLowerCase()) ||
          snippet.text.toLowerCase().includes(normalizedSentence))
      );
      sentences.push({
        text: sentenceText,
        sourceIndex: matchingSnippet?.sourceIndex,
        lineRanges,
      });
    }
  }

  if (!isSimilarity) {
    if (sentences.length === 0) return [];
    const wordCounts = sentences.map(sentence => countWords(sentence.text));
    const selected = new Set(selectIndicesForWordShare(wordCounts, aiScore));
    const highlightBoxes: DocHighlightBox[] = [];

    sentences.forEach((sentence, sentenceIndex) => {
      if (!selected.has(sentenceIndex)) return;
      sentence.lineRanges.forEach((range, rangeIndex) => {
        const line = lines[range.lineIdx];
        const coversFullLine = range.start <= 1 && range.end >= Math.max(1, line.lineText.length - 1);
        let left = coversFullLine ? line.left : Number.POSITIVE_INFINITY;
        let right = coversFullLine ? line.left + line.width : Number.NEGATIVE_INFINITY;
        let top = line.top;
        let bottom = line.top + line.height;

        if (!coversFullLine) {
          let textOffset = 0;
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
            textOffset = itemEnd + (item.str.endsWith(' ') ? 0 : 1);
          }
        }

        if (!Number.isFinite(left) || right <= left) {
          left = line.left;
          right = line.left + line.width;
        }
        const padding = 0.5;
        const boxLeft = Math.max(30, left - padding);
        const boxTop = Math.max(48, top - padding);
        const boxRight = Math.min(pageWidth - 30, right + padding);
        const boxBottom = Math.min(pageHeight - 48, bottom + padding);
        highlightBoxes.push({
          id: `ai-hl-${pageIndex}-${sentenceIndex}-${rangeIndex}`,
          left: boxLeft,
          top: boxTop,
          width: Math.max(1, boxRight - boxLeft),
          height: Math.max(1, boxBottom - boxTop),
          type: 'ai',
          sourceIndex: 1,
        });
      });
    });

    return highlightBoxes;
  }

  if (sentences.length === 0) return [];
  const matchingSentences = sentences.filter(sentence => sentence.sourceIndex !== undefined);
  const selectionPool = matchingSentences.length === 0 ? sentences : matchingSentences;
  const targetCount = Math.max(1, Math.min(selectionPool.length, Math.round(plagScore / 100 * sentences.length)));
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
      const padding = 0.5;
      const boxLeft = Math.max(30, left - padding);
      const boxTop = Math.max(48, top - padding);
      const boxRight = Math.min(pageWidth - 30, right + padding);
      const boxBottom = Math.min(pageHeight - 48, bottom + padding);
      const boxHeight = Math.max(1, boxBottom - boxTop);
      const showBadge = rangeIndex === 0;
      const sourceIndex = sentence.sourceIndex || ((sentenceIndex % 4) + 1);

      highlightBoxes.push({
        id: `hl-${pageIndex}-${sentenceIndex}-${range.lineIdx}`,
        left: boxLeft,
        top: boxTop,
        width: Math.max(1, boxRight - boxLeft),
        height: boxHeight,
        type: 'plagiarized',
        sourceIndex,
        showBadge,
        badgeNumber: sourceIndex,
        badgeLeft: Math.max(10, boxLeft - 15),
        badgeTop: boxTop + (Math.max(11, boxHeight) - 12) / 2,
      });
    });
  });

  return highlightBoxes;
}
