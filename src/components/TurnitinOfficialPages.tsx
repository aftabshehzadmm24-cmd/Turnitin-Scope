import React from 'react';
import { ScanReport, MatchedSource } from '../types';
import { clampSimilarityScore } from '../utils/documentParser';
import { formatAiScoreDisplay } from '../utils/aiScore';
import { getInstitutionName } from '../utils/institutionName';
import {
  Building2,
  Globe,
  BookOpen,
  GraduationCap,
  AlertCircle,
  FileCheck,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  FileText,
  Bot,
} from 'lucide-react';

/**
 * Official Turnitin Publication Icon (document with folded top-right corner and horizontal lines)
 */
export const TurnitinPublicationIcon: React.FC<{ className?: string; size?: number }> = ({
  className = 'w-3.5 h-3.5 text-slate-500',
  size = 14,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`shrink-0 ${className}`}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
  </svg>
);

/**
 * Authentic Turnitin Logo SVG matching official Turnitin brand mark (open document + curved swoosh arrow)
 */
export const TurnitinIcon: React.FC<{ className?: string; size?: number }> = ({
  className = '',
  size = 18,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 125 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 inline-block ${className}`}
  >
    <path
      d="M8.2 74.4L5.6 90.9h26.3C11.2 109.6 0 138.7 0 157.5c0 13.9 4.4 24.7 13.3 32.1 7.1 6 16.9 9.3 29.1 10.1l1.2.1V194l-.9-.2c-11.1-2.5-29.6-9.9-29.8-32.4-.1-16.8 17.2-48.2 37.2-61.4l-5.3 30.5h16.9l9.5-56-63-.1z"
      fill="#0096ff"
    />
    <path
      d="M24.6 0C15.9 0 8.8 7.1 8.7 15.7l-.6 44.2 9.1.1h9l.5-41.9h74.4l.5 113.5H77.8l-3.1 18.1h29.1c8.7 0 15.9-7.9 16-16.6L119.5 0H24.6z"
      fill="#0096ff"
    />
  </svg>
);

/**
 * Full Turnitin Brand Logo with exact official vector emblem, typography paths, and TM superscript
 */
export const TurnitinFullLogo: React.FC<{ className?: string; height?: number }> = ({
  className = '',
  height = 18,
}) => {
  return (
    <div
      className={`inline-flex items-center select-none shrink-0 ${className}`}
      style={{ height: `${height}px` }}
    >
      <svg
        height={height}
        viewBox="0 0 715 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto overflow-visible block"
      >
        {/* Blue Emblem */}
        <path
          d="M8.2 74.4L5.6 90.9h26.3C11.2 109.6 0 138.7 0 157.5c0 13.9 4.4 24.7 13.3 32.1 7.1 6 16.9 9.3 29.1 10.1l1.2.1V194l-.9-.2c-11.1-2.5-29.6-9.9-29.8-32.4-.1-16.8 17.2-48.2 37.2-61.4l-5.3 30.5h16.9l9.5-56-63-.1z"
          fill="#0096ff"
        />
        <path
          d="M24.6 0C15.9 0 8.8 7.1 8.7 15.7l-.6 44.2 9.1.1h9l.5-41.9h74.4l.5 113.5H77.8l-3.1 18.1h29.1c8.7 0 15.9-7.9 16-16.6L119.5 0H24.6z"
          fill="#0096ff"
        />

        {/* Wordmark (turnitin) in official brand color #003c46 */}
        <path
          d="M277.3 117c0 5.7-1.8 10.1-5.4 13.2-3.7 3.2-7.9 4.8-13.1 4.8-4 0-7.3-.9-9.8-2.8-2.5-1.9-4.4-4.4-5.5-7.5-1.2-3.2-1.8-6.8-1.8-10.7V68h-18.4v50.3c0 10.3 2.7 18.5 8.1 24.3 5.4 5.9 12.5 8.9 21.1 8.9 6.5 0 12.1-1.5 16.8-4.5 3.1-2 5.8-4.3 7.9-6.7v9.7h18.4V68h-18.4v49h.1zM349.7 66.3c-5.2 0-10.2 1.7-14.9 4.9-3.1 2.1-5.7 4.7-7.7 7.7V68h-18.6v82h18.6v-45.1c0-3.9 1-7.3 2.8-10.1 1.9-2.8 4.3-5.1 7.2-6.6 4.3-2.3 9-2.8 13.1-1.8 1.4.3 2.5.7 3.4 1.2l1.6.8 4.8-19.8-1-.5c-2.3-1.3-5.3-1.8-9.3-1.8zM429.9 70.9c-4.2-3.1-10-4.7-17.4-4.7-5.9 0-11.3 1.5-16.1 4.5-3.3 2-6.1 4.3-8.3 6.8v-9.7h-18.4v82H388v-49.3c0-3.1.8-6 2.5-8.6s4-4.7 6.9-6.3c2.9-1.6 6.2-2.4 10.1-2.4 4-.3 7 .3 9.2 1.9 2.2 1.5 3.7 3.6 4.6 6.4 1 2.9 1.4 6.1 1.4 9.8v48.6H441v-49.6c0-6.1-.8-11.8-2.4-16.9-1.6-5.2-4.5-9.4-8.7-12.5zM453.8 68h18.4v82h-18.4zM550.3 68h18.4v82h-18.4zM650.6 83.4c-1.6-5.2-4.6-9.4-8.7-12.5-4.2-3.1-10-4.7-17.4-4.7-5.9 0-11.3 1.5-16.1 4.5-3.3 2-6.1 4.3-8.3 6.8v-9.7h-18.4v82H600v-49.3c0-3.1.8-6 2.5-8.6s4-4.7 6.9-6.3c2.9-1.6 6.2-2.4 10.1-2.4 3.9-.3 7 .3 9.2 1.9 2.2 1.5 3.7 3.6 4.6 6.4 1 2.9 1.4 6.1 1.4 9.8v48.6H653v-49.6c0-6.2-.8-11.8-2.4-16.9zM193.4 47.8H175V68h-16.4v18H175v42.3l.1-.1c.9 15.7 8 21.8 24.6 21.8 5.4 0 8.4-.3 8.5-.3l1.3-.1v-16.9l-1.6.1s-3.5.3-5 .3c-7.9 0-9.5-1.8-9.5-10.8V85.9h18.4v-18h-18.4V47.8zM518.4 47.8H500V68h-16.4v18H500v42.3l.1-.1c.9 15.7 8 21.8 24.6 21.8 5.4 0 8.4-.3 8.5-.3l1.3-.1v-16.9l-1.6.1s-3.5.3-5 .3c-7.9 0-9.5-1.8-9.5-10.8V85.9h18.4v-18h-18.4V47.8z"
          fill="#003c46"
        />
        <circle cx="463" cy="44.9" r="9.4" fill="#003c46" />
        <circle cx="559.5" cy="44.9" r="9.4" fill="#003c46" />

        {/* TM Superscript Vector Shape */}
        <g fill="#003c46">
          {/* T */}
          <rect x="660" y="52" width="16" height="3.5" rx="0.5" />
          <rect x="666.2" y="52" width="3.6" height="17" rx="0.5" />
          {/* M */}
          <path d="M680 69V52h4.5l5.5 10.5 5.5-10.5h4.5v17h-3.6V56.5l-5 9.5h-2.8l-5-9.5V69H680z" />
        </g>
      </svg>
    </div>
  );
};

export const TurnitinLogoWithText: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const height = size === 'sm' ? 14 : size === 'lg' ? 24 : 18;
  return <TurnitinFullLogo height={height} />;
};

/**
 * Header shown on every official Turnitin page
 */
export const TurnitinPageHeader: React.FC<{
  pageNumber: number;
  totalPages: number;
  sectionTitle: string;
  submissionId: string;
  mode?: 'ai' | 'similarity';
  compact?: boolean;
}> = ({ pageNumber, totalPages, sectionTitle, submissionId, mode, compact = false }) => {
  const hideDivider = mode
    ? (mode === 'ai' ? pageNumber >= 3 : pageNumber >= 4)
    : false;

  return (
    <div
      className={`flex items-center justify-between ${compact ? 'text-[8px]' : 'text-[11px]'} text-slate-700 font-sans px-1 shrink-0 select-text`}
      style={{
        borderBottom: hideDivider ? 'none' : '1px solid rgb(241 245 249)',
        paddingBottom: hideDivider ? 0 : 10,
        marginBottom: hideDivider ? 0 : 24,
      }}
    >
      <div className="flex items-center gap-6">
        <TurnitinLogoWithText size="sm" />
        <span className={`text-slate-600 ${compact ? 'font-normal' : 'font-medium'}`}>
          Page {pageNumber} of {totalPages} - {sectionTitle}
        </span>
      </div>
      <div className={`text-slate-600 ${compact ? 'font-sans text-[7.5px]' : 'font-mono text-[10.5px]'}`}>
        Submission ID <span className={compact ? 'font-normal' : 'font-semibold'}>{submissionId}</span>
      </div>
    </div>
  );
};

/**
 * Footer shown on every official Turnitin page
 */
export const TurnitinPageFooter: React.FC<{
  pageNumber: number;
  totalPages: number;
  sectionTitle: string;
  submissionId: string;
  mode?: 'ai' | 'similarity';
  compact?: boolean;
}> = ({ pageNumber, totalPages, sectionTitle, submissionId, mode, compact = false }) => {
  const hideDivider = mode
    ? (mode === 'ai' ? pageNumber >= 3 : pageNumber >= 4)
    : false;

  return (
    <div
      className={`flex items-center justify-between ${compact ? 'text-[8px]' : 'text-[11px]'} text-slate-700 font-sans px-1 shrink-0 select-text`}
      style={{
        paddingTop: hideDivider ? 0 : 10,
        marginTop: hideDivider ? 0 : 24,
      }}
    >
      <div className="flex items-center gap-6">
        <TurnitinLogoWithText size="sm" />
        <span className={`text-slate-600 ${compact ? 'font-normal' : 'font-medium'}`}>
          Page {pageNumber} of {totalPages} - {sectionTitle}
        </span>
      </div>
      <div className={`text-slate-600 ${compact ? 'font-sans text-[7.5px]' : 'font-mono text-[10.5px]'}`}>
        Submission ID <span className={compact ? 'font-normal' : 'font-semibold'}>{submissionId}</span>
      </div>
    </div>
  );
};

/**
 * PAGE 1: COVER PAGE
 */
export const TurnitinCoverPage: React.FC<{
  report: ScanReport;
  totalPages: number;
  mode?: 'ai' | 'similarity';
}> = ({ report, totalPages, mode }) => {
  const submissionId = report.submissionId || 'trn:oid:::2:445438161';
  const authorInitials = report.author
    ? report.author
        .split(' ')
        .filter(Boolean)
        .map(n => n[0].toUpperCase())
        .join(' ')
    : 'A B';

  const institution = getInstitutionName(report.institution);
  const subDate = report.submissionDate || report.date || 'Sep 12, 2026, 3:50 PM GMT';
  const dlDate = report.downloadDate || 'Sep 12, 2026, 3:51 PM GMT';
  const manuscriptPages =
    report.pageCount || Math.max(1, totalPages - (mode === 'similarity' ? 3 : 2));

  return (
    <div className="flex flex-col justify-between h-full min-h-[960px] font-sans p-6 sm:p-10 text-slate-900 bg-white select-text">
      <TurnitinPageHeader
        pageNumber={1}
        totalPages={totalPages}
        sectionTitle="Cover Page"
        submissionId={submissionId}
        mode={mode}
      />

      <div className="mt-auto mb-10 pt-36 sm:pt-44 max-w-2xl w-full">
        {/* Author Initials & Document Title Block */}
        <div>
          <div className="text-[46px] sm:text-[52px] font-black text-[#1e2a3a] tracking-[-0.06em] leading-none">
            {authorInitials}
          </div>
          <h1 className="text-[16px] sm:text-[18px] font-bold text-slate-900 leading-[1.3] mt-3 max-w-[760px]">
            {report.fileName || report.title}
          </h1>

          <div className="mt-4 flex min-w-0 items-center gap-2 text-[13px] text-slate-600 font-normal">
            <GraduationCap className="h-4 w-4 text-slate-600 shrink-0" />
            <span className="min-w-0 break-words">{institution}</span>
          </div>
        </div>

        {/* Thin Divider Rule */}
        <hr className="border-t border-slate-200 mt-5 mb-5" />

        {/* Document Details Section */}
        <div>
          <h2 className="text-[13.5px] font-semibold text-slate-700 mb-4">
            Document Details
          </h2>

          <div className="flex justify-between items-start gap-8 text-[11px]">
            {/* Left Column: Details */}
            <div className="space-y-4 flex-1 max-w-md">
              <div>
                <span className="text-[10px] text-[#475569] font-medium block leading-none mb-1">
                  Submission ID
                </span>
                <span className="text-black font-normal leading-snug block break-all font-mono text-[10.5px]">
                  {submissionId}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#475569] font-medium block leading-none mb-1">
                  Submission Date
                </span>
                <span className="text-black font-normal leading-snug block">
                  {subDate}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#475569] font-medium block leading-none mb-1">
                  Download Date
                </span>
                <span className="text-black font-normal leading-snug block">
                  {dlDate}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#475569] font-medium block leading-none mb-1">
                  File Name
                </span>
                <span className="text-black font-normal leading-snug block break-all">
                  {report.fileName || report.title}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#475569] font-medium block leading-none mb-1">
                  File Size
                </span>
                <span className="text-black font-normal leading-snug block">
                  {report.fileSize || '248.9 KB'}
                </span>
              </div>
            </div>

            {/* Right Column: Pages, Words, Characters inside the short, compact gray shaded box positioned near the right side */}
            <div className="w-max shrink-0 self-start mr-10 bg-[#f0f3f6] border border-[#e2e6eb] rounded-2xl px-3 py-3.5 space-y-3.5 text-[11.5px] text-slate-800 font-medium shadow-none">
              <div className="leading-tight">
                {manuscriptPages} Pages
              </div>
              <div className="leading-tight">
                {report.wordCount.toLocaleString()} Words
              </div>
              <div className="leading-tight">
                {report.characterCount.toLocaleString()} Characters
              </div>
            </div>
          </div>
        </div>
      </div>

      <TurnitinPageFooter
        pageNumber={1}
        totalPages={totalPages}
        sectionTitle="Cover Page"
        submissionId={submissionId}
        mode={mode}
      />
    </div>
  );
};

/**
 * PAGE 2: AI WRITING OVERVIEW
 */
export const TurnitinAIOverviewPage: React.FC<{
  report: ScanReport;
  totalPages: number;
  mode?: 'ai' | 'similarity';
}> = ({ report, totalPages, mode = 'ai' }) => {
  const submissionId = report.submissionId || 'trn:oid:::1:9948210344';
  const rawAiScore = typeof report.aiScore === 'number' ? report.aiScore : 0;
  const aiMaskedZero = rawAiScore === 0 && Boolean(report.aiScoreMasked);
  let displayAiScore = rawAiScore;
  
  const isBelowThreshold = (displayAiScore <= 20 && displayAiScore >= 1) || aiMaskedZero;
  const isZero = displayAiScore === 0 && !aiMaskedZero;
  const aiAnnotations = report.snippets
    .filter(snippet => snippet.type === 'ai_generated')
    .map(snippet => snippet.text);
  const showAiGeneratedSummary = rawAiScore > 0 || aiAnnotations.length > 0;
  // Use original score for display to match official Turnitin format
  const scoreDisplay = formatAiScoreDisplay(rawAiScore, aiMaskedZero);

  return (
    <div
      className="flex flex-col justify-between h-full min-h-[960px] font-sans p-6 sm:p-10 text-slate-900 bg-white select-text"
    >
      <TurnitinPageHeader
        pageNumber={2}
        totalPages={totalPages}
        sectionTitle="AI-Writing Overview"
        submissionId={submissionId}
        mode={mode}
        compact
      />

      <div className="mb-auto max-w-4xl w-full">
        {/* Top Split: Detection headline vs Caution Box (Balanced width, tight line-height, equal vertical alignment) */}
        <div className="grid grid-cols-1 md:grid-cols-[1.12fr_1.28fr] gap-5 items-center" style={{ columnGap: displayAiScore >= 70 ? '10px' : '18px' }}>
          {/* Left: AI percentage and explanation */}
          <div className="flex flex-col justify-center gap-0" style={{ width: displayAiScore >= 70 ? '108%' : '100%' }}>
            <div style={{ lineHeight: '16px', margin: 0, padding: 0, width: displayAiScore >= 70 ? '108%' : '100%' }}>
              <h1
                className="p-0 m-0"
                style={{
                  fontFamily: '"Roboto Variable", Roboto, "Helvetica Neue", Helvetica, sans-serif',
                  fontSize: '15.5px',
                  fontWeight: 400,
                  lineHeight: '16px',
                  color: '#000000',
                  letterSpacing: 'normal',
                  margin: 0,
                  padding: 0,
                  display: 'inline-block',
                  WebkitFontSmoothing: 'antialiased',
                }}
              >
                {toBoldUnicode(isZero ? '0% detected as AI' : isBelowThreshold ? '*% detected as AI' : `${displayAiScore}% detected as AI`)}
              </h1>
            </div>
            <p className="m-0 p-0" style={{ marginTop: 1, display: 'block', fontFamily: "'Arial', 'Helvetica', sans-serif", fontSize: '10.5px', color: '#475569', lineHeight: '14px', width: displayAiScore >= 70 ? '108%' : '100%' }}>
              {isZero ? (
                <span className="font-normal" style={{ fontFamily: "'Arial', 'Helvetica', sans-serif", fontSize: '10.5px', display: 'block', color: '#475569', lineHeight: '14px' }}>
                  Our AI writing assessment detects text generated by AI tools. No text in this
                  submission was identified as AI generated.
                </span>
              ) : isBelowThreshold ? (
                <span className="font-normal" style={{ fontFamily: "'Arial', 'Helvetica', sans-serif", color: '#475569', lineHeight: '14px' }}>
                  AI detection includes the possibility of false positives. Although some text in
                  this submission is likely AI generated, scores below the 20% threshold are not
                  surfaced because they have a higher likelihood of false positives.
                </span>
              ) : rawAiScore === 0 ? (
                <span className="font-normal" style={{ fontFamily: "'Arial', 'Helvetica', sans-serif", fontSize: '10.5px', display: 'block', color: '#475569', lineHeight: '14px' }}>
                  Our AI writing assessment detects text generated by AI tools. No text in this
                  submission was identified as AI generated.
                </span>
              ) : (
                <span className="font-normal" style={{ fontFamily: "'Arial', 'Helvetica', sans-serif", color: '#475569', lineHeight: '14px', fontSize: '10.5px' }}>
                  The percentage indicates the combined amount of likely AI-generated text as well
                  as likely AI-generated text that was also likely revised by AI.
                </span>
              )}
            </p>
          </div>

          {/* Right: Caution Blue Box (wider in width, shorter in height, 3 lines of text, vertically aligned) */}
          <div className="bg-[#d9ecfa] border border-[#a2d2f5] rounded-lg px-3 py-2 space-y-1 shadow-none flex flex-col justify-center">
            <h3 className="text-[9px] font-normal text-black leading-snug">
              Caution: Review required.
            </h3>
            <p className="text-[7.5px] sm:text-[8px] text-black font-normal leading-[1.3]">
              It is essential to understand the limitations of AI detection before making decisions
              about a student’s work. We encourage you to learn more about Turnitin’s AI detection
              capabilities before using the tool.
            </p>
          </div>
        </div>

        {/* Thin Divider Rule */}
        <hr className="mt-3 border-slate-200" />

        {showAiGeneratedSummary && (
          <div className="mt-4 flex items-center gap-2 border-b border-slate-200 py-4">
            <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-white">
              <Bot className="h-2.5 w-2.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-normal leading-tight text-black">
                {aiAnnotations.length > 0 ? `${aiAnnotations.length} ` : ''}
                AI-generated {scoreDisplay}
              </p>
              <p className="mt-0.5 text-[7px] leading-tight text-slate-600">
                Likely generated or likely generated and revised by AI.
              </p>
            </div>
          </div>
        )}

        {/* Disclaimer Section (1-line gap below underline, increased font size by 2, 0 gap before sentence) */}
        <div className="mt-4 pt-3">
          <h2 className="text-[8px] font-normal text-black leading-none m-0 p-0">
            Disclaimer
          </h2>
          <p className="text-[5px] sm:text-[5.5px] text-slate-600 leading-[1.25] mt-1 p-0">
            Our AI writing assessment is designed to help educators identify text that might be prepared by a generative AI tool. Our AI writing assessment may not always be accurate<br />
            (it may misidentify writing that is likely human generated as AI generated and likely AI generated as human generated) so it should not be used as the sole basis for adverse actions against a student.<br />
            It takes further scrutiny and human judgment in conjunction with an organization's application of its specific academic policies to determine whether any academic misconduct has occurred.
          </p>
        </div>

        {/* Thin Divider Rule after Disclaimer with 1-line gap */}
        <hr className="mt-4 border-slate-200" />
      </div>

      <TurnitinPageFooter
        pageNumber={2}
        totalPages={totalPages}
        sectionTitle="AI-Writing Overview"
        submissionId={submissionId}
        mode={mode}
        compact
      />
    </div>
  );
};

/**
 * PAGE 2 of Similarity Report: INTEGRITY OVERVIEW / SIMILARITY OVERVIEW
 */
export const TurnitinIntegrityOverviewPage: React.FC<{
  report: ScanReport;
  totalPages: number;
  mode?: 'ai' | 'similarity';
}> = ({ report, totalPages, mode = 'similarity' }) => {
  const submissionId = report.submissionId || 'trn:oid:::2:445438161';
  const plagScore = Math.max(1, clampSimilarityScore(report.plagiarismScore || 1));
  const isLowSimilarityReport = mode === 'similarity' && plagScore < 9;
  const matchGroups = report.matchGroups || {
    notCitedOrQuoted: Math.max(1, Math.round(plagScore * 2.8)),
    notCitedOrQuotedScore: plagScore,
    missingQuotations: 0,
    missingCitation: 0,
    citedAndQuoted: 0,
  };

  const sourceDist = report.sourceDistribution || {
    internet: (report.sources || []).filter(source => source.type === 'internet').length,
    publications: (report.sources || []).filter(source => source.type === 'publication').length,
    studentPapers: (report.sources || []).filter(source => source.type === 'student_paper').length,
  };

  return (
    <div className="flex flex-col justify-between h-[1050px] font-sans p-6 sm:p-10 text-slate-900 bg-white select-text">
      <TurnitinPageHeader
        pageNumber={2}
        totalPages={totalPages}
        sectionTitle="Integrity Overview"
        submissionId={submissionId}
        mode={mode}
      />

      <div className="mt-2 flex-1 flex flex-col gap-4 max-w-3xl w-full">
        {/* Main Similarity Headline without extra space */}
        <div className="space-y-1">
          <h1 className={`${isLowSimilarityReport ? 'text-[23.7px] sm:text-[25.7px]' : 'text-[22.7px] sm:text-[24.7px]'} font-semibold text-[#0f172a] tracking-tight leading-tight m-0 p-0`}>
            {plagScore}% Overall Similarity
          </h1>
          <p className="text-[10.5px] text-slate-600 leading-normal m-0 p-0">
            The combined total of all matches, including overlapping sources, for each database.
          </p>
        </div>

        {/* Filtered from the Report — one line below Overall Similarity */}
        <div className="space-y-0 text-[11px] mt-3 pt-1">
          <div className="font-semibold text-slate-800 text-[14.5px]">Filtered from the Report</div>
          <div className="mt-[11px] space-y-[5px] text-[10.5px] text-slate-500 font-normal">
            <div className="flex items-center gap-1">
              <span aria-hidden="true" className="mt-0.5 h-0 w-0 border-y-[2px] border-y-transparent border-l-[3px] border-l-current" />
              <span>Bibliography</span>
            </div>
            <div className="flex items-center gap-1">
              <span aria-hidden="true" className="mt-0.5 h-0 w-0 border-y-[2px] border-y-transparent border-l-[3px] border-l-current" />
              <span>Quoted Text</span>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* TOP UNDERLINE (Border above Match Groups & Top Sources) */}
        {/* ---------------------------------------------------- */}
        <div className="border-t border-slate-200 pt-4" />

        {/* Two Columns: Match Groups & Top Sources enclosed within underlines */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Column 1: Match Groups */}
          <div className="space-y-4">
            <h3 className="text-[15.5px] font-bold text-slate-900 tracking-tight">
              Match Groups
            </h3>

            <div className="space-y-5 text-xs pt-1">
              {/* Not Cited or Quoted - Red with overlapping documents */}
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#d93829] flex items-center justify-center shrink-0 shadow-xs">
                  <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white">
                    <rect x="7.5" y="3.5" width="10" height="13" rx="1" fill="white" opacity="0.65" />
                    <rect x="4.5" y="6.5" width="10" height="13" rx="1" fill="white" />
                  </svg>
                </span>
                <div className="leading-snug">
                  <div className="font-bold text-black text-[11.5px]">
                    {matchGroups.notCitedOrQuoted} Not Cited or Quoted &nbsp;<span className="font-bold text-black">{matchGroups.notCitedOrQuotedScore ?? plagScore}%</span>
                  </div>
                  <div className="text-[10.5px] text-slate-500 mt-1">
                    Matches with neither in-text citation nor quotation marks
                  </div>
                </div>
              </div>

              {/* Missing Quotations - Orange with quotation marks */}
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#f58220] flex items-center justify-center shrink-0 shadow-xs">
                  <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white">
                    <path d="M4.5 17C3.5 16 3 14.8 3 13c0-3.5 2.5-6.5 6-8l.9 1.4C6.6 8.2 6 10.5 5.7 12c.5-.3 1.2-.4 1.9-.3 1.8.2 3.2 1.6 3.2 3.5 0 2-1.6 3.5-3.5 3.5-1 0-2.1-.5-2.8-1.7zm10 0c-1-1-1.5-2.2-1.5-4 0-3.5 2.5-6.5 6-8l.9 1.4c-3.3 1.8-3.9 4.1-4.2 5.6.5-.3 1.2-.4 1.9-.3 1.8.2 3.2 1.6 3.2 3.5 0 2-1.6 3.5-3.5 3.5-1 0-2.1-.5-2.8-1.7z" />
                  </svg>
                </span>
                <div className="leading-snug">
                  <div className="font-bold text-black text-[11.5px]">
                    {matchGroups.missingQuotations} Missing Quotations &nbsp;<span className="font-bold text-black">{matchGroups.missingQuotationsScore ?? 0}%</span>
                  </div>
                  <div className="text-[10.5px] text-slate-500 mt-1">
                    Matches that are still very similar to source material
                  </div>
                </div>
              </div>

              {/* Missing Citation - Yellow with 3 horizontal bars */}
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#fbb034] flex items-center justify-center shrink-0 shadow-xs">
                  <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white">
                    <rect x="4" y="6" width="16" height="2.2" rx="1.1" />
                    <rect x="4" y="10.9" width="16" height="2.2" rx="1.1" />
                    <rect x="4" y="15.8" width="16" height="2.2" rx="1.1" />
                  </svg>
                </span>
                <div className="leading-snug">
                  <div className="font-bold text-black text-[11.5px]">
                    {matchGroups.missingCitation} Missing Citation &nbsp;<span className="font-bold text-black">{matchGroups.missingCitationScore ?? 0}%</span>
                  </div>
                  <div className="text-[10.5px] text-slate-500 mt-1">
                    Matches that have quotation marks, but no in-text citation
                  </div>
                </div>
              </div>

              {/* Cited and Quoted - Green with Graduation Cap */}
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#2e7d32] flex items-center justify-center shrink-0 shadow-xs">
                  <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white">
                    <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
                  </svg>
                </span>
                <div className="leading-snug">
                  <div className="font-bold text-black text-[11.5px]">
                    {matchGroups.citedAndQuoted} Cited and Quoted &nbsp;<span className="font-bold text-black">{matchGroups.citedAndQuotedScore ?? 0}%</span>
                  </div>
                  <div className="text-[10.5px] text-slate-500 mt-1">
                    Matches with in-text citation present, but no quotation marks
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Top Sources Summary */}
          <div>
            <h3 className="text-[15.5px] font-bold text-slate-950 tracking-tight mb-2">
              Top Sources
            </h3>

            <div className="space-y-1.5 text-xs text-slate-900">
              <div className="flex items-center gap-2">
                <span className="font-bold w-8 text-right text-[12px] text-slate-950">{sourceDist.internet}</span>
                <Globe className="w-3.5 h-3.5 text-slate-700 shrink-0 ml-1" />
                <span className="text-[11.5px] font-semibold text-slate-900">Internet sources</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold w-8 text-right text-[12px] text-slate-950">{sourceDist.publications}</span>
                <BookOpen className="w-3.5 h-3.5 text-slate-700 shrink-0 ml-1" />
                <span className="text-[11.5px] font-semibold text-slate-900">Publications</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold w-8 text-right text-[12px] text-slate-950">{sourceDist.studentPapers}</span>
                <GraduationCap className="w-3.5 h-3.5 text-slate-700 shrink-0 ml-1" />
                <span className="text-[11.5px] font-semibold text-slate-900">Submitted works (Student Papers)</span>
              </div>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* BOTTOM UNDERLINE (Border below Match Groups & Top Sources) */}
        {/* ---------------------------------------------------- */}
        <div className="border-b border-slate-200 pb-2" />

        {/* Integrity Flags Section (Below lower underline) */}
        <div className="pt-2 flex-1 flex flex-col">
          <h3 className="text-[12.5px] font-bold text-slate-900 mb-2.5 tracking-tight">
            Integrity Flags
          </h3>

          <div className="flex gap-6 flex-1">
            <div className="flex-1">
              <div className="text-[11.5px] font-bold text-slate-900">
                0 Integrity Flags for Review
              </div>
              <div className="text-[10.5px] text-slate-500 mt-0.5 leading-normal">
                No suspicious text manipulations found.
              </div>
            </div>

            {/* Right Darker Blue Info Box with black text and further reduced font size */}
            <div className="flex-1 bg-[#d5ebf9] border border-[#85c6ea] rounded-xl px-3 pt-3.5 pb-3 text-[8.5px] space-y-1.5 leading-snug shadow-none text-black flex flex-col justify-start">
              <p className="font-normal text-black leading-snug">
                Our system's algorithms look deeply at a document for any inconsistencies that
                would set it apart from a normal submission. If we notice something strange, we flag
                it for you to review.
              </p>
              <p className="font-normal text-black leading-snug">
                A Flag is not necessarily an indicator of a problem. However, we'd recommend you
                focus your attention there for further review.
              </p>
            </div>
          </div>
        </div>
      </div>

      <TurnitinPageFooter
        pageNumber={2}
        totalPages={totalPages}
        sectionTitle="Integrity Overview"
        submissionId={submissionId}
        mode={mode}
      />
    </div>
  );
};

