import { ScanReport, MatchedSource } from '../types';

export interface PageLayoutItem {
  pageNumber: number;
  type: 'cover' | 'integrity_overview' | 'ai_overview' | 'top_sources' | 'manuscript';
  sectionTitle: string;
  manuscriptIndex?: number;
  sourcesSlice?: MatchedSource[];
  startIndex?: number;
  isFirstSourcePage?: boolean;
}

export interface ReportLayoutPlan {
  totalPages: number;
  manuscriptCount: number;
  pages: PageLayoutItem[];
}

export function getReportPageLayout(
  report: ScanReport,
  mode: 'ai' | 'similarity'
): ReportLayoutPlan {
  const mCount = Math.max(1, report.pageCount || 1);

  const sources = report.sources || [];
  const coverPageCount = mode === 'ai' ? 2 : 3;

  if (mode === 'ai') {
    // AI report: exactly 2 pages before manuscript rendering (cover + AI overview)
    const pages: PageLayoutItem[] = [
      { pageNumber: 1, type: 'cover', sectionTitle: 'Cover Page' },
      { pageNumber: 2, type: 'ai_overview', sectionTitle: 'AI Writing Overview' },
      ...Array.from({ length: mCount }).map((_, idx) => ({
        pageNumber: 3 + idx,
        type: 'manuscript' as const,
        manuscriptIndex: idx,
        sectionTitle: 'AI Writing Submission',
      })),
    ];
    return { totalPages: coverPageCount + mCount, manuscriptCount: mCount, pages };
  } else {
    // Similarity report: exactly 3 pages before manuscript rendering (cover + integrity + source overview)
    const sourcesPages: PageLayoutItem[] = [];
    if (sources.length <= 10) {
      sourcesPages.push({
        pageNumber: 3,
        type: 'top_sources',
        sectionTitle: 'Top Sources',
        sourcesSlice: sources.slice(0, 10),
        startIndex: 0,
        isFirstSourcePage: true,
      });
    } else {
      // First page: 10 sources
      sourcesPages.push({
        pageNumber: 3,
        type: 'top_sources',
        sectionTitle: 'Top Sources',
        sourcesSlice: sources.slice(0, 10),
        startIndex: 0,
        isFirstSourcePage: true,
      });
      // Continuation pages: 11 sources per page
      let sIdx = 10;
      let pNum = 4;
      while (sIdx < sources.length) {
        const slice = sources.slice(sIdx, sIdx + 11);
        sourcesPages.push({
          pageNumber: pNum,
          type: 'top_sources',
          sectionTitle: 'Top Sources',
          sourcesSlice: slice,
          startIndex: sIdx,
          isFirstSourcePage: false,
        });
        sIdx += 11;
        pNum++;
      }
    }

    const totalCoverAndSourcePages = coverPageCount + sourcesPages.length - 1;
    const manuscriptStartPageNumber = totalCoverAndSourcePages + 1;

    const pages: PageLayoutItem[] = [
      { pageNumber: 1, type: 'cover', sectionTitle: 'Cover Page' },
      { pageNumber: 2, type: 'integrity_overview', sectionTitle: 'Integrity Overview' },
      ...sourcesPages,
      ...Array.from({ length: mCount }).map((_, idx) => ({
        pageNumber: manuscriptStartPageNumber + idx,
        type: 'manuscript' as const,
        manuscriptIndex: idx,
        sectionTitle: 'Submission',
      })),
    ];

    return {
      totalPages: totalCoverAndSourcePages + mCount,
      manuscriptCount: mCount,
      pages,
    };
  }
}

export function getReportPdfFileName(
  report: Pick<ScanReport, 'fileName' | 'title'>
): string {
  const uploadedName = (report.fileName || report.title || 'Turnitin Report')
    .split(/[\\/]/)
    .pop() || 'Turnitin Report';
  const baseName = uploadedName
    .replace(/\.[^.]+$/, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '') || 'Turnitin Report';

  return `${baseName}.pdf`;
}
