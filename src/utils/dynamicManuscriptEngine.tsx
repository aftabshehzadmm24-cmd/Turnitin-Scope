import React, { useMemo } from 'react';
import { ScanReport, MatchedSource } from '../types';
import {
  TurnitinPageHeader,
  TurnitinPageFooter,
  getBadgeColor,
} from '../components/TurnitinOfficialPages';
import {
  isTableOfContentsHeading,
  isTableOfContentsEntry,
  isTableOfContentsText,
  isTableHeadingOrCaption,
  isTableRowOrData,
  isTableText,
  isFigureOrGraphText,
  isMainHeadingText,
  isGlossaryOrTermTableText,
  isQuoteText,
  isBibliographyHeading,
  isCitationLine,
  isBibliographyOrReferenceText,
  isExcludedFromHighlighting,
  clampSimilarityScore,
  countWords,
  selectIndicesForWordShare,
  splitIntoSentences,
} from './documentParser';
import { getInstitutionName } from './institutionName';

export interface FormattedSegment {
  text: string;
  isPlagiarized?: boolean;
  sourceIndex?: number;
  isBlueUnderlined?: boolean;
  isAi?: boolean;
}

export interface FormattedParagraph {
  segments: FormattedSegment[];
  badges: number[];
  isAiParagraph?: boolean;
  isHeading?: boolean;
}

export interface ManuscriptPageData {
  pageIndex: number; // 0-based
  paragraphs: FormattedParagraph[];
  wordCount: number;
}

/**
 * Generates realistic, domain-tailored matched sources for any uploaded document.
 * Internet/publication counts follow the report's similarity band (1%–40%).
 */

// Publication database sources shown when the similarity score exceeds 8%.
const PUBLICATION_SOURCES = [
  { name: 'Elsevier ScienceDirect', url: 'https://www.sciencedirect.com', type: 'publication' as const },
  { name: 'Springer Nature', url: 'https://www.springernature.com', type: 'publication' as const },
  { name: 'Wiley Online Library', url: 'https://onlinelibrary.wiley.com', type: 'publication' as const },
  { name: 'SAGE Journals', url: 'https://journals.sagepub.com', type: 'publication' as const },
  { name: 'Oxford Academic', url: 'https://academic.oup.com', type: 'publication' as const },
  { name: 'Cambridge Core', url: 'https://www.cambridge.org/core', type: 'publication' as const },
  { name: 'IEEE Xplore', url: 'https://ieeexplore.ieee.org', type: 'publication' as const },
  { name: 'ACM Digital Library', url: 'https://dl.acm.org', type: 'publication' as const },
  { name: 'PLOS ONE', url: 'https://journals.plos.org/plosone', type: 'publication' as const },
  { name: 'Emerald Insight', url: 'https://www.emerald.com', type: 'publication' as const },
  { name: 'JSTOR', url: 'https://www.jstor.org', type: 'publication' as const },
  { name: 'Routledge', url: 'https://www.routledge.com', type: 'publication' as const },
  { name: 'Palgrave Macmillan', url: 'https://www.palgrave.com', type: 'publication' as const },
  { name: 'IGI Global', url: 'https://www.igi-global.com', type: 'publication' as const },
  { name: 'Nova Science Publishers', url: 'https://novapublishers.com', type: 'publication' as const },
  { name: 'American Psychological Association', url: 'https://www.apa.org', type: 'publication' as const },
  { name: 'BMJ Publishing Group', url: 'https://www.bmj.com', type: 'publication' as const },
  { name: 'The Lancet', url: 'https://www.thelancet.com', type: 'publication' as const },
  { name: 'New England Journal of Medicine', url: 'https://www.nejm.org', type: 'publication' as const },
  { name: 'Annual Reviews', url: 'https://www.annualreviews.org', type: 'publication' as const },
  { name: 'De Gruyter', url: 'https://www.degruyter.com', type: 'publication' as const },
  { name: 'Brill', url: 'https://brill.com', type: 'publication' as const },
  { name: 'World Scientific', url: 'https://www.worldscientific.com', type: 'publication' as const },
  { name: 'CABI Digital Library', url: 'https://www.cabi.org', type: 'publication' as const },
  { name: 'Harvard University Press', url: 'https://www.hup.harvard.edu', type: 'publication' as const },
  { name: 'MIT Press Direct', url: 'https://direct.mit.edu', type: 'publication' as const },
];