/**
 * Official Turnitin AI score display rule:
 * Scores between 1% and 20% must display as '*%' with no highlighted text.
 */
export function formatTurnitinAiScore(score: number, maskedZero = false): string {
  return formatAiScoreDisplay(score, maskedZero);
}

/**
 * Converts a plain ASCII string to Unicode Mathematical Bold characters.
 * Bold digits: 𝟎–𝟗 (U+1D7CE–U+1D7D7)
 * Bold uppercase: 𝐀–𝐙 (U+1D400–U+1D419)
 * Bold lowercase: 𝐚–𝐳 (U+1D41A–U+1D433)
 * Non-letter/digit characters (%, space, *) are passed through unchanged.
 */
export function toBoldUnicode(str: string): string {
  return Array.from(str).map(ch => {
    const code = ch.codePointAt(0)!;
    if (code >= 0x30 && code <= 0x39) {
      // digit 0–9 → 𝟎–𝟗
      return String.fromCodePoint(0x1D7CE + (code - 0x30));
    } else if (code >= 0x41 && code <= 0x5A) {
      // uppercase A–Z → 𝐀–𝐙
      return String.fromCodePoint(0x1D400 + (code - 0x41));
    } else if (code >= 0x61 && code <= 0x7A) {
      // lowercase a–z → 𝐚–𝐳
      return String.fromCodePoint(0x1D41A + (code - 0x61));
    }
    return ch;
  }).join('');
}

