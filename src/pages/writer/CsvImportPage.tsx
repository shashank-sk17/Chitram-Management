import { useState, useRef, useCallback } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../stores/authStore';
import { motion, AnimatePresence } from 'framer-motion';

type LanguageCode = 'te' | 'en' | 'hi' | 'mr' | 'es' | 'fr';
const LANGS: LanguageCode[] = ['te', 'en', 'hi', 'mr', 'es', 'fr'];

interface ParsedRow {
  word: Record<LanguageCode, string>;
  pronunciation: Record<LanguageCode, string>;
  meaning: Record<LanguageCode, string>;
  sentence: Record<LanguageCode, string>;
  wordType: 'NS360' | 'GQD';
  difficulty: 'Low' | 'Medium' | 'High';
  errors: string[];
}

const EMPTY_LANG = (): Record<LanguageCode, string> =>
  Object.fromEntries(LANGS.map(l => [l, ''])) as Record<LanguageCode, string>;

/**
 * Expected CSV columns (header row required):
 * word_te, word_en, word_hi, word_mr, word_es, word_fr,
 * pronunciation_te, pronunciation_en, ..._hi, ..._mr, ..._es, ..._fr,
 * meaning_te, meaning_en, ..._hi, ..._mr, ..._es, ..._fr,
 * sentence_te, sentence_en, ..._hi, ..._mr, ..._es, ..._fr,
 * wordType, difficulty
 */
function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));

  return lines.slice(1).map(line => {
    // Handle quoted fields with commas inside
    const values: string[] = [];
    let cur = '';
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { values.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    values.push(cur.trim());

    const get = (key: string) => values[headers.indexOf(key)]?.trim() ?? '';

    const word = EMPTY_LANG();
    const pronunciation = EMPTY_LANG();
    const meaning = EMPTY_LANG();
    const sentence = EMPTY_LANG();
    for (const lang of LANGS) {
      word[lang] = get(`word_${lang}`);
      pronunciation[lang] = get(`pronunciation_${lang}`);
      meaning[lang] = get(`meaning_${lang}`);
      sentence[lang] = get(`sentence_${lang}`);
    }

    const rawType = get('wordtype') || get('word_type') || 'NS360';
    const wordType: 'NS360' | 'GQD' = rawType === 'GQD' ? 'GQD' : 'NS360';
    const rawDiff = get('difficulty') || 'Medium';
    const difficulty: 'Low' | 'Medium' | 'High' =
      rawDiff === 'Low' ? 'Low' : rawDiff === 'High' ? 'High' : 'Medium';

    const errors: string[] = [];
    if (!word.te && !word.en) errors.push('Missing word (need te or en)');

    return { word, pronunciation, meaning, sentence, wordType, difficulty, errors };
  }).filter(r => Object.values(r.word).some(v => v)); // skip blank rows
}

