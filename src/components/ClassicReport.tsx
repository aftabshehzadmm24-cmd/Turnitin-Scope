import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { useApp } from '../context/AppContext';
import { cleanText } from '../utils/documentParser';
import { cleanBase64ToUint8Array } from '../utils/pdfPageRenderer';
import { MatchedSource, ScanReport } from '../types';
import {
  computeHighlightsForPage,
  getHighlightTheme,
  DocHighlightBox,
  RawTextItem,
} from '../utils/authenticDocHighlighter';
import {
  CLASSIC_SOURCE_PALETTE,
  cleanClassicSubmissionId,
  formatClassicFileName,
  formatClassicSubmissionDate,
  getClassicSourceType,
} from '../utils/pdfGenerator';

interface ClassicReportProps {
  report: ScanReport;
}

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const PAGE_STYLE: React.CSSProperties = {
  width: PAGE_WIDTH,
  height: PAGE_HEIGHT,
  minWidth: PAGE_WIDTH,
  minHeight: PAGE_HEIGHT,
  background: '#fff',
  boxShadow: '0 12px 35px rgba(15, 23, 42, 0.18)',
  overflow: 'hidden',
  position: 'relative',
};

const sourceColors = ['#e91e63', '#2563eb', '#059669', '#7c3aed', '#db2777', '#ea580c'];

function normalizeTitle(title: string, fileName: string) {
  return (title || fileName || 'Untitled').replace(/\.[^.]+$/, '').trim();
}

function splitIntoManuscriptPages(text: string, pageCount: number) {
  const normalized = cleanText(text).replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (!normalized) return ['No readable manuscript text was found in this submission.'];

  const targetPages = Math.max(1, pageCount);
  const roughLength = Math.max(1, Math.ceil(normalized.length / targetPages));
  const pages: string[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    if (pages.length === targetPages - 1) {
      pages.push(normalized.slice(cursor).trim());
      break;
    }

    let end = Math.min(normalized.length, cursor + roughLength);
    if (end < normalized.length) {
      const preferredBreak = normalized.lastIndexOf('\n\n', end);
      const fallbackBreak = normalized.lastIndexOf('. ', end);
      const breakAt = Math.max(preferredBreak, fallbackBreak);
      if (breakAt > cursor + roughLength * 0.55) end = breakAt + (preferredBreak === breakAt ? 2 : 2);
    }
    pages.push(normalized.slice(cursor, end).trim());
    cursor = end;
  }

  return pages;
}

function titleSourceNames(sources: MatchedSource[]) {
  return sources.slice(0, 3).map(source => source.name);
}

