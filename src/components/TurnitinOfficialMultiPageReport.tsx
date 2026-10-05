import React, { useState } from 'react';
import { ScanReport } from '../types';
import {
  TurnitinCoverPage,
  TurnitinAIOverviewPage,
  TurnitinIntegrityOverviewPage,
  TurnitinTopSourcesPage,
} from './TurnitinOfficialPages';
import { TurnitinManuscriptPage } from './TurnitinManuscriptRenderer';
import { downloadReportPdf } from '../utils/pdfGenerator';
import { getReportPageLayout } from '../utils/reportPageLayout';
import {
  Download,
  Loader2,
  FileCheck,
  Bot,
  ChevronLeft,
  ChevronRight,
  Printer,
  Sparkles,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';

interface TurnitinOfficialMultiPageReportProps {
  report: ScanReport;
  defaultType?: 'ai' | 'similarity';
  allowBothModes?: boolean;
}

export const TurnitinOfficialMultiPageReport: React.FC<TurnitinOfficialMultiPageReportProps> = ({
  report,
  defaultType = 'similarity',
  allowBothModes = false,
}) => {
  const [reportType, setReportType] = useState<'similarity' | 'ai'>(defaultType);
  const [currentPageView, setCurrentPageView] = useState<number | 'all'>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const currentLayout = getReportPageLayout(report, reportType);
  const totalPages = currentLayout.totalPages;
  const isLargeDocument = totalPages > 18;
  const pageWindowSize = totalPages > 40 ? 5 : 7;

  const simLayout = getReportPageLayout(report, 'similarity');
  const aiLayout = getReportPageLayout(report, 'ai');
  const canDownloadSimilarityReport = report.type === 'Plagiarism Check' || report.type === 'Both';
  const canDownloadAiReport = report.type === 'AI Detection' || report.type === 'Both';

  const handleDownload = async (typeToDownload: 'similarity' | 'ai') => {
    const prevView = currentPageView;
    const prevZoom = zoomLevel;
    const prevType = reportType;
    const targetLayout = getReportPageLayout(report, typeToDownload);

    try {
      setIsExporting(true);
      setExportProgress({ current: 1, total: targetLayout.totalPages });
      if (reportType !== typeToDownload) {
        setReportType(typeToDownload);
      }
      // Ensure all pages are in DOM and scale is 100% so html2canvas captures full pages without clipping
      setCurrentPageView('all');
      setZoomLevel(100);
      // Brief delay to allow React DOM repaint
      await new Promise(resolve => setTimeout(resolve, 400));
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      await downloadReportPdf(report, typeToDownload, (current, total) => {
        setExportProgress({ current, total });
      });
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setCurrentPageView(prevView);
      setZoomLevel(prevZoom);
      setReportType(prevType);
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const showAll = (!isLargeDocument && currentPageView === 'all') || isExporting;
  const anchorPageNumber = typeof currentPageView === 'number' ? currentPageView : 1;
  const visiblePages = showAll
    ? currentLayout.pages
    : currentLayout.pages.filter(page => {
        const start = Math.max(1, anchorPageNumber - Math.floor(pageWindowSize / 2));
        const end = Math.min(totalPages, anchorPageNumber + Math.ceil(pageWindowSize / 2));
        return page.pageNumber >= start && page.pageNumber <= end;
      });

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] text-slate-900 font-sans overflow-hidden select-text relative">
      {/* EXPORT OVERLAY WITH REALTIME PAGE COUNTER */}
      {isExporting && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 flex flex-col items-center gap-3 max-w-sm w-full mx-4 text-center">
            <Loader2 className="w-9 h-9 text-[#0066ff] animate-spin" />
            <div>
              <h4 className="font-bold text-sm text-slate-900">
                Generating Official Turnitin PDF
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                {exportProgress
                  ? `Capturing page ${exportProgress.current} of ${exportProgress.total} with exact colors and zero cuts...`
                  : 'Preparing document layout...'}
              </p>
            </div>
            {exportProgress && (
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mt-1">
                <div
                  className="bg-[#0066ff] h-full transition-all duration-200"
                  style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                />
              </div>
            )}
            <span className="text-[11px] text-slate-400 font-mono">
              Preserving all highlights, badges, and fonts
            </span>
          </div>
        </div>
      )}

      {/* ACTION & NAVIGATION TOOLBAR */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs z-10">
        {/* Left: Report Type Tabs */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1 hidden sm:inline">
            Official Pattern:
          </span>

          {/* Integrity & Similarity Report Tab */}
          {(allowBothModes || report.type === 'Plagiarism Check') && <button
            onClick={() => {
              setReportType('similarity');
              setCurrentPageView('all');
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              reportType === 'similarity'
                ? 'bg-rose-50 text-rose-800 border border-rose-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
            <span>Similarity & Integrity Report ({simLayout.totalPages} Pages)</span>
          </button>}

          {/* AI Writing Report Tab */}
          {(allowBothModes || report.type === 'AI Detection') && <button
            onClick={() => {
              setReportType('ai');
              setCurrentPageView('all');
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              reportType === 'ai'
                ? 'bg-purple-50 text-purple-800 border border-purple-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-purple-600" />
            <span>AI Writing Report ({aiLayout.totalPages} Pages)</span>
          </button>}
        </div>

        {/* Center: Page Jump Navigation */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl text-xs font-medium">
          {!isLargeDocument && (allowBothModes || report.type === 'Plagiarism Check') && <button
            onClick={() => setCurrentPageView('all')}
            className={`px-2.5 py-1 rounded-lg transition ${
              currentPageView === 'all'
                ? 'bg-white text-slate-900 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Pages
          </button>}

          {!isLargeDocument && <div className="h-4 w-px bg-slate-300 mx-0.5" />}

          {(allowBothModes || report.type === 'AI Detection') && <button
            onClick={() => {
              const currentNumber = typeof currentPageView === 'number' ? currentPageView : 1;
              if (showAll && !isLargeDocument) {
                setCurrentPageView(totalPages);
              } else {
                setCurrentPageView(currentNumber <= 1 ? totalPages : currentNumber - 1);
              }
            }}
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition"
            title="Previous Page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>}

          <span className="px-1 text-slate-700 font-mono text-[11px] font-semibold">
            {showAll && !isLargeDocument ? `1 - ${totalPages}` : `${anchorPageNumber} of ${totalPages}`}
          </span>

          <button
            onClick={() => {
              const currentNumber = typeof currentPageView === 'number' ? currentPageView : 1;
              if (showAll && !isLargeDocument) {
                setCurrentPageView(1);
              } else {
                setCurrentPageView(currentNumber >= totalPages ? 1 : currentNumber + 1);
              }
            }}
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition"
            title="Next Page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Download Actions & Zoom */}
        <div className="flex items-center gap-2">
          {/* Zoom buttons */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs text-slate-600 mr-2">
            <button
              onClick={() => setZoomLevel(Math.max(70, zoomLevel - 10))}
              className="p-1 hover:text-slate-900 transition"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] px-1">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel(Math.min(130, zoomLevel + 10))}
              className="p-1 hover:text-slate-900 transition"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {canDownloadSimilarityReport && (
            <button
              onClick={() => handleDownload('similarity')}
              disabled={isExporting}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs active:scale-98 disabled:opacity-75 ${
                reportType === 'similarity'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
              title={`Download full ${simLayout.totalPages}-page Similarity & Integrity Report PDF`}
              id="btn-download-similarity-pdf"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Similarity PDF ({simLayout.totalPages}p)</span>
            </button>
          )}

          {canDownloadAiReport && (
            <button
              onClick={() => handleDownload('ai')}
              disabled={isExporting}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs active:scale-98 disabled:opacity-75 ${
                reportType === 'ai'
                  ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
              title={`Download full ${aiLayout.totalPages}-page AI Writing Report PDF`}
              id="btn-download-ai-pdf"
            >
              <Download className="w-3.5 h-3.5" />
              <span>AI Report PDF ({aiLayout.totalPages}p)</span>
            </button>
          )}

          {/* Print */}
          <button
            onClick={handlePrint}
            className="p-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
            title="Print report"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MULTI-PAGE DOCUMENT VIEWER CANVAS */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col items-center gap-8 bg-[#cbd5e1]/40">
        <div
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
          className="transition-transform duration-150 flex flex-col items-center gap-8 w-full max-w-4xl"
        >
          {visiblePages.map(page => {
            return (
              <div
                key={`page-node-${reportType}-${page.pageNumber}`}
                id={
                  reportType === 'ai'
                    ? `turnitin-page-node-ai-${page.pageNumber}`
                    : `turnitin-page-node-${page.pageNumber}`
                }
                className="turnitin-official-page-sheet w-full max-w-[800px] min-h-[1050px] bg-white shadow-xl rounded-sm border border-slate-300 relative overflow-hidden"
              >
                {page.type === 'cover' && (
                  <TurnitinCoverPage
                    report={report}
                    totalPages={totalPages}
                    mode={reportType}
                  />
                )}

                {page.type === 'integrity_overview' && (
                  <TurnitinIntegrityOverviewPage
                    report={report}
                    totalPages={totalPages}
                    mode={reportType}
                  />
                )}

                {page.type === 'ai_overview' && (
                  <TurnitinAIOverviewPage
                    report={report}
                    totalPages={totalPages}
                    mode={reportType}
                  />
                )}

                {page.type === 'top_sources' && (
                  <TurnitinTopSourcesPage
                    report={report}
                    pageNumber={page.pageNumber}
                    totalPages={totalPages}
                    sourcesSlice={page.sourcesSlice || []}
                    startIndex={page.startIndex || 0}
                    isFirstSourcePage={page.isFirstSourcePage}
                    mode={reportType}
                  />
                )}

                {page.type === 'manuscript' && (
                  <TurnitinManuscriptPage
                    report={report}
                    mode={reportType}
                    pageIndex={page.manuscriptIndex ?? 0}
                    pageNumber={page.pageNumber}
                    totalPages={totalPages}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
