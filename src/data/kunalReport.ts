import { ScanReport, MatchedSource, HighlightedSnippet } from '../types';

export const KUNAL_AI_SOURCES: MatchedSource[] = [
  {
    id: 'src-kunal-1',
    name: 'GitHub - Open-Source Machine Learning Repositories',
    url: 'https://github.com/topics/machine-learning-developer',
    similarity: 2,
    type: 'internet',
  },
  {
    id: 'src-kunal-2',
    name: 'LinkedIn Professional Profiles & Resumes Archive',
    url: 'https://www.linkedin.com/in/kunal-kumar-ai',
    similarity: 1,
    type: 'internet',
  },
];

export const KUNAL_AI_SNIPPETS: HighlightedSnippet[] = [
  {
    text: 'Kunal Kumar | AI Developer & Machine Learning Engineer with experience architecting scalable neural networks, LLM fine-tuning pipelines, and distributed inference engines.',
    type: 'normal',
  },
  {
    text: 'Designed and deployed deep learning microservices using FastAPI, Docker, and Kubernetes with sub-50ms latency guarantees across multi-region clusters.',
    type: 'plagiarized',
    sourceName: 'GitHub - Open-Source Machine Learning Repositories',
    sourceIndex: 1,
    sourceId: 'src-kunal-1',
    similarityPercentage: 2,
  },
  {
    text: 'Engineered Retrieval-Augmented Generation (RAG) pipelines incorporating LangChain, LlamaIndex, and Milvus vector databases, optimizing retrieval accuracy by 34%.',
    type: 'normal',
  },
  {
    text: 'Integrated comprehensive evaluation benchmarks ensuring deterministic agent reasoning, citation validation, and automated hallucination suppression.',
    type: 'plagiarized',
    sourceName: 'LinkedIn Professional Profiles & Resumes Archive',
    sourceIndex: 2,
    sourceId: 'src-kunal-2',
    similarityPercentage: 1,
  },
  {
    text: 'Implemented automated CI/CD workflows for ML model quantization, ONNX runtime conversion, and edge device optimization with TensorRT acceleration.',
    type: 'normal',
  },
];

export const KUNAL_REPORT: ScanReport = {
  id: 'rep-kunal-ai-dev',
  title: 'Kunal Kumar - AI Developer.pdf',
  fileName: 'Kunal Kumar - AI Developer.pdf',
  fileSize: '1.8 MB',
  author: 'Kunal Maheshwari',
  institution: 'Zhōngguó Kēxué Jìshù Dàxué',
  type: 'Plagiarism Check',
  status: 'Completed',
  plagiarismScore: 3, // 3% Overall Similarity matching user specification
  aiScore: 0,         // Plagiarism Check only (displays '—' for AI)
  wordCount: 1240,
  characterCount: 8960,
  pageCount: 3,       // Document details page count
  date: '2026-09-17 20:13',
  submissionDate: 'Sep 17, 2026, 8:13 PM GMT+5',
  downloadDate: 'Sep 17, 2026, 8:14 PM GMT+5',
  timestamp: 1789675980000,
  excludeBibliography: true,
  excludeQuotes: true,
  submissionId: 'trn:oid:::1:9948210344',
  matchGroups: {
    notCitedOrQuoted: 2,
    notCitedOrQuotedScore: 3,
    missingQuotations: 0,
    missingCitation: 0,
    citedAndQuoted: 0,
  },
  sourceDistribution: {
    internet: 3,
    publications: 0,
    studentPapers: 0,
  },
  integrityFlagsCount: 0,
  sources: KUNAL_AI_SOURCES,
  contentSample: `Kunal Kumar — AI Developer
Professional Summary
Results-driven AI Developer and Machine Learning Specialist with expertise in designing and deploying state-of-the-art transformer architectures, generative AI agents, and enterprise computer vision solutions. Proficient in PyTorch, TensorFlow, Hugging Face Transformers, LangChain, and high-performance vector retrieval architectures.

Technical Skills & Competencies
• Machine Learning & Deep Learning: PyTorch, TensorFlow, Scikit-Learn, XGBoost, CNNs, LSTMs, Transformers, Diffusion Models.
• Generative AI & LLMs: Fine-Tuning (LoRA, QLoRA), Prompt Engineering, RAG Systems, LangChain, LlamaIndex, vLLM, Ollama.
• Vector Databases & Search: Pinecone, Milvus, ChromaDB, Qdrant, Semantic Embeddings, Hybrid BM25 Keyword Search.
• MLOps & Deployment: Docker, Kubernetes, FastAPI, Triton Inference Server, ONNX, MLflow, AWS SageMaker, GCP Vertex AI.
• Programming & Databases: Python, C++, TypeScript, SQL, PostgreSQL, Redis, MongoDB.

Professional Experience
Senior AI Developer | Cognitive Solutions Lab (2024 – Present)
• Spearheaded development of an enterprise multimodal conversational assistant handling 250,000+ queries daily with 99.8% uptime.
• Architected dynamic context chunking and reranking mechanisms that decreased inference latency by 42% while increasing factual consistency.
• Collaborated with cross-functional research teams to develop automated integrity and adversarial testing frameworks for LLM safety.

Machine Learning Engineer | DataVision Technologies (2022 – 2024)
• Built automated visual defect detection pipelines utilizing customized YOLOv8 and ResNet architectures on industrial production lines.
• Conducted latency optimization via FP16 quantization and TensorRT engine compilation, boosting throughput from 28 to 110 FPS.
• Created end-to-end data preprocessing and synthetic augmentation workflows to balance skewed image distribution classes.

Education & Credentials
• Bachelor of Technology in Computer Science & Engineering, Specialization in AI & Data Analytics.
• Certified TensorFlow Developer & DeepLearning.AI Generative AI Specialist.
`,
  snippets: KUNAL_AI_SNIPPETS,
};

export function isKunalReport(report: ScanReport | null | undefined): boolean {
  if (!report) return false;
  return (
    report.id === 'rep-kunal-ai-dev' ||
    (report.fileName && report.fileName.toLowerCase().includes('kunal kumar - ai developer')) ||
    (report.title && report.title.toLowerCase().includes('kunal kumar - ai developer'))
  );
}
