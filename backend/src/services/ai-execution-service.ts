import { AI_ACTION_LABELS, buildAiPrompts } from "../ai/prompt-templates";
import { createAiProviderAdapter } from "../ai/provider-adapters";
import { AiOutputRepository } from "../repositories/ai-output-repository";
import { NoteRepository } from "../repositories/note-repository";
import { AiSettingsService } from "./ai-settings-service";
import type {
  AiActionType,
  AiExtractTaskCandidatesResult,
  AiOutputItem,
  AiRunNoteInput,
  AiTaskCandidate,
} from "../types";
import { HttpError } from "../utils/http-error";

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

function normalizeTaskLine(line: string) {
  if (!/^(\s*[-*+]\s+(\[(?: |x|X)\]\s+)?.+|\s*\d+\.\s+.+)$/.test(line)) {
    return "";
  }

  return line
    .trim()
    .replace(/^[-*+]\s+\[(?: |x|X)\]\s+/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .trim();
}

function extractTaskCandidatesFromMarkdown(contentMd: string): AiTaskCandidate[] {
  const rawLines = contentMd
    .split("\n")
    .map((line) => normalizeTaskLine(line))
    .filter(Boolean)
    .filter((line) => !/^no clear action items\.?$/i.test(line));

  const uniqueTitles = new Set<string>();

  return rawLines
    .filter((line) => {
      const normalized = line.toLowerCase();
      if (uniqueTitles.has(normalized)) {
        return false;
      }

      uniqueTitles.add(normalized);
      return true;
    })
    .map((title) => ({
      id: crypto.randomUUID(),
      title,
    }));
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
    return this.runOutputForNote(noteId, input);
  }

  async extractTaskCandidatesForNote(
    noteId: string,
  ): Promise<AiExtractTaskCandidatesResult> {
    const item = await this.runOutputForNote(noteId, {
      action: "extract_action_items",
    });

    return {
      item,
      candidates: extractTaskCandidatesFromMarkdown(item.contentMd),
    };
  }

  getActionLabel(action: AiActionType) {
    return AI_ACTION_LABELS[action];
  }

  private async runOutputForNote(
    noteId: string,
    input: AiRunNoteInput,
  ): Promise<AiOutputItem> {
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
    const prompts = buildAiPrompts(
      input.action,
      note.title,
      note.contentMd,
      input.prompt,
    );
    const adapter = createAiProviderAdapter(providerConfig.provider);
    let generation;

    try {
      generation = await adapter.generateText(providerConfig, prompts);
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.code === "AI_CONNECTION_FAILED") {
          throw new HttpError(
            error.status,
            error.code,
            `AI request failed. Open AI Settings and verify provider, model, endpoint, and API key. Details: ${error.message}`,
          );
        }

        throw error;
      }

      throw error;
    }
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
}
