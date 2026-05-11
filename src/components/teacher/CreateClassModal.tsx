import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { createClass } from '../../services/firebase/teacher';
import { getMotherCurriculum } from '../../services/firebase/motherCurriculum';
import type { LanguageCode } from '../../types/firestore';

interface CreateClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (classId: string, code: string) => void;
  teacherId: string;
  schoolId: string;
}

const GRADES = ['1', '2', '3', '4', '5'];

const SUPPORTED_LANGUAGES: { code: LanguageCode; label: string; native: string }[] = [
  { code: 'en', label: 'English',  native: 'English'  },
  { code: 'hi', label: 'Hindi',    native: 'हिन्दी'   },
  { code: 'te', label: 'Telugu',   native: 'తెలుగు'   },
  { code: 'es', label: 'Spanish',  native: 'Español'  },
  { code: 'fr', label: 'French',   native: 'Français' },
];

type Step = 1 | 2 | 3;

export function CreateClassModal({ isOpen, onClose, onSuccess, teacherId, schoolId }: CreateClassModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('1');
  const [homeLanguage, setHomeLanguage] = useState<LanguageCode>('en');
  const [learningLanguage, setLearningLanguage] = useState<LanguageCode>('te');
  const [motherWordCount, setMotherWordCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch mother curriculum word count when reaching step 3
  useEffect(() => {
    if (step !== 3) return;
    getMotherCurriculum(grade).then(mc => {
      setMotherWordCount(mc ? mc.wordIds.length : 0);
    });
  }, [step, grade]);

  function reset() {
    setStep(1);
    setName('');
    setGrade('1');
    setHomeLanguage('en');
    setLearningLanguage('te');
    setMotherWordCount(null);
    setError('');
  }

  function handleClose() {
    if (!loading) { reset(); onClose(); }
  }

  function nextStep() {
    if (step === 1 && !name.trim()) {
      setError('Class name is required');
      return;
    }
    setError('');
    setStep(s => (s + 1) as Step);
  }

  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      const { id, code } = await createClass({
        name: name.trim(),
        grade,
        teacherId,
        schoolId,
        homeLanguage,
        learningLanguage,
      });
      reset();
      onSuccess(id, code);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create class');
    } finally {
      setLoading(false);
    }
  }

  const stepLabels = ['Basics', 'Languages', 'Review'];

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="flex flex-col gap-md sm:gap-lg">

        {/* Header + step indicator */}
        <div>
          <h2 className="font-baloo font-bold text-xl text-text-dark mb-sm">Create New Class</h2>
          <div className="flex items-center gap-sm">
            {stepLabels.map((label, i) => {
              const n = i + 1;
              const done = step > n;
              const active = step === n;
              return (
                <div key={label} className="flex items-center gap-xs">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-baloo font-bold transition-colors ${
                    done    ? 'bg-secondary text-white'
                    : active ? 'bg-primary text-white'
                    :          'bg-divider text-text-muted'
                  }`}>
                    {done ? '✓' : n}
                  </div>
                  <span className={`font-baloo text-xs ${active ? 'text-primary font-semibold' : 'text-text-muted'}`}>
                    {label}
                  </span>
                  {i < stepLabels.length - 1 && (
                    <div className={`h-px w-6 ${done ? 'bg-secondary' : 'bg-divider'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-rose-light border-2 border-error rounded-lg p-md">
            <p className="font-baloo text-sm text-error">{error}</p>
          </div>
        )}

        {/* ── Step 1: Basics ── */}
        {step === 1 && (
          <div className="flex flex-col gap-md">
            <div>
              <label className="font-baloo font-semibold text-sm text-text-dark block mb-sm">
                Class Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && nextStep()}
                placeholder="e.g., Section A, Morning Batch"
                className="w-full px-md py-sm rounded-lg border-2 border-divider bg-white font-baloo text-sm focus:border-primary focus:outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="font-baloo font-semibold text-sm text-text-dark block mb-sm">Grade *</label>
              <div className="grid grid-cols-5 gap-sm">
                {GRADES.map(g => (
                  <button
                    key={g}
                    onClick={() => setGrade(g)}
                    className={`py-sm rounded-lg border-2 font-baloo text-sm transition-colors ${
                      grade === g
                        ? 'border-secondary bg-mint-light text-secondary font-bold'
                        : 'border-divider bg-white text-text-muted hover:border-secondary/50'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Languages ── */}
        {step === 2 && (
          <div className="flex flex-col gap-md">
            <div>
              <label className="font-baloo font-semibold text-sm text-text-dark block mb-sm">
                Home Language
                <span className="font-normal text-text-muted ml-xs">(students' native language)</span>
              </label>
              <div className="grid grid-cols-2 gap-sm">
                {SUPPORTED_LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    onClick={() => setHomeLanguage(l.code)}
                    className={`flex items-center gap-sm px-md py-sm rounded-lg border-2 font-baloo text-sm transition-colors ${
                      homeLanguage === l.code
                        ? 'border-primary bg-lavender-light text-primary font-semibold'
                        : 'border-divider bg-white text-text-muted hover:border-primary/50'
                    }`}
                  >
                    <span className="font-bold">{l.label}</span>
                    <span className="text-xs text-text-muted">{l.native}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="font-baloo font-semibold text-sm text-text-dark block mb-sm">
                Learning Language
                <span className="font-normal text-text-muted ml-xs">(language being taught)</span>
              </label>
              <div className="grid grid-cols-2 gap-sm">
                {SUPPORTED_LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    onClick={() => setLearningLanguage(l.code)}
                    className={`flex items-center gap-sm px-md py-sm rounded-lg border-2 font-baloo text-sm transition-colors ${
                      learningLanguage === l.code
                        ? 'border-secondary bg-mint-light text-secondary font-semibold'
                        : 'border-divider bg-white text-text-muted hover:border-secondary/50'
                    }`}
                  >
                    <span className="font-bold">{l.label}</span>
                    <span className="text-xs text-text-muted">{l.native}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Review ── */}
        {step === 3 && (
          <div className="flex flex-col gap-md">
            <div className="bg-lavender-light rounded-xl p-md border border-primary/10 flex flex-col gap-sm">
              <div className="flex items-center justify-between">
                <span className="font-baloo text-sm text-text-muted">Class Name</span>
                <span className="font-baloo font-bold text-md text-text-dark">{name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-baloo text-sm text-text-muted">Grade</span>
                <span className="font-baloo font-bold text-md text-text-dark">Grade {grade}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-baloo text-sm text-text-muted">Home Language</span>
                <span className="font-baloo font-bold text-md text-text-dark">
                  {SUPPORTED_LANGUAGES.find(l => l.code === homeLanguage)?.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-baloo text-sm text-text-muted">Learning Language</span>
                <span className="font-baloo font-bold text-md text-secondary">
                  {SUPPORTED_LANGUAGES.find(l => l.code === learningLanguage)?.label}
                </span>
              </div>
            </div>

            <div className="bg-mint-light rounded-xl p-md border border-secondary/10">
              <p className="font-baloo text-sm text-text-body">
                📚 <strong>Mother Curriculum:</strong>{' '}
                {motherWordCount === null
                  ? 'Loading...'
                  : `${motherWordCount} words for Grade ${grade}`}
              </p>
              <p className="font-baloo text-xs text-text-muted mt-xs">
                You can customise words after creation from the class detail page.
              </p>
            </div>

            <div className="bg-white rounded-xl p-md border-2 border-divider">
              <p className="font-baloo text-xs text-text-muted">
                💡 A unique 6-character join code will be generated automatically. Share it with students to let them join.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-md justify-between">
          <Button
            title={step === 1 ? 'Cancel' : '← Back'}
            onPress={step === 1 ? handleClose : () => setStep(s => (s - 1) as Step)}
            variant="ghost"
            disabled={loading}
          />
          {step < 3 ? (
            <Button
              title="Next →"
              onPress={nextStep}
              variant="primary"
              disabled={step === 1 && !name.trim()}
            />
          ) : (
            <Button
              title={loading ? 'Creating...' : 'Create Class'}
              onPress={handleSubmit}
              variant="primary"
              disabled={loading}
              loading={loading}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
