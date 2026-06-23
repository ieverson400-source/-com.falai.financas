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
      chat_messages: {
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
          user_id: string
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
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          expense_date: string
          id: string
          raw_transcript: string | null
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          raw_transcript?: string | null
          source?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          raw_transcript?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      pluggy_accounts: {
        Row: {
          balance: number | null
          created_at: string
          currency_code: string | null
          id: string
          item_id: string
          name: string | null
          number: string | null
          pluggy_account_id: string
          raw: Json | null
          subtype: string | null
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number | null
          created_at?: string
          currency_code?: string | null
          id?: string
          item_id: string
          name?: string | null
          number?: string | null
          pluggy_account_id: string
          raw?: Json | null
          subtype?: string | null
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number | null
          created_at?: string
          currency_code?: string | null
          id?: string
          item_id?: string
          name?: string | null
          number?: string | null
          pluggy_account_id?: string
          raw?: Json | null
          subtype?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pluggy_accounts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pluggy_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pluggy_items: {
        Row: {
          connector_id: number | null
          created_at: string
          id: string
          institution_name: string | null
          last_synced_at: string | null
          pluggy_item_id: string
          status: string
          status_detail: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          connector_id?: number | null
          created_at?: string
          id?: string
          institution_name?: string | null
          last_synced_at?: string | null
          pluggy_item_id: string
          status?: string
          status_detail?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          connector_id?: number | null
          created_at?: string
          id?: string
          institution_name?: string | null
          last_synced_at?: string | null
          pluggy_item_id?: string
          status?: string
          status_detail?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pluggy_sync_logs: {
        Row: {
          accounts_count: number | null
          created_at: string
          error_message: string | null
          id: string
          item_id: string
          pluggy_item_id: string | null
          status: string
          triggered_by: string
          user_id: string
        }
        Insert: {
          accounts_count?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          item_id: string
          pluggy_item_id?: string | null
          status: string
          triggered_by?: string
          user_id: string
        }
        Update: {
          accounts_count?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          item_id?: string
          pluggy_item_id?: string | null
          status?: string
          triggered_by?: string
          user_id?: string
        }
        Relationships: []
      }
      pluggy_transactions: {
        Row: {
          account_id: string
          amount: number
          category: string | null
          created_at: string
          currency_code: string | null
          description: string | null
          id: string
          pluggy_transaction_id: string
          raw: Json | null
          transaction_date: string
          type: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category?: string | null
          created_at?: string
          currency_code?: string | null
          description?: string | null
          id?: string
          pluggy_transaction_id: string
          raw?: Json | null
          transaction_date: string
          type?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string | null
          created_at?: string
          currency_code?: string | null
          description?: string | null
          id?: string
          pluggy_transaction_id?: string
          raw?: Json | null
          transaction_date?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pluggy_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "pluggy_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          notify_expense_confirmation: boolean
          notify_monthly_summary: boolean
          updated_at: string
          user_id: string
          whatsapp_phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          notify_expense_confirmation?: boolean
          notify_monthly_summary?: boolean
          updated_at?: string
          user_id: string
          whatsapp_phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          notify_expense_confirmation?: boolean
          notify_monthly_summary?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      recarga_settings: {
        Row: {
          api_key: string | null
          api_url: string | null
          created_at: string
          id: string
          last_test_at: string | null
          last_test_message: string | null
          last_test_ok: boolean | null
          provider: string
          real_mode: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key?: string | null
          api_url?: string | null
          created_at?: string
          id?: string
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_ok?: boolean | null
          provider?: string
          real_mode?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string | null
          api_url?: string | null
          created_at?: string
          id?: string
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_ok?: boolean | null
          provider?: string
          real_mode?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recargas: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          operadora: string
          provider_response: Json | null
          status: string
          telefone: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          operadora: string
          provider_response?: Json | null
          status?: string
          telefone: string
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          operadora?: string
          provider_response?: Json | null
          status?: string
          telefone?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          plan: string
          provider: string
          provider_product_id: string | null
          provider_subscription_id: string | null
          purchase_token: string | null
          raw: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          provider?: string
          provider_product_id?: string | null
          provider_subscription_id?: string | null
          purchase_token?: string | null
          raw?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          provider?: string
          provider_product_id?: string | null
          provider_subscription_id?: string | null
          purchase_token?: string | null
          raw?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
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
      whatsapp_inbox: {
        Row: {
          created_at: string
          error_message: string | null
          expense_id: string | null
          from_phone: string
          id: string
          media_content_type: string | null
          media_url: string | null
          message_sid: string
          payload: Json
          processing_status: string
          provider: string
          transcript: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          expense_id?: string | null
          from_phone: string
          id?: string
          media_content_type?: string | null
          media_url?: string | null
          message_sid: string
          payload?: Json
          processing_status?: string
          provider?: string
          transcript?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          expense_id?: string | null
          from_phone?: string
          id?: string
          media_content_type?: string | null
          media_url?: string | null
          message_sid?: string
          payload?: Json
          processing_status?: string
          provider?: string
          transcript?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_inbox_expense_fk"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbox_user_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      whatsapp_unmapped_numbers: {
        Row: {
          first_seen_at: string
          from_phone: string
          hits: number
          id: string
          last_message_sid: string | null
          last_payload: Json
          last_seen_at: string
        }
        Insert: {
          first_seen_at?: string
          from_phone: string
          hits?: number
          id?: string
          last_message_sid?: string | null
          last_payload?: Json
          last_seen_at?: string
        }
        Update: {
          first_seen_at?: string
          from_phone?: string
          hits?: number
          id?: string
          last_message_sid?: string | null
          last_payload?: Json
          last_seen_at?: string
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
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
