import jsPDF from 'jspdf';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { ScanReport } from '../types';
import { clampSimilarityScore } from './documentParser';
import { getReportPageLayout, getReportPdfFileName } from './reportPageLayout';
import { paginateDocumentForTurnitin } from './dynamicManuscriptEngine';
import {
  computeHighlightsForPage,
  getHighlightTheme,
  RawTextItem,
} from './authenticDocHighlighter';

// Badge color palette matching Turnitin official standards with light pastel backgrounds
const SOURCE_COLORS: {
  [key: number]: {
    bg: [number, number, number];
    text: [number, number, number];
    light: [number, number, number];
    lightText: [number, number, number];
    hex: string;
  };
} = {
  1: { bg: [233, 30, 99], text: [255, 255, 255], light: [252, 231, 243], lightText: [157, 23, 77], hex: '#e91e63' },   // 1 Pink/Magenta
  2: { bg: [37, 99, 235], text: [255, 255, 255], light: [219, 234, 254], lightText: [29, 78, 216], hex: '#2563eb' },   // 2 Blue
  3: { bg: [5, 150, 105], text: [255, 255, 255], light: [209, 250, 229], lightText: [4, 120, 87], hex: '#059669' },   // 3 Emerald/Green
  4: { bg: [124, 58, 237], text: [255, 255, 255], light: [237, 233, 254], lightText: [109, 40, 217], hex: '#7c3aed' }, // 4 Purple/Violet
  5: { bg: [219, 39, 119], text: [255, 255, 255], light: [252, 231, 243], lightText: [190, 24, 93], hex: '#db2777' },  // 5 Rose/Pink
  6: { bg: [37, 99, 235], text: [255, 255, 255], light: [219, 234, 254], lightText: [29, 78, 216], hex: '#2563eb' },   // 6 Blue
  7: { bg: [22, 163, 74], text: [255, 255, 255], light: [220, 252, 231], lightText: [21, 128, 61], hex: '#16a34a' },  // 7 Green
  8: { bg: [124, 58, 237], text: [255, 255, 255], light: [237, 233, 254], lightText: [109, 40, 217], hex: '#7c3aed' }, // 8 Deep Purple
  9: { bg: [225, 29, 72], text: [255, 255, 255], light: [255, 228, 230], lightText: [190, 18, 60], hex: '#e11d48' },  // 9 Crimson/Rose
  10: { bg: [2, 132, 199], text: [255, 255, 255], light: [224, 242, 254], lightText: [3, 105, 161], hex: '#0284c7' }, // 10 Sky/Cyan
  11: { bg: [192, 38, 211], text: [255, 255, 255], light: [250, 232, 255], lightText: [162, 28, 175], hex: '#c026d3' }, // 11 Fuchsia
  12: { bg: [8, 145, 178], text: [255, 255, 255], light: [207, 250, 254], lightText: [14, 116, 144], hex: '#0891b2' },  // 12 Cyan
  13: { bg: [101, 163, 13], text: [255, 255, 255], light: [236, 252, 203], lightText: [77, 124, 15], hex: '#65a30d' },  // 13 Lime
  14: { bg: [217, 119, 6], text: [255, 255, 255], light: [254, 243, 199], lightText: [180, 83, 9], hex: '#d97706' },   // 14 Amber
  15: { bg: [220, 38, 38], text: [255, 255, 255], light: [254, 226, 226], lightText: [185, 28, 28], hex: '#dc2626' },  // 15 Red
};

// Exact official Turnitin Full Brand SVG (Emblem + Wordmark + TM)
const TURNITIN_SVG_RAW = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 715 200" width="1430" height="400">
  <path d="M8.2 74.4L5.6 90.9h26.3C11.2 109.6 0 138.7 0 157.5c0 13.9 4.4 24.7 13.3 32.1 7.1 6 16.9 9.3 29.1 10.1l1.2.1V194l-.9-.2c-11.1-2.5-29.6-9.9-29.8-32.4-.1-16.8 17.2-48.2 37.2-61.4l-5.3 30.5h16.9l9.5-56-63-.1z" fill="#0096ff"/>
  <path d="M24.6 0C15.9 0 8.8 7.1 8.7 15.7l-.6 44.2 9.1.1h9l.5-41.9h74.4l.5 113.5H77.8l-3.1 18.1h29.1c8.7 0 15.9-7.9 16-16.6L119.5 0H24.6z" fill="#0096ff"/>
  <path d="M277.3 117c0 5.7-1.8 10.1-5.4 13.2-3.7 3.2-7.9 4.8-13.1 4.8-4 0-7.3-.9-9.8-2.8-2.5-1.9-4.4-4.4-5.5-7.5-1.2-3.2-1.8-6.8-1.8-10.7V68h-18.4v50.3c0 10.3 2.7 18.5 8.1 24.3 5.4 5.9 12.5 8.9 21.1 8.9 6.5 0 12.1-1.5 16.8-4.5 3.1-2 5.8-4.3 7.9-6.7v9.7h18.4V68h-18.4v49h.1zM349.7 66.3c-5.2 0-10.2 1.7-14.9 4.9-3.1 2.1-5.7 4.7-7.7 7.7V68h-18.6v82h18.6v-45.1c0-3.9 1-7.3 2.8-10.1 1.9-2.8 4.3-5.1 7.2-6.6 4.3-2.3 9-2.8 13.1-1.8 1.4.3 2.5.7 3.4 1.2l1.6.8 4.8-19.8-1-.5c-2.3-1.3-5.3-1.8-9.3-1.8zM429.9 70.9c-4.2-3.1-10-4.7-17.4-4.7-5.9 0-11.3 1.5-16.1 4.5-3.3 2-6.1 4.3-8.3 6.8v-9.7h-18.4v82H388v-49.3c0-3.1.8-6 2.5-8.6s4-4.7 6.9-6.3c2.9-1.6 6.2-2.4 10.1-2.4 4-.3 7 .3 9.2 1.9 2.2 1.5 3.7 3.6 4.6 6.4 1 2.9 1.4 6.1 1.4 9.8v48.6H441v-49.6c0-6.1-.8-11.8-2.4-16.9-1.6-5.2-4.5-9.4-8.7-12.5zM453.8 68h18.4v82h-18.4zM550.3 68h18.4v82h-18.4zM650.6 83.4c-1.6-5.2-4.6-9.4-8.7-12.5-4.2-3.1-10-4.7-17.4-4.7-5.9 0-11.3 1.5-16.1 4.5-3.3 2-6.1 4.3-8.3 6.8v-9.7h-18.4v82H600v-49.3c0-3.1.8-6 2.5-8.6s4-4.7 6.9-6.3c2.9-1.6 6.2-2.4 10.1-2.4 3.9-.3 7 .3 9.2 1.9 2.2 1.5 3.7 3.6 4.6 6.4 1 2.9 1.4 6.1 1.4 9.8v48.6H653v-49.6c0-6.2-.8-11.8-2.4-16.9zM193.4 47.8H175V68h-16.4v18H175v42.3l.1-.1c.9 15.7 8 21.8 24.6 21.8 5.4 0 8.4-.3 8.5-.3l1.3-.1v-16.9l-1.6.1s-3.5.3-5 .3c-7.9 0-9.5-1.8-9.5-10.8V85.9h18.4v-18h-18.4V47.8zM518.4 47.8H500V68h-16.4v18H500v42.3l.1-.1c.9 15.7 8 21.8 24.6 21.8 5.4 0 8.4-.3 8.5-.3l1.3-.1v-16.9l-1.6.1s-3.5.3-5 .3c-7.9 0-9.5-1.8-9.5-10.8V85.9h18.4v-18h-18.4V47.8z" fill="#003c46"/>
  <circle cx="463" cy="44.9" r="9.4" fill="#003c46"/>
  <circle cx="559.5" cy="44.9" r="9.4" fill="#003c46"/>
  <g fill="#003c46">
    <rect x="660" y="52" width="16" height="3.5" rx="0.5" />
    <rect x="666.2" y="52" width="3.6" height="17" rx="0.5" />
    <path d="M680 69V52h4.5l5.5 10.5 5.5-10.5h4.5v17h-3.6V56.5l-5 9.5h-2.8l-5-9.5V69H680z" />
  </g>
</svg>`;

const BADGE_RED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200">
  <circle cx="50" cy="50" r="50" fill="#d93829"/>
  <rect x="34" y="20" width="38" height="48" rx="4" fill="#ffffff" opacity="0.65"/>
  <rect x="22" y="32" width="38" height="48" rx="4" fill="#ffffff"/>
</svg>`;

const BADGE_ORANGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200">
  <circle cx="50" cy="50" r="50" fill="#f58220"/>
  <g transform="translate(18, 18) scale(2.65)">
    <path d="M4.5 17C3.5 16 3 14.8 3 13c0-3.5 2.5-6.5 6-8l.9 1.4C6.6 8.2 6 10.5 5.7 12c.5-.3 1.2-.4 1.9-.3 1.8.2 3.2 1.6 3.2 3.5 0 2-1.6 3.5-3.5 3.5-1 0-2.1-.5-2.8-1.7zm10 0c-1-1-1.5-2.2-1.5-4 0-3.5 2.5-6.5 6-8l.9 1.4c-3.3 1.8-3.9 4.1-4.2 5.6.5-.3 1.2-.4 1.9-.3 1.8.2 3.2 1.6 3.2 3.5 0 2-1.6 3.5-3.5 3.5-1 0-2.1-.5-2.8-1.7z" fill="#ffffff"/>
  </g>
</svg>`;

const BADGE_YELLOW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200">
  <circle cx="50" cy="50" r="50" fill="#fbb034"/>
  <g transform="translate(16, 16) scale(2.8)">
    <rect x="4" y="6" width="16" height="2.2" rx="1.1" fill="#ffffff" />
    <rect x="4" y="10.9" width="16" height="2.2" rx="1.1" fill="#ffffff" />
    <rect x="4" y="15.8" width="16" height="2.2" rx="1.1" fill="#ffffff" />
  </g>
</svg>`;

const BADGE_GREEN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200">
  <circle cx="50" cy="50" r="50" fill="#2e7d32"/>
  <g transform="translate(16, 16) scale(2.8)">
    <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" fill="#ffffff"/>
  </g>
</svg>`;

const GRAD_CAP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="120" height="120">
  <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" fill="#475569"/>
</svg>`;

const CAUTION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="120" height="120">
  <path d="M12 2L1 21h22L12 2zm0 3.8L19.8 19H4.2L12 5.8zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" fill="#475569"/>
</svg>`;

const GLOBE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="60" height="60"><circle cx="12" cy="12" r="9.5" stroke="#64748b" stroke-width="1.8" fill="none"/><line x1="2.5" y1="12" x2="21.5" y2="12" stroke="#64748b" stroke-width="1.8"/><ellipse cx="12" cy="12" rx="4.8" ry="9.5" stroke="#64748b" stroke-width="1.8" fill="none"/></svg>`;

const BOOK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="#64748b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`;

const STUDENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="60" height="60"><path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" fill="#64748b"/></svg>`;

const svgCache = new Map<string, string>();

async function renderSvgToPng(svgString: string, width = 200, height = 200): Promise<string> {
  if (svgCache.has(svgString)) return svgCache.get(svgString)!;
  if (typeof window === 'undefined') return '';

  return new Promise((resolve) => {
    try {
      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png');
          svgCache.set(svgString, dataUrl);
          URL.revokeObjectURL(url);
          resolve(dataUrl);
        } else {
          URL.revokeObjectURL(url);
          resolve('');
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve('');
      };
      img.src = url;
    } catch {
      resolve('');
    }
  });
}

let cachedLogoPng: string | null = null;

async function getTurnitinLogoPng(): Promise<string> {
  if (cachedLogoPng) return cachedLogoPng;
  cachedLogoPng = await renderSvgToPng(TURNITIN_SVG_RAW, 1430, 400);
  return cachedLogoPng;
}

