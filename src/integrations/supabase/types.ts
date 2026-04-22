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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agent_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          created_at: string
          id: string
          meetings: number
          name: string
          opened: number
          prospects: number
          replied: number
          sent: number
          sequence: Json
          start_date: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meetings?: number
          name: string
          opened?: number
          prospects?: number
          replied?: number
          sent?: number
          sequence?: Json
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          meetings?: number
          name?: string
          opened?: number
          prospects?: number
          replied?: number
          sent?: number
          sequence?: Json
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          email: string | null
          employees: string | null
          enriched: boolean | null
          id: string
          ipc_score: number | null
          lat: number | null
          lng: number | null
          location: string | null
          name: string
          phone: string | null
          raw_data: Json | null
          revenue: number | null
          sector: string | null
          source: string
          starred: boolean | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          employees?: string | null
          enriched?: boolean | null
          id?: string
          ipc_score?: number | null
          lat?: number | null
          lng?: number | null
          location?: string | null
          name: string
          phone?: string | null
          raw_data?: Json | null
          revenue?: number | null
          sector?: string | null
          source?: string
          starred?: boolean | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          employees?: string | null
          enriched?: boolean | null
          id?: string
          ipc_score?: number | null
          lat?: number | null
          lng?: number | null
          location?: string | null
          name?: string
          phone?: string | null
          raw_data?: Json | null
          revenue?: number | null
          sector?: string | null
          source?: string
          starred?: boolean | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      intent_signals: {
        Row: {
          company_id: string | null
          company_name: string
          created_at: string
          details: string | null
          id: string
          metadata: Json | null
          signal: string
          strength: string
          type: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          company_name: string
          created_at?: string
          details?: string | null
          id?: string
          metadata?: Json | null
          signal: string
          strength?: string
          type?: string
          user_id?: string
        }
        Update: {
          company_id?: string | null
          company_name?: string
          created_at?: string
          details?: string | null
          id?: string
          metadata?: Json | null
          signal?: string
          strength?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intent_signals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ipc_config: {
        Row: {
          created_at: string
          criteria: Json
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          criteria?: Json
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          criteria?: Json
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean
          title: string
          type?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          organization_id: string
          revoked: boolean
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          organization_id: string
          revoked?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          organization_id?: string
          revoked?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          notification_prefs: Json
          onboarding_completed: boolean
          skin: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          notification_prefs?: Json
          onboarding_completed?: boolean
          skin?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          notification_prefs?: Json
          onboarding_completed?: boolean
          skin?: string
          updated_at?: string
        }
        Relationships: []
      }
      scrape_jobs: {
        Row: {
          completed_at: string | null
          config: Json
          created_at: string
          error_message: string | null
          external_id: string | null
          id: string
          name: string
          results_count: number | null
          source: string
          started_at: string | null
          status: Database["public"]["Enums"]["scrape_job_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          config?: Json
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          name: string
          results_count?: number | null
          source?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["scrape_job_status"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          config?: Json
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          name?: string
          results_count?: number | null
          source?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["scrape_job_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scrape_results: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          job_id: string
          processed: boolean | null
          raw_data: Json
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          job_id: string
          processed?: boolean | null
          raw_data?: Json
          user_id?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          job_id?: string
          processed?: boolean | null
          raw_data?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrape_results_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scrape_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scrape_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      stakeholders: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          confidence_score: number | null
          created_at: string
          department: string | null
          email: string | null
          full_name: string
          id: string
          last_contacted_at: string | null
          linkedin_url: string | null
          notes: string | null
          phone: string | null
          raw_data: Json | null
          role: string | null
          seniority: string | null
          source: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          confidence_score?: number | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name: string
          id?: string
          last_contacted_at?: string | null
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
          raw_data?: Json | null
          role?: string | null
          seniority?: string | null
          source?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          confidence_score?: number | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string
          id?: string
          last_contacted_at?: string | null
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
          raw_data?: Json | null
          role?: string | null
          seniority?: string | null
          source?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stakeholders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: string | null
          error_message: string | null
          id: string
          results: Json | null
          started_at: string | null
          status: string
          user_id: string
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          error_message?: string | null
          id?: string
          results?: Json | null
          started_at?: string | null
          status?: string
          user_id?: string
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          error_message?: string | null
          id?: string
          results?: Json | null
          started_at?: string | null
          status?: string
          user_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: string
          last_run_at: string | null
          leads_processed: number | null
          leads_qualified: number | null
          name: string
          status: Database["public"]["Enums"]["workflow_status"]
          steps: Json
          success_rate: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          last_run_at?: string | null
          leads_processed?: number | null
          leads_qualified?: number | null
          name: string
          status?: Database["public"]["Enums"]["workflow_status"]
          steps?: Json
          success_rate?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          last_run_at?: string | null
          leads_processed?: number | null
          leads_qualified?: number | null
          name?: string
          status?: Database["public"]["Enums"]["workflow_status"]
          steps?: Json
          success_rate?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_org_invite: { Args: { _token: string }; Returns: string }
      has_org_role: {
        Args: {
          _min_role: Database["public"]["Enums"]["app_role"]
          _org_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "sdr" | "viewer"
      campaign_status: "draft" | "active" | "paused" | "completed" | "archived"
      scrape_job_status:
        | "pending"
        | "running"
        | "working"
        | "completed"
        | "failed"
        | "cancelled"
      workflow_status:
        | "draft"
        | "active"
        | "paused"
        | "completed"
        | "failed"
        | "running"
        | "archived"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "sdr", "viewer"],
      campaign_status: ["draft", "active", "paused", "completed", "archived"],
      scrape_job_status: [
        "pending",
        "running",
        "working",
        "completed",
        "failed",
        "cancelled",
      ],
      workflow_status: [
        "draft",
        "active",
        "paused",
        "completed",
        "failed",
        "running",
        "archived",
      ],
    },
  },
} as const