/**
 * Top Sources Color Palette — exact 4-colour cycle sampled from the official
 * Turnitin report (badge colour + matching pastel type-chip colour).
 */
export const TOP_SOURCE_PALETTE = [
  { badgeHex: '#CB1375', chipHex: '#FEDCE7', bg: 'bg-[#CB1375]' }, // 1 Magenta
  { badgeHex: '#215DC6', chipHex: '#D6E5FB', bg: 'bg-[#215DC6]' }, // 2 Blue
  { badgeHex: '#007445', chipHex: '#C1ECDF', bg: 'bg-[#007445]' }, // 3 Green
  { badgeHex: '#7432E7', chipHex: '#ECDFFE', bg: 'bg-[#7432E7]' }, // 4 Purple
] as const;

export const getBadgeColor = (index: number) => {
  const color = TOP_SOURCE_PALETTE[(index - 1) % TOP_SOURCE_PALETTE.length];
  return {
    badgeHex: color.badgeHex,
    chipHex: color.chipHex,
    bg: color.bg,
    text: 'text-white',
    light: color.chipHex,
    textColor: '#181818',
    tagBg: `text-[#181818]`,
    isUnderlined: false,
  };
};

/**
 * Single Top Sources row, matching the official report:
 * numbered pill + type chip on the first line, source name and right-aligned
 * percentage on the second line, hairline separator underneath.
 */
