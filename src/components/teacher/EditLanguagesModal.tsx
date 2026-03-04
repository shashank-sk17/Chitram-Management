import { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { updateClassLanguages } from '../../services/firebase/teacher';
import type { LanguageCode } from '../../types/firestore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  currentHomeLanguage: LanguageCode;
  currentLearningLanguage: LanguageCode;
}

const SUPPORTED_LANGUAGES: { code: LanguageCode; label: string; native: string }[] = [
  { code: 'en', label: 'English',  native: 'English'  },
  { code: 'hi', label: 'Hindi',    native: 'हिन्दी'   },
  { code: 'te', label: 'Telugu',   native: 'తెలుగు'   },
  { code: 'mr', label: 'Marathi',  native: 'मराठी'    },
  { code: 'es', label: 'Spanish',  native: 'Español'  },
  { code: 'fr', label: 'French',   native: 'Français' },
];

export function EditLanguagesModal({ isOpen, onClose, classId, currentHomeLanguage, currentLearningLanguage }: Props) {
  const [homeLanguage, setHomeLanguage] = useState<LanguageCode>(currentHomeLanguage);
  const [learningLanguage, setLearningLanguage] = useState<LanguageCode>(currentLearningLanguage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await updateClassLanguages(classId, homeLanguage, learningLanguage);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to update languages');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose()}>
      <div className="flex flex-col gap-md">
        <div>
          <h2 className="font-baloo font-bold text-xl text-text-dark mb-xs">Edit Class Languages</h2>
          <p className="font-baloo text-sm text-text-muted">
            Changes apply to new sign-ins. Existing sessions are unaffected until the next login.
          </p>
        </div>

        {error && (
          <div className="bg-rose-light border-2 border-error rounded-lg p-md">
            <p className="font-baloo text-sm text-error">{error}</p>
          </div>
        )}

        {/* Home Language */}
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

        {/* Learning Language */}
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

        {/* Actions */}
        <div className="flex justify-between gap-md">
          <Button title="Cancel" onPress={onClose} variant="ghost" disabled={saving} />
          <Button
            title={saving ? 'Saving...' : 'Save Languages'}
            onPress={handleSave}
            variant="primary"
            disabled={saving}
          />
        </div>
      </div>
    </Modal>
  );
}
