import { createOpenAI } from "@ai-sdk/openai";

import { env } from "~/env.mjs";

const foundry = createOpenAI({
  name: "azure-foundry",
  apiKey: env.AZURE_FOUNDRY_API_KEY,
  baseURL: env.AZURE_FOUNDRY_ENDPOINT.replace(/\/$/, ""),
});

export const getFoundryModel = (deploymentName: string) =>
  foundry.responses(deploymentName);
