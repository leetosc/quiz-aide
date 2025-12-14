import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { Configuration, OpenAIApi } from "openai";
import { env } from "~/env.mjs";
import { TRPCError } from "@trpc/server";
import { MODELS, DIFFICULTY_LEVELS } from "~/utils/constants";

const getOpenAI = (deploymentId: string) => {
  const configuration = new Configuration({
    apiKey: env.AZURE_OPENAI_API_KEY,
    basePath: `${env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${deploymentId}`,
  });
  return new OpenAIApi(configuration);
};

const AZURE_API_OPTIONS = {
  params: {
    "api-version": env.AZURE_OPENAI_API_VERSION,
  },
};

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
    .mutation(async ({ input }) => {
      const openai = getOpenAI(MODELS.GPT_4O);

      const questionPrompt = `I want to make a kahoot quiz about ${input.topic}. I want ${input.numberOfQuestions} questions, with 4 answers per question. The difficulty level of the questions should be for college graduates. Please give me 1 correct answer for each question. The question can not be longer than 120 characters, and the answers can not be longer than 75 characters.`;

      try {
        const chatCompletion = await openai.createChatCompletion(
          {
            model: MODELS.GPT_4O, // In Azure this is often ignored but good to keep
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
          },
          AZURE_API_OPTIONS
        );

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
        model: z.string(),
        difficultyLevel: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Validate model
      const model = Object.values(MODELS).includes(input.model)
        ? input.model
        : MODELS.GPT_5_MINI; // Default fallback

      // Map difficulty level to prompt text
      const difficultyMap: Record<string, string> = {
        [DIFFICULTY_LEVELS.HIGH_SCHOOL]: "high school students",
        [DIFFICULTY_LEVELS.COLLEGE]: "college students",
        [DIFFICULTY_LEVELS.POST_GRAD]:
          "post-graduate students or experts in the field",
      };

      const difficultyText =
        difficultyMap[input.difficultyLevel ?? DIFFICULTY_LEVELS.COLLEGE] ??
        "college graduates or working professionals";

      const openai = getOpenAI(model);

      const questionPrompt = `I want to make a kahoot quiz about ${
        input.topic
      }. Give me ${
        input.previousQuestions.length ? "another" : "a"
      } question about the topic, with 4 answers per question. The difficulty level of the question should be for ${difficultyText}. Please give me 1 correct answer for the question. The question can not be longer than 120 characters, and the answers can not be longer than 75 characters. ${
        input.previousQuestions.length > 0
          ? `Here is the list of previous questions so you can avoid repeating questions: ${input.previousQuestions.join(
              ", "
            )}`
          : ""
      }. Come up with a variety of questions on the topic.`;

      try {
        const chatCompletion = await openai.createChatCompletion(
          {
            model: model,
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
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore-next-line
            reasoning_effort: "low",
          },
          AZURE_API_OPTIONS
        );

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

  // Question Bank Endpoints

  // Save questions to the bank
  saveToBank: protectedProcedure
    .input(
      z.object({
        questions: z.array(
          z.object({
            questionText: z.string(),
            subject: z.string(),
            answers: z.array(
              z.object({
                text: z.string(),
                isCorrect: z.boolean(),
              })
            ),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const createdQuestions = await Promise.all(
        input.questions.map((q) =>
          ctx.prisma.question.create({
            data: {
              questionText: q.questionText,
              subject: q.subject,
              authorId: userId,
              answers: {
                create: q.answers.map((a) => ({
                  answerText: a.text,
                  isCorrect: a.isCorrect,
                })),
              },
            },
            include: {
              answers: true,
            },
          })
        )
      );

      return createdQuestions;
    }),

  // Get all questions in user's bank with optional search/filter
  getBank: protectedProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          subject: z.string().optional(),
          starredOnly: z.boolean().optional(),
          limit: z.number().min(1).max(100).default(50),
          cursor: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const limit = input?.limit ?? 50;

      const where: {
        authorId: string;
        isStarred?: boolean;
        subject?: string;
        questionText?: { contains: string };
      } = {
        authorId: userId,
      };

      if (input?.starredOnly) {
        where.isStarred = true;
      }

      if (input?.subject) {
        where.subject = input.subject;
      }

      if (input?.search) {
        where.questionText = {
          contains: input.search,
        };
      }

      const questions = await ctx.prisma.question.findMany({
        where,
        include: {
          answers: true,
          quizzes: {
            include: {
              quiz: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [{ isStarred: "desc" }, { updatedAt: "desc" }],
        take: limit + 1,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined = undefined;
      if (questions.length > limit) {
        const nextItem = questions.pop();
        nextCursor = nextItem?.id;
      }

      return {
        questions,
        nextCursor,
      };
    }),

  // Get unique subjects for filtering
  getSubjects: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const subjects = await ctx.prisma.question.findMany({
      where: { authorId: userId },
      select: { subject: true },
      distinct: ["subject"],
    });

    return subjects.map((s) => s.subject);
  }),

  // Update a question
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        questionText: z.string().optional(),
        subject: z.string().optional(),
        answers: z
          .array(
            z.object({
              id: z.string().optional(),
              text: z.string(),
              isCorrect: z.boolean(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify ownership
      const existing = await ctx.prisma.question.findUnique({
        where: { id: input.id },
      });

      if (!existing || existing.authorId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to update this question",
        });
      }

      // Update question
      const updateData: { questionText?: string; subject?: string } = {};
      if (input.questionText) updateData.questionText = input.questionText;
      if (input.subject) updateData.subject = input.subject;

      // If answers are provided, delete existing and create new ones
      if (input.answers) {
        await ctx.prisma.answer.deleteMany({
          where: { questionId: input.id },
        });

        // Create answers one by one (SQLite doesn't support createMany)
        for (const a of input.answers) {
          await ctx.prisma.answer.create({
            data: {
              questionId: input.id,
              answerText: a.text,
              isCorrect: a.isCorrect,
            },
          });
        }
      }

      return ctx.prisma.question.update({
        where: { id: input.id },
        data: updateData,
        include: {
          answers: true,
        },
      });
    }),

  // Delete a question from the bank
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify ownership
      const existing = await ctx.prisma.question.findUnique({
        where: { id: input.id },
      });

      if (!existing || existing.authorId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to delete this question",
        });
      }

      // Delete from any quizzes first
      await ctx.prisma.quizQuestion.deleteMany({
        where: { questionId: input.id },
      });

      return ctx.prisma.question.delete({
        where: { id: input.id },
      });
    }),

  // Toggle star on a question
  toggleStar: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify ownership
      const existing = await ctx.prisma.question.findUnique({
        where: { id: input.id },
      });

      if (!existing || existing.authorId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to modify this question",
        });
      }

      return ctx.prisma.question.update({
        where: { id: input.id },
        data: {
          isStarred: !existing.isStarred,
        },
      });
    }),
});
