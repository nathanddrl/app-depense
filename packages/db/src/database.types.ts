export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      aid: {
        Row: {
          amount_cents: number
          beneficiary_member_id: string
          created_at: string
          expense_id: string
          id: string
          label: string
        }
        Insert: {
          amount_cents: number
          beneficiary_member_id: string
          created_at?: string
          expense_id: string
          id?: string
          label: string
        }
        Update: {
          amount_cents?: number
          beneficiary_member_id?: string
          created_at?: string
          expense_id?: string
          id?: string
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "aid_beneficiary_member_id_fkey"
            columns: ["beneficiary_member_id"]
            isOneToOne: false
            referencedRelation: "member"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aid_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expense"
            referencedColumns: ["id"]
          },
        ]
      }
      expense: {
        Row: {
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          gross_amount_cents: number
          household_id: string
          id: string
          incurred_on: string
          label: string
          payer_member_id: string
          settlement_id: string | null
          source: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          gross_amount_cents: number
          household_id: string
          id?: string
          incurred_on: string
          label: string
          payer_member_id: string
          settlement_id?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          gross_amount_cents?: number
          household_id?: string
          id?: string
          incurred_on?: string
          label?: string
          payer_member_id?: string
          settlement_id?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_payer_member_id_fkey"
            columns: ["payer_member_id"]
            isOneToOne: false
            referencedRelation: "member"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlement"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_share: {
        Row: {
          expense_id: string
          id: string
          member_id: string
          share_cents: number
          share_pct_snapshot: number
        }
        Insert: {
          expense_id: string
          id?: string
          member_id: string
          share_cents: number
          share_pct_snapshot: number
        }
        Update: {
          expense_id?: string
          id?: string
          member_id?: string
          share_cents?: number
          share_pct_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_share_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expense"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_share_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member"
            referencedColumns: ["id"]
          },
        ]
      }
      household: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      member: {
        Row: {
          auth_user_id: string
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          display_name: string
          id?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      membership: {
        Row: {
          default_share_pct: number
          household_id: string
          id: string
          joined_at: string
          member_id: string
          role: string
        }
        Insert: {
          default_share_pct: number
          household_id: string
          id?: string
          joined_at?: string
          member_id: string
          role?: string
        }
        Update: {
          default_share_pct?: number
          household_id?: string
          id?: string
          joined_at?: string
          member_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_aid: {
        Row: {
          amount_cents: number
          beneficiary_member_id: string
          id: string
          label: string
          template_id: string
        }
        Insert: {
          amount_cents: number
          beneficiary_member_id: string
          id?: string
          label: string
          template_id: string
        }
        Update: {
          amount_cents?: number
          beneficiary_member_id?: string
          id?: string
          label?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_aid_beneficiary_member_id_fkey"
            columns: ["beneficiary_member_id"]
            isOneToOne: false
            referencedRelation: "member"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_aid_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "recurring_template"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_occurrence: {
        Row: {
          expense_id: string
          generated_at: string
          id: string
          period: string
          template_id: string
        }
        Insert: {
          expense_id: string
          generated_at?: string
          id?: string
          period: string
          template_id: string
        }
        Update: {
          expense_id?: string
          generated_at?: string
          id?: string
          period?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_occurrence_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expense"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_occurrence_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "recurring_template"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_template: {
        Row: {
          active: boolean
          amount_cents: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          day_of_month: number
          household_id: string
          id: string
          label: string
          payer_member_id: string
          shares_config: Json
        }
        Insert: {
          active?: boolean
          amount_cents: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          day_of_month: number
          household_id: string
          id?: string
          label: string
          payer_member_id: string
          shares_config: Json
        }
        Update: {
          active?: boolean
          amount_cents?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          day_of_month?: number
          household_id?: string
          id?: string
          label?: string
          payer_member_id?: string
          shares_config?: Json
        }
        Relationships: [
          {
            foreignKeyName: "recurring_template_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_template_payer_member_id_fkey"
            columns: ["payer_member_id"]
            isOneToOne: false
            referencedRelation: "member"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement: {
        Row: {
          amount_cents: number
          cancelled_at: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          from_member_id: string
          household_id: string
          id: string
          initiated_at: string
          initiated_by: string
          status: Database["public"]["Enums"]["settlement_status"]
          to_member_id: string
        }
        Insert: {
          amount_cents: number
          cancelled_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          from_member_id: string
          household_id: string
          id?: string
          initiated_at?: string
          initiated_by: string
          status?: Database["public"]["Enums"]["settlement_status"]
          to_member_id: string
        }
        Update: {
          amount_cents?: number
          cancelled_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          from_member_id?: string
          household_id?: string
          id?: string
          initiated_at?: string
          initiated_by?: string
          status?: Database["public"]["Enums"]["settlement_status"]
          to_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "member"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_from_member_id_fkey"
            columns: ["from_member_id"]
            isOneToOne: false
            referencedRelation: "member"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "member"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_to_member_id_fkey"
            columns: ["to_member_id"]
            isOneToOne: false
            referencedRelation: "member"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      expense_category: "loyer" | "courses" | "charges" | "sorties" | "autre"
      settlement_status: "pending" | "confirmed" | "cancelled"
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
      expense_category: ["loyer", "courses", "charges", "sorties", "autre"],
      settlement_status: ["pending", "confirmed", "cancelled"],
    },
  },
} as const

