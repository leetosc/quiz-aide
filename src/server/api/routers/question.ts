import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { Configuration, OpenAIApi } from "openai";
import { env } from "~/env.mjs";
import { TRPCError } from "@trpc/server";
import { MODELS } from "~/utils/constants";

export const questionRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  getAll: publicProcedure.query(({ ctx }) => {
    return ctx.prisma.example.findMany();
  }),

  generate: publicProcedure
    .input(z.object({ topic: z.string(), numberOfQuestions: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const configuration = new Configuration({
        apiKey: env.OPENAI_API_KEY,
      });
      const openai = new OpenAIApi(configuration);

      const questionPrompt = `I want to make a quiz about ${input.topic}. I want ${input.numberOfQuestions} questions, with 4 answers per question. The difficulty level of the questions should be for college graduates. Please give me 1 correct answer for each question. The question can not be longer than 120 characters, and the answers can not be longer than 75 characters.`;

      try {
        const chatCompletion = await openai.createChatCompletion({
          model: MODELS.GPT4,
          messages: [{ role: "user", content: questionPrompt }],
          functions: [
            {
              name: "generate_questions",
              description:
                "Generate a set of questions with corresponding answers",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        questionText: {
                          type: "string",
                          description: "The text of the question",
                        },
                        answers: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              text: {
                                type: "string",
                                description: "The text of the answer",
                              },
                              isCorrect: {
                                type: "boolean",
                                description:
                                  "Indicates whether the answer is correct",
                              },
                            },
                            required: ["text", "isCorrect"],
                          },
                        },
                      },
                      required: ["questionText", "answers"],
                    },
                  },
                },
                required: ["questions"],
              },
            },
          ],
        });

        console.log(chatCompletion.data);

        type Answer = {
          text: string;
          isCorrect: boolean;
        };

        type Quiz = {
          questions: {
            questionText: string;
            answers: Answer[];
          }[];
        };

        const responseQuestions = JSON.parse(
          chatCompletion.data.choices[0]?.message?.function_call?.arguments ??
            "{}"
        ) as Quiz;

        const randomizedQuiz: Quiz = { ...responseQuestions };

        for (const question of randomizedQuiz.questions) {
          question.answers.sort(() => Math.random() - 0.5);
        }

        console.log("response questions", responseQuestions);

        return randomizedQuiz;
      } catch (err) {
        console.log(err);

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: JSON.stringify(err),
        });
      }
    }),

  generateOne: publicProcedure
    .input(
      z.object({
        topic: z.string(),
        previousQuestions: z.array(z.string()),
        useBestModel: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const configuration = new Configuration({
        apiKey: env.OPENAI_API_KEY,
      });
      const openai = new OpenAIApi(configuration);

      const questionPrompt = `I want to make a quiz about ${
        input.topic
      }. Give me ${
        input.previousQuestions.length ? "another" : "a"
      } question about the topic, with 4 answers per question. The difficulty level of the question should be for college graduates. Please give me 1 correct answer for the question. The question can not be longer than 120 characters, and the answers can not be longer than 75 characters. ${
        input.previousQuestions.length > 0
          ? `Here is the list of previous questions so you can avoid repeating questions: ${input.previousQuestions.join(
              ", "
            )}`
          : ""
      }. Come up with a variety of questions on the topic.`;

      try {
        const chatCompletion = await openai.createChatCompletion({
          model:
            input.useBestModel && ctx.session?.user.id
              ? MODELS.GPT4TURBO
              : MODELS.GPT35,
          messages: [{ role: "user", content: questionPrompt }],
          functions: [
            {
              name: "generate_question",
              description:
                "Generate a single question with corresponding answers",
              parameters: {
                type: "object",
                properties: {
                  question: {
                    type: "object",
                    properties: {
                      questionText: {
                        type: "string",
                        description: "The text of the question",
                      },
                      answers: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            text: {
                              type: "string",
                              description: "The text of the answer",
                            },
                            isCorrect: {
                              type: "boolean",
                              description:
                                "Indicates whether the answer is correct",
                            },
                          },
                          required: ["text", "isCorrect"],
                        },
                      },
                    },
                    required: ["questionText", "answers"],
                  },
                },
                required: ["question"],
              },
            },
          ],
        });

        console.log(chatCompletion.data);

        type Answer = {
          text: string;
          isCorrect: boolean;
        };

        type QuestionResponse = {
          question: {
            questionText: string;
            answers: Answer[];
          };
        };

        const responseQuestion = JSON.parse(
          chatCompletion.data.choices[0]?.message?.function_call?.arguments ??
            "{}"
        ) as QuestionResponse;

        console.log("response questions", responseQuestion);

        // shuffle the answers with Fisher-Yates
        for (let i = responseQuestion.question.answers.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [
            responseQuestion.question.answers[i],
            responseQuestion.question.answers[j],
          ] = [
            responseQuestion.question.answers[j] as Answer,
            responseQuestion.question.answers[i] as Answer,
          ];
        }

        return responseQuestion.question;
      } catch (err) {
        console.log(JSON.stringify(err, null, 2));

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: JSON.stringify(err),
        });
      }
    }),

  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
});
