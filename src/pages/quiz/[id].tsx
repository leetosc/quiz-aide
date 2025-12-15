import { useSession } from "next-auth/react";
import { useState } from "react";
import Seo from "~/components/Seo/Seo";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useToast } from "~/components/ui/use-toast";
import Link from "next/link";
import {
  HiOutlineArrowLeft,
  HiOutlineCollection,
  HiOutlineShare,
  HiOutlinePencil,
  HiOutlineEye,
  HiOutlineEyeOff,
  HiExternalLink,
} from "react-icons/hi";
import { MdFileDownload } from "react-icons/md";
import { CheckCircleIcon, XCircleIcon, Circle } from "lucide-react";
import { type GetStaticPaths, type GetStaticProps } from "next";
import { prisma } from "~/server/db";
import { read, utils, type WorkSheet, writeFile } from "xlsx";

type Answer = {
  id: string;
  answerText: string;
  isCorrect: boolean;
};

type Question = {
  id: string;
  questionText: string;
  answers: Answer[];
};

type QuizQuestion = {
  id: string;
  question: Question;
};

type Quiz = {
  id: string;
  shortId: string;
  name: string;
  description: string | null;
  topic: string | null;
  timeLimit: number;
  authorId: string;
  author: {
    id: string;
    name: string | null;
  };
  questions: QuizQuestion[];
};

type Props = {
  quiz: Quiz;
};

// Kahoot character limits
const QUESTION_CHAR_LIMIT = 120;
const ANSWER_CHAR_LIMIT = 75;

