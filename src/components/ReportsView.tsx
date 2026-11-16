import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ScanReport } from '../types';
import { downloadReportPdf } from '../utils/pdfGenerator';
import { clampSimilarityScore } from '../utils/documentParser';
import {
  Search,
  FileText,
  Trash2,
  Download,
  ChevronDown,
  Loader2,
  Bot,
  X,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { reports, deleteReport, setNotification, currentUser } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All Types');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [activeDownloadMenu, setActiveDownloadMenu] = useState<string | null>(null);

  const handleDownload = async (rep: ScanReport, mode: 'similarity' | 'ai') => {
    if (rep.status !== 'Completed') return;
    try {
      setDownloadingId(`${rep.id}-${mode}`);
      setActiveDownloadMenu(null);
      await downloadReportPdf(rep, mode, undefined, currentUser.name);
      setNotification({ message: 'Report PDF downloaded successfully.', type: 'success' });
    } catch (err) {
      console.error('PDF download error:', err);
      setNotification({
        message: 'Could not generate the report PDF. Please try again.',
        type: 'error',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredReports = (reports || []).filter(rep => {
    if (!rep) return false;
    const title = (rep.title || rep.fileName || '').toLowerCase();
    const author = (rep.author || '').toLowerCase();
    const query = (searchQuery || '').toLowerCase().trim();
    const matchesSearch = !query || title.includes(query) || author.includes(query);
    const matchesType =
      selectedType === 'All Types' || rep.type === selectedType;
    return matchesSearch && matchesType;
  });

  const renderReportActions = (rep: ScanReport, compact = false) => {
    const canDownloadSimilarity = rep.type === 'Plagiarism Check' || rep.type === 'Both';
    const canDownloadAi = rep.type === 'AI Detection' || rep.type === 'Both';
    const canDownload = rep.status === 'Completed';

    return (
      <div className={`relative flex items-center ${compact ? 'w-full justify-end gap-2' : 'justify-end gap-2'}`}>
        <div className="relative">
          <button
            type="button"
            onClick={() =>
              canDownload &&
              setActiveDownloadMenu(activeDownloadMenu === rep.id ? null : rep.id)
            }
            disabled={!canDownload || downloadingId?.startsWith(rep.id)}
            className={`inline-flex min-h-11 items-center justify-center rounded-xl p-2 text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 ${
              compact ? 'min-w-11 flex-1 gap-2 border border-slate-200 bg-white px-3 text-xs font-semibold' : 'min-w-11'
            }`}
            title={canDownload ? 'Download PDF report options' : 'Available after report processing completes'}
            aria-label={`Download report options for ${rep.title}`}
            aria-expanded={activeDownloadMenu === rep.id}
            aria-haspopup="menu"
          >
            {downloadingId?.startsWith(rep.id) ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
            ) : (
              <>
                <Download className="h-4 w-4" />
                {compact && <span>Download PDF</span>}
                {compact && <ChevronDown className="h-3.5 w-3.5" />}
              </>
            )}
          </button>

          {activeDownloadMenu === rep.id && (
            <div
              role="menu"
              className={`absolute right-0 z-30 w-56 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white py-1.5 text-left text-xs shadow-xl ${
                compact ? 'bottom-full mb-1' : 'top-full mt-1'
              }`}
            >
              <div className="border-b border-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Download Official PDF
              </div>
              {canDownloadSimilarity && (
                <button
                  role="menuitem"
                  onClick={() => handleDownload(rep, 'similarity')}
                  className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left font-medium text-slate-700 transition hover:bg-rose-50 hover:text-rose-800"
                >
                  <span className="h-2 w-2 rounded-full bg-rose-600" />
                  <span>Similarity Report (12 Pages)</span>
                </button>
              )}
              {canDownloadAi && (
                <button
                  role="menuitem"
                  onClick={() => handleDownload(rep, 'ai')}
                  className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left font-medium text-slate-700 transition hover:bg-purple-50 hover:text-purple-800"
                >
                  <Bot className="h-3 w-3 text-purple-600" />
                  <span>AI Writing Report (9 Pages)</span>
                </button>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => deleteReport(rep.id)}
          className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 ${
            compact ? 'border border-slate-200 bg-white' : ''
          }`}
          title="Delete report"
          aria-label={`Delete report ${rep.title}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12" id="reports-view">
      {/* Top Filter & Search Bar matching screenshot */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search reports..."
            aria-label="Search reports by title or author"
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-11 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            id="reports-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              aria-label="Clear report search"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="hidden w-full sm:block sm:w-auto">
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            aria-label="Filter reports by type"
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 sm:w-auto"
            id="filter-type"
          >
            <option value="All Types">All Types</option>
            <option value="AI Detection">AI Detection</option>
            <option value="Plagiarism Check">Plagiarism Check</option>
            <option value="Both">Both</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 sm:hidden" role="group" aria-label="Filter reports by type">
          {[
            { value: 'All Types', label: 'All Types' },
            { value: 'AI Detection', label: 'AI Detection' },
            { value: 'Plagiarism Check', label: 'Similarity' },
            { value: 'Both', label: 'Both' },
          ].map(option => {
            const isSelected = selectedType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedType(option.value)}
                aria-pressed={isSelected}
                className={`min-h-10 rounded-xl border px-3 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-3 px-1 text-xs text-slate-500" aria-live="polite">
        {filteredReports.length} {filteredReports.length === 1 ? 'report' : 'reports'}
        {searchQuery || selectedType !== 'All Types' ? ' found' : ''}
      </p>
      </div>

      {/* Reports Table matching screenshot */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {filteredReports.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
            <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <FileText className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {reports.length === 0 ? 'No reports yet' : 'No reports match your filters'}
            </p>
            <p className="max-w-xs px-4 text-xs text-slate-500">
              {reports.length === 0
                ? 'Completed reports will appear here.'
                : 'Try another search or report type.'}
            </p>
            {reports.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedType('All Types');
                }}
                className="mt-1 flex min-h-11 items-center rounded-xl px-4 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
          <div className="space-y-3 p-3 md:hidden">
            {filteredReports.map(rep => (
              <article key={rep.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-sm font-semibold text-slate-900">
                      {rep.title || rep.fileName}
                    </h2>
                    <p className="mt-1 truncate text-xs text-slate-500" title={rep.author}>
                      {rep.author || 'Unknown author'}
                    </p>
                  </div>
                  <span className="max-w-[42%] shrink-0 truncate rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600">
                    {rep.type}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Plagiarism</p>
                    <p className={`mt-1 text-sm font-bold ${
                      clampSimilarityScore(rep.plagiarismScore) > 20
                        ? 'text-rose-600'
                        : clampSimilarityScore(rep.plagiarismScore) > 10
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                    }`}>
                      {rep.type === 'AI Detection' ? '—' : `${clampSimilarityScore(rep.plagiarismScore)}%`}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">AI Score</p>
                    <p className={`mt-1 text-sm font-bold ${
                      rep.aiScore > 50
                        ? 'text-rose-600'
                        : rep.aiScore > 20
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                    }`}>
                      {rep.type === 'Plagiarism Check' ? '—' : `${rep.aiScore ?? 0}%`}
                    </p>
                  </div>
                  <p className="col-span-2 px-1 text-xs text-slate-500">
                    {rep.date}{rep.fileSize ? ` · ${rep.fileSize}` : ''}
                  </p>
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3">
                  {renderReportActions(rep, true)}
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-xs" id="all-reports-table">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-5">Title</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Plagiarism</th>
                  <th className="py-3 px-4">AI Score</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredReports.map(rep => {
                  return (
                    <tr key={rep.id} className="hover:bg-slate-50/60 transition group">
                      <td className="py-3.5 px-5 font-semibold text-slate-900 max-w-xs truncate">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="truncate">{rep.title}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 ml-6">
                          Author: {rep.author} • {rep.fileSize}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium text-[11px]">
                          {rep.type}
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
                          {rep.type === 'Plagiarism Check' ? '—' : `${rep.aiScore ?? 0}%`}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                        {rep.date}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">{renderReportActions(rep)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
};