const TopSourceRow: React.FC<{ source: MatchedSource; index: number }> = ({ source, index }) => {
  const badge = getBadgeColor(index);
  const displaySim = source.similarity <= 1 ? '<1%' : `${clampSimilarityScore(source.similarity)}%`;
  const typeLabel =
    source.type === 'internet'
      ? 'Internet'
      : source.type === 'student_paper'
      ? 'Submitted works'
      : 'Publication';

  return (
    <div className="pt-4 pb-3" style={{ borderBottom: '1px solid #D9D9D9' }}>
      <div className="flex items-center gap-[9px]">
        <span
          className="inline-flex h-[23px] w-[37px] shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold leading-none tabular-nums text-white"
          style={{ backgroundColor: badge.badgeHex }}
        >
          {index}
        </span>
        <span
          className="inline-flex h-[23px] min-w-[109px] shrink-0 items-center justify-center rounded-full px-3 text-[11px] font-normal leading-none"
          style={{ backgroundColor: badge.chipHex, color: '#181818' }}
        >
          {typeLabel}
        </span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-6">
        <span className="min-w-0 truncate text-[12.5px] leading-none" style={{ color: '#181818' }}>
          {source.name}
        </span>
        <span className="shrink-0 text-[12.5px] leading-none tabular-nums" style={{ color: '#181818' }}>
          {displaySim}
        </span>
      </div>
    </div>
  );
};

