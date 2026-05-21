'use client';

import { useI18n } from '@/app/lib/i18n';

export default function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="inline-flex p-0.5 rounded-md border border-slate-200 bg-white">
      <button
        onClick={() => setLang('en')}
        className={`px-2 py-1 text-[11px] font-semibold rounded transition ${
          lang === 'en' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLang('de')}
        className={`px-2 py-1 text-[11px] font-semibold rounded transition ${
          lang === 'de' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        DE
      </button>
    </div>
  );
}
