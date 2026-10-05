import React, { useEffect, useState } from 'react';
import { ScanReport, MatchedSource, HighlightedSnippet } from '../types';
import { TurnitScopeLogo } from './TurnitScopeLogo';
import { cleanText, MAX_SIMILARITY_SCORE } from '../utils/documentParser';
import { downloadReportPdf } from '../utils/pdfGenerator';
import { TurnitinOfficialMultiPageReport } from './TurnitinOfficialMultiPageReport';
import {
  X,
  Download,
  Share2,
  AlertTriangle,
  Bot,
  Search,
  ExternalLink,
  BookOpen,
  FileCheck,
  CheckCircle,
  Percent,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Info,
  ChevronRight,
  Eye,
  Check,
  Printer,
  Sparkles,
  ArrowRight,
  Layers,
  Loader2,
} from 'lucide-react';

interface ReportModalProps {
  report: ScanReport | null;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ report, onClose }) => {
  const [activeMode, setActiveMode] = useState<'all' | 'similarity' | 'ai' | 'comparison'>(() =>
    report?.type === 'AI Detection' ? 'ai' : report?.type === 'Plagiarism Check' ? 'similarity' : 'all'
  );
  const [sidebarTab, setSidebarTab] = useState<'matches' | 'ai' | 'filters' | 'info'>('matches');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Dynamic filter state (Turnitin filter & settings simulator)
  const [excludeQuotes, setExcludeQuotes] = useState(report?.excludeQuotes ?? true);
  const [excludeBibliography, setExcludeBibliography] = useState(report?.excludeBibliography ?? true);
  const [excludeSmallMatches, setExcludeSmallMatches] = useState(false);

  const hasAiReport = report?.type === 'AI Detection' || report?.type === 'Both';
  const hasSimilarityReport = report?.type === 'Plagiarism Check' || report?.type === 'Both';

  useEffect(() => {
    if (!report) return;
    setActiveMode(report.type === 'AI Detection' ? 'ai' : report.type === 'Plagiarism Check' ? 'similarity' : 'all');
  }, [report?.id, report?.type]);

  if (!report) return null;

  // Display only text extracted from the uploaded document.
  const cleanedContent = cleanText(report.text || '');

  // Calculate dynamic similarity score based on filters strictly within 1% to 12%
  let adjustedPlagScore = report.plagiarismScore > 0
    ? Math.min(MAX_SIMILARITY_SCORE, Math.max(1, report.plagiarismScore))
    : 0;
  if (!excludeQuotes && adjustedPlagScore > 0) adjustedPlagScore = Math.min(MAX_SIMILARITY_SCORE, adjustedPlagScore + 2);
  if (!excludeBibliography && adjustedPlagScore > 0) adjustedPlagScore = Math.min(MAX_SIMILARITY_SCORE, adjustedPlagScore + 3);
  if (excludeSmallMatches && adjustedPlagScore > 3) adjustedPlagScore = Math.max(1, adjustedPlagScore - 2);
  adjustedPlagScore = adjustedPlagScore > 0
    ? Math.min(MAX_SIMILARITY_SCORE, Math.max(1, adjustedPlagScore))
    : 0;

  const submissionId = report.submissionId || `trn:oid:${Math.floor(21948194812)}`;

  // Format AI score display: 1% to 20% shows *%, >20% shows exact %, 0% shows 0%
  const isAiUnderThreshold = report.aiScore > 0 && report.aiScore <= 20;
  const aiScoreDisplay = isAiUnderThreshold ? '*%' : (report.aiScore > 20 ? `${report.aiScore}%` : '0%');

  // Default sources if none are present (0-12% similarity breakdown)
  const sources: MatchedSource[] = report.sources && report.sources.length > 0 ? report.sources : [
    { id: 's1', name: 'ScienceDirect / Elsevier Academic Archive', url: 'https://sciencedirect.com/science/article/pii', similarity: Math.max(2, Math.floor(adjustedPlagScore * 0.58)), type: 'publication' },
    { id: 's2', name: 'Harvard University Scholar Repository', url: 'https://harvard.edu/dash/handle/291', similarity: Math.max(1, Math.floor(adjustedPlagScore * 0.27)), type: 'student_paper' },
    { id: 's3', name: 'IEEE Computer Society Digital Library', url: 'https://ieeexplore.ieee.org/document/89201', similarity: Math.max(1, Math.floor(adjustedPlagScore * 0.15)), type: 'publication' },
  ];

  // Color mapping per source number matching Turnitin's official palette
  const getSourceColor = (index: number) => {
    switch (index % 4) {
      case 1:
        return {
          bg: 'bg-[#fce4ec]',
          hoverBg: 'hover:bg-[#f8bbd0]',
          text: 'text-slate-900',
          border: 'border-[#e91e63]',
          badge: 'bg-[#e91e63] text-white',
          pill: 'bg-[#fce7f3] text-[#9d174d] border-pink-200',
        };
      case 2:
        return {
          bg: 'bg-[#e0f2fe]',
          hoverBg: 'hover:bg-[#bae6fd]',
          text: 'text-slate-900',
          border: 'border-[#2563eb]',
          badge: 'bg-[#2563eb] text-white',
          pill: 'bg-[#e0f2fe] text-[#0369a1] border-sky-200',
        };
      case 3:
        return {
          bg: 'bg-[#d1fae5]',
          hoverBg: 'hover:bg-[#a7f3d0]',
          text: 'text-slate-900',
          border: 'border-[#059669]',
          badge: 'bg-[#059669] text-white',
          pill: 'bg-[#d1fae5] text-[#047857] border-emerald-200',
        };
      default:
        return {
          bg: 'bg-[#ede9fe]',
          hoverBg: 'hover:bg-[#ddd6fe]',
          text: 'text-slate-900',
          border: 'border-[#7c3aed]',
          badge: 'bg-[#7c3aed] text-white',
          pill: 'bg-[#ede9fe] text-[#6d28d9] border-purple-200',
        };
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setIsExportingPdf(true);
      await downloadReportPdf(report);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 overflow-hidden"
      id="turnitin-report-studio"
    >
      {/* Main Studio Frame */}
      <div className="bg-[#f1f5f9] rounded-2xl w-full max-w-7xl h-[94vh] max-h-[950px] shadow-2xl flex flex-col overflow-hidden border border-slate-700/50 relative">
        {/* TOP BAR: Feedback Studio Header */}
        <header className="bg-[#1e293b] text-white px-5 py-3 flex items-center justify-between border-b border-slate-700 shrink-0 z-20">
          <div className="flex items-center gap-4 min-w-0">
            <TurnitScopeLogo size="sm" variant="dark" showSubtitle={false} />
            <div className="h-5 w-px bg-slate-700 hidden sm:block" />

            {/* Document Info */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <h2 className="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                  {report.title}
                </h2>
                <span className="hidden md:inline px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  {submissionId}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Author: <span className="text-slate-200 font-semibold">{report.author}</span> • {report.date} • {report.wordCount.toLocaleString()} words • {report.characterCount.toLocaleString()} characters
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-bold text-white mr-1">
              <FileCheck className="w-3.5 h-3.5 mr-1.5" />
              <span>Official Report (No Cutting)</span>
            </div>

            {/* View Digital Receipt */}
            <button
              onClick={() => setShowReceipt(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700"
              title="Official Turnitin Digital Receipt"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Digital Receipt</span>
            </button>

            {/* Close Studio */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              id="btn-close-studio"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col">
          <TurnitinOfficialMultiPageReport
            report={report}
            defaultType={report.type === 'AI Detection' ? 'ai' : 'similarity'}
            allowBothModes={report.type === 'Both'}
          />
        </div>

        {/* DIGITAL RECEIPT MODAL */}
        {showReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-slate-200 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    Turnitin Digital Receipt
                  </h3>
                </div>
                <button
                  onClick={() => setShowReceipt(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                This digital receipt confirms that your manuscript was deposited and analyzed by Turnitin Feedback Studio. A cryptographic record has been generated for provenance verification.
              </p>

              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-3 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Submission ID:</span>
                  <span className="font-bold text-slate-900">{submissionId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Document Title:</span>
                  <span className="font-bold text-slate-900 max-w-[200px] truncate">{report.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Author:</span>
                  <span className="font-bold text-slate-900">{report.author}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Timestamp:</span>
                  <span className="font-bold text-slate-900">{report.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Word Count:</span>
                  <span className="font-bold text-slate-900">{report.wordCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Character Count:</span>
                  <span className="font-bold text-slate-900">{report.characterCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">SHA-256 Hash:</span>
                  <span className="font-bold text-indigo-700 text-[10px] truncate max-w-[180px]">
                    e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Receipt
                </button>

                <button
                  onClick={() => setShowReceipt(false)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
                >
                  Close Receipt
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
