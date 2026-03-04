import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useCurriculumStore } from '../../stores/curriculumStore';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { WordCreationForm } from '../../components/curriculum/WordCreationForm';
import {
  getCurriculumWords,
  getTeacherCurriculum,
  createTeacherCurriculum,
  addWordToTeacherCurriculum,
  removeWordFromTeacherCurriculum,
} from '../../services/firebase/curriculum';
import type { CurriculumWordDoc, TeacherCurriculumDoc } from '../../types/firestore';

const GRADES = ['1', '2', '3', '4', '5'];

export default function TeacherCurriculumPage() {
  const { user } = useAuth();
  const {
    motherCurriculum,
    listenToMotherCurriculum,
    getFinalWordList,
  } = useCurriculumStore();

  const [selectedGrade, setSelectedGrade] = useState('1');
  const [teacherCurriculum, setTeacherCurriculum] = useState<TeacherCurriculumDoc & { id: string } | null>(null);
  const [words, setWords] = useState<Array<CurriculumWordDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateWord, setShowCreateWord] = useState(false);
  const [processingWordId, setProcessingWordId] = useState<string | null>(null);

  // Listen to mother curriculum
  useEffect(() => {
    const unsubscribe = listenToMotherCurriculum(GRADES);
    return unsubscribe;
  }, []);

  // Load teacher curriculum for selected grade
  useEffect(() => {
    if (user) {
      loadTeacherCurriculum();
    }
  }, [selectedGrade, user]);

  // Load words when curriculum changes
  useEffect(() => {
    if (user) {
      loadWords();
    }
  }, [selectedGrade, motherCurriculum, teacherCurriculum, user]);

  async function loadTeacherCurriculum() {
    if (!user) return;

    setLoading(true);
    try {
      const curriculum = await getTeacherCurriculum(user.uid, selectedGrade);
      setTeacherCurriculum(curriculum);
    } catch (error) {
      console.error('Error loading teacher curriculum:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadWords() {
    if (!user) return;

    const finalWordIds = getFinalWordList(selectedGrade, user.uid);
    if (finalWordIds.length === 0) {
      setWords([]);
      return;
    }

    setLoading(true);
    try {
      const wordsData = await getCurriculumWords(finalWordIds);
      setWords(wordsData);
    } catch (error) {
      console.error('Error loading words:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleWordCreated(wordId: string) {
    if (!user) return;

    try {
      // Check if teacher curriculum exists
      let curriculumId = teacherCurriculum?.id;

      if (!curriculumId) {
        // Create teacher curriculum if it doesn't exist
        curriculumId = await createTeacherCurriculum({
          teacherId: user.uid,
          grade: selectedGrade,
        });
      }

      // Add word to teacher curriculum
      await addWordToTeacherCurriculum(curriculumId, wordId);

      // Reload curriculum and words
      await loadTeacherCurriculum();
    } catch (error: any) {
      console.error('Error adding word:', error);
      alert(error.message || 'Failed to add word');
    }
  }

  async function handleRemoveWord(wordId: string, isMotherWord: boolean) {
    if (!user) return;

    if (!confirm('Are you sure you want to remove this word from your curriculum?')) {
      return;
    }

    setProcessingWordId(wordId);
    try {
      let curriculumId = teacherCurriculum?.id;

      if (!curriculumId) {
        // Create teacher curriculum if it doesn't exist
        curriculumId = await createTeacherCurriculum({
          teacherId: user.uid,
          grade: selectedGrade,
        });
      }

      if (isMotherWord) {
        // Mark as removed from mother curriculum
        await removeWordFromTeacherCurriculum(curriculumId, wordId);
      } else {
        // This is a custom word, we can't delete it but we can remove from addedWordIds
        // For now, just treat it as removing from curriculum
        await removeWordFromTeacherCurriculum(curriculumId, wordId);
      }

      // Reload curriculum and words
      await loadTeacherCurriculum();
    } catch (error: any) {
      console.error('Error removing word:', error);
      alert(error.message || 'Failed to remove word');
    } finally {
      setProcessingWordId(null);
    }
  }

  // Restore word functionality - reserved for future use
  // async function handleRestoreWord(wordId: string) {
  //   if (!user || !teacherCurriculum) return;
  //   setProcessingWordId(wordId);
  //   try {
  //     await restoreWordToTeacherCurriculum(teacherCurriculum.id, wordId);
  //     await loadTeacherCurriculum();
  //   } catch (error: any) {
  //     console.error('Error restoring word:', error);
  //     alert(error.message || 'Failed to restore word');
  //   } finally {
  //     setProcessingWordId(null);
  //   }
  // }

  // Categorize words
  const { motherWords, customWords, removedWordIds } = useMemo(() => {
    const motherWordIds = motherCurriculum[selectedGrade]?.wordIds || [];
    const addedWordIds = teacherCurriculum?.addedWordIds || [];
    const removedIds = teacherCurriculum?.removedWordIds || [];

    return {
      motherWords: words.filter(w => motherWordIds.includes(w.id) && !removedIds.includes(w.id)),
      customWords: words.filter(w => addedWordIds.includes(w.id)),
      removedWordIds: removedIds,
    };
  }, [words, motherCurriculum, teacherCurriculum, selectedGrade]);

  const totalWords = motherWords.length + customWords.length;

  return (
    <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-sm mb-lg sm:mb-xl">
          <div>
            <h1 className="font-baloo font-bold text-xl sm:text-xxl text-text-dark">
              My Curriculum
            </h1>
            <p className="font-baloo text-sm sm:text-body text-text-muted truncate">
              {user?.email} • Teacher
            </p>
          </div>
        </div>

        {/* Info Banner */}
        <Card className="bg-mint-light border-2 border-secondary mb-lg sm:mb-xl">
          <div className="flex items-start gap-sm sm:gap-md">
            <span className="text-2xl sm:text-3xl flex-shrink-0">💡</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-baloo font-bold text-md sm:text-lg text-text-dark mb-xs sm:mb-sm">
                Customize Your Curriculum
              </h3>
              <p className="font-baloo text-sm sm:text-md text-text-body leading-relaxed">
                You can add your own words or remove words from the mother curriculum.
                Your customizations will only affect your classes.
              </p>
            </div>
          </div>
        </Card>

        {/* Grade Selector */}
        <div className="mb-lg sm:mb-xl">
          <h2 className="font-baloo font-bold text-lg sm:text-xl text-text-dark mb-sm sm:mb-md">
            Select Grade
          </h2>
          <div className="flex gap-sm sm:gap-md">
            {GRADES.map((grade) => {
              const finalWords = getFinalWordList(grade, user?.uid);
              const count = finalWords.length;

              return (
                <button
                  key={grade}
                  onClick={() => setSelectedGrade(grade)}
                  className={`flex-1 px-sm sm:px-lg py-sm sm:py-lg rounded-lg sm:rounded-xl border-2 font-baloo transition-colors ${
                    selectedGrade === grade
                      ? 'border-secondary bg-mint-light'
                      : 'border-divider bg-white hover:border-secondary/50'
                  }`}
                >
                  <div className="text-center">
                    <p className={`font-bold text-xl sm:text-hero ${
                      selectedGrade === grade ? 'text-secondary' : 'text-text-dark'
                    }`}>
                      {grade}
                    </p>
                    <p className="text-xs sm:text-md text-text-muted leading-tight">
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
          <h2 className="font-baloo font-bold text-lg sm:text-xl text-text-dark">
            Grade {selectedGrade} Vocabulary ({totalWords} words)
          </h2>
          <Button
            title="Add Custom Word"
            onPress={() => setShowCreateWord(true)}
            variant="accent"
            size="sm"
            icon={<span>📝</span>}
            className="w-auto self-start sm:self-auto"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-sm sm:gap-md mb-md sm:mb-lg">
          <Card className="bg-lavender-light text-center">
            <p className="font-baloo text-xs sm:text-sm text-text-muted mb-xs leading-tight">Mother Curriculum</p>
            <p className="font-baloo font-bold text-lg sm:text-xl text-primary">{motherWords.length}</p>
          </Card>
          <Card className="bg-peach-light text-center">
            <p className="font-baloo text-xs sm:text-sm text-text-muted mb-xs leading-tight">Custom Words</p>
            <p className="font-baloo font-bold text-lg sm:text-xl text-accent">{customWords.length}</p>
          </Card>
          <Card className="bg-rose-light text-center">
            <p className="font-baloo text-xs sm:text-sm text-text-muted mb-xs leading-tight">Removed</p>
            <p className="font-baloo font-bold text-lg sm:text-xl text-error">{removedWordIds.length}</p>
          </Card>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center h-64">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Word List */}
        {!loading && (
          <>
            {/* Mother Curriculum Words */}
            {motherWords.length > 0 && (
              <div className="mb-xl">
                <h3 className="font-baloo font-bold text-lg text-text-dark mb-md flex items-center gap-sm">
                  <span>📚</span> Mother Curriculum ({motherWords.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md sm:gap-lg">
                  {motherWords.map((word) => (
                    <Card key={word.id}>
                      {word.imageUrl && (
                        <div className="mb-md">
                          <img
                            src={word.imageUrl}
                            alt={word.word.en || 'Word image'}
                            className="w-full h-48 object-cover rounded-lg"
                          />
                        </div>
                      )}
                      <div className="mb-md">
                        <h4 className="font-baloo font-bold text-lg text-text-dark mb-sm">
                          {word.word.en || Object.values(word.word).find(w => w) || 'Untitled'}
                        </h4>
                        <div className="flex gap-sm mb-sm">
                          <span className="px-md py-sm bg-lavender-light rounded-full font-baloo text-sm text-primary">
                            {word.wordType}
                          </span>
                          <span className={`px-md py-sm rounded-full font-baloo text-sm ${
                            word.difficulty === 'Low'
                              ? 'bg-mint-light text-secondary'
                              : word.difficulty === 'Medium'
                              ? 'bg-sunshine-light text-warning'
                              : 'bg-rose-light text-error'
                          }`}>
                            {word.difficulty}
                          </span>
                        </div>
                      </div>
                      <Button
                        title={processingWordId === word.id ? 'Removing...' : 'Remove'}
                        onPress={() => handleRemoveWord(word.id, true)}
                        variant="outline"
                        size="sm"
                        disabled={processingWordId === word.id}
                      />
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Words */}
            {customWords.length > 0 && (
              <div className="mb-xl">
                <h3 className="font-baloo font-bold text-lg text-text-dark mb-md flex items-center gap-sm">
                  <span>✨</span> My Custom Words ({customWords.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md sm:gap-lg">
                  {customWords.map((word) => (
                    <Card key={word.id} className="border-2 border-accent">
                      {word.imageUrl && (
                        <div className="mb-md">
                          <img
                            src={word.imageUrl}
                            alt={word.word.en || 'Word image'}
                            className="w-full h-48 object-cover rounded-lg"
                          />
                        </div>
                      )}
                      <div className="mb-md">
                        <h4 className="font-baloo font-bold text-lg text-text-dark mb-sm">
                          {word.word.en || Object.values(word.word).find(w => w) || 'Untitled'}
                        </h4>
                        <div className="flex gap-sm mb-sm">
                          <span className="px-md py-sm bg-peach-light rounded-full font-baloo text-sm text-accent">
                            {word.wordType}
                          </span>
                          <span className={`px-md py-sm rounded-full font-baloo text-sm ${
                            word.difficulty === 'Low'
                              ? 'bg-mint-light text-secondary'
                              : word.difficulty === 'Medium'
                              ? 'bg-sunshine-light text-warning'
                              : 'bg-rose-light text-error'
                          }`}>
                            {word.difficulty}
                          </span>
                        </div>
                      </div>
                      <Button
                        title={processingWordId === word.id ? 'Removing...' : 'Remove'}
                        onPress={() => handleRemoveWord(word.id, false)}
                        variant="outline"
                        size="sm"
                        disabled={processingWordId === word.id}
                      />
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {motherWords.length === 0 && customWords.length === 0 && (
              <Card className="text-center py-lg sm:py-xxl">
                <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-lavender-light flex items-center justify-center mx-auto mb-md">
                  <span className="text-3xl sm:text-5xl">📚</span>
                </div>
                <h3 className="font-baloo font-bold text-lg sm:text-xl text-text-dark mb-sm">
                  No Words Yet
                </h3>
                <p className="font-baloo text-sm sm:text-body text-text-muted mb-md sm:mb-lg">
                  {removedWordIds.length > 0
                    ? 'You have removed all words from the mother curriculum. Add some custom words to get started.'
                    : 'The mother curriculum for Grade ' + selectedGrade + ' is empty. Contact your admin to add words.'}
                </p>
                <Button
                  title="Add Custom Word"
                  onPress={() => setShowCreateWord(true)}
                  variant="primary"
                />
              </Card>
            )}
          </>
        )}

        {/* Word Creation Modal */}
        <WordCreationForm
          isOpen={showCreateWord}
          onClose={() => setShowCreateWord(false)}
          onSuccess={handleWordCreated}
          source="teacher"
          grade={selectedGrade}
        />
    </div>
  );
}
