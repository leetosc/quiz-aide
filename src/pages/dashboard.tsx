import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import Seo from "~/components/Seo/Seo";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
import {
  HiOutlineSparkles,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineStar,
  HiStar,
  HiOutlineSearch,
  HiOutlinePlus,
  HiOutlineCalendar,
  HiOutlineClock,
  HiOutlineCollection,
  HiOutlineDownload,
  HiOutlineEye,
} from "react-icons/hi";
import { CheckCircleIcon, XCircleIcon } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [starredOnly, setStarredOnly] = useState(false);
  const [deleteQuizId, setDeleteQuizId] = useState<string | null>(null);
  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null);
  const [addToQuizModalOpen, setAddToQuizModalOpen] = useState(false);
  const [selectedQuestionForQuiz, setSelectedQuestionForQuiz] = useState<
    string | null
  >(null);

  // Redirect if not logged in
  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      void router.push("/");
    }
  }, [sessionStatus, router]);

  // Fetch quizzes
  const {
    data: quizzesData,
    isLoading: quizzesLoading,
    refetch: refetchQuizzes,
  } = api.quiz.getAll.useQuery(undefined, {
    enabled: sessionStatus === "authenticated",
  });

  // Fetch questions (question bank)
  const {
    data: questionsData,
    isLoading: questionsLoading,
    refetch: refetchQuestions,
  } = api.questionRouter.getBank.useQuery(
    {
      search: searchQuery || undefined,
      subject: subjectFilter !== "all" ? subjectFilter : undefined,
      starredOnly: starredOnly || undefined,
    },
    {
      enabled: sessionStatus === "authenticated",
    }
  );

  // Fetch subjects for filter
  const { data: subjects } = api.questionRouter.getSubjects.useQuery(
    undefined,
    {
      enabled: sessionStatus === "authenticated",
    }
  );

  // Mutations
  const deleteQuiz = api.quiz.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Quiz deleted successfully" });
      void refetchQuizzes();
    },
    onError: () => {
      toast({ title: "Failed to delete quiz", variant: "destructive" });
    },
  });

  const deleteQuestion = api.questionRouter.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Question deleted successfully" });
      void refetchQuestions();
    },
    onError: () => {
      toast({ title: "Failed to delete question", variant: "destructive" });
    },
  });

  const toggleStar = api.questionRouter.toggleStar.useMutation({
    onSuccess: () => {
      void refetchQuestions();
    },
  });

  const addQuestionToQuiz = api.quiz.addQuestion.useMutation({
    onSuccess: () => {
      toast({ title: "Question added to quiz" });
      setAddToQuizModalOpen(false);
      setSelectedQuestionForQuiz(null);
      void refetchQuizzes();
    },
    onError: () => {
      toast({
        title: "Failed to add question to quiz",
        variant: "destructive",
      });
    },
  });

  if (sessionStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 pt-16 dark:from-gray-900 dark:to-slate-900">
        <Spinner size="lg" />
      </div>
    );
  }

  if (sessionStatus === "unauthenticated") {
    return null;
  }

  const quizzes = quizzesData?.quizzes ?? [];
  const questions = questionsData?.questions ?? [];

  return (
    <>
      <Seo title="Dashboard - Quiz Aide" />
      <main className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 pt-16 dark:from-gray-900 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Dashboard
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Manage your quizzes and question bank
              </p>
            </div>
            <Link href="/">
              <Button>
                <HiOutlineSparkles className="mr-2 h-4 w-4" />
                Generate New Quiz
              </Button>
            </Link>
          </div>

          <Tabs defaultValue="quizzes" className="w-full">
            <TabsList className="mb-6 grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="quizzes">
                <HiOutlineCollection className="mr-2 h-4 w-4" />
                My Quizzes
              </TabsTrigger>
              <TabsTrigger value="questions">
                <HiOutlineCollection className="mr-2 h-4 w-4" />
                Question Bank
              </TabsTrigger>
            </TabsList>

            {/* My Quizzes Tab */}
            <TabsContent value="quizzes">
              {quizzesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner size="lg" />
                </div>
              ) : quizzes.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <HiOutlineCollection className="mb-4 h-12 w-12 text-gray-400" />
                    <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                      No quizzes yet
                    </h3>
                    <p className="mb-4 text-center text-gray-600 dark:text-gray-400">
                      Generate your first quiz to get started
                    </p>
                    <Link href="/">
                      <Button>
                        <HiOutlineSparkles className="mr-2 h-4 w-4" />
                        Generate Quiz
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {quizzes.map((quiz) => (
                    <Card
                      key={quiz.id}
                      className="transition-shadow hover:shadow-lg"
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="line-clamp-1 text-lg">
                          {quiz.name}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {quiz.description || quiz.topic || "No description"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-3">
                        <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <HiOutlineCollection className="h-4 w-4" />
                            <span>{quiz.questions.length} questions</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <HiOutlineClock className="h-4 w-4" />
                            <span>{quiz.timeLimit}s per question</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <HiOutlineCalendar className="h-4 w-4" />
                            <span>
                              {format(new Date(quiz.updatedAt), "MMM d, yyyy")}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="flex gap-2">
                        <Link
                          href={`/quiz/${quiz.shortId ?? quiz.id}`}
                          className="flex-1"
                        >
                          <Button variant="outline" className="w-full">
                            <HiOutlineEye className="mr-2 h-4 w-4" />
                            View
                          </Button>
                        </Link>
                        <Link href={`/quiz/${quiz.id}/edit`}>
                          <Button variant="outline" size="icon">
                            <HiOutlinePencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                          onClick={() => setDeleteQuizId(quiz.id)}
                        >
                          <HiOutlineTrash className="h-4 w-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Question Bank Tab */}
            <TabsContent value="questions">
              {/* Filters */}
              <div className="mb-6 flex flex-col gap-4 sm:flex-row">
                <div className="relative flex-1">
                  <HiOutlineSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search questions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="All subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subjects</SelectItem>
                    {subjects?.map((subject) => (
                      <SelectItem key={subject} value={subject}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant={starredOnly ? "default" : "outline"}
                  onClick={() => setStarredOnly(!starredOnly)}
                  className="w-full sm:w-auto"
                >
                  {starredOnly ? (
                    <HiStar className="mr-2 h-4 w-4 text-yellow-400" />
                  ) : (
                    <HiOutlineStar className="mr-2 h-4 w-4" />
                  )}
                  Starred
                </Button>
              </div>

              {questionsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner size="lg" />
                </div>
              ) : questions.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <HiOutlineCollection className="mb-4 h-12 w-12 text-gray-400" />
                    <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                      No questions in your bank
                    </h3>
                    <p className="mb-4 text-center text-gray-600 dark:text-gray-400">
                      Generate quizzes and save questions to build your bank
                    </p>
                    <Link href="/">
                      <Button>
                        <HiOutlineSparkles className="mr-2 h-4 w-4" />
                        Generate Quiz
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {questions.map((question) => (
                    <Card key={question.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Star button */}
                          <button
                            onClick={() =>
                              toggleStar.mutate({ id: question.id })
                            }
                            className="mt-1 flex-shrink-0 text-gray-400 transition-colors hover:text-yellow-400"
                          >
                            {question.isStarred ? (
                              <HiStar className="h-5 w-5 text-yellow-400" />
                            ) : (
                              <HiOutlineStar className="h-5 w-5" />
                            )}
                          </button>

                          {/* Question content */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-medium text-gray-900 dark:text-white">
                                {question.questionText}
                              </h3>
                              <span className="flex-shrink-0 rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300">
                                {question.subject}
                              </span>
                            </div>

                            {/* Answers */}
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {question.answers.map((answer) => (
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
                                  <span className="line-clamp-1">
                                    {answer.answerText}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Used in quizzes */}
                            {question.quizzes.length > 0 && (
                              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                Used in:{" "}
                                {question.quizzes
                                  .map((q) => q.quiz.name)
                                  .join(", ")}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex flex-shrink-0 gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setSelectedQuestionForQuiz(question.id);
                                setAddToQuizModalOpen(true);
                              }}
                              title="Add to quiz"
                            >
                              <HiOutlinePlus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                              onClick={() => setDeleteQuestionId(question.id)}
                              title="Delete question"
                            >
                              <HiOutlineTrash className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Delete Quiz Confirmation */}
      <AlertDialog
        open={!!deleteQuizId}
        onOpenChange={() => setDeleteQuizId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quiz</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this quiz? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => {
                if (deleteQuizId) {
                  deleteQuiz.mutate({ id: deleteQuizId });
                  setDeleteQuizId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Question Confirmation */}
      <AlertDialog
        open={!!deleteQuestionId}
        onOpenChange={() => setDeleteQuestionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question? It will also be
              removed from any quizzes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => {
                if (deleteQuestionId) {
                  deleteQuestion.mutate({ id: deleteQuestionId });
                  setDeleteQuestionId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add to Quiz Modal */}
      <Dialog open={addToQuizModalOpen} onOpenChange={setAddToQuizModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Quiz</DialogTitle>
            <DialogDescription>
              Select a quiz to add this question to
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 space-y-2 overflow-y-auto py-4">
            {quizzes.length === 0 ? (
              <p className="text-center text-gray-500">
                No quizzes available. Create a quiz first.
              </p>
            ) : (
              quizzes.map((quiz) => (
                <button
                  key={quiz.id}
                  onClick={() => {
                    if (selectedQuestionForQuiz) {
                      addQuestionToQuiz.mutate({
                        quizId: quiz.id,
                        questionId: selectedQuestionForQuiz,
                      });
                    }
                  }}
                  className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <div className="font-medium text-gray-900 dark:text-white">
                    {quiz.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {quiz.questions.length} questions
                  </div>
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddToQuizModalOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