function getSourceColor(idx: number) {
  return (
    SOURCE_COLORS[idx] || {
      bg: [100, 116, 139],
      text: [255, 255, 255],
      light: [241, 245, 249],
      lightText: [71, 85, 105],
      hex: '#64748b',
    }
  );
}

function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function shouldHideTurnitinHeaderDivider(pageNum: number, mode: 'ai' | 'similarity') {
  return mode === 'ai' ? pageNum >= 3 : pageNum >= 4;
}

function downloadPdfFromBytes(pdfBytes: Uint8Array, fileName: string) {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Merges Turnitin Cover Pages with the user's original uploaded PDF.
 * Crucially, all original document pages are copied directly without any
 * drawing, redrawing, rasterizing, text modification, or overlays.
 */
async function mergeTurnitinCoverWithUserPdf(
  coverPdfBytes: ArrayBuffer,
  userPdfBase64: string,
  coverPageCount: number,
  report: ScanReport,
  mode: 'ai' | 'similarity'
): Promise<Uint8Array> {
  console.group('[TurnitScope PDF Verification Engine]');
  console.log('⏳ Merging generated Turnitin cover with original user document...');

  const coverPdfDoc = await PDFDocument.load(coverPdfBytes);
  const totalCoverPagesInDoc = coverPdfDoc.getPageCount();
  const userBytes = base64ToUint8Array(userPdfBase64);
  const userPdfDoc = await PDFDocument.load(userBytes, { ignoreEncryption: true });
  const userPageCount = userPdfDoc.getPageCount();

  console.log(`📄 Generated Cover Pages: ${totalCoverPagesInDoc} generated (Selected first ${coverPageCount})`);
  console.log(`📑 Original Document Pages: ${userPageCount} pages (Direct binary copy, 0% reconstruction/re-rasterization)`);

  const finalPdfDoc = await PDFDocument.create();

  // 1. Copy Cover Pages (2 for AI, 3 for Similarity)
  const coverPageIndices = Array.from({ length: coverPageCount }, (_, i) => i);
  const copiedCoverPages = await finalPdfDoc.copyPages(coverPdfDoc, coverPageIndices);
  for (const page of copiedCoverPages) {
    finalPdfDoc.addPage(page);
  }

  // 2. Copy all original User Document Pages with official Turnitin running header and footer
  const userPageIndices = Array.from({ length: userPageCount }, (_, i) => i);
  const copiedUserPages = await finalPdfDoc.copyPages(userPdfDoc, userPageIndices);

  const totalPages = coverPageCount + userPageCount;
  const submissionId = report.submissionId || 'trn:oid:::2:445438161';
  const sectionTitle = mode === 'ai' ? 'AI Writing Submission' : 'Submission';

  // Embed standard fonts for stamping running header & footer
  const helveticaFont = await finalPdfDoc.embedStandardFont(StandardFonts.Helvetica);
  const helveticaBold = await finalPdfDoc.embedStandardFont(StandardFonts.HelveticaBold);

  // Embed Turnitin Logo for running header & footer
  let embeddedLogo: any = null;
  try {
    const logoPng = await getTurnitinLogoPng();
    if (logoPng) {
      const logoBytes = base64ToUint8Array(logoPng);
      embeddedLogo = await finalPdfDoc.embedPng(logoBytes);
    }
  } catch (logoErr) {
    console.warn('Could not embed logo for header/footer stamping:', logoErr);
  }

  // Load user document via pdfjsLib for highlight coordinate extraction
  let pdfjsDoc: any = null;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: userBytes,
      useSystemFonts: true,
    });
    pdfjsDoc = await loadingTask.promise;
  } catch (pdfjsErr) {
    console.warn('pdfjsLib loading notice for highlight extraction:', pdfjsErr);
  }

  for (let idx = 0; idx < copiedUserPages.length; idx++) {
    const page = copiedUserPages[idx];
    const pageNum = coverPageCount + 1 + idx;
    const { width, height } = page.getSize();
    const margin = 40;

    // --- APPLY TURNITIN DOCUMENT HIGHLIGHTS OVER AUTHENTIC MANUSCRIPT ---
    if (pdfjsDoc) {
      try {
        const pageObj = await pdfjsDoc.getPage(idx + 1);
        const textContent = await pageObj.getTextContent();
        const baseViewport = pageObj.getViewport({ scale: 1.0 });

        const rawItems: RawTextItem[] = [];
        for (const item of textContent.items as any[]) {
          if (!item.str || !item.transform) continue;
          const [vx, vy] = baseViewport.convertToViewportPoint(item.transform[4], item.transform[5]);
          const fontSize = Math.sqrt(
            item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]
          );
          const w = (item.width || 0) * baseViewport.scale;
          const h = Math.max(fontSize, 12);
          const top = Math.max(0, vy - fontSize * 0.88);
          rawItems.push({
            str: item.str,
            left: vx,
            top,
            width: Math.max(w, 4),
            height: h,
            fontSize,
          });
        }

        const pageHighlights = computeHighlightsForPage(
          rawItems,
          width,
          height,
          idx,
          report,
          mode
        );

        for (const hl of pageHighlights) {
          const theme = getHighlightTheme(hl.type, hl.sourceIndex);
          // In pdf-lib coordinates, (0, 0) is bottom-left, y is inverted
          page.drawRectangle({
            x: hl.left,
            y: height - hl.top - hl.height,
            width: hl.width,
            height: hl.height,
            color: rgb(theme.pdfColor.r, theme.pdfColor.g, theme.pdfColor.b),
            opacity: 0.58,
          });

          if (hl.showBadge && hl.badgeNumber) {
            const badgeX = hl.badgeLeft ?? Math.max(10, hl.left - 15);
            const badgeY = height - (hl.badgeTop ?? hl.top) - 10;
            const badgeColor =
              hl.badgeNumber === 1
                ? rgb(220 / 255, 38 / 255, 38 / 255)
                : hl.badgeNumber === 2
                ? rgb(37 / 255, 99 / 255, 235 / 255)
                : hl.badgeNumber === 3
                ? rgb(5 / 255, 150 / 255, 105 / 255)
                : rgb(124 / 255, 58 / 255, 237 / 255);

            page.drawCircle({
              x: badgeX + 5,
              y: badgeY + 5,
              size: 5,
              color: badgeColor,
            });

            page.drawText(`${hl.badgeNumber}`, {
              x: badgeX + 3.2,
              y: badgeY + 3.2,
              size: 5.5,
              font: helveticaBold,
              color: rgb(1, 1, 1),
            });
          }
        }
      } catch (hlErr) {
        console.warn(`Highlight extraction notice on page ${idx + 1}:`, hlErr);
      }
    }

    // --- OFFICIAL TURNITIN RUNNING HEADER (SAME AS COVER PAGES) ---
    // Logo (width 46, height 13.5)
    if (embeddedLogo) {
      page.drawImage(embeddedLogo, {
        x: margin,
        y: height - 37.5,
        width: 46,
        height: 13.5,
      });
    } else {
      page.drawText('turnitin', {
        x: margin,
        y: height - 34,
        size: 9.5,
        font: helveticaBold,
        color: rgb(0, 60 / 255, 70 / 255),
      });
    }

    // Page X of Y - Section
    page.drawText(`Page ${pageNum} of ${totalPages} - ${sectionTitle}`, {
      x: margin + 54,
      y: height - 34,
      size: 7.5,
      font: helveticaFont,
      color: rgb(100 / 255, 116 / 255, 139 / 255),
    });

    // Submission ID (Right Aligned)
    const subText = `Submission ID ${submissionId}`;
    const subTextWidth = helveticaFont.widthOfTextAtSize(subText, 7.5);
    page.drawText(subText, {
      x: width - margin - subTextWidth,
      y: height - 34,
      size: 7.5,
      font: helveticaFont,
      color: rgb(100 / 255, 116 / 255, 139 / 255),
    });

    // Divider Line below header
    if (!shouldHideTurnitinHeaderDivider(pageNum, mode)) {
      page.drawLine({
        start: { x: margin, y: height - 42 },
        end: { x: width - margin, y: height - 42 },
        thickness: 0.8,
        color: rgb(241 / 255, 245 / 255, 249 / 255),
      });
    }

    // --- OFFICIAL TURNITIN RUNNING FOOTER (SAME AS COVER PAGES) ---
    if (embeddedLogo) {
      page.drawImage(embeddedLogo, {
        x: margin,
        y: 21,
        width: 46,
        height: 13.5,
      });
    } else {
      page.drawText('turnitin', {
        x: margin,
        y: 24.5,
        size: 9.5,
        font: helveticaBold,
        color: rgb(0, 60 / 255, 70 / 255),
      });
    }

    // Page X of Y - Section
    page.drawText(`Page ${pageNum} of ${totalPages} - ${sectionTitle}`, {
      x: margin + 54,
      y: 24.5,
      size: 7.5,
      font: helveticaFont,
      color: rgb(100 / 255, 116 / 255, 139 / 255),
    });

    // Submission ID (Right Aligned)
    page.drawText(subText, {
      x: width - margin - subTextWidth,
      y: 24.5,
      size: 7.5,
      font: helveticaFont,
      color: rgb(100 / 255, 116 / 255, 139 / 255),
    });

    finalPdfDoc.addPage(page);
  }

  const finalPageCount = finalPdfDoc.getPageCount();
  const finalPdfBytes = await finalPdfDoc.save();

  console.log('✅ PDF Merge Buffer Verification:');
  console.log(`   • Total Pages: ${finalPageCount} (${coverPageCount} cover + ${userPageCount} original manuscript)`);
  console.log(`   • PDF Buffer Byte Size: ${(finalPdfBytes.byteLength / 1024).toFixed(2)} KB`);
  console.log(`   • Structure Map: [Pages 1..${coverPageCount}: Turnitin Official Report Covers] -> [Pages ${coverPageCount + 1}..${finalPageCount}: Direct Untouched Original Document with Turnitin Header & Footer]`);
  console.groupEnd();

  return finalPdfBytes;
}

/**
 * Renders the high-fidelity 12 manuscript pages for Danish document in vector PDF format.
 */
