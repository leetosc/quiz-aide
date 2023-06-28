import { signIn, signOut, useSession } from "next-auth/react";

import Link from "next/link";
import { useState } from "react";
import Seo from "~/components/Seo/Seo";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api, type RouterOutputs } from "~/utils/api";
import { read, utils, WorkSheet, writeFile } from "xlsx";

type QuestionsType = RouterOutputs["questionRouter"]["generate"]["questions"];

export default function Home() {
  const hello = api.example.hello.useQuery({ text: "from tRPC" });

  const [topicInput, setTopicInput] = useState("");

  const [questions, setQuestions] = useState<QuestionsType>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [timeLimit, setTimeLimit] = useState(20);

  console.log("questions", questions);

  const generateQuestions = api.questionRouter.generate.useMutation();

  return (
    <>
      <Seo />
      <main className="flex min-h-screen flex-col bg-gradient-to-br from-slate-200 to-slate-300 pt-16 dark:from-gray-900 dark:to-slate-900">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16 ">
          <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem]">
            Quiz <span className="text-[hsl(280,100%,70%)]">Ai</span>de
          </h1>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
            <Link
              className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 text-white hover:bg-white/20"
              href="https://create.t3.gg/en/usage/first-steps"
              target="_blank"
            >
              <h3 className="text-2xl font-bold text-blue-500 dark:text-blue-800">
                First Steps →
              </h3>
              <div className="text-lg">
                Just the basics - Everything you need to know to set up your
                database and authentication.
              </div>
            </Link>
            <Link
              className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 text-white hover:bg-white/20"
              href="https://create.t3.gg/en/introduction"
              target="_blank"
            >
              <h3 className="text-2xl font-bold">Documentation →</h3>
              <div className="text-lg">
                Learn more about Create T3 App, the libraries it uses, and how
                to deploy it.
              </div>
            </Link>
            <Input
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="Enter a topic"
            />
            <Button
              isLoading={generateQuestions.isLoading}
              onClick={() => {
                setQuestions([]);
                generateQuestions
                  .mutateAsync({
                    numberOfQuestions: 10,
                    topic: topicInput,
                  })
                  .then((res) => {
                    console.log(res);
                    console.log(res.questions);
                    setQuestions(res.questions);
                  })
                  .catch((e) => console.log(e));
              }}
            >
              Submit
            </Button>
            <Button
              isLoading={isExporting}
              onClick={() => {
                console.log("Exporting questions...");
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
                        G: timeLimit,
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
                      wb.Sheets[
                        wb.SheetNames[0] as keyof typeof wb.Sheets
                      ] as WorkSheet,
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
                  .finally(() => setIsExporting(false));
              }}
            >
              Export
            </Button>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-2xl text-white">
              {hello.data ? hello.data.greeting : "Loading tRPC query..."}
            </p>
            <AuthShowcase />
          </div>
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
