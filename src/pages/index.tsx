import { signIn, signOut, useSession } from "next-auth/react";

import { useState, useEffect } from "react";
import Seo from "~/components/Seo/Seo";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api, type RouterOutputs } from "~/utils/api";
import { read, utils, type WorkSheet, writeFile } from "xlsx";
import {
  CheckCircleIcon,
  XCircleIcon,
  Pencil,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { BsQuestionCircle } from "react-icons/bs";
import {
  HiExternalLink,
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlineSparkles,
} from "react-icons/hi";
import { MdFileDownload, MdInfo } from "react-icons/md";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import Image from "next/image";
import robotbook2 from "../../public/robotbook2.png";
import Spinner from "~/components/Spinner/Spinner";
import Link from "next/link";
import { usePlausible } from "next-plausible";
import { Progress } from "~/components/ui/progress";
import { useToast } from "~/components/ui/use-toast";
import {
  MODELS,
  DIFFICULTY_LEVELS,
  DIFFICULTY_LABELS,
} from "~/utils/constants";

type QuestionsType = RouterOutputs["questionRouter"]["generate"]["questions"];
type QuestionType = RouterOutputs["questionRouter"]["generateOne"];

export default function Home() {
  const plausible = usePlausible();
  const { status: sessionStatus } = useSession();
  const isLoggedIn = sessionStatus === "authenticated";

  const [topicInput, setTopicInput] = useState("");
  const [model, setModel] = useState<string>(
    sessionStatus === "authenticated" ? MODELS.GPT_5_2 : MODELS.GPT_5_MINI
  );
  const [difficultyLevel, setDifficultyLevel] = useState<string>(
    DIFFICULTY_LEVELS.COLLEGE
  );

  // Set default model to GPT-5.2 for logged in users
  useEffect(() => {
    if (isLoggedIn && model === MODELS.GPT_5_MINI) {
      setModel(MODELS.GPT_5_2);
    }
  }, [isLoggedIn, model]);

  const [questions, setQuestions] = useState<QuestionsType>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [hasExported, setHasExported] = useState(false);

  const [timeLimitInput, setTimeLimitInput] = useState("20");
  const [numberOfQuestions, setNumberOfQuestions] = useState(10);

  const [showQuestions, setShowQuestions] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);

  const [generatingProgress, setGeneratingProgress] = useState(0);
  const [isGeneratingMultiple, setIsGeneratingMultiple] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<
    number | null
  >(null);
  const [editingAnswerIndex, setEditingAnswerIndex] = useState<{
    questionIndex: number;
    answerIndex: number;
  } | null>(null);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(
    null
  );
  const [showExportModal, setShowExportModal] = useState(false);

  const { toast } = useToast();

  // Kahoot character limits
  const QUESTION_CHAR_LIMIT = 120;
  const ANSWER_CHAR_LIMIT = 75;

  const generateQuestionSingle = api.questionRouter.generateOne.useMutation();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    void handleGenerateMultipleQuestions();
  };

  // call generate single multiple times and show progress bar
  const handleGenerateMultipleQuestions = async () => {
    setIsGeneratingMultiple(true);
    setGeneratingProgress(0);
    setQuestions([]);
    setShowQuestions(false);
    setShowAnswers(false);
    setHasExported(false);

    const generatedQuestions: QuestionType[] = [];

    for (let i = 0; i < numberOfQuestions; i++) {
      try {
        const newQuestion = await generateQuestionSingle.mutateAsync({
          topic: topicInput,
          previousQuestions: generatedQuestions.map((q) => q.questionText),
          model: model,
          difficultyLevel: difficultyLevel,
        });

        generatedQuestions.push(newQuestion);
        console.log("newQuestion", newQuestion);

        setGeneratingProgress(((i + 1) / numberOfQuestions) * 100);
      } catch (e) {
        console.log(e);
        toast({
          title: "Error",
          description:
            "An error occured while generating questions. Please try again.",
        });
      }
    }

    setQuestions(generatedQuestions);
    setIsGeneratingMultiple(false);
  };

  // Question editing handlers
  const handleUpdateQuestion = (questionIndex: number, newText: string) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === questionIndex ? { ...q, questionText: newText } : q
      )
    );
    setEditingQuestionIndex(null);
  };

  const handleUpdateAnswer = (
    questionIndex: number,
    answerIndex: number,
    newText: string
  ) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === questionIndex
          ? {
              ...q,
              answers: q.answers.map((a, j) =>
                j === answerIndex ? { ...a, text: newText } : a
              ),
            }
          : q
      )
    );
    setEditingAnswerIndex(null);
  };

  const handleDeleteQuestion = (questionIndex: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== questionIndex));
  };

  const handleRegenerateQuestion = async (questionIndex: number) => {
    setRegeneratingIndex(questionIndex);
    try {
      const newQuestion = await generateQuestionSingle.mutateAsync({
        topic: topicInput,
        previousQuestions: questions
          .filter((_, i) => i !== questionIndex)
          .map((q) => q.questionText),
        model: model,
        difficultyLevel: difficultyLevel,
      });
      setQuestions((prev) =>
        prev.map((q, i) => (i === questionIndex ? newQuestion : q))
      );
    } catch (e) {
      console.log(e);
      toast({
        title: "Error",
        description: "Failed to regenerate question. Please try again.",
      });
    }
    setRegeneratingIndex(null);
  };

  const exportToExcel = () => {
    console.log("Exporting questions...");

    plausible("Export");

    setIsExporting(true);
    fetch("/KahootQuizTemplate.xlsx")
      .then((res) => {
        return res.arrayBuffer();
      })
      .then((ab) => {
        const wb = read(ab, { type: "buffer" });
        console.log(wb.SheetNames);
        console.log(wb.Sheets[wb.SheetNames[0] as string]);
        const questionList = [];
        for (const question of questions) {
          // Each question has between 2 to 4 answers
          const correctAnswerPositions = [];
          for (let i = 0; i < question.answers.length; i++) {
            if (question.answers[i]?.isCorrect)
              correctAnswerPositions.push(i + 1);
          }

          const newQuestion = {
            B: question.questionText,
            C: question.answers[0]?.text,
            D: question.answers[1]?.text,
            E: "",
            F: "",
            G: Number(timeLimitInput),
            H: correctAnswerPositions.join(","),
          };

          if (question.answers[2]) {
            newQuestion["E"] = question.answers[2].text;
          }

          if (question.answers[3]) {
            newQuestion["F"] = question.answers[3].text;
          }

          questionList.push(newQuestion);
        }
        utils.sheet_add_json(
          wb.Sheets[wb.SheetNames[0] as keyof typeof wb.Sheets] as WorkSheet,
          questionList,
          { origin: "B9", skipHeader: true }
        );
        writeFile(
          wb,
          `KahootQuizTemplate_${topicInput.substring(0, 10)}_${
            questions.length
          }-questions.xlsx`
        );
      })
      .finally(() => {
        setHasExported(true);
        setIsExporting(false);
      });
  };

  return (
    <>
      <Seo />
      <main className="flex min-h-screen flex-col bg-gradient-to-br from-slate-100 to-slate-200 pt-16 dark:from-gray-900 dark:to-slate-900">
        <div className="container flex flex-col items-center justify-center gap-4 px-4 py-8 md:py-12 ">
          <h1 className="text-4xl font-extrabold tracking-tight dark:text-white sm:text-[3rem]">
            Quiz <span className="text-cyan-500">Ai</span>de
          </h1>
          <p className="text-md  dark:text-white sm:text-lg">
            Generate a quiz in minutes
          </p>

          <Image src={robotbook2} alt="robot reading a book" width={200} />
          <div className="container max-w-xl ">
            <form onSubmit={handleSubmit}>
              <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
                <div className="md:col-span-2">
                  <Label htmlFor="topic">Topic</Label>
                  <Input
                    autoComplete="off"
                    id="topic"
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    placeholder="e.g., World War II, Biology cells, Famous artists"
                  />
                  <div className="mt-2 hidden flex-wrap gap-2 md:flex">
                    {[
                      "World History",
                      "Science",
                      "Geography",
                      "Literature",
                      "Pop Culture",
                      "Sports",
                    ].map((topic) => (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => setTopicInput(topic)}
                        className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-600 transition-colors hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-cyan-500 dark:hover:bg-cyan-950 dark:hover:text-cyan-400"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="questionCount">Number of Questions</Label>
                  <Input
                    id="questionCount"
                    value={numberOfQuestions}
                    onChange={(e) =>
                      setNumberOfQuestions(
                        Math.min(50, Math.max(1, +e.target.value || 1))
                      )
                    }
                    placeholder="Number of questions"
                    type="number"
                    min={1}
                    max={50}
                  />
                </div>
                <div>
                  <Label htmlFor="timeLimit">Time Limit</Label>
                  <Select
                    value={timeLimitInput}
                    onValueChange={(val) => setTimeLimitInput(val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Time per question" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Time per question</SelectLabel>
                        {[5, 10, 20, 30, 60, 90, 120, 240].map((time) => (
                          <SelectItem key={time} value={time.toString()}>
                            {time} seconds
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="difficultyLevel">Difficulty Level</Label>
                  <Select
                    value={difficultyLevel}
                    onValueChange={(val) => setDifficultyLevel(val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {Object.values(DIFFICULTY_LEVELS).map((level) => (
                          <SelectItem key={level} value={level}>
                            {DIFFICULTY_LABELS[level]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {isLoggedIn && (
                  <div>
                    <Label htmlFor="model">Model</Label>
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={MODELS.GPT_4O}>GPT-4o</SelectItem>
                        <SelectItem value={MODELS.GPT_5}>GPT-5</SelectItem>
                        <SelectItem value={MODELS.GPT_5_MINI}>
                          GPT-5 Mini
                        </SelectItem>
                        <SelectItem value={MODELS.GPT_5_2}>GPT-5.2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="col-span-2">
                  <Button
                    isLoading={
                      generateQuestionSingle.isLoading || isGeneratingMultiple
                    }
                    type="submit"
                    className="w-full"
                  >
                    {(generateQuestionSingle.isLoading ||
                      isGeneratingMultiple) && (
                      <span className="mr-2">
                        <Spinner size="md" />
                      </span>
                    )}
                    Generate Questions
                    <HiOutlineSparkles className="ml-1 text-lg" />
                  </Button>
                </div>
              </div>
            </form>

            {isGeneratingMultiple && (
              <div className="my-4 space-y-2">
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>{Math.round(generatingProgress)}%</span>
                </div>
                <Progress value={generatingProgress} />
              </div>
            )}
            {questions.length ? (
              <div className="mt-4 space-y-4">
                {/* Quiz Summary */}
                <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                        {questions.length}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400">
                        questions
                      </span>
                    </div>
                    <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                        {Math.floor(
                          (questions.length * Number(timeLimitInput)) / 60
                        )}
                        :
                        {((questions.length * Number(timeLimitInput)) % 60)
                          .toString()
                          .padStart(2, "0")}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400">
                        estimated time
                      </span>
                    </div>
                    <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                        {timeLimitInput}s
                      </span>
                      <span className="text-gray-600 dark:text-gray-400">
                        per question
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setShowExportModal(true)}>
                    Export to Kahoot <MdFileDownload className="ml-1 text-lg" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      plausible("Toggle Questions", {
                        props: {
                          showQuestions: !showQuestions,
                        },
                      });
                      setShowQuestions(!showQuestions);
                    }}
                  >
                    {showQuestions ? "Hide" : "Show"} Questions{" "}
                    {showQuestions ? (
                      <HiOutlineEyeOff className="ml-1 text-lg" />
                    ) : (
                      <HiOutlineEye className="ml-1 text-lg" />
                    )}
                  </Button>
                  {showQuestions && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        plausible("Toggle Answers", {
                          props: {
                            showAnswers: !showAnswers,
                          },
                        });
                        setShowAnswers(!showAnswers);
                      }}
                    >
                      {showAnswers ? "Hide" : "Show"} Answers
                      {showAnswers ? (
                        <HiOutlineEyeOff className="ml-1 text-lg" />
                      ) : (
                        <HiOutlineEye className="ml-1 text-lg" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {questions.length ? (
            <div className="mt-4 flex w-full max-w-md flex-row items-center rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <MdInfo
                className="mr-2 h-5 w-5 flex-none text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                AI-generated content may contain errors. Please verify answers
                before using in your quiz!
              </p>
            </div>
          ) : null}
          <div className="flex flex-col items-center gap-4">
            {showQuestions ? (
              <div className="container mt-1 grid w-full grid-cols-1 gap-4 px-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {questions.map((question, questionIndex) => {
                  const isEditingQuestion =
                    editingQuestionIndex === questionIndex;
                  const questionOverLimit =
                    question.questionText.length > QUESTION_CHAR_LIMIT;
                  const isRegenerating = regeneratingIndex === questionIndex;

                  return (
                    <div
                      key={questionIndex}
                      className={`relative flex flex-col rounded-lg border bg-slate-200 p-4 transition-all dark:bg-slate-900 ${
                        questionOverLimit
                          ? "border-red-400 dark:border-red-600"
                          : "border-indigo-400 dark:border-indigo-700"
                      } ${isRegenerating ? "opacity-50" : ""}`}
                    >
                      {/* Action buttons */}
                      <div className="absolute -top-2 right-2 flex gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            void handleRegenerateQuestion(questionIndex)
                          }
                          disabled={isRegenerating}
                          className="rounded-full bg-blue-500 p-1.5 text-white shadow-sm transition-colors hover:bg-blue-600 disabled:opacity-50"
                          title="Regenerate question"
                        >
                          <RefreshCw
                            className={`h-3 w-3 ${
                              isRegenerating ? "animate-spin" : ""
                            }`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingQuestionIndex(questionIndex)}
                          className="rounded-full bg-amber-500 p-1.5 text-white shadow-sm transition-colors hover:bg-amber-600"
                          title="Edit question"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(questionIndex)}
                          className="rounded-full bg-red-500 p-1.5 text-white shadow-sm transition-colors hover:bg-red-600"
                          title="Delete question"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Question text */}
                      <div className="mb-3 mt-2">
                        {isEditingQuestion ? (
                          <div className="space-y-2">
                            <textarea
                              className="w-full rounded border bg-white p-2 text-sm dark:bg-slate-800 dark:text-white"
                              defaultValue={question.questionText}
                              rows={3}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleUpdateQuestion(
                                    questionIndex,
                                    e.currentTarget.value
                                  );
                                }
                                if (e.key === "Escape") {
                                  setEditingQuestionIndex(null);
                                }
                              }}
                              onBlur={(e) =>
                                handleUpdateQuestion(
                                  questionIndex,
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        ) : (
                          <h2 className="text-sm font-bold text-black dark:text-white">
                            {questionIndex + 1}. {question.questionText}
                          </h2>
                        )}
                        <div
                          className={`mt-1 text-xs ${
                            questionOverLimit ? "text-red-500" : "text-gray-400"
                          }`}
                        ></div>
                      </div>

                      {/* Answers */}
                      <ul className="grid grid-cols-1 gap-2">
                        {question.answers.map((answer, answerIndex) => {
                          const isEditingAnswer =
                            editingAnswerIndex?.questionIndex ===
                              questionIndex &&
                            editingAnswerIndex?.answerIndex === answerIndex;
                          const answerOverLimit =
                            answer.text.length > ANSWER_CHAR_LIMIT;

                          return (
                            <li
                              key={answerIndex}
                              className={`group flex flex-row items-center rounded-md p-2 ${
                                showAnswers && answer.isCorrect
                                  ? "bg-green-100 dark:bg-green-900/30"
                                  : "bg-slate-100 dark:bg-slate-800"
                              } ${
                                answerOverLimit ? "ring-1 ring-red-400" : ""
                              }`}
                            >
                              {showAnswers ? (
                                answer.isCorrect ? (
                                  <CheckCircleIcon
                                    className="-ml-1 mr-2 h-5 w-5 flex-none text-green-500 dark:text-green-300"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <XCircleIcon
                                    className="-ml-1 mr-2 h-5 w-5 flex-none text-red-500 dark:text-red-300"
                                    aria-hidden="true"
                                  />
                                )
                              ) : (
                                <BsQuestionCircle
                                  className="-ml-1 mr-2 h-5 w-5 flex-none text-blue-500 dark:text-blue-300"
                                  aria-hidden="true"
                                />
                              )}

                              {isEditingAnswer ? (
                                <input
                                  type="text"
                                  className="flex-1 rounded border bg-white px-2 py-1 text-sm dark:bg-slate-700 dark:text-white"
                                  defaultValue={answer.text}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleUpdateAnswer(
                                        questionIndex,
                                        answerIndex,
                                        e.currentTarget.value
                                      );
                                    }
                                    if (e.key === "Escape") {
                                      setEditingAnswerIndex(null);
                                    }
                                  }}
                                  onBlur={(e) =>
                                    handleUpdateAnswer(
                                      questionIndex,
                                      answerIndex,
                                      e.target.value
                                    )
                                  }
                                />
                              ) : (
                                <div className="flex flex-1 items-center justify-between">
                                  <span className="text-sm text-black dark:text-white">
                                    {answer.text}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingAnswerIndex({
                                        questionIndex,
                                        answerIndex,
                                      })
                                    }
                                    className="ml-2 hidden rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 group-hover:block dark:hover:bg-gray-700 dark:hover:text-gray-300"
                                    title="Edit answer"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
          {/* <div className="flex flex-col items-center gap-2">
            <p className="text-2xl text-white">
              {hello.data ? hello.data.greeting : "Loading tRPC query..."}
            </p>
            <AuthShowcase />d
          </div> */}
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
            {questions.some(
              (q) =>
                q.questionText.length > QUESTION_CHAR_LIMIT ||
                q.answers.some((a) => a.text.length > ANSWER_CHAR_LIMIT)
            ) && (
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
                isLoading={isExporting}
                onClick={() => {
                  exportToExcel();
                }}
                className="w-full"
              >
                {hasExported ? "Download Again" : "Download Excel File"}
                <MdFileDownload className="ml-1 text-lg" />
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

function AuthShowcase() {
  const { data: sessionData } = useSession();

  const { data: secretMessage } = api.example.getSecretMessage.useQuery(
    undefined, // no input
    { enabled: sessionData?.user !== undefined }
  );

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <p className="text-center text-2xl text-white">
        {sessionData && <span>Logged in as {sessionData.user?.name}</span>}
        {secretMessage && <span> - {secretMessage}</span>}
      </p>
      <button
        className="rounded-full bg-white/10 px-10 py-3 font-semibold text-white no-underline transition hover:bg-white/20"
        onClick={sessionData ? () => void signOut() : () => void signIn()}
      >
        {sessionData ? "Sign out" : "Sign in"}
      </button>
      <Button
        variant="secondary"
        onClick={sessionData ? () => void signOut() : () => void signIn()}
      >
        {" "}
        {sessionData ? "Sign out" : "Sign in"}
      </Button>
    </div>
  );
}
