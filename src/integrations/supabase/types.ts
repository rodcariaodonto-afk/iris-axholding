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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_invites: {
        Row: {
          accepted_at: string | null
          account_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          metadata: Json
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_account_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          account_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          metadata?: Json
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_account_role"]
          token: string
        }
        Update: {
          accepted_at?: string | null
          account_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          metadata?: Json
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_account_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_invites_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_members: {
        Row: {
          account_id: string
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          joined_at: string
          last_active_at: string | null
          permissions: Json
          role: Database["public"]["Enums"]["app_account_role"]
          status: Database["public"]["Enums"]["account_member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string
          last_active_at?: string | null
          permissions?: Json
          role?: Database["public"]["Enums"]["app_account_role"]
          status?: Database["public"]["Enums"]["account_member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string
          last_active_at?: string | null
          permissions?: Json
          role?: Database["public"]["Enums"]["app_account_role"]
          status?: Database["public"]["Enums"]["account_member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_members_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_plans: {
        Row: {
          ai_responses_month: number
          code: string
          created_at: string
          description: string | null
          features: Json
          is_public: boolean
          max_contacts: number
          max_messages_month: number
          max_users: number
          max_whatsapp_numbers: number
          name: string
          position: number
          price_monthly: number
        }
        Insert: {
          ai_responses_month?: number
          code: string
          created_at?: string
          description?: string | null
          features?: Json
          is_public?: boolean
          max_contacts?: number
          max_messages_month?: number
          max_users?: number
          max_whatsapp_numbers?: number
          name: string
          position?: number
          price_monthly?: number
        }
        Update: {
          ai_responses_month?: number
          code?: string
          created_at?: string
          description?: string | null
          features?: Json
          is_public?: boolean
          max_contacts?: number
          max_messages_month?: number
          max_users?: number
          max_whatsapp_numbers?: number
          name?: string
          position?: number
          price_monthly?: number
        }
        Relationships: []
      }
      account_policies: {
        Row: {
          account_id: string
          audit_retention_days: number
          default_legal_basis: Database["public"]["Enums"]["legal_basis"] | null
          dpo_email: string | null
          privacy_policy_url: string | null
          require_dsar_approval: boolean
          retention_days_after_cancel: number
          terms_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          audit_retention_days?: number
          default_legal_basis?:
            | Database["public"]["Enums"]["legal_basis"]
            | null
          dpo_email?: string | null
          privacy_policy_url?: string | null
          require_dsar_approval?: boolean
          retention_days_after_cancel?: number
          terms_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          audit_retention_days?: number
          default_legal_basis?:
            | Database["public"]["Enums"]["legal_basis"]
            | null
          dpo_email?: string | null
          privacy_policy_url?: string | null
          require_dsar_approval?: boolean
          retention_days_after_cancel?: number
          terms_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      accounts: {
        Row: {
          cancelled_at: string | null
          created_at: string
          delete_after: string | null
          deleted_at: string | null
          deletion_reason: string | null
          deletion_scheduled_at: string | null
          deletion_status: Database["public"]["Enums"]["account_deletion_status"]
          domain: string | null
          id: string
          is_internal: boolean
          limits: Json
          logo_url: string | null
          name: string
          plan: Database["public"]["Enums"]["account_plan"]
          retention_until: string | null
          settings: Json
          slug: string
          status: Database["public"]["Enums"]["account_status"]
          subscription_data: Json
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          delete_after?: string | null
          deleted_at?: string | null
          deletion_reason?: string | null
          deletion_scheduled_at?: string | null
          deletion_status?: Database["public"]["Enums"]["account_deletion_status"]
          domain?: string | null
          id?: string
          is_internal?: boolean
          limits?: Json
          logo_url?: string | null
          name: string
          plan?: Database["public"]["Enums"]["account_plan"]
          retention_until?: string | null
          settings?: Json
          slug: string
          status?: Database["public"]["Enums"]["account_status"]
          subscription_data?: Json
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          delete_after?: string | null
          deleted_at?: string | null
          deletion_reason?: string | null
          deletion_scheduled_at?: string | null
          deletion_status?: Database["public"]["Enums"]["account_deletion_status"]
          domain?: string | null
          id?: string
          is_internal?: boolean
          limits?: Json
          logo_url?: string | null
          name?: string
          plan?: Database["public"]["Enums"]["account_plan"]
          retention_until?: string | null
          settings?: Json
          slug?: string
          status?: Database["public"]["Enums"]["account_status"]
          subscription_data?: Json
          updated_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          account_id: string
          attendees: string[] | null
          contact_id: string | null
          created_at: string
          date: string
          description: string | null
          duration: number
          google_event_id: string | null
          id: string
          meeting_url: string | null
          metadata: Json | null
          status: string | null
          time: string
          title: string
          type: Database["public"]["Enums"]["appointment_type"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_id: string
          attendees?: string[] | null
          contact_id?: string | null
          created_at?: string
          date: string
          description?: string | null
          duration?: number
          google_event_id?: string | null
          id?: string
          meeting_url?: string | null
          metadata?: Json | null
          status?: string | null
          time: string
          title: string
          type?: Database["public"]["Enums"]["appointment_type"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string
          attendees?: string[] | null
          contact_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          duration?: number
          google_event_id?: string | null
          id?: string
          meeting_url?: string | null
          metadata?: Json | null
          status?: string | null
          time?: string
          title?: string
          type?: Database["public"]["Enums"]["appointment_type"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          account_id: string
          action: string
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string | null
          id: string
          impersonated_by: string | null
          ip: string | null
          ip_address: string | null
          metadata: Json
          new_values: Json | null
          old_values: Json | null
          resource_id: string | null
          resource_type: string
          severity: Database["public"]["Enums"]["audit_severity"]
          user_agent: string | null
        }
        Insert: {
          account_id: string
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string | null
          id?: string
          impersonated_by?: string | null
          ip?: string | null
          ip_address?: string | null
          metadata?: Json
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type: string
          severity?: Database["public"]["Enums"]["audit_severity"]
          user_agent?: string | null
        }
        Update: {
          account_id?: string
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string | null
          id?: string
          impersonated_by?: string | null
          ip?: string | null
          ip_address?: string | null
          metadata?: Json
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string
          severity?: Database["public"]["Enums"]["audit_severity"]
          user_agent?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          account_id: string
          blocked_at: string | null
          blocked_reason: string | null
          call_name: string | null
          client_memory: Json | null
          consent_given_at: string | null
          consent_revoked_at: string | null
          consent_source: string | null
          consent_status: Database["public"]["Enums"]["consent_status"]
          created_at: string
          data_classification: Database["public"]["Enums"]["data_classification"]
          data_origin: string | null
          email: string | null
          first_contact_date: string
          id: string
          is_blocked: boolean | null
          is_business: boolean | null
          last_activity: string
          legal_basis: Database["public"]["Enums"]["legal_basis"] | null
          name: string | null
          notes: string | null
          phone_number: string
          privacy_notes: string | null
          profile_picture_url: string | null
          tags: string[] | null
          updated_at: string
          user_id: string | null
          whatsapp_id: string | null
        }
        Insert: {
          account_id: string
          blocked_at?: string | null
          blocked_reason?: string | null
          call_name?: string | null
          client_memory?: Json | null
          consent_given_at?: string | null
          consent_revoked_at?: string | null
          consent_source?: string | null
          consent_status?: Database["public"]["Enums"]["consent_status"]
          created_at?: string
          data_classification?: Database["public"]["Enums"]["data_classification"]
          data_origin?: string | null
          email?: string | null
          first_contact_date?: string
          id?: string
          is_blocked?: boolean | null
          is_business?: boolean | null
          last_activity?: string
          legal_basis?: Database["public"]["Enums"]["legal_basis"] | null
          name?: string | null
          notes?: string | null
          phone_number: string
          privacy_notes?: string | null
          profile_picture_url?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
          whatsapp_id?: string | null
        }
        Update: {
          account_id?: string
          blocked_at?: string | null
          blocked_reason?: string | null
          call_name?: string | null
          client_memory?: Json | null
          consent_given_at?: string | null
          consent_revoked_at?: string | null
          consent_source?: string | null
          consent_status?: Database["public"]["Enums"]["consent_status"]
          created_at?: string
          data_classification?: Database["public"]["Enums"]["data_classification"]
          data_origin?: string | null
          email?: string | null
          first_contact_date?: string
          id?: string
          is_blocked?: boolean | null
          is_business?: boolean | null
          last_activity?: string
          legal_basis?: Database["public"]["Enums"]["legal_basis"] | null
          name?: string | null
          notes?: string | null
          phone_number?: string
          privacy_notes?: string | null
          profile_picture_url?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
          whatsapp_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_states: {
        Row: {
          account_id: string
          conversation_id: string
          created_at: string
          current_state: string
          id: string
          last_action: string | null
          last_action_at: string | null
          scheduling_context: Json | null
          updated_at: string
        }
        Insert: {
          account_id: string
          conversation_id: string
          created_at?: string
          current_state?: string
          id?: string
          last_action?: string | null
          last_action_at?: string | null
          scheduling_context?: Json | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          conversation_id?: string
          created_at?: string
          current_state?: string
          id?: string
          last_action?: string | null
          last_action_at?: string | null
          scheduling_context?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_states_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_states_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          account_id: string
          assigned_team: Database["public"]["Enums"]["team_assignment"] | null
          assigned_user_id: string | null
          contact_id: string
          created_at: string
          id: string
          is_active: boolean
          last_message_at: string
          metadata: Json | null
          nina_context: Json | null
          started_at: string
          status: Database["public"]["Enums"]["conversation_status"]
          tags: string[] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_id: string
          assigned_team?: Database["public"]["Enums"]["team_assignment"] | null
          assigned_user_id?: string | null
          contact_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_message_at?: string
          metadata?: Json | null
          nina_context?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string
          assigned_team?: Database["public"]["Enums"]["team_assignment"] | null
          assigned_user_id?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_message_at?: string
          metadata?: Json | null
          nina_context?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      data_deletion_requests: {
        Row: {
          account_id: string
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          metadata: Json
          reason: string | null
          request_type: string
          requested_by: string
          scheduled_for: string | null
          scope: Json
          status: Database["public"]["Enums"]["data_deletion_status"]
        }
        Insert: {
          account_id: string
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          request_type?: string
          requested_by: string
          scheduled_for?: string | null
          scope?: Json
          status?: Database["public"]["Enums"]["data_deletion_status"]
        }
        Update: {
          account_id?: string
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          request_type?: string
          requested_by?: string
          scheduled_for?: string | null
          scope?: Json
          status?: Database["public"]["Enums"]["data_deletion_status"]
        }
        Relationships: []
      }
      data_exports: {
        Row: {
          account_id: string
          completed_at: string | null
          created_at: string
          download_count: number
          error_message: string | null
          expires_at: string | null
          file_path: string | null
          file_size: number | null
          format: string
          id: string
          metadata: Json
          requested_by: string
          scope: Json
          status: Database["public"]["Enums"]["data_export_status"]
        }
        Insert: {
          account_id: string
          completed_at?: string | null
          created_at?: string
          download_count?: number
          error_message?: string | null
          expires_at?: string | null
          file_path?: string | null
          file_size?: number | null
          format?: string
          id?: string
          metadata?: Json
          requested_by: string
          scope?: Json
          status?: Database["public"]["Enums"]["data_export_status"]
        }
        Update: {
          account_id?: string
          completed_at?: string | null
          created_at?: string
          download_count?: number
          error_message?: string | null
          expires_at?: string | null
          file_path?: string | null
          file_size?: number | null
          format?: string
          id?: string
          metadata?: Json
          requested_by?: string
          scope?: Json
          status?: Database["public"]["Enums"]["data_export_status"]
        }
        Relationships: []
      }
      data_subject_requests: {
        Row: {
          account_id: string
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string
          id: string
          metadata: Json
          priority: string
          related_contact_id: string | null
          request_type: Database["public"]["Enums"]["dsar_request_type"]
          requester_email: string
          requester_name: string
          requester_phone: string | null
          resolution_notes: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["dsar_status"]
        }
        Insert: {
          account_id: string
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string
          id?: string
          metadata?: Json
          priority?: string
          related_contact_id?: string | null
          request_type: Database["public"]["Enums"]["dsar_request_type"]
          requester_email: string
          requester_name: string
          requester_phone?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["dsar_status"]
        }
        Update: {
          account_id?: string
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string
          id?: string
          metadata?: Json
          priority?: string
          related_contact_id?: string | null
          request_type?: Database["public"]["Enums"]["dsar_request_type"]
          requester_email?: string
          requester_name?: string
          requester_phone?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["dsar_status"]
        }
        Relationships: []
      }
      deal_activities: {
        Row: {
          account_id: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          deal_id: string
          description: string | null
          id: string
          is_completed: boolean | null
          scheduled_at: string | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          account_id: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id: string
          description?: string | null
          id?: string
          is_completed?: boolean | null
          scheduled_at?: string | null
          title: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: string
          description?: string | null
          id?: string
          is_completed?: boolean | null
          scheduled_at?: string | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          account_id: string
          company: string | null
          contact_id: string | null
          created_at: string | null
          due_date: string | null
          id: string
          lost_at: string | null
          lost_reason: string | null
          notes: string | null
          owner_id: string | null
          priority: string | null
          stage: string | null
          stage_id: string
          tags: string[] | null
          title: string
          updated_at: string | null
          user_id: string | null
          value: number | null
          won_at: string | null
        }
        Insert: {
          account_id: string
          company?: string | null
          contact_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          notes?: string | null
          owner_id?: string | null
          priority?: string | null
          stage?: string | null
          stage_id: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
          user_id?: string | null
          value?: number | null
          won_at?: string | null
        }
        Update: {
          account_id?: string
          company?: string | null
          contact_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          notes?: string | null
          owner_id?: string | null
          priority?: string | null
          stage?: string | null
          stage_id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
          value?: number | null
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      dsar_rate_limit: {
        Row: {
          count: number
          ip: string
          window_start: string
        }
        Insert: {
          count?: number
          ip: string
          window_start?: string
        }
        Update: {
          count?: number
          ip?: string
          window_start?: string
        }
        Relationships: []
      }
      google_calendar_connections: {
        Row: {
          access_token: string
          account_id: string
          calendar_id: string
          created_at: string
          id: string
          is_active: boolean
          refresh_token: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          account_id: string
          calendar_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          refresh_token: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          account_id?: string
          calendar_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          refresh_token?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_connections_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_notifications: {
        Row: {
          account_id: string
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          severity: Database["public"]["Enums"]["audit_severity"]
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          account_id: string
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          severity?: Database["public"]["Enums"]["audit_severity"]
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          account_id?: string
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          severity?: Database["public"]["Enums"]["audit_severity"]
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      media_library: {
        Row: {
          account_id: string
          created_at: string
          data_classification: Database["public"]["Enums"]["data_classification"]
          description: string | null
          file_name: string | null
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          is_active: boolean
          name: string
          tags: string[] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          data_classification?: Database["public"]["Enums"]["data_classification"]
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string
          file_url: string
          id?: string
          is_active?: boolean
          name: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          data_classification?: Database["public"]["Enums"]["data_classification"]
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          is_active?: boolean
          name?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_library_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      message_grouping_queue: {
        Row: {
          account_id: string
          contacts_data: Json | null
          created_at: string
          id: string
          message_data: Json
          message_id: string | null
          phone_number_id: string
          process_after: string | null
          processed: boolean
          whatsapp_message_id: string
        }
        Insert: {
          account_id: string
          contacts_data?: Json | null
          created_at?: string
          id?: string
          message_data: Json
          message_id?: string | null
          phone_number_id: string
          process_after?: string | null
          processed?: boolean
          whatsapp_message_id: string
        }
        Update: {
          account_id?: string
          contacts_data?: Json | null
          created_at?: string
          id?: string
          message_data?: Json
          message_id?: string | null
          phone_number_id?: string
          process_after?: string | null
          processed?: boolean
          whatsapp_message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_grouping_queue_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_grouping_queue_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_processing_queue: {
        Row: {
          account_id: string
          created_at: string
          error_message: string | null
          id: string
          phone_number_id: string
          priority: number
          processed_at: string | null
          raw_data: Json
          retry_count: number
          scheduled_for: string | null
          status: Database["public"]["Enums"]["queue_status"]
          updated_at: string
          whatsapp_message_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          phone_number_id: string
          priority?: number
          processed_at?: string | null
          raw_data: Json
          retry_count?: number
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["queue_status"]
          updated_at?: string
          whatsapp_message_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          phone_number_id?: string
          priority?: number
          processed_at?: string | null
          raw_data?: Json
          retry_count?: number
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["queue_status"]
          updated_at?: string
          whatsapp_message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_processing_queue_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          account_id: string
          content: string | null
          conversation_id: string
          created_at: string
          data_classification: Database["public"]["Enums"]["data_classification"]
          delivered_at: string | null
          from_type: Database["public"]["Enums"]["message_from"]
          id: string
          media_type: string | null
          media_url: string | null
          metadata: Json | null
          nina_response_time: number | null
          processed_by_nina: boolean | null
          read_at: string | null
          reply_to_id: string | null
          sent_at: string
          status: Database["public"]["Enums"]["message_status"]
          type: Database["public"]["Enums"]["message_type"]
          whatsapp_message_id: string | null
        }
        Insert: {
          account_id: string
          content?: string | null
          conversation_id: string
          created_at?: string
          data_classification?: Database["public"]["Enums"]["data_classification"]
          delivered_at?: string | null
          from_type: Database["public"]["Enums"]["message_from"]
          id?: string
          media_type?: string | null
          media_url?: string | null
          metadata?: Json | null
          nina_response_time?: number | null
          processed_by_nina?: boolean | null
          read_at?: string | null
          reply_to_id?: string | null
          sent_at?: string
          status?: Database["public"]["Enums"]["message_status"]
          type?: Database["public"]["Enums"]["message_type"]
          whatsapp_message_id?: string | null
        }
        Update: {
          account_id?: string
          content?: string | null
          conversation_id?: string
          created_at?: string
          data_classification?: Database["public"]["Enums"]["data_classification"]
          delivered_at?: string | null
          from_type?: Database["public"]["Enums"]["message_from"]
          id?: string
          media_type?: string | null
          media_url?: string | null
          metadata?: Json | null
          nina_response_time?: number | null
          processed_by_nina?: boolean | null
          read_at?: string | null
          reply_to_id?: string | null
          sent_at?: string
          status?: Database["public"]["Enums"]["message_status"]
          type?: Database["public"]["Enums"]["message_type"]
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      nina_processing_queue: {
        Row: {
          account_id: string
          contact_id: string
          context_data: Json | null
          conversation_id: string
          created_at: string
          error_message: string | null
          id: string
          message_id: string
          priority: number
          processed_at: string | null
          retry_count: number
          scheduled_for: string | null
          status: Database["public"]["Enums"]["queue_status"]
          updated_at: string
        }
        Insert: {
          account_id: string
          contact_id: string
          context_data?: Json | null
          conversation_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_id: string
          priority?: number
          processed_at?: string | null
          retry_count?: number
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["queue_status"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          contact_id?: string
          context_data?: Json | null
          conversation_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string
          priority?: number
          processed_at?: string | null
          retry_count?: number
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["queue_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nina_processing_queue_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      nina_settings: {
        Row: {
          account_id: string
          adaptive_response_enabled: boolean
          ai_model_mode: string | null
          ai_scheduling_enabled: boolean | null
          async_booking_enabled: boolean | null
          audio_response_enabled: boolean | null
          auto_response_enabled: boolean
          business_days: number[]
          business_hours_end: string
          business_hours_start: string
          company_logo_url: string | null
          company_name: string | null
          created_at: string
          elevenlabs_api_key: string | null
          elevenlabs_model: string | null
          elevenlabs_similarity_boost: number
          elevenlabs_speaker_boost: boolean
          elevenlabs_speed: number | null
          elevenlabs_stability: number
          elevenlabs_style: number
          elevenlabs_voice_id: string
          evolution_api_key: string | null
          evolution_api_url: string | null
          evolution_instance_name: string | null
          id: string
          invite_email_provider: string | null
          invite_email_verified_at: string | null
          invite_from_email: string | null
          invite_from_name: string | null
          is_active: boolean
          message_breaking_enabled: boolean
          response_delay_max: number
          response_delay_min: number
          route_all_to_receiver_enabled: boolean
          sdr_name: string | null
          system_prompt_override: string | null
          test_phone_numbers: Json | null
          test_system_prompt: string | null
          timezone: string
          updated_at: string
          user_id: string | null
          whatsapp_access_token: string | null
          whatsapp_business_account_id: string | null
          whatsapp_phone_number_id: string | null
          whatsapp_provider: string
          whatsapp_verify_token: string | null
        }
        Insert: {
          account_id: string
          adaptive_response_enabled?: boolean
          ai_model_mode?: string | null
          ai_scheduling_enabled?: boolean | null
          async_booking_enabled?: boolean | null
          audio_response_enabled?: boolean | null
          auto_response_enabled?: boolean
          business_days?: number[]
          business_hours_end?: string
          business_hours_start?: string
          company_logo_url?: string | null
          company_name?: string | null
          created_at?: string
          elevenlabs_api_key?: string | null
          elevenlabs_model?: string | null
          elevenlabs_similarity_boost?: number
          elevenlabs_speaker_boost?: boolean
          elevenlabs_speed?: number | null
          elevenlabs_stability?: number
          elevenlabs_style?: number
          elevenlabs_voice_id?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance_name?: string | null
          id?: string
          invite_email_provider?: string | null
          invite_email_verified_at?: string | null
          invite_from_email?: string | null
          invite_from_name?: string | null
          is_active?: boolean
          message_breaking_enabled?: boolean
          response_delay_max?: number
          response_delay_min?: number
          route_all_to_receiver_enabled?: boolean
          sdr_name?: string | null
          system_prompt_override?: string | null
          test_phone_numbers?: Json | null
          test_system_prompt?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string | null
          whatsapp_access_token?: string | null
          whatsapp_business_account_id?: string | null
          whatsapp_phone_number_id?: string | null
          whatsapp_provider?: string
          whatsapp_verify_token?: string | null
        }
        Update: {
          account_id?: string
          adaptive_response_enabled?: boolean
          ai_model_mode?: string | null
          ai_scheduling_enabled?: boolean | null
          async_booking_enabled?: boolean | null
          audio_response_enabled?: boolean | null
          auto_response_enabled?: boolean
          business_days?: number[]
          business_hours_end?: string
          business_hours_start?: string
          company_logo_url?: string | null
          company_name?: string | null
          created_at?: string
          elevenlabs_api_key?: string | null
          elevenlabs_model?: string | null
          elevenlabs_similarity_boost?: number
          elevenlabs_speaker_boost?: boolean
          elevenlabs_speed?: number | null
          elevenlabs_stability?: number
          elevenlabs_style?: number
          elevenlabs_voice_id?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance_name?: string | null
          id?: string
          invite_email_provider?: string | null
          invite_email_verified_at?: string | null
          invite_from_email?: string | null
          invite_from_name?: string | null
          is_active?: boolean
          message_breaking_enabled?: boolean
          response_delay_max?: number
          response_delay_min?: number
          route_all_to_receiver_enabled?: boolean
          sdr_name?: string | null
          system_prompt_override?: string | null
          test_phone_numbers?: Json | null
          test_system_prompt?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string | null
          whatsapp_access_token?: string | null
          whatsapp_business_account_id?: string | null
          whatsapp_phone_number_id?: string | null
          whatsapp_provider?: string
          whatsapp_verify_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nina_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          account_id: string
          ai_trigger_criteria: string | null
          color: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_ai_managed: boolean | null
          is_system: boolean | null
          position: number
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_id: string
          ai_trigger_criteria?: string | null
          color?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_ai_managed?: boolean | null
          is_system?: boolean | null
          position?: number
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_id?: string
          ai_trigger_criteria?: string | null
          color?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_ai_managed?: boolean | null
          is_system?: boolean | null
          position?: number
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      send_queue: {
        Row: {
          account_id: string
          contact_id: string
          content: string | null
          conversation_id: string
          created_at: string
          error_message: string | null
          from_type: string
          id: string
          media_url: string | null
          message_id: string | null
          message_type: string
          metadata: Json | null
          priority: number
          retry_count: number
          scheduled_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["queue_status"]
          updated_at: string
        }
        Insert: {
          account_id: string
          contact_id: string
          content?: string | null
          conversation_id: string
          created_at?: string
          error_message?: string | null
          from_type?: string
          id?: string
          media_url?: string | null
          message_id?: string | null
          message_type?: string
          metadata?: Json | null
          priority?: number
          retry_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["queue_status"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          contact_id?: string
          content?: string | null
          conversation_id?: string
          created_at?: string
          error_message?: string | null
          from_type?: string
          id?: string
          media_url?: string | null
          message_id?: string | null
          message_type?: string
          metadata?: Json | null
          priority?: number
          retry_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["queue_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "send_queue_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "send_queue_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_definitions: {
        Row: {
          account_id: string
          category: string
          color: string
          created_at: string
          id: string
          is_active: boolean
          key: string
          label: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_id: string
          category?: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          label: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string
          category?: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tag_definitions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      team_functions: {
        Row: {
          account_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_functions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          account_id: string
          avatar: string | null
          created_at: string
          email: string
          function_id: string | null
          id: string
          last_active: string | null
          name: string
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          team_id: string | null
          updated_at: string
          user_id: string | null
          weight: number | null
        }
        Insert: {
          account_id: string
          avatar?: string | null
          created_at?: string
          email: string
          function_id?: string | null
          id?: string
          last_active?: string | null
          name: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
          weight?: number | null
        }
        Update: {
          account_id?: string
          avatar?: string | null
          created_at?: string
          email?: string
          function_id?: string | null
          id?: string
          last_active?: string | null
          name?: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_function_id_fkey"
            columns: ["function_id"]
            isOneToOne: false
            referencedRelation: "team_functions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          account_id: string
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_id: string
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
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
          role?: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      contacts_with_stats: {
        Row: {
          blocked_at: string | null
          blocked_reason: string | null
          call_name: string | null
          client_memory: Json | null
          created_at: string | null
          email: string | null
          first_contact_date: string | null
          human_messages: number | null
          id: string | null
          is_blocked: boolean | null
          is_business: boolean | null
          last_activity: string | null
          name: string | null
          nina_messages: number | null
          notes: string | null
          phone_number: string | null
          profile_picture_url: string | null
          tags: string[] | null
          total_messages: number | null
          updated_at: string | null
          user_id: string | null
          user_messages: number | null
          whatsapp_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      account_member_role: {
        Args: { _account_id: string }
        Returns: Database["public"]["Enums"]["app_account_role"]
      }
      check_account_limit: {
        Args: { _account_id: string; _resource: string }
        Returns: Json
      }
      claim_message_processing_batch: {
        Args: { p_limit?: number }
        Returns: {
          account_id: string
          created_at: string
          error_message: string | null
          id: string
          phone_number_id: string
          priority: number
          processed_at: string | null
          raw_data: Json
          retry_count: number
          scheduled_for: string | null
          status: Database["public"]["Enums"]["queue_status"]
          updated_at: string
          whatsapp_message_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "message_processing_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_nina_processing_batch: {
        Args: { p_limit?: number }
        Returns: {
          account_id: string
          contact_id: string
          context_data: Json | null
          conversation_id: string
          created_at: string
          error_message: string | null
          id: string
          message_id: string
          priority: number
          processed_at: string | null
          retry_count: number
          scheduled_for: string | null
          status: Database["public"]["Enums"]["queue_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "nina_processing_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_send_queue_batch: {
        Args: { p_limit?: number }
        Returns: {
          account_id: string
          contact_id: string
          content: string | null
          conversation_id: string
          created_at: string
          error_message: string | null
          from_type: string
          id: string
          media_url: string | null
          message_id: string | null
          message_type: string
          metadata: Json | null
          priority: number
          retry_count: number
          scheduled_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["queue_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "send_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_processed_message_queue: { Args: never; Returns: undefined }
      cleanup_processed_queues: { Args: never; Returns: undefined }
      current_account_id: { Args: never; Returns: string }
      get_auth_user_id: { Args: never; Returns: string }
      get_or_create_conversation_state: {
        Args: { p_conversation_id: string }
        Returns: {
          account_id: string
          conversation_id: string
          created_at: string
          current_state: string
          id: string
          last_action: string | null
          last_action_at: string | null
          scheduling_context: Json | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "conversation_states"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_account_role: {
        Args: {
          _account_id: string
          _roles: Database["public"]["Enums"]["app_account_role"][]
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
      is_account_member: { Args: { _account_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      log_audit: {
        Args: {
          _account_id: string
          _action: string
          _metadata?: Json
          _resource_id?: string
          _resource_type: string
        }
        Returns: undefined
      }
      log_audit_v2: {
        Args: {
          _account_id: string
          _action?: string
          _entity_id?: string
          _entity_type: string
          _event_type: string
          _metadata?: Json
          _new?: Json
          _old?: Json
          _severity: Database["public"]["Enums"]["audit_severity"]
        }
        Returns: undefined
      }
      set_active_account: { Args: { _account_id: string }; Returns: undefined }
      update_client_memory: {
        Args: { p_contact_id: string; p_new_memory: Json }
        Returns: undefined
      }
      update_conversation_state: {
        Args: {
          p_action?: string
          p_context?: Json
          p_conversation_id: string
          p_new_state: string
        }
        Returns: {
          account_id: string
          conversation_id: string
          created_at: string
          current_state: string
          id: string
          last_action: string | null
          last_action_at: string | null
          scheduling_context: Json | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "conversation_states"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      account_deletion_status: "none" | "pending" | "scheduled" | "completed"
      account_member_status: "invited" | "active" | "disabled"
      account_plan: "starter" | "pro" | "business" | "enterprise"
      account_status: "active" | "suspended" | "cancelled" | "pending"
      app_account_role: "owner" | "admin" | "manager" | "sdr" | "viewer"
      app_role: "admin" | "user"
      appointment_type: "demo" | "meeting" | "support" | "followup"
      audit_severity: "info" | "warn" | "critical"
      consent_status: "granted" | "revoked" | "unknown"
      conversation_status: "nina" | "human" | "paused"
      data_classification: "public" | "internal" | "confidential" | "restricted"
      data_deletion_status:
        | "pending"
        | "approved"
        | "scheduled"
        | "completed"
        | "cancelled"
        | "failed"
      data_export_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "expired"
      dsar_request_type:
        | "access"
        | "rectification"
        | "portability"
        | "erasure"
        | "anonymization"
        | "consent_revocation"
        | "opposition"
      dsar_status: "open" | "in_progress" | "resolved" | "rejected" | "expired"
      legal_basis:
        | "consent"
        | "contract"
        | "legitimate_interest"
        | "legal_obligation"
        | "vital_interests"
        | "public_task"
      member_role: "admin" | "manager" | "agent"
      member_status: "active" | "invited" | "disabled"
      message_from: "user" | "nina" | "human"
      message_status: "sent" | "delivered" | "read" | "failed" | "processing"
      message_type: "text" | "audio" | "image" | "document" | "video"
      queue_status: "pending" | "processing" | "completed" | "failed"
      team_assignment: "mateus" | "igor" | "fe" | "vendas" | "suporte"
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
      account_deletion_status: ["none", "pending", "scheduled", "completed"],
      account_member_status: ["invited", "active", "disabled"],
      account_plan: ["starter", "pro", "business", "enterprise"],
      account_status: ["active", "suspended", "cancelled", "pending"],
      app_account_role: ["owner", "admin", "manager", "sdr", "viewer"],
      app_role: ["admin", "user"],
      appointment_type: ["demo", "meeting", "support", "followup"],
      audit_severity: ["info", "warn", "critical"],
      consent_status: ["granted", "revoked", "unknown"],
      conversation_status: ["nina", "human", "paused"],
      data_classification: ["public", "internal", "confidential", "restricted"],
      data_deletion_status: [
        "pending",
        "approved",
        "scheduled",
        "completed",
        "cancelled",
        "failed",
      ],
      data_export_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "expired",
      ],
      dsar_request_type: [
        "access",
        "rectification",
        "portability",
        "erasure",
        "anonymization",
        "consent_revocation",
        "opposition",
      ],
      dsar_status: ["open", "in_progress", "resolved", "rejected", "expired"],
      legal_basis: [
        "consent",
        "contract",
        "legitimate_interest",
        "legal_obligation",
        "vital_interests",
        "public_task",
      ],
      member_role: ["admin", "manager", "agent"],
      member_status: ["active", "invited", "disabled"],
      message_from: ["user", "nina", "human"],
      message_status: ["sent", "delivered", "read", "failed", "processing"],
      message_type: ["text", "audio", "image", "document", "video"],
      queue_status: ["pending", "processing", "completed", "failed"],
      team_assignment: ["mateus", "igor", "fe", "vendas", "suporte"],
    },
  },
} as const