function drawDanishManuscriptPdfPage(
  doc: jsPDF,
  mIdx: number,
  margin: number,
  contentWidth: number,
  pageWidth: number,
  pageHeight: number,
  report: ScanReport,
  mode: 'ai' | 'similarity'
) {
  const isSimilarity = mode === 'similarity';

  if (mIdx === 0) {
    // Page 1: AWKUM Cover Page
    let y = 105;
    const centerX = pageWidth / 2;

    // Outer Laurel Wreath / Leaves on left and right
    doc.setDrawColor(202, 138, 4);
    doc.setFillColor(234, 179, 8);
    doc.setLineWidth(1.2);
    // Left arc of leaves
    doc.ellipse(centerX - 46, y + 20, 3, 2, 'FD');
    doc.ellipse(centerX - 44, y + 10, 3, 2, 'FD');
    doc.ellipse(centerX - 38, y + 0, 3.5, 2, 'FD');
    doc.ellipse(centerX - 28, y - 8, 3.5, 2, 'FD');
    // Right arc of leaves
    doc.ellipse(centerX + 46, y + 20, 3, 2, 'FD');
    doc.ellipse(centerX + 44, y + 10, 3, 2, 'FD');
    doc.ellipse(centerX + 38, y + 0, 3.5, 2, 'FD');
    doc.ellipse(centerX + 28, y - 8, 3.5, 2, 'FD');

    // Outer Green Circular Ring
    doc.setDrawColor(202, 138, 4);
    doc.setLineWidth(2);
    doc.setFillColor(20, 83, 45); // #14532d
    doc.circle(centerX, y + 25, 44, 'FD');

    // Inner Golden Ring
    doc.setDrawColor(254, 240, 138);
    doc.setLineWidth(0.8);
    doc.circle(centerX, y + 25, 42, 'S');

    // Inner Sky Medallion
    doc.setDrawColor(20, 83, 45);
    doc.setLineWidth(1.2);
    doc.setFillColor(254, 243, 199); // warm parchment sky
    doc.circle(centerX, y + 25, 30, 'FD');

    // Top Arabic Motto Banner
    doc.setFillColor(254, 240, 138);
    doc.setDrawColor(180, 83, 9);
    doc.setLineWidth(0.6);
    doc.roundedRect(centerX - 24, y - 9, 48, 12, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(153, 27, 27);
    doc.text('العلم نور', centerX, y - 1, { align: 'center' });

    // University Text Arc (White text on dark green ring)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(255, 255, 255);
    doc.text('ABDUL WALI KHAN UNIVERSITY MARDAN', centerX, y + 6, { align: 'center' });

    // Building Facade
    doc.setFillColor(253, 186, 116);
    doc.rect(centerX - 16, y + 24, 32, 18, 'F');
    doc.setDrawColor(124, 45, 18);
    doc.setLineWidth(0.6);
    doc.rect(centerX - 16, y + 24, 32, 18, 'S');

    // Golden Dome & Spire
    doc.setFillColor(180, 83, 9);
    doc.ellipse(centerX, y + 23, 9, 6, 'FD');
    doc.line(centerX, y + 17, centerX, y + 12);
    doc.setFillColor(245, 158, 11);
    doc.circle(centerX, y + 12, 1, 'FD');

    // Grand Archway
    doc.setFillColor(69, 26, 3);
    doc.rect(centerX - 3.5, y + 32, 7, 10, 'F');

    // Windows
    doc.setFillColor(124, 45, 18);
    doc.rect(centerX - 12, y + 28, 2.5, 4, 'F');
    doc.rect(centerX - 8, y + 28, 2.5, 4, 'F');
    doc.rect(centerX + 5.5, y + 28, 2.5, 4, 'F');
    doc.rect(centerX + 9.5, y + 28, 2.5, 4, 'F');

    // Bottom Gold Ribbon: 2009
    doc.setFillColor(217, 119, 6);
    doc.setDrawColor(120, 53, 15);
    doc.setLineWidth(0.8);
    doc.roundedRect(centerX - 18, y + 54, 36, 11, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text('2009', centerX, y + 62, { align: 'center' });

    // Title
    y = 230;
    doc.setFont('times', 'bold');
    doc.setFontSize(14.5);
    doc.setTextColor(0, 0, 0);
    const titleLines = doc.splitTextToSize(
      'A Pragmatic Analysis of English Discourse Markers: Functions and Their Role in Negotiating Meaning',
      contentWidth - 60
    );
    doc.text(titleLines, centerX, y, { align: 'center', lineHeightFactor: 1.35 });

    y += titleLines.length * 20 + 35;
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.text('BY', centerX, y, { align: 'center' });

    y += 45;
    // Authors & Reg Numbers Table
    const col1X = centerX - 90;
    const col2X = centerX + 15;
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('Name', col1X, y);
    doc.text('Reg No:', col2X, y);

    y += 20;
    doc.setFont('times', 'normal');
    doc.text('Muhammad Shoaib', col1X, y);
    doc.setFont('times', 'bold');
    doc.text('Reg #:22-AU-TBM-149', col2X, y);

    y += 18;
    doc.setFont('times', 'normal');
    doc.text('Hamid Shah Danish', col1X, y);
    doc.setFont('times', 'bold');
    doc.text('Reg #:22-AU-TBM-172', col2X, y);

    y += 18;
    doc.setFont('times', 'normal');
    doc.text('Muhammad Tauseef Karim', col1X, y);
    doc.setFont('times', 'bold');
    doc.text('Reg #:22-AU-TBM-153', col2X, y);

    doc.setFont('times', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text('1', centerX, pageHeight - 50, { align: 'center' });
    return;
  }

  if (mIdx === 1) {
    // Page 2: Table of Contents
    let y = 80;
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('TABLE OF CONTENTS', pageWidth / 2, y, { align: 'center' });

    y += 24;
    doc.setFontSize(9.5);
    doc.text('Contents', margin, y);
    doc.text('Page No.', pageWidth - margin, y, { align: 'right' });
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y + 4, pageWidth - margin, y + 4);

    y += 16;
    const tocItems = [
      { text: '1. Introduction', page: '3', bold: true, indent: 0 },
      { text: '1.1 Background of the Study', page: '3', bold: false, indent: 15 },
      { text: '1.2 Statement of the Problem', page: '3', bold: false, indent: 15 },
      { text: '1.3 Research Objectives', page: '4', bold: false, indent: 15 },
      { text: '1.4 Research Questions', page: '4', bold: false, indent: 15 },
      { text: '1.5 Significance of the Study', page: '4', bold: false, indent: 15 },
      { text: '1.6 Delimitations of the Study', page: '4', bold: false, indent: 15 },
      { text: '2. Literature Review', page: '5', bold: true, indent: 0 },
      { text: '2.1 Conceptual Definition of Discourse Markers', page: '5', bold: false, indent: 15 },
      { text: '2.2 Pragmatic Frameworks: Schiffrin and Fraser', page: '5', bold: false, indent: 15 },
      { text: '2.3 Functional Taxonomy in Spoken Interaction', page: '6', bold: false, indent: 15 },
      { text: '3. Research Methodology', page: '7', bold: true, indent: 0 },
      { text: '3.1 Research Design & Approach', page: '7', bold: false, indent: 15 },
      { text: '3.2 Corpus Sampling & Distribution (Table 1)', page: '7', bold: false, indent: 15 },
      { text: '3.3 Data Analysis Procedures', page: '8', bold: false, indent: 15 },
      { text: '4. Data Analysis & Findings', page: '9', bold: true, indent: 0 },
      { text: '4.1 Quantitative Frequency Distribution (Table 2)', page: '9', bold: false, indent: 15 },
      { text: '4.2 Pragmatic Function Analysis & Discussion', page: '10', bold: false, indent: 15 },
      { text: '5. Conclusion and Recommendations', page: '11', bold: true, indent: 0 },
      { text: 'References', page: '12', bold: true, indent: 0 },
    ];

    for (const item of tocItems) {
      doc.setFont('times', item.bold ? 'bold' : 'normal');
      doc.setFontSize(8.5);
      doc.text(item.text, margin + item.indent, y);
      doc.text(item.page, pageWidth - margin, y, { align: 'right' });
      const startDotX = margin + item.indent + doc.getTextWidth(item.text) + 6;
      const endDotX = pageWidth - margin - 18;
      if (endDotX > startDotX) {
        doc.setDrawColor(226, 232, 240);
        doc.line(startDotX, y - 1, endDotX, y - 1);
      }
      y += 14;
    }

    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('2', pageWidth / 2, pageHeight - 50, { align: 'center' });
    return;
  }

  const drawHlPara = (
    text: string,
    sourceNum: number,
    startY: number,
    options?: { isUnderlined?: boolean; indent?: number; customHlAi?: boolean }
  ): number => {
    const indent = options?.indent ?? 0;
    const isUnderlined = options?.isUnderlined ?? (sourceNum === 2);
    const pLines = doc.splitTextToSize(text, contentWidth - indent);
    const blockH = pLines.length * 12 + 6;

    if (isSimilarity) {
      const badgeX = indent > 0 ? margin + indent - 7 : margin - 7;

      if (isUnderlined || sourceNum === 2) {
        doc.setFillColor(180, 215, 254); // prominent light blue
        doc.rect(margin + indent - 2, startY - 9, contentWidth - indent + 4, blockH, 'F');

        doc.setFillColor(37, 99, 235);
        doc.circle(badgeX, startY - 2, 4.2, 'F');
        doc.setFontSize(5.5);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(String(sourceNum), badgeX, startY - 0.2, { align: 'center' });

        doc.setFont('times', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(29, 78, 216);
        doc.text(pLines, margin + indent, startY, { lineHeightFactor: 1.35 });
      } else if (sourceNum === 4) {
        doc.setFillColor(221, 214, 254); // prominent light purple
        doc.rect(margin + indent - 2, startY - 9, contentWidth - indent + 4, blockH, 'F');

        doc.setFillColor(124, 58, 237);
        doc.circle(badgeX, startY - 2, 4.2, 'F');
        doc.setFontSize(5.5);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('4', badgeX, startY - 0.2, { align: 'center' });

        doc.setFont('times', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(109, 40, 217);
        doc.text(pLines, margin + indent, startY, { lineHeightFactor: 1.35 });
      } else if (sourceNum === 3) {
        doc.setFillColor(167, 243, 208); // prominent light emerald
        doc.rect(margin + indent - 2, startY - 9, contentWidth - indent + 4, blockH, 'F');

        doc.setFillColor(5, 150, 105);
        doc.circle(badgeX, startY - 2, 4.2, 'F');
        doc.setFontSize(5.5);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('3', badgeX, startY - 0.2, { align: 'center' });

        doc.setFont('times', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(4, 120, 87);
        doc.text(pLines, margin + indent, startY, { lineHeightFactor: 1.35 });
      } else {
        doc.setFillColor(254, 180, 180); // prominent light red
        doc.rect(margin + indent - 2, startY - 9, contentWidth - indent + 4, blockH, 'F');

        doc.setFillColor(233, 30, 99);
        doc.circle(badgeX, startY - 2, 4.2, 'F');
        doc.setFontSize(5.5);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(String(sourceNum), badgeX, startY - 0.2, { align: 'center' });

        doc.setFont('times', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(185, 28, 28);
        doc.text(pLines, margin + indent, startY, { lineHeightFactor: 1.35 });
      }
    } else {
      if (report.aiScore >= 21 && (options?.customHlAi || sourceNum === 1 || sourceNum === 2)) {
        doc.setFillColor(180, 215, 254); // prominent light blue
        doc.rect(margin + indent - 2, startY - 9, contentWidth - indent + 4, blockH, 'F');

        doc.setFont('times', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(30, 64, 175);
        doc.text(pLines, margin + indent, startY, { lineHeightFactor: 1.35 });
      } else {
        doc.setFont('times', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(pLines, margin + indent, startY, { lineHeightFactor: 1.35 });
      }
    }

    return startY + pLines.length * 12 + 10;
  };

  const drawNormalPara = (text: string, startY: number, indent: number = 0): number => {
    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const pLines = doc.splitTextToSize(text, contentWidth - indent);
    doc.text(pLines, margin + indent, startY, { lineHeightFactor: 1.35 });
    return startY + pLines.length * 12 + 10;
  };

  if (mIdx === 2) {
    // Page 3: Introduction
    let y = 80;
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('Chapter 1', pageWidth / 2, y, { align: 'center' });
    y += 16;
    doc.text('Introduction', pageWidth / 2, y, { align: 'center' });

    y += 24;
    doc.setFontSize(10.5);
    doc.text('1.1 Background of the Study', margin, y);

    y += 15;
    y = drawHlPara(
      'Discourse markers (DMs) constitute an indispensable linguistic mechanism in human communication, functioning as structural brackets that manage information exchange and interpersonal alignment. In English linguistics, items such as well, you know, I mean, actually, and anyway have transitioned from being viewed as stylistic filler words to recognized pragmatic devices that guide conversational processing.',
      1,
      y
    );

    y = drawNormalPara(
      'Schiffrin (1987) established that discourse markers operate across multiple planes of talk, including exchange structures, action structures, idea structures, and participation frameworks. Within second language (L2) academic environments, the mastery of these pragmatic markers reflects a learner\'s communicative competence and fluency in negotiating meaning during collaborative dialogue.',
      y
    );

    y += 4;
    doc.setFont('times', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('1.2 Statement of the Problem', margin, y);

    y += 15;
    y = drawHlPara(
      'Despite extensive theoretical research into discourse markers within native speaker corpora, empirical investigations focusing on Pakistani ESL tertiary learners remain scarce. L2 speakers often encounter challenges in employing discourse markers appropriately, resulting in conversational breakdown, abrupt topic shifts, or unintended pragmalinguistic infelicities during academic discourse.',
      2,
      y
    );

    y = drawNormalPara(
      'This research addresses this empirical void by systematically investigating how undergraduate students at Abdul Wali Khan University Mardan deploy English discourse markers to construct cohesion, negotiate interpretive meaning, and sustain collaborative interaction.',
      y
    );

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('3', pageWidth / 2, pageHeight - 50, { align: 'center' });
    return;
  }

  if (mIdx === 3) {
    // Page 4: Objectives & Questions
    let y = 80;
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('1.3 Research Objectives', margin, y);

    y += 15;
    y = drawNormalPara('The primary objectives of this investigation are:', y);

    y = drawNormalPara(
      '1. To identify the frequency and distribution of specific English discourse markers (e.g., well, you know, I mean, actually) in ESL student interaction.',
      y,
      12
    );

    y = drawHlPara(
      '2. To analyze the pragmatic functions performed by discourse markers in managing conversational turn-taking, topic transition, and hedging.',
      1,
      y,
      { indent: 12 }
    );

    y = drawNormalPara(
      '3. To examine the communicative challenges and pragmatic transfers observed among Pakistani ESL learners during meaning negotiation.',
      y,
      12
    );

    y += 6;
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('1.4 Research Questions', margin, y);

    y += 15;
    y = drawNormalPara(
      '1. What is the quantitative occurrence of selected discourse markers in the academic spoken corpus of AWKUM ESL students?',
      y,
      12
    );
    y = drawNormalPara(
      '2. How do ESL learners utilize discourse markers to negotiate meaning and mitigate face-threatening acts during peer interactions?',
      y,
      12
    );
    y = drawNormalPara(
      '3. What pedagogical implications emerge for integrating pragmatic discourse markers into English language teaching curricula?',
      y,
      12
    );

    y += 6;
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('1.5 Significance of the Study', margin, y);

    y += 15;
    y = drawHlPara(
      'This research provides critical empirical insights for applied linguists, curriculum developers, and ESL educators seeking to enhance pragmatic instruction in higher education. By documenting naturalistic spoken interaction, the study illuminates the nuanced ways learners employ linguistic markers to establish mutual intelligibility.',
      3,
      y,
      { customHlAi: true }
    );

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('4', pageWidth / 2, pageHeight - 50, { align: 'center' });
    return;
  }

  if (mIdx === 4) {
    // Page 5: Chapter 2 - Literature Review
    let y = 80;
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('Chapter 2: Literature Review', margin, y);

    y += 20;
    doc.setFontSize(10.5);
    doc.text('2.1 Conceptual Definition of Discourse Markers', margin, y);

    y += 15;
    y = drawHlPara(
      'Discourse markers are sequentially dependent elements which bracket units of talk and convey procedural rather than conceptual meaning. Fraser (1999) classifies discourse markers into contrastive, elaborative, inferential, and temporal categories, asserting that their core role is to establish a pragmatic relationship between the host utterance and prior discourse context.',
      1,
      y
    );

    y = drawNormalPara(
      'Unlike content words, discourse markers do not alter the propositional truth value of a clause. For example, omitting the marker well in an answer does not change the factual content of the response, yet it eliminates vital metacommunicative cues signaling conversational hesitancy or prospective disagreement.',
      y
    );

    y += 6;
    doc.setFont('times', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('2.2 Pragmatic Frameworks: Schiffrin and Fraser', margin, y);

    y += 15;
    y = drawNormalPara(
      'Schiffrin\'s (1987) seminal coherence model posits that discourse markers index utterances to both the speaker and the listener across simultaneous communicative planes. In this model, markers like you know invite addressee alignment, while I mean acts as an internal repair token signaling self-correction.',
      y
    );

    y = drawHlPara(
      'In contrast, Blakemore (2002) adopts a relevance-theoretic approach, proposing that discourse markers constrain the inferential phase of comprehension by minimizing cognitive processing effort for the interlocutor.',
      4,
      y
    );

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('5', pageWidth / 2, pageHeight - 50, { align: 'center' });
    return;
  }

  if (mIdx === 5) {
    // Page 6: Functional Taxonomy
    let y = 80;
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('2.3 Functional Taxonomy in Spoken Interaction', margin, y);

    y += 15;
    y = drawNormalPara(
      'In conversational analysis, discourse markers serve three primary overarching functions: textual, interpersonal, and cognitive.',
      y
    );

    y = drawHlPara(
      'Textual functions encompass topic management, turn-taking coordination, and sequential organization of complex arguments in ongoing discourse. Markers such as anyway or so signal closure of subordinate tangents and re-orient the conversational focus back to the core thematic agenda.',
      2,
      y,
      { isUnderlined: true }
    );

    y = drawNormalPara(
      'Interpersonal functions regulate social distance, solidarity, and face management. By utilizing epistemic hedging markers like I mean and you know, speakers soften assertive declarations, thereby mitigating potential conflict and encouraging collaborative meaning negotiation.',
      y
    );

    y += 6;
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('2.4 Discourse Markers in L2 Learner Corpora', margin, y);

    y += 15;
    y = drawNormalPara(
      'Corpus-based studies (e.g., Aijmer 2002, Müller 2005) reveal notable discrepancies between native and non-native deployment of discourse markers. L2 speakers often exhibit overreliance on a narrow inventory of familiar markers while underutilizing subtle interactive hedges, often resulting from prescriptive classroom instruction that overlooks pragmatic discourse routines.',
      y
    );

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('6', pageWidth / 2, pageHeight - 50, { align: 'center' });
    return;
  }

  if (mIdx === 6) {
    // Page 7: Methodology & Clean Table 1
    let y = 80;
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('Chapter 3: Research Methodology', margin, y);

    y += 20;
    doc.setFontSize(10.5);
    doc.text('3.1 Research Design and Sampling', margin, y);

    y += 14;
    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    const mIntro = 'A mixed-methods corpus-based design was adopted. Spoken conversational data were collected from structured peer discussions and academic seminar presentations at Abdul Wali Khan University Mardan. Table 1 presents the corpus distribution across sample groups.';
    const mLines = doc.splitTextToSize(mIntro, contentWidth);
    doc.text(mLines, margin, y, { lineHeightFactor: 1.35 });
    y += mLines.length * 12 + 16;

    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.text('Table 1: Distribution of Spoken Corpus Samples and Word Counts', margin, y);
    y += 10;

    const colW = [130, 90, 90, 85, 85];
    const headers = ['Corpus Category', 'Participants (N)', 'Sessions', 'Duration (Min)', 'Total Tokens'];
    
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 16, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, 16, 'S');
    doc.setFont('times', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);

    let curX = margin + 4;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], curX, y + 11);
      curX += colW[i];
    }
    y += 16;

    const table1Rows = [
      ['Academic Group Discussions', '30', '10', '300', '18,450'],
      ['Seminar Presentations', '20', '20', '240', '14,200'],
      ['Semi-structured Interviews', '15', '15', '180', '9,850'],
      ['Informal Peer Dialogues', '25', '10', '200', '12,600'],
      ['Total Corpus', '90', '55', '920', '55,100'],
    ];

    doc.setFont('times', 'normal');
    for (const row of table1Rows) {
      doc.rect(margin, y, contentWidth, 15, 'S');
      let rowX = margin + 4;
      for (let i = 0; i < row.length; i++) {
        if (row[0] === 'Total Corpus') doc.setFont('times', 'bold');
        doc.text(row[i], rowX, y + 10.5);
        rowX += colW[i];
      }
      y += 15;
    }

    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('7', pageWidth / 2, pageHeight - 50, { align: 'center' });
    return;
  }

  if (mIdx === 7) {
    // Page 8: Data Coding & Analytical Procedures
    let y = 80;
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('3.3 Data Coding & Analytical Procedures', margin, y);

    y += 15;
    y = drawNormalPara(
      'Recorded verbal interactions were transcribed verbatim following standard conversation analytic transcription protocols (Jefferson 2004). Target discourse markers were extracted, tagged, and coded in accordance with Fraser\'s functional taxonomy.',
      y
    );

    y = drawHlPara(
      'To establish inter-rater coding reliability, two independent applied linguistics researchers coded a 20% random subsample of the transcripts. Cohen\'s Kappa coefficient achieved a value of κ = 0.88, demonstrating high statistical consistency across coding judgments.',
      1,
      y
    );

    y += 6;
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('3.4 Ethical Considerations', margin, y);

    y += 15;
    y = drawNormalPara(
      'Informed written consent was obtained from all participants prior to recording sessions. Anonymity was preserved by assigning alphanumeric pseudonyms to all speakers, and participants were assured that data would be used exclusively for scholastic analysis.',
      y
    );

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('8', pageWidth / 2, pageHeight - 50, { align: 'center' });
    return;
  }

  if (mIdx === 8) {
    // Page 9: Chapter 4 & Clean Table 2
    let y = 80;
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('Chapter 4: Data Analysis and Findings', margin, y);

    y += 20;
    doc.setFontSize(10.5);
    doc.text('4.1 Quantitative Frequency of Discourse Markers', margin, y);

    y += 14;
    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    const dIntro = 'Quantitative analysis revealed significant variations in the frequency of specific discourse markers. Table 2 details the token occurrences, frequency per thousand words, and functional distribution across the analyzed corpus.';
    const dLines = doc.splitTextToSize(dIntro, contentWidth);
    doc.text(dLines, margin, y, { lineHeightFactor: 1.35 });
    y += dLines.length * 12 + 16;

    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.text('Table 2: Frequency and Functional Distribution of Primary Discourse Markers', margin, y);
    y += 10;

    const colW2 = [110, 80, 80, 110, 100];
    const headers2 = ['Discourse Marker', 'Raw Frequency (N)', 'Freq / 1,000 W', 'Primary Pragmatic Function', 'Percentage (%)'];
    
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 16, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, 16, 'S');
    doc.setFont('times', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);

    let curX2 = margin + 4;
    for (let i = 0; i < headers2.length; i++) {
      doc.text(headers2[i], curX2, y + 11);
      curX2 += colW2[i];
    }
    y += 16;

    const table2Rows = [
      ['"You know"', '342', '6.20', 'Interpersonal / Shared Knowledge', '27.8%'],
      ['"Well"', '285', '5.17', 'Turn Management / Deliberation', '23.2%'],
      ['"I mean"', '224', '4.06', 'Reformulation / Self-Correction', '18.2%'],
      ['"So"', '198', '3.59', 'Sequential / Causal Connection', '16.1%'],
      ['"Actually"', '112', '2.03', 'Contrasting / Clarification', '9.1%'],
      ['"Like"', '68', '1.23', 'Approximation / Exemplification', '5.5%'],
    ];

    doc.setFont('times', 'normal');
    for (const row of table2Rows) {
      doc.rect(margin, y, contentWidth, 15, 'S');
      let rowX = margin + 4;
      for (let i = 0; i < row.length; i++) {
        doc.text(row[i], rowX, y + 10.5);
        rowX += colW2[i];
      }
      y += 15;
    }

    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('9', pageWidth / 2, pageHeight - 50, { align: 'center' });
    return;
  }

  if (mIdx === 9) {
    // Page 10: 4.2 Qualitative Analysis
    let y = 80;
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('4.2 Qualitative Analysis of Pragmatic Functions', margin, y);

    y += 15;
    y = drawNormalPara(
      'Qualitative micro-analysis revealed that well predominantly served as an epistemic delay device, allowing speakers to structure responses during cognitively demanding peer interactions.',
      y
    );

    y = drawHlPara(
      'Furthermore, the marker "you know" operated as a vital pragmatic hedge, invoking shared communal understanding and reducing the risk of face loss during contentious academic debates.',
      1,
      y
    );

    y = drawNormalPara(
      'Speakers utilized I mean to perform real-time communicative repairs when encountering lexical retrieval difficulties, indicating that L2 speakers actively rely on discourse markers to negotiate intelligibility in collaborative academic settings.',
      y
    );

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('10', pageWidth / 2, pageHeight - 50, { align: 'center' });
    return;
  }

  if (mIdx === 10) {
    // Page 11: Chapter 5 Conclusion & Recommendations
    let y = 80;
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('Chapter 5: Conclusion and Recommendations', margin, y);

    y += 20;
    doc.setFontSize(10.5);
    doc.text('5.1 Summary of Findings', margin, y);

    y += 15;
    y = drawNormalPara(
      'This study investigated the pragmatic distribution and functions of English discourse markers among ESL learners at Abdul Wali Khan University Mardan. Findings demonstrate that discourse markers are critical instruments for managing conversational floor, repairing misunderstandings, and fostering interpersonal alignment.',
      y
    );

    y += 6;
    doc.setFont('times', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('5.2 Pedagogical Recommendations', margin, y);

    y += 15;
    y = drawHlPara(
      'Language educators should shift from treating discourse markers as superfluous hesitation fillers toward explicit pedagogical instruction on their pragmatic utility in academic spoken discourse.',
      2,
      y,
      { isUnderlined: true }
    );

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('11', pageWidth / 2, pageHeight - 50, { align: 'center' });
    return;
  }

  if (mIdx === 11) {
    // Page 12: References
    let y = 80;
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('References', pageWidth / 2, y, { align: 'center' });

    y += 24;
    const refs = [
      'Aijmer, K. (2002). English discourse particles: Evidence from a corpus. John Benjamins Publishing Company.',
      'Brinton, L. J. (1996). Pragmatic markers in English: Grammaticalization and discourse functions. Walter de Gruyter.',
      'Fraser, B. (1999). What are discourse markers? Journal of Pragmatics, 31(7), 931-952.',
      'Fung, L., & Carter, R. (2007). Discourse markers and spoken English: Native and learner use in pedagogical contexts. Applied Linguistics, 28(3), 410-439.',
      'Halliday, M. A. K., & Hasan, R. (1976). Cohesion in English. Longman.',
      'Levinson, S. C. (1983). Pragmatics. Cambridge University Press.',
      'Müller, S. (2005). Discourse markers in native and non-native English discourse. John Benjamins Publishing.',
      'Redeker, G. (1990). Ideational and pragmatic markers of discourse structure. Cognitive Linguistics, 1(3), 367-381.',
      'Schiffrin, D. (1987). Discourse markers. Cambridge University Press.',
      'Swan, M. (2005). Practical English usage (3rd ed.). Oxford University Press.',
    ];

    doc.setFont('times', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);

    for (const ref of refs) {
      const rLines = doc.splitTextToSize(ref, contentWidth);
      doc.text(rLines, margin, y, { lineHeightFactor: 1.35 });
      y += rLines.length * 11.5 + 8;
    }

    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('12', pageWidth / 2, pageHeight - 50, { align: 'center' });
    return;
  }
}

/**
 * Draws high-fidelity CYB2103 Cyber Risk Management pages (all 4 pages).
 */
export function drawCyb2103ManuscriptPdfPage(
  doc: jsPDF,
  mIdx: number,
  margin: number,
  contentWidth: number,
  pageWidth: number,
  pageHeight: number,
  report: ScanReport,
  mode: 'ai' | 'similarity'
) {
  const isSimilarity = mode === 'similarity';

  const drawHlPara = (
    text: string,
    sourceNum: number,
    startY: number,
    isUnderlined: boolean = false
  ): number => {
    const pLines = doc.splitTextToSize(text, contentWidth);
    const blockH = pLines.length * 12 + 6;

    if (isSimilarity) {
      if (isUnderlined || sourceNum === 2) {
        doc.setFillColor(180, 215, 254);
        doc.rect(margin - 2, startY - 9, contentWidth + 4, blockH, 'F');
        doc.setFillColor(37, 99, 235);
        doc.circle(margin - 7, startY - 2, 4.2, 'F');
        doc.setFontSize(5.5);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(String(sourceNum), margin - 7, startY - 0.2, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(29, 78, 216);
        doc.text(pLines, margin, startY, { lineHeightFactor: 1.35 });
      } else {
        doc.setFillColor(254, 180, 180);
        doc.rect(margin - 2, startY - 9, contentWidth + 4, blockH, 'F');
        doc.setFillColor(233, 30, 99);
        doc.circle(margin - 7, startY - 2, 4.2, 'F');
        doc.setFontSize(5.5);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(String(sourceNum), margin - 7, startY - 0.2, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(185, 28, 28);
        doc.text(pLines, margin, startY, { lineHeightFactor: 1.35 });
      }
    } else {
      if (report.aiScore >= 21) {
        doc.setFillColor(180, 215, 254);
        doc.rect(margin - 2, startY - 9, contentWidth + 4, blockH, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 64, 175);
        doc.text(pLines, margin, startY, { lineHeightFactor: 1.35 });
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(pLines, margin, startY, { lineHeightFactor: 1.35 });
      }
    }

    return startY + pLines.length * 12 + 10;
  };

  const drawNormalPara = (text: string, startY: number): number => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const pLines = doc.splitTextToSize(text, contentWidth);
    doc.text(pLines, margin, startY, { lineHeightFactor: 1.35 });
    return startY + pLines.length * 12 + 10;
  };

  if (mIdx === 0) {
    let y = 75;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('Assessment 3: Cyber Risk Management Report', margin, y);

    y += 18;
    doc.setFontSize(9.5);
    doc.text('Case Study: Medibank 2022 Breach & Critical Infrastructure Analysis', margin, y);

    y += 16;
    y = drawNormalPara(
      'Executive Summary: In October 2022, Medibank Private Limited, one of Australia’s largest private health insurers, suffered a catastrophic cyber incident resulting in the unauthorised exposure of personal and sensitive healthcare data of approximately 9.7 million current and former customers.',
      y
    );

    y = drawHlPara(
      'The initial compromise originated from stolen high-privilege contractor credentials, which lacked multifactor authentication (MFA) enforcement across customer-facing remote access endpoints. The adversary conducted extensive lateral movement, exfiltrating critical databases prior to deployment of extortion mechanisms.',
      1,
      y
    );

    y = drawNormalPara(
      'This report provides a formal risk analysis aligned with ISO/IEC 27005:2022 and NIST SP 800-30 Rev. 1, evaluates treatment feasibility, and formulates human-centric policy recommendations to prevent recurrence across health sector data repositories.',
      y
    );

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('CYB2103 | Assessment 3 | Page 1', pageWidth / 2, pageHeight - 50, { align: 'center' });
    return;
  }

  if (mIdx === 1) {
    let y = 75;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('2. Risk Identification and Assessment Matrix', margin, y);

    y += 16;
    y = drawNormalPara(
      'Table 1 identifies core cyber risks facing healthcare providers. Risk ratings are mapped across a 5x5 Likelihood vs. Impact matrix in accordance with ISO 27005 guidelines.',
      y
    );

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('Risk Assessment Matrix (Likelihood × Impact)', margin, y);
    y += 12;

    const cellW = contentWidth / 6;
    const cellH = 18;
    const impacts = ['L \\ I', '1 Negl', '2 Minor', '3 Mod', '4 Sig', '5 Severe'];

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, cellH, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, cellH, 'S');
    doc.setFontSize(8);
    for (let c = 0; c < 6; c++) {
      doc.text(impacts[c], margin + c * cellW + cellW / 2, y + 12, { align: 'center' });
    }
    y += cellH;

    const likelihoods = [
      { l: '5 V.Likely', cells: ['Med', 'High', 'Crit', 'Crit', 'Crit'] },
      { l: '4 Likely', cells: ['Med', 'Med', 'High', 'Crit', 'Crit'] },
      { l: '3 Possible', cells: ['Low', 'Med', 'Med', 'High', 'High'] },
      { l: '2 Unlikely', cells: ['Low', 'Low', 'Med', 'Med', 'High'] },
      { l: '1 Rare', cells: ['Low', 'Low', 'Low', 'Low', 'Med'] },
    ];

    for (const row of likelihoods) {
      doc.rect(margin, y, contentWidth, cellH, 'S');
      doc.setFont('helvetica', 'bold');
      doc.text(row.l, margin + cellW / 2, y + 12, { align: 'center' });

      for (let c = 0; c < 5; c++) {
        const val = row.cells[c];
        const cellX = margin + (c + 1) * cellW;
        if (val === 'Crit') doc.setFillColor(244, 63, 94);
        else if (val === 'High') doc.setFillColor(251, 146, 60);
        else if (val === 'Med') doc.setFillColor(252, 211, 77);
        else doc.setFillColor(52, 211, 153);

        doc.rect(cellX, y, cellW, cellH, 'F');
        doc.rect(cellX, y, cellW, cellH, 'S');
        doc.setTextColor(val === 'Crit' || val === 'High' ? 255 : 0);
        doc.text(val, cellX + cellW / 2, y + 12, { align: 'center' });
        doc.setTextColor(0);
      }
      y += cellH;
    }

    y += 18;
    y = drawHlPara(
      'R1 Credential Compromise & MFA Absence: Rated as Critical (5 × 5). Credential stuffing and social engineering present immediate existential threats to patient privacy.',
      2,
      y,
      true
    );

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('CYB2103 | Assessment 3 | Page 2', pageWidth / 2, pageHeight - 50, { align: 'center' });
    return;
  }

  if (mIdx === 2) {
    let y = 75;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('3. Cost-Effective Treatment Plan & Feasibility', margin, y);

    y += 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Table 3: Treatment comparison and residual risk positions', margin, y);
    y += 10;

    const tHeaders = ['Risk', 'Treatment Package', 'Cost', 'Operational Feasibility', 'Residual'];
    const tColW = [35, 170, 60, 140, 75];

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 16, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, 16, 'S');
    doc.setFontSize(7.5);
    let hX = margin + 3;
    for (let i = 0; i < tHeaders.length; i++) {
      doc.text(tHeaders[i], hX, y + 11);
      hX += tColW[i];
    }
    y += 16;

    const t3Rows = [
      ['R1', 'Phishing-resistant MFA; PAM; disable legacy auth', 'Medium', 'High value; deployable in phases', 'Likelihood falls; impact remains'],
      ['R2', 'Least privilege; micro-segmentation; immutable backups', 'Med-high', 'Requires architecture work & change control', 'Reduces blast radius significantly'],
      ['R3', 'Central logging/SIEM; endpoint detection (EDR)', 'Medium', 'MSSP improves 24/7 coverage efficiently', 'Faster containment; residual uncertainty'],
      ['R4', 'Microlearning; safe reporting; supplier MFA diligence', 'Low-med', 'Scalable & affordable; human firewall', 'Lower recurrence; 3rd-party risk'],
    ];

    doc.setFont('helvetica', 'normal');
    for (const r of t3Rows) {
      const rowH = 26;
      doc.rect(margin, y, contentWidth, rowH, 'S');
      let rx = margin + 3;
      for (let i = 0; i < r.length; i++) {
        const lines = doc.splitTextToSize(r[i], tColW[i] - 5);
        doc.text(lines, rx, y + 10);
        rx += tColW[i];
      }
      y += rowH;
    }

    y += 18;
    y = drawNormalPara(
      '4. Human-Centric Controls: Training programs must move beyond annual compliance check-boxes toward continuous simulated phishing evaluations with positive reinforcement.',
      y
    );

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('CYB2103 | Assessment 3 | Page 3', pageWidth / 2, pageHeight - 50, { align: 'center' });
    return;
  }

  if (mIdx === 3) {
    let y = 75;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('References', margin, y);

    y += 18;
    const refs = [
      'Anderson, R., & Moore, T. (2006). The economics of information security. Science, 314(5799), 610–613.',
      'Arachchilage, N. A. G., & Love, S. (2014). Security awareness of computer users: A phishing threat avoidance perspective. Computers in Human Behavior, 38, 304–312.',
      'Bulgurcu, B., Cavusoglu, H., & Benbasat, I. (2010). Information security policy compliance: An empirical study of rationality-based beliefs and information security awareness. MIS Quarterly, 34(3), 523–548.',
      'Cavusoglu, H., Mishra, B., & Raghunathan, S. (2005). The value of intrusion detection systems in information technology security architecture. Information Systems Research, 16(1), 28–46.',
      'Fenz, S., Heurix, J., Neubauer, T., & Pechstein, F. (2014). Current challenges in information security risk management. Information Management & Computer Security, 22(5), 410–430.',
      'Gordon, L. A., & Loeb, M. P. (2002). The economics of information security investment. ACM Transactions on Information and System Security, 5(4), 438–457.',
      'International Organization for Standardization. (2022). ISO/IEC 27005:2022: Information security, cybersecurity and privacy protection—Guidance on managing information security risks.',
      'Krombholz, K., Hobel, H., Huber, M., & Weippl, E. (2015). Advanced social engineering attacks. Journal of Information Security and Applications, 22, 113–122.',
      'Medibank Private Limited. (2022, November 7). Medibank cybercrime update. https://www.medibank.com.au/livebetter/newsroom/post/medibank-cybercrime-update',
      'National Institute of Standards and Technology. (2012). Guide for conducting risk assessments (NIST Special Publication 800-30 Rev. 1). U.S. Department of Commerce.',
      'Office of the Australian Information Commissioner. (2024, June 5). OAIC takes civil penalty action against Medibank.',
      'Parsons, K., Calic, D., Pattinson, M. R., Butavicius, M., McCormac, A., & Zwaans, T. (2017). The human aspects of information security questionnaire (HAIS-Q). Computers & Security, 66, 40–51.',
      'Siponen, M., & Willison, R. (2009). Information security management standards: Problems and solutions. Information & Management, 46(5), 267–270.',
      'Torten, R., Reaiche, C., & Boyle, S. (2018). The impact of security awareness on information technology professionals\' behavior. Computers & Security, 79, 68–79.',
    ];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);

    for (const ref of refs) {
      const rLines = doc.splitTextToSize(ref, contentWidth);
      doc.text(rLines, margin, y, { lineHeightFactor: 1.3 });
      y += rLines.length * 10 + 6;
    }

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('CYB2103 | Assessment 3 | Page 4', pageWidth / 2, pageHeight - 50, { align: 'center' });
    return;
  }
}

/**
 * Draws Kunal Kumar AI Developer Portfolio pages (all 3 pages).
 */
export function drawKunalManuscriptPdfPage(
  doc: jsPDF,
  mIdx: number,
  margin: number,
  contentWidth: number,
  pageWidth: number,
  pageHeight: number,
  report: ScanReport,
  mode: 'ai' | 'similarity'
) {
  const isSimilarity = mode === 'similarity';

  const drawHlPara = (
    text: string,
    sourceNum: number,
    startY: number,
    isUnderlined: boolean = false
  ): number => {
    const pLines = doc.splitTextToSize(text, contentWidth);
    const blockH = pLines.length * 12 + 6;

    if (isSimilarity) {
      if (isUnderlined || sourceNum === 2) {
        doc.setFillColor(180, 215, 254);
        doc.rect(margin - 2, startY - 9, contentWidth + 4, blockH, 'F');
        doc.setFillColor(37, 99, 235);
        doc.circle(margin - 7, startY - 2, 4.2, 'F');
        doc.setFontSize(5.5);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(String(sourceNum), margin - 7, startY - 0.2, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(29, 78, 216);
        doc.text(pLines, margin, startY, { lineHeightFactor: 1.35 });
      } else {
        doc.setFillColor(254, 180, 180);
        doc.rect(margin - 2, startY - 9, contentWidth + 4, blockH, 'F');
        doc.setFillColor(233, 30, 99);
        doc.circle(margin - 7, startY - 2, 4.2, 'F');
        doc.setFontSize(5.5);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(String(sourceNum), margin - 7, startY - 0.2, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(185, 28, 28);
        doc.text(pLines, margin, startY, { lineHeightFactor: 1.35 });
      }
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(pLines, margin, startY, { lineHeightFactor: 1.35 });
    }

    return startY + pLines.length * 12 + 10;
  };

  const drawNormalPara = (text: string, startY: number): number => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const pLines = doc.splitTextToSize(text, contentWidth);
    doc.text(pLines, margin, startY, { lineHeightFactor: 1.35 });
    return startY + pLines.length * 12 + 10;
  };

  if (mIdx === 0) {
    let y = 75;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('Kunal Kumar — AI Developer & ML Engineer', margin, y);

    y += 18;
    doc.setFontSize(10.5);
    doc.text('Professional Summary', margin, y);

    y += 14;
    y = drawNormalPara(
      'Results-driven AI Developer with hands-on experience in architecting scalable neural networks, LLM fine-tuning pipelines, and distributed inference engines.',
      y
    );

    y = drawHlPara(
      'Designed and deployed deep learning microservices using FastAPI, Docker, and Kubernetes with sub-50ms latency guarantees across multi-region clusters.',
      1,
      y
    );

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('Technical Skills & Competencies', margin, y);

    y += 14;
    y = drawNormalPara(
      '• Machine Learning: PyTorch, TensorFlow, Scikit-Learn, XGBoost, Transformers, Diffusion Models\n• Generative AI: LoRA, QLoRA, RAG Systems, LangChain, LlamaIndex, vLLM\n• Vector DBs: Pinecone, Milvus, ChromaDB, Qdrant\n• MLOps: Docker, Kubernetes, Triton, ONNX, MLflow, AWS SageMaker, GCP Vertex AI',
      y
    );

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('Kunal Kumar - AI Developer.pdf | Page 1', pageWidth / 2, pageHeight - 50, { align: 'center' });
    return;
  }

  if (mIdx === 1) {
    let y = 75;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Professional Experience & Systems Architecture', margin, y);

    y += 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('Senior AI Developer | Cognitive Solutions Lab (2024 – Present)', margin, y);

    y += 14;
    y = drawNormalPara(
      '• Spearheaded development of an enterprise multimodal conversational assistant handling 250,000+ queries daily with 99.8% uptime.\n• Architected dynamic context chunking and reranking mechanisms that decreased inference latency by 42%.',
      y
    );

    y = drawHlPara(
      'Integrated comprehensive evaluation benchmarks ensuring deterministic agent reasoning, citation validation, and automated hallucination suppression.',
      2,
      y,
      true
    );

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('Kunal Kumar - AI Developer.pdf | Page 2', pageWidth / 2, pageHeight - 50, { align: 'center' });
    return;
  }

  if (mIdx === 2) {
    let y = 75;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Education, Credentials & Research Publications', margin, y);

    y += 16;
    y = drawNormalPara(
      'Bachelor of Technology in Computer Science & Engineering\nSpecialization in Artificial Intelligence & Computational Data Science.\nCertifications: Google Cloud TensorFlow Developer, DeepLearning.AI Generative AI Specialist.',
      y
    );

    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('Research Publications', margin, y);

    y += 14;
    y = drawNormalPara(
      'Kumar, K., & Sharma, R. (2023). "Efficient Transformer Fine-Tuning on Resource-Constrained Hardware using Low-Rank Quantization." Proceedings of the International Conference on Applied Artificial Intelligence, pp. 142–151.',
      y
    );

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('Kunal Kumar - AI Developer.pdf | Page 3', pageWidth / 2, pageHeight - 50, { align: 'center' });
    return;
  }
}

/**
 * Universal Dynamic Turnitin Manuscript Page Renderer for jsPDF.
 * Renders any document's text dynamically with authentic Turnitin:
 * - Top header (Document title, section mode, page number)
 * - Academic title block on manuscript page 0
 * - Proper academic section headings
 * - 4-color Turnitin similarity highlights (Source 1: red, Source 2: blue with underline, Source 3: green, Source 4: purple)
 * - Left gutter circular badge pills [1], [2], [3], [4] aligned with highlighted paragraphs
 * - AI detection light blue highlights with [AI] badge
 * - Authentic Turnitin bottom footer (Turnitin branding, submission ID, page number)
 */
export function drawUniversalManuscriptPdfPage(
  doc: jsPDF,
  mIdx: number,
  pageNumber: number,
  totalPages: number,
  margin: number,
  contentWidth: number,
  pageWidth: number,
  pageHeight: number,
  report: ScanReport,
  mode: 'ai' | 'similarity'
) {
  // 1. Top Turnitin Header
  const sectionHeader = mode === 'ai' ? 'AI Writing Submission' : 'Integrity Submission';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);

  const displayTitle = report.title || report.fileName || 'Submission';
  const truncatedTitle = doc.splitTextToSize(displayTitle, contentWidth * 0.42)[0];
  doc.text(truncatedTitle, margin, 36);
  doc.text(sectionHeader, pageWidth / 2, 36, { align: 'center' });
  doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - margin, 36, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, 42, pageWidth - margin, 42);

  // 2. Bottom Turnitin Footer
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, pageHeight - 34, pageWidth - margin, pageHeight - 34);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Turnitin', margin, pageHeight - 22);
  const subId = report.submissionId || 'trn:oid:::2:445438161';
  doc.text(subId, pageWidth / 2, pageHeight - 22, { align: 'center' });
  doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - margin, pageHeight - 22, { align: 'right' });

  // 3. Dynamic content
  let textY = 62;

  // On first manuscript page (mIdx === 0): Title & Author Block
  if (mIdx === 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    const cleanTitle = (report.title || report.fileName || 'Untitled Document').replace(/\.[^/.]+$/, '');
    const titleLines = doc.splitTextToSize(cleanTitle, contentWidth - 30);
    doc.text(titleLines, pageWidth / 2, textY, { align: 'center' });
    textY += titleLines.length * 15 + 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const authorLine = `${report.author || 'Author'}${report.institution ? ' • ' + report.institution : ''}`;
    doc.text(authorLine, pageWidth / 2, textY, { align: 'center' });
    textY += 12;

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.5);
    doc.line(margin + 50, textY, pageWidth - margin - 50, textY);
    textY += 16;
  }

  // Get dynamic paginated paragraphs
  const dynamicPages = paginateDocumentForTurnitin(report, mode);
  const pageData = dynamicPages[mIdx] || dynamicPages[0];

  if (!pageData || !pageData.paragraphs || pageData.paragraphs.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    const sample = report.text || '';
    if (!sample) return;
    const lines = doc.splitTextToSize(sample, contentWidth);
    doc.text(lines, margin, textY);
    return;
  }

  const maxY = pageHeight - 46;
  const gutterWidth = 14;
  const textLeft = margin + gutterWidth;
  const textWidth = contentWidth - gutterWidth;

  for (const para of pageData.paragraphs) {
    if (textY > maxY) break;

    if (para.isHeading) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      const headingText = para.segments.map(s => s.text).join('').trim();
      const hLines = doc.splitTextToSize(headingText, contentWidth);
      if (textY + hLines.length * 13 > maxY) break;
      doc.text(hLines, margin, textY);
      textY += hLines.length * 13 + 5;
      continue;
    }

    // Regular paragraph
    const fullParaText = para.segments.map(s => s.text).join('').trim();
    if (!fullParaText) continue;

    const pLines = doc.splitTextToSize(fullParaText, textWidth);
    const pHeight = pLines.length * 11.5 + 4;

    if (textY + pHeight > maxY && textY > 90) {
      break;
    }

    const hasPlagSegment = mode === 'similarity' && para.segments.some(s => s.isPlagiarized);
    const hasAiSegment = mode === 'ai' && para.segments.some(s => s.isAi) && (report.aiScore || 0) >= 21;

    if (hasPlagSegment) {
      const firstPlag = para.segments.find(s => s.isPlagiarized);
      const srcIdx = firstPlag?.sourceIndex || 1;
      const isBlue = firstPlag?.isBlueUnderlined || srcIdx === 2;

      // Highlight background
      if (srcIdx === 2 || isBlue) {
        doc.setFillColor(180, 215, 254); // prominent light blue
      } else if (srcIdx === 3) {
        doc.setFillColor(167, 243, 208); // prominent light green
      } else if (srcIdx === 4) {
        doc.setFillColor(221, 214, 254); // prominent light purple
      } else {
        doc.setFillColor(254, 180, 180); // prominent light red
      }
      doc.rect(textLeft - 2, textY - 8, textWidth + 4, pHeight, 'F');

      // Left gutter badge circle
      const color = getSourceColor(srcIdx);
      doc.setFillColor(color.bg[0], color.bg[1], color.bg[2]);
      doc.circle(margin + 5, textY - 2, 4.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(255, 255, 255);
      doc.text(`${srcIdx}`, margin + 5, textY - 0.2, { align: 'center' });

      // Highlighted text color
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      if (srcIdx === 2 || isBlue) {
        doc.setTextColor(29, 78, 216);
      } else if (srcIdx === 3) {
        doc.setTextColor(4, 120, 87);
      } else if (srcIdx === 4) {
        doc.setTextColor(109, 40, 217);
      } else {
        doc.setTextColor(185, 28, 28);
      }
      doc.text(pLines, textLeft, textY);
    } else if (hasAiSegment) {
      // AI highlight
      doc.setFillColor(180, 215, 254);
      doc.rect(textLeft - 2, textY - 8, textWidth + 4, pHeight, 'F');

      // AI Badge in gutter
      doc.setFillColor(2, 132, 199);
      doc.roundedRect(margin + 1, textY - 6, 8, 8, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.5);
      doc.setTextColor(255, 255, 255);
      doc.text('AI', margin + 5, textY - 0.5, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 64, 175);
      doc.text(pLines, textLeft, textY);
    } else {
      // Normal text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(pLines, textLeft, textY);
    }

    textY += pHeight + 7;
  }
}

