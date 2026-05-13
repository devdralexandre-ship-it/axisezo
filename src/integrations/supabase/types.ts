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
          signature_authorized_at: string | null
          signature_authorized_by: string | null
          signed_at: string | null
          signed_by: string | null
          signed_pdf_path: string | null
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
          signature_authorized_at?: string | null
          signature_authorized_by?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signed_pdf_path?: string | null
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
          signature_authorized_at?: string | null
          signature_authorized_by?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signed_pdf_path?: string | null
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
      patient_uploads: {
        Row: {
          category: string
          created_at: string
          drive_file_id: string | null
          drive_synced_at: string | null
          file_name: string
          id: string
          mime_type: string
          patient_id: string
          size_bytes: number
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          drive_file_id?: string | null
          drive_synced_at?: string | null
          file_name: string
          id?: string
          mime_type?: string
          patient_id: string
          size_bytes?: number
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          drive_file_id?: string | null
          drive_synced_at?: string | null
          file_name?: string
          id?: string
          mime_type?: string
          patient_id?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: []
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
          procedure_codes: Json
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
          procedure_codes?: Json
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
          procedure_codes?: Json
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
      procedure_default_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          label: string
          position: number
          procedure: string
          quantity: number
          scope: string
          scope_owner: string
          updated_at: string
        }
        Insert: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          label?: string
          position?: number
          procedure: string
          quantity?: number
          scope: string
          scope_owner: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          label?: string
          position?: number
          procedure?: string
          quantity?: number
          scope?: string
          scope_owner?: string
          updated_at?: string
        }
        Relationships: []
      }
      professional_profiles: {
        Row: {
          created_at: string
          crm: string | null
          crm_uf: string | null
          email_professional: string | null
          id: string
          phone_professional: string | null
          rqe: string | null
          signature_title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          crm?: string | null
          crm_uf?: string | null
          email_professional?: string | null
          id?: string
          phone_professional?: string | null
          rqe?: string | null
          signature_title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          crm?: string | null
          crm_uf?: string | null
          email_professional?: string | null
          id?: string
          phone_professional?: string | null
          rqe?: string | null
          signature_title?: string | null
          updated_at?: string
          user_id?: string
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
      signature_audit_log: {
        Row: {
          acted_by_name: string | null
          acted_by_user_id: string
          document_id: string | null
          document_title: string | null
          document_type: string | null
          error_message: string | null
          id: string
          ip_address: string | null
          patient_id: string | null
          patient_name_snapshot: string | null
          prev_hash: string | null
          result: string
          row_hash: string | null
          signed_at: string
          signer_name: string | null
          signer_user_id: string
          user_agent: string | null
        }
        Insert: {
          acted_by_name?: string | null
          acted_by_user_id: string
          document_id?: string | null
          document_title?: string | null
          document_type?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          patient_id?: string | null
          patient_name_snapshot?: string | null
          prev_hash?: string | null
          result?: string
          row_hash?: string | null
          signed_at?: string
          signer_name?: string | null
          signer_user_id: string
          user_agent?: string | null
        }
        Update: {
          acted_by_name?: string | null
          acted_by_user_id?: string
          document_id?: string | null
          document_title?: string | null
          document_type?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string | null
          patient_id?: string | null
          patient_name_snapshot?: string | null
          prev_hash?: string | null
          result?: string
          row_hash?: string | null
          signed_at?: string
          signer_name?: string | null
          signer_user_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      signature_verifications: {
        Row: {
          created_at: string
          document_id: string
          document_title: string
          document_type: string | null
          id: string
          patient_name_snapshot: string | null
          pdf_sha256: string | null
          revoked_at: string | null
          signed_at: string
          signer_crm: string | null
          signer_name: string
          signer_specialty: string | null
          signer_user_id: string
          subject_cn: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          document_id: string
          document_title: string
          document_type?: string | null
          id?: string
          patient_name_snapshot?: string | null
          pdf_sha256?: string | null
          revoked_at?: string | null
          signed_at?: string
          signer_crm?: string | null
          signer_name: string
          signer_specialty?: string | null
          signer_user_id: string
          subject_cn?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string
          document_title?: string
          document_type?: string | null
          id?: string
          patient_name_snapshot?: string | null
          pdf_sha256?: string | null
          revoked_at?: string | null
          signed_at?: string
          signer_crm?: string | null
          signer_name?: string
          signer_specialty?: string | null
          signer_user_id?: string
          subject_cn?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_verifications_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "patient_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      signing_certificates: {
        Row: {
          created_at: string
          delegation_mode: string
          password_encrypted: string
          pfx_path: string
          pfx_sha256: string | null
          subject_cn: string | null
          updated_at: string
          user_id: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          delegation_mode?: string
          password_encrypted: string
          pfx_path: string
          pfx_sha256?: string | null
          subject_cn?: string | null
          updated_at?: string
          user_id: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          delegation_mode?: string
          password_encrypted?: string
          pfx_path?: string
          pfx_sha256?: string | null
          subject_cn?: string | null
          updated_at?: string
          user_id?: string
          valid_from?: string | null
          valid_to?: string | null
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
          preset: string | null
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
          preset?: string | null
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
          preset?: string | null
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
      authorize_document_signature: {
        Args: { _document_id: string }
        Returns: undefined
      }
      can_access_patient: { Args: { _patient_id: string }; Returns: boolean }
      count_recent_signatures: {
        Args: { _signer_user_id: string }
        Returns: number
      }
      current_concierge_name: { Args: never; Returns: string }
      current_surgeon_name: { Args: never; Returns: string }
      get_signing_certificate_meta: {
        Args: { _signer_user_id: string }
        Returns: {
          delegation_mode: string
          pfx_path: string
          pfx_sha256: string
          subject_cn: string
          valid_to: string
        }[]
      }
      get_signing_certificate_secret: {
        Args: { _master_key: string; _signer_user_id: string }
        Returns: {
          password: string
          pfx_path: string
        }[]
      }
      get_surgeon_cert_status: {
        Args: { _patient_id: string }
        Returns: {
          delegation_mode: string
          has_cert: boolean
          signer_user_id: string
          subject_cn: string
          surgeon_name: string
          valid_to: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_signature_audit: {
        Args: {
          _acted_by_name: string
          _acted_by_user_id: string
          _document_id: string
          _document_title: string
          _document_type: string
          _error: string
          _ip: string
          _patient_id: string
          _patient_name: string
          _result: string
          _signer_name: string
          _signer_user_id: string
          _ua: string
        }
        Returns: string
      }
      set_delegation_mode: { Args: { _mode: string }; Returns: undefined }
      set_signing_certificate:
        | {
            Args: {
              _master_key: string
              _password: string
              _pfx_path: string
              _subject_cn: string
              _user_id: string
              _valid_from: string
              _valid_to: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _master_key: string
              _password: string
              _pfx_path: string
              _pfx_sha256?: string
              _subject_cn: string
              _user_id: string
              _valid_from: string
              _valid_to: string
            }
            Returns: undefined
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
        | "prescription"
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
        "prescription",
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