// 216 authentic internet domains used by Turnitin's internet database.
const INTERNET_SOURCE_DOMAINS = [
  'www.scribd.com',
  'digitalcommons.liberty.edu',
  'www.transtutors.com',
  'reference-global.com',
  'dn721700.ca.archive.org',
  'www.coursehero.com',
  'www.tandfonline.com',
  'www.easij.com',
  'dn760107.eu.archive.org',
  'journals.plos.org',
  'idvyorynw6xy.compat.objectstorage.us-ashburn-1.oraclecloud.com',
  'dn721605.ca.archive.org',
  'scholarpublishing.org',
  'ecsenet.com',
  'discovery.ucl.ac.uk',
  'ia801509.us.archive.org',
  'tesr.journals.ekb.eg',
  'www.ebsco.com',
  'www.longdom.org',
  'dn760001.eu.archive.org',
  'www.studocu.com',
  'www.glowm.com',
  'www.columbia.edu',
  'lomalindafertility.com',
  'archive.org',
  'www.youtube.com',
  'www.pearson.com',
  'en.wikipedia.org',
  'in.pinterest.com',
  'link.springer.com',
  'www.acog.org',
  'www.merckmanuals.com',
  'teachmeanatomy.info',
  'www.amboss.com',
  'dn760108.eu.archive.org',
  'www.mdpi.com',
  'www.studentsassignmenthelp.co.uk',
  'www.cedtech.net',
  'www.irjms.com',
  'europepmc.org',
  'dspace-backend.independentcolleges.ie',
  'shs.cairn.info',
  'viableinsights.com',
  'ulspace.ul.ac.za',
  'www.examquestionbank.com',
  'dspace.lib.cranfield.ac.uk',
  'dn760103.eu.archive.org',
  'openaccess.nhh.no',
  'projekter.aau.dk',
  'jurnal.itscience.org',
  'scholarworks.waldenu.edu',
  'repo-dosen.ulm.ac.id',
  'ap-st01.ext.exlibrisgroup.com',
  'digitalcommons.pepperdine.edu',
  'dergipark.org.tr',
  'iiari.org',
  'ajan.com.au',
  'pubmed.ncbi.nlm.nih.gov',
  'ia601605.us.archive.org',
  'ro.ecu.edu.au',
  'orca.cardiff.ac.uk',
  'soar.usa.edu',
  'ojs.aut.ac.nz',
  'www.linkedin.com',
  'pmc.ncbi.nlm.nih.gov',
  'www.science.gov',
  'ejurnal.methodist.ac.id',
  'www.richtmann.org',
  'researchportal.hkr.se',
  'www.inderscience.com',
  'ijariie.com',
  'www.ijbs.unimas.my',
  'wrap.warwick.ac.uk',
  'www.nature.com',
  'researchonline.ljmu.ac.uk',
  'www.flai.it',
  'corporatejustice.org',
  'www.perceptions.eu',
  'eurispes.eu',
  'www.lavoro.gov.it',
  'www.frontiersin.org',
  'i-claim.eu',
  'www.diplomacyandlaw.com',
  'www.right-to-education.org',
  'ams.overcastcdn.com',
  'tesi.luiss.it',
  'eea.iom.int',
  'esthinktank.com',
  'repository.gchumanrights.org',
  'www.bib.irb.hr',
  'ia903201.us.archive.org',
  'www.opensocietyfoundations.org',
  'www.mypryme.com',
  'iris.unipa.it',
  'pure.eur.nl',
  'books.ceapublishing.hu',
  'unigenius.co.uk',
  'www.consiglioveneto.it',
  'dn710208.ca.archive.org',
  'picum.org',
  'italy.iom.int',
  'repozytorium.kozminski.edu.pl',
  'eerstekamer.nl',
  'fra.europa.eu',
  'upr-info.org',
  'is.muni.cz',
  'nottingham-repository.worktribe.com',
  'arab-digital-economy.org',
  'www.amnesty.org',
  'www.ghrd.org',
  'dn710100.ca.archive.org',
  'www.lucisullavoro-dplonline.it',
  'ia600502.us.archive.org',
  'oa.inapp.gov.it',
  'dn711603.ca.archive.org',
  'univendspace.univen.ac.za',
  'www.sralab.org',
  'dn721709.ca.archive.org',
  'dspace.alquds.edu',
  'dn721801.ca.archive.org',
  'ntnuopen.ntnu.no',
  'www.blueprint.ai',
  'biccproceedings.org',
  'www.ohsu.edu',
  'dn721906.ca.archive.org',
  'researchspace.ukzn.ac.za',
  'www.nhsconfed.org',
  'pacfa.org.au',
  'www.icanotes.com',
  'pacja.org.au',
  'dar-al-shifaa.com',
  'dn790008.ca.archive.org',
  'dn721504.ca.archive.org',
  'www.sabiscareers.com',
  'ore.eu',
  'stats.oarc.ucla.edu',
  'dn760009.eu.archive.org',
  'www.fecos.nfkatzke.com',
  'exploration.stat.illinois.edu',
  'encord.com',
  'ourarchive.otago.ac.nz',
  'zealjournals.com',
  'ijebmr.com',
  'www.jriiejournal.com',
  'ir.jkuat.ac.ke',
  'distantreader.org',
  'pusdikra-publishing.com',
  'hh.diva-portal.org',
  'e-research.siam.edu',
  'etd.uum.edu.my',
  'econjournals.com',
  'eprints.usm.my',
  'repository.tml.nul.ls',
  'ijsab.com',
  'ukzn-dspace.ukzn.ac.za',
  'dn760106.eu.archive.org',
  'mc-caddogap.com',
  'aaltodoc.aalto.fi',
  'escholar.buse.ac.zw',
  'dspace.bu.ac.th',
  'www.nepjol.info',
  'www.allmultidisciplinaryjournal.com',
  'www.eelet.org.uk',
  'ir-library.ku.ac.ke',
  'ir.aamusted.edu.gh',
  'web.esenfc.pt',
  'dn760004.eu.archive.org',
  'su-plus.strathmore.edu',
  'www.managementpaper.net',
  'scholars.direct',
  'norma.ncirl.ie',
  'mbse.journals.ekb.eg',
  'ir.kiu.ac.ug',
  'www.researchgate.net',
  'ojs.unikom.ac.id',
  'www.crumplab.com',
  'thesis.unipd.it',
  'arrow.tudublin.ie',
  'yorkspace.library.yorku.ca',
  'essay.utwente.nl',
  'dn760105.eu.archive.org',
  'pubs.sciepub.com',
  'ia800100.us.archive.org',
  'core.ac.uk',
  'rafavsbastos.quarto.pub',
  'dspace.bracu.ac.bd',
  'www.refaad.com',
  'www.elsevier.es',
  'www.ajrsp.com',
  'docs.neu.edu.tr',
  't1t.net',
  'www.cemnet.com',
  'pdfs.semanticscholar.org',
  'dn721204.ca.archive.org',
  'digikogu.taltech.ee',
  'www.wsj.com',
  'file-thesis.pide.org.pk',
  'www.investing.com',
  'esj.eastasouth-institute.com',
  'journal.uir.ac.id',
  'cc.gov.pk',
  'dn760003.eu.archive.org',
  'www.golimelight.com',
  'dn720002.ca.archive.org',
  'www.speedbooks.co.uk',
  'era.ed.ac.uk',
  'www.exchange.jo',
  'www.gapinterdisciplinarities.org',
  'www.sciencepublishinggroup.com',
  'd9-wret.s3.us-west-2.amazonaws.com',
  'vtechworks.lib.vt.edu',
  'www.alphagenpro.com',
  'argaamplus.s3.amazonaws.com',
  'zmzm.sa',
  'www.ias.ac.in',
  'dn720005.ca.archive.org',
];

