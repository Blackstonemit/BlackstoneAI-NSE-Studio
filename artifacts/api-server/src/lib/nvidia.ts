import OpenAI from "openai";

if (!process.env.NVIDIA_API_KEY) {
  throw new Error("NVIDIA_API_KEY must be set.");
}

export const nvidia = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export const NVIDIA_MODEL = "qwen/qwen3-235b-a22b";
