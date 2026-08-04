import { useState, type FormEvent } from 'react';
import { Check, ExternalLink, KeyRound, ShieldCheck, Trash2, X } from 'lucide-react';
import { clearKeys, getKeys, maskKey, PROVIDERS, setKeys, type ApiKeys } from '../services/keys';
import { Pill } from './ui/primitives';

/**
 * Keys are entered at run time and stay in this browser. Nothing is committed
 * and nothing is sent anywhere except the provider it belongs to, which is what
 * makes the deployed page safe to share and safe to make public.
 */
export function ApiKeyPanel({
  open,
  onClose,
  onSaved
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<ApiKeys>(getKeys);
  const [saved, setSaved] = useState(false);

  if (!open) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    setKeys(draft);
    setSaved(true);
    onSaved();
    setTimeout(() => setSaved(false), 2200);
  }

  function reset() {
    clearKeys();
    setDraft(getKeys());
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label="API keys">
      <button type="button" aria-label="Close" className="fixed inset-0 bg-slate-900/30" onClick={onClose} />

      <div className="relative mt-8 w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
            <KeyRound className="h-4 w-4" aria-hidden /> API keys
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex items-start gap-2.5 border-b border-slate-200 bg-emerald-50 px-5 py-3 text-xs leading-relaxed text-emerald-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Keys are stored in this browser only and are sent nowhere except the provider they belong to. Nothing is
            written to the repository, so the deployed page stays safe to share. Because this is a static app with no
            backend, a key does travel from your browser straight to the provider over HTTPS — fine for a classroom
            demo, but a production app would put a backend proxy in front. Clear them any time with the button below.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 px-5 py-4">
          {PROVIDERS.map((provider) => {
            const stored = getKeys()[provider.name];
            return (
              <div key={provider.name}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <label htmlFor={`key-${provider.name}`} className="text-sm font-semibold text-slate-900">
                    {provider.label}
                    <span className="ml-2 font-mono text-[11px] font-normal text-slate-400">{provider.envName}</span>
                  </label>
                  <span className="flex items-center gap-2">
                    {provider.required ? <Pill tone="blue">Recommended</Pill> : <Pill tone="slate">Optional</Pill>}
                    {stored ? <Pill tone="green">Set · {maskKey(stored)}</Pill> : null}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{provider.powers}</p>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id={`key-${provider.name}`}
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={draft[provider.name]}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [provider.name]: e.target.value }))}
                    placeholder={stored ? 'Stored — type to replace' : 'Paste your key'}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                  <a
                    href={provider.signupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium whitespace-nowrap text-slate-700 hover:bg-slate-100"
                  >
                    Get a free key <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear all keys
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              {saved ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
              {saved ? 'Saved' : 'Save and reload data'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
