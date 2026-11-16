import React from 'react';
import { ScanReport } from '../types';
import {
  TurnitinPageHeader,
  TurnitinPageFooter,
  getBadgeColor,
} from './TurnitinOfficialPages';
import { isExcludedFromHighlighting } from '../utils/documentParser';

interface KunalManuscriptProps {
  report: ScanReport;
  mode: 'ai' | 'similarity';
  pageIndex: number; // 0, 1, 2
  pageNumber: number;
  totalPages: number;
}

export const KunalManuscriptPage: React.FC<KunalManuscriptProps> = ({
  report,
  mode,
  pageIndex,
  pageNumber,
  totalPages,
}) => {
  const isSimilarity = mode === 'similarity';
  const submissionId = report.submissionId || 'trn:oid:::1:9948210344';
  const sectionTitle = isSimilarity ? 'Submission' : 'AI Writing Submission';

  const renderBadge = (num: number, keyId?: string | number) => {
    const color = getBadgeColor(num);
    return (
      <span
        key={keyId}
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold font-mono ${color.bg} ${color.text} shadow-xs shrink-0 select-none`}
      >
        {num}
      </span>
    );
  };

  const mark = (text: string, srcNum: number, isBlue: boolean = false) => {
    if (!isSimilarity || isExcludedFromHighlighting(text)) return <span>{text}</span>;

    if (isBlue || srcNum === 2) {
      return (
        <span
          style={{ backgroundColor: '#93c5fd', color: '#1e3a8a' }}
          className="rounded-xs px-1 py-0.5 inline font-normal"
        >
          <span className="inline-flex items-center justify-center w-3 h-3 rounded-full text-[7.5px] font-bold font-mono bg-[#2563eb] text-white mr-1 align-baseline">
            {srcNum}
          </span>
          {text}
        </span>
      );
    }

    return (
      <span
        style={{ backgroundColor: '#fca5a5', color: '#991b1b' }}
        className="rounded-xs px-1 py-0.5 inline font-normal"
      >
        <span className="inline-flex items-center justify-center w-3 h-3 rounded-full text-[7.5px] font-bold font-mono bg-[#dc2626] text-white mr-1 align-baseline">
          {srcNum}
        </span>
        {text}
      </span>
    );
  };

  return (
    <div className="flex flex-col justify-between h-full min-h-[960px] font-sans p-6 sm:p-10 text-slate-900 bg-white relative">
      <TurnitinPageHeader
        pageNumber={pageNumber}
        totalPages={totalPages}
        sectionTitle={sectionTitle}
        submissionId={submissionId}
      />

      <div className="flex-1 my-auto text-[12px] leading-relaxed relative pt-3 pb-4">
        {pageIndex === 0 && (
          <div className="space-y-4">
            {/* Header / Title block of resume */}
            <div className="border-b-2 border-slate-800 pb-3 text-center">
              <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                KUNAL KUMAR
              </h1>
              <div className="text-[11.5px] font-semibold text-slate-700 mt-1 flex flex-wrap items-center justify-center gap-2">
                <span>AI Developer & Machine Learning Engineer</span>
                <span>•</span>
                <span>kunal.kumar@example.com</span>
                <span>•</span>
                <span>github.com/kunalkumar-ai</span>
                <span>•</span>
                <span>linkedin.com/in/kunal-kumar-ai</span>
              </div>
            </div>

            {/* Professional Summary */}
            <div className="space-y-1.5 pt-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-0.5">
                Professional Summary
              </h2>
              <div className="flex items-start gap-2">
                <div className="w-5 shrink-0 text-right pt-0.5">
                  {/* Gutter space */}
                </div>
                <p className="flex-1 text-[11.5px] leading-relaxed text-slate-800 text-justify">
                  Results-driven AI Developer and Machine Learning Specialist with extensive hands-on experience designing, training, and deploying deep neural network architectures, LLM fine-tuning pipelines, and production-grade computer vision systems. Proven track record of architecting scalable inference microservices, vector search indices, and deterministic evaluation benchmarks across distributed cloud topologies.
                </p>
              </div>
            </div>

            {/* Core Competencies & Technical Skills */}
            <div className="space-y-1.5 pt-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-0.5">
                Technical Competencies
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1 pl-7">
                <div className="bg-slate-50 p-2.5 rounded-sm border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-0.5">Deep Learning & ML:</span>
                  <span className="text-slate-700">PyTorch, TensorFlow, Scikit-Learn, XGBoost, CNNs, LSTMs, Transformers, Diffusion Models.</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-sm border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-0.5">Generative AI & LLMs:</span>
                  <span className="text-slate-700">LoRA / QLoRA Fine-Tuning, LangChain, LlamaIndex, vLLM, Prompt Engineering, Agentic Workflows.</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-sm border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-0.5">Vector Search & RAG:</span>
                  <span className="text-slate-700">Milvus, Pinecone, FAISS, ChromaDB, Semantic Embeddings, Hybrid BM25 Retrieval.</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-sm border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-0.5">MLOps & Cloud:</span>
                  <span className="text-slate-700">Docker, Kubernetes, FastAPI, Triton, ONNX, MLflow, AWS SageMaker, GCP Vertex AI.</span>
                </div>
              </div>
            </div>

            {/* Professional Experience Section */}
            <div className="space-y-2 pt-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-0.5">
                Professional Experience
              </h2>

              {/* Role 1 */}
              <div>
                <div className="flex justify-between items-baseline text-[11.5px] font-bold text-slate-900">
                  <span>Senior AI Developer • Cognitive Solutions Lab</span>
                  <span className="text-[10.5px] font-mono text-slate-600 font-normal">2024 – Present</span>
                </div>
                <div className="space-y-1 mt-1">
                  <div className="flex items-start gap-2">
                    <div className="w-5 shrink-0 text-right pt-0.5">
                      {isSimilarity && renderBadge(1, 'b-exp-1')}
                    </div>
                    <p className="flex-1 text-[11px] leading-relaxed text-slate-800">
                      • {mark('Designed and deployed deep learning microservices using FastAPI, Docker, and Kubernetes with sub-50ms latency guarantees across multi-region clusters', 1, false)}.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-5 shrink-0 text-right pt-0.5">
                      {/* Gutter */}
                    </div>
                    <p className="flex-1 text-[11px] leading-relaxed text-slate-800">
                      • Spearheaded the engineering of an enterprise conversational agent processing 250,000+ daily employee inquiries with a 99.8% service uptime.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-5 shrink-0 text-right pt-0.5">
                      {/* Gutter */}
                    </div>
                    <p className="flex-1 text-[11px] leading-relaxed text-slate-800">
                      • Implemented dynamic semantic chunking and cross-encoder reranking that reduced context retrieval hallucinations by 42%.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {pageIndex === 1 && (
          <div className="space-y-4">
            {/* Header Continuation */}
            <div className="border-b border-slate-200 pb-2 flex justify-between items-center text-[10.5px] text-slate-500">
              <span className="font-bold text-slate-800">Kunal Kumar — Curriculum Vitae (AI Developer)</span>
              <span>Page 2</span>
            </div>

            {/* Role 2 */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline text-[11.5px] font-bold text-slate-900">
                <span>Machine Learning Engineer • DataVision Technologies</span>
                <span className="text-[10.5px] font-mono text-slate-600 font-normal">2022 – 2024</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <div className="w-5 shrink-0 text-right pt-0.5">
                    {/* Gutter */}
                  </div>
                  <p className="flex-1 text-[11px] leading-relaxed text-slate-800">
                    • Developed computer vision defect detection systems utilizing customized YOLOv8 and ResNet backbone architectures for high-speed conveyor sorting.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 shrink-0 text-right pt-0.5">
                    {/* Gutter */}
                  </div>
                  <p className="flex-1 text-[11px] leading-relaxed text-slate-800">
                    • Conducted inference optimization through FP16 quantization and TensorRT engine compilation, increasing frame rates from 28 to 110 FPS on Nvidia edge nodes.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 shrink-0 text-right pt-0.5">
                    {isSimilarity && renderBadge(2, 'b-exp-2')}
                  </div>
                  <p className="flex-1 text-[11px] leading-relaxed text-slate-800">
                    • {mark('Integrated comprehensive evaluation benchmarks ensuring deterministic agent reasoning, citation validation, and automated hallucination suppression', 2, true)}.
                  </p>
                </div>
              </div>
            </div>

            {/* Featured AI & ML Projects */}
            <div className="space-y-2 pt-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-0.5">
                Featured Technical Projects
              </h2>

              <div className="space-y-3 text-[11px]">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-sm">
                  <div className="flex justify-between font-bold text-slate-900 mb-1">
                    <span>Autonomous Document Intelligence Pipeline (LangChain + Qdrant)</span>
                    <span className="font-mono text-slate-500 font-normal">Open Source</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    Designed an asynchronous document processing engine extracting structured tables and semantic metadata from complex multi-page financial reports. Utilized hybrid lexical and vector embeddings to achieve 94.6% recall accuracy.
                  </p>
                </div>

                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-sm">
                  <div className="flex justify-between font-bold text-slate-900 mb-1">
                    <span>Distributed Model Serving Architecture (FastAPI + Triton)</span>
                    <span className="font-mono text-slate-500 font-normal">Production</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    Built an auto-scaling multi-tenant model server serving concurrent requests for text embedding and generative completions. Handled 15M+ monthly API hits with integrated Prometheus observability and Grafana telemetry.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {pageIndex === 2 && (
          <div className="space-y-4">
            {/* Header Continuation */}
            <div className="border-b border-slate-200 pb-2 flex justify-between items-center text-[10.5px] text-slate-500">
              <span className="font-bold text-slate-800">Kunal Kumar — Curriculum Vitae (AI Developer)</span>
              <span>Page 3</span>
            </div>

            {/* Education & Academic Background */}
            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-0.5">
                Education & Credentials
              </h2>
              <div className="space-y-2 text-[11px] pl-7">
                <div>
                  <div className="flex justify-between font-bold text-slate-900">
                    <span>Bachelor of Technology in Computer Science & Engineering</span>
                    <span className="font-mono text-slate-500 font-normal">Graduated Magna Cum Laude</span>
                  </div>
                  <div className="text-slate-600">
                    Specialization in Artificial Intelligence, Machine Learning & Computational Data Science.
                  </div>
                </div>
                <div className="pt-1">
                  <div className="font-bold text-slate-900 mb-1">Certifications & Distinctions:</div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                    <li>Certified TensorFlow Developer (Google Cloud)</li>
                    <li>DeepLearning.AI Generative AI with Large Language Models</li>
                    <li>NVIDIA Deep Learning Institute: Fundamentals of Accelerated Computing</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Publications & Research Notes */}
            <div className="space-y-2 pt-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-0.5">
                Research Publications & Technical Talks
              </h2>
              <div className="space-y-2 text-[11px] pl-7">
                <p className="text-slate-700">
                  <span className="font-bold text-slate-900">Kumar, K., & Sharma, R. (2023).</span> "Efficient Transformer Fine-Tuning on Resource-Constrained Hardware using Low-Rank Quantization." <em>Proceedings of the International Conference on Applied Artificial Intelligence</em>, pp. 142–151.
                </p>
                <p className="text-slate-700">
                  <span className="font-bold text-slate-900">Guest Speaker:</span> "Building Resilient Agentic Systems with Vector Indexes" — AI Summit 2024.
                </p>
              </div>
            </div>

            {/* In-Doc Page Footer */}
            <div className="text-center text-[10px] text-slate-400 pt-8 font-mono border-t border-slate-100">
              Kunal Kumar - AI Developer.pdf | Document Details Page 3
            </div>
          </div>
        )}
      </div>

      <TurnitinPageFooter
        pageNumber={pageNumber}
        totalPages={totalPages}
        sectionTitle={sectionTitle}
        submissionId={submissionId}
      />
    </div>
  );
};
