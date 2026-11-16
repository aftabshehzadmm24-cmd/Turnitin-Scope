import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { HighlightedSnippet } from '../types';
import { cleanBase64ToUint8Array } from './pdfPageRenderer';

export interface ExtractedDocumentData {
  text: string;
  fileData?: string; // base64 representation
  fileMimeType?: string;
  sourceFileData?: string;
  sourceFileMimeType?: string;
  sourceFileSize?: number;
  htmlContent?: string;
  htmlPages?: string[];
  pageCount?: number;
  wordCount?: number;
}

const MAX_DOCUMENT_WORDS = 60000;

export const MAX_SIMILARITY_SCORE = 40;

export function clampSimilarityScore(score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  return Math.min(MAX_SIMILARITY_SCORE, score);
}

const WORD_COUNT_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

export function countWords(text: string): number {
  return text.match(WORD_COUNT_PATTERN)?.length ?? 0;
}

/**
 * Pick whole-sentence indices so highlighted words ≈ scorePercent of eligible words.
 * Sentences are never split. 88% AI highlights whole sentences in order until ~88% of
 * eligible body words are covered (remaining sentences stay unhighlighted).
 */
export function selectIndicesForWordShare(wordCounts: number[], scorePercent: number): number[] {
  const totalWords = wordCounts.reduce((sum, count) => sum + count, 0);
  if (!Number.isFinite(scorePercent) || scorePercent <= 0 || totalWords <= 0) return [];

  const clampedScore = Math.min(100, Math.max(0, scorePercent));
  if (clampedScore >= 100) {
    return wordCounts.map((_, index) => index);
  }

  const targetWords = Math.max(1, Math.round((clampedScore / 100) * totalWords));
  const n = wordCounts.length;

  // Estimate how many sentences we need by assuming average word count per sentence
  const avgWords = totalWords / n;
  let estimatedCount = Math.min(n, Math.max(1, Math.ceil(targetWords / avgWords)));

  // Spread evenly across document positions (same as getExactCoveragePositions)
  const pickEvenly = (count: number): number[] => {
    const positions = new Set<number>();
    for (let i = 0; i < count; i++) {
      const pos = Math.min(n - 1, Math.max(0, Math.round(((i + 0.5) * n) / count)));
      positions.add(pos);
    }
    return Array.from(positions).sort((a, b) => a - b);
  };

  // Grow until we hit the word target
  let positions = pickEvenly(estimatedCount);
  let covered = positions.reduce((s, idx) => s + (wordCounts[idx] ?? 0), 0);

  while (covered < targetWords && estimatedCount < n) {
    estimatedCount = Math.min(n, estimatedCount + Math.max(1, Math.ceil((n - estimatedCount) * 0.1)));
    positions = pickEvenly(estimatedCount);
    covered = positions.reduce((s, idx) => s + (wordCounts[idx] ?? 0), 0);
  }

  return positions;
}

/**
 * Split text into sentences without breaking on abbreviations, initials, or decimals.
 * Returns spans in the original string so highlights can start at the first word
 * and end on the last word of each sentence.
 */
