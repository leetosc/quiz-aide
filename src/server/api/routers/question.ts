import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { Configuration, OpenAIApi } from "openai";
import { env } from "~/env.mjs";
import { TRPCError } from "@trpc/server";

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
          model: "gpt-3.5-turbo-0613",
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

        return chatCompletion.data.choices[0]?.message;
      } catch (err) {
        console.log(err);

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