export default function CsvImportPage() {
  const { user } = useAuthStore();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState<{ ok: number; failed: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    setDone(null);
    setProgress(0);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      setRows(parseCsv(text));
    };
    reader.readAsText(file);
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) handleFile(file);
  };

  const validRows = rows.filter(r => r.errors.length === 0);

  const handleImport = async () => {
    if (!user || validRows.length === 0) return;
    setImporting(true);
    setProgress(0);
    let ok = 0;
    let failed = 0;
    const emptyNull = Object.fromEntries(LANGS.map(l => [l, null]));

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        await addDoc(collection(db, 'wordBank'), {
          numericId: 0,
          status: 'pending',
          active: false,
          wordType: row.wordType,
          difficulty: row.difficulty,
          word: row.word,
          pronunciation: row.pronunciation,
          meaning: row.meaning,
          sentence: row.sentence,
          imageUrl: null,
          imageUrls: [],
          audioUrl: { word: { ...emptyNull }, meaning: { ...emptyNull }, sentence: { ...emptyNull } },
          submittedBy: user.uid,
          submittedByName: user.email ?? 'content writer',
          submittedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        ok++;
      } catch {
        failed++;
      }
      setProgress(Math.round(((i + 1) / validRows.length) * 100));
    }
    setDone({ ok, failed });
    setImporting(false);
    if (ok > 0) setRows([]);
  };

  return (
    <div className="space-y-lg max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="font-baloo font-extrabold text-xxl text-text-dark">CSV Import</h1>
        <p className="font-baloo text-text-muted">Bulk-upload words — all imported words go to the review queue.</p>
      </div>

      {/* Template download hint */}
      <div className="bg-lavender-light/40 rounded-xl p-md font-baloo text-sm text-primary border border-primary/20">
        <span className="font-semibold">Expected columns:</span>{' '}
        word_te, word_en, word_hi, word_mr, word_es, word_fr, pronunciation_te…fr, meaning_te…fr, sentence_te…fr, wordType, difficulty
      </div>

      {/* Drop zone */}
      <div
        className={`rounded-2xl border-2 border-dashed transition-colors p-xl text-center cursor-pointer ${
          dragOver ? 'border-primary bg-primary/5' : 'border-divider hover:border-primary/40'
        }`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".csv" onChange={onFileInput} className="hidden" />
        <div className="text-4xl mb-sm">📥</div>
        <p className="font-baloo font-semibold text-text-dark">
          {fileName ? fileName : 'Drop CSV here or click to browse'}
        </p>
        <p className="font-baloo text-xs text-text-muted mt-xs">Only .csv files accepted</p>
      </div>

      {/* Preview table */}
      {rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-divider shadow-sm overflow-hidden">
          <div className="px-lg py-md border-b border-divider flex items-center justify-between">
            <div>
              <p className="font-baloo font-bold text-text-dark">
                {rows.length} rows parsed —{' '}
                <span className="text-success">{validRows.length} valid</span>
                {rows.length - validRows.length > 0 && (
                  <span className="text-error">, {rows.length - validRows.length} invalid</span>
                )}
              </p>
            </div>
            <button
              onClick={handleImport}
              disabled={importing || validRows.length === 0}
              className="px-lg py-sm rounded-xl bg-primary text-white font-baloo font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {importing ? `Importing… ${progress}%` : `Import ${validRows.length} Words`}
            </button>
          </div>

          {/* Progress bar */}
          {importing && (
            <div className="h-1 bg-divider">
              <motion.div
                className="h-full bg-primary"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-divider">
                <tr>
                  <th className="px-md py-sm text-left font-baloo font-semibold text-xs text-text-muted">#</th>
                  <th className="px-md py-sm text-left font-baloo font-semibold text-xs text-text-muted">Telugu</th>
                  <th className="px-md py-sm text-left font-baloo font-semibold text-xs text-text-muted">English</th>
                  <th className="px-md py-sm text-left font-baloo font-semibold text-xs text-text-muted">Hindi</th>
                  <th className="px-md py-sm text-left font-baloo font-semibold text-xs text-text-muted">Type</th>
                  <th className="px-md py-sm text-left font-baloo font-semibold text-xs text-text-muted">Difficulty</th>
                  <th className="px-md py-sm text-left font-baloo font-semibold text-xs text-text-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={`border-b border-divider last:border-0 ${row.errors.length ? 'bg-red-50/50' : ''}`}>
                    <td className="px-md py-sm font-baloo text-text-muted">{i + 1}</td>
                    <td className="px-md py-sm font-baloo text-text-dark">{row.word.te || '—'}</td>
                    <td className="px-md py-sm font-baloo text-text-dark">{row.word.en || '—'}</td>
                    <td className="px-md py-sm font-baloo text-text-muted">{row.word.hi || '—'}</td>
                    <td className="px-md py-sm font-baloo text-text-muted">{row.wordType}</td>
                    <td className="px-md py-sm font-baloo text-text-muted">{row.difficulty}</td>
                    <td className="px-md py-sm">
                      {row.errors.length === 0 ? (
                        <span className="text-xs font-baloo font-semibold text-success bg-success/10 px-xs py-0.5 rounded-full">Valid</span>
                      ) : (
                        <span className="text-xs font-baloo text-error" title={row.errors.join(', ')}>⚠ {row.errors[0]}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Done banner */}
      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`rounded-xl px-lg py-md font-baloo font-semibold text-white ${done.failed === 0 ? 'bg-success' : 'bg-amber-500'}`}
          >
            {done.ok} word{done.ok !== 1 ? 's' : ''} submitted for review
            {done.failed > 0 && ` · ${done.failed} failed`}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
