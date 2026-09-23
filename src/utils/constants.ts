export const MODELS = {
  GPT_4O: "gpt-4o",
  GPT_5: "gpt-5",
  GPT_5_MINI: "gpt-5-mini",
  GPT_5_2: "gpt-5.2",
  GPT_5_6_TERRA: "gpt-5.6-terra",
  GPT_6_LUNA: "gpt-6-luna",
  GPT_6_SOL: "gpt-6-sol",
};

export const FOUNDRY_MODELS = new Set([
  MODELS.GPT_5_6_TERRA,
  MODELS.GPT_6_LUNA,
  MODELS.GPT_6_SOL,
]);

export const DIFFICULTY_LEVELS = {
  HIGH_SCHOOL: "high_school",
  COLLEGE: "college",
  POST_GRAD: "post_grad",
} as const;

export const DIFFICULTY_LABELS: Record<string, string> = {
  [DIFFICULTY_LEVELS.HIGH_SCHOOL]: "High School",
  [DIFFICULTY_LEVELS.COLLEGE]: "College",
  [DIFFICULTY_LEVELS.POST_GRAD]: "Post-Grad",
};
