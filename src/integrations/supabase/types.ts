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
      contact_records: {
        Row: {
          by_whom: string
          contact_date: string
          created_at: string
          id: string
          note: string
          patient_id: string
          type: Database["public"]["Enums"]["contact_type"]
        }
        Insert: {
          by_whom?: string
          contact_date?: string
          created_at?: string
          id?: string
          note?: string
          patient_id: string
          type?: Database["public"]["Enums"]["contact_type"]
        }
        Update: {
          by_whom?: string
          contact_date?: string
          created_at?: string
          id?: string
          note?: string
          patient_id?: string
          type?: Database["public"]["Enums"]["contact_type"]
        }
        Relationships: [
          {
            foreignKeyName: "contact_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients_no_financials"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          body_html: string
          content_box: Json | null
          continuation_strategy: string
          created_at: string
          created_by: string | null
          default_data: Json
          footer_html: string
          header_html: string
          id: string
          is_default: boolean
          logo_path: string | null
          mode: string
          pdf_template_path: string | null
          signature_box: Json | null
          surgeon: string | null
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
        }
        Insert: {
          body_html?: string
          content_box?: Json | null
          continuation_strategy?: string
          created_at?: string
          created_by?: string | null
          default_data?: Json
          footer_html?: string
          header_html?: string
          id?: string
          is_default?: boolean
          logo_path?: string | null
          mode?: string
          pdf_template_path?: string | null
          signature_box?: Json | null
          surgeon?: string | null
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at?: string
        }
        Update: {
          body_html?: string
          content_box?: Json | null
          continuation_strategy?: string
          created_at?: string
          created_by?: string | null
          default_data?: Json
          footer_html?: string
          header_html?: string
          id?: string
          is_default?: boolean
          logo_path?: string | null
          mode?: string
          pdf_template_path?: string | null
          signature_box?: Json | null
          surgeon?: string | null
          title?: string
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
        }
        Relationships: []
      }
      patient_documents: {
        Row: {
          body_html: string
          created_at: string
          created_by: string | null
          data: Json
          drive_file_id: string | null
          drive_synced_at: string | null
          id: string
          patient_id: string
          pdf_path: string | null
          sent_via_whatsapp_at: string | null
          template_id: string | null
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
        }
        Insert: {
          body_html?: string
          created_at?: string
          created_by?: string | null
          data?: Json
          drive_file_id?: string | null
          drive_synced_at?: string | null
          id?: string
          patient_id: string
          pdf_path?: string | null
          sent_via_whatsapp_at?: string | null
          template_id?: string | null
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at?: string
        }
        Update: {
          body_html?: string
          created_at?: string
          created_by?: string | null
          data?: Json
          drive_file_id?: string | null
          drive_synced_at?: string | null
          id?: string
          patient_id?: string
          pdf_path?: string | null
          sent_via_whatsapp_at?: string | null
          template_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients_no_financials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          age: number | null
          alerts: string | null
          anesthesia_fees: number | null
          billing_type: string | null
          concierge: string
          created_at: string
          decision_status: Database["public"]["Enums"]["decision_status"]
          desired_hospital: string | null
          email: string | null
          estimated_value: number | null
          hospital_budget: number | null
          id: string
          indication_date: string | null
          indication_location: string | null
          last_interaction_date: string
          laterality: string | null
          loss_reason: Database["public"]["Enums"]["loss_reason"] | null
          loss_reason_detail: string | null
          materials_cost: number | null
          medical_fees: number | null
          name: string
          next_follow_up_date: string | null
          notes: string | null
          owner: string
          patient_type: string | null
          payer: string | null
          phone: string | null
          procedure_category: string | null
          procedure_name: string
          responsible_contact: string | null
          stage: Database["public"]["Enums"]["pipeline_stage"]
          stage_entered_at: string
          surgeon: string
          surgical_approach: string | null
          updated_at: string
        }
        Insert: {
          age?: number | null
          alerts?: string | null
          anesthesia_fees?: number | null
          billing_type?: string | null
          concierge?: string
          created_at?: string
          decision_status?: Database["public"]["Enums"]["decision_status"]
          desired_hospital?: string | null
          email?: string | null
          estimated_value?: number | null
          hospital_budget?: number | null
          id?: string
          indication_date?: string | null
          indication_location?: string | null
          last_interaction_date?: string
          laterality?: string | null
          loss_reason?: Database["public"]["Enums"]["loss_reason"] | null
          loss_reason_detail?: string | null
          materials_cost?: number | null
          medical_fees?: number | null
          name: string
          next_follow_up_date?: string | null
          notes?: string | null
          owner?: string
          patient_type?: string | null
          payer?: string | null
          phone?: string | null
          procedure_category?: string | null
          procedure_name: string
          responsible_contact?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          stage_entered_at?: string
          surgeon: string
          surgical_approach?: string | null
          updated_at?: string
        }
        Update: {
          age?: number | null
          alerts?: string | null
          anesthesia_fees?: number | null
          billing_type?: string | null
          concierge?: string
          created_at?: string
          decision_status?: Database["public"]["Enums"]["decision_status"]
          desired_hospital?: string | null
          email?: string | null
          estimated_value?: number | null
          hospital_budget?: number | null
          id?: string
          indication_date?: string | null
          indication_location?: string | null
          last_interaction_date?: string
          laterality?: string | null
          loss_reason?: Database["public"]["Enums"]["loss_reason"] | null
          loss_reason_detail?: string | null
          materials_cost?: number | null
          medical_fees?: number | null
          name?: string
          next_follow_up_date?: string | null
          notes?: string | null
          owner?: string
          patient_type?: string | null
          payer?: string | null
          phone?: string | null
          procedure_category?: string | null
          procedure_name?: string
          responsible_contact?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          stage_entered_at?: string
          surgeon?: string
          surgical_approach?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pending_items: {
        Row: {
          checked: boolean
          created_at: string
          id: string
          patient_id: string
          title: string
          updated_at: string
        }
        Insert: {
          checked?: boolean
          created_at?: string
          id?: string
          patient_id: string
          title: string
          updated_at?: string
        }
        Update: {
          checked?: boolean
          created_at?: string
          id?: string
          patient_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_items_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_items_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients_no_financials"
            referencedColumns: ["id"]
          },
        ]
      }
      preop_checklist_items: {
        Row: {
          checked: boolean
          id: string
          item_key: string
          patient_id: string
          updated_at: string
        }
        Insert: {
          checked?: boolean
          id?: string
          item_key: string
          patient_id: string
          updated_at?: string
        }
        Update: {
          checked?: boolean
          id?: string
          item_key?: string
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "preop_checklist_items_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preop_checklist_items_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients_no_financials"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_code_suggestions: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string
          last_used_at: string
          procedure: string
          updated_at: string
          usage_count: number
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label?: string
          last_used_at?: string
          procedure: string
          updated_at?: string
          usage_count?: number
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string
          last_used_at?: string
          procedure?: string
          updated_at?: string
          usage_count?: number
          value?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          concierge_name: string | null
          created_at: string
          display_name: string | null
          id: string
          surgeon_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          concierge_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          surgeon_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          concierge_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          surgeon_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          due_date: string
          due_time: string
          id: string
          patient_id: string
          responsible: string
          title: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          due_date: string
          due_time?: string
          id?: string
          patient_id: string
          responsible?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          due_date?: string
          due_time?: string
          id?: string
          patient_id?: string
          responsible?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients_no_financials"
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
    }
    Views: {
      patients_no_financials: {
        Row: {
          age: number | null
          alerts: string | null
          anesthesia_fees: number | null
          billing_type: string | null
          concierge: string | null
          created_at: string | null
          decision_status: Database["public"]["Enums"]["decision_status"] | null
          desired_hospital: string | null
          email: string | null
          estimated_value: number | null
          hospital_budget: number | null
          id: string | null
          indication_date: string | null
          indication_location: string | null
          last_interaction_date: string | null
          laterality: string | null
          loss_reason: Database["public"]["Enums"]["loss_reason"] | null
          loss_reason_detail: string | null
          materials_cost: number | null
          medical_fees: number | null
          name: string | null
          next_follow_up_date: string | null
          notes: string | null
          owner: string | null
          patient_type: string | null
          payer: string | null
          phone: string | null
          procedure_category: string | null
          procedure_name: string | null
          responsible_contact: string | null
          stage: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_entered_at: string | null
          surgeon: string | null
          surgical_approach: string | null
          updated_at: string | null
        }
        Insert: {
          age?: number | null
          alerts?: string | null
          anesthesia_fees?: never
          billing_type?: never
          concierge?: string | null
          created_at?: string | null
          decision_status?:
            | Database["public"]["Enums"]["decision_status"]
            | null
          desired_hospital?: string | null
          email?: string | null
          estimated_value?: never
          hospital_budget?: never
          id?: string | null
          indication_date?: string | null
          indication_location?: string | null
          last_interaction_date?: string | null
          laterality?: string | null
          loss_reason?: Database["public"]["Enums"]["loss_reason"] | null
          loss_reason_detail?: string | null
          materials_cost?: never
          medical_fees?: never
          name?: string | null
          next_follow_up_date?: string | null
          notes?: string | null
          owner?: string | null
          patient_type?: string | null
          payer?: string | null
          phone?: string | null
          procedure_category?: string | null
          procedure_name?: string | null
          responsible_contact?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_entered_at?: string | null
          surgeon?: string | null
          surgical_approach?: string | null
          updated_at?: string | null
        }
        Update: {
          age?: number | null
          alerts?: string | null
          anesthesia_fees?: never
          billing_type?: never
          concierge?: string | null
          created_at?: string | null
          decision_status?:
            | Database["public"]["Enums"]["decision_status"]
            | null
          desired_hospital?: string | null
          email?: string | null
          estimated_value?: never
          hospital_budget?: never
          id?: string | null
          indication_date?: string | null
          indication_location?: string | null
          last_interaction_date?: string | null
          laterality?: string | null
          loss_reason?: Database["public"]["Enums"]["loss_reason"] | null
          loss_reason_detail?: string | null
          materials_cost?: never
          medical_fees?: never
          name?: string | null
          next_follow_up_date?: string | null
          notes?: string | null
          owner?: string | null
          patient_type?: string | null
          payer?: string | null
          phone?: string | null
          procedure_category?: string | null
          procedure_name?: string | null
          responsible_contact?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_entered_at?: string | null
          surgeon?: string | null
          surgical_approach?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access_patient: { Args: { _patient_id: string }; Returns: boolean }
      current_concierge_name: { Args: never; Returns: string }
      current_surgeon_name: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "surgeon" | "concierge" | "call_center"
      contact_type: "phone" | "whatsapp" | "email" | "in_person"
      decision_status: "waiting" | "thinking" | "negotiating" | "confirmed"
      document_type:
        | "budget"
        | "surgical_request"
        | "medical_certificate"
        | "report"
      loss_reason:
        | "price"
        | "delay"
        | "clinical_contraindication"
        | "chose_another"
        | "other"
      pipeline_stage:
        | "indication"
        | "first_contact"
        | "budget_preparation"
        | "budget_sent"
        | "awaiting_authorization"
        | "decision_pending"
        | "followup_negotiation"
        | "preop_preparation"
        | "surgery_scheduled"
        | "surgery_completed"
        | "lost"
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
      app_role: ["admin", "surgeon", "concierge", "call_center"],
      contact_type: ["phone", "whatsapp", "email", "in_person"],
      decision_status: ["waiting", "thinking", "negotiating", "confirmed"],
      document_type: [
        "budget",
        "surgical_request",
        "medical_certificate",
        "report",
      ],
      loss_reason: [
        "price",
        "delay",
        "clinical_contraindication",
        "chose_another",
        "other",
      ],
      pipeline_stage: [
        "indication",
        "first_contact",
        "budget_preparation",
        "budget_sent",
        "awaiting_authorization",
        "decision_pending",
        "followup_negotiation",
        "preop_preparation",
        "surgery_scheduled",
        "surgery_completed",
        "lost",
      ],
    },
  },
} as const
