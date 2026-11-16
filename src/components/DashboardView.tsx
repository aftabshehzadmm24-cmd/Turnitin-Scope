import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ScanMode } from '../types';
import { clampSimilarityScore, extractDocumentDataFromFile, ExtractedDocumentData } from '../utils/documentParser';
import { formatAiScoreDisplay } from '../utils/aiScore';
import { downloadReportPdf } from '../utils/pdfGenerator';
import {
  Bot,
  Search,
  ShieldCheck,
  UploadCloud,
  FileText,
  AlertTriangle,
  Sparkles,
  Plus,
  CheckCircle2,
  FileUp,
  BadgeCheck,
  CreditCard,
  KeyRound,
  Loader2,
  Download,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const {
    currentUser,
    reports,
    runScan,
    isScanning,
    setActiveTab,
    setNotification,
  } = useApp();

  const [selectedMode, setSelectedMode] = useState<ScanMode>('both');
  const [excludeBibliography, setExcludeBibliography] = useState(true);
  const [excludeQuotes, setExcludeQuotes] = useState(true);
  const [viewMode, setViewMode] = useState<'classic' | 'new' | null>(null);
  const [authorName, setAuthorName] = useState('');

  // File Upload State
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: string;
    docData?: ExtractedDocumentData;
  } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPreparingFile, setIsPreparingFile] = useState(false);
  const [preparingFileName, setPreparingFileName] = useState('');
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadReport = async (
    report: (typeof reports)[number],
    mode: 'similarity' | 'ai'
  ) => {
    if (report.status !== 'Completed' || downloadingReportId) return;
    const downloadId = `${report.id}-${mode}`;
    setDownloadingReportId(downloadId);
    try {
      await downloadReportPdf(report, mode, undefined, currentUser.name);
      setNotification({
        message: `${mode === 'ai' ? 'AI' : 'Similarity'} report PDF downloaded successfully.`,
        type: 'success',
      });
    } catch (error) {
      console.error('Report PDF download failed:', error);
      setNotification({
        message: 'Could not generate the report PDF. Please try again.',
        type: 'error',
      });
    } finally {
      setDownloadingReportId(null);
    }
  };

  const currentCost = 1;
  const isPlanExpired = typeof currentUser.planExpiresAt === 'number' && Date.now() >= currentUser.planExpiresAt;
  const hasSufficientCredits = !isPlanExpired && currentUser.credits >= currentCost;

  const creditSummary = [
    { label: 'Available', value: currentUser.credits },
    { label: 'Used', value: currentUser.usedCredits ?? 0 },
  ];

  // Handle file selection
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);

    setUploadError(null);
    setIsPreparingFile(true);
    setPreparingFileName(file.name);

    try {
      const docData = await extractDocumentDataFromFile(file);
      setUploadError(null);
      setUploadedFile({
        name: file.name,
        size: `${sizeInMB} MB`,
        docData,
      });
    } catch (err) {
      console.error('File parsing error:', err);
      setUploadedFile(null);
      setUploadError(err instanceof Error ? err.message : 'Unable to read this document. Please upload a valid DOCX, PDF, or TXT file.');
    } finally {
      setIsPreparingFile(false);
      setPreparingFileName('');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Trigger analysis
  const handleAnalyze = async () => {
    const fileName = uploadedFile ? uploadedFile.name : 'Untitled_Document.docx';
    const content = uploadedFile?.docData?.text || '';

    if (!uploadedFile?.docData?.text) {
      setUploadError('Please upload a readable document before starting the analysis.');
      return;
    }

    if (isPreparingFile) return;

    if (viewMode === 'classic' && !authorName.trim()) {
      setUploadError('Enter the author name before starting the Classic report analysis.');
      return;
    }

    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
    const PLAG_WORD_LIMIT = 60_000;
    const AI_WORD_LIMIT = 30_000;

    // Block if document exceeds plagiarism limit
    if (wordCount > PLAG_WORD_LIMIT) {
      setUploadError(
        `This document has approximately ${wordCount.toLocaleString()} words, which exceeds the ${PLAG_WORD_LIMIT.toLocaleString()}-word limit for plagiarism analysis. Please upload a shorter document.`
      );
      return;
    }

    // Derive effective scan mode:
    // - New View or Classic View selected → 'plagiarism'
    // - AI Detection only → 'ai'
    // - A View + AI Detection together → 'both' (similarity + AI)
    // - Nothing selected → fall back to selectedMode state
    const wantsBoth = (viewMode === 'new' || viewMode === 'classic') && selectedMode === 'ai';

    let effectiveMode: ScanMode =
      viewMode === 'new' || viewMode === 'classic'
        ? wantsBoth
          ? 'both'
          : 'plagiarism'
        : selectedMode;

    // If doc exceeds AI word limit but AI was requested → downgrade to plagiarism only + notify
    let aiSkippedDueToLength = false;
    if ((effectiveMode === 'both' || effectiveMode === 'ai') && wordCount > AI_WORD_LIMIT) {
      if (effectiveMode === 'both') {
        effectiveMode = 'plagiarism';
      } else {
        // Pure AI scan requested but doc too long — block
        setUploadError(
          `AI detection requires documents under ${AI_WORD_LIMIT.toLocaleString()} words. This document has approximately ${wordCount.toLocaleString()} words. Please upload a shorter document or switch to Plagiarism Check only.`
        );
        return;
      }
      aiSkippedDueToLength = true;
    }

    setUploadedFile(null);
    setUploadError(null);

    // Show AI-skipped notification before scan starts
    if (aiSkippedDueToLength) {
      setNotification({
        message: `AI detection skipped — this document exceeds the ${AI_WORD_LIMIT.toLocaleString()}-word AI analysis limit (~${wordCount.toLocaleString()} words). Running plagiarism check only.`,
        type: 'info',
      });
    }

    await runScan({
      fileName,
      mode: effectiveMode,
      authorFirst: viewMode === 'classic' && authorName.trim() ? authorName.trim() : currentUser.name,
      classicAuthor: viewMode === 'classic' ? authorName.trim() : undefined,
      ownerName: currentUser.name,
      reportStyle: viewMode ?? undefined,
      excludeBibliography,
      excludeQuotes,
      fileContent: content,
      fileData: uploadedFile?.docData?.fileData,
      fileMimeType: uploadedFile?.docData?.fileMimeType,
      sourceFileData: uploadedFile?.docData?.sourceFileData,
      sourceFileMimeType: uploadedFile?.docData?.sourceFileMimeType,
      sourceFileSize: uploadedFile?.docData?.sourceFileSize,
      htmlContent: uploadedFile?.docData?.htmlContent,
      htmlPages: uploadedFile?.docData?.htmlPages,
      pageCount: uploadedFile?.docData?.pageCount,
    });
  };

  return (
    <div className="space-y-5 pb-12 sm:space-y-7" id="dashboard-view">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 px-5 py-6 text-white shadow-lg shadow-indigo-950/10 sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-1/4 h-24 w-24 rounded-full bg-sky-300/10 blur-2xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-100">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Document workspace
            </div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              Welcome, {currentUser.firstName || currentUser.name.split(' ')[0]}
            </h2>
            <p className="mt-1.5 max-w-xl text-xs leading-5 text-indigo-100/80 sm:text-sm">
              Check your document for similarity and AI-written content, all in one place.
            </p>
          </div>
          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 sm:flex">
            <ShieldCheck className="h-6 w-6 text-indigo-100" aria-hidden="true" />
          </div>
        </div>
      </section>

      <div
        className="grid grid-cols-2 gap-3"
        id="client-credit-summary"
      >
        {creditSummary.map((item, index) => (
          <div key={item.label} className="group rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:text-[11px]">{item.label} credits</p>
              <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                index === 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
              }`}>
                {index === 0
                  ? <CreditCard className="h-4 w-4" aria-hidden="true" />
                  : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{item.value}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">{index === 0 ? 'Ready to use' : 'Scans completed'}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        {/* Main Upload / Configuration Card */}
        <div className="overflow-visible rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6" id="upload-panel-card">
        {/* Optional Checkboxes (Visible for Plagiarism or Both) */}

        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">Start a new scan</h2>
            <p className="mt-1 text-xs text-slate-500">Choose your report options, then add a document to analyze.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-700">
            <CreditCard className="h-3 w-3" aria-hidden="true" />
            {currentCost} credit per scan
          </span>
        </div>

        {/* Toolbar Row */}
        <div className="flex flex-wrap items-center gap-2 border-y border-slate-100 bg-slate-50/70 py-3">
          {/* Classic / New view — select one or none */}
          <button
            onClick={() => setViewMode(prev => prev === 'classic' ? null : 'classic')}
            className={`min-h-10 rounded-xl border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
              viewMode === 'classic'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            Classic
          </button>
          <button
            onClick={() => setViewMode(prev => prev === 'new' ? null : 'new')}
            className={`min-h-10 rounded-xl border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
              viewMode === 'new'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            New View
          </button>

          {/* AI Detection toggle — left side, after view buttons */}
          <div className="hidden h-6 w-px bg-slate-200 sm:block" />
          <button
            onClick={() => setSelectedMode(prev => prev === 'ai' ? 'plagiarism' : 'ai')}
            className={`flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30 ${
              selectedMode === 'ai'
                ? 'bg-rose-50 border-rose-300 text-rose-700'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            AI Detection
          </button>

          {/* Exclude options — only when a view is selected */}
          {viewMode !== null && (
            <>
              <div className="hidden h-6 w-px bg-slate-200 sm:block" />
              <label className="flex min-h-10 cursor-pointer select-none items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-slate-300">
                <input
                  type="checkbox"
                  checked={excludeBibliography}
                  onChange={e => setExcludeBibliography(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  id="check-exclude-bib"
                />
                Excl. Bibliography
              </label>
              <label className="flex min-h-10 cursor-pointer select-none items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-slate-300">
                <input
                  type="checkbox"
                  checked={excludeQuotes}
                  onChange={e => setExcludeQuotes(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  id="check-exclude-quotes"
                />
                Excl. Quotes
              </label>
            </>
          )}
        </div>


        {viewMode === 'classic' && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <label htmlFor="classic-author-name" className="text-xs font-medium text-slate-500 shrink-0">
              Author:
            </label>
            <input
              id="classic-author-name"
              type="text"
              value={authorName}
              onChange={event => setAuthorName(event.target.value)}
              onClick={event => event.stopPropagation()}
              placeholder=""
              className="min-w-0 flex-1 border-0 bg-transparent px-1 py-0.5 text-xs font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
            />
          </div>
        )}

        {/* Dropzone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Choose a PDF, DOCX, or TXT document to scan"
          className={`mt-4 flex min-h-[220px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/15 sm:min-h-[250px] sm:p-10 ${
            dragActive
              ? 'border-indigo-500 bg-indigo-50'
              : uploadedFile
              ? 'border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-white hover:border-indigo-400'
              : 'border-slate-200 bg-gradient-to-br from-slate-50 to-indigo-50/40 hover:border-indigo-400 hover:from-indigo-50/70 hover:to-white'
          }`}
          id="file-dropzone"
        >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />

            {isPreparingFile ? (
              <div className="flex w-full max-w-lg flex-col items-center gap-3 rounded-[2rem] border border-indigo-100 bg-gradient-to-b from-indigo-50/70 to-white px-4 py-5 sm:px-8">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-indigo-100">
                  <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-indigo-600" />
                  <FileUp className="h-6 w-6 text-indigo-600" strokeWidth={2.2} />
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-slate-900">Preparing your document</div>
                  <div className="mt-1 max-w-full truncate text-xs text-slate-500" title={preparingFileName}>{preparingFileName}</div>
                </div>
                <div className="w-full max-w-sm space-y-2">
                  <div className="h-2 overflow-hidden rounded-full bg-indigo-100/80">
                    <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-500" />
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-[10px] font-medium text-slate-400">
                    <span>Reading and rendering file</span>
                    <span className="text-indigo-500">Please wait...</span>
                  </div>
                </div>
              </div>
            ) : uploadedFile ? (
              <div className="flex flex-col items-center gap-2">
                <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100">
                  <FileText className="h-7 w-7" aria-hidden="true" />
                </div>
                <div className="max-w-full break-all text-sm font-bold text-slate-900">{uploadedFile.name}</div>
                <div className="text-xs text-slate-500">{uploadedFile.size} · Tap to replace</div>
                {(() => {
                  const wc = (uploadedFile.docData?.text || '').trim().split(/\s+/).filter(Boolean).length;
                  if (wc === 0) return null;
                  const overAi = wc > 30_000;
                  const overPlag = wc > 60_000;
                  return (
                    <div className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                      overPlag
                        ? 'bg-rose-100 text-rose-700'
                        : overAi
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      <span>~{wc.toLocaleString()} words</span>
                      {overPlag && <span>· exceeds 60k plag limit</span>}
                      {!overPlag && overAi && <span>· AI detection will be skipped</span>}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200">
                  <UploadCloud className="h-7 w-7" aria-hidden="true" />
                </div>
                <p className="mb-1 text-base font-bold tracking-tight text-slate-900">
                  Drop your document here
                </p>
                <p className="mb-4 text-xs text-slate-500">
                  or tap to browse files
                </p>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600">PDF</span>
                  <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600">DOCX</span>
                  <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600">TXT</span>
                </div>
              </>
            )}
          </div>

        {uploadError && (
          <div
            className="mt-3 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left"
            role="alert"
            aria-live="polite"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-rose-800">Document could not be added</p>
              <p className="mt-0.5 text-[11px] leading-5 text-rose-700">{uploadError}</p>
            </div>
          </div>
        )}

        {/* Warning banner: matches user screenshot */}
        {!hasSufficientCredits && (
          <div
            className="bg-red-50/80 border border-red-200/90 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-800"
            id="credits-limit-warning"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base shrink-0">⚠️</span>
              <div>
                <div>
                  <span className="font-semibold">
                    {isPlanExpired
                      ? 'Your plan has expired. Redeem a new purchase key to continue scanning.'
                      : `You have insufficient quota for this upload (${currentUser.credits}/${currentCost}).`}
                  </span>
                  {isPlanExpired && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('redeem')}
                      className="ml-2 font-bold text-red-700 underline underline-offset-2"
                    >
                      Redeem Code
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Bottom Actions: Analyze Button */}
        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          {/* Credits */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400">Cost:</span>
            <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
              {currentCost} cr
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400">Balance:</span>
            <span className={`font-bold ${hasSufficientCredits ? 'text-emerald-600' : 'text-rose-600'}`}>
              {currentUser.credits} cr
            </span>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={!hasSufficientCredits || isScanning || isPreparingFile || !uploadedFile?.docData?.text || (viewMode === null && selectedMode !== 'ai')}
            className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition-all shadow-md sm:w-auto ${
              hasSufficientCredits && !isScanning && (viewMode !== null || selectedMode === 'ai')
                ? 'bg-gradient-to-r from-[#4f46e5] to-[#6366f1] hover:from-[#4338ca] hover:to-[#4f46e5] text-white shadow-indigo-500/25 cursor-pointer active:scale-98'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            }`}
            id="btn-analyze"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>{isScanning ? 'Analyzing…' : 'Analyze document'}</span>
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm" id="recent-reports-section">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900">Recent reports</h2>
              <p className="mt-0.5 text-[10px] text-slate-500">Your latest document checks</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('reports')}
            className="inline-flex min-h-10 shrink-0 items-center rounded-xl border border-slate-200 px-3 text-xs font-semibold text-indigo-700 transition hover:border-indigo-200 hover:bg-indigo-50"
            id="link-view-all-reports"
          >
            View all <span className="ml-1" aria-hidden="true">→</span>
          </button>
        </div>

        {/* Content: Empty state or Table */}
        {reports.length === 0 ? (
          <div className="py-16 px-4 text-center flex flex-col items-center justify-center gap-3">
            <p className="text-xs text-slate-500 font-medium">
              No reports yet. Upload a document above to get started.
            </p>
          </div>
        ) : (
          <>
          <div className="space-y-3 p-3 md:hidden">
            {reports.slice(0, 5).map(rep => {
              const isDownloadingSimilarity = downloadingReportId === `${rep.id}-similarity`;
              const isDownloadingAi = downloadingReportId === `${rep.id}-ai`;
              const isReady = rep.status === 'Completed';
              const hasSimilarity = rep.type !== 'AI Detection';
              const hasAi = rep.type !== 'Plagiarism Check';

              return (
                <article key={rep.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-xs font-semibold text-slate-900" title={rep.title}>
                        {rep.title}
                      </h3>
                      {(rep.classicAuthor || rep.author) && (
                        <p className="mt-1 truncate text-[10px] text-slate-500">
                          Author: {rep.classicAuthor || rep.author}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
                      {rep.type}
                    </span>
                  </div>

                  <div className={`mt-3 grid gap-2 ${hasSimilarity && hasAi ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {hasSimilarity && (
                      <button
                        type="button"
                        onClick={() => void handleDownloadReport(rep, 'similarity')}
                        disabled={!isReady || downloadingReportId !== null}
                        title={isReady ? 'Download similarity report PDF' : 'Available after report processing completes'}
                        aria-label={`Download similarity report for ${rep.title}`}
                        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isDownloadingSimilarity ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        <span>Similarity PDF</span>
                      </button>
                    )}
                    {hasAi && (
                      <button
                        type="button"
                        onClick={() => void handleDownloadReport(rep, 'ai')}
                        disabled={!isReady || downloadingReportId !== null}
                        title={isReady ? 'Download AI report PDF' : 'Available after report processing completes'}
                        aria-label={`Download AI report for ${rep.title}`}
                        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-2 text-[11px] font-semibold text-purple-700 transition hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isDownloadingAi ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        <span>AI Report PDF</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-xs" id="recent-reports-table">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-5">Title</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Plagiarism</th>
                  <th className="py-3 px-4">AI Score</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-center">Similarity</th>
                  <th className="py-3 px-5 text-center">AI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {reports.slice(0, 5).map(rep => (
                  <tr key={rep.id} className="hover:bg-slate-50/60 transition group">
                    <td className="py-3.5 px-5 font-semibold text-slate-900 max-w-xs truncate">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="truncate">{rep.title}</span>
                      </div>
                      {(rep.classicAuthor || rep.author) && (
                        <div className="text-[10px] text-slate-400 mt-0.5 ml-5.5 truncate">
                          Author: <span className="text-slate-600 font-medium">{rep.classicAuthor || rep.author}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium text-[11px]">
                        {rep.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {rep.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`font-bold text-xs ${
                          clampSimilarityScore(rep.plagiarismScore) > 20
                            ? 'text-rose-600'
                            : clampSimilarityScore(rep.plagiarismScore) > 10
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {rep.type === 'AI Detection' ? '—' : `${clampSimilarityScore(rep.plagiarismScore)}%`}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`font-bold text-xs ${
                          rep.aiScore > 50
                            ? 'text-rose-600'
                            : rep.aiScore > 20
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {rep.type === 'Plagiarism Check' ? '—' : formatAiScoreDisplay(rep.aiScore ?? 0, Boolean(rep.aiScoreMasked))}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                      {rep.date}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {rep.type !== 'AI Detection' ? (
                        <button
                          type="button"
                          onClick={() => void handleDownloadReport(rep, 'similarity')}
                          disabled={rep.status !== 'Completed' || downloadingReportId !== null}
                          title={rep.status === 'Completed' ? 'Download similarity report PDF' : 'Available after report processing completes'}
                          aria-label={`Download similarity report for ${rep.title}`}
                          className="inline-flex rounded-md p-1 text-rose-600 hover:bg-rose-50 hover:text-rose-800 disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                          {downloadingReportId === `${rep.id}-similarity` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-center whitespace-nowrap">
                      {rep.type !== 'Plagiarism Check' ? (
                        <button
                          type="button"
                          onClick={() => void handleDownloadReport(rep, 'ai')}
                          disabled={rep.status !== 'Completed' || downloadingReportId !== null}
                          title={rep.status === 'Completed' ? 'Download AI report PDF' : 'Available after report processing completes'}
                          aria-label={`Download AI report for ${rep.title}`}
                          className="inline-flex rounded-md p-1 text-purple-600 hover:bg-purple-50 hover:text-purple-800 disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                          {downloadingReportId === `${rep.id}-ai` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
};

export const RedeemCodeView: React.FC = () => {
  const { currentUser, redeemPurchaseKey } = useApp();
  const [key, setKey] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  const expiryDate = currentUser.planExpiresAt
    ? new Date(currentUser.planExpiresAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: '2-digit',
      })
    : currentUser.planExpiry
      ? new Date(`${currentUser.planExpiry}T00:00:00`).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: '2-digit',
        })
      : 'No active expiry';

  const handleRedeem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isRedeeming || !key.trim()) return;

    setIsRedeeming(true);
    try {
      const wasRedeemed = await redeemPurchaseKey(key);
      if (wasRedeemed) setKey('');
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-5" id="redeem-code-view">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Redeem Activation Code</h2>
        <p className="mt-1 text-sm text-slate-500">Enter a purchase key to add credits to your account.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <KeyRound className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-900">Enter Your Purchase Key</h3>
          <p className="mt-1 text-sm text-slate-500">Your credits will be added immediately and your plan will be active for one month.</p>

          <form onSubmit={handleRedeem} className="mt-7 space-y-3 text-left">
            <label htmlFor="purchase-key-input" className="block text-xs font-semibold text-slate-700">Purchase key</label>
            <input
              id="purchase-key-input"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={32}
              required
              value={key}
              onChange={event => setKey(event.target.value.toUpperCase())}
              placeholder="TZ-XXXXX-XXXXX-XXXXX-XXXXX"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center font-mono text-sm uppercase tracking-widest text-slate-900 placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            />
            <button
              type="submit"
              disabled={isRedeeming || !key.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRedeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {isRedeeming ? 'Redeeming...' : 'Redeem Code'}
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <BadgeCheck className="h-4 w-4 text-emerald-600" />
          Your Current Status
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Current Credits</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{currentUser.credits}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Plan Expires</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{expiryDate}</p>
          </div>
        </div>
      </section>
    </div>
  );
};
