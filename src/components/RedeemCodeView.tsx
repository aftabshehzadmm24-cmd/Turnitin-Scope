import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Ticket, Sparkles, CheckCircle2, AlertCircle, ArrowRight, Shield } from 'lucide-react';

export const RedeemCodeView: React.FC = () => {
  const { currentUser, redeemCode, activationCodes, setActivePanel } = useApp();
  const [code, setCode] = useState('');
  const activeCodes = activationCodes.filter(c => c.isActive && c.usedCount < c.maxUses);
  const [redeemStatus, setRedeemStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await redeemCode(code.trim());
      if (result.success) {
        setRedeemStatus({
          type: 'success',
          message: `${result.message} Your new credit balance is updated!`,
        });
        setCode('');
      } else {
        setRedeemStatus({
          type: 'error',
          message: result.message,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not redeem this activation code.';
      setRedeemStatus({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (codeStr: string) => {
    setCode(codeStr);
    setRedeemStatus(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12" id="redeem-code-view">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Redeem Activation Code
        </h2>
      </div>

      {/* Main Redeem Card matching Screenshot 7 */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm flex flex-col items-center text-center">
        {/* Ticket Icon */}
        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-3xl mb-4">
          🎫
        </div>

        {/* Heading & Subtitle */}
        <h3 className="text-base font-bold text-slate-900 mb-1">
          Enter Your Activation Code
        </h3>
        <p className="text-xs text-slate-500 max-w-md mb-6">
          Have an activation code? Enter it below to add credits to your account.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 text-center">
              Activation Code
            </label>
            <input
              type="text"
              value={code}
              onChange={e => {
                setCode(e.target.value.toUpperCase());
                setRedeemStatus(null);
              }}
              placeholder="TC - XXXXXX"
              className="w-full text-center tracking-wider font-mono font-bold bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase transition"
              id="input-activation-code"
            />
          </div>

          <button
            type="submit"
            disabled={!code.trim() || isSubmitting}
            className={`w-full py-3 rounded-xl font-bold text-xs transition-all shadow-md ${
              code.trim() && !isSubmitting
                ? 'bg-[#0066ff] hover:bg-[#0052cc] text-white shadow-blue-500/25 active:scale-98'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            id="btn-redeem-code"
          >
            {isSubmitting ? 'Redeeming...' : 'Redeem Code'}
          </button>

          {/* Subtext example hint matching screenshot */}
          <p className="text-[11px] text-slate-400 text-center">
            Example: TC-ABC123 or TC1-XYZ789
          </p>

          {/* Status Message */}
          {redeemStatus && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                redeemStatus.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {redeemStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{redeemStatus.message}</span>
            </div>
          )}
        </form>

        {/* Quick Testing Helper: Active Codes from Admin */}
        <div className="mt-8 pt-6 border-t border-slate-100 w-full max-w-md">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
            <span className="font-semibold">Available Vouchers / Codes:</span>
            {currentUser.role === 'admin' && (
              <button
                onClick={() => setActivePanel('admin')}
                className="text-indigo-600 hover:underline inline-flex items-center gap-1 font-semibold"
              >
                <Shield className="w-3 h-3" />
                Create custom in Admin
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {activeCodes.length > 0 ? (
              activeCodes.slice(0, 3).map(c => (
                <button
                  key={c.id}
                  onClick={() => handleQuickFill(c.code)}
                  className="text-[11px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-mono font-semibold px-2.5 py-1 rounded-lg border border-slate-200 transition"
                >
                  {c.code} (+{c.credits} credits)
                </button>
              ))
            ) : (
              <p className="text-[11px] text-slate-500">No active voucher codes are currently available.</p>
            )}
          </div>
        </div>
      </div>

      {/* Your Current Status Card matching screenshot */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4">
          Your Current Status
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Current Credits */}
          <div className="bg-slate-50/60 rounded-xl p-4 border border-slate-100">
            <span className="text-xs text-slate-500 block mb-1">Current Credits</span>
            <span className="text-3xl font-extrabold text-slate-900 font-mono" id="status-current-credits">
              {currentUser.credits}
            </span>
          </div>

          {/* Plan Expires */}
          <div className="bg-slate-50/60 rounded-xl p-4 border border-slate-100">
            <span className="text-xs text-slate-500 block mb-1">Plan Expires</span>
            <span className="text-xl font-bold text-slate-900 block" id="status-plan-expires">
              {currentUser.planExpiry}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