export function splitIntoSentencesWithSpans(text: string): Array<{ text: string; start: number; end: number }> {
  if (!text) return [];

  let protectedText = text;
  const protect = (pattern: RegExp) => {
    protectedText = protectedText.replace(pattern, match => match.replace(/\./g, '\u0001'));
  };

  protect(/\b(?:Inc|Ltd|LLC|Corp|Co|vs|Fig|Figs|Dr|Mr|Ms|Mrs|Prof|Jr|Sr|No|Vol|Pp|cf|al|etc|approx|Est|Dept|Univ|Ed|eds|p|pp)\./gi);
  protect(/\b(?:U\.S|U\.K|E\.U|e\.g|i\.e|N\.A|P\.S)\./gi);
  protect(/\b(?:Q[1-4]|FY)\s*\d{2,4}\b/gi);
  protect(/(\d)\.(\d)/g);

  const spans: Array<{ text: string; start: number; end: number }> = [];
  const sentencePattern = /[^.!?]+(?:[.!?]["'”’)]*)+(?:\s+|$)|[^.!?]+$/g;

  for (const match of protectedText.matchAll(sentencePattern)) {
    const raw = match[0];
    const leading = raw.length - raw.trimStart().length;
    const trailingPad = raw.length - raw.trimEnd().length;
    const start = (match.index ?? 0) + leading;
    const innerLength = raw.length - leading - trailingPad;
    if (innerLength <= 0) continue;
    const end = start + innerLength;
    const sentenceText = text.slice(start, end).trim();
    if (!sentenceText) continue;
    spans.push({ text: sentenceText, start, end: start + sentenceText.length });
  }

  return spans;
}

export function splitIntoSentences(text: string): string[] {
  return splitIntoSentencesWithSpans(text).map(span => span.text);
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Extracts clean, human-readable text and full rich structure (HTML, base64, page count, images, tables)
 * from uploaded files (DOCX, PDF, TXT).
 * DOCX files are converted to a vector PDF via server-side LibreOffice so the
 * report uses rendered document pages rather than rebuilding pages from text.
 * Pagination can still differ if the source uses fonts unavailable on the server.
 */
export async function extractDocumentDataFromFile(file: File): Promise<ExtractedDocumentData> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || '';

  try {
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = arrayBufferToBase64(arrayBuffer);

    if (fileExt === 'docx' || fileExt === 'doc') {
      let convertedPdfBase64 = '';
      let pdfPageCount = 0;
      let conversionError = 'DOCX page conversion service is unavailable. Please make sure the app server is running (npm run dev).';
      const converterBaseUrl = (
        import.meta.env.VITE_DOCX_CONVERTER_URL ||
        import.meta.env.VITE_API_URL ||
        ''
      ).replace(/\/$/, '');

      // Convert DOC/DOCX to PDF before extracting text or continuing the scan.
      try {
        const conversionEndpoint = converterBaseUrl
          ? `${converterBaseUrl}/api/convert-docx`
          : '/api/convert-docx';
        const res = await fetch(conversionEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docxBase64: base64Data, fileName: file.name }),
          signal: AbortSignal.timeout(120_000),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success || !json.pdfBase64) {
          conversionError = json.error || conversionError;
        } else {
          convertedPdfBase64 = json.pdfBase64;
          const pdfDoc = await PDFDocument.load(cleanBase64ToUint8Array(convertedPdfBase64), {
            ignoreEncryption: true,
          });
          pdfPageCount = pdfDoc.getPageCount() || 1;
        }
      } catch (srvErr) {
        console.warn('Server-side LibreOffice conversion notice:', srvErr);
        conversionError = srvErr instanceof Error ? srvErr.message : conversionError;
      }

      // If converted to true vector PDF via LibreOffice, return vector PDF directly!
      if (convertedPdfBase64) {
        let extractedText = '';
        try {
          const loadingTask = pdfjsLib.getDocument({
            data: cleanBase64ToUint8Array(convertedPdfBase64),
            useSystemFonts: true,
          });
          const pdf = await loadingTask.promise;
          pdfPageCount = pdf.numPages || pdfPageCount;
          const textParts: string[] = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str || '')
              .filter(Boolean)
              .join(' ');
            if (pageText.trim()) {
              textParts.push(pageText.trim());
            }
          }
          extractedText = textParts.join('\n\n');
        } catch (pdfErr) {
          console.warn('PDF.js text extraction from converted DOCX notice:', pdfErr);
        }

        if (!extractedText || extractedText.length < 30) {
          throw new Error('LibreOffice converted the DOCX to PDF, but the resulting PDF did not contain enough readable text to scan.');
        }

        const clean = cleanText(extractedText);
        const words = clean.trim().split(/\s+/).filter(Boolean).length;

        // Word limit check (60,000 words maximum)
        if (words > 60000) {
          throw new Error(`File exceeds the maximum limit of 60,000 words (detected ${words.toLocaleString()} words). Please upload a document with 60,000 words or fewer.`);
        }

        return {
          text: clean,
          fileData: convertedPdfBase64,
          fileMimeType: 'application/pdf',
          sourceFileData: base64Data,
          sourceFileMimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          sourceFileSize: file.size,
          pageCount: pdfPageCount || Math.max(1, Math.ceil(words / 320)),
          wordCount: words,
        };
      }

      throw new Error(
        `DOCX page conversion failed (${conversionError}). Upload a PDF to preserve the original page layout.`
      );
    }

      /*
      const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      let extractedText = '';
      let htmlContent = '';

      try {
        // Convert to HTML with full embedded base64 images, tables, headings, and formatting
        const mammothOptions = {
          convertImage: mammoth.images.imgElement((image: any) => {
            return image.read('base64').then((imageBuffer: string) => {
              return {
                src: `data:${image.contentType};base64,${imageBuffer}`,
              };
            });
          }),
        };
        const htmlRes = await mammoth.convertToHtml({ arrayBuffer }, mammothOptions);
        htmlContent = htmlRes.value || '';

        const rawTextRes = await mammoth.extractRawText({ arrayBuffer });
        extractedText = cleanText(rawTextRes.value);
      } catch (err) {
        console.warn('Mammoth extraction failed, falling back to JSZip XML parser', err);
      }

      // Fallback text extraction via JSZip if needed
      if (!extractedText || extractedText.length < 30) {
        try {
          const zip = await JSZip.loadAsync(arrayBuffer);
          const docXmlFile = zip.file('word/document.xml');
          if (docXmlFile) {
            const xmlContent = await docXmlFile.async('string');
            const textMatches = xmlContent.match(/<w:t[\s>][^<]*<\/w:t>/g) || [];
            const text = textMatches.map(t => t.replace(/<[^>]+>/g, '')).join(' ');
            extractedText = cleanText(text);
          }
        } catch (zipErr) {
          console.warn('JSZip extraction fallback error', zipErr);
        }
      }

      if (!extractedText || extractedText.length < 30) {
        throw new Error('No readable text could be extracted from this document. Please upload a document with selectable text or a valid PDF/DOCX file.');
      }

      // Split HTML into structured pages (preserving headings, tables, and images intact)
      const words = extractedText.trim().split(/\s+/).filter(Boolean).length;

      // Word limit check (60,000 words maximum)
      if (words > 60000) {
        throw new Error(`File exceeds the maximum limit of 60,000 words (detected ${words.toLocaleString()} words). Please upload a document with 60,000 words or fewer.`);
      }

      const estimatedPages = Math.max(1, Math.ceil(words / 320));
      const htmlPages = splitHtmlIntoPages(htmlContent || `<p>${extractedText}</p>`, estimatedPages);

      return {
        text: extractedText,
        fileData: base64Data,
        fileMimeType: mimeType,
        htmlContent,
        htmlPages,
        pageCount: estimatedPages,
        wordCount: words,
      };
      */

    if (fileExt === 'pdf') {
      const mimeType = 'application/pdf';
      let pageCount = 1;
      try {
        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        pageCount = pdfDoc.getPageCount() || 1;
      } catch (pdfErr) {
        console.warn('PDFDocument loading error for page counting:', pdfErr);
      }

      // Extract authentic printable text from PDF pages using pdfjs-dist
      let extractedPdfText = '';
      try {
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          useSystemFonts: true,
        });
        const pdf = await loadingTask.promise;
        pageCount = pdf.numPages || pageCount;
        const textParts: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str || '')
            .filter(Boolean)
            .join(' ');
          if (pageText.trim()) {
            textParts.push(pageText.trim());
          }
        }
        extractedPdfText = textParts.join('\n\n');
      } catch (pdfJsErr) {
        console.warn('PDF.js text extraction fallback:', pdfJsErr);
      }

      const clean = cleanText(extractedPdfText);
      if (!clean || clean.length < 50) {
        throw new Error('No readable text could be extracted from this PDF. Please upload a PDF with selectable text or a valid document version.');
      }

      const words = clean.trim().split(/\s+/).filter(Boolean).length;

      // Word limit check (60,000 words maximum)
      if (words > 60000) {
        throw new Error(`File exceeds the maximum limit of 60,000 words (detected ${words.toLocaleString()} words). Please upload a document with 60,000 words or fewer.`);
      }

      return {
        text: clean,
        fileData: base64Data,
        fileMimeType: mimeType,
        sourceFileData: base64Data,
        sourceFileMimeType: file.type || mimeType,
        sourceFileSize: file.size,
        pageCount,
        wordCount: words,
      };
    }

    if (fileExt === 'txt' || fileExt === 'md') {
      const text = await file.text();
      const cleaned = cleanText(text);
      const words = cleaned.trim().split(/\s+/).filter(Boolean).length;

      // Word limit check (60,000 words maximum)
      if (words > 60000) {
        throw new Error(`File exceeds the maximum limit of 60,000 words (detected ${words.toLocaleString()} words). Please upload a document with 60,000 words or fewer.`);
      }

      const pages = Math.max(1, Math.ceil(words / 320));
      return {
        text: cleaned,
        fileData: base64Data,
        fileMimeType: 'text/plain',
        sourceFileData: base64Data,
        sourceFileMimeType: file.type || 'text/plain',
        sourceFileSize: file.size,
        pageCount: pages,
        wordCount: words,
      };
    }
  } catch (globalErr: any) {
    console.error('Error in extractDocumentDataFromFile:', globalErr);
    if (globalErr instanceof Error) {
      throw globalErr;
    }
  }

  throw new Error('No readable text could be extracted from this document. Please upload a document with actual content to run the scan.');
}

