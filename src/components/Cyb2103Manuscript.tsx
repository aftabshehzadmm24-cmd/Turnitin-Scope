import React from 'react';
import { ScanReport } from '../types';
import {
  TurnitinPageHeader,
  TurnitinPageFooter,
  getBadgeColor,
} from './TurnitinOfficialPages';
import { isExcludedFromHighlighting } from '../utils/documentParser';

interface Cyb2103ManuscriptProps {
  report: ScanReport;
  mode: 'ai' | 'similarity';
  pageIndex: number; // 0 to 3 (Pages 1 to 4 of CYB2103)
  pageNumber: number;
  totalPages: number;
}

export const Cyb2103RiskHeatmap: React.FC = () => {
  const impacts = ['1 Negligible', '2 Minor', '3 Moderate', '4 Significant', '5 Severe'];
  const likelihoods = [
    { label: '5 Very likely', cells: ['Medium', 'High', 'Critical', 'Critical', 'Critical'] },
    { label: '4 Likely', cells: ['Medium', 'Medium', 'High', 'Critical', 'Critical'] },
    { label: '3 Possible', cells: ['Low', 'Medium', 'Medium', 'High', 'High'] },
    { label: '2 Unlikely', cells: ['Low', 'Low', 'Medium', 'Medium', 'High'] },
    { label: '1 Very unlikely', cells: ['Low', 'Low', 'Low', 'Low', 'Medium'] },
  ];

  const getCellBg = (val: string) => {
    switch (val) {
      case 'Critical':
        return 'bg-rose-500 text-white font-bold';
      case 'High':
        return 'bg-orange-400 text-white font-semibold';
      case 'Medium':
        return 'bg-amber-300 text-slate-900 font-medium';
      case 'Low':
      default:
        return 'bg-emerald-400 text-slate-950 font-medium';
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto my-3 p-3 bg-white border border-slate-300 text-[10px] select-text">
      <div className="text-center font-bold text-slate-800 mb-2 text-xs">
        Risk Assessment Matrix (Likelihood × Impact)
      </div>
      <div className="flex">
        {/* Y Axis Label */}
        <div className="w-5 flex items-center justify-center -rotate-90 text-[10px] font-bold text-slate-600 tracking-wider">
          LIKELIHOOD
        </div>

        <div className="flex-1">
          <div className="grid grid-cols-6 gap-1 text-center font-mono">
            <div className="text-slate-400 font-sans text-[9px] flex items-center justify-center">L \ I</div>
            {impacts.map((imp, idx) => (
              <div key={idx} className="font-bold text-[9px] text-slate-700 py-1 bg-slate-50 border border-slate-200">
                {imp}
              </div>
            ))}

            {likelihoods.map((row, rIdx) => (
              <React.Fragment key={rIdx}>
                <div className="text-right pr-1 font-semibold text-[9px] text-slate-700 flex items-center justify-end bg-slate-50 border border-slate-200 px-1">
                  {row.label}
                </div>
                {row.cells.map((cell, cIdx) => (
                  <div
                    key={cIdx}
                    className={`py-1.5 flex items-center justify-center rounded-xs text-[9px] border border-black/10 ${getCellBg(cell)}`}
                  >
                    {cell}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
          <div className="text-center mt-1.5 text-[10px] font-bold text-slate-600 tracking-wider">
            IMPACT
          </div>
        </div>
      </div>
    </div>
  );
};

export const Cyb2103RiskBarChart: React.FC = () => {
  const data = [
    { id: 'R1 Identity', inherent: 20, residual: 10 },
    { id: 'R2 Lateral movement', inherent: 20, residual: 10 },
    { id: 'R3 Detection', inherent: 16, residual: 8 },
    { id: 'R4 Human/supplier', inherent: 12, residual: 6 },
  ];

  return (
    <div className="w-full max-w-xl mx-auto my-3 p-3 bg-white border border-slate-300 text-xs">
      <div className="flex items-center justify-center gap-6 mb-2 text-[10.5px]">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-[#1e3a8a] rounded-xs inline-block" />
          <span className="font-semibold text-slate-800">Inherent risk score</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-[#38bdf8] rounded-xs inline-block" />
          <span className="font-semibold text-slate-800">Target residual risk score</span>
        </div>
      </div>

      <svg viewBox="0 0 500 170" className="w-full h-auto">
        {/* Y Axis Grid lines */}
        {[0, 5, 10, 15, 20].map(val => {
          const y = 140 - (val / 20) * 115;
          return (
            <g key={val}>
              <line x1="45" y1={y} x2="480" y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
              <text x="35" y={y + 3} textAnchor="end" fontSize="9" fill="#64748b" fontFamily="sans-serif">
                {val}
              </text>
            </g>
          );
        })}

        {/* X and Y Axes */}
        <line x1="45" y1="25" x2="45" y2="140" stroke="#475569" strokeWidth="1" />
        <line x1="45" y1="140" x2="480" y2="140" stroke="#475569" strokeWidth="1" />

        {/* Bars */}
        {data.map((item, idx) => {
          const groupX = 75 + idx * 102;
          const inherentH = (item.inherent / 20) * 115;
          const residualH = (item.residual / 20) * 115;

          return (
            <g key={item.id}>
              {/* Inherent Bar (Dark Blue) */}
              <rect
                x={groupX}
                y={140 - inherentH}
                width="28"
                height={inherentH}
                fill="#1e3a8a"
                rx="1"
              />
              <text
                x={groupX + 14}
                y={135 - inherentH}
                textAnchor="middle"
                fontSize="9"
                fontWeight="bold"
                fill="#1e3a8a"
              >
                {item.inherent}
              </text>

              {/* Residual Bar (Light Blue) */}
              <rect
                x={groupX + 32}
                y={140 - residualH}
                width="28"
                height={residualH}
                fill="#38bdf8"
                rx="1"
              />
              <text
                x={groupX + 46}
                y={135 - residualH}
                textAnchor="middle"
                fontSize="9"
                fontWeight="bold"
                fill="#0284c7"
              >
                {item.residual}
              </text>

              {/* X Axis Label */}
              <text
                x={groupX + 30}
                y="155"
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="600"
                fill="#334155"
              >
                {item.id.split(' ')[0]}
              </text>
              <text
                x={groupX + 30}
                y="165"
                textAnchor="middle"
                fontSize="7.5"
                fill="#64748b"
              >
                {item.id.split(' ').slice(1).join(' ')}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const Cyb2103ManuscriptPage: React.FC<Cyb2103ManuscriptProps> = ({
  report,
  mode,
  pageIndex,
  pageNumber,
  totalPages,
}) => {
  const isSimilarity = mode === 'similarity';
  const submissionId = report.submissionId || 'trn:oid:::1:8989900768';
  const sectionTitle = isSimilarity ? 'Submission' : 'AI Writing Submission';

  // Badge rendering helper
  const renderBadge = (num: number, keyId?: string | number) => {
    const color = getBadgeColor(num);
    return (
      <span
        key={keyId}
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold font-mono ${color.bg} ${color.text} shadow-xs`}
      >
        {num}
      </span>
    );
  };

  // Highlighting helpers matching Turnitin official styles
  const hlSim = (text: string, sourceNum: number = 1, isBlue: boolean = false) => {
    if (!isSimilarity || isExcludedFromHighlighting(text)) return <span>{text}</span>;
    if (isBlue || sourceNum === 2) {
      return (
        <span
          style={{ backgroundColor: '#93c5fd', color: '#1e3a8a' }}
          className="rounded-xs px-1 py-0.5 inline font-normal"
        >
          {text}
        </span>
      );
    }
    return (
      <span
        style={{ backgroundColor: '#fca5a5', color: '#991b1b' }}
        className="rounded-xs px-1 py-0.5 inline font-normal"
      >
        {text}
      </span>
    );
  };

  const hlAi = (text: string) => {
    if (isSimilarity || report.aiScore <= 20) return <span>{text}</span>;
    return (
      <span
        style={{ backgroundColor: '#AFEBF0', color: '#000000' }}
        className="rounded-xs px-1 py-0.5 inline font-normal"
      >
        {text}
      </span>
    );
  };

  const mark = (
    text: string,
    simSource: number = 1,
    simBlue: boolean = false,
    aiFlag: boolean = false
  ) => {
    if (isSimilarity) {
      return hlSim(text, simSource, simBlue);
    }
    if (aiFlag) {
      return hlAi(text);
    }
    return <span>{text}</span>;
  };

  return (
    <div className="flex flex-col justify-between h-full min-h-[960px] font-sans p-6 sm:p-10 text-slate-900 bg-white relative">
      <TurnitinPageHeader
        pageNumber={pageNumber}
        totalPages={totalPages}
        sectionTitle={sectionTitle}
        submissionId={submissionId}
      />

      <div className="flex-1 my-auto text-[11.5px] leading-relaxed relative">
        {/* Document In-Header */}
        <div className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-100 mb-3">
          CYB2103 | CYBER RISK MANAGEMENT CASE STUDY
        </div>

        {/* PAGE 1 (Overall Page 4 of 7 in Similarity / Page 3 of 6 in AI) */}
        {pageIndex === 0 && (
          <div className="space-y-3">
            <div className="space-y-0.5">
              <div className="flex items-start gap-2">
                <div className="w-6 shrink-0 text-right pt-0.5" />
                <div className="flex-1">
                  <h1 className="text-sm font-bold text-slate-900 leading-tight">
                    {mark('CYB2103 | CYBER RISK MANAGEMENT', 1, false, false)}
                  </h1>
                  <h2 className="text-xs font-bold text-slate-800 leading-tight">
                    {mark('Assessment 3 – Cyber Risk Management Case Study Report', 1, false, false)}
                  </h2>
                  <h3 className="text-xs font-semibold text-slate-800">
                    {mark('Medibank 2022 Cybercrime Event: Risk Assessment and Cost-Effective Treatment', 1, false, false)}
                  </h3>
                  <p className="text-[10.5px] text-slate-500 mt-0.5">
                    {mark('Case organisation: Medibank Private Limited (Australia) | Learning outcomes: SLO2 and SLO3', 1, false, false)}
                  </p>
                </div>
              </div>
            </div>

            {/* Executive Summary */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-start gap-2">
                <div className="w-6 shrink-0 text-right pt-0.5" />
                <h4 className="text-xs font-bold text-slate-900 flex-1">
                  {mark('Executive Summary', 1, false, false)}
                </h4>
              </div>

              {/* Callout Takeaway Box */}
              <div className="flex items-start gap-2">
                <div className="w-6 shrink-0 text-right pt-1">
                  {isSimilarity && renderBadge(1, 'badge-box-1')}
                </div>
                <div className="flex-1 border border-slate-300 bg-slate-50/70 p-2.5 rounded text-[11px] leading-relaxed text-slate-800 italic">
                  <span className="font-semibold not-italic">Management takeaway: </span>
                  {mark(
                    'the case shows that funding of credential security needs to be paired with funding of access boundaries and access detection capabilities; a control that bars entry does not provide access detection capability, thereby leaving the highest value data exposed.',
                    1,
                    false,
                    true
                  )}
                </div>
              </div>
            </div>

            {/* 2. Cyber-Risk Identification */}
            <div className="space-y-1 pt-1">
              <div className="flex items-start gap-2">
                <div className="w-6 shrink-0 text-right pt-0.5" />
                <h4 className="text-xs font-bold text-slate-900 flex-1">
                  {mark('2. Cyber-Risk Identification', 1, false, false)}
                </h4>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-6 shrink-0 text-right pt-1">
                  {isSimilarity && renderBadge(1, 'badge-risk-p')}
                </div>
                <p className="flex-1 text-[11px] leading-relaxed text-slate-800">
                  The key is in their databases and the trust they have in members to have them share sensitive information. The risk chain is: Asset, threat, vulnerability, event, consequence.{' '}
                  {mark(
                    'The importance of stolen credentials is that they can be used to become an attack path via social engineering (Krombholz et al., 2015). The human controls are not a blame approach, it is important because user knowledge and awareness of policy and self-efficacy are crucial in resisting or reporting to phishing (Arachchilage & Love, 2014; Bulgurcu et al., 2010).',
                    1,
                    false,
                    false
                  )}
                </p>
              </div>
            </div>

            {/* Table 1 */}
            <div className="space-y-1 pt-1">
              <div className="text-[10.5px] font-semibold text-slate-800 pl-8">
                Table 1. Case-specific asset, threat, vulnerability and consequence map (author-developed).
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 shrink-0" />
                <div className="flex-1 overflow-x-auto border border-slate-300">
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-slate-900 font-bold">
                        <th className="p-1.5 border-r border-slate-200 w-8 text-center">ID</th>
                        <th className="p-1.5 border-r border-slate-200 w-36">Asset / value</th>
                        <th className="p-1.5 border-r border-slate-200 w-44">Threat and vulnerability</th>
                        <th className="p-1.5">Risk event and business consequence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      <tr>
                        <td className="p-1.5 font-bold text-center border-r border-slate-200">R1</td>
                        <td className="p-1.5 border-r border-slate-200 font-medium">
                          Member identity and health/claims data
                        </td>
                        <td className="p-1.5 border-r border-slate-200">
                          Stolen credentials; weak authentication or privileged-access controls
                        </td>
                        <td className="p-1.5">
                          Unauthorised access and exfiltration; privacy harm, identity misuse, extortion, regulatory exposure and loss of trust.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-1.5 font-bold text-center border-r border-slate-200">R2</td>
                        <td className="p-1.5 border-r border-slate-200 font-medium">
                          Claims platforms, APIs, admin zones and backups
                        </td>
                        <td className="p-1.5 border-r border-slate-200">
                          Over-broad permissions and insufficient network separation
                        </td>
                        <td className="p-1.5">
                          Lateral movement increases the volume and sensitivity of data reached and may disrupt claims and member services.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-1.5 font-bold text-center border-r border-slate-200">R3</td>
                        <td className="p-1.5 border-r border-slate-200 font-medium">
                          Security telemetry and incident governance
                        </td>
                        <td className="p-1.5 border-r border-slate-200">
                          Incomplete logging, alert gaps or untested response playbooks
                        </td>
                        <td className="p-1.5">
                          Delayed detection extends attacker dwell time, weakens containment and increases response and recovery cost.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-1.5 font-bold text-center border-r border-slate-200">R4</td>
                        <td className="p-1.5 border-r border-slate-200 font-medium">
                          Remote workforce and third-party connections
                        </td>
                        <td className="p-1.5 border-r border-slate-200">
                          Social engineering, supplier access or unmanaged identities
                        </td>
                        <td className="p-1.5">
                          A human or supplier pathway reintroduces the same compromise and makes accountability and containment harder.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* In-Doc Page Footer */}
            <div className="text-center text-[10px] text-slate-400 pt-2 font-mono">
              CYB2103 | Assessment 3 | Page 1
            </div>
          </div>
        )}

        {/* PAGE 2 (Overall Page 5 of 7 in Similarity / Page 4 of 6 in AI) */}
        {pageIndex === 1 && (
          <div className="space-y-3">
            {/* Figure 1 Heatmap */}
            <div className="space-y-1">
              <div className="flex items-start gap-2">
                <div className="w-6 shrink-0 text-right pt-0.5" />
                <div className="flex-1">
                  <div className="text-[10.5px] font-semibold text-slate-800">
                    {mark('Figure 1. Likelihood-impact heat map used for the qualitative assessment (author-developed; green = lower, red = higher).', 1, false, false)}
                  </div>
                  <Cyb2103RiskHeatmap />
                </div>
              </div>
            </div>

            {/* Table 2 */}
            <div className="space-y-1 pt-1">
              <div className="flex items-start gap-2">
                <div className="w-6 shrink-0" />
                <div className="text-[10.5px] font-semibold text-slate-800 flex-1">
                  Table 2. Inherent risk register and target residual position. L = likelihood; I = impact.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-6 shrink-0" />
                <div className="flex-1 overflow-x-auto border border-slate-300">
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-slate-900 font-bold">
                        <th className="p-1.5 border-r border-slate-200 w-8 text-center">ID</th>
                        <th className="p-1.5 border-r border-slate-200">Risk event</th>
                        <th className="p-1.5 border-r border-slate-200 w-8 text-center">L</th>
                        <th className="p-1.5 border-r border-slate-200 w-8 text-center">I</th>
                        <th className="p-1.5 border-r border-slate-200 w-12 text-center">Score</th>
                        <th className="p-1.5 border-r border-slate-200 w-16 text-center">Priority</th>
                        <th className="p-1.5 w-28">Target residual risk</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      <tr>
                        <td className="p-1.5 font-bold text-center border-r border-slate-200">R1</td>
                        <td className="p-1.5 border-r border-slate-200">
                          Stolen credential enables privileged access and data exfiltration
                        </td>
                        <td className="p-1.5 text-center border-r border-slate-200">4</td>
                        <td className="p-1.5 text-center border-r border-slate-200">5</td>
                        <td className="p-1.5 text-center font-bold text-rose-600 border-r border-slate-200">20</td>
                        <td className="p-1.5 text-center font-bold text-rose-600 border-r border-slate-200">Critical</td>
                        <td className="p-1.5 font-semibold text-amber-700">10; High</td>
                      </tr>
                      <tr>
                        <td className="p-1.5 font-bold text-center border-r border-slate-200">R2</td>
                        <td className="p-1.5 border-r border-slate-200">
                          Lateral movement across claims, identity and backup zones
                        </td>
                        <td className="p-1.5 text-center border-r border-slate-200">4</td>
                        <td className="p-1.5 text-center border-r border-slate-200">5</td>
                        <td className="p-1.5 text-center font-bold text-rose-600 border-r border-slate-200">20</td>
                        <td className="p-1.5 text-center font-bold text-rose-600 border-r border-slate-200">Critical</td>
                        <td className="p-1.5 font-semibold text-amber-700">10; High</td>
                      </tr>
                      <tr>
                        <td className="p-1.5 font-bold text-center border-r border-slate-200">R3</td>
                        <td className="p-1.5 border-r border-slate-200">
                          Detection or incident response is too slow
                        </td>
                        <td className="p-1.5 text-center border-r border-slate-200">4</td>
                        <td className="p-1.5 text-center border-r border-slate-200">4</td>
                        <td className="p-1.5 text-center font-bold text-rose-600 border-r border-slate-200">16</td>
                        <td className="p-1.5 text-center font-bold text-rose-600 border-r border-slate-200">Critical</td>
                        <td className="p-1.5 font-semibold text-amber-600">8; Medium</td>
                      </tr>
                      <tr>
                        <td className="p-1.5 font-bold text-center border-r border-slate-200">R4</td>
                        <td className="p-1.5 border-r border-slate-200">
                          Human or supplier access pathway is compromised
                        </td>
                        <td className="p-1.5 text-center border-r border-slate-200">3</td>
                        <td className="p-1.5 text-center border-r border-slate-200">4</td>
                        <td className="p-1.5 text-center font-bold text-orange-600 border-r border-slate-200">12</td>
                        <td className="p-1.5 text-center font-bold text-orange-600 border-r border-slate-200">High</td>
                        <td className="p-1.5 font-semibold text-amber-600">6; Medium</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Analysis Paragraph */}
            <div className="flex items-start gap-2 pt-1">
              <div className="w-6 shrink-0 text-right pt-1">
                {isSimilarity && renderBadge(1, 'badge-p2-txt')}
              </div>
              <p className="flex-1 text-[11px] leading-relaxed text-slate-800">
                R1 and R2 have been ranked first because a compromise of these credentials can affect many sensitive and valuable pieces of information and there is risk when access is privileged or not well controlled.{' '}
                {mark(
                  'Because of the potential that delayed detection will increase the number of people affected, R3 is of key importance.',
                  1,
                  false,
                  false
                )}{' '}
                High impact because of permissions required, R4. Assumption of implementation and verification, management will accept, transfer or further remove any residual high risk.
              </p>
            </div>

            {/* In-Doc Page Footer */}
            <div className="text-center text-[10px] text-slate-400 pt-3 font-mono">
              CYB2103 | Assessment 3 | Page 2
            </div>
          </div>
        )}

        {/* PAGE 3 (Overall Page 6 of 7 in Similarity / Page 5 of 6 in AI) */}
        {pageIndex === 2 && (
          <div className="space-y-3">
            {/* Figure 2 Bar Chart */}
            <div className="space-y-1">
              <div className="text-[10.5px] font-semibold text-slate-800 pl-8">
                Figure 2. Inherent versus target residual risk scores after the proposed control package.
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 shrink-0 text-right pt-2" />
                <div className="flex-1">
                  <Cyb2103RiskBarChart />
                </div>
              </div>
            </div>

            {/* 4. Risk Treatment Analysis */}
            <div className="space-y-1 pt-1">
              <h4 className="text-xs font-bold text-slate-900 pl-8">
                4. Risk Treatment Analysis
              </h4>
              <div className="flex items-start gap-2">
                <div className="w-6 shrink-0 text-right pt-1">
                  {isSimilarity && renderBadge(1, 'badge-p3-txt')}
                </div>
                <p className="flex-1 text-[10.5px] leading-relaxed text-slate-800">
                  The low purchase price does not always equal the lowest cost to reduce risk – it is effective treatment which is most cost effective based on resources and disruption in the context of reducing risk. Both Gordon and Loeb (2002) and Anderson and Moore (2006) agree that there is a correlation between the amount of loss reduction that can be achieved and the value of the information being protected; and that value of the information protected is different. If a privileged account can skip the MFA then don't bother with the low-cost training module; if the data is irreplaceable, then a high-cost control might be worth it. The packages are thus made up of preventive, detective and corrective controls.
                </p>
              </div>
            </div>

            {/* Table 3 */}
            <div className="space-y-1 pt-1">
              <div className="text-[10px] font-semibold text-slate-800 pl-8">
                Table 3. Treatment comparison. Relative cost and feasibility are planning assumptions to be validated through implementation.
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 shrink-0" />
                <div className="flex-1 overflow-x-auto border border-slate-300">
                  <table className="w-full text-left border-collapse text-[9.5px]">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-slate-900 font-bold">
                        <th className="p-1 border-r border-slate-200 w-8 text-center">Risk</th>
                        <th className="p-1 border-r border-slate-200 w-44">Treatment package</th>
                        <th className="p-1 border-r border-slate-200 w-24">Relative cost</th>
                        <th className="p-1 border-r border-slate-200">Operational feasibility / trade-off</th>
                        <th className="p-1 w-32">Residual position</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      <tr>
                        <td className="p-1 font-bold text-center border-r border-slate-200">R1</td>
                        <td className="p-1 border-r border-slate-200">
                          Phishing-resistant MFA; privileged access management; disable legacy authentication; access reviews
                        </td>
                        <td className="p-1 border-r border-slate-200 font-medium">Medium</td>
                        <td className="p-1 border-r border-slate-200">
                          High value and deployable in phases; some user friction and service-desk demand
                        </td>
                        <td className="p-1">
                          Likelihood falls; severe data impact remains possible
                        </td>
                      </tr>
                      <tr>
                        <td className="p-1 font-bold text-center border-r border-slate-200">R2</td>
                        <td className="p-1 border-r border-slate-200">
                          Least privilege; micro-segmentation; encryption/tokenisation; immutable and tested backups
                        </td>
                        <td className="p-1 border-r border-slate-200 font-medium">Medium-high</td>
                        <td className="p-1 border-r border-slate-200">
                          Requires architecture work and change control; reduces blast radius and recovery loss
                        </td>
                        <td className="p-1">
                          Medium likelihood; high impact if authorised access is abused
                        </td>
                      </tr>
                      <tr>
                        <td className="p-1 font-bold text-center border-r border-slate-200">R3</td>
                        <td className="p-1 border-r border-slate-200">
                          Central logging/SIEM; endpoint detection; alert tuning; rehearsed incident response; MSSP where efficient
                        </td>
                        <td className="p-1 border-r border-slate-200 font-medium">Medium recurring</td>
                        <td className="p-1 border-r border-slate-200">
                          MSSP can improve coverage without building a full 24/7 team; false positives need tuning
                        </td>
                        <td className="p-1">
                          Faster containment; residual uncertainty about novel attacks
                        </td>
                      </tr>
                      <tr>
                        <td className="p-1 font-bold text-center border-r border-slate-200">R4</td>
                        <td className="p-1 border-r border-slate-200">
                          Role-based microlearning; safe reporting; supplier MFA, due diligence and contractual notification
                        </td>
                        <td className="p-1 border-r border-slate-200 font-medium">Low-medium</td>
                        <td className="p-1 border-r border-slate-200">
                          Scalable and relatively affordable; training alone is weak without technical enforcement
                        </td>
                        <td className="p-1">
                          Lower recurrence likelihood; third-party residual risk remains
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* In-Doc Page Footer */}
            <div className="text-center text-[10px] text-slate-400 pt-2 font-mono">
              CYB2103 | Assessment 3 | Page 3
            </div>
          </div>
        )}

        {/* PAGE 4 (Overall Page 7 of 7 in Similarity / Page 6 of 6 in AI) */}
        {pageIndex === 3 && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-1">
              References
            </h4>

            <div className="space-y-2 text-[10px] leading-relaxed text-slate-800 pl-4 -indent-4">
              <p>
                Anderson, R., & Moore, T. (2006). The economics of information security. <em>Science</em>, 314(5799), 610–613. https://doi.org/10.1126/science.1130992
              </p>
              <p>
                Arachchilage, N. A. G., & Love, S. (2014). Security awareness of computer users: A phishing threat avoidance perspective. <em>Computers in Human Behavior</em>, 38, 304–312. https://doi.org/10.1016/j.chb.2014.05.046
              </p>
              <p>
                Bulgurcu, B., Cavusoglu, H., & Benbasat, I. (2010). Information security policy compliance: An empirical study of rationality-based beliefs and information security awareness. <em>MIS Quarterly</em>, 34(3), 523–548. https://doi.org/10.2307/25750690
              </p>
              <p>
                Cavusoglu, H., Mishra, B., & Raghunathan, S. (2005). The value of intrusion detection systems in information technology security architecture. <em>Information Systems Research</em>, 16(1), 28–46. https://doi.org/10.1287/isre.1050.0041
              </p>
              <p>
                Fenz, S., Heurix, J., Neubauer, T., & Pechstein, F. (2014). Current challenges in information security risk management. <em>Information Management & Computer Security</em>, 22(5), 410–430. https://doi.org/10.1108/IMCS-07-2013-0053
              </p>
              <p>
                Gordon, L. A., & Loeb, M. P. (2002). The economics of information security investment. <em>ACM Transactions on Information and System Security</em>, 5(4), 438–457. https://doi.org/10.1145/581271.581274
              </p>
              <p>
                International Organization for Standardization. (2022). ISO/IEC 27005:2022: Information security, cybersecurity and privacy protection—Guidance on managing information security risks. https://www.iso.org/standard/80585.html
              </p>
              <p>
                Krombholz, K., Hobel, H., Huber, M., & Weippl, E. (2015). Advanced social engineering attacks. <em>Journal of Information Security and Applications</em>, 22, 113–122. https://doi.org/10.1016/j.jisa.2014.09.005
              </p>
              <p>
                Medibank Private Limited. (2022, November 7). Medibank cybercrime update. https://www.medibank.com.au/livebetter/newsroom/post/medibank-cybercrime-update
              </p>
              <p>
                National Institute of Standards and Technology. (2012). Guide for conducting risk assessments (NIST Special Publication 800-30 Rev. 1). U.S. Department of Commerce. https://csrc.nist.gov/pubs/sp/800/30/r1/final
              </p>
              <p>
                Office of the Australian Information Commissioner. (2024, June 5). OAIC takes civil penalty action against Medibank. https://www.oaic.gov.au/news/media-centre/oaic-takes-civil-penalty-action-against-medibank
              </p>
              <p>
                Parsons, K., Calic, D., Pattinson, M. R., Butavicius, M., McCormac, A., & Zwaans, T. (2017). The human aspects of information security questionnaire (HAIS-Q): Two further validation studies. <em>Computers & Security</em>, 66, 40–51. https://doi.org/10.1016/j.cose.2017.01.004
              </p>
              <p>
                Siponen, M., & Willison, R. (2009). Information security management standards: Problems and solutions. <em>Information & Management</em>, 46(5), 267–270. https://doi.org/10.1016/j.im.2008.12.007
              </p>
              <p>
                Torten, R., Reaiche, C., & Boyle, S. (2018). The impact of security awareness on information technology professionals' behavior. <em>Computers & Security</em>, 79, 68–79. https://doi.org/10.1016/j.cose.2018.08.007
              </p>
            </div>

            {/* In-Doc Page Footer */}
            <div className="text-center text-[10px] text-slate-400 pt-3 font-mono">
              CYB2103 | Assessment 3 | Page 4
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
