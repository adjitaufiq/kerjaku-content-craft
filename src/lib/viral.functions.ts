import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const WORKFLOW_STATUSES = [
  "draft",
  "analyzing",
  "analyzed",
  "revision_needed",
  "approved",
  "ready_production",
  "published",
] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const ANALYSIS_STATUSES = [
  "not_started",
  "queued",
  "in_progress",
  "completed",
  "failed",
] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const CONTENT_TYPES = ["carousel", "photo_to_video", "video_content"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export type ViralReference = {
  id: string;
  source_platform: string;
  source_url: string | null;
  uploaded_file: string | null;
  title: string;
  category: string | null;
  status: WorkflowStatus;
  content_analysis_status: AnalysisStatus;
  created_at: string;
  updated_at: string;
};

export type GeneratedDraft = {
  id: string;
  reference_id: string;
  content_title: string;
  content_type: ContentType;
  status: WorkflowStatus;
  created_at: string;
};

export const listViralWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ references: ViralReference[]; drafts: GeneratedDraft[] }> => {
      const [refs, drafts] = await Promise.all([
        context.supabase
          .from("viral_content_references")
          .select("*")
          .order("created_at", { ascending: false }),
        context.supabase
          .from("generated_content_drafts")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      if (refs.error) throw new Error(refs.error.message);
      if (drafts.error) throw new Error(drafts.error.message);
      return {
        references: (refs.data ?? []) as ViralReference[],
        drafts: (drafts.data ?? []) as GeneratedDraft[],
      };
    },
  );

export const createViralReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      title: string;
      sourcePlatform: string;
      sourceUrl?: string | null;
      uploadedFile?: string | null;
      category?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const title = data.title.trim();
    if (!title) throw new Error("Judul referensi wajib diisi.");
    const sourceUrl = data.sourceUrl?.trim() || null;
    if (!sourceUrl && !data.uploadedFile) {
      throw new Error("Isi tautan sumber atau unggah file video.");
    }
    const { data: created, error } = await context.supabase
      .from("viral_content_references")
      .insert({
        user_id: context.userId,
        title,
        source_platform: data.sourcePlatform,
        source_url: sourceUrl,
        uploaded_file: data.uploadedFile ?? null,
        category: data.category?.trim() || null,
        status: "draft",
        content_analysis_status: "not_started",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const updateViralReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      status?: WorkflowStatus;
      contentAnalysisStatus?: AnalysisStatus;
      category?: string | null;
      title?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const patch: {
      status?: WorkflowStatus;
      content_analysis_status?: AnalysisStatus;
      category?: string | null;
      title?: string;
    } = {};
    if (data.status) patch.status = data.status;
    if (data.contentAnalysisStatus) patch.content_analysis_status = data.contentAnalysisStatus;
    if (data.category !== undefined) patch.category = data.category?.trim() || null;
    if (data.title !== undefined) patch.title = data.title.trim();
    const { error } = await context.supabase
      .from("viral_content_references")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteViralReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("viral_content_references")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createGeneratedDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { referenceId: string; contentTitle: string; contentType: ContentType }) => input,
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const title = data.contentTitle.trim();
    if (!title) throw new Error("Judul draft wajib diisi.");
    const { data: created, error } = await context.supabase
      .from("generated_content_drafts")
      .insert({
        user_id: context.userId,
        reference_id: data.referenceId,
        content_title: title,
        content_type: data.contentType,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const updateGeneratedDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: WorkflowStatus }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("generated_content_drafts")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGeneratedDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("generated_content_drafts")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
