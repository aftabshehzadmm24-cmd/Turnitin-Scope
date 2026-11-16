import React from 'react';
import { useApp } from '../context/AppContext';
import { OriginalityCheckLogo } from './OriginalityCheckLogo';
import { ShieldCheck, Sparkles } from 'lucide-react';

export const ScanProgressModal: React.FC = () => {
  const { isScanning, scanProgress } = useApp();

  if (!isScanning) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl border border-slate-200 text-center space-y-6">
        <div className="flex justify-center">
          <OriginalityCheckLogo size="sm" showSubtitle={false} />
        </div>

        <div className="relative flex items-center justify-center">
          <div className="w-20 h-20 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
          <div className="absolute text-2xl animate-pulse">
            ⚡
          </div>
        </div>

        <div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            Analyzing Document
          </h3>
          <p className="text-xs text-slate-500 font-medium min-h-[32px] flex items-center justify-center">
            {scanProgress?.step || 'Initiating TurnitScope verification...'}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-600 to-blue-600 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${scanProgress?.percent || 20}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>Scanning repositories...</span>
            <span>{scanProgress?.percent || 20}%</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          Processing the uploaded document and preparing the rendered report.
        </div>
      </div>
    </div>
  );
};
