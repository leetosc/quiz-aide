import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import Seo from "~/components/Seo/Seo";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { api } from "~/utils/api";
import { useToast } from "~/components/ui/use-toast";
import Spinner from "~/components/Spinner/Spinner";
import Link from "next/link";
import { read, utils, type WorkSheet, writeFile } from "xlsx";
import {
  HiOutlineArrowLeft,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlinePlus,
  HiOutlineCollection,
  HiOutlineSearch,
  HiOutlineCheck,
  HiOutlineX,
  HiOutlineShare,
  HiOutlineEye,
} from "react-icons/hi";
import { MdFileDownload } from "react-icons/md";
import { CheckCircleIcon, XCircleIcon } from "lucide-react";

export default function QuizEditor() {
  const router = useRouter();
  const { id } = router.query;
  const { status: sessionStatus } = useSession();
  const { toast } = useToast();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState("");
  const [addQuestionModalOpen, setAddQuestionModalOpen] = useState(false);
  const [questionSearchQuery, setQuestionSearchQuery] = useState("");
  const [removeQuestionId, setRemoveQuestionId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<
    number | null
  >(null);
  const [editingAnswerIndex, setEditingAnswerIndex] = useState<{
    questionIndex: number;
    answerIndex: number;
  } | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      void router.push("/");
    }
  }, [sessionStatus, router]);

  // Fetch quiz data by shortId first, then by full id
  const {
    data: quiz,
    isLoading: quizLoading,
    refetch: refetchQuiz,
    error: quizError,
  } = api.quiz.getById.useQuery(
    { id: id as string },
    {
      enabled: sessionStatus === "authenticated" && !!id,
    }
  );

  // Fetch questions for adding
  const { data: availableQuestions, isLoading: questionsLoading } =
    api.questionRouter.getBank.useQuery(
      { search: questionSearchQuery || undefined },
      {
        enabled: sessionStatus === "authenticated" && addQuestionModalOpen,
      }
    );

  // Set initial values when quiz loads
  useEffect(() => {
    if (quiz) {
      setEditedTitle(quiz.name);
      setEditedDescription(quiz.description || "");
    }
  }, [quiz]);

  // Mutations
  const updateQuiz = api.quiz.update.useMutation({
    onSuccess: () => {
      toast({ title: "Quiz updated" });
      void refetchQuiz();
    },
    onError: () => {
      toast({ title: "Failed to update quiz", variant: "destructive" });
    },
  });

  const addQuestion = api.quiz.addQuestion.useMutation({
    onSuccess: () => {
      toast({ title: "Question added" });
      void refetchQuiz();
    },
    onError: (error) => {
      if (error.message.includes("Unique constraint")) {
        toast({ title: "Question already in quiz", variant: "destructive" });
      } else {
        toast({ title: "Failed to add question", variant: "destructive" });
      }
    },
  });

  const removeQuestion = api.quiz.removeQuestion.useMutation({
    onSuccess: () => {
      toast({ title: "Question removed" });
      void refetchQuiz();
    },
    onError: () => {
      toast({ title: "Failed to remove question", variant: "destructive" });
    },
  });

  const reorderQuestions = api.quiz.reorderQuestions.useMutation({
    onSuccess: () => {
      void refetchQuiz();
    },
  });

  const updateQuestion = api.questionRouter.update.useMutation({
    onSuccess: () => {
      void refetchQuiz();
    },
  });

  const handleSaveTitle = () => {
    if (quiz && editedTitle.trim()) {
      updateQuiz.mutate({ id: quiz.id, name: editedTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleSaveDescription = () => {
    if (quiz) {
      updateQuiz.mutate({ id: quiz.id, description: editedDescription.trim() });
    }
    setIsEditingDescription(false);
  };

  const moveQuestion = (fromIndex: number, direction: "up" | "down") => {
    if (!quiz) return;

    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= quiz.questions.length) return;

    const newOrder = quiz.questions.map((q) => q.question.id);
    [newOrder[fromIndex], newOrder[toIndex]] = [
      newOrder[toIndex]!,
      newOrder[fromIndex]!,
    ];

    reorderQuestions.mutate({
      quizId: quiz.id,
      questionIds: newOrder,
    });
  };

  const handleUpdateQuestion = (questionIndex: number, newText: string) => {
    if (!quiz) return;
    const question = quiz.questions[questionIndex]?.question;
    if (question) {
      updateQuestion.mutate({
        id: question.id,
        questionText: newText,
      });
    }
    setEditingQuestionIndex(null);
  };

  const handleUpdateAnswer = (
    questionIndex: number,
    answerIndex: number,
    newText: string
  ) => {
    if (!quiz) return;
    const question = quiz.questions[questionIndex]?.question;
    if (question) {
      const updatedAnswers = question.answers.map((a, i) => ({
        id: a.id,
        text: i === answerIndex ? newText : a.answerText,
        isCorrect: a.isCorrect,
      }));
      updateQuestion.mutate({
        id: question.id,
        answers: updatedAnswers,
      });
    }
    setEditingAnswerIndex(null);
  };

  const handleShareClick = () => {
    if (!quiz) return;
    const shareUrl = `${window.location.origin}/quiz/${quiz.shortId}`;
    void navigator.clipboard.writeText(shareUrl);
    toast({ title: "Link copied to clipboard!" });
  };

  const exportToExcel = () => {
    if (!quiz) return;

    setIsExporting(true);
    fetch("/KahootQuizTemplate.xlsx")
      .then((res) => res.arrayBuffer())
      .then((ab) => {
        const wb = read(ab, { type: "buffer" });
        const questionList = [];

        for (const quizQuestion of quiz.questions) {
          const question = quizQuestion.question;
          const correctAnswerPositions = [];

          for (let i = 0; i < question.answers.length; i++) {
            if (question.answers[i]?.isCorrect)
              correctAnswerPositions.push(i + 1);
          }

          const newQuestion: Record<string, string | number> = {
            B: question.questionText,
            C: question.answers[0]?.answerText || "",
            D: question.answers[1]?.answerText || "",
            E: question.answers[2]?.answerText || "",
            F: question.answers[3]?.answerText || "",
            G: quiz.timeLimit,
            H: correctAnswerPositions.join(","),
          };

          questionList.push(newQuestion);
        }

        utils.sheet_add_json(
          wb.Sheets[wb.SheetNames[0] as keyof typeof wb.Sheets] as WorkSheet,
          questionList,
          { origin: "B9", skipHeader: true }
        );

        writeFile(
          wb,
          `${quiz.name.substring(0, 30)}_${
            quiz.questions.length
          }-questions.xlsx`
        );
      })
      .finally(() => {
        setIsExporting(false);
        toast({ title: "Quiz exported successfully" });
      });
  };

  if (sessionStatus === "loading" || quizLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 pt-16 dark:from-gray-900 dark:to-slate-900">
        <Spinner size="lg" />
      </div>
    );
  }

  if (sessionStatus === "unauthenticated") {
    return null;
  }

  if (quizError || !quiz) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 pt-16 dark:from-gray-900 dark:to-slate-900">
        <div className="container mx-auto flex flex-col items-center justify-center px-4 py-12">
          <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
            Quiz not found
          </h1>
          <Link href="/dashboard">
            <Button>
              <HiOutlineArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  // Filter out questions already in the quiz
  const questionsNotInQuiz =
    availableQuestions?.questions.filter(
      (q) => !quiz.questions.some((qQ) => qQ.question.id === q.id)
    ) ?? [];

  return (
    <>
      <Seo title={`Edit: ${quiz.name} - Quiz Aide`} />
      <main className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 pt-16 dark:from-gray-900 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6 flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <HiOutlineArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="text-2xl font-bold"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTitle();
                      if (e.key === "Escape") {
                        setEditedTitle(quiz.name);
                        setIsEditingTitle(false);
                      }
                    }}
                  />
                  <Button size="icon" onClick={handleSaveTitle}>
                    <HiOutlineCheck className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditedTitle(quiz.name);
                      setIsEditingTitle(false);
                    }}
                  >
                    <HiOutlineX className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="group flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {quiz.name}
                  </h1>
                  <button
                    onClick={() => setIsEditingTitle(true)}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <HiOutlinePencil className="h-4 w-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" />
                  </button>
                </div>
              )}
              {/* Description */}
              {isEditingDescription ? (
                <div className="mt-2 flex items-start gap-2">
                  <Textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    placeholder="Add a description..."
                    className="text-sm"
                    rows={2}
                    autoFocus
                  />
                  <Button size="icon" onClick={handleSaveDescription}>
                    <HiOutlineCheck className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditedDescription(quiz.description || "");
                      setIsEditingDescription(false);
                    }}
                  >
                    <HiOutlineX className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingDescription(true)}
                  className="mt-1 text-left text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {quiz.description || "Click to add description..."}
                </button>
              )}
            </div>
          </div>

          {/* Quiz Info & Actions */}
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-cyan-100 px-3 py-1.5 text-sm font-medium text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
              <HiOutlineCollection className="h-4 w-4" />
              {quiz.questions.length} questions
            </div>
            {quiz.topic && (
              <div className="rounded-lg bg-purple-100 px-3 py-1.5 text-sm font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                {quiz.topic}
              </div>
            )}
            <div className="flex-1" />
            <Link href={`/quiz/${quiz.shortId}`}>
              <Button variant="outline">
                <HiOutlineEye className="mr-2 h-4 w-4" />
                View
              </Button>
            </Link>
            <Button variant="outline" onClick={handleShareClick}>
              <HiOutlineShare className="mr-2 h-4 w-4" />
              Share
            </Button>
            <Button
              variant="outline"
              onClick={() => setAddQuestionModalOpen(true)}
            >
              <HiOutlinePlus className="mr-2 h-4 w-4" />
              Add Question
            </Button>
            <Button onClick={exportToExcel} disabled={isExporting}>
              {isExporting ? (
                <Spinner size="md" />
              ) : (
                <MdFileDownload className="mr-2 h-4 w-4" />
              )}
              Export to Kahoot
            </Button>
          </div>

          {/* Questions List */}
          {quiz.questions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <HiOutlineCollection className="mb-4 h-12 w-12 text-gray-400" />
                <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                  No questions yet
                </h3>
                <p className="mb-4 text-center text-gray-600 dark:text-gray-400">
                  Add questions from your question bank
                </p>
                <Button onClick={() => setAddQuestionModalOpen(true)}>
                  <HiOutlinePlus className="mr-2 h-4 w-4" />
                  Add Question
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {quiz.questions.map((quizQuestion, index) => {
                const question = quizQuestion.question;
                const isEditingQuestion = editingQuestionIndex === index;

                return (
                  <Card key={quizQuestion.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Order controls */}
                        <div className="flex flex-col items-center gap-1 pt-1">
                          <span className="text-sm font-medium text-gray-500">
                            {index + 1}
                          </span>
                          <div className="flex flex-col">
                            <button
                              onClick={() => moveQuestion(index, "up")}
                              disabled={index === 0}
                              className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 dark:hover:text-gray-300"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 15l7-7 7 7"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => moveQuestion(index, "down")}
                              disabled={index === quiz.questions.length - 1}
                              className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 dark:hover:text-gray-300"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Question content */}
                        <div className="min-w-0 flex-1">
                          {isEditingQuestion ? (
                            <div className="mb-3">
                              <textarea
                                className="w-full rounded border bg-white p-2 text-sm dark:bg-slate-800 dark:text-white"
                                defaultValue={question.questionText}
                                rows={2}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleUpdateQuestion(
                                      index,
                                      e.currentTarget.value
                                    );
                                  }
                                  if (e.key === "Escape") {
                                    setEditingQuestionIndex(null);
                                  }
                                }}
                                onBlur={(e) =>
                                  handleUpdateQuestion(index, e.target.value)
                                }
                              />
                            </div>
                          ) : (
                            <h3
                              className="mb-3 cursor-pointer font-medium text-gray-900 hover:text-cyan-600 dark:text-white dark:hover:text-cyan-400"
                              onClick={() => setEditingQuestionIndex(index)}
                            >
                              {question.questionText}
                            </h3>
                          )}

                          {/* Answers */}
                          <div className="grid gap-2 sm:grid-cols-2">
                            {question.answers.map((answer, answerIdx) => {
                              const isEditingAnswer =
                                editingAnswerIndex?.questionIndex === index &&
                                editingAnswerIndex?.answerIndex === answerIdx;

                              return (
                                <div
                                  key={answer.id}
                                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                                    answer.isCorrect
                                      ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                      : "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                  }`}
                                >
                                  {answer.isCorrect ? (
                                    <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
                                  ) : (
                                    <XCircleIcon className="h-4 w-4 flex-shrink-0" />
                                  )}
                                  {isEditingAnswer ? (
                                    <input
                                      type="text"
                                      className="flex-1 rounded border bg-white px-2 py-1 text-sm dark:bg-slate-700 dark:text-white"
                                      defaultValue={answer.answerText}
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          handleUpdateAnswer(
                                            index,
                                            answerIdx,
                                            e.currentTarget.value
                                          );
                                        }
                                        if (e.key === "Escape") {
                                          setEditingAnswerIndex(null);
                                        }
                                      }}
                                      onBlur={(e) =>
                                        handleUpdateAnswer(
                                          index,
                                          answerIdx,
                                          e.target.value
                                        )
                                      }
                                    />
                                  ) : (
                                    <span
                                      className="flex-1 cursor-pointer hover:underline"
                                      onClick={() =>
                                        setEditingAnswerIndex({
                                          questionIndex: index,
                                          answerIndex: answerIdx,
                                        })
                                      }
                                    >
                                      {answer.answerText}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Remove button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                          onClick={() => setRemoveQuestionId(question.id)}
                        >
                          <HiOutlineTrash className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Add Question Modal */}
      <Dialog
        open={addQuestionModalOpen}
        onOpenChange={setAddQuestionModalOpen}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Question from Bank</DialogTitle>
            <DialogDescription>
              Select questions to add to this quiz
            </DialogDescription>
          </DialogHeader>

          {/* Search */}
          <div className="relative">
            <HiOutlineSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search questions..."
              value={questionSearchQuery}
              onChange={(e) => setQuestionSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Questions list */}
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {questionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="md" />
              </div>
            ) : questionsNotInQuiz.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                {questionSearchQuery
                  ? "No matching questions found"
                  : "All your questions are already in this quiz"}
              </div>
            ) : (
              questionsNotInQuiz.map((question) => (
                <div
                  key={question.id}
                  className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {question.questionText}
                      </h4>
                      <span className="flex-shrink-0 rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300">
                        {question.subject}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {question.answers.map((answer) => (
                        <span
                          key={answer.id}
                          className={`rounded px-2 py-0.5 text-xs ${
                            answer.isCorrect
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                          }`}
                        >
                          {answer.answerText}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      addQuestion.mutate({
                        quizId: quiz.id,
                        questionId: question.id,
                      });
                    }}
                    disabled={addQuestion.isLoading}
                  >
                    <HiOutlinePlus className="mr-1 h-3 w-3" />
                    Add
                  </Button>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddQuestionModalOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Question Confirmation */}
      <AlertDialog
        open={!!removeQuestionId}
        onOpenChange={() => setRemoveQuestionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this question from the quiz? The
              question will remain in your question bank.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeQuestionId) {
                  removeQuestion.mutate({
                    quizId: quiz.id,
                    questionId: removeQuestionId,
                  });
                  setRemoveQuestionId(null);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
