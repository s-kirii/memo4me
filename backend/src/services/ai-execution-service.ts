import { createAiProviderAdapter } from "../ai/provider-adapters";
import { AiOutputRepository } from "../repositories/ai-output-repository";
import { NoteRepository } from "../repositories/note-repository";
import { AiSettingsService } from "./ai-settings-service";
import type { AiActionType, AiOutputItem, AiRunNoteInput } from "../types";
import { HttpError } from "../utils/http-error";

const ACTION_LABELS: Record<AiActionType, string> = {
  summary: "Summary",
  structure: "Structured rewrite",
  extract_action_items: "Action items",
  quick_prompt: "Quick prompt",
};

function assertAction(action: string): asserts action is AiActionType {
  if (
    action !== "summary" &&
    action !== "structure" &&
    action !== "extract_action_items" &&
    action !== "quick_prompt"
  ) {
    throw new HttpError(400, "VALIDATION_ERROR", "action is invalid");
  }
}

function buildPrompts(
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

export class AiExecutionService {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly aiSettingsService: AiSettingsService,
    private readonly aiOutputRepository: AiOutputRepository,
  ) {}

  listOutputsForNote(noteId: string) {
    if (!this.noteRepository.noteExists(noteId)) {
      throw new HttpError(404, "NOT_FOUND", "note was not found");
    }

    return this.aiOutputRepository.listByNoteId(noteId);
  }

  async runForNote(noteId: string, input: AiRunNoteInput): Promise<AiOutputItem> {
    if (!this.noteRepository.noteExists(noteId)) {
      throw new HttpError(404, "NOT_FOUND", "note was not found");
    }

    if (typeof input.action !== "string") {
      throw new HttpError(400, "VALIDATION_ERROR", "action is required");
    }

    assertAction(input.action);

    if (input.action === "quick_prompt" && !input.prompt?.trim()) {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        "prompt is required for quick_prompt",
      );
    }

    const note = this.noteRepository.findById(noteId);
    if (!note) {
      throw new HttpError(404, "NOT_FOUND", "note was not found");
    }

    const providerConfig = this.aiSettingsService.getResolvedActiveProviderConfig();
    const prompts = buildPrompts(
      input.action,
      note.title,
      note.contentMd,
      input.prompt,
    );

    const adapter = createAiProviderAdapter(providerConfig.provider);
    const generation = await adapter.generateText(providerConfig, prompts);
    const now = new Date().toISOString();
    const output: AiOutputItem = {
      id: crypto.randomUUID(),
      noteId,
      provider: generation.provider,
      action: input.action,
      model: generation.model,
      contentMd: generation.text,
      createdAt: now,
    };

    this.aiOutputRepository.create({
      id: output.id,
      noteId: output.noteId,
      provider: output.provider,
      action: output.action,
      model: output.model,
      contentMd: output.contentMd,
      createdAt: output.createdAt,
    });

    return output;
  }

  getActionLabel(action: AiActionType) {
    return ACTION_LABELS[action];
  }
}