/**
 * TOP SOURCES BREAKDOWN PAGES (Pages 3, 4, 5 of 12 or Page 3 of 7)
 */
export const TurnitinTopSourcesPage: React.FC<{
  report: ScanReport;
  pageNumber: number;
  totalPages: number;
  sourcesSlice: MatchedSource[];
  startIndex: number;
  isFirstSourcePage?: boolean;
  mode?: 'ai' | 'similarity';
}> = ({ report, pageNumber, totalPages, sourcesSlice, startIndex, isFirstSourcePage, mode = 'similarity' }) => {
  const submissionId = report.submissionId || 'trn:oid:::2:445438161';
  const matchGroups = report.matchGroups || {
    notCitedOrQuoted: 51,
    notCitedOrQuotedScore: 16,
    missingQuotations: 0,
    missingQuotationsScore: 0,
    missingCitation: 0,
    missingCitationScore: 0,
    citedAndQuoted: 0,
    citedAndQuotedScore: 0,
  };

  const sourceDist = report.sourceDistribution || {
    internet: (report.sources || []).filter(source => source.type === 'internet').length,
    publications: (report.sources || []).filter(source => source.type === 'publication').length,
    studentPapers: (report.sources || []).filter(source => source.type === 'student_paper').length,
  };

  return (
    <div className="flex flex-col justify-between h-full min-h-[960px] font-sans p-6 sm:p-10 text-slate-900 bg-white">
      <TurnitinPageHeader
        pageNumber={pageNumber}
        totalPages={totalPages}
        sectionTitle="Integrity Overview"
        submissionId={submissionId}
        mode={mode}
      />

      <div className="flex-1 pt-3 pb-2 flex flex-col justify-start">
        {isFirstSourcePage ? (
          /* Official Turnitin Page 3 Layout: Match Groups & Top Sources Summary on Top, Detailed List on Bottom */
          <div className="flex flex-col flex-1">
            {/* Top Half: 2-Column Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {/* Column 1: Match Groups */}
              <div className="space-y-3.5">
                <h3 className="text-[17px] font-bold text-black tracking-tight">
                  Match Groups
                </h3>

                <div className="space-y-4 text-xs pt-1">
                  {/* Not Cited or Quoted - Red with overlapping documents */}
                  <div className="flex items-center gap-2.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-[#d93829] flex items-center justify-center shrink-0 shadow-xs">
                      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white">
                        <rect x="7.5" y="3.5" width="10" height="13" rx="1" fill="white" opacity="0.65" />
                        <rect x="4.5" y="6.5" width="10" height="13" rx="1" fill="white" />
                      </svg>
                    </span>
                    <div className="leading-snug">
                      <div className="font-bold text-black text-[11px]">
                        {matchGroups.notCitedOrQuoted || 51} Not Cited or Quoted &nbsp;<span className="font-bold text-black">{clampSimilarityScore(matchGroups.notCitedOrQuotedScore ?? report.plagiarismScore ?? 1)}%</span>
                      </div>
                      <div className="text-[9.5px] text-slate-500 mt-1">
                        Matches with neither in-text citation nor quotation marks
                      </div>
                    </div>
                  </div>

                  {/* Missing Quotations - Orange with quotes */}
                  <div className="flex items-center gap-2.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-[#f58220] flex items-center justify-center shrink-0 shadow-xs">
                      <svg viewBox="0 0 24 24" className="w-2 h-2 fill-white">
                        <path d="M4.5 17C3.5 16 3 14.8 3 13c0-3.5 2.5-6.5 6-8l.9 1.4C6.6 8.2 6 10.5 5.7 12c.5-.3 1.2-.4 1.9-.3 1.8.2 3.2 1.6 3.2 3.5 0 2-1.6 3.5-3.5 3.5-1 0-2.1-.5-2.8-1.7zm10 0c-1-1-1.5-2.2-1.5-4 0-3.5 2.5-6.5 6-8l.9 1.4c-3.3 1.8-3.9 4.1-4.2 5.6.5-.3 1.2-.4 1.9-.3 1.8.2 3.2 1.6 3.2 3.5 0 2-1.6 3.5-3.5 3.5-1 0-2.1-.5-2.8-1.7z" />
                      </svg>
                    </span>
                    <div className="leading-snug">
                      <div className="font-bold text-black text-[11px]">
                        {matchGroups.missingQuotations} Missing Quotations &nbsp;<span className="font-bold text-black">{matchGroups.missingQuotationsScore ?? 0}%</span>
                      </div>
                      <div className="text-[9.5px] text-slate-500 mt-1">
                        Matches that are still very similar to source material
                      </div>
                    </div>
                  </div>

                  {/* Missing Citation - Yellow with 3 bars */}
                  <div className="flex items-center gap-2.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-[#fbb034] flex items-center justify-center shrink-0 shadow-xs">
                      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white">
                        <rect x="4" y="6" width="16" height="2.2" rx="1.1" />
                        <rect x="4" y="10.9" width="16" height="2.2" rx="1.1" />
                        <rect x="4" y="15.8" width="16" height="2.2" rx="1.1" />
                      </svg>
                    </span>
                    <div className="leading-snug">
                      <div className="font-bold text-black text-[11px]">
                        {matchGroups.missingCitation} Missing Citation &nbsp;<span className="font-bold text-black">{matchGroups.missingCitationScore ?? 0}%</span>
                      </div>
                      <div className="text-[9.5px] text-slate-500 mt-1">
                        Matches that have quotation marks, but no in-text citation
                      </div>
                    </div>
                  </div>

                  {/* Cited and Quoted - Green with Cap */}
                  <div className="flex items-center gap-2.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-[#2e7d32] flex items-center justify-center shrink-0 shadow-xs">
                      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white">
                        <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
                      </svg>
                    </span>
                    <div className="leading-snug">
                      <div className="font-bold text-black text-[11px]">
                        {matchGroups.citedAndQuoted} Cited and Quoted &nbsp;<span className="font-bold text-black">{matchGroups.citedAndQuotedScore ?? 0}%</span>
                      </div>
                      <div className="text-[9.5px] text-slate-500 mt-1">
                        Matches with in-text citation present, but no quotation marks
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 2: Top Sources Summary */}
              <div>
                <h3 className="text-[17px] font-bold text-black tracking-tight mb-2">
                  Top Sources
                </h3>

                <div className="space-y-1.5 text-xs text-slate-900">
                  <div className="flex items-center gap-2">
                    <span className="font-bold w-8 text-right text-[11.5px] text-slate-950">{sourceDist.internet}</span>
                    <Globe className="w-3.5 h-3.5 text-slate-700 shrink-0 ml-1" />
                    <span className="text-[11px] font-semibold text-slate-900">Internet sources</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold w-8 text-right text-[11.5px] text-slate-950">{sourceDist.publications}</span>
                    <BookOpen className="w-3.5 h-3.5 text-slate-700 shrink-0 ml-1" />
                    <span className="text-[11px] font-semibold text-slate-900">Publications</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold w-8 text-right text-[11.5px] text-slate-950">{sourceDist.studentPapers}</span>
                    <GraduationCap className="w-3.5 h-3.5 text-slate-700 shrink-0 ml-1" />
                    <span className="text-[11px] font-semibold text-slate-900">Submitted works (Student Papers)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* HORIZONTAL SEPARATOR LINE */}
            <div className="border-b border-slate-200 my-3.5" />

            {/* Bottom Half: Top Sources Detailed List (Full Width) */}
            <div className="space-y-2 flex-1">
              <div>
                <h3 className="text-[17px] font-bold text-black tracking-tight">
                  Top Sources
                </h3>
                <p className="text-[11px] font-normal mt-1" style={{ color: '#626262' }}>
                  The sources with the highest number of matches within the submission. Overlapping sources will not be displayed.
                </p>
              </div>

              <div className="pt-1">
                {sourcesSlice.map((s, idx) => (
                  <TopSourceRow
                    key={`${s.id}-${startIndex + idx + 1}`}
                    source={s}
                    index={startIndex + idx + 1}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Multi-page continuation of sources (Pages 4, 5, etc.) */
          <div className="flex-1 flex flex-col justify-start">
            <div className="pt-1">
              {sourcesSlice.map((s, idx) => (
                <TopSourceRow
                  key={`${s.id}-${startIndex + idx + 1}`}
                  source={s}
                  index={startIndex + idx + 1}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <TurnitinPageFooter
        pageNumber={pageNumber}
        totalPages={totalPages}
        sectionTitle="Integrity Overview"
        submissionId={submissionId}
        mode={mode}
      />
    </div>
  );
};

/**
 * Clean Vector Boxplot SVG Graphics for Figures 1, 2, and 3
 */
export const BoxplotFigure: React.FC<{
  type: 'inspection_time' | 'ufov' | 'self_rating';
}> = ({ type }) => {
  if (type === 'inspection_time') {
    return (
      <div className="w-full max-w-md mx-auto my-3 border border-slate-700 bg-white p-4 font-sans text-xs">
        <div className="text-center font-bold text-slate-900 mb-2">
          Day 2 Inspection Time by Condition
        </div>
        <svg viewBox="0 0 400 240" className="w-full h-auto">
          {/* Axes */}
          <line x1="50" y1="20" x2="50" y2="200" stroke="#000" strokeWidth="1" />
          <line x1="50" y1="200" x2="380" y2="200" stroke="#000" strokeWidth="1" />

          {/* Y Axis Ticks: 20 to 80 */}
          {[20, 30, 40, 50, 60, 70, 80].map(val => {
            const y = 200 - ((val - 20) / 60) * 170;
            return (
              <g key={val}>
                <line x1="45" y1={y} x2="50" y2={y} stroke="#000" strokeWidth="1" />
                <text x="40" y={y + 3} textAnchor="end" fontSize="9" fill="#000">
                  {val}
                </text>
              </g>
            );
          })}

          <text
            x="-110"
            y="15"
            transform="rotate(-90)"
            textAnchor="middle"
            fontSize="10"
            fill="#000"
          >
            Inspection Time (ms)
          </text>

          {/* Box 1: placebo */}
          {/* Whiskers */}
          <line x1="110" y1="180" x2="110" y2="125" stroke="#000" strokeDasharray="3,3" />
          <line x1="95" y1="180" x2="125" y2="180" stroke="#000" />
          <line x1="95" y1="125" x2="125" y2="125" stroke="#000" />
          {/* Box */}
          <rect x="85" y="145" width="50" height="25" fill="#e2e8f0" stroke="#000" strokeWidth="1" />
          <line x1="85" y1="160" x2="135" y2="160" stroke="#000" strokeWidth="2" />
          <text x="110" y="218" textAnchor="middle" fontSize="9" fill="#000">
            placebo
          </text>

          {/* Box 2: alcohol + caffeine */}
          <line x1="210" y1="165" x2="210" y2="80" stroke="#000" strokeDasharray="3,3" />
          <line x1="195" y1="165" x2="225" y2="165" stroke="#000" />
          <line x1="195" y1="80" x2="225" y2="80" stroke="#000" />
          <rect x="185" y="115" width="50" height="35" fill="#cbd5e1" stroke="#000" strokeWidth="1" />
          <line x1="185" y1="135" x2="235" y2="135" stroke="#000" strokeWidth="2" />
          {/* Outlier circle at 80 */}
          <circle cx="210" cy="30" r="3" fill="none" stroke="#000" strokeWidth="1" />
          <text x="210" y="218" textAnchor="middle" fontSize="9" fill="#000">
            alcohol + caffeine
          </text>

          {/* Box 3: alcohol */}
          <line x1="310" y1="170" x2="310" y2="60" stroke="#000" strokeDasharray="3,3" />
          <line x1="295" y1="170" x2="325" y2="170" stroke="#000" />
          <line x1="295" y1="60" x2="325" y2="60" stroke="#000" />
          <rect x="285" y="105" width="50" height="40" fill="#94a3b8" stroke="#000" strokeWidth="1" />
          <line x1="285" y1="125" x2="335" y2="125" stroke="#000" strokeWidth="2" />
          <text x="310" y="218" textAnchor="middle" fontSize="9" fill="#000">
            alcohol
          </text>

          <text x="210" y="235" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#000">
            Condition
          </text>
        </svg>
        <div className="text-center text-xs text-slate-800 mt-2 font-medium">
          Figure 1: Day 2 Inspection Time scores by condition
        </div>
      </div>
    );
  }

  if (type === 'ufov') {
    return (
      <div className="w-full max-w-md mx-auto my-3 border border-slate-700 bg-white p-4 font-sans text-xs">
        <div className="text-center font-bold text-slate-900 mb-2">
          Day 2 UFOV by Condition
        </div>
        <svg viewBox="0 0 400 240" className="w-full h-auto">
          <line x1="50" y1="20" x2="50" y2="200" stroke="#000" strokeWidth="1" />
          <line x1="50" y1="200" x2="380" y2="200" stroke="#000" strokeWidth="1" />

          {[50, 100, 150, 200].map(val => {
            const y = 200 - ((val - 50) / 150) * 170;
            return (
              <g key={val}>
                <line x1="45" y1={y} x2="50" y2={y} stroke="#000" strokeWidth="1" />
                <text x="40" y={y + 3} textAnchor="end" fontSize="9" fill="#000">
                  {val}
                </text>
              </g>
            );
          })}

          <text
            x="-110"
            y="15"
            transform="rotate(-90)"
            textAnchor="middle"
            fontSize="10"
            fill="#000"
          >
            UFOV Score
          </text>

          {/* Placebo */}
          <line x1="110" y1="180" x2="110" y2="120" stroke="#000" strokeDasharray="3,3" />
          <line x1="95" y1="180" x2="125" y2="180" stroke="#000" />
          <line x1="95" y1="120" x2="125" y2="120" stroke="#000" />
          <rect x="85" y="145" width="50" height="25" fill="#e2e8f0" stroke="#000" strokeWidth="1" />
          <line x1="85" y1="155" x2="135" y2="155" stroke="#000" strokeWidth="2" />
          <text x="110" y="218" textAnchor="middle" fontSize="9" fill="#000">
            placebo
          </text>

          {/* Alcohol + Caffeine */}
          <line x1="210" y1="175" x2="210" y2="70" stroke="#000" strokeDasharray="3,3" />
          <line x1="195" y1="175" x2="225" y2="175" stroke="#000" />
          <line x1="195" y1="70" x2="225" y2="70" stroke="#000" />
          <rect x="185" y="115" width="50" height="35" fill="#cbd5e1" stroke="#000" strokeWidth="1" />
          <line x1="185" y1="128" x2="235" y2="128" stroke="#000" strokeWidth="2" />
          <text x="210" y="218" textAnchor="middle" fontSize="9" fill="#000">
            alcohol + caffeine
          </text>

          {/* Alcohol */}
          <line x1="310" y1="170" x2="310" y2="55" stroke="#000" strokeDasharray="3,3" />
          <line x1="295" y1="170" x2="325" y2="170" stroke="#000" />
          <line x1="295" y1="55" x2="325" y2="55" stroke="#000" />
          <rect x="285" y="105" width="50" height="40" fill="#94a3b8" stroke="#000" strokeWidth="1" />
          <line x1="285" y1="130" x2="335" y2="130" stroke="#000" strokeWidth="2" />
          <text x="310" y="218" textAnchor="middle" fontSize="9" fill="#000">
            alcohol
          </text>

          <text x="210" y="235" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#000">
            Condition
          </text>
        </svg>
        <div className="text-center text-xs text-slate-800 mt-2 font-medium">
          Figure 2: Day 2 UFOV scores by condition
        </div>
      </div>
    );
  }

  // Self Rating Figure 3
  return (
    <div className="w-full max-w-md mx-auto my-3 border border-slate-700 bg-white p-4 font-sans text-xs">
      <div className="text-center font-bold text-slate-900 mb-2">
        Self-Rating of Intoxication by Condition
      </div>
      <svg viewBox="0 0 400 240" className="w-full h-auto">
        <line x1="50" y1="20" x2="50" y2="200" stroke="#000" strokeWidth="1" />
        <line x1="50" y1="200" x2="380" y2="200" stroke="#000" strokeWidth="1" />

        {[0, 1, 2, 3, 4, 5, 6].map(val => {
          const y = 200 - (val / 6) * 170;
          return (
            <g key={val}>
              <line x1="45" y1={y} x2="50" y2={y} stroke="#000" strokeWidth="1" />
              <text x="40" y={y + 3} textAnchor="end" fontSize="9" fill="#000">
                {val}
              </text>
            </g>
          );
        })}

        <text
          x="-110"
          y="15"
          transform="rotate(-90)"
          textAnchor="middle"
          fontSize="10"
          fill="#000"
        >
          Self-Rating Score
        </text>

        {/* Placebo */}
        <line x1="110" y1="200" x2="110" y2="135" stroke="#000" strokeDasharray="3,3" />
        <line x1="95" y1="200" x2="125" y2="200" stroke="#000" />
        <line x1="95" y1="135" x2="125" y2="135" stroke="#000" />
        <rect x="85" y="155" width="50" height="35" fill="#e2e8f0" stroke="#000" strokeWidth="1" />
        <line x1="85" y1="175" x2="135" y2="175" stroke="#000" strokeWidth="2" />
        <text x="110" y="218" textAnchor="middle" fontSize="9" fill="#000">
          placebo
        </text>

        {/* Alcohol + Caffeine */}
        <line x1="210" y1="160" x2="210" y2="80" stroke="#000" strokeDasharray="3,3" />
        <line x1="195" y1="160" x2="225" y2="160" stroke="#000" />
        <line x1="195" y1="80" x2="225" y2="80" stroke="#000" />
        <rect x="185" y="105" width="50" height="30" fill="#cbd5e1" stroke="#000" strokeWidth="1" />
        <line x1="185" y1="105" x2="235" y2="105" stroke="#000" strokeWidth="2" />
        <text x="210" y="218" textAnchor="middle" fontSize="9" fill="#000">
          alcohol + caffeine
        </text>

        {/* Alcohol */}
        <line x1="310" y1="130" x2="310" y2="45" stroke="#000" strokeDasharray="3,3" />
        <line x1="295" y1="130" x2="325" y2="130" stroke="#000" />
        <line x1="295" y1="45" x2="325" y2="45" stroke="#000" />
        <rect x="285" y="75" width="50" height="30" fill="#94a3b8" stroke="#000" strokeWidth="1" />
        <line x1="285" y1="105" x2="335" y2="105" stroke="#000" strokeWidth="2" />
        <text x="310" y="218" textAnchor="middle" fontSize="9" fill="#000">
          alcohol
        </text>

        <text x="210" y="235" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#000">
          Condition
        </text>
      </svg>
      <div className="text-center text-xs text-slate-800 mt-2 font-medium">
        Figure 3: Self-rated intoxication by condition
      </div>
    </div>
  );
};
