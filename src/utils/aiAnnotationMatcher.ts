export interface TextRange {
  start: number;
  end: number;
}

export interface AnnotationCoverage {
  annotatedWords: number;
  totalWords: number;
  percentage: number;
}

interface NormalizedText {
  value: string;
  sourceStarts: number[];
  sourceEnds: number[];
}

function normalizeWithSourceMap(text: string): NormalizedText {
  let value = "";
  const sourceStarts: number[] = [];
  const sourceEnds: number[] = [];
  let pendingSpaceStart: number | undefined;
  let pendingSpaceEnd: number | undefined;

  for (let index = 0; index < text.length;) {
    const codePoint = text.codePointAt(index);
    if (codePoint === undefined) break;
    const char = String.fromCodePoint(codePoint);
    const nextIndex = index + char.length;
    const normalized = char.normalize("NFKC").toLowerCase();

    if (/^\s+$/u.test(normalized)) {
      if (value && pendingSpaceStart === undefined) pendingSpaceStart = index;
      pendingSpaceEnd = nextIndex;
    } else {
      if (pendingSpaceStart !== undefined) {
        value += " ";
        sourceStarts.push(pendingSpaceStart);
        sourceEnds.push(pendingSpaceEnd ?? pendingSpaceStart + 1);
        pendingSpaceStart = undefined;
        pendingSpaceEnd = undefined;
      }

      for (const normalizedChar of normalized) {
        value += normalizedChar;
        sourceStarts.push(index);
        sourceEnds.push(nextIndex);
      }
    }

    index = nextIndex;
  }

  return { value, sourceStarts, sourceEnds };
}

export function findAnnotationRanges(text: string, annotations: string[]): TextRange[] {
  const normalizedSource = normalizeWithSourceMap(text);
  const ranges: TextRange[] = [];

  for (const annotation of annotations) {
    const normalizedAnnotation = normalizeWithSourceMap(annotation).value.trim();
    if (normalizedAnnotation.length < 15) continue;

    let searchFrom = 0;
    while (searchFrom < normalizedSource.value.length) {
      const matchStart = normalizedSource.value.indexOf(normalizedAnnotation, searchFrom);
      if (matchStart === -1) break;

      const matchEnd = matchStart + normalizedAnnotation.length;
      const start = normalizedSource.sourceStarts[matchStart];
      const end = normalizedSource.sourceEnds[matchEnd - 1];
      if (start !== undefined && end !== undefined && end > start) {
        ranges.push({ start, end });
      }
      searchFrom = matchEnd;
    }
  }

  const sortedRanges = ranges
    .sort((first, second) => first.start - second.start || first.end - second.end)
    .reduce<TextRange[]>((merged, range) => {
      const previous = merged[merged.length - 1];
      if (previous && range.start <= previous.end) {
        previous.end = Math.max(previous.end, range.end);
      } else {
        merged.push({ ...range });
      }
      return merged;
    }, []);
  return sortedRanges;
}

export function getAnnotationCoverage(text: string, annotations: string[]): AnnotationCoverage {
  const countWords = (value: string) => value.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0;
  const totalWords = countWords(text);
  const annotatedWords = findAnnotationRanges(text, annotations)
    .reduce((total, range) => total + countWords(text.slice(range.start, range.end)), 0);

  return {
    annotatedWords,
    totalWords,
    percentage: totalWords > 0 ? Math.round((annotatedWords / totalWords) * 100) : 0,
  };
}
