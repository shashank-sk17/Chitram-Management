import { useState, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { functions } from '../../config/firebase';
import { updateCustomWordImage, updateCustomWordSentences, uploadCurriculumImage } from '../../services/firebase/curriculum';
import type { CurriculumWordDoc } from '../../types/firestore';

interface UnsplashResult {
  id: string;
  thumb: string;
  full: string;
  alt: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  word: CurriculumWordDoc & { id: string };
  learningLanguage: string;
  homeLanguage: string;
}

export function CustomWordEditModal({ isOpen, onClose, word, learningLanguage, homeLanguage }: Props) {
  const learnWord = word.word?.[learningLanguage] || word.word?.te || '';
  const homeWord  = word.word?.[homeLanguage]     || word.word?.en || '';

  // Image state
  const [unsplashQuery, setUnsplashQuery] = useState(word.word?.en || '');
  const [unsplashResults, setUnsplashResults] = useState<UnsplashResult[]>([]);
  const [searchingImages, setSearchingImages] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(word.imageUrl ?? '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sentence state
  const [sentenceTe, setSentenceTe] = useState(word.sentence?.[learningLanguage] || word.sentence?.te || '');
  const [sentenceEn, setSentenceEn] = useState(word.sentence?.[homeLanguage]     || word.sentence?.en || '');
  const [generatingTe, setGeneratingTe] = useState(false);
  const [generatingEn, setGeneratingEn] = useState(false);
  const [savingSentences, setSavingSentences] = useState(false);
  const [sentenceSaved, setSentenceSaved] = useState(false);
  const [error, setError] = useState('');

  // ── Image ─────────────────────────────────────────────────────────────────

  async function handleUnsplashSearch() {
    if (!unsplashQuery.trim()) return;
    setSearchingImages(true);
    setUnsplashResults([]);
    setError('');
    try {
      const fn = httpsCallable<{ query: string }, { results: UnsplashResult[] }>(functions, 'searchUnsplash');
      const result = await fn({ query: unsplashQuery.trim() });
      setUnsplashResults(result.data.results ?? []);
    } catch (e: any) {
      setError('Image search failed. Check Unsplash API key is configured.');
    } finally {
      setSearchingImages(false);
    }
  }

  async function handlePickUnsplash(img: UnsplashResult) {
    setSavingImage(true);
    setError('');
    try {
      await updateCustomWordImage(word.id, img.full);
      setCurrentImageUrl(img.full);
      setUnsplashResults([]);
    } catch (e: any) {
      setError('Failed to save image.');
    } finally {
      setSavingImage(false);
    }
  }

  async function handleUpload(file: File) {
    setSavingImage(true);
    setError('');
    try {
      const url = await uploadCurriculumImage(file, `${word.id}-${Date.now()}.${file.name.split('.').pop()}`);
      await updateCustomWordImage(word.id, url);
      setCurrentImageUrl(url);
    } catch (e: any) {
      setError(e.message || 'Upload failed.');
    } finally {
      setSavingImage(false);
    }
  }

  // ── Sentences ─────────────────────────────────────────────────────────────

  async function generateFor(lang: string, setter: (s: string) => void, setGenerating: (b: boolean) => void) {
    setGenerating(true);
    setError('');
    try {
      const fn = httpsCallable<
        { wordTe: string; wordEn: string; targetLanguage: string },
        { sentence: string }
      >(functions, 'generateSentence');
      const res = await fn({
        wordTe: word.word?.te || learnWord,
        wordEn: word.word?.en || homeWord,
        targetLanguage: lang,
      });
      setter(res.data.sentence ?? '');
    } catch (e: any) {
      setError('Sentence generation failed. Check Anthropic API key is configured.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveSentences() {
    setSavingSentences(true);
    setError('');
    try {
      const sentences: Record<string, string> = {};
      if (sentenceTe.trim()) sentences[learningLanguage] = sentenceTe.trim();
      if (sentenceEn.trim()) sentences[homeLanguage]     = sentenceEn.trim();
      await updateCustomWordSentences(word.id, sentences);
      setSentenceSaved(true);
      setTimeout(() => setSentenceSaved(false), 2000);
    } catch (e: any) {
      setError('Failed to save sentences.');
    } finally {
      setSavingSentences(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col gap-lg" style={{ maxHeight: '85vh', overflowY: 'auto' }}>

        {/* Header */}
        <div className="flex items-center gap-sm">
          <div>
            <div className="flex items-center gap-sm">
              <span className="font-baloo font-bold text-xl text-text-dark">{learnWord}</span>
              <span className="font-baloo text-md text-text-muted">/ {homeWord}</span>
              <span className="font-baloo text-xs bg-mint-light text-secondary px-sm py-xs rounded-full font-semibold">Custom</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-rose-light border border-error rounded-lg px-md py-sm">
            <p className="font-baloo text-sm text-error">{error}</p>
          </div>
        )}

        {/* ── Image section ── */}
        <div className="border-2 border-divider rounded-xl overflow-hidden">
          <div className="px-md py-sm bg-lavender-light/30 border-b border-divider">
            <p className="font-baloo font-semibold text-sm text-text-dark">Image</p>
          </div>
          <div className="p-md flex flex-col gap-md">

            {/* Current image */}
            {currentImageUrl && (
              <div className="flex items-center gap-md">
                <img
                  src={currentImageUrl}
                  alt={homeWord}
                  className="w-20 h-20 object-cover rounded-lg border-2 border-divider flex-shrink-0"
                />
                <span className="font-baloo text-xs text-text-muted break-all line-clamp-2">{currentImageUrl}</span>
              </div>
            )}

            {/* Unsplash search */}
            <div className="flex gap-sm">
              <input
                type="text"
                value={unsplashQuery}
                onChange={e => setUnsplashQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUnsplashSearch()}
                placeholder="Search Unsplash..."
                className="flex-1 px-md py-sm rounded-lg border-2 border-divider font-baloo text-sm focus:border-primary focus:outline-none"
              />
              <button
                onClick={handleUnsplashSearch}
                disabled={searchingImages || !unsplashQuery.trim()}
                className="px-md py-sm rounded-lg bg-primary text-white font-baloo text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {searchingImages ? '...' : '🔍 Search'}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={savingImage}
                className="px-md py-sm rounded-lg border-2 border-divider text-text-muted font-baloo text-sm font-semibold hover:border-primary/50 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                📤 Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
              />
            </div>

            {/* Unsplash grid */}
            {unsplashResults.length > 0 && (
              <div className="grid grid-cols-3 gap-xs">
                {unsplashResults.map(img => (
                  <button
                    key={img.id}
                    onClick={() => handlePickUnsplash(img)}
                    disabled={savingImage}
                    className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-all disabled:opacity-50"
                  >
                    <img src={img.thumb} alt={img.alt} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {savingImage && (
              <p className="font-baloo text-xs text-primary animate-pulse text-center">Saving image...</p>
            )}
          </div>
        </div>

        {/* ── Usage sentences section ── */}
        <div className="border-2 border-divider rounded-xl overflow-hidden">
          <div className="px-md py-sm bg-lavender-light/30 border-b border-divider">
            <p className="font-baloo font-semibold text-sm text-text-dark">Usage Sentences</p>
          </div>
          <div className="p-md flex flex-col gap-md">

            {/* Learning language sentence */}
            <div>
              <label className="font-baloo text-xs font-semibold text-text-muted uppercase tracking-wide block mb-xs">
                {learningLanguage.toUpperCase()} Sentence
              </label>
              <div className="flex gap-sm">
                <input
                  type="text"
                  value={sentenceTe}
                  onChange={e => setSentenceTe(e.target.value)}
                  placeholder={`Sentence in ${learningLanguage}...`}
                  className="flex-1 px-md py-sm rounded-lg border-2 border-divider font-baloo text-sm focus:border-primary focus:outline-none"
                />
                <button
                  onClick={() => generateFor(learningLanguage, setSentenceTe, setGeneratingTe)}
                  disabled={generatingTe}
                  className="px-md py-sm rounded-lg border-2 border-secondary text-secondary font-baloo text-sm font-semibold hover:bg-mint-light disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {generatingTe ? '...' : '✨ Generate'}
                </button>
              </div>
            </div>

            {/* Home language sentence */}
            <div>
              <label className="font-baloo text-xs font-semibold text-text-muted uppercase tracking-wide block mb-xs">
                {homeLanguage.toUpperCase()} Sentence
              </label>
              <div className="flex gap-sm">
                <input
                  type="text"
                  value={sentenceEn}
                  onChange={e => setSentenceEn(e.target.value)}
                  placeholder={`Sentence in ${homeLanguage}...`}
                  className="flex-1 px-md py-sm rounded-lg border-2 border-divider font-baloo text-sm focus:border-primary focus:outline-none"
                />
                <button
                  onClick={() => generateFor(homeLanguage, setSentenceEn, setGeneratingEn)}
                  disabled={generatingEn}
                  className="px-md py-sm rounded-lg border-2 border-secondary text-secondary font-baloo text-sm font-semibold hover:bg-mint-light disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {generatingEn ? '...' : '✨ Generate'}
                </button>
              </div>
            </div>

            <Button
              title={savingSentences ? 'Saving...' : sentenceSaved ? '✓ Saved!' : 'Save Sentences'}
              onPress={handleSaveSentences}
              variant={sentenceSaved ? 'outline' : 'primary'}
              disabled={savingSentences}
            />
          </div>
        </div>

        {/* Close */}
        <div className="flex justify-end">
          <Button title="Done" onPress={onClose} variant="ghost" />
        </div>
      </div>
    </Modal>
  );
}
