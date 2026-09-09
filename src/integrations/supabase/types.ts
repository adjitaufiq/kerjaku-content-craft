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
      generated_content_type: "carousel" | "photo_to_video" | "video_content"
      viral_analysis_status:
        | "not_started"
        | "queued"
        | "in_progress"
        | "completed"
        | "failed"
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
      generated_content_type: ["carousel", "photo_to_video", "video_content"],
      viral_analysis_status: [
        "not_started",
        "queued",
        "in_progress",
        "completed",
        "failed",
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
