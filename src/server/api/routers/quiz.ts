import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { Configuration, OpenAIApi } from "openai";
import { env } from "~/env.mjs";
import { TRPCError } from "@trpc/server";
import { MODELS } from "~/utils/constants";

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

// Schema for question with answers
const questionWithAnswersSchema = z.object({
  questionText: z.string(),
  answers: z.array(
    z.object({
      text: z.string(),
      isCorrect: z.boolean(),
    })
  ),
});

export const quizRouter = createTRPCRouter({
  // Generate a title for a quiz using AI
  generateTitle: protectedProcedure
    .input(
      z.object({
        topic: z.string(),
        questionSamples: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const openai = getOpenAI(MODELS.GPT_5_MINI);

      const questionContext = input.questionSamples?.length
        ? ` Some sample questions: ${input.questionSamples
            .slice(0, 3)
            .join("; ")}`
        : "";

      const titlePrompt = `Generate a short, catchy title (max 50 characters) for a quiz about "${input.topic}".${questionContext} Return only the title, nothing else.`;

      try {
        const chatCompletion = await openai.createChatCompletion(
          {
            model: MODELS.GPT_5_MINI,
            messages: [{ role: "user", content: titlePrompt }],
            max_tokens: 60,
          },
          AZURE_API_OPTIONS
        );

        const title =
          chatCompletion.data.choices[0]?.message?.content?.trim() ||
          `Quiz: ${input.topic}`;

        // Clean up the title (remove quotes if present)
        return title.replace(/^["']|["']$/g, "").substring(0, 50);
      } catch (err) {
        console.error("Failed to generate title:", err);
        // Fallback to a simple title
        return `Quiz: ${input.topic}`.substring(0, 50);
      }
    }),

  // Create a new quiz with questions
  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        topic: z.string().optional(),
        timeLimit: z.number().default(20),
        difficulty: z.string().optional(),
        questions: z.array(questionWithAnswersSchema),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Create the quiz
      const quiz = await ctx.prisma.quiz.create({
        data: {
          name: input.name,
          description: input.description,
          topic: input.topic,
          timeLimit: input.timeLimit,
          difficulty: input.difficulty,
          authorId: userId,
        },
      });

      // Create questions and link them to the quiz
      for (let i = 0; i < input.questions.length; i++) {
        const q = input.questions[i]!;

        // Create the question
        const question = await ctx.prisma.question.create({
          data: {
            questionText: q.questionText,
            subject: input.topic || "General",
            authorId: userId,
            answers: {
              create: q.answers.map((a) => ({
                answerText: a.text,
                isCorrect: a.isCorrect,
              })),
            },
          },
        });

        // Link question to quiz
        await ctx.prisma.quizQuestion.create({
          data: {
            quizId: quiz.id,
            questionId: question.id,
            order: i,
          },
        });
      }

      return quiz;
    }),

  // Get all quizzes for the current user
  getAll: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(20),
          cursor: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;

      const quizzes = await ctx.prisma.quiz.findMany({
        where: {
          authorId: ctx.session.user.id,
        },
        include: {
          questions: {
            include: {
              question: true,
            },
            orderBy: {
              order: "asc",
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: limit + 1,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined = undefined;
      if (quizzes.length > limit) {
        const nextItem = quizzes.pop();
        nextCursor = nextItem?.id;
      }

      return {
        quizzes,
        nextCursor,
      };
    }),

  // Get a single quiz by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const quiz = await ctx.prisma.quiz.findUnique({
        where: {
          id: input.id,
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
        },
      });

      if (!quiz) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Quiz not found",
        });
      }

      // Verify ownership
      if (quiz.authorId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to view this quiz",
        });
      }

      return quiz;
    }),

  // Update quiz metadata
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        topic: z.string().optional(),
        timeLimit: z.number().optional(),
        difficulty: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const existing = await ctx.prisma.quiz.findUnique({
        where: { id: input.id },
      });

      if (!existing || existing.authorId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to update this quiz",
        });
      }

      const { id, ...data } = input;

      return ctx.prisma.quiz.update({
        where: { id },
        data,
      });
    }),

  // Delete a quiz
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const existing = await ctx.prisma.quiz.findUnique({
        where: { id: input.id },
      });

      if (!existing || existing.authorId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to delete this quiz",
        });
      }

      // Delete QuizQuestion entries first (cascades should handle this, but being explicit)
      await ctx.prisma.quizQuestion.deleteMany({
        where: { quizId: input.id },
      });

      return ctx.prisma.quiz.delete({
        where: { id: input.id },
      });
    }),

  // Add a question to a quiz
  addQuestion: protectedProcedure
    .input(
      z.object({
        quizId: z.string(),
        questionId: z.string(),
        order: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify quiz ownership
      const quiz = await ctx.prisma.quiz.findUnique({
        where: { id: input.quizId },
      });

      if (!quiz || quiz.authorId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to modify this quiz",
        });
      }

      // Get current max order if not specified
      let order = input.order;
      if (order === undefined) {
        const maxOrder = await ctx.prisma.quizQuestion.findFirst({
          where: { quizId: input.quizId },
          orderBy: { order: "desc" },
          select: { order: true },
        });
        order = (maxOrder?.order ?? -1) + 1;
      }

      return ctx.prisma.quizQuestion.create({
        data: {
          quizId: input.quizId,
          questionId: input.questionId,
          order,
        },
      });
    }),

  // Remove a question from a quiz
  removeQuestion: protectedProcedure
    .input(
      z.object({
        quizId: z.string(),
        questionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify quiz ownership
      const quiz = await ctx.prisma.quiz.findUnique({
        where: { id: input.quizId },
      });

      if (!quiz || quiz.authorId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to modify this quiz",
        });
      }

      return ctx.prisma.quizQuestion.delete({
        where: {
          quizId_questionId: {
            quizId: input.quizId,
            questionId: input.questionId,
          },
        },
      });
    }),

  // Reorder questions in a quiz
  reorderQuestions: protectedProcedure
    .input(
      z.object({
        quizId: z.string(),
        questionIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify quiz ownership
      const quiz = await ctx.prisma.quiz.findUnique({
        where: { id: input.quizId },
      });

      if (!quiz || quiz.authorId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to modify this quiz",
        });
      }

      // Update order for each question
      await Promise.all(
        input.questionIds.map((questionId, index) =>
          ctx.prisma.quizQuestion.update({
            where: {
              quizId_questionId: {
                quizId: input.quizId,
                questionId,
              },
            },
            data: {
              order: index,
            },
          })
        )
      );

      return { success: true };
    }),
});


