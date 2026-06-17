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
      api_providers: {
        Row: {
          base_url: string
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          provider_key: string
          updated_at: string
        }
        Insert: {
          base_url?: string
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          provider_key: string
          updated_at?: string
        }
        Update: {
          base_url?: string
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          provider_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      fraud_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          resolved: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          resolved?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          resolved?: boolean
          user_id?: string
        }
        Relationships: []
      }
      payment_sessions: {
        Row: {
          amount: number
          authorization_url: string | null
          created_at: string
          expires_at: string
          id: string
          paystack_reference: string | null
          reference: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          authorization_url?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          paystack_reference?: string | null
          reference: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          authorization_url?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          paystack_reference?: string | null
          reference?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          frozen_at: string | null
          frozen_reason: string | null
          full_name: string | null
          id: string
          is_frozen: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          frozen_at?: string | null
          frozen_reason?: string | null
          full_name?: string | null
          id?: string
          is_frozen?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          frozen_at?: string | null
          frozen_reason?: string | null
          full_name?: string | null
          id?: string
          is_frozen?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_plans: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_synced_at: string
          metadata: Json
          name: string
          network_id: string
          profit_amount: number
          profit_percent: number
          provider_cost: number
          provider_plan_id: string
          provider_source: string
          service_type: string
          size_mb: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string
          metadata?: Json
          name: string
          network_id: string
          profit_amount?: number
          profit_percent?: number
          provider_cost?: number
          provider_plan_id: string
          provider_source?: string
          service_type: string
          size_mb?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string
          metadata?: Json
          name?: string
          network_id?: string
          profit_amount?: number
          profit_percent?: number
          provider_cost?: number
          provider_plan_id?: string
          provider_source?: string
          service_type?: string
          size_mb?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      reseller_api_keys: {
        Row: {
          api_key: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          last_used_at: string | null
          partner_name: string
          permissions: string[]
          rate_limit_per_minute: number
          total_requests: number
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          partner_name: string
          permissions?: string[]
          rate_limit_per_minute?: number
          total_requests?: number
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          partner_name?: string
          permissions?: string[]
          rate_limit_per_minute?: number
          total_requests?: number
          updated_at?: string
        }
        Relationships: []
      }
      service_transactions: {
        Row: {
          amount: number
          api_response: Json | null
          created_at: string
          id: string
          metadata: Json | null
          phone_number: string | null
          provider: string | null
          reference: string | null
          service_type: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          api_response?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          phone_number?: string | null
          provider?: string | null
          reference?: string | null
          service_type: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          api_response?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          phone_number?: string | null
          provider?: string | null
          reference?: string | null
          service_type?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      transaction_pins: {
        Row: {
          created_at: string | null
          id: string
          pin_hash: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          pin_hash: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          pin_hash?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      wallet_reconciliation_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          drift_amount: number
          expected_balance: number
          id: string
          previous_balance: number
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          drift_amount: number
          expected_balance: number
          id?: string
          previous_balance: number
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          drift_amount?: number
          expected_balance?: number
          id?: string
          previous_balance?: number
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          reference: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          reference?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          reference?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          event_type: string | null
          id: string
          payload: Json
          processed: boolean
          source: string
        }
        Insert: {
          created_at?: string
          event_type?: string | null
          id?: string
          payload?: Json
          processed?: boolean
          source: string
        }
        Update: {
          created_at?: string
          event_type?: string | null
          id?: string
          payload?: Json
          processed?: boolean
          source?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_fraud: { Args: { p_user_id: string }; Returns: Json }
      check_rate_limit: {
        Args: {
          p_action: string
          p_max_count: number
          p_user_id: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      compute_selling_price: {
        Args: { p_cost: number; p_flat: number; p_percent: number }
        Returns: number
      }
      credit_wallet: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      credit_wallet_safe: {
        Args: { p_amount: number; p_reference: string; p_user_id: string }
        Returns: Json
      }
      deduct_wallet: {
        Args: { p_amount: number; p_reference: string; p_user_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_transaction_pin: { Args: { p_user_id: string }; Returns: boolean }
      recalculate_wallet_balance: {
        Args: { p_user_id: string }
        Returns: number
      }
      reconcile_all_wallets: { Args: never; Returns: Json }
      reconcile_stuck_transactions: { Args: never; Returns: Json }
      refund_wallet: {
        Args: { p_amount: number; p_reference: string; p_user_id: string }
        Returns: undefined
      }
      run_wallet_reconciliation: { Args: never; Returns: Json }
      validate_api_key: { Args: { p_api_key: string }; Returns: Json }
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
