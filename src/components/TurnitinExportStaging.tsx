import React from 'react';
import { ScanReport } from '../types';
import {
  TurnitinCoverPage,
  TurnitinAIOverviewPage,
  TurnitinIntegrityOverviewPage,
  TurnitinTopSourcesPage,
} from './TurnitinOfficialPages';
import { TurnitinManuscriptPage } from './TurnitinManuscriptRenderer';
import { getReportPageLayout } from '../utils/reportPageLayout';

interface TurnitinExportStagingProps {
  report: ScanReport;
  mode: 'similarity' | 'ai';
}

export const TurnitinExportStaging: React.FC<TurnitinExportStagingProps> = ({
  report,
  mode,
}) => {
  const layout = getReportPageLayout(report, mode);

  return (
    <div className="turnitin-export-staging flex flex-col gap-0 bg-white text-slate-900 font-sans">
      {layout.pages.map(page => (
        <div
          key={`staging-p-${page.pageNumber}`}
          className="turnitin-official-page-sheet w-[800px] min-h-[1131px] bg-white relative overflow-hidden"
        >
          {page.type === 'cover' && (
            <TurnitinCoverPage
              report={report}
              totalPages={layout.totalPages}
              mode={mode}
            />
          )}

          {page.type === 'integrity_overview' && (
            <TurnitinIntegrityOverviewPage
              report={report}
              totalPages={layout.totalPages}
              mode={mode}
            />
          )}

          {page.type === 'ai_overview' && (
            <TurnitinAIOverviewPage
              report={report}
              totalPages={layout.totalPages}
              mode={mode}
            />
          )}

          {page.type === 'top_sources' && (
            <TurnitinTopSourcesPage
              report={report}
              pageNumber={page.pageNumber}
              totalPages={layout.totalPages}
              sourcesSlice={page.sourcesSlice || []}
              startIndex={page.startIndex || 0}
              isFirstSourcePage={page.isFirstSourcePage}
              mode={mode}
            />
          )}

          {page.type === 'manuscript' && (
            <TurnitinManuscriptPage
              report={report}
              mode={mode}
              pageIndex={page.manuscriptIndex ?? 0}
              pageNumber={page.pageNumber}
              totalPages={layout.totalPages}
            />
          )}
        </div>
      ))}
    </div>
  );
};
