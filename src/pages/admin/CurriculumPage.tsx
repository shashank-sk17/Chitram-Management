import { useEffect, useState } from 'react';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useCurriculumStore } from '../../stores/curriculumStore';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { WordCreationForm } from '../../components/curriculum/WordCreationForm';
import {
  addWordToMotherCurriculum,
  removeWordFromMotherCurriculum,
  getCurriculumWords,
  createMotherCurriculum,
} from '../../services/firebase/curriculum';
import type { CurriculumWordDoc } from '../../types/firestore';

const GRADES = ['1', '2', '3', '4', '5'];

export default function AdminCurriculumPage() {
  const { user, claims } = useAuth();
  const {
    motherCurriculum,
    listenToMotherCurriculum,
    loadingMotherCurriculum,
  } = useCurriculumStore();

  const [selectedGrade, setSelectedGrade] = useState('1');
  const [words, setWords] = useState<Array<CurriculumWordDoc & { id: string }>>([]);
  const [loadingWords, setLoadingWords] = useState(false);
  const [showCreateWord, setShowCreateWord] = useState(false);
  const [removingWordId, setRemovingWordId] = useState<string | null>(null);

  // Only super admin can manage mother curriculum
  const canManageCurriculum = claims?.role === 'admin';

  // Listen to mother curriculum for all grades
  useEffect(() => {
    if (canManageCurriculum) {
      const unsubscribe = listenToMotherCurriculum(GRADES);
      return unsubscribe;
    }
  }, [canManageCurriculum]);

  // Load words for selected grade
  useEffect(() => {
    loadWordsForGrade();
  }, [selectedGrade, motherCurriculum]);

  async function loadWordsForGrade() {
    const curriculum = motherCurriculum[selectedGrade];
    if (!curriculum || curriculum.wordIds.length === 0) {
      setWords([]);
      return;
    }

    setLoadingWords(true);
    try {
      const wordsData = await getCurriculumWords(curriculum.wordIds);
      setWords(wordsData);
    } catch (error) {
      console.error('Error loading words:', error);
    } finally {
      setLoadingWords(false);
    }
  }

  async function handleWordCreated(wordId: string) {
    try {
      // Check if curriculum exists for this grade
      const curriculum = motherCurriculum[selectedGrade];
      if (!curriculum) {
        // Create curriculum if it doesn't exist
        await createMotherCurriculum(selectedGrade);
      }

      // Add word to mother curriculum
      await addWordToMotherCurriculum(selectedGrade, wordId);

      // Reload words
      await loadWordsForGrade();
    } catch (error: any) {
      console.error('Error adding word to curriculum:', error);
      alert(error.message || 'Failed to add word to curriculum');
    }
  }

  async function handleRemoveWord(wordId: string) {
    if (!confirm('Are you sure you want to remove this word from the curriculum?')) {
      return;
    }

    setRemovingWordId(wordId);
    try {
      await removeWordFromMotherCurriculum(selectedGrade, wordId);
      await loadWordsForGrade();
    } catch (error: any) {
      console.error('Error removing word:', error);
      alert(error.message || 'Failed to remove word');
    } finally {
      setRemovingWordId(null);
    }
  }

  if (!canManageCurriculum) {
    return (
      <div className="flex items-center justify-center">
        <Card className="text-center max-w-lg">
          <div className="w-24 h-24 rounded-full bg-rose-light flex items-center justify-center mx-auto mb-md">
            <span className="text-5xl">🚫</span>
          </div>
          <h2 className="font-baloo font-bold text-xl text-text-dark mb-sm">
            Access Denied
          </h2>
          <p className="font-baloo text-body text-text-muted mb-lg">
            Only Super Admins can manage the mother curriculum
          </p>
          <Button title="Go Back" onPress={() => window.history.back()} variant="primary" />
        </Card>
      </div>
    );
  }

  const currentCurriculum = motherCurriculum[selectedGrade];
  const wordCount = currentCurriculum?.wordIds.length || 0;

  return (
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-sm mb-xl">
          <div>
            <h1 className="font-baloo font-bold text-xl sm:text-xxl text-text-dark">
              Mother Curriculum
            </h1>
            <p className="font-baloo text-sm sm:text-body text-text-muted">
              {user?.email} • Super Admin
            </p>
          </div>
        </div>

        {/* Grade Selector */}
        <div className="mb-xl">
          <h2 className="font-baloo font-bold text-xl text-text-dark mb-md">
            Select Grade
          </h2>
          <div className="flex gap-sm sm:gap-md">
            {GRADES.map((grade) => {
              const curriculum = motherCurriculum[grade];
              const count = curriculum?.wordIds.length || 0;

              return (
                <button
                  key={grade}
                  onClick={() => setSelectedGrade(grade)}
                  className={`flex-1 px-sm sm:px-lg py-sm sm:py-lg rounded-xl border-2 font-baloo transition-colors ${
                    selectedGrade === grade
                      ? 'border-primary bg-lavender-light'
                      : 'border-divider bg-white hover:border-primary/50'
                  }`}
                >
                  <div className="text-center">
                    <p className={`font-bold text-xl sm:text-hero ${
                      selectedGrade === grade ? 'text-primary' : 'text-text-dark'
                    }`}>
                      {grade}
                    </p>
                    <p className="text-xs sm:text-md text-text-muted">
                      {count} {count === 1 ? 'word' : 'words'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-sm mb-lg">
          <h2 className="font-baloo font-bold text-xl text-text-dark">
            Grade {selectedGrade} Vocabulary ({wordCount} words)
          </h2>
          <Button
            title="➕ Add Word"
            onPress={() => setShowCreateWord(true)}
            variant="primary"
            size="sm"
            className="w-auto self-start sm:self-auto"
            icon={<span>📝</span>}
          />
        </div>

        {/* Loading State */}
        {(loadingMotherCurriculum || loadingWords) && (
          <div className="flex justify-center items-center h-64">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Word List */}
        {!loadingMotherCurriculum && !loadingWords && (
          <>
            {words.length === 0 ? (
              <Card className="text-center py-lg sm:py-xxl">
                <div className="w-24 h-24 rounded-full bg-lavender-light flex items-center justify-center mx-auto mb-md">
                  <span className="text-4xl sm:text-5xl">📚</span>
                </div>
                <h3 className="font-baloo font-bold text-lg sm:text-xl text-text-dark mb-sm">
                  No Words Yet
                </h3>
                <p className="font-baloo text-sm sm:text-body text-text-muted mb-lg">
                  Start building the vocabulary for Grade {selectedGrade}
                </p>
                <Button
                  title="Add Your First Word"
                  onPress={() => setShowCreateWord(true)}
                  variant="primary"
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md sm:gap-lg">
                {words.map((word) => (
                  <Card key={word.id} className="relative">
                    {/* Image */}
                    {word.imageUrl && (
                      <div className="mb-md">
                        <img
                          src={word.imageUrl}
                          alt={word.word.en || 'Word image'}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                      </div>
                    )}

                    {/* Word Details */}
                    <div className="mb-md">
                      <h3 className="font-baloo font-bold text-lg text-text-dark mb-sm">
                        {word.word.en || Object.values(word.word).find(w => w) || 'Untitled'}
                      </h3>
                      <div className="flex gap-sm mb-sm">
                        <span className="px-md py-sm bg-lavender-light rounded-full font-baloo text-sm text-primary">
                          {word.category}
                        </span>
                        <span className={`px-md py-sm rounded-full font-baloo text-sm ${
                          word.difficulty === 'easy'
                            ? 'bg-mint-light text-secondary'
                            : word.difficulty === 'medium'
                            ? 'bg-sunshine-light text-warning'
                            : 'bg-rose-light text-error'
                        }`}>
                          {word.difficulty}
                        </span>
                      </div>
                      {word.meaning.en && (
                        <p className="font-baloo text-md text-text-muted">
                          {word.meaning.en}
                        </p>
                      )}
                    </div>

                    {/* Translations */}
                    <div className="mb-md">
                      <p className="font-baloo text-sm text-text-muted mb-sm">Translations:</p>
                      <div className="flex flex-wrap gap-xs">
                        {Object.entries(word.translations)
                          .filter(([_, text]) => text)
                          .slice(0, 4)
                          .map(([lang, text]) => (
                            <span
                              key={lang}
                              className="px-sm py-xs bg-peach-light rounded font-baloo text-xs text-text-body"
                            >
                              {lang.toUpperCase()}: {text}
                            </span>
                          ))}
                      </div>
                    </div>

                    {/* Remove Button */}
                    <Button
                      title={removingWordId === word.id ? 'Removing...' : 'Remove'}
                      onPress={() => handleRemoveWord(word.id)}
                      variant="danger"
                      size="sm"
                      disabled={removingWordId === word.id}
                      loading={removingWordId === word.id}
                    />
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Word Creation Modal */}
        <WordCreationForm
          isOpen={showCreateWord}
          onClose={() => setShowCreateWord(false)}
          onSuccess={handleWordCreated}
          source="mother"
          grade={selectedGrade}
        />
      </div>
  );
}
