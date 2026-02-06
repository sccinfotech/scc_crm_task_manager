export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'admin' | 'manager' | 'staff' | 'client'
          module_permissions: Json | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: 'admin' | 'manager' | 'staff' | 'client'
          module_permissions?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'admin' | 'manager' | 'staff' | 'client'
          module_permissions?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      leads: {
        Row: {
          id: string
          name: string
          company_name: string | null
          phone: string
          source: string | null
          status: string
          follow_up_date: string | null
          notes: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          company_name?: string | null
          phone: string
          source?: string | null
          status: string
          follow_up_date?: string | null
          notes?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          company_name?: string | null
          phone?: string
          source?: string | null
          status?: string
          follow_up_date?: string | null
          notes?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      lead_followups: {
        Row: {
          id: string
          lead_id: string
          note: string | null
          follow_up_date: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          note?: string | null
          follow_up_date?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          note?: string | null
          follow_up_date?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      clients: {
        Row: {
          id: string
          name: string
          company_name: string | null
          phone: string
          email: string | null
          status: string
          remark: string | null
          lead_id: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          company_name?: string | null
          phone: string
          email?: string | null
          status?: string
          remark?: string | null
          lead_id?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          company_name?: string | null
          phone?: string
          email?: string | null
          status?: string
          remark?: string | null
          lead_id?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      client_followups: {
        Row: {
          id: string
          client_id: string
          note: string | null
          follow_up_date: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          note?: string | null
          follow_up_date?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          note?: string | null
          follow_up_date?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      client_internal_notes: {
        Row: {
          id: string
          client_id: string
          note_text: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          note_text?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          note_text?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      client_note_attachments: {
        Row: {
          id: string
          note_id: string
          client_id: string
          file_name: string
          mime_type: string
          size_bytes: number
          cloudinary_url: string
          cloudinary_public_id: string
          resource_type: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          note_id: string
          client_id: string
          file_name: string
          mime_type: string
          size_bytes: number
          cloudinary_url: string
          cloudinary_public_id: string
          resource_type?: string
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          note_id?: string
          client_id?: string
          file_name?: string
          mime_type?: string
          size_bytes?: number
          cloudinary_url?: string
          cloudinary_public_id?: string
          resource_type?: string
          created_by?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'admin' | 'manager' | 'staff' | 'client'
    }
  }
}

export type ModulePermission = {
  moduleId: string
  accessLevel: 'read' | 'write' | 'none'
}