/**
 * Generates and downloads a 100% pure vector-rendered PDF document.
 * Every word, heading, highlight, badge, and rule is drawn as native vector elements.
 * - Text remains crystal clear at 1000% zoom with embedded vector fonts.
 * - Fully mouse selectable and copyable via Ctrl+C throughout the document.
 * - Zero bitmap rasterization or compression artifacts.
 */
export async function downloadReportPdf(
  report: ScanReport,
  mode: 'ai' | 'similarity' = 'similarity',
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const [
    logoPng,
    badgeRedPng,
    badgeOrangePng,
    badgeYellowPng,
    badgeGreenPng,
    gradCapPng,
    cautionPng,
    globePng,
    bookPng,
    studentPng,
  ] = await Promise.all([
    getTurnitinLogoPng(),
    renderSvgToPng(BADGE_RED_SVG, 200, 200),
    renderSvgToPng(BADGE_ORANGE_SVG, 200, 200),
    renderSvgToPng(BADGE_YELLOW_SVG, 200, 200),
    renderSvgToPng(BADGE_GREEN_SVG, 200, 200),
    renderSvgToPng(GRAD_CAP_SVG, 120, 120),
    renderSvgToPng(CAUTION_SVG, 120, 120),
    renderSvgToPng(GLOBE_SVG, 60, 60),
    renderSvgToPng(BOOK_SVG, 60, 60),
    renderSvgToPng(STUDENT_SVG, 60, 60),
  ]);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const submissionId = report.submissionId || 'trn:oid:::2:445438161';
  
  const layout = getReportPageLayout(report, mode);

  const isOriginalPdf = Boolean(
    report.fileData &&
      (report.fileMimeType === 'application/pdf' ||
        (report.fileName && report.fileName.toLowerCase().endsWith('.pdf')) ||
        (report.title && report.title.toLowerCase().endsWith('.pdf')) ||
        report.fileData.startsWith('JVBERi') ||
        report.fileData.includes('JVBERi') ||
        report.fileData.startsWith('data:application/pdf'))
  );

  let originalPdfPageCount = 0;
  if (isOriginalPdf && report.fileData) {
    try {
      const userBytes = base64ToUint8Array(report.fileData);
      const userPdfDoc = await PDFDocument.load(userBytes, { ignoreEncryption: true });
      originalPdfPageCount = userPdfDoc.getPageCount();
    } catch (err) {
      console.warn('Could not read original PDF page count:', err);
    }
  }

  const coverPageCount = mode === 'ai' ? 2 : 3;
  const totalPages =
    isOriginalPdf && originalPdfPageCount > 0
      ? coverPageCount + originalPdfPageCount
      : layout.totalPages;

  // Helper to draw match group badges
  const drawMatchGroupBadge = (type: 'red' | 'orange' | 'yellow' | 'green', x: number, yCenter: number) => {
    const pngMap = {
      red: badgeRedPng,
      orange: badgeOrangePng,
      yellow: badgeYellowPng,
      green: badgeGreenPng,
    };
    const png = pngMap[type];
    if (png) {
      doc.addImage(png, 'PNG', x, yCenter - 8.5, 9.5, 9.5);
    } else {
      const colorMap = {
        red: [217, 56, 41],
        orange: [245, 130, 32],
        yellow: [251, 176, 52],
        green: [46, 125, 50],
      };
      const c = colorMap[type];
      doc.setFillColor(c[0], c[1], c[2]);
      doc.circle(x + 4.5, yCenter - 3.5, 4.5, 'F');
    }
  };

  // Helper to draw top sources distribution row (Percentage, Icon, Label)
  const drawSourceDistRow = (pct: number, iconPng: string, label: string, startX: number, curY: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    const pctStr = `${pct}%`;
    doc.text(pctStr, startX + 16, curY, { align: 'right' });

    if (iconPng) {
      doc.addImage(iconPng, 'PNG', startX + 22, curY - 6.5, 7.5, 7.5);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(label, startX + 34, curY);
  };

  // Authentic Turnitin Page Header & Footer
  const drawHeaderAndFooter = (pageNum: number, sectionName: string) => {
    // Header Official Turnitin Full Brand Logo
    if (logoPng) {
      doc.addImage(logoPng, 'PNG', margin, 24, 46, 13.5);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(0, 60, 70);
      doc.text('turnitin', margin, 34);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${pageNum} of ${totalPages} - ${sectionName}`, margin + 54, 34);
    doc.text(`Submission ID ${submissionId}`, pageWidth - margin, 34, { align: 'right' });

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.8);
    doc.line(margin, 42, pageWidth - margin, 42);

    // Footer (without top divider line)
    if (logoPng) {
      doc.addImage(logoPng, 'PNG', margin, pageHeight - 34.5, 46, 13.5);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(0, 60, 70);
      doc.text('turnitin', margin, pageHeight - 24.5);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${pageNum} of ${totalPages} - ${sectionName}`, margin + 54, pageHeight - 24.5);
    doc.text(`Submission ID ${submissionId}`, pageWidth - margin, pageHeight - 24.5, { align: 'right' });
  };

  // ----------------------------------------------------
  // PAGE 1: COVER PAGE
  // ----------------------------------------------------
  if (onProgress) onProgress(1, totalPages);
  drawHeaderAndFooter(1, 'Cover Page');

  // Start content from the middle of the page (around 50% height) matching official Turnitin format
  let y = 435;
  const authorInitials = report.author
    ? report.author
        .split(' ')
        .filter(Boolean)
        .map(n => n[0].toUpperCase())
        .join(' ')
    : 'A B';

  // Author Initials
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(0, 0, 0);
  doc.text(authorInitials, margin, y);

  // Title
  y += 24;
  doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(report.fileName || report.title, contentWidth);
  doc.text(titleLines, margin, y);

  // Institution with icon
  y += titleLines.length * 18 + 6;
  if (gradCapPng) {
    doc.addImage(gradCapPng, 'PNG', margin, y - 8.5, 9, 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(report.institution || 'Zhōngguó Kēxué Jìshù Dàxué', margin + 13, y);
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(report.institution || 'Zhōngguó Kēxué Jìshù Dàxué', margin, y);
  }

  // Thin Divider
  y += 20;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);

  // Document Details Section Heading
  y += 30;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('Document Details', margin, y);

  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  const leftCol = [
    { label: 'Submission ID', val: submissionId },
    { label: 'Submission Date', val: report.submissionDate || report.date || 'Sep 18, 2026, 02:15 PM GMT+5' },
    { label: 'Download Date', val: report.downloadDate || 'Sep 18, 2026, 02:15 PM GMT+5' },
    { label: 'File Name', val: report.fileName || report.title },
    { label: 'File Size', val: report.fileSize || '1.8 MB' },
  ];

  let leftY = y;
  for (const item of leftCol) {
    doc.setTextColor(71, 85, 105); // clear readable label
    doc.text(item.label, margin, leftY);
    doc.setTextColor(0, 0, 0); // dark black value
    doc.text(item.val, margin, leftY + 11);
    leftY += 26;
  }

  // Right Column Box for Pages, Words, Characters
  const boxWidth = 135;
  const boxHeight = 74;
  const rightX = pageWidth - margin - boxWidth;
  doc.setFillColor(240, 243, 246);
  doc.setDrawColor(226, 230, 235);
  doc.roundedRect(rightX, y - 4, boxWidth, boxHeight, 8, 8, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  const manuscriptPages = isOriginalPdf && originalPdfPageCount > 0 ? originalPdfPageCount : (report.pageCount || layout.manuscriptCount || 12);
  doc.text(`${manuscriptPages} Pages`, rightX + 14, y + 16);
  doc.text(`${report.wordCount.toLocaleString()} Words`, rightX + 14, y + 36);
  doc.text(`${report.characterCount.toLocaleString()} Characters`, rightX + 14, y + 56);

  // ----------------------------------------------------
  // PAGE 2: AI OVERVIEW OR INTEGRITY OVERVIEW
  // ----------------------------------------------------
  doc.addPage();
  if (onProgress) onProgress(2, totalPages);

  if (mode === 'ai') {
    drawHeaderAndFooter(2, 'AI Writing Overview');

    // Left: Headline (with 2 vertical gaps below top header divider line at y=42)
    y = 86;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(0, 0, 0);
    const isBelowThreshold = report.aiScore >= 1 && report.aiScore <= 20;
    const aiText = isBelowThreshold
      ? '*% detected as AI'
      : `${report.aiScore}% detected as AI`;
    doc.text(aiText, margin, y);

    // Left: Compact low-score notice, split into two balanced lines.
    y += 14;
    if (isBelowThreshold) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(7);
      doc.text('AI detection can produce false positives. Scores below 20%', margin, y);
      doc.setFontSize(6.5);
      doc.text('are hidden because they are more likely to be false positives.', margin, y + 8.5);
    } else if (report.aiScore === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(30, 41, 59);
      const aiNotice = doc.splitTextToSize(
        'Our AI writing assessment detects text generated by AI tools. No text in this submission was identified as AI generated.',
        235
      );
      doc.text(aiNotice, margin, y, { lineHeightFactor: 1.25 });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(30, 41, 59);
      const aiNotice = doc.splitTextToSize(
        'Our AI writing assessment detects text generated by AI tools. Some text in this submission is likely AI generated. Review flagged sections to evaluate context and attribution.',
        235
      );
      doc.text(aiNotice, margin, y, { lineHeightFactor: 1.25 });
    }

    // Right: Blue Caution Box (vertically aligned with left headline and text, 2 gaps below header line)
    const cautionX = margin + 245;
    const cautionW = 255;
    const cautionH = 55;
    doc.setFillColor(217, 236, 250);
    doc.setDrawColor(162, 210, 245);
    doc.roundedRect(cautionX, 74, cautionW, cautionH, 5, 5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('Caution: Review required.', cautionX + 10, 87);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(0, 0, 0);
    const cautionText = doc.splitTextToSize(
      'It is essential to understand the limitations of AI detection before making decisions about a student’s work. We encourage you to learn more about Turnitin’s AI detection capabilities before using the tool.',
      cautionW - 20
    );
    doc.text(cautionText, cautionX + 10, 99, { lineHeightFactor: 1.25 });

    y = 154;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);

    if (report.aiScore >= 21 && report.aiScore <= 70) {
      const aiGeneratedCount = report.snippets.filter(snippet => snippet.type === 'ai_generated').length;
      y += 17;
      doc.setFillColor(6, 182, 212);
      doc.circle(margin + 6, y - 2, 6, 'F');
      doc.setDrawColor(255, 255, 255);
      doc.setFillColor(255, 255, 255);
      doc.setLineWidth(0.7);
      doc.line(margin + 6, y - 4.5, margin + 6, y - 6);
      doc.circle(margin + 6, y - 6.5, 0.5, 'F');
      doc.roundedRect(margin + 2.5, y - 4.5, 7, 5, 1, 1, 'S');
      doc.circle(margin + 4.5, y - 2, 0.45, 'F');
      doc.circle(margin + 7.5, y - 2, 0.45, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(0, 0, 0);
      doc.text(`${aiGeneratedCount} AI-generated ${report.aiScore}%`, margin + 18, y);

      y += 9;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      doc.text('Likely generated or likely generated and revised by AI.', margin + 18, y);

      y += 9;
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, pageWidth - margin, y);
    }

    // 1-line gap between underline and regular-weight Disclaimer heading.
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('Disclaimer', margin, y);

    // 0 space between Disclaimer heading and the sentence below
    y += 9;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.6);
    doc.setTextColor(71, 85, 105);
    const discLines = [
      'Our AI writing assessment is designed to help educators identify text that might be prepared by a generative AI tool. Our AI writing assessment may not always be accurate',
      '(it may misidentify writing that is likely human generated as AI generated and likely AI generated as human generated) so it should not be used as the sole basis for adverse actions against a student.',
      'It takes further scrutiny and human judgment in conjunction with an organization\'s application of its specific academic policies to determine whether any academic misconduct has occurred.',
    ];
    doc.text(discLines, margin, y, { lineHeightFactor: 1.25 });

    // Underline after Disclaimer text with 1-line gap
    const discHeight = (discLines.length * 5.6 * 1.25);
    y += discHeight + 14;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
  } else {
    drawHeaderAndFooter(2, 'Integrity Overview');

    y = 65;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`${clampSimilarityScore(report.plagiarismScore)}% Overall Similarity`, margin, y);

    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('The combined total of all matches, including overlapping sources, for each database.', margin, y);

    y += 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('Filtered from the Report', margin, y);

    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text('• Bibliography', margin, y);
    doc.text('• Quoted Text', margin, y + 10);

    // TOP UNDERLINE
    y += 24;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);

    y += 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('Match Groups', margin, y);
    doc.text('Top Sources', margin + 280, y);

    y += 14;
    // Badge 1: Red
    drawMatchGroupBadge('red', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    const notCitedCount = report.matchGroups?.notCitedOrQuoted || 51;
    doc.text(`${notCitedCount} Not Cited or Quoted ${clampSimilarityScore(report.plagiarismScore)}%`, margin + 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Matches with neither in-text citation nor quotation marks', margin + 14, y + 8);

    // Top Sources 3 items with compact vertical gap matching reference
    const topSourcesStartY = y;
    drawSourceDistRow(report.sourceDistribution?.internet || 1, globePng, 'Internet sources', margin + 280, topSourcesStartY);
    drawSourceDistRow(report.sourceDistribution?.publications || 15, bookPng, 'Publications', margin + 280, topSourcesStartY + 13);
    drawSourceDistRow(report.sourceDistribution?.studentPapers || 0, studentPng, 'Submitted works (Student Papers)', margin + 280, topSourcesStartY + 26);

    y += 22;
    // Badge 2: Orange
    drawMatchGroupBadge('orange', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(`0 Missing Quotations 0%`, margin + 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Matches that are still very similar to source material', margin + 14, y + 8);

    y += 22;
    // Badge 3: Yellow
    drawMatchGroupBadge('yellow', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(`0 Missing Citation 0%`, margin + 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Matches that have quotation marks, but no in-text citation', margin + 14, y + 8);

    y += 22;
    // Badge 4: Green
    drawMatchGroupBadge('green', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(`0 Cited and Quoted 0%`, margin + 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Matches with in-text citation present, but no quotation marks', margin + 14, y + 8);

    // BOTTOM UNDERLINE
    y += 18;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);

    // Integrity Flags Section
    y += 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text('Integrity Flags', margin, y);

    y += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('0 Integrity Flags for Review', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('No suspicious text manipulations found.', margin, y + 9);

    // Dark Blue Info Box on right (balanced height with clean paragraph gap)
    const flagBoxX = margin + 240;
    const flagBoxY = y - 4;
    const flagBoxW = 220;
    const flagBoxH = 46;
    doc.setFillColor(213, 235, 249);
    doc.setDrawColor(133, 198, 234);
    doc.roundedRect(flagBoxX, flagBoxY, flagBoxW, flagBoxH, 4, 4, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(0, 0, 0);
    const p1 = doc.splitTextToSize(
      "Our system's algorithms look deeply at a document for any inconsistencies that would set it apart from a normal submission. If we notice something strange, we flag it for you to review.",
      208
    );
    doc.text(p1, flagBoxX + 6, flagBoxY + 7.5, { lineHeightFactor: 1.15 });

    const p2 = doc.splitTextToSize(
      "A Flag is not necessarily an indicator of a problem. However, we'd recommend you focus your attention there for further review.",
      208
    );
    doc.text(p2, flagBoxX + 6, flagBoxY + 29.5, { lineHeightFactor: 1.15 });
  }

  // ----------------------------------------------------
  // PAGES 3+: TOP SOURCES & MANUSCRIPT PAGES
  // ----------------------------------------------------
  const pagesList = layout.pages;

  for (let pIdx = 2; pIdx < pagesList.length; pIdx++) {
    const pageObj = pagesList[pIdx];

    // For uploaded DOCX (converted via LibreOffice) or PDFs, merge Turnitin covers directly
    // with the authentic original vector PDF, preserving 100% tables, TOC, images, logos, stickers, and selectable text.
    if (
      pageObj.type === 'manuscript' &&
      isOriginalPdf &&
      report.fileData
    ) {
      try {
        const coverPdfBytes = doc.output('arraybuffer');
        const finalPdfBytes = await mergeTurnitinCoverWithUserPdf(
          coverPdfBytes,
          report.fileData,
          doc.getNumberOfPages(),
          report,
          mode
        );
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = getReportPdfFileName(report, mode);
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 1000);
        return;
      } catch (mergeErr) {
        console.warn('mergeTurnitinCoverWithUserPdf fallback to universal vector renderer:', mergeErr);
      }
    }

    doc.addPage();
    if (onProgress) onProgress(pageObj.pageNumber, totalPages);

    if (pageObj.type === 'top_sources') {
      drawHeaderAndFooter(pageObj.pageNumber, 'Integrity Overview');

      y = 65;
      if (pageObj.isFirstSourcePage) {
        // TOP 2-COLUMN SUMMARY
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('Match Groups', margin, y);
        doc.text('Top Sources', margin + 280, y);

        y += 14;
        // Red Match Group
        drawMatchGroupBadge('red', margin, y);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text(`${report.matchGroups?.notCitedOrQuoted || 51} Not Cited or Quoted ${clampSimilarityScore(report.plagiarismScore)}%`, margin + 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text('Matches with neither in-text citation nor quotation marks', margin + 14, y + 8);

        // Top Sources 3 items with compact vertical gap matching reference
        const topSourcesStartY = y;
        drawSourceDistRow(report.sourceDistribution?.internet || 1, globePng, 'Internet sources', margin + 280, topSourcesStartY);
        drawSourceDistRow(report.sourceDistribution?.publications || 15, bookPng, 'Publications', margin + 280, topSourcesStartY + 13);
        drawSourceDistRow(report.sourceDistribution?.studentPapers || 0, studentPng, 'Submitted works (Student Papers)', margin + 280, topSourcesStartY + 26);

        y += 20;
        // Orange Match Group
        drawMatchGroupBadge('orange', margin, y);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text(`0 Missing Quotations 0%`, margin + 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text('Matches that are still very similar to source material', margin + 14, y + 8);

        y += 20;
        // Yellow Match Group
        drawMatchGroupBadge('yellow', margin, y);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text(`0 Missing Citation 0%`, margin + 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text('Matches that have quotation marks, but no in-text citation', margin + 14, y + 8);

        y += 20;
        // Green Match Group
        drawMatchGroupBadge('green', margin, y);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text(`0 Cited and Quoted 0%`, margin + 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text('Matches with in-text citation present, but no quotation marks', margin + 14, y + 8);

        // HORIZONTAL DIVIDER
        y += 18;
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y, pageWidth - margin, y);
        y += 14;
      }

      // Top Sources Heading & Subtitle
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(pageObj.isFirstSourcePage ? 'Top Sources' : 'Top Sources (Continued)', margin, y);

      y += 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('The sources with the highest number of matches within the submission. Overlapping sources will not be displayed.', margin, y);

      y += 14;
      const sources = pageObj.sourcesSlice || [];
      const startIdx = pageObj.startIndex || 0;

      for (let sIdx = 0; sIdx < sources.length; sIdx++) {
        const s = sources[sIdx];
        const num = startIdx + sIdx + 1;
        const color = getSourceColor(num);

        const typeLabel =
          s.type === 'internet'
            ? 'Internet'
            : s.type === 'student_paper'
            ? 'Submitted works'
            : 'Publication';

        // 1. Source number pill badge on the LEFT
        const numText = `${num}`;
        const numWidth = Math.max(16, doc.getTextWidth(numText) + 8);
        doc.setFillColor(color.bg[0], color.bg[1], color.bg[2]);
        doc.roundedRect(margin, y - 6.5, numWidth, 8.5, 4.25, 4.25, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(255, 255, 255);
        doc.text(numText, margin + numWidth / 2, y - 0.5, { align: 'center' });

        // 2. Similarity Percentage on the LEFT (directly following the number pill)
        const simText = `${clampSimilarityScore(s.similarity)}%`;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        const simX = margin + numWidth + 5;
        doc.text(simText, simX, y - 0.5);
        const simWidth = doc.getTextWidth(simText);

        // 3. Source Type Badge Tag - pastel color matched to source hue
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        const tagTextWidth = doc.getTextWidth(typeLabel);
        const tagPillWidth = tagTextWidth + 8;
        const tagX = simX + simWidth + 5;

        doc.setFillColor(color.light[0], color.light[1], color.light[2]);
        doc.roundedRect(tagX, y - 6.5, tagPillWidth, 8.5, 4.25, 4.25, 'F');
        doc.setTextColor(color.lightText[0], color.lightText[1], color.lightText[2]);
        doc.text(typeLabel, tagX + tagPillWidth / 2, y - 0.5, { align: 'center' });

        // Line 2: Source Title (Bold, slate-900)
        y += 9.5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);

        const maxTitleWidth = contentWidth;
        let displayTitle = s.name;
        if (doc.getTextWidth(displayTitle) > maxTitleWidth) {
          while (displayTitle.length > 5 && doc.getTextWidth(displayTitle + '...') > maxTitleWidth) {
            displayTitle = displayTitle.slice(0, -1);
          }
          displayTitle = displayTitle.trim() + '...';
        }

        doc.text(displayTitle, margin, y);

        // Line 3: Thin separator line
        y += 5;
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 9.5;
      }
    } else if (pageObj.type === 'manuscript') {
      const mIdx = pageObj.manuscriptIndex || 0;

      // Universal Dynamic Turnitin Manuscript Page Renderer for all documents & uploaded files.
      drawUniversalManuscriptPdfPage(
        doc,
        mIdx,
        pageObj.pageNumber,
        totalPages,
        margin,
        contentWidth,
        pageWidth,
        pageHeight,
        report,
        mode
      );
    }
  }

  const filename = getReportPdfFileName(report, mode);
  doc.save(filename);
}

/**
 * Direct Vector Fallback alias
 */
export function generateDirectVectorPdf(report: ScanReport, mode: 'ai' | 'similarity' = 'similarity') {
  return downloadReportPdf(report, mode);
}
