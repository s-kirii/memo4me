import type { AiActionType } from "../types";

export const AI_ACTION_LABELS: Record<AiActionType, string> = {
  summary: "Summary",
  structure: "Structured rewrite",
  extract_action_items: "Action items",
  quick_prompt: "Quick prompt",
};

export const AI_ACTION_DESCRIPTIONS: Record<AiActionType, string> = {
  summary: "Condense the current note into a short, reliable summary.",
  structure: "Reorganize the current note into clearer markdown.",
  extract_action_items:
    "Extract concrete next actions and return them as task-ready checklist items.",
  quick_prompt: "Run a freeform prompt against the current note context.",
};

export function buildAiPrompts(
  action: AiActionType,
  noteTitle: string,
  noteContentMd: string,
  customPrompt?: string,
) {
  const baseContext = [
    `Title: ${noteTitle.trim() || "Untitled"}`,
    "",
    "Note content in Markdown:",
    noteContentMd || "(empty)",
  ].join("\n");

  if (action === "summary") {
    return {
      systemPrompt:
        "You are an assistant inside a local note app. Produce concise, accurate markdown. Do not invent facts.",
      userPrompt: [
        "Summarize the note in markdown.",
        "Keep the answer concise and useful.",
        "Prefer short sections and bullets when helpful.",
        "",
        baseContext,
      ].join("\n"),
    };
  }

  if (action === "structure") {
    return {
      systemPrompt:
        "You reorganize notes into clearer markdown while preserving meaning. Do not add facts that are not present in the source.",
      userPrompt: [
        "Rewrite this note into a clearer structured markdown document.",
        "Use headings and bullets where they help readability.",
        "",
        baseContext,
      ].join("\n"),
    };
  }

  if (action === "extract_action_items") {
    return {
      systemPrompt:
        "You extract only concrete actionable tasks from notes. Return markdown only.",
      userPrompt: [
        "Extract action items from this note.",
        "Return a markdown checklist using '- [ ]'.",
        "Only include actions the user could realistically do next.",
        "If there are no clear tasks, say 'No clear action items.'",
        "",
        baseContext,
      ].join("\n"),
    };
  }

  return {
    systemPrompt:
      "You are an assistant inside a local note app. Use the note as source context and respond in markdown.",
    userPrompt: [
      `User instruction: ${customPrompt?.trim() || "Help with this note."}`,
      "",
      baseContext,
    ].join("\n"),
  };
}