/**
 * Filters extracted document text for AI scanning by removing sections that should
 * never be checked for AI authorship:
 * - Table of Contents
 * - Tables / tabular data / glossary tables
 * - Graphs / figures / charts
 * - References / bibliography / citation lines
 * - Main headings (numbered sections, ALL-CAPS titles, common academic section titles)
 *
 * Returns only eligible body paragraphs joined as a single string, preserving their
 * original wording so the API's annotation strings still match the source text.
 */
export function filterTextForAiScan(text: string): string {
  if (!text) return '';

  const rawParagraphs = cleanText(text).split(/\n\s*\n/);
  const bodyParagraphs: string[] = [];
  let inBibSection = false;
  let inTocSection = false;
  let inTableBlock = false;
  let inFigureBlock = false;

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Detect section starts
    if (isBibliographyHeading(trimmed) || isBibliographyOrReferenceText(trimmed)) {
      inBibSection = true;
    }
    if (isTableOfContentsHeading(trimmed) || isTableOfContentsText(trimmed)) {
      inTocSection = true;
    } else if (
      inTocSection &&
      (
        (/^[0-9]+\.\s+[A-Za-z]/.test(trimmed) &&
          !trimmed.includes('....') &&
          !/\d+$/.test(trimmed)) ||
        (trimmed.length >= 250 && /[.!?]/.test(trimmed) && !isTableOfContentsEntry(trimmed))
      )
    ) {
      inTocSection = false; // TOC ended, body started
    }

    if (isTableHeadingOrCaption(trimmed) || isTableText(trimmed)) {
      inTableBlock = true;
    } else if (inTableBlock) {
      inTableBlock = false;
    }

    if (isFigureOrGraphText(trimmed)) {
      inFigureBlock = true;
    } else if (
      inFigureBlock &&
      (isMainHeadingText(trimmed) || isTableHeadingOrCaption(trimmed) || (trimmed.length >= 90 && /[.!?]/.test(trimmed)))
    ) {
      inFigureBlock = false;
    }

    // Skip any excluded paragraph
    if (
      inBibSection ||
      inTocSection ||
      inTableBlock ||
      inFigureBlock ||
      isTableOfContentsText(trimmed) ||
      isTableText(trimmed) ||
      isGlossaryOrTermTableText(trimmed) ||
      isFigureOrGraphText(trimmed) ||
      isBibliographyOrReferenceText(trimmed) ||
      isCitationLine(trimmed) ||
      isMainHeadingText(trimmed)
    ) {
      continue;
    }

    bodyParagraphs.push(trimmed);
  }

  return bodyParagraphs.join('\n\n');
}

/**
 * Splits extracted HTML into page chunks to maintain page structure and layout fidelity
 */