const ClassicAuthenticManuscriptPage: React.FC<{
  fileData: string;
  pageIndex: number;
  pageNumber: number;
  report: ScanReport;
}> = ({ fileData, pageIndex, pageNumber, report }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [textItems, setTextItems] = useState<RawTextItem[]>([]);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function renderPage() {
      try {
        setLoading(true);
        const bytes = cleanBase64ToUint8Array(fileData);
        if (!bytes.length) return;

        const loadingTask = pdfjsLib.getDocument({ data: bytes, useSystemFonts: true });
        const pdf = await loadingTask.promise;
        const targetPage = pageIndex + 1;
        if (targetPage > pdf.numPages) return;

        const page = await pdf.getPage(targetPage);
        const baseViewport = page.getViewport({ scale: 1 });
        const renderViewport = page.getViewport({ scale: 2 });

        if (!isMounted) return;
        setPageDimensions({ width: baseViewport.width, height: baseViewport.height });

        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = renderViewport.width;
        canvas.height = renderViewport.height;
        const context = canvas.getContext('2d');
        if (context) {
          await page.render({ canvasContext: context, viewport: renderViewport, canvas } as any).promise;
        }

        try {
          const textContent = await page.getTextContent();
          const overlays: RawTextItem[] = [];
          for (const item of textContent.items as any[]) {
            if (!item.str || !item.transform) continue;
            const [left, baseline] = baseViewport.convertToViewportPoint(item.transform[4], item.transform[5]);
            const fontSize = Math.sqrt(item.transform[0] ** 2 + item.transform[1] ** 2);
            overlays.push({
              str: item.str,
              left,
              top: Math.max(0, baseline - fontSize * 0.78),
              width: Math.max((item.width || 0) * baseViewport.scale, 4),
              height: Math.max(fontSize * 0.88, 1),
              fontSize,
            });
          }
          if (isMounted) setTextItems(overlays);
        } catch (err) {
          console.warn('Text layer extraction notice in classic view:', err);
        }
      } catch (err) {
        console.error('Error rendering classic authentic page:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    renderPage();
    return () => {
      isMounted = false;
    };
  }, [fileData, pageIndex]);

  const highlights = useMemo<DocHighlightBox[]>(() => {
    if (!pageDimensions || !textItems.length) return [];
    return computeHighlightsForPage(textItems, pageDimensions.width, pageDimensions.height, pageIndex, report, 'similarity');
  }, [textItems, pageDimensions, pageIndex, report]);

  return (
    <section
      id={`classic-report-page-${pageNumber}`}
      className="classic-report-sheet"
      style={{ ...PAGE_STYLE }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '24px 28px 60px',
          boxSizing: 'border-box',
        }}
      >
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', zIndex: 10 }}>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Loading document page {pageIndex + 1}...</div>
          </div>
        )}

        <div
          style={{
            position: 'relative',
            maxWidth: '100%',
            maxHeight: '100%',
            aspectRatio: pageDimensions ? `${pageDimensions.width} / ${pageDimensions.height}` : undefined,
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />

          {/* Highlights overlay matching new view */}
          {highlights.length > 0 && pageDimensions && (
            <div className="pointer-events-none absolute inset-0 z-10 select-none overflow-hidden">
              {highlights.map(highlight => {
                const theme = getHighlightTheme(highlight.type, highlight.sourceIndex);
                return (
                  <React.Fragment key={highlight.id}>
                    <div
                      className="absolute rounded-[1.5px]"
                      style={{
                        left: `${(highlight.left / pageDimensions.width) * 100}%`,
                        top: `${(highlight.top / pageDimensions.height) * 100}%`,
                        width: `${(highlight.width / pageDimensions.width) * 100}%`,
                        height: `${(highlight.height / pageDimensions.height) * 100}%`,
                        backgroundColor: theme.bg,
                        mixBlendMode: 'multiply',
                      }}
                    />
                    {highlight.showBadge && highlight.badgeNumber && (
                      <span
                        className="absolute inline-flex h-[13px] w-[13px] items-center justify-center rounded-full font-mono text-[8px] font-bold leading-none text-white"
                        style={{
                          left: `${((highlight.badgeLeft ?? Math.max(10, highlight.left - 15)) / pageDimensions.width) * 100}%`,
                          top: `${((highlight.badgeTop ?? highlight.top) / pageDimensions.height) * 100}%`,
                          backgroundColor: theme.badgeBg,
                        }}
                      >
                        {highlight.badgeNumber}
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* Selectable text layer */}
          {textItems.length > 0 && pageDimensions && (
            <div className="pointer-events-auto absolute inset-0 select-text overflow-hidden">
              {textItems.map((item, index) => (
                <span
                  key={`classic-text-${index}`}
                  className="absolute cursor-text whitespace-pre text-transparent selection:bg-blue-500/30"
                  style={{
                    left: `${(item.left / pageDimensions.width) * 100}%`,
                    top: `${(item.top / pageDimensions.height) * 100}%`,
                    width: `${(item.width / pageDimensions.width) * 100}%`,
                    fontSize: `${item.fontSize}px`,
                    lineHeight: '1.1',
                    userSelect: 'text',
                  }}
                >
                  {item.str}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 30,
          textAlign: 'center',
          fontFamily: 'Times New Roman, serif',
          fontSize: 15,
          color: '#111827',
        }}
      >
        {pageNumber - 1}
      </div>
    </section>
  );
};

export const ClassicReport: React.FC<ClassicReportProps> = ({ report }) => {
  const { currentUser } = useApp();
  const authorName = report.classicAuthor?.trim() || report.author?.trim() || 'Author';
  const ownerName = report.ownerName?.trim() || currentUser?.name || 'Kunal Kumar';
  const manuscriptCount = Math.max(1, report.pageCount || 1);
  const manuscriptPages = splitIntoManuscriptPages(report.text || report.contentSample || '', manuscriptCount);
  const submissionDate = report.submissionDate || report.date;
  const sources = titleSourceNames(report.sources || []);
  const topSources = report.sources?.length ? report.sources : [
    { id: 'none', name: 'No matching internet source', url: '', similarity: 0, type: 'internet' as const },
  ];

  const [authenticPageCount, setAuthenticPageCount] = useState<number | null>(null);

  useEffect(() => {
    if (!report.fileData) return;
    let isMounted = true;
    async function loadPageCount() {
      try {
        const bytes = cleanBase64ToUint8Array(report.fileData);
        if (!bytes.length) return;
        const pdf = await pdfjsLib.getDocument({ data: bytes, useSystemFonts: true }).promise;
        if (isMounted) setAuthenticPageCount(pdf.numPages);
      } catch (err) {
        console.warn('Could not load authentic page count:', err);
      }
    }
    loadPageCount();
    return () => {
      isMounted = false;
    };
  }, [report.fileData]);

  const hasAuthenticPdf = Boolean(report.fileData);
  const userPageCount = hasAuthenticPdf
    ? (authenticPageCount ?? report.pageCount ?? 1)
    : manuscriptPages.length;
  // Cover page (1) + User pages (userPageCount) + Summary page (1) = userPageCount + 2
  const totalPages = userPageCount + 2;

  const formattedDate = formatClassicSubmissionDate(submissionDate);
  const cleanId = cleanClassicSubmissionId(report.submissionId);
  const formattedFileName = formatClassicFileName(report.fileName, report.title, report.fileSize);

  return (
    <div className="classic-report flex flex-col items-center gap-8 bg-transparent">
      <section id="classic-report-page-1" className="classic-report-sheet" style={PAGE_STYLE}>
        {/* Title and Byline: exact position (19.5% from top), Arial/Helvetica normal weight, matching sample */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 220, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 24, fontWeight: 400, color: '#2c2c2c', letterSpacing: '-0.01em' }}>
            {authorName}
          </div>
          <div style={{ marginTop: 10, fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 13, fontWeight: 400, color: '#2c2c2c' }}>
            <span style={{ fontStyle: 'italic' }}>by </span>
            <span style={{ fontStyle: 'normal' }}>{ownerName}</span>
          </div>
        </div>

        {/* Horizontal separator line matching sample */}
        <div style={{ position: 'absolute', left: 34, right: 34, bottom: 136, height: 1, backgroundColor: '#e5e7eb' }} />

        {/* Metadata block matching sample formatting and margins */}
        <div style={{ position: 'absolute', left: 34, right: 34, bottom: 32, fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 9.5, lineHeight: 1.62, color: '#111827' }}>
          <div><b style={{ fontWeight: 600, color: '#111827' }}>Submission date:</b> <span style={{ fontWeight: 300, color: '#4b5563' }}>{formattedDate}</span></div>
          <div><b style={{ fontWeight: 600, color: '#111827' }}>Submission ID:</b> <span style={{ fontWeight: 300, color: '#4b5563' }}>{cleanId}</span></div>
          <div><b style={{ fontWeight: 600, color: '#111827' }}>File name:</b> <span style={{ fontWeight: 300, color: '#4b5563' }}>{formattedFileName}</span></div>
          <div><b style={{ fontWeight: 600, color: '#111827' }}>Word count:</b> <span style={{ fontWeight: 300, color: '#4b5563' }}>{report.wordCount.toLocaleString()}</span></div>
          <div><b style={{ fontWeight: 600, color: '#111827' }}>Character count:</b> <span style={{ fontWeight: 300, color: '#4b5563' }}>{report.characterCount.toLocaleString()}</span></div>
        </div>
      </section>

      {hasAuthenticPdf ? (
        Array.from({ length: userPageCount }, (_, index) => (
          <ClassicAuthenticManuscriptPage
            key={`classic-authentic-page-${index}`}
            fileData={report.fileData!}
            pageIndex={index}
            pageNumber={index + 2}
            report={report}
          />
        ))
      ) : (
        manuscriptPages.map((pageText, index) => {
          const pageNumber = index + 2;
          const paragraphs = pageText.split(/\n\s*\n/).filter(Boolean);
          return (
            <section
              key={`classic-manuscript-${index}`}
              id={`classic-report-page-${pageNumber}`}
              className="classic-report-sheet"
              style={{ ...PAGE_STYLE }}
            >
              {index === 0 && (
                <div style={{ textAlign: 'center', margin: '76px 110px 34px', fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#111827' }}>
                  {authorName}
                </div>
              )}
              <div
                style={{
                  margin: index === 0 ? '0 117px' : '68px 117px 0',
                  fontFamily: 'Times New Roman, serif',
                  fontSize: 15,
                  lineHeight: 1.77,
                  color: '#111827',
                  textAlign: 'justify',
                }}
              >
                {paragraphs.map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex} style={{ margin: paragraphIndex === 0 ? 0 : '0 0 18px', textIndent: paragraphIndex === 0 ? 0 : 28 }}>
                    {paragraph.replace(/\n/g, ' ')}
                  </p>
                ))}
              </div>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 42, textAlign: 'center', fontFamily: 'Times New Roman, serif', fontSize: 15, color: '#111827' }}>
                {pageNumber - 1}
              </div>
            </section>
          );
        })
      )}

      <section id={`classic-report-page-${totalPages}`} className="classic-report-sheet" style={PAGE_STYLE}>
        {/* Header: Author Name in black, unbold, starts after 2-3 spaces (12px inset) */}
        <div style={{ margin: '38px 28px 0', fontFamily: 'Arial, Helvetica, sans-serif' }}>
          <div style={{ fontSize: 13.5, color: '#111827', fontWeight: 300, paddingLeft: 12 }}>
            {authorName}
          </div>
          <div style={{ marginTop: 8, height: 1, backgroundColor: '#9ca3af' }} />
          <div style={{ margin: '6px 0', paddingLeft: 12, color: '#ff0000', fontSize: 7.5, fontWeight: 400, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Originality report
          </div>
          <div style={{ height: 1, backgroundColor: '#cbd5e1' }} />
        </div>

        {/* 4 Metric Columns (indented by 12px to match 2-3 spaces) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, margin: '14px 28px 0', padding: '0 12px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
          {[
            { value: report.plagiarismScore ?? 0, label: 'SIMILARITY INDEX', isRed: true },
            { value: report.sourceDistribution?.internet ?? report.sources?.length ?? 0, label: 'INTERNET SOURCES', isRed: false },
            { value: report.sourceDistribution?.publications ?? 0, label: 'PUBLICATIONS', isRed: false },
            { value: report.sourceDistribution?.studentPapers ?? 0, label: 'STUDENT PAPERS', isRed: false },
          ].map((metric) => (
            <div key={metric.label}>
              <div style={{ display: 'flex', alignItems: 'baseline', color: metric.isRed ? '#ff0000' : '#000000' }}>
                <span style={{ fontSize: 34, fontWeight: 400, lineHeight: 1 }}>{metric.value}</span>
                {metric.isRed && <span style={{ fontSize: 17, fontWeight: 400, marginLeft: 2, lineHeight: 1 }}>%</span>}
              </div>
              <div style={{ marginTop: 4, fontSize: 9, fontWeight: 400, color: '#000000', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                {metric.label}
              </div>
            </div>
          ))}
        </div>

        {/* Divider below metrics */}
        <div style={{ margin: '14px 28px 0', height: 1, backgroundColor: '#9ca3af' }} />

        {/* PRIMARY SOURCES Header in pure red #ff0000 (indented by 12px) */}
        <div style={{ margin: '12px 28px 0', fontFamily: 'Arial, Helvetica, sans-serif' }}>
          <div style={{ paddingLeft: 12, color: '#ff0000', fontSize: 7.5, fontWeight: 400, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Primary sources
          </div>
          <div style={{ marginTop: 6, height: 1, backgroundColor: '#cbd5e1' }} />
        </div>

        {/* Primary Sources List (indented by 12px on both left and right) */}
        <div style={{ margin: '0 28px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
          {topSources.slice(0, 10).map((source, index) => {
            const color = CLASSIC_SOURCE_PALETTE[index % CLASSIC_SOURCE_PALETTE.length];
            const sourceType = getClassicSourceType(source);
            return (
              <div
                key={source.id || index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderBottom: '1px solid #d1d5db',
                }}
              >
                {/* Solid colored square badge with centered white number */}
                <div
                  style={{
                    width: 26,
                    height: 26,
                    backgroundColor: color.hex,
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginRight: 14,
                    borderRadius: 0,
                  }}
                >
                  {index + 1}
                </div>

                {/* Source Title in badge color & Subtitle in light gray */}
                <div style={{ flex: 1, minWidth: 0, marginRight: 16 }}>
                  <div
                    style={{
                      color: color.hex,
                      fontSize: 14.5,
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {source.name}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: 10.5, marginTop: 3, fontWeight: 400 }}>
                    {sourceType}
                  </div>
                </div>

                {/* Right-aligned percentage */}
                <div style={{ flexShrink: 0, textAlign: 'right', color: '#343434', display: 'flex', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 26, fontWeight: 400, lineHeight: 1 }}>{source.similarity}</span>
                  <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 1, lineHeight: 1 }}>%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Divider line above exclusions (moved down by one line) */}
        <div style={{ margin: '48px 28px 0', height: 1, backgroundColor: '#d8d8d8' }} />

        {/* Exclusions Settings (indented by 12px, Exclude matches shifted by 8 spaces) */}
        <div
          style={{
            margin: '12px 28px 0',
            padding: '0 12px',
            display: 'grid',
            gridTemplateColumns: '280px 280px',
            rowGap: 8,
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 10,
            color: '#9ca3af',
          }}
        >
          <div>
            <span style={{ display: 'inline-block', width: 140 }}>Exclude quotes</span>
            <span>{report.excludeQuotes ? 'On' : 'Off'}</span>
          </div>
          <div style={{ paddingLeft: 40 }}>
            <span style={{ display: 'inline-block', width: 130 }}>Exclude matches</span>
            <span>Off</span>
          </div>
          <div>
            <span style={{ display: 'inline-block', width: 140 }}>Exclude bibliography</span>
            <span>{report.excludeBibliography ? 'On' : 'Off'}</span>
          </div>
        </div>
      </section>
    </div>
  );
};
