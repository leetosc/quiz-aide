import { signIn, signOut, useSession } from "next-auth/react";

import { useState } from "react";
import Seo from "~/components/Seo/Seo";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api, type RouterOutputs } from "~/utils/api";
import { read, utils, type WorkSheet, writeFile } from "xlsx";
import { CheckCircleIcon, XCircleIcon } from "lucide-react";
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
import Image from "next/image";
import robotbook2 from "../../public/robotbook2.png";
import Spinner from "~/components/Spinner/Spinner";
import Link from "next/link";
import { usePlausible } from "next-plausible";

type QuestionsType = RouterOutputs["questionRouter"]["generate"]["questions"];

export default function Home() {
  const plausible = usePlausible();

  const [topicInput, setTopicInput] = useState("");

  const [questions, setQuestions] = useState<QuestionsType>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [hasExported, setHasExported] = useState(false);

  const [timeLimitInput, setTimeLimitInput] = useState("20");
  const [numberOfQuestions, setNumberOfQuestions] = useState(10);

  const [showQuestions, setShowQuestions] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);

  console.log("questions", questions);
  console.log(
    "answers",
    questions.map((q) => q.answers.findIndex((a) => a.isCorrect) + 1).join(",")
  );

  const generateQuestions = api.questionRouter.generate.useMutation();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setQuestions([]);
    setShowQuestions(false);
    setShowAnswers(false);
    setHasExported(false);

    generateQuestions
      .mutateAsync({
        numberOfQuestions: numberOfQuestions,
        topic: topicInput,
      })
      .then((res) => {
        console.log(res);
        console.log(res.questions);
        setQuestions(res.questions);
      })
      .catch((e) => console.log(e));
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
            Generate a quiz in seconds
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
                    placeholder="Enter a topic"
                  />
                </div>
                <div>
                  <Label htmlFor="questionCount">Number of Questions</Label>
                  <Input
                    id="questionCount"
                    value={numberOfQuestions}
                    onChange={(e) => setNumberOfQuestions(+e.target.value)}
                    placeholder="Number of questions"
                    type="number"
                  />
                </div>
                <div>
                  <Label htmlFor="timeLimit">Time Limit</Label>
                  <Select
                    value={timeLimitInput}
                    onValueChange={(val) => setTimeLimitInput(val)}
                  >
                    <SelectTrigger className="w-[180px]">
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
                <Button isLoading={generateQuestions.isLoading} type="submit">
                  {generateQuestions.isLoading && (
                    <span className="mr-2">
                      <Spinner size="md" />
                    </span>
                  )}
                  Generate Questions
                  <HiOutlineSparkles className="ml-1 text-lg" />
                </Button>
              </div>
            </form>
            {questions.length ? (
              <div className="mt-4 flex flex-col gap-2">
                <div className="flex flex-col gap-2 md:flex-row">
                  <Button isLoading={isExporting} onClick={exportToExcel}>
                    Export <MdFileDownload className="ml-1 text-lg" />
                  </Button>
                  {hasExported && (
                    <Link
                      href="https://create.kahoot.it/creator"
                      target="_blank"
                    >
                      <Button className="w-full">
                        Create Kahoot{" "}
                        <HiExternalLink className="ml-1 text-lg" />
                      </Button>
                    </Link>
                  )}
                </div>
                <div className="flex flex-col gap-2 md:flex-row">
                  <Button
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
            <div className="mt-4 flex w-full max-w-xs flex-row items-center">
              <MdInfo
                className="mr-1 h-5 w-5 flex-none animate-pulse text-gray-700"
                aria-hidden="true"
              />
              <span>
                <p className="text-sm text-gray-600">
                  {
                    "I may not always be correct, and have no knowledge past 2021. Please fact check the answers!"
                  }
                </p>
              </span>
            </div>
          ) : null}
          <div className="flex flex-col items-center gap-4">
            {showQuestions ? (
              <div className="container mt-1 grid w-full grid-cols-1 gap-2 px-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {questions.map((question, questionIndex) => (
                  <div
                    key={questionIndex}
                    className="mt-4 flex max-w-xs flex-col justify-between rounded-md border border-indigo-400 bg-slate-200 p-4 dark:border-indigo-700 dark:bg-slate-900"
                  >
                    <h2 className="text-sm font-bold text-black dark:text-white">
                      {questionIndex + 1}. {question.questionText}
                    </h2>
                    <ul className="mt-2 grid grid-cols-1 gap-2">
                      {question.answers.map((answer, answerIndex) => {
                        return (
                          <li
                            key={answerIndex}
                            className="flex flex-row items-center rounded-md bg-slate-100 p-2 dark:bg-slate-800"
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
                            <span className="text-black dark:text-white">
                              {answer.text}{" "}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
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