function splitHtmlIntoPages(fullHtml: string, targetPages: number): string[] {
  if (!fullHtml) return [];

  // Match top-level blocks: <p>...</p>, <table>...</table>, <h1>...</h1>, <h2>...</h2>, etc.
  const blockRegex = /<(p|table|h1|h2|h3|h4|h5|h6|ul|ol|div|blockquote)[^>]*>[\s\S]*?<\/\1>/gi;
  const blocks = fullHtml.match(blockRegex) || [fullHtml];

  if (blocks.length <= targetPages || targetPages <= 1) {
    return [fullHtml];
  }

  const blocksPerPage = Math.ceil(blocks.length / targetPages);
  const pages: string[] = [];

  for (let i = 0; i < blocks.length; i += blocksPerPage) {
    const pageChunk = blocks.slice(i, i + blocksPerPage).join('\n');
    pages.push(pageChunk);
  }

  return pages.length > 0 ? pages : [fullHtml];
}

/**
 * Extracts clean, human-readable text from uploaded files (DOCX, PDF, TXT).
 * Completely eliminates binary noise (like "PK \x03\x04", XML tags, or docProps).
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const docData = await extractDocumentDataFromFile(file);
  return docData.text;
}

/**
 * Strips binary control codes, zip headers (PK...), and unreadable characters
 */
export function cleanText(input: string): string {
  if (!input) return '';

  return (
    input
      // Remove zip PK binary headers and file markers
      .replace(/PK[\s\S]*?(docProps|word|settings|styles|app\.xml)[\s\S]*?PK/gi, '')
      .replace(/PK[\x00-\x20].*?(\.xml|\.rels)/gi, '')
      // Remove XML tags if any leaked
      .replace(/<[^>]+>/g, ' ')
      // Remove non-printable control characters (except newline, tab, return)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFFFD]/g, ' ')
      // Remove consecutive garbage sequences
      .replace(/[^\x20-\x7E\n\r\t\u00A0-\u024F\u1E00-\u1EFF]/g, ' ')
      // Normalize whitespace
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim()
  );
}

/**
 * Fallback synthesizer that produces authentic scholarly manuscript content
 * tailored to the document name, ensuring the report is always polished.
 */
export function generateCleanAcademicContent(fileName: string): string {
  const baseName = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  const capitalizedTopic = baseName.charAt(0).toUpperCase() + baseName.slice(1);

  return `Abstract:
This investigation evaluates the core methodologies and empirical implications of ${capitalizedTopic}. Academic integrity in contemporary scientific inquiry mandates rigorous provenance and traceable evidence. Recent developments in foundation models present complex challenges for institutional peer review pipelines.

1. Introduction & Background
The widespread adoption of generative deep architectures has prompted extensive debate concerning the originality of scholastic output. Within the domain of ${capitalizedTopic}, comparative analyses reveal that multi-layered linguistic perplexity provides robust indicators when identifying synthetically generated prose. Systematic benchmarking across peer-reviewed archives confirms that transparent citation protocols substantially diminish inadvertent overlap.

2. Methodology & Comparative Analysis
We utilized semantic vector embeddings and n-gram overlap algorithms to quantify cross-institutional similarity. As noted in recent literature (Smith et al., 2024), computational pattern matching distinguishes verbatim repetition from authentic conceptual paraphrasing. Furthermore, token-level burstiness curves highlight sections with statistically low lexical variability.

3. Results & Discussion
Empirical results indicate a statistically significant correlation between algorithmic detection scores and human expert evaluations. Transparent attribution frameworks guarantee that researchers retain full intellectual ownership while adhering to rigorous institutional publication guidelines. Future research must bridge the divide between heuristic detectors and emerging multimodal foundation models.`;
}

/**
 * Checks if a block or line of text is a Table of Contents heading
 */
export function isTableOfContentsHeading(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  return (
    lower === 'table of contents' ||
    lower === 'table of contents:' ||
    lower.startsWith('table of contents\n') ||
    /^table of contents?\b/i.test(lower) ||
    lower === 'contents' ||
    lower === 'contents:' ||
    lower.startsWith('contents\n') ||
    lower === 'table of figures' ||
    lower === 'table of figures:' ||
    lower === 'list of tables' ||
    lower === 'list of tables:' ||
    lower === 'list of figures' ||
    lower === 'list of figures:' ||
    lower === 'list of illustrations' ||
    lower === 'list of abbreviations' ||
    lower === 'indice' ||
    lower === 'índice' ||
    lower === 'index' ||
    lower === 'index:' ||
    /^([0-9]+\.?\s*)?(table of contents|contents|list of tables|list of figures|table of figures)\b/i.test(lower)
  );
}

/**
 * Checks if a block or line of text is an individual Table of Contents entry
 */
export function isTableOfContentsEntry(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();

  // Dot leaders or symbol leaders followed by page number or roman numeral: ".... 12" or ".... iv"
  if (/\.{2,}\s*(\d+|[ivxlcdm]+)$/i.test(trimmed)) return true;
  if (/(?:\.\s*){3,}(\d+|[ivxlcdm]+)$/i.test(trimmed)) return true;
  if (/·{2,}\s*(\d+|[ivxlcdm]+)$/i.test(trimmed)) return true;
  if (/_{2,}\s*(\d+|[ivxlcdm]+)$/i.test(trimmed)) return true;

  // Chapter / Section / Unit ending in page number
  if (/^(chapter|section|unit|module|appendix|annex|part)\s+[0-9a-zivx]+[\s\S]*?\d+$/i.test(trimmed)) return true;

  // Section number and title with tab, wide space, or dots followed by page number: "1.1 Introduction    4"
  if (/^\d+(\.\d+)*\s+[A-Za-z\s]+(?:\t|\s{3,}|\.{2,})\s*(\d+|[ivxlcdm]+)$/i.test(trimmed)) return true;

  // Title followed by right-aligned page number
  if (/^[A-Z][A-Za-z\s]{3,45}(?:\t|\s{4,}|\.{2,})\s*(\d+|[ivxlcdm]+)$/i.test(trimmed)) return true;

  return false;
}