export const getStaticPaths: GetStaticPaths = () => {
  // We'll generate pages on-demand, no pre-rendering at build time
  return {
    paths: [],
    fallback: "blocking",
  };
};

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const shortId = params?.id as string;

  if (!shortId) {
    return { notFound: true };
  }

  const quiz = await prisma.quiz.findUnique({
    where: {
      shortId: shortId,
    },
    include: {
      questions: {
        include: {
          question: {
            include: {
              answers: true,
            },
          },
        },
        orderBy: {
          order: "asc",
        },
      },
      author: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!quiz) {
    return { notFound: true };
  }

  // Serialize the data (remove Date objects, etc.)
  const serializedQuiz: Quiz = {
    id: quiz.id,
    shortId: quiz.shortId,
    name: quiz.name,
    description: quiz.description,
    topic: quiz.topic,
    timeLimit: quiz.timeLimit,
    authorId: quiz.authorId,
    author: {
      id: quiz.author.id,
      name: quiz.author.name,
    },
    questions: quiz.questions.map((qq) => ({
      id: qq.id,
      question: {
        id: qq.question.id,
        questionText: qq.question.questionText,
        answers: qq.question.answers.map((a) => ({
          id: a.id,
          answerText: a.answerText,
          isCorrect: a.isCorrect,
        })),
      },
    })),
  };

  return {
    props: {
      quiz: serializedQuiz,
    },
    // Revalidate every 60 seconds for ISR
    revalidate: 60,
  };
};

export default function QuizView({ quiz }: Props) {
  const { data: session } = useSession();
  const { toast } = useToast();

  const [showAnswers, setShowAnswers] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [hasExported, setHasExported] = useState(false);

  const handleShareClick = () => {
    const shareUrl = window.location.href;
    void navigator.clipboard.writeText(shareUrl);
    toast({ title: "Link copied to clipboard!" });
  };

  const exportToExcel = () => {
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
        setHasExported(true);
      })
      .finally(() => {
        setIsExporting(false);
        toast({ title: "Quiz exported successfully" });
      });
  };

  const isOwner = session?.user?.id === quiz.authorId;

  // Check for character limit warnings
  const hasCharacterLimitWarnings = quiz.questions.some(
    (qq) =>
      qq.question.questionText.length > QUESTION_CHAR_LIMIT ||
      qq.question.answers.some((a) => a.answerText.length > ANSWER_CHAR_LIMIT)
  );

  // Build SEO description
  const questionCount = quiz.questions.length;
  const seoDescription =
    quiz.description ||
    `A quiz about ${
      quiz.topic || "various topics"
    } with ${questionCount} question${
      questionCount !== 1 ? "s" : ""
    }. Created by ${quiz.author.name || "Quiz Aide"}.`;

  const ogDescription = `📝 ${questionCount} question${
    questionCount !== 1 ? "s" : ""
  } • ${quiz.topic ? `📚 ${quiz.topic} • ` : ""}⏱️ ${
    quiz.timeLimit
  }s per question`;

  return (
    <>
      <Seo
        title={quiz.name}
        description={seoDescription}
        ogTitle={`${quiz.name} - Quiz`}
        ogDescription={ogDescription}
      />
      <main className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 pt-16 dark:from-gray-900 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6 flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <HiOutlineArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {quiz.name}
              </h1>
              {quiz.description && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {quiz.description}
                </p>
              )}
              {quiz.author.name && (
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Created by {quiz.author.name}
                </p>
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
            <Button
              variant="outline"
              onClick={() => setShowAnswers(!showAnswers)}
            >
              {showAnswers ? (
                <>
                  <HiOutlineEyeOff className="mr-2 h-4 w-4" />
                  Hide Answers
                </>
              ) : (
                <>
                  <HiOutlineEye className="mr-2 h-4 w-4" />
                  Show Answers
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleShareClick}>
              <HiOutlineShare className="mr-2 h-4 w-4" />
              Share
            </Button>
            <Button onClick={() => setShowExportModal(true)}>
              <MdFileDownload className="mr-2 h-4 w-4" />
              Export to Kahoot
            </Button>
            {isOwner && (
              <Link href={`/quiz/${quiz.id}/edit`}>
                <Button variant="outline">
                  <HiOutlinePencil className="mr-2 h-4 w-4" />
                  Edit Quiz
                </Button>
              </Link>
            )}
          </div>

          {/* Questions List */}
          {quiz.questions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <HiOutlineCollection className="mb-4 h-12 w-12 text-gray-400" />
                <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                  No questions yet
                </h3>
                <p className="text-center text-gray-600 dark:text-gray-400">
                  This quiz doesn&apos;t have any questions yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {quiz.questions.map((quizQuestion, index) => {
                const question = quizQuestion.question;

                return (
                  <Card key={quizQuestion.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Question number */}
                        <div className="flex flex-col items-center gap-1 pt-1">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-100 text-sm font-medium text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                            {index + 1}
                          </span>
                        </div>

                        {/* Question content */}
                        <div className="min-w-0 flex-1">
                          <h3 className="mb-3 font-medium text-gray-900 dark:text-white">
                            {question.questionText}
                          </h3>

                          {/* Answers */}
                          <div className="grid gap-2 sm:grid-cols-2">
                            {question.answers.map((answer) => {
                              const isCorrect = answer.isCorrect;

                              if (showAnswers) {
                                return (
                                  <div
                                    key={answer.id}
                                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                                      isCorrect
                                        ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                        : "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                    }`}
                                  >
                                    {isCorrect ? (
                                      <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
                                    ) : (
                                      <XCircleIcon className="h-4 w-4 flex-shrink-0" />
                                    )}
                                    <span className="flex-1">
                                      {answer.answerText}
                                    </span>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={answer.id}
                                  className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                >
                                  <Circle className="h-4 w-4 flex-shrink-0" />
                                  <span className="flex-1">
                                    {answer.answerText}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Export Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export to Kahoot</DialogTitle>
            <DialogDescription>
              Download your quiz and import it into Kahoot
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Validation warnings */}
            {hasCharacterLimitWarnings && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  ⚠️ Some questions or answers exceed Kahoot&apos;s character
                  limits and may be truncated.
                </p>
              </div>
            )}

            {/* Steps */}
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500 text-xs font-bold text-white">
                  1
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Download the Excel file
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Click the button below to download your quiz
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500 text-xs font-bold text-white">
                  2
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Open Kahoot Creator
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Go to create.kahoot.it and sign in
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500 text-xs font-bold text-white">
                  3
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Import the spreadsheet
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Click &quot;Create&quot; → &quot;Import spreadsheet&quot;
                    and upload the file
                  </p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                disabled={isExporting}
                onClick={exportToExcel}
                className="w-full"
              >
                {isExporting ? (
                  "Exporting..."
                ) : hasExported ? (
                  <>
                    Download Again
                    <MdFileDownload className="ml-1 text-lg" />
                  </>
                ) : (
                  <>
                    Download Excel File
                    <MdFileDownload className="ml-1 text-lg" />
                  </>
                )}
              </Button>

              {hasExported && (
                <Link
                  href="https://create.kahoot.it/creator"
                  target="_blank"
                  className="w-full"
                >
                  <Button variant="outline" className="w-full">
                    Open Kahoot Creator
                    <HiExternalLink className="ml-1 text-lg" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
