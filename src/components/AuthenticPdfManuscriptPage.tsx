import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ScanReport } from '../types';
import { cleanBase64ToUint8Array } from '../utils/pdfPageRenderer';
import { DynamicTurnitinManuscriptPage } from '../utils/dynamicManuscriptEngine';
import { TurnitinPageHeader, TurnitinPageFooter } from './TurnitinOfficialPages';
import {
	computeHighlightsForPage,
	getHighlightTheme,
	DocHighlightBox,
	RawTextItem,
} from '../utils/authenticDocHighlighter';
import * as pdfjsLib from 'pdfjs-dist';

export interface AuthenticPdfManuscriptPageProps {
	report: ScanReport;
	mode: 'ai' | 'similarity';
	pageIndex: number;
	pageNumber: number;
	totalPages: number;
}

interface TextItemOverlay extends RawTextItem {}

export const AuthenticPdfManuscriptPage: React.FC<AuthenticPdfManuscriptPageProps> = ({
	report,
	mode,
	pageIndex,
	pageNumber,
	totalPages,
}) => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [loadError, setLoadError] = useState<boolean>(false);
	const [loading, setLoading] = useState<boolean>(true);
	const [textItems, setTextItems] = useState<TextItemOverlay[]>([]);
	const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);
	const [renderAreaSize, setRenderAreaSize] = useState<{ width: number; height: number } | null>(null);

	useEffect(() => {
		const renderArea = containerRef.current;
		if (!renderArea || typeof ResizeObserver === 'undefined') return;

		const observer = new ResizeObserver(([entry]) => {
			setRenderAreaSize({ width: entry.contentRect.width, height: entry.contentRect.height });
		});
		observer.observe(renderArea);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		let isMounted = true;
		if (!report.fileData) {
			setLoadError(true);
			setLoading(false);
			return;
		}

		async function renderPage() {
			try {
				setLoading(true);
				setLoadError(false);
				const bytes = cleanBase64ToUint8Array(report.fileData || '');
				if (!bytes.length) throw new Error('Invalid PDF byte buffer');

				const loadingTask = pdfjsLib.getDocument({ data: bytes, useSystemFonts: true });
				const pdf = await loadingTask.promise;
				const targetPageNum = pageIndex + 1;
				if (targetPageNum > pdf.numPages) {
					throw new Error(`Page ${targetPageNum} exceeds total pages ${pdf.numPages}`);
				}

				const page = await pdf.getPage(targetPageNum);
				const baseViewport = page.getViewport({ scale: 1 });
				const renderViewport = page.getViewport({ scale: 2 });
				if (!isMounted) return;

				setPageDimensions({ width: baseViewport.width, height: baseViewport.height });
				const canvas = canvasRef.current;
				const context = canvas?.getContext('2d');
				if (canvas && context) {
					canvas.width = renderViewport.width;
					canvas.height = renderViewport.height;
					await page.render({ canvasContext: context, viewport: renderViewport, canvas } as any).promise;
				}

				try {
					const textContent = await page.getTextContent();
					const overlays: TextItemOverlay[] = [];
					for (const item of textContent.items as any[]) {
						if (!item.str || !item.transform) continue;
						const [left, baseline] = baseViewport.convertToViewportPoint(item.transform[4], item.transform[5]);
						const fontSize = Math.sqrt(item.transform[0] ** 2 + item.transform[1] ** 2);
						overlays.push({
							str: item.str,
							left,
							top: Math.max(0, baseline - fontSize * 0.88),
							width: Math.max((item.width || 0) * baseViewport.scale, 4),
							height: Math.max(fontSize, 12),
							fontSize,
						});
					}
					if (isMounted) setTextItems(overlays);
				} catch (error) {
					console.warn('Text layer extraction notice:', error);
				}
				if (isMounted) setLoading(false);
			} catch (error) {
				console.warn('Authentic PDF page render failed:', error);
				if (isMounted) {
					setLoadError(true);
					setLoading(false);
				}
			}
		}

		void renderPage();
		return () => {
			isMounted = false;
		};
	}, [report.fileData, pageIndex]);

	const submissionId = report.submissionId || 'trn:oid:::2:445438161';
	const sectionTitle = mode === 'ai' ? 'AI Writing Submission' : 'Submission';

	const highlights = useMemo<DocHighlightBox[]>(() => {
		if (!pageDimensions || !textItems.length) return [];
		return computeHighlightsForPage(textItems, pageDimensions.width, pageDimensions.height, pageIndex, report, mode);
	}, [textItems, pageDimensions, pageIndex, report, mode]);

	const pageScale = pageDimensions && renderAreaSize
		? Math.min(1, renderAreaSize.width / pageDimensions.width, Math.max(0, renderAreaSize.height - 32) / pageDimensions.height)
		: 1;
	const displayedPageWidth = pageDimensions ? pageDimensions.width * pageScale : undefined;

	if (loadError || !report.fileData) {
		return (
			<DynamicTurnitinManuscriptPage
				report={report}
				mode={mode}
				pageIndex={pageIndex}
				pageNumber={pageNumber}
				totalPages={totalPages}
			/>
		);
	}

	return (
		<div
			className="turnitin-authentic-pdf-page relative flex h-full min-h-[960px] w-full flex-col justify-between bg-white p-6 font-sans text-slate-900 sm:p-10"
			style={{ boxSizing: 'border-box' }}
		>
			<TurnitinPageHeader pageNumber={pageNumber} totalPages={totalPages} sectionTitle={sectionTitle} submissionId={submissionId} mode={mode} />

			<div ref={containerRef} className="relative my-4 flex flex-1 items-center justify-center overflow-hidden bg-white py-2">
				{loading && (
					<div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80">
						<div className="flex items-center gap-2 text-xs text-slate-500">
							<div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
							<span>Rendering original document page {pageIndex + 1}...</span>
						</div>
					</div>
				)}

				<div
					className="relative max-w-full border border-slate-200/60 bg-white shadow-xs"
					style={{
						width: displayedPageWidth ? `${displayedPageWidth}px` : '100%',
						maxWidth: '100%',
						aspectRatio: pageDimensions ? `${pageDimensions.width} / ${pageDimensions.height}` : '8.5 / 11',
					}}
				>
					<canvas ref={canvasRef} className="block h-auto w-full" />

					{highlights.length > 0 && (
						<div className="pointer-events-none absolute inset-0 z-10 select-none overflow-hidden">
							{highlights.map(highlight => {
								if (!pageDimensions) return null;
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

					<div className="pointer-events-auto absolute inset-0 select-text overflow-hidden">
						{textItems.map((item, index) => {
							if (!pageDimensions) return null;
							return (
								<span
									key={`text-item-${index}`}
									className="absolute cursor-text whitespace-pre text-transparent selection:bg-blue-500/30"
									style={{
										left: `${(item.left / pageDimensions.width) * 100}%`,
										top: `${(item.top / pageDimensions.height) * 100}%`,
										width: `${(item.width / pageDimensions.width) * 100}%`,
										fontSize: `${item.fontSize * pageScale}px`,
										lineHeight: '1.1',
										userSelect: 'text',
									}}
								>
									{item.str}
								</span>
							);
						})}
					</div>
				</div>
			</div>

			<TurnitinPageFooter pageNumber={pageNumber} totalPages={totalPages} sectionTitle={sectionTitle} submissionId={submissionId} mode={mode} />
		</div>
	);
};