/**
 * Checks if a block or line of text belongs to a Table of Contents
 */
export function isTableOfContentsText(text: string): boolean {
  return isTableOfContentsHeading(text) || isTableOfContentsEntry(text);
}

/**
 * Checks if a line is a Table caption or heading
 */
export function isTableHeadingOrCaption(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();

  if (isTableOfContentsHeading(trimmed)) return false;

  return (
    /^(Table|Cuadro|Tabla|Tab\.)\s+[0-9A-Za-z\.\-_]+[:\.\s\-]/i.test(trimmed) ||
    /^(Table|Cuadro|Tabla|Tab\.)\s+[0-9A-Za-z\.\-_]+$/i.test(trimmed) ||
    /^Table\s+\d+\b/i.test(trimmed) ||
    /^Table\s*:\s*/i.test(trimmed) ||
    /^(TABLE|CUADRO|TABLA)\s+[IVX0-9]+/i.test(trimmed)
  );
}

/**
 * Checks if a line is a Figure / Graph / Chart / Diagram / Image caption or label.
 * These must never receive AI or Similarity highlights.
 */
export function isFigureOrGraphText(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();

  return (
    /^(Figure|Fig\.|Figura|Graph|Chart|Diagram|Plot|Illustration|Exhibit|Plate|Image|Photo|Photograph|Screenshot|Picture)\s+[0-9A-Za-z\.\-_]+(\s*[:.\-–—].*)?$/i.test(
      trimmed
    ) ||
    /^(Figure|Fig\.|Figura|Graph|Chart|Diagram|Plot|Image|Photo)\s*[.:]\s*\S+/i.test(trimmed) ||
    /^(FIGURE|FIG\.|GRAPH|CHART|DIAGRAM|PLOT|IMAGE|PHOTO)\s+[IVX0-9A-Za-z\.\-_]+/i.test(trimmed) ||
    /^(Source|Fuente):\s*(Figure|Fig\.|Graph|Chart|Diagram|Image|Photo|Adapted from|Based on)/i.test(trimmed) ||
    /^(Source|Fuente):\s*.{0,80}$/i.test(trimmed)
  );
}

/**
 * Checks if a line is a main / section heading (often bold in the source document).
 * Headings must never receive AI highlights.
 */
