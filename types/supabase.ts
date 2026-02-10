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
      lead_client_followups: {
        Row: {
          id: string
          entity_type: string
          lead_id: string | null
          client_id: string | null
          note: string | null
          follow_up_date: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          entity_type: string
          lead_id?: string | null
          client_id?: string | null
          note?: string | null
          follow_up_date?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          entity_type?: string
          lead_id?: string | null
          client_id?: string | null
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
      projects: {
        Row: {
          id: string
          name: string
          logo_url: string | null
          client_id: string
          project_amount: string | null
          status: 'pending' | 'in_progress' | 'hold' | 'completed'
          staff_status: 'start' | 'hold' | 'end'
          priority: 'urgent' | 'high' | 'medium' | 'low'
          start_date: string
          developer_deadline_date: string | null
          client_deadline_date: string | null
          website_links: string | null
          reference_links: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          logo_url?: string | null
          client_id: string
          project_amount?: string | null
          status?: 'pending' | 'in_progress' | 'hold' | 'completed'
          staff_status?: 'start' | 'hold' | 'end'
          priority?: 'urgent' | 'high' | 'medium' | 'low'
          start_date: string
          developer_deadline_date?: string | null
          client_deadline_date?: string | null
          website_links?: string | null
          reference_links?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          logo_url?: string | null
          client_id?: string
          project_amount?: string | null
          status?: 'pending' | 'in_progress' | 'hold' | 'completed'
          staff_status?: 'start' | 'hold' | 'end'
          priority?: 'urgent' | 'high' | 'medium' | 'low'
          start_date?: string
          developer_deadline_date?: string | null
          client_deadline_date?: string | null
          website_links?: string | null
          reference_links?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      project_team_members: {
        Row: {
          project_id: string
          user_id: string
          created_by: string
          created_at: string
        }
        Insert: {
          project_id: string
          user_id: string
          created_by: string
          created_at?: string
        }
        Update: {
          project_id?: string
          user_id?: string
          created_by?: string
          created_at?: string
        }
      }
      technology_tools: {
        Row: {
          id: string
          name: string
          is_active: boolean
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          is_active?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          is_active?: boolean
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      project_technology_tools: {
        Row: {
          id: string
          project_id: string
          technology_tool_id: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          technology_tool_id: string
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          technology_tool_id?: string
          created_by?: string
          created_at?: string
        }
      }
      project_followups: {
        Row: {
          id: string
          project_id: string
          follow_up_date: string | null
          next_follow_up_date: string | null
          note: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          follow_up_date?: string | null
          next_follow_up_date?: string | null
          note?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          follow_up_date?: string | null
          next_follow_up_date?: string | null
          note?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      project_user_notes: {
        Row: {
          id: string
          project_id: string
          user_id: string
          note_text: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          note_text: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          note_text?: string
          created_at?: string
          updated_at?: string
        }
      }
      project_note_attachments: {
        Row: {
          id: string
          note_id: string
          project_id: string
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
          project_id: string
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
          project_id?: string
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
      project_team_talk_messages: {
        Row: {
          id: string
          project_id: string
          message_text: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          message_text?: string
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          message_text?: string
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      project_team_talk_attachments: {
        Row: {
          id: string
          message_id: string
          project_id: string
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
          message_id: string
          project_id: string
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
          message_id?: string
          project_id?: string
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
