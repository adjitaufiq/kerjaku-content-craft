export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_baseline: {
        Row: {
          avg_engagement_rate: number
          avg_views: number
          created_at: string
          id: string
          sample_size: number
          updated_at: string
          user_id: string
          window_days: number
        }
        Insert: {
          avg_engagement_rate?: number
          avg_views?: number
          created_at?: string
          id?: string
          sample_size?: number
          updated_at?: string
          user_id: string
          window_days?: number
        }
        Update: {
          avg_engagement_rate?: number
          avg_views?: number
          created_at?: string
          id?: string
          sample_size?: number
          updated_at?: string
          user_id?: string
          window_days?: number
        }
        Relationships: []
      }
      brand_knowledge_versions: {
        Row: {
          created_at: string
          id: string
          readiness: string
          snapshot: Json
          user_id: string
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          readiness?: string
          snapshot?: Json
          user_id: string
          version: string
        }
        Update: {
          created_at?: string
          id?: string
          readiness?: string
          snapshot?: Json
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      brand_power_words: {
        Row: {
          category: string
          context: string
          created_at: string
          forbidden_usage: string
          id: string
          updated_at: string
          usage_example: string
          user_id: string
          word: string
        }
        Insert: {
          category?: string
          context?: string
          created_at?: string
          forbidden_usage?: string
          id?: string
          updated_at?: string
          usage_example?: string
          user_id: string
          word?: string
        }
        Update: {
          category?: string
          context?: string
          created_at?: string
          forbidden_usage?: string
          id?: string
          updated_at?: string
          usage_example?: string
          user_id?: string
          word?: string
        }
        Relationships: []
      }
      brand_products: {
        Row: {
          allowed_claims: string[]
          benefit: string
          category: string
          created_at: string
          description: string
          features: string[]
          forbidden_claims: string[]
          id: string
          name: string
          status: string
          target_user: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_claims?: string[]
          benefit?: string
          category?: string
          created_at?: string
          description?: string
          features?: string[]
          forbidden_claims?: string[]
          id?: string
          name?: string
          status?: string
          target_user?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_claims?: string[]
          benefit?: string
          category?: string
          created_at?: string
          description?: string
          features?: string[]
          forbidden_claims?: string[]
          id?: string
          name?: string
          status?: string
          target_user?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      brand_profile: {
        Row: {
          audience: string
          brand_name: string
          created_at: string
          customer_desire: string
          customer_problem: string
          description: string
          forbidden_style: string
          id: string
          mission: string
          personality: string
          positioning: string
          preferred_style: string
          tone_of_voice: string
          updated_at: string
          user_id: string
          version: string
          visual_direction: string
          writing_style: string
        }
        Insert: {
          audience?: string
          brand_name?: string
          created_at?: string
          customer_desire?: string
          customer_problem?: string
          description?: string
          forbidden_style?: string
          id?: string
          mission?: string
          personality?: string
          positioning?: string
          preferred_style?: string
          tone_of_voice?: string
          updated_at?: string
          user_id: string
          version?: string
          visual_direction?: string
          writing_style?: string
        }
        Update: {
          audience?: string
          brand_name?: string
          created_at?: string
          customer_desire?: string
          customer_problem?: string
          description?: string
          forbidden_style?: string
          id?: string
          mission?: string
          personality?: string
          positioning?: string
          preferred_style?: string
          tone_of_voice?: string
          updated_at?: string
          user_id?: string
          version?: string
          visual_direction?: string
          writing_style?: string
        }
        Relationships: []
      }
      brand_rules: {
        Row: {
          created_at: string
          id: string
          rule: string
          rule_category: string
          rule_type: string
          severity: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rule?: string
          rule_category?: string
          rule_type?: string
          severity?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rule?: string
          rule_category?: string
          rule_type?: string
          severity?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      content_bank: {
        Row: {
          caption: string
          content_number: number
          created_at: string
          id: string
          prompt: string
          title: string
        }
        Insert: {
          caption?: string
          content_number: number
          created_at?: string
          id?: string
          prompt?: string
          title?: string
        }
        Update: {
          caption?: string
          content_number?: number
          created_at?: string
          id?: string
          prompt?: string
          title?: string
        }
        Relationships: []
      }
      content_downloads: {
        Row: {
          audience_type: string | null
          caption: string
          category: string | null
          content_structure: string | null
          content_type: string
          created_at: string
          creator_username: string | null
          cta_analysis: string | null
          duration: number | null
          editing_style: string | null
          error_message: string | null
          hook_analysis: string | null
          id: string
          is_favorite: boolean
          notes: string
          resolution: string | null
          source_platform: string
          source_url: string
          status: string
          tags: string[]
          thumbnail_path: string | null
          thumbnail_url: string | null
          updated_at: string
          video_path: string | null
          video_url: string | null
          viral_pattern: string | null
        }
        Insert: {
          audience_type?: string | null
          caption?: string
          category?: string | null
          content_structure?: string | null
          content_type?: string
          created_at?: string
          creator_username?: string | null
          cta_analysis?: string | null
          duration?: number | null
          editing_style?: string | null
          error_message?: string | null
          hook_analysis?: string | null
          id?: string
          is_favorite?: boolean
          notes?: string
          resolution?: string | null
          source_platform?: string
          source_url: string
          status?: string
          tags?: string[]
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          video_path?: string | null
          video_url?: string | null
          viral_pattern?: string | null
        }
        Update: {
          audience_type?: string | null
          caption?: string
          category?: string | null
          content_structure?: string | null
          content_type?: string
          created_at?: string
          creator_username?: string | null
          cta_analysis?: string | null
          duration?: number | null
          editing_style?: string | null
          error_message?: string | null
          hook_analysis?: string | null
          id?: string
          is_favorite?: boolean
          notes?: string
          resolution?: string | null
          source_platform?: string
          source_url?: string
          status?: string
          tags?: string[]
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          video_path?: string | null
          video_url?: string | null
          viral_pattern?: string | null
        }
        Relationships: []
      }
      content_library: {
        Row: {
          approval_status: Database["public"]["Enums"]["content_approval_status"]
          atm_mode: Database["public"]["Enums"]["atm_mode"]
          category: string | null
          content_assets: Json
          content_log_id: string | null
          created_at: string
          hook_type: string
          id: string
          overridden_at: string | null
          overridden_by: string | null
          override_note: string
          published_at: string | null
          quality_result: Json
          source_data: Json
          source_id: string | null
          title: string
          updated_at: string
          user_id: string
          version_id: string
          viral_attributes: Json
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["content_approval_status"]
          atm_mode?: Database["public"]["Enums"]["atm_mode"]
          category?: string | null
          content_assets?: Json
          content_log_id?: string | null
          created_at?: string
          hook_type?: string
          id?: string
          overridden_at?: string | null
          overridden_by?: string | null
          override_note?: string
          published_at?: string | null
          quality_result?: Json
          source_data?: Json
          source_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
          version_id: string
          viral_attributes?: Json
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["content_approval_status"]
          atm_mode?: Database["public"]["Enums"]["atm_mode"]
          category?: string | null
          content_assets?: Json
          content_log_id?: string | null
          created_at?: string
          hook_type?: string
          id?: string
          overridden_at?: string | null
          overridden_by?: string | null
          override_note?: string
          published_at?: string | null
          quality_result?: Json
          source_data?: Json
          source_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          version_id?: string
          viral_attributes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "content_library_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "viral_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_library_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: true
            referencedRelation: "kerjaku_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      content_logs: {
        Row: {
          caption: string
          content_number: number
          created_at: string
          error_message: string | null
          id: string
          ig_creation_id: string | null
          ig_post_id: string | null
          image_url: string | null
          image_urls: string[]
          scheduled_at: string | null
          status: string
          title: string
        }
        Insert: {
          caption?: string
          content_number: number
          created_at?: string
          error_message?: string | null
          id?: string
          ig_creation_id?: string | null
          ig_post_id?: string | null
          image_url?: string | null
          image_urls?: string[]
          scheduled_at?: string | null
          status?: string
          title?: string
        }
        Update: {
          caption?: string
          content_number?: number
          created_at?: string
          error_message?: string | null
          id?: string
          ig_creation_id?: string | null
          ig_post_id?: string | null
          image_url?: string | null
          image_urls?: string[]
          scheduled_at?: string | null
          status?: string
          title?: string
        }
        Relationships: []
      }
      content_performance: {
        Row: {
          comments: number
          content_id: string
          created_at: string
          engagement_rate: number
          id: string
          likes: number
          measured_at: string
          measurement_period: Database["public"]["Enums"]["performance_period"]
          saves: number
          shares: number
          updated_at: string
          user_id: string
          views: number
        }
        Insert: {
          comments?: number
          content_id: string
          created_at?: string
          engagement_rate?: number
          id?: string
          likes?: number
          measured_at?: string
          measurement_period: Database["public"]["Enums"]["performance_period"]
          saves?: number
          shares?: number
          updated_at?: string
          user_id: string
          views?: number
        }
        Update: {
          comments?: number
          content_id?: string
          created_at?: string
          engagement_rate?: number
          id?: string
          likes?: number
          measured_at?: string
          measurement_period?: Database["public"]["Enums"]["performance_period"]
          saves?: number
          shares?: number
          updated_at?: string
          user_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_performance_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_library"
            referencedColumns: ["id"]
          },
        ]
      }
      content_production_results: {
        Row: {
          atm_mode: Database["public"]["Enums"]["atm_mode"]
          caption_options: Json
          carousel_structure: Json
          content_info: Json
          created_at: string
          cta_options: Json
          hashtags: Json
          id: string
          model: string
          updated_at: string
          user_id: string
          version_id: string
          visual_prompts: Json
        }
        Insert: {
          atm_mode: Database["public"]["Enums"]["atm_mode"]
          caption_options?: Json
          carousel_structure?: Json
          content_info?: Json
          created_at?: string
          cta_options?: Json
          hashtags?: Json
          id?: string
          model?: string
          updated_at?: string
          user_id: string
          version_id: string
          visual_prompts?: Json
        }
        Update: {
          atm_mode?: Database["public"]["Enums"]["atm_mode"]
          caption_options?: Json
          carousel_structure?: Json
          content_info?: Json
          created_at?: string
          cta_options?: Json
          hashtags?: Json
          id?: string
          model?: string
          updated_at?: string
          user_id?: string
          version_id?: string
          visual_prompts?: Json
        }
        Relationships: [
          {
            foreignKeyName: "content_production_results_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: true
            referencedRelation: "kerjaku_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      content_remix_results: {
        Row: {
          angle_rationale: string
          captions: Json
          content_angle: string
          content_type: Database["public"]["Enums"]["generated_content_type"]
          created_at: string
          ctas: Json
          hashtags: string[]
          id: string
          model: string
          quality_check: Json
          reference_id: string
          slides: Json
          structure_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          angle_rationale?: string
          captions?: Json
          content_angle?: string
          content_type?: Database["public"]["Enums"]["generated_content_type"]
          created_at?: string
          ctas?: Json
          hashtags?: string[]
          id?: string
          model?: string
          quality_check?: Json
          reference_id: string
          slides?: Json
          structure_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          angle_rationale?: string
          captions?: Json
          content_angle?: string
          content_type?: Database["public"]["Enums"]["generated_content_type"]
          created_at?: string
          ctas?: Json
          hashtags?: string[]
          id?: string
          model?: string
          quality_check?: Json
          reference_id?: string
          slides?: Json
          structure_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_remix_results_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: true
            referencedRelation: "viral_content_references"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_content_drafts: {
        Row: {
          content_title: string
          content_type: Database["public"]["Enums"]["generated_content_type"]
          created_at: string
          id: string
          reference_id: string
          status: Database["public"]["Enums"]["viral_workflow_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          content_title?: string
          content_type?: Database["public"]["Enums"]["generated_content_type"]
          created_at?: string
          id?: string
          reference_id: string
          status?: Database["public"]["Enums"]["viral_workflow_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          content_title?: string
          content_type?: Database["public"]["Enums"]["generated_content_type"]
          created_at?: string
          id?: string
          reference_id?: string
          status?: Database["public"]["Enums"]["viral_workflow_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_content_drafts_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "viral_content_references"
            referencedColumns: ["id"]
          },
        ]
      }
      kerjaku_versions: {
        Row: {
          adaptation: Json
          angle: string
          approval_note: string
          approved_at: string | null
          atm_mode: Database["public"]["Enums"]["atm_mode"]
          brand_profile_version: string
          created_at: string
          hook_candidates: Json
          hook_selected_at: string | null
          id: string
          model: string
          reason: string
          selected_hook: Json | null
          source_id: string
          source_mapping: Json
          status: Database["public"]["Enums"]["atm_version_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          adaptation?: Json
          angle?: string
          approval_note?: string
          approved_at?: string | null
          atm_mode?: Database["public"]["Enums"]["atm_mode"]
          brand_profile_version?: string
          created_at?: string
          hook_candidates?: Json
          hook_selected_at?: string | null
          id?: string
          model?: string
          reason?: string
          selected_hook?: Json | null
          source_id: string
          source_mapping?: Json
          status?: Database["public"]["Enums"]["atm_version_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          adaptation?: Json
          angle?: string
          approval_note?: string
          approved_at?: string | null
          atm_mode?: Database["public"]["Enums"]["atm_mode"]
          brand_profile_version?: string
          created_at?: string
          hook_candidates?: Json
          hook_selected_at?: string | null
          id?: string
          model?: string
          reason?: string
          selected_hook?: Json | null
          source_id?: string
          source_mapping?: Json
          status?: Database["public"]["Enums"]["atm_version_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kerjaku_versions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "viral_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_credentials: {
        Row: {
          app_id: string | null
          expires_in_exact: boolean
          id: string
          ig_account_id: string | null
          scopes: string[]
          status: string
          token_ciphertext: string
          token_created_at: string
          token_expires_at: string
          token_fingerprint: string
          token_last_updated_at: string
          token_type: string
          updated_by: string | null
          version: number
        }
        Insert: {
          app_id?: string | null
          expires_in_exact?: boolean
          id?: string
          ig_account_id?: string | null
          scopes?: string[]
          status?: string
          token_ciphertext: string
          token_created_at?: string
          token_expires_at: string
          token_fingerprint: string
          token_last_updated_at?: string
          token_type?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          app_id?: string | null
          expires_in_exact?: boolean
          id?: string
          ig_account_id?: string | null
          scopes?: string[]
          status?: string
          token_ciphertext?: string
          token_created_at?: string
          token_expires_at?: string
          token_fingerprint?: string
          token_last_updated_at?: string
          token_type?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      meta_token_meta: {
        Row: {
          expires_in_exact: boolean
          id: string
          last_checked_at: string
          meta_expires_in_seconds: number | null
          token_created_at: string
          token_expires_at: string
          token_fingerprint: string
          token_last_updated_at: string
          token_type: string
        }
        Insert: {
          expires_in_exact?: boolean
          id?: string
          last_checked_at?: string
          meta_expires_in_seconds?: number | null
          token_created_at?: string
          token_expires_at: string
          token_fingerprint: string
          token_last_updated_at?: string
          token_type?: string
        }
        Update: {
          expires_in_exact?: boolean
          id?: string
          last_checked_at?: string
          meta_expires_in_seconds?: number | null
          token_created_at?: string
          token_expires_at?: string
          token_fingerprint?: string
          token_last_updated_at?: string
          token_type?: string
        }
        Relationships: []
      }
      quality_scores: {
        Row: {
          atm_mode: Database["public"]["Enums"]["atm_mode"]
          brand_safety: number
          created_at: string
          cta_score: number
          curiosity_score: number
          failed_criteria: Json
          hard_failures: string[]
          id: string
          judge_result: Json
          model: string
          overall_score: number
          pattern_score: number
          power_score: number
          repair_attempted: boolean
          repair_note: string
          rule_result: Json
          source_fidelity_score: number
          status: Database["public"]["Enums"]["quality_gate_status"]
          structural_result: Json
          trigger_score: number
          updated_at: string
          user_id: string
          version_id: string
        }
        Insert: {
          atm_mode?: Database["public"]["Enums"]["atm_mode"]
          brand_safety?: number
          created_at?: string
          cta_score?: number
          curiosity_score?: number
          failed_criteria?: Json
          hard_failures?: string[]
          id?: string
          judge_result?: Json
          model?: string
          overall_score?: number
          pattern_score?: number
          power_score?: number
          repair_attempted?: boolean
          repair_note?: string
          rule_result?: Json
          source_fidelity_score?: number
          status?: Database["public"]["Enums"]["quality_gate_status"]
          structural_result?: Json
          trigger_score?: number
          updated_at?: string
          user_id: string
          version_id: string
        }
        Update: {
          atm_mode?: Database["public"]["Enums"]["atm_mode"]
          brand_safety?: number
          created_at?: string
          cta_score?: number
          curiosity_score?: number
          failed_criteria?: Json
          hard_failures?: string[]
          id?: string
          judge_result?: Json
          model?: string
          overall_score?: number
          pattern_score?: number
          power_score?: number
          repair_attempted?: boolean
          repair_note?: string
          rule_result?: Json
          source_fidelity_score?: number
          status?: Database["public"]["Enums"]["quality_gate_status"]
          structural_result?: Json
          trigger_score?: number
          updated_at?: string
          user_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_scores_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: true
            referencedRelation: "kerjaku_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      source_extraction_archives: {
        Row: {
          archived_reason: string
          created_at: string
          id: string
          snapshot: Json
          source_id: string
          user_id: string
        }
        Insert: {
          archived_reason?: string
          created_at?: string
          id?: string
          snapshot?: Json
          source_id: string
          user_id: string
        }
        Update: {
          archived_reason?: string
          created_at?: string
          id?: string
          snapshot?: Json
          source_id?: string
          user_id?: string
        }
        Relationships: []
      }
      source_extractions: {
        Row: {
          completeness_score: number
          confidence_score: number
          coverage_score: number
          created_at: string
          error_message: string | null
          failed_stage: string | null
          has_audio: boolean
          id: string
          last_heartbeat_at: string
          model: string
          on_screen_text: Json
          pipeline_stage: string
          report_confidence: number
          snapshot_data: Json
          source_confidence: number
          source_id: string
          source_report: Json
          stage_changed_at: string
          transcript: Json
          updated_at: string
          user_id: string
          verification_status: Database["public"]["Enums"]["source_extraction_status"]
          video_metadata: Json
          visual_analysis: Json
        }
        Insert: {
          completeness_score?: number
          confidence_score?: number
          coverage_score?: number
          created_at?: string
          error_message?: string | null
          failed_stage?: string | null
          has_audio?: boolean
          id?: string
          last_heartbeat_at?: string
          model?: string
          on_screen_text?: Json
          pipeline_stage?: string
          report_confidence?: number
          snapshot_data?: Json
          source_confidence?: number
          source_id: string
          source_report?: Json
          stage_changed_at?: string
          transcript?: Json
          updated_at?: string
          user_id: string
          verification_status?: Database["public"]["Enums"]["source_extraction_status"]
          video_metadata?: Json
          visual_analysis?: Json
        }
        Update: {
          completeness_score?: number
          confidence_score?: number
          coverage_score?: number
          created_at?: string
          error_message?: string | null
          failed_stage?: string | null
          has_audio?: boolean
          id?: string
          last_heartbeat_at?: string
          model?: string
          on_screen_text?: Json
          pipeline_stage?: string
          report_confidence?: number
          snapshot_data?: Json
          source_confidence?: number
          source_id?: string
          source_report?: Json
          stage_changed_at?: string
          transcript?: Json
          updated_at?: string
          user_id?: string
          verification_status?: Database["public"]["Enums"]["source_extraction_status"]
          video_metadata?: Json
          visual_analysis?: Json
        }
        Relationships: [
          {
            foreignKeyName: "source_extractions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: true
            referencedRelation: "viral_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_storyboards: {
        Row: {
          atm_mode: Database["public"]["Enums"]["atm_mode"]
          created_at: string
          id: string
          model: string
          scene_count: number
          scenes: Json
          total_duration: number
          updated_at: string
          user_id: string
          version_id: string
          video_concept: Json
          video_package: Json
        }
        Insert: {
          atm_mode: Database["public"]["Enums"]["atm_mode"]
          created_at?: string
          id?: string
          model?: string
          scene_count?: number
          scenes?: Json
          total_duration?: number
          updated_at?: string
          user_id: string
          version_id: string
          video_concept?: Json
          video_package?: Json
        }
        Update: {
          atm_mode?: Database["public"]["Enums"]["atm_mode"]
          created_at?: string
          id?: string
          model?: string
          scene_count?: number
          scenes?: Json
          total_duration?: number
          updated_at?: string
          user_id?: string
          version_id?: string
          video_concept?: Json
          video_package?: Json
        }
        Relationships: [
          {
            foreignKeyName: "video_storyboards_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: true
            referencedRelation: "kerjaku_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      viral_analysis_reports: {
        Row: {
          audience: string
          content_category: string
          content_summary: string
          created_at: string
          curiosity_gap: string
          emotional_angle: string
          hook_formula: string
          id: string
          main_topic: string
          model: string
          modification_ideas: string
          pattern_interrupt: string
          power_word: string
          problem: string
          psychological_trigger: string
          reference_id: string
          solution: string
          storytelling_style: string
          updated_at: string
          user_id: string
          why_this_works: string
        }
        Insert: {
          audience?: string
          content_category?: string
          content_summary?: string
          created_at?: string
          curiosity_gap?: string
          emotional_angle?: string
          hook_formula?: string
          id?: string
          main_topic?: string
          model?: string
          modification_ideas?: string
          pattern_interrupt?: string
          power_word?: string
          problem?: string
          psychological_trigger?: string
          reference_id: string
          solution?: string
          storytelling_style?: string
          updated_at?: string
          user_id: string
          why_this_works?: string
        }
        Update: {
          audience?: string
          content_category?: string
          content_summary?: string
          created_at?: string
          curiosity_gap?: string
          emotional_angle?: string
          hook_formula?: string
          id?: string
          main_topic?: string
          model?: string
          modification_ideas?: string
          pattern_interrupt?: string
          power_word?: string
          problem?: string
          psychological_trigger?: string
          reference_id?: string
          solution?: string
          storytelling_style?: string
          updated_at?: string
          user_id?: string
          why_this_works?: string
        }
        Relationships: [
          {
            foreignKeyName: "viral_analysis_reports_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: true
            referencedRelation: "viral_content_references"
            referencedColumns: ["id"]
          },
        ]
      }
      viral_content_references: {
        Row: {
          category: string | null
          content_analysis_status: Database["public"]["Enums"]["viral_analysis_status"]
          created_at: string
          id: string
          source_platform: string
          source_url: string | null
          status: Database["public"]["Enums"]["viral_workflow_status"]
          title: string
          updated_at: string
          uploaded_file: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          content_analysis_status?: Database["public"]["Enums"]["viral_analysis_status"]
          created_at?: string
          id?: string
          source_platform?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["viral_workflow_status"]
          title?: string
          updated_at?: string
          uploaded_file?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          content_analysis_status?: Database["public"]["Enums"]["viral_analysis_status"]
          created_at?: string
          id?: string
          source_platform?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["viral_workflow_status"]
          title?: string
          updated_at?: string
          uploaded_file?: string | null
          user_id?: string
        }
        Relationships: []
      }
      viral_intelligence: {
        Row: {
          comment_trigger: string
          confidence_score: number
          created_at: string
          curiosity_gap: string
          engagement_factor: string
          evidence: Json
          hook: string
          hook_category: string
          hook_reason: string
          hook_type: string
          id: string
          model: string
          pattern_interrupt: string
          power_words: string[]
          psychological_trigger: string
          retention_factor: string
          save_trigger: string
          share_trigger: string
          source_id: string
          story_beats: Json
          structure_category: string
          structure_type: string
          trigger_category: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment_trigger?: string
          confidence_score?: number
          created_at?: string
          curiosity_gap?: string
          engagement_factor?: string
          evidence?: Json
          hook?: string
          hook_category?: string
          hook_reason?: string
          hook_type?: string
          id?: string
          model?: string
          pattern_interrupt?: string
          power_words?: string[]
          psychological_trigger?: string
          retention_factor?: string
          save_trigger?: string
          share_trigger?: string
          source_id: string
          story_beats?: Json
          structure_category?: string
          structure_type?: string
          trigger_category?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment_trigger?: string
          confidence_score?: number
          created_at?: string
          curiosity_gap?: string
          engagement_factor?: string
          evidence?: Json
          hook?: string
          hook_category?: string
          hook_reason?: string
          hook_type?: string
          id?: string
          model?: string
          pattern_interrupt?: string
          power_words?: string[]
          psychological_trigger?: string
          retention_factor?: string
          save_trigger?: string
          share_trigger?: string
          source_id?: string
          story_beats?: Json
          structure_category?: string
          structure_type?: string
          trigger_category?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viral_intelligence_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: true
            referencedRelation: "viral_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      viral_sources: {
        Row: {
          category: string | null
          created_at: string
          creator_name: string | null
          deleted_at: string | null
          expires_at: string | null
          id: string
          notes: string
          platform: string
          source_url: string | null
          status: Database["public"]["Enums"]["viral_source_status"]
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
          video_path: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          creator_name?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          notes?: string
          platform?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["viral_source_status"]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id: string
          video_path?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          creator_name?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          notes?: string
          platform?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["viral_source_status"]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          video_path?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      atm_mode: "conservative" | "creative"
      atm_version_status: "draft" | "pending_approval" | "approved" | "rejected"
      content_approval_status:
        | "draft"
        | "revision_needed"
        | "approved"
        | "ready_publish"
        | "published"
      generated_content_type: "carousel" | "photo_to_video" | "video_content"
      performance_period: "24h" | "7d" | "30d"
      quality_gate_status: "ready_production" | "revision_needed"
      source_extraction_status:
        | "processing"
        | "completed"
        | "partial"
        | "failed"
        | "needs_review"
      viral_analysis_status:
        | "not_started"
        | "queued"
        | "in_progress"
        | "completed"
        | "failed"
      viral_source_status:
        | "draft"
        | "processing"
        | "understanding"
        | "source_extracted"
        | "analysis_complete"
        | "production"
        | "approved"
        | "published"
        | "failed"
        | "ready_for_prompt_generation"
      viral_workflow_status:
        | "draft"
        | "analyzing"
        | "analyzed"
        | "revision_needed"
        | "approved"
        | "ready_production"
        | "published"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      atm_mode: ["conservative", "creative"],
      atm_version_status: ["draft", "pending_approval", "approved", "rejected"],
      content_approval_status: [
        "draft",
        "revision_needed",
        "approved",
        "ready_publish",
        "published",
      ],
      generated_content_type: ["carousel", "photo_to_video", "video_content"],
      performance_period: ["24h", "7d", "30d"],
      quality_gate_status: ["ready_production", "revision_needed"],
      source_extraction_status: [
        "processing",
        "completed",
        "partial",
        "failed",
        "needs_review",
      ],
      viral_analysis_status: [
        "not_started",
        "queued",
        "in_progress",
        "completed",
        "failed",
      ],
      viral_source_status: [
        "draft",
        "processing",
        "understanding",
        "source_extracted",
        "analysis_complete",
        "production",
        "approved",
        "published",
        "failed",
        "ready_for_prompt_generation",
      ],
      viral_workflow_status: [
        "draft",
        "analyzing",
        "analyzed",
        "revision_needed",
        "approved",
        "ready_production",
        "published",
      ],
    },
  },
} as const
