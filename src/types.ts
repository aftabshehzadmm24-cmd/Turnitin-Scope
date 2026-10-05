export type ScanMode = 'ai' | 'plagiarism' | 'both';

export interface User {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: 'client' | 'admin';
  credits: number;
  usedCredits?: number;
  planName: string;
  planExpiry: string;
  planExpiresAt?: number;
  totalScans: number;
  createdAt: string;
  emailVerified?: boolean;
  photoURL?: string | null;
  authProvider?: 'google' | 'password' | 'demo';
}

export interface MatchedSource {
  id: string;
  name: string;
  url: string;
  similarity: number;
  type: 'internet' | 'publication' | 'student_paper';
}

export interface HighlightedSnippet {
  text: string;
  type: 'plagiarized' | 'ai_generated' | 'normal';
  sourceName?: string;
  sourceId?: string;
  sourceIndex?: number;
  similarityPercentage?: number;
  aiProbability?: number;
  styleVariant?: 'red' | 'blue_underlined';
}

export interface ManuscriptContentElement {
  type: 'header_title' | 'question' | 'answer_box' | 'figure' | 'paragraph';
  title?: string;
  subtitle?: string;
  note?: string;
  number?: number;
  text?: string;
  pointsNote?: string;
  figureNumber?: number;
  chartType?: 'inspection_time' | 'ufov' | 'self_rating';
  sourceMatches?: Array<{ text: string; sourceIndex: number }>;
  isAiHighlighted?: boolean;
}

export interface ManuscriptContentPage {
  pageNumber: number;
  elements: ManuscriptContentElement[];
  marginBadges?: Array<{ textAnchor: string; badgeNumbers: number[] }>;
}

export interface ScanReport {
  id: string;
  userId?: string;
  expiresAt?: number;
  title: string;
  fileName: string;
  fileSize: string;
  author: string;
  type: 'AI Detection' | 'Plagiarism Check' | 'Both';
  status: 'Completed' | 'Analyzing' | 'Failed';
  plagiarismScore: number; // percentage, e.g. 14
  aiScore: number; // percentage, e.g. 85
  wordCount: number;
  characterCount: number;
  date: string;
  timestamp: number;
  excludeBibliography: boolean;
  excludeQuotes: boolean;
  submissionId?: string;
  sources: MatchedSource[];
  contentSample: string;
  text?: string;
  snippets: HighlightedSnippet[];
  institution?: string;
  submissionDate?: string;
  downloadDate?: string;
  pageCount?: number;
  matchGroups?: {
    notCitedOrQuoted: number;
    notCitedOrQuotedScore: number;
    missingQuotations: number;
    missingQuotationsScore?: number;
    missingCitation: number;
    missingCitationScore?: number;
    citedAndQuoted: number;
    citedAndQuotedScore?: number;
  };
  sourceDistribution?: {
    internet: number;
    publications: number;
    studentPapers: number;
  };
  integrityFlagsCount?: number;
  manuscriptPages?: ManuscriptContentPage[];
  fileData?: string;
  storagePath?: string;
  sourceStoragePath?: string;
  fileMimeType?: string;
  fileMetadataId?: string;
  htmlContent?: string;
  htmlPages?: string[];
}

export interface ActivationCode {
  id: string;
  code: string;
  credits: number;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  note?: string;
  createdBy?: string;
}

export interface PurchaseKey {
  id: string;
  key: string;
  credits: number;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  note?: string;
  createdAt: string;
  createdBy: string;
  redeemedByEmail?: string;
  redeemedByUserId?: string;
  redeemedAt?: string;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  userName: string;
  amount: number; // positive for addition, negative for deduction
  balanceAfter: number;
  type: 'admin_grant' | 'redeem_code' | 'scan_deduction' | 'refund';
  note: string;
  date: string;
  timestamp: number;
}