const DOMAIN_INTERNET_SOURCES = INTERNET_SOURCE_DOMAINS.map(domain => ({
  name: domain,
  url: `https://${domain}`,
  type: 'internet' as const,
}));

/**
 * Deterministically shuffles an array based on an integer seed.
 */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = Math.abs(seed) || 1;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Internet source count for a similarity band:
 * 1–4% → 3, 5–10% → 8, 11–20% → 13, 21–40% → 19.
 */
function getInternetSourceCount(score: number): number {
  if (score <= 4) return 3;
  if (score <= 10) return 8;
  if (score <= 20) return 13;
  return 19;
}

/**
 * Publication count for a similarity band:
 * ≤8% → 0, 9–20% → 1, 21–40% → 2.
 */
function getPublicationCount(score: number): number {
  if (score <= 8) return 0;
  if (score <= 20) return 1;
  return 2;
}

export function generateSourcesForDocument(
  fileName: string,
  title: string,
  plagiarismScore: number
): MatchedSource[] {
  const clampedPlag = clampSimilarityScore(plagiarismScore);
  if (clampedPlag <= 0) {
    return [];
  }

  // Derive a fresh seed from the title / fileName and current timestamp so every
  // scan picks a different random subset of the 216 domains.
  const inputStr = `${fileName}_${title}_${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < inputStr.length; i++) {
    hash = (hash << 5) - hash + inputStr.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash) + Math.floor(Math.random() * 10000);

  const internetCount = getInternetSourceCount(clampedPlag);
  const publicationCount = getPublicationCount(clampedPlag);

  const chosenInternet = seededShuffle(DOMAIN_INTERNET_SOURCES, seed + 101).slice(0, internetCount);
  const chosenPublications = seededShuffle(PUBLICATION_SOURCES, seed + 211).slice(0, publicationCount);

  // Internet sources first, then publications. Every listed source contributes at
  // least 1%, and any remaining similarity is spread with a decaying weight so the
  // top sources carry the largest share (overlapping matches may sum above the index).
  const chosen = [...chosenInternet, ...chosenPublications];
  const weights = chosen.map((_, index) => 1 / Math.pow(index + 1, 1.15));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const similarities = chosen.map(() => 1);

  const extra = clampedPlag - chosen.length;
  if (extra > 0) {
    let assigned = 0;
    for (let i = 0; i < chosen.length; i++) {
      const add = Math.floor((extra * weights[i]) / weightSum);
      similarities[i] += add;
      assigned += add;
    }
    let remainder = clampedPlag - chosen.length - assigned;
    for (let i = 0; remainder > 0; i++, remainder--) {
      similarities[i % chosen.length] += 1;
    }
  }

  return chosen
    .map((source, index) => ({
      name: source.name,
      url: source.url,
      similarity: similarities[index],
      type: source.type,
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .map((source, index) => ({ id: `src-${index + 1}`, ...source }));
}

/**
 * Paginates text cleanly into academic manuscript pages for an inserted document.
 * Strictly obeys:
 * - Plagiarism Similarity 1%–40% clamp.
 * - Exclude Quotes: Table of Contents & Quotes are excluded from plagiarism highlighting.
 * - Exclude Bibliography: References & Bibliography sections are excluded from plagiarism highlighting.
 */
export function paginateDocumentForTurnitin(
  report: ScanReport,
  mode: 'similarity' | 'ai'
): ManuscriptPageData[] {
  const isSimilarity = mode === 'similarity';
  const rawText = (report.text || '').trim();
  const title = report.title || report.fileName || 'Academic Manuscript';
  const excludeQuotes = report.excludeQuotes !== false;
  const excludeBibliography = report.excludeBibliography !== false;

  // Determine number of manuscript pages matching the uploaded document's actual page count.
  const targetManuscriptPages = Math.max(1, report.pageCount || 1);

  // Split into raw paragraphs
  let rawParagraphs = rawText
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 10);

  // If we have text but fewer paragraphs than pages, subdivide paragraphs by sentences so each page has real text
  if (rawParagraphs.length > 0 && rawParagraphs.length < targetManuscriptPages) {
    const subdivided: string[] = [];
    for (const p of rawParagraphs) {
      const sentences = p.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [p];
      if (sentences.length > 2 && subdivided.length + rawParagraphs.length <= targetManuscriptPages * 2) {
        const mid = Math.ceil(sentences.length / 2);
        subdivided.push(sentences.slice(0, mid).join('').trim());
        subdivided.push(sentences.slice(mid).join('').trim());
      } else {
        subdivided.push(p);
      }
    }
    rawParagraphs = subdivided;
  }

  // Never synthesize manuscript content when the uploaded document has no readable text.
  if (rawParagraphs.length === 0) {
    return [{
      pageIndex: 0,
      paragraphs: [{
        segments: [{ text: 'No readable document text is available for this page.' }],
        badges: [],
      }],
      wordCount: 0,
    }];
  }

  // Target paragraphs per page (usually 2-3 per page)
  const paragraphsPerPage = Math.max(2, Math.ceil(rawParagraphs.length / targetManuscriptPages));

  const plagScore = Math.max(1, clampSimilarityScore(report.plagiarismScore));
  const aiScore = Number.isFinite(report.aiScore)
    ? Math.min(100, Math.max(0, report.aiScore))
    : 0;

  // Track sentence index for consistent highlight assignment
  const sentenceList: {
    text: string;
    paraIdx: number;
    isToc: boolean;
    isQuote: boolean;
    isBib: boolean;
    isTable: boolean;
    isFigure: boolean;
    isHeading: boolean;
  }[] = [];
  let inBibSection = false;
  let inTocSection = false;
  let inTableBlock = false;
  let inFigureBlock = false;

  const splitParagraphs = rawParagraphs.map((paraText, pIdx) => {
    const trimmedPara = paraText.trim();
    // Check if paragraph is bibliography, TOC, Table, Figure, or Heading
    if (isBibliographyHeading(trimmedPara) || isBibliographyOrReferenceText(trimmedPara)) {
      inBibSection = true;
    }
    if (isTableOfContentsHeading(trimmedPara) || isTableOfContentsText(trimmedPara)) {
      inTocSection = true;
    } else if (
      inTocSection &&
      /^[0-9]+\.\s+[A-Za-z]/.test(trimmedPara) &&
      !trimmedPara.includes('....') &&
      !/\d+$/.test(trimmedPara)
    ) {
      // TOC section ended, body text started
      inTocSection = false;
    }

    if (isTableHeadingOrCaption(trimmedPara) || isTableText(trimmedPara)) {
      inTableBlock = true;
    } else if (
      inTableBlock &&
      (isMainHeadingText(trimmedPara) || /^\d+(\.\d+)*\.?\s+[A-Z]/.test(trimmedPara))
    ) {
      inTableBlock = false;
    }

    if (isFigureOrGraphText(trimmedPara)) {
      inFigureBlock = true;
    } else if (
      inFigureBlock &&
      (isMainHeadingText(trimmedPara) ||
        isTableHeadingOrCaption(trimmedPara) ||
        (trimmedPara.length >= 90 && /[.!?]/.test(trimmedPara)))
    ) {
      inFigureBlock = false;
    }

    const isHeading =
      isMainHeadingText(trimmedPara) ||
      /^[0-9]\.\s|^Abstract:|^Conclusion:|^References:|^References$|^Bibliography|^Figure\s[0-9]/i.test(
        paraText
      );
    const sentences = splitIntoSentences(paraText);
    const cleanedSentences = (sentences.length > 0 ? sentences : [paraText])
      .map(s => s.trim())
      .filter(s => s.length > 5);

    cleanedSentences.forEach(s => {
      const isBib =
        inBibSection ||
        isBibliographyHeading(s) ||
        isCitationLine(s) ||
        isBibliographyOrReferenceText(s) ||
        isBibliographyOrReferenceText(paraText);
      const isToc =
        inTocSection ||
        isTableOfContentsHeading(s) ||
        isTableOfContentsEntry(s) ||
        isTableOfContentsText(s) ||
        isTableOfContentsText(paraText);
      const isTable =
        inTableBlock ||
        isTableHeadingOrCaption(s) ||
        isTableRowOrData(s) ||
        isTableText(s) ||
        isTableText(paraText);
      const isFigure =
        inFigureBlock || isFigureOrGraphText(s) || isFigureOrGraphText(paraText);
      const isSentenceHeading =
        isHeading ||
        isMainHeadingText(s) ||
        isGlossaryOrTermTableText(s) ||
        isGlossaryOrTermTableText(paraText);
      const isQuote = isQuoteText(s);
      sentenceList.push({
        text: s,
        paraIdx: pIdx,
        isToc,
        isQuote,
        isBib,
        isTable: isTable || isGlossaryOrTermTableText(s) || isGlossaryOrTermTableText(paraText),
        isFigure,
        isHeading: isSentenceHeading,
      });
    });

    return {
      rawText: paraText,
      isHeading,
      sentences: cleanedSentences,
    };
  });

  const totalSentences = sentenceList.length;

  // Identify eligible candidate sentences for highlighting (AI and Similarity):
  // NEVER highlight TOC, Tables, Images, Graphs/Figures, References, or main headings.
  const eligibleIndices: number[] = [];
  for (let i = 0; i < totalSentences; i++) {
    const item = sentenceList[i];
    if (
      item.isToc ||
      item.isTable ||
      item.isBib ||
      item.isFigure ||
      item.isHeading ||
      isExcludedFromHighlighting(item.text)
    ) {
      continue;
    }
    if (excludeQuotes && item.isQuote) continue;
    eligibleIndices.push(i);
  }

  const aiHighlightedSentences = new Set<number>();
  if (!isSimilarity && aiScore > 20 && eligibleIndices.length > 0) {
    const wordCounts = eligibleIndices.map(index => countWords(sentenceList[index].text));
    selectIndicesForWordShare(wordCounts, aiScore).forEach(localIndex => {
      aiHighlightedSentences.add(eligibleIndices[localIndex]);
    });
  }

  const getPercentTarget = (score: number, total: number): number => {
    if (!Number.isFinite(score) || score <= 0 || total <= 0) return 0;
    return Math.max(1, Math.min(total, Math.ceil(total * (score / 100))));
  };

  const getExactCoveragePositions = (totalCandidates: number, targetCount: number): number[] => {
    if (!Number.isFinite(targetCount) || targetCount <= 0 || totalCandidates <= 0) return [];
    const safeTarget = Math.min(totalCandidates, Math.max(1, Math.round(targetCount)));
    const positions = new Set<number>();

    for (let i = 0; i < safeTarget; i++) {
      const pos = Math.min(
        totalCandidates - 1,
        Math.max(0, Math.round(((i + 0.5) * totalCandidates) / safeTarget))
      );
      positions.add(pos);
    }

    return Array.from(positions).sort((a, b) => a - b);
  };

  // Decide which complete sentences are highlighted for the clamped 1-40% similarity score.
  const plagTargetCount = plagScore > 0 && eligibleIndices.length > 0
    ? getPercentTarget(plagScore, eligibleIndices.length)
    : 0;

  const plagSentenceIndices = new Map<number, { sourceIndex: number; isBlue: boolean }>();

  if (plagTargetCount > 0 && eligibleIndices.length > 0) {
    const positions = getExactCoveragePositions(eligibleIndices.length, plagTargetCount);
    for (let i = 0; i < positions.length; i++) {
      const targetIdx = eligibleIndices[positions[i]];
      const srcIdx = (i % 4) + 1;
      const isBlue = srcIdx === 2;
      plagSentenceIndices.set(targetIdx, { sourceIndex: srcIdx, isBlue });
    }
  }

  // Build formatted paragraphs with segments
  let currentSentenceIndex = 0;
  const formattedParagraphs: FormattedParagraph[] = splitParagraphs.map(sp => {
    const segments: FormattedSegment[] = [];
    const badgesSet = new Set<number>();
    let paragraphSearchOffset = 0;

    sp.sentences.forEach(sText => {
      const sIdx = currentSentenceIndex++;
      const item = sentenceList[sIdx];
      const isExcluded =
        item?.isToc ||
        item?.isTable ||
        item?.isBib ||
        item?.isFigure ||
        item?.isHeading ||
        sp.isHeading ||
        isExcludedFromHighlighting(sText) ||
        isExcludedFromHighlighting(sp.rawText);

      const plagInfo = !isExcluded ? plagSentenceIndices.get(sIdx) : undefined;
      const sentenceStart = sp.rawText.indexOf(sText, paragraphSearchOffset);
      if (sentenceStart !== -1) paragraphSearchOffset = sentenceStart + sText.length;

      if (isSimilarity && plagInfo) {
        badgesSet.add(plagInfo.sourceIndex);
        segments.push({
          text: `${sText} `,
          isPlagiarized: true,
          sourceIndex: plagInfo.sourceIndex,
        });
      } else if (!isSimilarity && !isExcluded && aiScore > 20 && aiHighlightedSentences.has(sIdx)) {
        segments.push({
          text: `${sText} `,
          isAi: true,
        });
      } else {
        segments.push({
          text: sText + ' ',
        });
      }
    });

    return {
      segments,
      badges: Array.from(badgesSet).sort((a, b) => a - b),
      isHeading: sp.isHeading,
    };
  });

  // Distribute paragraphs into manuscript pages evenly
  const pages: ManuscriptPageData[] = [];
  const totalParas = formattedParagraphs.length;
  const parasPerBasePage = Math.floor(totalParas / targetManuscriptPages);
  const remainder = totalParas % targetManuscriptPages;

  let currentParaIdx = 0;
  for (let mIdx = 0; mIdx < targetManuscriptPages; mIdx++) {
    const count = parasPerBasePage + (mIdx < remainder ? 1 : 0);
    let pageParas = formattedParagraphs.slice(currentParaIdx, currentParaIdx + Math.max(1, count));
    currentParaIdx += Math.max(1, count);

    // Ensure every single manuscript page has at least one paragraph rendered
    if (pageParas.length === 0 && totalParas > 0) {
      const fallbackIdx = mIdx % totalParas;
      pageParas = [formattedParagraphs[fallbackIdx]];
    }

    const words = pageParas.reduce(
      (sum, p) => sum + p.segments.reduce((s2, seg) => s2 + seg.text.split(/\s+/).length, 0),
      0
    );

    pages.push({
      pageIndex: mIdx,
      paragraphs: pageParas,
      wordCount: words,
    });
  }

  return pages;
}

/**
 * High-fidelity Dynamic Manuscript Page for ANY inserted document.
 * Follows the EXACT Turnitin pattern, typography, colors, left gutter badges, and highlight styling.
 */
export const DynamicTurnitinManuscriptPage: React.FC<{
  report: ScanReport;
  mode: 'similarity' | 'ai';
  pageIndex: number;
  pageNumber: number;
  totalPages: number;
}> = ({ report, mode, pageIndex, pageNumber, totalPages }) => {
  const isSimilarity = mode === 'similarity';
  const submissionId = report.submissionId || 'trn:oid:::2:445438161';
  const sectionTitle = isSimilarity ? 'Submission' : 'AI Writing Submission';

  // Compute pages dynamically from inserted file content
  const pagesData = useMemo(() => {
    return paginateDocumentForTurnitin(report, mode);
  }, [report, mode]);

  const currentPage = pagesData[pageIndex] || pagesData[0] || {
    pageIndex: 0,
    paragraphs: [],
    wordCount: 0,
  };

  const renderBadge = (num: number, keyId?: string | number) => {
    const color = getBadgeColor(num);
    return (
      <span
        key={keyId}
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold font-mono ${color.bg} ${color.text} shadow-xs shrink-0`}
      >
        {num}
      </span>
    );
  };

  // Rich HTML paragraph layout with 4-color highlighters and AI highlighters
  return (
    <div className="flex flex-col justify-between h-full min-h-[960px] font-sans p-6 sm:p-10 text-slate-900 bg-white relative select-text">
      <TurnitinPageHeader
        pageNumber={pageNumber}
        totalPages={totalPages}
        sectionTitle={sectionTitle}
        submissionId={submissionId}
        mode={mode}
      />

      <div className="flex-1 my-auto text-[12.5px] leading-relaxed relative pt-4 pb-4">
        {/* On First Manuscript Page: Prominent Paper Title and Author block */}
        {pageIndex === 0 && (
          <div className="text-center space-y-1 mb-6 pb-3 border-b border-slate-200">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
              {report.title}
            </h1>
            <div className="text-xs text-slate-600 font-medium">
              <span>{report.author || 'Author'}</span>
              {report.institution && <span> • {getInstitutionName(report.institution)}</span>}
            </div>
          </div>
        )}

        {/* Paragraphs with left gutter badges and authentic Turnitin highlights */}
        <div className="space-y-4 text-justify">
          {currentPage.paragraphs.map((para, pIdx) => {
            const hasBadges = isSimilarity && para.badges.length > 0;

            return (
              <div
                key={`p-${pageIndex}-${pIdx}`}
                className="flex items-start gap-3 relative group"
              >
                {/* Left Gutter: Numbered Badges matching Turnitin official format */}
                <div className="w-8 shrink-0 flex flex-col items-end gap-1 pt-0.5 select-none">
                  {hasBadges &&
                    para.badges.map((bNum, bIdx) =>
                      renderBadge(bNum, `gutter-b-${pageIndex}-${pIdx}-${bIdx}`)
                    )}
                  {!isSimilarity && report.aiScore > 20 && para.segments.some(s => s.isAi) && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-[#0284c7] text-white">
                      AI
                    </span>
                  )}
                </div>

                {/* Paragraph Content */}
                <div
                  className={`flex-1 text-slate-800 ${
                    para.isHeading
                      ? 'font-bold text-slate-900 text-sm mt-2 mb-1 border-b border-slate-100 pb-1'
                      : 'text-[12px] sm:text-[12.5px] leading-[1.75]'
                  }`}
                >
                  {para.segments.map((seg, sIdx) => {
                    if (isSimilarity && seg.isPlagiarized) {
                      const srcNum = seg.sourceIndex || 1;

                      // 4-color highlighter: 1 (Pink/Red), 2 (Blue), 3 (Emerald/Green), 4 (Purple)
                      // Badges appear on the LEFT side of the highlighted text
                      if (srcNum === 1) {
                        return (
                          <span
                            key={`seg-${sIdx}`}
                            style={{ backgroundColor: '#fca5a5', color: '#991b1b' }}
                            className="rounded-xs px-1 inline font-normal"
                          >
                            <span className="inline-flex items-center justify-center w-3 h-3 rounded-full text-[7.5px] font-bold font-mono bg-[#dc2626] text-white mr-1 align-baseline">
                              {srcNum}
                            </span>
                            {seg.text}
                          </span>
                        );
                      } else if (srcNum === 2) {
                        return (
                          <span
                            key={`seg-${sIdx}`}
                            style={{ backgroundColor: '#93c5fd', color: '#1e3a8a' }}
                            className="rounded-xs px-1 inline font-normal"
                          >
                            <span className="inline-flex items-center justify-center w-3 h-3 rounded-full text-[7.5px] font-bold font-mono bg-[#2563eb] text-white mr-1 align-baseline">
                              {srcNum}
                            </span>
                            {seg.text}
                          </span>
                        );
                      } else if (srcNum === 3) {
                        return (
                          <span
                            key={`seg-${sIdx}`}
                            style={{ backgroundColor: '#86efac', color: '#064e3b' }}
                            className="rounded-xs px-1 inline font-normal"
                          >
                            <span className="inline-flex items-center justify-center w-3 h-3 rounded-full text-[7.5px] font-bold font-mono bg-[#059669] text-white mr-1 align-baseline">
                              {srcNum}
                            </span>
                            {seg.text}
                          </span>
                        );
                      } else {
                        return (
                          <span
                            key={`seg-${sIdx}`}
                            style={{ backgroundColor: '#d8b4fe', color: '#4c1d95' }}
                            className="rounded-xs px-1 inline font-normal"
                          >
                            <span className="inline-flex items-center justify-center w-3 h-3 rounded-full text-[7.5px] font-bold font-mono bg-[#7c3aed] text-white mr-1 align-baseline">
                              {srcNum}
                            </span>
                            {seg.text}
                          </span>
                        );
                      }
                    }

                    if (!isSimilarity && seg.isAi && report.aiScore >= 21) {
                      return (
                        <span
                          key={`seg-${sIdx}`}
                          style={{
                            backgroundColor: '#AFEBF0',
                            color: '#000000',
                          }}
                          className="rounded-xs px-1 py-0.5 inline font-normal"
                        >
                          {seg.text}
                        </span>
                      );
                    }

                    return <span key={`seg-${sIdx}`}>{seg.text}</span>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TurnitinPageFooter
        pageNumber={pageNumber}
        totalPages={totalPages}
        sectionTitle={sectionTitle}
        submissionId={submissionId}
        mode={mode}
      />
    </div>
  );
};