export function isMainHeadingText(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed.length > 120) return false;

  // Ends with sentence punctuation → body text, not a heading
  if (/[.!?]$/.test(trimmed) && trimmed.length > 40) return false;

  const lower = trimmed.toLowerCase();

  // Common academic section titles (exact or lightly numbered)
  const knownHeadings = [
    'abstract',
    'introduction',
    'background',
    'literature review',
    'related work',
    'methodology',
    'materials and methods',
    'methods',
    'results',
    'results and discussion',
    'discussion',
    'conclusion',
    'conclusions',
    'acknowledgement',
    'acknowledgements',
    'acknowledgment',
    'acknowledgments',
    'appendix',
    'appendices',
    'summary',
    'executive summary',
    'objectives',
    'aim',
    'aims',
    'scope',
    'limitations',
    'future work',
    'recommendation',
    'recommendations',
    'findings',
    'analysis',
    'data analysis',
    'theoretical framework',
    'research questions',
    'hypothesis',
    'chapter',
    'glossary',
    'further learning',
    'further reading',
    'key terms',
    'terminology',
    'index',
  ];
  if (knownHeadings.some(h => lower === h || lower === `${h}:`)) return true;
  if (
    /^([0-9]+(\.[0-9]+)*\.?\s+)?(abstract|introduction|background|literature review|related work|methodology|materials and methods|methods|results|discussion|conclusion|conclusions|acknowledgements?|appendix|summary|objectives?|recommendations?|findings|analysis|glossary|further learning|further reading|key terms)\s*:?$/i.test(
      trimmed
    )
  ) {
    return true;
  }

  // Numbered section headings: "1. Introduction", "2.1 Methods", "Chapter 3", "13. Glossary and Further Learning"
  if (/^(chapter|section|unit|part|module)\s+[0-9ivxlcdm]+(\s*[:.\-–—]\s*.{0,80})?$/i.test(trimmed)) {
    return true;
  }
  if (/^\d+(\.\d+){0,3}\.?\s+[A-Z][\s\S]{1,90}$/.test(trimmed) && !/[.!?]$/.test(trimmed) && trimmed.length <= 100) {
    return true;
  }

  // ALL-CAPS short headings (typical bold titles)
  const lettersOnly = trimmed.replace(/[^A-Za-z]/g, '');
  if (
    lettersOnly.length >= 3 &&
    lettersOnly.length <= 60 &&
    trimmed.length <= 80 &&
    trimmed === trimmed.toUpperCase() &&
    /[A-Z]/.test(trimmed) &&
    !/[.!?]$/.test(trimmed)
  ) {
    return true;
  }

  // Short Title / subtitle lines (allow curly apostrophes): "A Practical Beginner's Guide"
  const titleCaseWords = trimmed.split(/\s+/);
  if (
    titleCaseWords.length >= 2 &&
    titleCaseWords.length <= 10 &&
    trimmed.length <= 80 &&
    !/[.!?:,;]$/.test(trimmed) &&
    titleCaseWords.every(w => /^[A-Z0-9][A-Za-z0-9\-''']*$/u.test(w) || /^(and|or|of|the|a|an|to|in|on|for)$/i.test(w)) &&
    titleCaseWords.filter(w => /^[A-Z]/.test(w)).length >= Math.ceil(titleCaseWords.length * 0.6)
  ) {
    return true;
  }

  return false;
}

/**
 * Glossary / term-definition table headers and rows (never AI-highlight).
 */
export function isGlossaryOrTermTableText(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (/^(term|terms|meaning|definition|definitions|description)\s*$/i.test(trimmed)) return true;
  if (/^term\s+meaning$/i.test(trimmed) || /^terms?\s+definitions?$/i.test(trimmed)) return true;
  if (lower === 'glossary' || lower.startsWith('glossary ')) return true;

  // "AI: Artificial intelligence..." or "AI — Artificial intelligence..."
  if (trimmed.length <= 160 && /^[A-Z][A-Za-z0-9 /&\-]{0,40}\s*[:–—-]\s+[A-Z]/.test(trimmed)) return true;
  // "Algorithm; A procedure for..." (term + semicolon definition)
  if (/^[A-Z][A-Za-z0-9 /&\-]{1,40};\s+\S+/.test(trimmed)) return true;

  // Short glossary term alone (1–4 words, no sentence punctuation)
  if (
    trimmed.length <= 40 &&
    !/[.!?]$/.test(trimmed) &&
    /^[A-Z][A-Za-z0-9 /&\-]{0,35}$/.test(trimmed) &&
    trimmed.split(/\s+/).length <= 4 &&
    !/^(The|This|That|These|Those|When|Where|What|How|Why|With|From)\b/.test(trimmed)
  ) {
    // Acronyms or capitalized glossary headwords
    if (/^[A-Z]{2,12}$/.test(trimmed)) return true;
    if (/^[A-Z][a-z]+(?:[ -][A-Z][a-z]+)?$/.test(trimmed)) return true;
  }

  return false;
}

/**
 * Checks if a block or line of text belongs to a Table or Tabular Data
 */
export function isTableRowOrData(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();

  // Markdown or ASCII table delimiters: | col1 | col2 | or +---+---+
  if (/^\|.*\|.*\|/.test(trimmed) || /^\|\s*[-:]+\s*\|\s*[-:]+\s*\|/.test(trimmed) || /^[+\-|]{4,}/.test(trimmed)) {
    return true;
  }

  // Multi-column or tab-delimited tabular rows (containing numbers/metrics aligned with tabs or multiple spaces)
  if (trimmed.includes('\t') && (/\d/.test(trimmed) || trimmed.split('\t').length >= 3)) {
    return true;
  }

  // Table column headers containing typical tabular keywords
  if (
    /^(Sr\.?\s*No\.?|S\/N|No\.|Item|Parameter|Metric|Variable|Description|Dimension|Value|Unit|Result|Score|Status|Total|Quantity|Qty|Price|Percentage|%)\b/i.test(
      trimmed
    )
  ) {
    return true;
  }

  // Row of 3 or more numbers/metrics/percentages separated by spaces: "12.4   45.2%   89.1"
  if (/(?:\b\d+(?:\.\d+)?%?\b[\s\t]{2,}){2,}\b\d+(?:\.\d+)?%?\b/.test(trimmed)) {
    return true;
  }

  // Common table footnotes / notes
  if (
    /^(Note|Notes|Source|Fuente|Footnote):\s*(Table|Based on|Adapted from|Data from|\*|\d)/i.test(trimmed) ||
    /^\*{1,3}\s*(p\s*[<>=]\s*0\.\d+|significant|source)/i.test(trimmed)
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if a block or line of text belongs to a Table or Tabular Data
 */
export function isTableText(text: string): boolean {
  return isTableHeadingOrCaption(text) || isTableRowOrData(text);
}

/**
 * Checks if a sentence is a quotation (enclosed in quotes or cited direct quote)
 */
export function isQuoteText(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  // Starts and ends with quotation mark
  if (/^["'“”«»‘][\s\S]*["'“”«»’]$/.test(trimmed)) {
    return true;
  }
  // Contains prominent quotes with citation
  if (/["“”«»].{20,}["“”«»]/.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Checks if a line is a References / Bibliography heading
 */
export function isBibliographyHeading(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  return (
    lower === 'references' ||
    lower === 'references:' ||
    lower === 'references and notes' ||
    lower === 'references & notes' ||
    lower === 'reference list' ||
    lower === 'reference list:' ||
    lower === 'bibliography' ||
    lower === 'bibliography:' ||
    lower === 'works cited' ||
    lower === 'works cited:' ||
    lower === 'literature cited' ||
    lower === 'literature cited:' ||
    lower === 'citations' ||
    lower === 'citations:' ||
    lower === 'sources' ||
    lower === 'bibliografía' ||
    lower === 'referencias' ||
    lower === 'fuentes de consulta' ||
    /^([0-9]+\.?\s*)?(references|bibliography|works cited|literature cited|reference list)\s*[:]?$/i.test(lower)
  );
}

/**
 * Checks if a line is an individual citation or reference entry
 */
export function isCitationLine(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();

  // Numbered citations: [1], [2], [14] or 1., 2. with author/title
  if (/^\[\d+\]\s+[A-Za-z]/.test(trimmed)) return true;
  if (/^\d+\.\s+[A-Z][a-z]+,\s+[A-Z]/.test(trimmed)) return true;
  if (/^\(\d+\)\s+[A-Z]/.test(trimmed)) return true;

  // APA / Harvard author (year) pattern: "Smith, J. (2020)..." or "Anderson, R., & Moore, T. (2023)"
  if (/^[A-Z][a-zA-Z\s\.\-']{1,25},\s+[A-Z]\.?\s*\(\d{4}[a-z]?\)/.test(trimmed)) return true;
  if (/^[A-Z][a-zA-Z\s\.\-']{1,25},\s+[A-Z]\.,\s*(&|and)\s+[A-Z]/.test(trimmed)) return true;
  if (/^[A-Z][a-z]+\s+et\s+al\.,?\s*\(\d{4}\)/.test(trimmed)) return true;

  // DOI, URL, or publication metadata indicators
  if (/https?:\/\/doi\.org\//i.test(trimmed) || /doi:\s*10\.\d{4,9}\//i.test(trimmed)) return true;
  if (/ISBN(?:\s*-\s*1[03])?:\s*[\d\-]+/i.test(trimmed)) return true;
  if (/\b(vol\.|volume|no\.|issue|pp\.|pages)\s+\d+/i.test(trimmed) && /\b\d{4}\b/.test(trimmed)) return true;
  if (/^(Available at|Retrieved from|Accessed on):?\s*https?:\/\//i.test(trimmed)) return true;
  if (/^https?:\/\/[a-z0-9\.\-]+\.[a-z]{2,}/i.test(trimmed)) return true;

  return false;
}

/**
 * Checks if a block of text is part of the Bibliography / References section
 */
export function isBibliographyOrReferenceText(text: string): boolean {
  return isBibliographyHeading(text) || isCitationLine(text);
}

/**
 * Unconditional Excluded Section Detector for BOTH Similarity and AI reports:
 * TOC, Tables, Images, Graphs/Figures, Glossary, References, and main headings
 * must never be highlighted.
 */
export function isExcludedFromHighlighting(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  return (
    isTableOfContentsText(trimmed) ||
    isTableText(trimmed) ||
    isFigureOrGraphText(trimmed) ||
    isGlossaryOrTermTableText(trimmed) ||
    isBibliographyOrReferenceText(trimmed) ||
    isCitationLine(trimmed) ||
    isMainHeadingText(trimmed) ||
    isQuoteText(trimmed) ||
    (/^\d+\.?\s*(?:Introduction|Methods|Results|Discussion|Conclusion|References|Bibliography|Appendix|Glossary)\b/i.test(trimmed) && /\d+$/.test(trimmed))
  );
}

function getPercentageTargetCount(score: number, totalCandidates: number, minimumCoverage = 0): number {
  if (!Number.isFinite(score) || score <= 0 || totalCandidates <= 0) return 0;
  const target = (score / 100) * totalCandidates;
  const rounded = Math.max(minimumCoverage, Math.min(totalCandidates, Math.round(target)));
  return rounded;
}

function getExactCoveragePositions(totalCandidates: number, targetCount: number): number[] {
  if (!Number.isFinite(targetCount) || targetCount <= 0 || totalCandidates <= 0) return [];
  const safeTarget = Math.min(totalCandidates, Math.max(1, Math.round(targetCount)));
  const positions = new Set<number>();

  for (let i = 0; i < safeTarget; i++) {
    const pos = Math.min(
      totalCandidates - 1,
      Math.max(0, Math.round(((i + 0.5) * totalCandidates) / safeTarget))
    );
    positions.add(pos);
  }

  return Array.from(positions).sort((a, b) => a - b);
}

/**
 * Splits text into complete sentences and complete paragraphs with exact Turnitin rules:
 * - TOC, Tables, Graphs/Figures, References, and main headings are strictly unhighlighted.
 * - Similarity percentage strictly between 1% and 40% (capped at 40% max).
 * - When aiScore <= 20: ZERO AI highlights! Text remains clean and normal.
 * - When aiScore > 20: whole eligible sentences covering that share of body words (e.g. 80% AI → ~80% of eligible sentences).
 */
export function generateSmartSnippets(
  fullText: string,
  aiScore: number,
  plagiarismScore: number,
  sources: { id: string; name: string; similarity: number }[],
  filterOptions: { excludeQuotes?: boolean; excludeBibliography?: boolean } = {
    excludeQuotes: true,
    excludeBibliography: true,
  }
): HighlightedSnippet[] {
  const clampedPlagScore = clampSimilarityScore(plagiarismScore);
  const clampedAiScore = Number.isFinite(aiScore) ? Math.min(100, Math.max(0, aiScore)) : 0;
  const excludeQuotes = filterOptions.excludeQuotes !== false;

  const cleaned = cleanText(fullText);
  // Split text into paragraphs and complete sentences
  const rawParagraphs = cleaned.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  const sentences: string[] = [];
  let inBibSection = false;
  let inTocSection = false;
  let inTableBlock = false;
  const quoteSentenceIndices = new Set<number>();

  for (const para of rawParagraphs) {
    const trimmedPara = para.trim();
    const paragraphExcluded =
      isTableOfContentsText(trimmedPara) ||
      isTableText(trimmedPara) ||
      isFigureOrGraphText(trimmedPara) ||
      isMainHeadingText(trimmedPara) ||
      isBibliographyOrReferenceText(trimmedPara) ||
      isCitationLine(trimmedPara);

    if (paragraphExcluded) continue;

    if (isBibliographyHeading(trimmedPara) || isBibliographyOrReferenceText(trimmedPara)) {
      inBibSection = true;
    }
    if (isTableOfContentsHeading(trimmedPara) || isTableOfContentsText(trimmedPara)) {
      inTocSection = true;
    } else if (
      inTocSection &&
      /^[0-9]+\.\s+[A-Za-z]/.test(trimmedPara) &&
      !trimmedPara.includes('....') &&
      !/\d+$/.test(trimmedPara)
    ) {
      inTocSection = false;
    }

    if (isTableHeadingOrCaption(trimmedPara) || isTableText(trimmedPara)) {
      inTableBlock = true;
    } else if (inTableBlock && !trimmedPara.includes('|') && !trimmedPara.includes('\t')) {
      inTableBlock = false;
    }

    const rawSentences = splitIntoSentences(para);
    const sentenceParts = rawSentences.length > 0 ? rawSentences : [para];
    for (const s of sentenceParts) {
      const trimmed = s.trim();
      if (trimmed.length > 15) {
        const isBib =
          inBibSection ||
          isBibliographyHeading(trimmed) ||
          isCitationLine(trimmed) ||
          isBibliographyOrReferenceText(trimmed);
        const isToc =
          inTocSection ||
          isTableOfContentsHeading(trimmed) ||
          isTableOfContentsEntry(trimmed) ||
          isTableOfContentsText(trimmed);
        const isTable =
          inTableBlock ||
          isTableHeadingOrCaption(trimmed) ||
          isTableRowOrData(trimmed) ||
          isTableText(trimmed);
        const isFigure = isFigureOrGraphText(trimmed);
        const isHeading = isMainHeadingText(trimmed);

        if (excludeQuotes && isQuoteText(trimmed)) {
          quoteSentenceIndices.add(sentences.length);
          continue;
        }

        if (isBib || isToc || isTable || isFigure || isHeading || isExcludedFromHighlighting(trimmed)) {
          continue;
        }

        const idx = sentences.length;
        sentences.push(trimmed);
        if (isQuoteText(trimmed)) {
          quoteSentenceIndices.add(idx);
        }
      }
    }
  }

  if (sentences.length === 0) {
    return [];
  }

  const total = sentences.length;

  // Identify eligible candidate sentences for highlighting:
  // Strictly NEVER highlight Table of Contents, Tables, or References!
  // Also exclude quotes if excludeQuotes is active.
  const eligibleIndices: number[] = [];
  for (let i = 0; i < total; i++) {
    if (excludeQuotes && quoteSentenceIndices.has(i)) continue;
    eligibleIndices.push(i);
  }

  // Hard cap: only highlight up to the actual percentage of eligible text.
  // If similarity is 8%, visible highlight must be roughly 8% of the eligible word pool,
  // not a whole page of sentence blocks.
  const eligibleEntries = eligibleIndices.map(index => ({
    index,
    text: sentences[index],
    wordCount: countWords(sentences[index]),
  }));

  const eligibleWordCount = eligibleEntries.reduce((sum, entry) => sum + entry.wordCount, 0);
  const plagiarismTargetWords = clampedPlagScore > 0 && eligibleWordCount > 0
    ? Math.max(1, Math.round((clampedPlagScore / 100) * eligibleWordCount))
    : 0;

  const plagIndices = new Set<number>();
  let usedWords = 0;
  if (plagiarismTargetWords > 0 && eligibleEntries.length > 0) {
    const sorted = [...eligibleEntries].sort((a, b) => b.wordCount - a.wordCount);
    for (const entry of sorted) {
      if (usedWords >= plagiarismTargetWords) break;
      const maxSentenceWords = Math.max(2, Math.min(entry.wordCount, Math.ceil(entry.wordCount * 0.25)));
      const addWords = Math.min(maxSentenceWords, plagiarismTargetWords - usedWords);
      if (addWords > 0) {
        plagIndices.add(entry.index);
        usedWords += addWords;
      }
    }
  }

  const aiSentenceIndices = new Set<number>();
  if (clampedAiScore > 20 && eligibleEntries.length > 0) {
    const localSelected = selectIndicesForWordShare(
      eligibleEntries.map(entry => entry.wordCount),
      clampedAiScore
    );
    localSelected.forEach(localIndex => {
      aiSentenceIndices.add(eligibleEntries[localIndex].index);
    });
  }

  // Keep AI and similarity annotations independently available when they overlap.
  let plagCounter = 0;
  return sentences.flatMap((sentence, index) => {
    // Unconditional rule: Table of Contents, Tables, and References are strictly normal text
    if (isExcludedFromHighlighting(sentence)) {
      return [{
        text: sentence,
        type: 'normal' as const,
      }];
    }

    const snippets: HighlightedSnippet[] = [];
    if (plagIndices.has(index)) {
      plagCounter++;
      // "mostly red, with some lines appearing blue/underlined, matching the sample reports"
      const isBlue = plagCounter % 4 === 0;
      const srcIdx = isBlue ? 2 : 1;
      const src = sources[srcIdx - 1] || sources[0] || {
        id: isBlue ? 's2' : 's1',
        name: isBlue ? 'Academic Repository' : 'ScienceDirect / Elsevier Archives',
        similarity: clampedPlagScore,
      };

      snippets.push({
        text: sentence,
        type: 'plagiarized' as const,
        sourceName: src.name,
        sourceId: src.id,
        sourceIndex: srcIdx,
        similarityPercentage: src.similarity,
        styleVariant: (isBlue ? 'blue_underlined' : 'red') as 'blue_underlined' | 'red',
      });
    }

    if (aiSentenceIndices.has(index) && clampedAiScore > 20) {
      snippets.push({
        text: sentence,
        type: 'ai_generated' as const,
        aiProbability: clampedAiScore,
      });
    }

    return snippets.length > 0 ? snippets : [{
      text: sentence,
      type: 'normal' as const,
    }];
  });
}
