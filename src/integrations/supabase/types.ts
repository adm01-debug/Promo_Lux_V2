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
      agent_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          organization_id?: string
          role: string
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          active: boolean
          created_at: string
          expires_at: string | null
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          organization_id: string
          prefix: string
          scopes: string[]
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          organization_id?: string
          prefix: string
          scopes?: string[]
          user_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          prefix?: string
          scopes?: string[]
          user_id?: string
        }
        Relationships: []
      }
      api_request_logs: {
        Row: {
          api_key_id: string | null
          api_key_prefix: string | null
          created_at: string
          duration_ms: number
          error_message: string | null
          id: string
          ip_address: string | null
          method: string
          organization_id: string | null
          path: string
          resource: string | null
          status_code: number
          trace_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          api_key_id?: string | null
          api_key_prefix?: string | null
          created_at?: string
          duration_ms: number
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method: string
          organization_id?: string | null
          path: string
          resource?: string | null
          status_code: number
          trace_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          api_key_id?: string | null
          api_key_prefix?: string | null
          created_at?: string
          duration_ms?: number
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method?: string
          organization_id?: string | null
          path?: string
          resource?: string | null
          status_code?: number
          trace_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          organization_id: string | null
          record_id: string
          table_name: string
          trace_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          record_id: string
          table_name: string
          trace_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          record_id?: string
          table_name?: string
          trace_id?: string | null
        }
        Relationships: []
      }
      auth_rate_limits: {
        Row: {
          attempts: number | null
          created_at: string | null
          id: string
          identifier: string
          last_attempt: string | null
          locked_until: string | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          id?: string
          identifier: string
          last_attempt?: string | null
          locked_until?: string | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          id?: string
          identifier?: string
          last_attempt?: string | null
          locked_until?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      automation_alerts: {
        Row: {
          created_at: string | null
          delivery_method: string
          event_type: string
          id: string
          is_active: boolean | null
          organization_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          delivery_method: string
          event_type: string
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          delivery_method?: string
          event_type?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_execution_logs: {
        Row: {
          attempt: number | null
          correlation_id: string | null
          created_at: string
          duration_ms: number | null
          error_detail: string | null
          failure_reason: string | null
          http_status: number | null
          id: string
          level: string
          max_attempts: number | null
          message: string | null
          metadata: Json
          organization_id: string
          phase: string
          queue_task_id: string | null
          run_id: string | null
          scrape_job_id: string | null
          source: string
          status: string
          step_index: number | null
          step_name: string | null
          transient: boolean | null
          user_id: string | null
          worker_id: string | null
          workflow_id: string | null
        }
        Insert: {
          attempt?: number | null
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_detail?: string | null
          failure_reason?: string | null
          http_status?: number | null
          id?: string
          level?: string
          max_attempts?: number | null
          message?: string | null
          metadata?: Json
          organization_id: string
          phase?: string
          queue_task_id?: string | null
          run_id?: string | null
          scrape_job_id?: string | null
          source?: string
          status?: string
          step_index?: number | null
          step_name?: string | null
          transient?: boolean | null
          user_id?: string | null
          worker_id?: string | null
          workflow_id?: string | null
        }
        Update: {
          attempt?: number | null
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_detail?: string | null
          failure_reason?: string | null
          http_status?: number | null
          id?: string
          level?: string
          max_attempts?: number | null
          message?: string | null
          metadata?: Json
          organization_id?: string
          phase?: string
          queue_task_id?: string | null
          run_id?: string | null
          scrape_job_id?: string | null
          source?: string
          status?: string
          step_index?: number | null
          step_name?: string | null
          transient?: boolean | null
          user_id?: string | null
          worker_id?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_execution_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_steps: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_stack: string | null
          id: string
          job_id: string | null
          message: string | null
          name: string
          organization_id: string
          payload: Json | null
          run_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["automation_status"] | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_stack?: string | null
          id?: string
          job_id?: string | null
          message?: string | null
          name: string
          organization_id: string
          payload?: Json | null
          run_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["automation_status"] | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_stack?: string | null
          id?: string
          job_id?: string | null
          message?: string | null
          name?: string
          organization_id?: string
          payload?: Json | null
          run_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["automation_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_steps_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scrape_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_events: {
        Row: {
          campaign_id: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          occurred_at: string
          organization_id: string
          recipient_id: string
          url: string | null
          user_agent: string | null
        }
        Insert: {
          campaign_id: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          occurred_at?: string
          organization_id: string
          recipient_id: string
          url?: string | null
          user_agent?: string | null
        }
        Update: {
          campaign_id?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          occurred_at?: string
          organization_id?: string
          recipient_id?: string
          url?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "campaign_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_messages: {
        Row: {
          campaign_id: string
          created_at: string
          email_account_id: string | null
          id: string
          organization_id: string
          provider: string | null
          provider_message_id: string | null
          recipient_id: string
          rfc822_message_id: string | null
          sent_at: string
          step_index: number
          subject: string | null
          thread_id: string | null
          user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          email_account_id?: string | null
          id?: string
          organization_id?: string
          provider?: string | null
          provider_message_id?: string | null
          recipient_id: string
          rfc822_message_id?: string | null
          sent_at?: string
          step_index?: number
          subject?: string | null
          thread_id?: string | null
          user_id?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          email_account_id?: string | null
          id?: string
          organization_id?: string
          provider?: string | null
          provider_message_id?: string | null
          recipient_id?: string
          rfc822_message_id?: string | null
          sent_at?: string
          step_index?: number
          subject?: string | null
          thread_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_messages_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "campaign_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          bounced_at: string | null
          campaign_id: string
          click_count: number
          company_id: string | null
          created_at: string
          current_step: number
          email: string
          first_clicked_at: string | null
          first_opened_at: string | null
          full_name: string | null
          id: string
          last_clicked_at: string | null
          last_opened_at: string | null
          last_step_error: string | null
          next_action_at: string
          open_count: number
          organization_id: string
          replied_at: string | null
          sent_at: string | null
          sequence_completed_at: string | null
          stakeholder_id: string | null
          status: string
          unsubscribed_at: string | null
          updated_at: string
          user_id: string
          variant: string | null
        }
        Insert: {
          bounced_at?: string | null
          campaign_id: string
          click_count?: number
          company_id?: string | null
          created_at?: string
          current_step?: number
          email: string
          first_clicked_at?: string | null
          first_opened_at?: string | null
          full_name?: string | null
          id?: string
          last_clicked_at?: string | null
          last_opened_at?: string | null
          last_step_error?: string | null
          next_action_at?: string
          open_count?: number
          organization_id?: string
          replied_at?: string | null
          sent_at?: string | null
          sequence_completed_at?: string | null
          stakeholder_id?: string | null
          status?: string
          unsubscribed_at?: string | null
          updated_at?: string
          user_id?: string
          variant?: string | null
        }
        Update: {
          bounced_at?: string | null
          campaign_id?: string
          click_count?: number
          company_id?: string | null
          created_at?: string
          current_step?: number
          email?: string
          first_clicked_at?: string | null
          first_opened_at?: string | null
          full_name?: string | null
          id?: string
          last_clicked_at?: string | null
          last_opened_at?: string | null
          last_step_error?: string | null
          next_action_at?: string
          open_count?: number
          organization_id?: string
          replied_at?: string | null
          sent_at?: string | null
          sequence_completed_at?: string | null
          stakeholder_id?: string | null
          status?: string
          unsubscribed_at?: string | null
          updated_at?: string
          user_id?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_replies: {
        Row: {
          body_text: string | null
          campaign_id: string
          created_at: string
          email_account_id: string | null
          from_email: string | null
          from_name: string | null
          id: string
          in_reply_to: string | null
          message_id: string | null
          organization_id: string
          provider: string
          provider_message_id: string
          received_at: string
          recipient_id: string
          snippet: string | null
          subject: string | null
          thread_id: string | null
        }
        Insert: {
          body_text?: string | null
          campaign_id: string
          created_at?: string
          email_account_id?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          in_reply_to?: string | null
          message_id?: string | null
          organization_id: string
          provider: string
          provider_message_id: string
          received_at: string
          recipient_id: string
          snippet?: string | null
          subject?: string | null
          thread_id?: string | null
        }
        Update: {
          body_text?: string | null
          campaign_id?: string
          created_at?: string
          email_account_id?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          in_reply_to?: string | null
          message_id?: string | null
          organization_id?: string
          provider?: string
          provider_message_id?: string
          received_at?: string
          recipient_id?: string
          snippet?: string | null
          subject?: string | null
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_replies_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_replies_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_replies_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "campaign_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_replies_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "campaign_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          ab_min_sample: number
          ab_test_enabled: boolean
          ab_winner_decided_at: string | null
          ab_winner_metric: string
          ab_winner_variant: string | null
          bounced: number
          created_at: string
          deleted_at: string | null
          failed: number
          id: string
          meetings: number
          name: string
          opened: number
          organization_id: string
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
          ab_min_sample?: number
          ab_test_enabled?: boolean
          ab_winner_decided_at?: string | null
          ab_winner_metric?: string
          ab_winner_variant?: string | null
          bounced?: number
          created_at?: string
          deleted_at?: string | null
          failed?: number
          id?: string
          meetings?: number
          name: string
          opened?: number
          organization_id?: string
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
          ab_min_sample?: number
          ab_test_enabled?: boolean
          ab_winner_decided_at?: string | null
          ab_winner_metric?: string
          ab_winner_variant?: string | null
          bounced?: number
          created_at?: string
          deleted_at?: string | null
          failed?: number
          id?: string
          meetings?: number
          name?: string
          opened?: number
          organization_id?: string
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
      circuit_breakers: {
        Row: {
          failure_count: number | null
          last_failure_at: string | null
          opened_at: string | null
          reset_timeout_ms: number | null
          service_name: string
          state: string
          threshold: number | null
        }
        Insert: {
          failure_count?: number | null
          last_failure_at?: string | null
          opened_at?: string | null
          reset_timeout_ms?: number | null
          service_name: string
          state?: string
          threshold?: number | null
        }
        Update: {
          failure_count?: number | null
          last_failure_at?: string | null
          opened_at?: string | null
          reset_timeout_ms?: number | null
          service_name?: string
          state?: string
          threshold?: number | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          cnpj: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          email: string | null
          employees: string | null
          enriched: boolean | null
          id: string
          instagram_url: string | null
          ipc_score: number | null
          lat: number | null
          linkedin_url: string | null
          lng: number | null
          location: string | null
          logo_url: string | null
          name: string
          organization_id: string
          phone: string | null
          raw_data: Json | null
          revenue: number | null
          sector: string | null
          source: string
          starred: boolean | null
          updated_at: string
          user_id: string
          version: number
          website: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          email?: string | null
          employees?: string | null
          enriched?: boolean | null
          id?: string
          instagram_url?: string | null
          ipc_score?: number | null
          lat?: number | null
          linkedin_url?: string | null
          lng?: number | null
          location?: string | null
          logo_url?: string | null
          name: string
          organization_id?: string
          phone?: string | null
          raw_data?: Json | null
          revenue?: number | null
          sector?: string | null
          source?: string
          starred?: boolean | null
          updated_at?: string
          user_id?: string
          version?: number
          website?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          email?: string | null
          employees?: string | null
          enriched?: boolean | null
          id?: string
          instagram_url?: string | null
          ipc_score?: number | null
          lat?: number | null
          linkedin_url?: string | null
          lng?: number | null
          location?: string | null
          logo_url?: string | null
          name?: string
          organization_id?: string
          phone?: string | null
          raw_data?: Json | null
          revenue?: number | null
          sector?: string | null
          source?: string
          starred?: boolean | null
          updated_at?: string
          user_id?: string
          version?: number
          website?: string | null
        }
        Relationships: []
      }
      db_health_snapshots: {
        Row: {
          active_connections: number
          cache_hit_ratio: number
          captured_at: string
          commits: number
          connection_pct: number
          db_size_bytes: number
          deadlocks: number
          id: string
          longest_query_secs: number
          max_connections: number
          postmaster_start: string
          restart_detected: boolean
          rollbacks: number
        }
        Insert: {
          active_connections: number
          cache_hit_ratio?: number
          captured_at?: string
          commits?: number
          connection_pct: number
          db_size_bytes: number
          deadlocks?: number
          id?: string
          longest_query_secs?: number
          max_connections: number
          postmaster_start: string
          restart_detected?: boolean
          rollbacks?: number
        }
        Update: {
          active_connections?: number
          cache_hit_ratio?: number
          captured_at?: string
          commits?: number
          connection_pct?: number
          db_size_bytes?: number
          deadlocks?: number
          id?: string
          longest_query_secs?: number
          max_connections?: number
          postmaster_start?: string
          restart_detected?: boolean
          rollbacks?: number
        }
        Relationships: []
      }
      deal_activities: {
        Row: {
          content: string | null
          created_at: string
          deal_id: string
          id: string
          metadata: Json | null
          organization_id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          deal_id: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          title: string
          type?: string
          user_id?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          deal_id?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string
          position: number
          probability: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id?: string
          position?: number
          probability?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          position?: number
          probability?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deal_tasks: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          due_at: string | null
          id: string
          organization_id: string
          priority: string
          remind_at: string | null
          reminded: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          organization_id?: string
          priority?: string
          remind_at?: string | null
          reminded?: boolean
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          organization_id?: string
          priority?: string
          remind_at?: string | null
          reminded?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          closed_at: string | null
          company_id: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          description: string | null
          expected_close_date: string | null
          id: string
          organization_id: string
          position: number
          priority: string
          stage_id: string
          stakeholder_id: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
          value: number | null
          version: number
        }
        Insert: {
          closed_at?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          expected_close_date?: string | null
          id?: string
          organization_id?: string
          position?: number
          priority?: string
          stage_id: string
          stakeholder_id?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id?: string
          value?: number | null
          version?: number
        }
        Update: {
          closed_at?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          expected_close_date?: string | null
          id?: string
          organization_id?: string
          position?: number
          priority?: string
          stage_id?: string
          stakeholder_id?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
          value?: number | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "deal_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          access_token: string | null
          active: boolean
          created_at: string
          delta_link: string | null
          display_name: string | null
          email: string
          expires_at: string | null
          history_id: string | null
          id: string
          last_error: string | null
          last_polled_at: string | null
          organization_id: string
          provider: string
          reconnect_attempts: number
          reconnect_base_delay_seconds: number
          reconnect_last_error: string | null
          reconnect_max_attempts: number
          reconnect_next_at: string | null
          reconnect_required: boolean
          refresh_token: string | null
          scope: string | null
          scope_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          active?: boolean
          created_at?: string
          delta_link?: string | null
          display_name?: string | null
          email: string
          expires_at?: string | null
          history_id?: string | null
          id?: string
          last_error?: string | null
          last_polled_at?: string | null
          organization_id?: string
          provider: string
          reconnect_attempts?: number
          reconnect_base_delay_seconds?: number
          reconnect_last_error?: string | null
          reconnect_max_attempts?: number
          reconnect_next_at?: string | null
          reconnect_required?: boolean
          refresh_token?: string | null
          scope?: string | null
          scope_type?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          access_token?: string | null
          active?: boolean
          created_at?: string
          delta_link?: string | null
          display_name?: string | null
          email?: string
          expires_at?: string | null
          history_id?: string | null
          id?: string
          last_error?: string | null
          last_polled_at?: string | null
          organization_id?: string
          provider?: string
          reconnect_attempts?: number
          reconnect_base_delay_seconds?: number
          reconnect_last_error?: string | null
          reconnect_max_attempts?: number
          reconnect_next_at?: string | null
          reconnect_required?: boolean
          refresh_token?: string | null
          scope?: string | null
          scope_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_suppressions: {
        Row: {
          created_at: string
          email: string
          id: string
          notes: string | null
          organization_id: string
          reason: string
          source_campaign_id: string | null
          source_recipient_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notes?: string | null
          organization_id: string
          reason: string
          source_campaign_id?: string | null
          source_recipient_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notes?: string | null
          organization_id?: string
          reason?: string
          source_campaign_id?: string | null
          source_recipient_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_suppressions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_suppressions_source_campaign_id_fkey"
            columns: ["source_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sync_log: {
        Row: {
          attempt: number | null
          created_at: string
          duration_ms: number | null
          email_account_id: string
          error_message: string | null
          fatal: boolean | null
          id: string
          inserted: number | null
          max_attempts: number | null
          next_retry_at: string | null
          organization_id: string
          provider: string
          reconnect_required: boolean
          scanned: number | null
          scope_type: string
          skipped_reason: string | null
          status: string
        }
        Insert: {
          attempt?: number | null
          created_at?: string
          duration_ms?: number | null
          email_account_id: string
          error_message?: string | null
          fatal?: boolean | null
          id?: string
          inserted?: number | null
          max_attempts?: number | null
          next_retry_at?: string | null
          organization_id: string
          provider: string
          reconnect_required?: boolean
          scanned?: number | null
          scope_type: string
          skipped_reason?: string | null
          status: string
        }
        Update: {
          attempt?: number | null
          created_at?: string
          duration_ms?: number | null
          email_account_id?: string
          error_message?: string | null
          fatal?: boolean | null
          id?: string
          inserted?: number | null
          max_attempts?: number | null
          next_retry_at?: string | null
          organization_id?: string
          provider?: string
          reconnect_required?: boolean
          scanned?: number | null
          scope_type?: string
          skipped_reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sync_log_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          config: Json | null
          created_at: string
          flag_key: string | null
          id: string
          is_enabled: boolean | null
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          flag_key?: string | null
          id?: string
          is_enabled?: boolean | null
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          flag_key?: string | null
          id?: string
          is_enabled?: boolean | null
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      health_checks: {
        Row: {
          id: string
          last_check: string
          latency_ms: number | null
          metadata: Json | null
          service_name: string
          status: string
        }
        Insert: {
          id?: string
          last_check?: string
          latency_ms?: number | null
          metadata?: Json | null
          service_name: string
          status: string
        }
        Update: {
          id?: string
          last_check?: string
          latency_ms?: number | null
          metadata?: Json | null
          service_name?: string
          status?: string
        }
        Relationships: []
      }
      idempotency_keys: {
        Row: {
          created_at: string
          id: string
          key: string
          response_body: Json
          status_code: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          response_body: Json
          status_code: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          response_body?: Json
          status_code?: number
          user_id?: string
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          criteria?: Json
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          criteria?: Json
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_exports: {
        Row: {
          created_at: string | null
          file_url: string | null
          format: string
          id: string
          job_id: string
          organization_id: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_url?: string | null
          format: string
          id?: string
          job_id: string
          organization_id?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_url?: string | null
          format?: string
          id?: string
          job_id?: string
          organization_id?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_exports_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scrape_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_exports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json | null
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      oauth_sandbox_snapshots: {
        Row: {
          auth_url_preview: string | null
          client_id_configured: boolean
          client_secret_configured: boolean
          created_at: string
          id: string
          label: string
          notes: string | null
          organization_id: string
          provider: string
          redirect_uri: string
          redirect_uri_normalized: string
          scope_type: string
          scopes: string[]
          user_id: string
          warnings: string[]
        }
        Insert: {
          auth_url_preview?: string | null
          client_id_configured: boolean
          client_secret_configured: boolean
          created_at?: string
          id?: string
          label: string
          notes?: string | null
          organization_id?: string
          provider: string
          redirect_uri: string
          redirect_uri_normalized: string
          scope_type: string
          scopes?: string[]
          user_id?: string
          warnings?: string[]
        }
        Update: {
          auth_url_preview?: string | null
          client_id_configured?: boolean
          client_secret_configured?: boolean
          created_at?: string
          id?: string
          label?: string
          notes?: string | null
          organization_id?: string
          provider?: string
          redirect_uri?: string
          redirect_uri_normalized?: string
          scope_type?: string
          scopes?: string[]
          user_id?: string
          warnings?: string[]
        }
        Relationships: []
      }
      org_violation_alert_settings: {
        Row: {
          cooldown_minutes: number
          enabled: boolean
          organization_id: string
          threshold: number
          updated_at: string
          updated_by: string | null
          window_minutes: number
        }
        Insert: {
          cooldown_minutes?: number
          enabled?: boolean
          organization_id: string
          threshold?: number
          updated_at?: string
          updated_by?: string | null
          window_minutes?: number
        }
        Update: {
          cooldown_minutes?: number
          enabled?: boolean
          organization_id?: string
          threshold?: number
          updated_at?: string
          updated_by?: string | null
          window_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_violation_alert_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_violation_alerts: {
        Row: {
          distinct_actors: number
          distinct_correlations: number
          id: string
          notes: string | null
          organization_id: string
          threshold: number
          top_tables: Json
          triggered_at: string
          violation_count: number
          webhook_dispatch: Json
          window_minutes: number
        }
        Insert: {
          distinct_actors?: number
          distinct_correlations?: number
          id?: string
          notes?: string | null
          organization_id: string
          threshold: number
          top_tables?: Json
          triggered_at?: string
          violation_count: number
          webhook_dispatch?: Json
          window_minutes: number
        }
        Update: {
          distinct_actors?: number
          distinct_correlations?: number
          id?: string
          notes?: string | null
          organization_id?: string
          threshold?: number
          top_tables?: Json
          triggered_at?: string
          violation_count?: number
          webhook_dispatch?: Json
          window_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_violation_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      partition_advisories: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          breached_bytes: boolean
          breached_rows: boolean
          created_at: string
          id: string
          live_rows: number
          policy_id: string | null
          recommendation: string
          table_name: string
          threshold_bytes: number
          threshold_rows: number
          total_bytes: number
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          breached_bytes?: boolean
          breached_rows?: boolean
          created_at?: string
          id?: string
          live_rows: number
          policy_id?: string | null
          recommendation: string
          table_name: string
          threshold_bytes: number
          threshold_rows: number
          total_bytes: number
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          breached_bytes?: boolean
          breached_rows?: boolean
          created_at?: string
          id?: string
          live_rows?: number
          policy_id?: string | null
          recommendation?: string
          table_name?: string
          threshold_bytes?: number
          threshold_rows?: number
          total_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "partition_advisories_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "partition_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      partition_policies: {
        Row: {
          cooldown_hours: number
          created_at: string
          enabled: boolean
          id: string
          notes: string | null
          partition_by: string
          table_name: string
          threshold_bytes: number
          threshold_rows: number
          updated_at: string
        }
        Insert: {
          cooldown_hours?: number
          created_at?: string
          enabled?: boolean
          id?: string
          notes?: string | null
          partition_by?: string
          table_name: string
          threshold_bytes?: number
          threshold_rows?: number
          updated_at?: string
        }
        Update: {
          cooldown_hours?: number
          created_at?: string
          enabled?: boolean
          id?: string
          notes?: string | null
          partition_by?: string
          table_name?: string
          threshold_bytes?: number
          threshold_rows?: number
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
      scrape_dead_letter: {
        Row: {
          attempts: number
          created_at: string
          failed_at: string
          id: string
          last_error: string | null
          organization_id: string
          payload: Json
          queue_id: string | null
          replayed_at: string | null
          scrape_job_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          failed_at?: string
          id?: string
          last_error?: string | null
          organization_id: string
          payload?: Json
          queue_id?: string | null
          replayed_at?: string | null
          scrape_job_id?: string | null
          source?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          failed_at?: string
          id?: string
          last_error?: string | null
          organization_id?: string
          payload?: Json
          queue_id?: string | null
          replayed_at?: string | null
          scrape_job_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      scrape_jobs: {
        Row: {
          auto_sync: boolean | null
          completed_at: string | null
          config: Json
          created_at: string
          error_message: string | null
          external_id: string | null
          id: string
          name: string
          organization_id: string
          results_count: number | null
          source: string
          started_at: string | null
          status: Database["public"]["Enums"]["scrape_job_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_sync?: boolean | null
          completed_at?: string | null
          config?: Json
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          name: string
          organization_id?: string
          results_count?: number | null
          source?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["scrape_job_status"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          auto_sync?: boolean | null
          completed_at?: string | null
          config?: Json
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          name?: string
          organization_id?: string
          results_count?: number | null
          source?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["scrape_job_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scrape_queue: {
        Row: {
          attempts: number
          base_delay_secs: number
          created_at: string
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          max_delay_secs: number
          next_run_at: string
          organization_id: string
          payload: Json
          priority: number
          scrape_job_id: string | null
          source: string
          status: Database["public"]["Enums"]["scrape_queue_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          base_delay_secs?: number
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          max_delay_secs?: number
          next_run_at?: string
          organization_id: string
          payload?: Json
          priority?: number
          scrape_job_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["scrape_queue_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          base_delay_secs?: number
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          max_delay_secs?: number
          next_run_at?: string
          organization_id?: string
          payload?: Json
          priority?: number
          scrape_job_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["scrape_queue_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrape_queue_scrape_job_id_fkey"
            columns: ["scrape_job_id"]
            isOneToOne: false
            referencedRelation: "scrape_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      scrape_results: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          job_id: string
          organization_id: string
          processed: boolean | null
          raw_data: Json
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          job_id: string
          organization_id?: string
          processed?: boolean | null
          raw_data?: Json
          user_id?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          job_id?: string
          organization_id?: string
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          error_message: string | null
          event: string
          id: string
          next_retry_at: string | null
          organization_id: string
          payload: Json
          response_body: string | null
          status: string
          status_code: number | null
          user_id: string
          webhook_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event: string
          id?: string
          next_retry_at?: string | null
          organization_id?: string
          payload: Json
          response_body?: string | null
          status?: string
          status_code?: number | null
          user_id: string
          webhook_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event?: string
          id?: string
          next_retry_at?: string | null
          organization_id?: string
          payload?: Json
          response_body?: string | null
          status?: string
          status_code?: number | null
          user_id?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          active: boolean
          created_at: string
          events: string[]
          id: string
          last_triggered_at: string | null
          name: string
          organization_id: string
          secret: string
          total_failed: number
          total_sent: number
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          last_triggered_at?: string | null
          name: string
          organization_id?: string
          secret?: string
          total_failed?: number
          total_sent?: number
          updated_at?: string
          url: string
          user_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          last_triggered_at?: string | null
          name?: string
          organization_id?: string
          secret?: string
          total_failed?: number
          total_sent?: number
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      workflow_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: string | null
          error_message: string | null
          id: string
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
          deleted_at: string | null
          description: string | null
          id: string
          last_run_at: string | null
          leads_processed: number | null
          leads_qualified: number | null
          name: string
          organization_id: string
          status: Database["public"]["Enums"]["workflow_status"]
          steps: Json
          success_rate: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          last_run_at?: string | null
          leads_processed?: number | null
          leads_qualified?: number | null
          name: string
          organization_id?: string
          status?: Database["public"]["Enums"]["workflow_status"]
          steps?: Json
          success_rate?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          config?: Json
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          last_run_at?: string | null
          leads_processed?: number | null
          leads_qualified?: number | null
          name?: string
          organization_id?: string
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
      advance_recipient_step: {
        Args: {
          _completed: boolean
          _error?: string
          _next_action_at: string
          _next_step: number
          _recipient_id: string
        }
        Returns: undefined
      }
      campaign_ab_stats: {
        Args: { _campaign_id: string }
        Returns: {
          bounced: number
          click_rate: number
          clicked: number
          open_rate: number
          opened: number
          recipients: number
          replied: number
          reply_rate: number
          sent: number
          variant: string
        }[]
      }
      capture_db_health_snapshot: {
        Args: never
        Returns: {
          active_connections: number
          cache_hit_ratio: number
          captured_at: string
          commits: number
          connection_pct: number
          db_size_bytes: number
          deadlocks: number
          id: string
          longest_query_secs: number
          max_connections: number
          postmaster_start: string
          restart_detected: boolean
          rollbacks: number
        }
        SetofOptions: {
          from: "*"
          to: "db_health_snapshots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_scrape_tasks: {
        Args: { _limit?: number; _worker?: string }
        Returns: {
          attempts: number
          base_delay_secs: number
          created_at: string
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          max_delay_secs: number
          next_run_at: string
          organization_id: string
          payload: Json
          priority: number
          scrape_job_id: string | null
          source: string
          status: Database["public"]["Enums"]["scrape_queue_status"]
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "scrape_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_scrape_task: { Args: { _id: string }; Returns: undefined }
      count_recent_org_violations: {
        Args: { _window_minutes?: number }
        Returns: {
          distinct_actors: number
          distinct_correlations: number
          organization_id: string
          top_tables: Json
          violation_count: number
        }[]
      }
      create_default_deal_stages: {
        Args: { _user_id: string }
        Returns: undefined
      }
      decide_ab_winner: { Args: { _campaign_id: string }; Returns: string }
      default_org_for_current_user: { Args: never; Returns: string }
      enqueue_scrape_task: {
        Args: {
          _max_attempts?: number
          _payload?: Json
          _priority?: number
          _scrape_job_id: string
          _source?: string
        }
        Returns: string
      }
      evaluate_org_violation_alerts: {
        Args: never
        Returns: {
          cooldown_minutes: number
          distinct_actors: number
          distinct_correlations: number
          last_alert_at: string
          organization_id: string
          threshold: number
          top_tables: Json
          violation_count: number
          window_minutes: number
        }[]
      }
      evaluate_partition_policies: {
        Args: never
        Returns: {
          advisory_created: boolean
          breached: boolean
          live_rows: number
          table_name: string
          total_bytes: number
        }[]
      }
      fail_scrape_task: {
        Args: { _error: string; _id: string; _transient?: boolean }
        Returns: Database["public"]["Enums"]["scrape_queue_status"]
      }
      get_dashboard_stats: { Args: { p_org_id: string }; Returns: Json }
      get_sector_summary: {
        Args: { p_user_id: string }
        Returns: {
          count: number
          sector: string
        }[]
      }
      has_org_role: {
        Args: {
          _min_role: Database["public"]["Enums"]["app_role"]
          _org_id: string
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      log_automation_event: {
        Args: {
          _attempt?: number
          _correlation_id?: string
          _duration_ms?: number
          _error_detail?: string
          _failure_reason?: string
          _http_status?: number
          _level?: string
          _max_attempts?: number
          _message?: string
          _metadata?: Json
          _organization_id: string
          _phase: string
          _queue_task_id?: string
          _run_id?: string
          _scrape_job_id?: string
          _source?: string
          _status: string
          _step_index?: number
          _step_name?: string
          _transient?: boolean
          _worker_id?: string
          _workflow_id?: string
        }
        Returns: string
      }
      pg_catalog_rls_tables: {
        Args: never
        Returns: {
          table_name: string
        }[]
      }
      pg_columns_for_insert: {
        Args: { _table_name: string }
        Returns: {
          column_default: string
          column_name: string
          data_type: string
          has_default: boolean
          is_nullable: boolean
          udt_name: string
        }[]
      }
      prune_auth_rate_limits: { Args: never; Returns: undefined }
      purge_soft_deleted: { Args: never; Returns: undefined }
      record_campaign_event: {
        Args: {
          _event_type: string
          _ip: string
          _recipient_id: string
          _ua: string
          _url: string
        }
        Returns: string
      }
      record_campaign_reply: {
        Args: {
          _body: string
          _email_account_id: string
          _from_email: string
          _from_name: string
          _in_reply_to: string
          _provider: string
          _provider_message_id: string
          _received_at: string
          _snippet: string
          _subject: string
          _thread_id: string
        }
        Returns: string
      }
      replay_dead_letter: { Args: { _dlq_id: string }; Returns: string }
      touch_api_key: { Args: { _key_id: string }; Returns: undefined }
      verify_api_key: {
        Args: { _key_hash: string }
        Returns: {
          key_id: string
          scopes: string[]
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "sdr" | "viewer"
      audit_action: "create" | "update" | "delete"
      automation_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
      campaign_status: "draft" | "active" | "paused" | "completed" | "archived"
      scrape_job_status:
        | "pending"
        | "running"
        | "working"
        | "completed"
        | "failed"
        | "cancelled"
      scrape_queue_status: "queued" | "processing" | "succeeded" | "dead"
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
      audit_action: ["create", "update", "delete"],
      automation_status: [
        "pending",
        "running",
        "completed",
        "failed",
        "cancelled",
      ],
      campaign_status: ["draft", "active", "paused", "completed", "archived"],
      scrape_job_status: [
        "pending",
        "running",
        "working",
        "completed",
        "failed",
        "cancelled",
      ],
      scrape_queue_status: ["queued", "processing", "succeeded", "dead"],
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
