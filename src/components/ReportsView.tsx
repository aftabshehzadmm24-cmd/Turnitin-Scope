import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ScanReport } from '../types';
import { downloadReportPdf } from '../utils/pdfGenerator';
import {
  Search,
  Filter,
  FileText,
  Trash2,
  Download,
  Eye,
  ExternalLink,
  ChevronDown,
  Loader2,
  Bot,
} from 'lucide-react';

interface ReportsViewProps {
  onOpenReport: (report: ScanReport) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ onOpenReport }) => {
  const { reports, deleteReport } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All Status');
  const [selectedType, setSelectedType] = useState<string>('All Types');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [activeDownloadMenu, setActiveDownloadMenu] = useState<string | null>(null);

  const handleDownload = async (rep: ScanReport, mode: 'similarity' | 'ai') => {
    try {
      setDownloadingId(`${rep.id}-${mode}`);
      setActiveDownloadMenu(null);
      await downloadReportPdf(rep, mode);
    } catch (err) {
      console.error('PDF download error:', err);
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
    const matchesStatus =
      selectedStatus === 'All Status' || rep.status === selectedStatus;
    const matchesType =
      selectedType === 'All Types' || rep.type === selectedType;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="space-y-6 pb-12" id="reports-view">
      {/* Top Filter & Search Bar matching screenshot */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search reports..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            id="reports-search-input"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none font-medium cursor-pointer"
            id="filter-status"
          >
            <option value="All Status">All Status</option>
            <option value="Completed">Completed</option>
            <option value="Analyzing">Analyzing</option>
            <option value="Failed">Failed</option>
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none font-medium cursor-pointer"
            id="filter-type"
          >
            <option value="All Types">All Types</option>
            <option value="AI Detection">AI Detection</option>
            <option value="Plagiarism Check">Plagiarism Check</option>
            <option value="Both">Both</option>
          </select>

          <button
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2.5 rounded-xl text-xs transition"
            id="btn-filter"
          >
            Filter
          </button>
        </div>
      </div>

      {/* Reports Table matching screenshot */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        {filteredReports.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl text-slate-400 mb-1">
              📄
            </div>
            <p className="text-xs text-slate-400 font-medium">No reports found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" id="all-reports-table">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-5">Title</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Plagiarism</th>
                  <th className="py-3 px-4">AI Score</th>
                  <th className="py-3 px-4">Library</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-center">View</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredReports.map(rep => {
                  const canDownloadSimilarity = rep.type === 'Plagiarism Check' || rep.type === 'Both';
                  const canDownloadAi = rep.type === 'AI Detection' || rep.type === 'Both';

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
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          {rep.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`font-bold text-xs ${
                            rep.plagiarismScore > 20
                              ? 'text-rose-600'
                              : rep.plagiarismScore > 10
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {rep.type === 'AI Detection' ? '—' : `${Math.min(12, Math.max(0, rep.plagiarismScore))}%`}
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
                          {rep.type === 'Plagiarism Check' ? '—' : `${rep.aiScore}%`}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap text-[11px]">
                        Standard Repo
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                        {rep.date}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => onOpenReport(rep)}
                          className="text-indigo-600 hover:text-indigo-800 font-bold text-xs hover:underline inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2 relative">
                          {/* Download Menu Trigger */}
                          <div className="relative">
                            <button
                              onClick={() =>
                                setActiveDownloadMenu(
                                  activeDownloadMenu === rep.id ? null : rep.id
                                )
                              }
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="Download PDF report options"
                            >
                              {downloadingId && downloadingId.startsWith(rep.id) ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {activeDownloadMenu === rep.id && (
                              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 text-left text-xs animate-in fade-in duration-150">
                                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                  Download Official PDF
                                </div>
                                {canDownloadSimilarity && (
                                  <button
                                    onClick={() => handleDownload(rep, 'similarity')}
                                    className="w-full px-3 py-2 text-left hover:bg-rose-50 text-slate-700 hover:text-rose-800 font-medium flex items-center gap-2 transition"
                                  >
                                    <span className="w-2 h-2 rounded-full bg-rose-600" />
                                    <span>Similarity Report (12 Pages)</span>
                                  </button>
                                )}
                                {canDownloadAi && (
                                  <button
                                    onClick={() => handleDownload(rep, 'ai')}
                                    className="w-full px-3 py-2 text-left hover:bg-purple-50 text-slate-700 hover:text-purple-800 font-medium flex items-center gap-2 transition"
                                  >
                                    <Bot className="w-3 h-3 text-purple-600" />
                                    <span>AI Writing Report (9 Pages)</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => deleteReport(rep.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete report"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
