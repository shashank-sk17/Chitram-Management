import { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuthStore } from '../../stores/authStore';
import { createCurriculumWord, uploadCurriculumImage } from '../../services/firebase/curriculum';
import type { LanguageCode } from '../../types/firestore';

interface WordCreationFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (wordId: string) => void;
  source: 'mother' | 'teacher';
  grade?: string;
}

type FormStep = 1 | 2 | 3 | 4;

const SUPPORTED_LANGUAGES: Array<{ code: LanguageCode; name: string }> = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi'   },
  { code: 'te', name: 'Telugu'  },
  { code: 'mr', name: 'Marathi' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French'  },
];

export function WordCreationForm({ isOpen, onClose, onSuccess, source }: WordCreationFormProps) {
  const { user } = useAuthStore();
  const [currentStep, setCurrentStep] = useState<FormStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [sourceLang, setSourceLang] = useState<LanguageCode>('en');
  const [inputMethod, setInputMethod] = useState<'text' | 'voice'>('text');
  const [wordText, setWordText] = useState('');
  const [translations, setTranslations] = useState<Partial<Record<LanguageCode, string>>>({});
  const [meanings, setMeanings] = useState<Partial<Record<LanguageCode, string>>>({});
  const [sentences, setSentences] = useState<Partial<Record<LanguageCode, string>>>({});
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [imageUrl, setImageUrl] = useState('');

  // Voice recording state (placeholder)
  const [isRecording, setIsRecording] = useState(false);

  function handleClose() {
    if (!loading) {
      resetForm();
      onClose();
    }
  }

  function resetForm() {
    setCurrentStep(1);
    setSourceLang('en');
    setInputMethod('text');
    setWordText('');
    setTranslations({});
    setMeanings({});
    setSentences({});
    setCategory('');
    setDifficulty('medium');
    setImageUrl('');
    setError('');
  }

  async function handleStep1Next() {
    if (!wordText.trim()) {
      setError('Please enter a word or record your voice');
      return;
    }

    // Auto-set translation for source language
    setTranslations({ [sourceLang]: wordText.trim() });
    setError('');
    setCurrentStep(2);
  }

  function handleStep2Next() {
    // Validate at least one translation exists
    const hasTranslation = Object.values(translations).some(t => t && t.trim());
    if (!hasTranslation) {
      setError('Please provide at least one translation');
      return;
    }

    setError('');
    setCurrentStep(3);
  }

  async function handleImageUpload(file: File) {
    setError('');
    setLoading(true);

    try {
      const url = await uploadCurriculumImage(file, file.name);
      setImageUrl(url);
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setLoading(false);
    }
  }

  function handleStep3Next() {
    if (!imageUrl) {
      setError('Please upload an image or generate one');
      return;
    }

    if (!category.trim()) {
      setError('Please enter a category');
      return;
    }

    setError('');
    setCurrentStep(4);
  }

  async function handleSubmit() {
    if (!user) {
      setError('You must be logged in');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Build complete word object
      const wordData: Record<LanguageCode, string> = {} as Record<LanguageCode, string>;
      const translationData: Record<LanguageCode, string> = {} as Record<LanguageCode, string>;
      const meaningData: Record<LanguageCode, string> = {} as Record<LanguageCode, string>;
      const sentenceData: Record<LanguageCode, string> = {} as Record<LanguageCode, string>;

      SUPPORTED_LANGUAGES.forEach(({ code }) => {
        wordData[code] = translations[code] || '';
        translationData[code] = translations[code] || '';
        meaningData[code] = meanings[code] || '';
        sentenceData[code] = sentences[code] || '';
      });

      const wordId = await createCurriculumWord({
        source,
        createdBy: user.uid,
        word: wordData,
        translations: translationData,
        meaning: meaningData,
        sentence: sentenceData,
        imageUrl,
        category: category.trim(),
        difficulty,
      });

      resetForm();
      onSuccess(wordId);
      onClose();
    } catch (err: any) {
      console.error('Error creating word:', err);
      setError(err.message || 'Failed to create word');
    } finally {
      setLoading(false);
    }
  }

  function handleVoiceRecord() {
    // TODO: Implement voice recording with Cloud Function
    alert('Voice recording feature coming soon!\n\nThis will require a Cloud Function to:\n1. Record audio from microphone\n2. Convert speech to text (Google Cloud Speech-to-Text)\n3. Auto-populate the word field');
    setIsRecording(!isRecording);
  }

  function handleAutoTranslate() {
    // TODO: Implement auto-translation with Cloud Function
    alert('Auto-translation feature coming soon!\n\nThis will require a Cloud Function to:\n1. Translate source text to all supported languages (Google Translate API)\n2. Auto-populate translation fields');
  }

  function handleImageGenerate() {
    // TODO: Implement image generation with Cloud Function
    alert('Image generation feature coming soon!\n\nThis will require a Cloud Function to:\n1. Generate image from word context (Stability AI / DALL-E)\n2. Upload to Firebase Storage\n3. Return download URL');
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="flex flex-col gap-md sm:gap-lg">
        {/* Header with Step Indicator */}
        <div>
          <h2 className="font-baloo font-bold text-xl text-text-dark mb-sm">
            Create New Word - Step {currentStep} of 4
          </h2>
          <div className="flex gap-sm">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`h-1 flex-1 rounded-full ${
                  step <= currentStep ? 'bg-primary' : 'bg-divider'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-rose-light border-2 border-error rounded-lg p-md">
            <p className="font-baloo text-sm sm:text-md text-error">{error}</p>
          </div>
        )}

        {/* Step 1: Text Input or Voice Recording */}
        {currentStep === 1 && (
          <div className="flex flex-col gap-lg">
            <p className="font-baloo text-sm sm:text-md text-text-muted">
              Enter a word or record your voice
            </p>

            {/* Source Language */}
            <div>
              <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
                Source Language *
              </label>
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value as LanguageCode)}
                className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
                disabled={loading}
              >
                {SUPPORTED_LANGUAGES.map(({ code, name }) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Input Method Selection */}
            <div>
              <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
                Input Method
              </label>
              <div className="flex gap-md">
                <button
                  onClick={() => setInputMethod('text')}
                  className={`flex-1 px-md py-sm sm:py-md rounded-lg border-2 font-baloo text-sm sm:text-body transition-colors ${
                    inputMethod === 'text'
                      ? 'border-primary bg-lavender-light text-primary'
                      : 'border-divider bg-white text-text-muted'
                  }`}
                >
                  ✏️ Text
                </button>
                <button
                  onClick={() => setInputMethod('voice')}
                  className={`flex-1 px-md py-sm sm:py-md rounded-lg border-2 font-baloo text-sm sm:text-body transition-colors ${
                    inputMethod === 'voice'
                      ? 'border-primary bg-lavender-light text-primary'
                      : 'border-divider bg-white text-text-muted'
                  }`}
                >
                  🎤 Voice
                </button>
              </div>
            </div>

            {/* Text Input */}
            {inputMethod === 'text' && (
              <div>
                <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
                  Word *
                </label>
                <input
                  type="text"
                  value={wordText}
                  onChange={(e) => setWordText(e.target.value)}
                  placeholder="Enter word..."
                  className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
                  disabled={loading}
                />
              </div>
            )}

            {/* Voice Recording */}
            {inputMethod === 'voice' && (
              <div className="bg-sunshine-light border-2 border-warning rounded-lg p-lg text-center">
                <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center mx-auto mb-md">
                  <span className="text-5xl">🎤</span>
                </div>
                <Button
                  title={isRecording ? '⏹️ Stop Recording' : '🎤 Start Recording'}
                  onPress={handleVoiceRecord}
                  variant={isRecording ? 'danger' : 'primary'}
                  disabled={loading}
                />
                {wordText && (
                  <p className="font-baloo text-body text-text-dark mt-md">
                    Detected: <strong>{wordText}</strong>
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-md justify-end">
              <Button title="Cancel" onPress={handleClose} variant="ghost" disabled={loading} />
              <Button
                title="Next"
                onPress={handleStep1Next}
                variant="primary"
                disabled={!wordText.trim() || loading}
              />
            </div>
          </div>
        )}

        {/* Step 2: Translations */}
        {currentStep === 2 && (
          <div className="flex flex-col gap-lg">
            <div className="flex items-center justify-between">
              <p className="font-baloo text-sm sm:text-md text-text-muted">
                Provide translations for different languages
              </p>
              <Button
                title="🪄 Auto-translate"
                onPress={handleAutoTranslate}
                variant="secondary"
                size="sm"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-md max-h-96 overflow-y-auto">
              {SUPPORTED_LANGUAGES.map(({ code, name }) => (
                <div key={code}>
                  <label className="font-baloo font-semibold text-sm text-text-dark block mb-sm">
                    {name} {code === sourceLang && '*'}
                  </label>
                  <input
                    type="text"
                    value={translations[code] || ''}
                    onChange={(e) => setTranslations({ ...translations, [code]: e.target.value })}
                    placeholder={`${name} translation...`}
                    className="w-full px-md py-sm rounded-lg border-2 border-divider bg-white font-baloo text-md focus:border-primary focus:outline-none"
                    disabled={loading || code === sourceLang}
                  />
                </div>
              ))}
            </div>

            {/* Meanings */}
            <div>
              <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
                Meaning (Optional)
              </label>
              <textarea
                value={meanings[sourceLang] || ''}
                onChange={(e) => setMeanings({ ...meanings, [sourceLang]: e.target.value })}
                placeholder="Brief meaning or definition..."
                rows={2}
                className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none resize-none"
                disabled={loading}
              />
            </div>

            {/* Sentence */}
            <div>
              <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
                Example Sentence (Optional)
              </label>
              <textarea
                value={sentences[sourceLang] || ''}
                onChange={(e) => setSentences({ ...sentences, [sourceLang]: e.target.value })}
                placeholder="Example sentence using this word..."
                rows={2}
                className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none resize-none"
                disabled={loading}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-md justify-end">
              <Button title="Back" onPress={() => setCurrentStep(1)} variant="ghost" disabled={loading} />
              <Button
                title="Next"
                onPress={handleStep2Next}
                variant="primary"
                disabled={loading}
              />
            </div>
          </div>
        )}

        {/* Step 3: Image Upload */}
        {currentStep === 3 && (
          <div className="flex flex-col gap-lg">
            <p className="font-baloo text-sm sm:text-md text-text-muted">
              Upload an image (256×256 pixels) or generate one with AI
            </p>

            {/* Category and Difficulty */}
            <div className="grid grid-cols-2 gap-md">
              <div>
                <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
                  Category *
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g., Animals, Food, Colors"
                  className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
                  Difficulty *
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                  className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-body focus:border-primary focus:outline-none"
                  disabled={loading}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            {/* Image Upload/Generate */}
            <div className="flex flex-col sm:flex-row gap-md">
              <div className="flex-1">
                <label className="font-baloo font-semibold text-sm sm:text-md text-text-dark block mb-sm">
                  Upload Image (256×256px) *
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                  className="w-full px-md py-sm sm:py-md rounded-lg border-2 border-divider bg-white font-baloo text-sm sm:text-md focus:border-primary focus:outline-none"
                  disabled={loading}
                />
                <p className="font-baloo text-sm text-text-muted mt-sm">
                  Image must be exactly 256×256 pixels
                </p>
              </div>
              <div className="flex items-end">
                <Button
                  title="🎨 Generate"
                  onPress={handleImageGenerate}
                  variant="accent"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Image Preview */}
            {imageUrl && (
              <div className="bg-lavender-light rounded-lg p-md">
                <p className="font-baloo text-sm text-text-dark mb-md">Image Preview:</p>
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-64 h-64 rounded-lg mx-auto border-2 border-primary"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-md justify-end">
              <Button title="Back" onPress={() => setCurrentStep(2)} variant="ghost" disabled={loading} />
              <Button
                title="Next"
                onPress={handleStep3Next}
                variant="primary"
                disabled={!imageUrl || !category.trim() || loading}
              />
            </div>
          </div>
        )}

        {/* Step 4: Review & Submit */}
        {currentStep === 4 && (
          <div className="flex flex-col gap-lg">
            <p className="font-baloo text-sm sm:text-md text-text-muted">
              Review your word before submitting
            </p>

            <div className="bg-lavender-light rounded-lg p-md sm:p-lg">
              {/* Image */}
              <div className="flex justify-center mb-md">
                <img
                  src={imageUrl}
                  alt={wordText}
                  className="w-32 h-32 sm:w-48 sm:h-48 rounded-lg border-2 border-primary"
                />
              </div>

              {/* Word Details */}
              <div className="grid grid-cols-2 gap-md mb-md">
                <div>
                  <p className="font-baloo text-sm text-text-muted">Word ({sourceLang})</p>
                  <p className="font-baloo font-semibold text-body text-text-dark">{wordText}</p>
                </div>
                <div>
                  <p className="font-baloo text-sm text-text-muted">Category</p>
                  <p className="font-baloo font-semibold text-body text-text-dark">{category}</p>
                </div>
                <div>
                  <p className="font-baloo text-sm text-text-muted">Difficulty</p>
                  <p className="font-baloo font-semibold text-body text-text-dark capitalize">{difficulty}</p>
                </div>
                <div>
                  <p className="font-baloo text-sm text-text-muted">Source</p>
                  <p className="font-baloo font-semibold text-body text-text-dark capitalize">{source}</p>
                </div>
              </div>

              {/* Translations */}
              <div className="mb-md">
                <p className="font-baloo text-sm text-text-muted mb-sm">Translations</p>
                <div className="grid grid-cols-2 gap-sm">
                  {Object.entries(translations).map(([lang, text]) => (
                    text && (
                      <p key={lang} className="font-baloo text-md text-text-body">
                        <strong>{lang.toUpperCase()}:</strong> {text}
                      </p>
                    )
                  ))}
                </div>
              </div>

              {/* Meaning & Sentence */}
              {meanings[sourceLang] && (
                <div className="mb-md">
                  <p className="font-baloo text-sm text-text-muted">Meaning</p>
                  <p className="font-baloo text-md text-text-body">{meanings[sourceLang]}</p>
                </div>
              )}
              {sentences[sourceLang] && (
                <div>
                  <p className="font-baloo text-sm text-text-muted">Example Sentence</p>
                  <p className="font-baloo text-md text-text-body">{sentences[sourceLang]}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-md justify-end">
              <Button title="Back" onPress={() => setCurrentStep(3)} variant="ghost" disabled={loading} />
              <Button
                title={loading ? 'Creating...' : 'Create Word'}
                onPress={handleSubmit}
                variant="primary"
                disabled={loading}
                loading={loading}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
