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
      admin_credentials: {
        Row: {
          access_code: string
          admin_user_id: string
          created_at: string
          created_by: string | null
          id: string
          updated_at: string
          username: string
        }
        Insert: {
          access_code: string
          admin_user_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
          username: string
        }
        Update: {
          access_code?: string
          admin_user_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          created_at: string
          date: string
          id: string
          lesson_id: string
          marked_by: string | null
          note: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          lesson_id: string
          marked_by?: string | null
          note?: string | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          lesson_id?: string
          marked_by?: string | null
          note?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      banners: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          position: string
          sort_order: number
          title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          position?: string
          sort_order?: number
          title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          position?: string
          sort_order?: number
          title?: string | null
        }
        Relationships: []
      }
      behavior_evaluations: {
        Row: {
          comment: string | null
          created_at: string
          group_id: string | null
          id: string
          lesson_date: string
          rating: Database["public"]["Enums"]["behavior_rating"]
          student_id: string
          teacher_id: string
          telegram_sent: boolean
        }
        Insert: {
          comment?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          lesson_date?: string
          rating: Database["public"]["Enums"]["behavior_rating"]
          student_id: string
          teacher_id: string
          telegram_sent?: boolean
        }
        Update: {
          comment?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          lesson_date?: string
          rating?: Database["public"]["Enums"]["behavior_rating"]
          student_id?: string
          teacher_id?: string
          telegram_sent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "behavior_evaluations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behavior_evaluations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          answered_at: string | null
          called_at: string
          contact_id: string | null
          contact_type: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          direction: string
          duration_sec: number
          hangup_cause: string | null
          id: string
          notes: string | null
          phone: string
          recording_storage_path: string | null
          recording_url: string | null
          sip_call_id: string | null
          status: string
          trunk: string | null
          updated_at: string
        }
        Insert: {
          answered_at?: string | null
          called_at?: string
          contact_id?: string | null
          contact_type?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          direction: string
          duration_sec?: number
          hangup_cause?: string | null
          id?: string
          notes?: string | null
          phone: string
          recording_storage_path?: string | null
          recording_url?: string | null
          sip_call_id?: string | null
          status?: string
          trunk?: string | null
          updated_at?: string
        }
        Update: {
          answered_at?: string | null
          called_at?: string
          contact_id?: string | null
          contact_type?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          direction?: string
          duration_sec?: number
          hangup_cause?: string | null
          id?: string
          notes?: string | null
          phone?: string
          recording_storage_path?: string | null
          recording_url?: string | null
          sip_call_id?: string | null
          status?: string
          trunk?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cash_accounts: {
        Row: {
          balance: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          note: string | null
          type: Database["public"]["Enums"]["cash_account_type"]
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          note?: string | null
          type?: Database["public"]["Enums"]["cash_account_type"]
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          note?: string | null
          type?: Database["public"]["Enums"]["cash_account_type"]
          updated_at?: string
        }
        Relationships: []
      }
      cash_register_settings: {
        Row: {
          branch_address: string | null
          branch_id: string | null
          cashbox_id: string | null
          company_name: string
          company_tin: string | null
          created_at: string
          enabled: boolean
          id: string
          printer_type: string
          provider_name: string
          test_mode: boolean
          updated_at: string
          vat_enabled: boolean
          vat_percent: number
        }
        Insert: {
          branch_address?: string | null
          branch_id?: string | null
          cashbox_id?: string | null
          company_name?: string
          company_tin?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          printer_type?: string
          provider_name?: string
          test_mode?: boolean
          updated_at?: string
          vat_enabled?: boolean
          vat_percent?: number
        }
        Update: {
          branch_address?: string | null
          branch_id?: string | null
          cashbox_id?: string | null
          company_name?: string
          company_tin?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          printer_type?: string
          provider_name?: string
          test_mode?: boolean
          updated_at?: string
          vat_enabled?: boolean
          vat_percent?: number
        }
        Relationships: []
      }
      design_settings: {
        Row: {
          animated_bg_url: string | null
          animation_enabled: boolean
          hero_image_url: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          main_headline: string | null
          main_subheadline: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string
        }
        Insert: {
          animated_bg_url?: string | null
          animation_enabled?: boolean
          hero_image_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          main_headline?: string | null
          main_subheadline?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
        }
        Update: {
          animated_bg_url?: string | null
          animation_enabled?: boolean
          hero_image_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          main_headline?: string | null
          main_subheadline?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      director_credentials: {
        Row: {
          access_code: string
          created_at: string
          director_user_id: string
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          access_code: string
          created_at?: string
          director_user_id: string
          email: string
          id?: string
          updated_at?: string
        }
        Update: {
          access_code?: string
          created_at?: string
          director_user_id?: string
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      director_daily_reports: {
        Row: {
          ai_summary: string | null
          attendance_rate: number
          created_at: string
          debtors_amount: number
          debtors_count: number
          expenses: number
          id: string
          new_leads: number
          new_students: number
          payload: Json
          profit: number
          report_date: string
          revenue: number
          sent_at: string | null
          top_teachers: Json
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          attendance_rate?: number
          created_at?: string
          debtors_amount?: number
          debtors_count?: number
          expenses?: number
          id?: string
          new_leads?: number
          new_students?: number
          payload?: Json
          profit?: number
          report_date: string
          revenue?: number
          sent_at?: string | null
          top_teachers?: Json
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          attendance_rate?: number
          created_at?: string
          debtors_amount?: number
          debtors_count?: number
          expenses?: number
          id?: string
          new_leads?: number
          new_students?: number
          payload?: Json
          profit?: number
          report_date?: string
          revenue?: number
          sent_at?: string | null
          top_teachers?: Json
          updated_at?: string
        }
        Relationships: []
      }
      director_report_recipients: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          telegram_chat_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          telegram_chat_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          telegram_chat_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          cash_account_id: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          paid_at: string
          receipt_url: string | null
          recurring: string
          updated_at: string
        }
        Insert: {
          amount: number
          cash_account_id?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          paid_at?: string
          receipt_url?: string | null
          recurring?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cash_account_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          paid_at?: string
          receipt_url?: string | null
          recurring?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_cash_account_id_fkey"
            columns: ["cash_account_id"]
            isOneToOne: false
            referencedRelation: "cash_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_receipts: {
        Row: {
          cashbox_id: string | null
          cashier_name: string | null
          company_tin: string | null
          created_at: string
          fiscal_qr_data: string | null
          fiscal_sign: string | null
          id: string
          payment_id: string
          provider_name: string
          provider_transaction_id: string | null
          raw_response: Json
          receipt_number: string | null
          receipt_url: string | null
          status: string
          test_mode: boolean
        }
        Insert: {
          cashbox_id?: string | null
          cashier_name?: string | null
          company_tin?: string | null
          created_at?: string
          fiscal_qr_data?: string | null
          fiscal_sign?: string | null
          id?: string
          payment_id: string
          provider_name: string
          provider_transaction_id?: string | null
          raw_response?: Json
          receipt_number?: string | null
          receipt_url?: string | null
          status?: string
          test_mode?: boolean
        }
        Update: {
          cashbox_id?: string | null
          cashier_name?: string | null
          company_tin?: string | null
          created_at?: string
          fiscal_qr_data?: string | null
          fiscal_sign?: string | null
          id?: string
          payment_id?: string
          provider_name?: string
          provider_transaction_id?: string | null
          raw_response?: Json
          receipt_number?: string | null
          receipt_url?: string | null
          status?: string
          test_mode?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          comment: string | null
          created_at: string
          graded_at: string
          id: string
          kind: string
          lesson_id: string | null
          max_score: number
          score: number
          student_id: string
          subject_id: string | null
          teacher_user_id: string | null
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          graded_at?: string
          id?: string
          kind?: string
          lesson_id?: string | null
          max_score?: number
          score: number
          student_id: string
          subject_id?: string | null
          teacher_user_id?: string | null
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          graded_at?: string
          id?: string
          kind?: string
          lesson_id?: string | null
          max_score?: number
          score?: number
          student_id?: string
          subject_id?: string | null
          teacher_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          monthly_fee: number
          name: string
          schedule: string | null
          subject_id: string | null
          teacher_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          monthly_fee?: number
          name: string
          schedule?: string | null
          subject_id?: string | null
          teacher_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          monthly_fee?: number
          name?: string
          schedule?: string | null
          subject_id?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      homepage_courses: {
        Row: {
          created_at: string
          description: string
          id: string
          is_visible: boolean
          level: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_visible?: boolean
          level?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_visible?: boolean
          level?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      homepage_sections: {
        Row: {
          content: Json
          id: string
          is_visible: boolean
          section_key: string
          sort_order: number
          title: string | null
          updated_at: string
        }
        Insert: {
          content?: Json
          id?: string
          is_visible?: boolean
          section_key: string
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          content?: Json
          id?: string
          is_visible?: boolean
          section_key?: string
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          academic_year: string | null
          created_at: string
          created_by: string | null
          details: Json
          duplicates: number
          errors: number
          file_name: string | null
          group_id: string | null
          id: string
          inserted: number
          kind: string
          total: number
          undone_at: string | null
          updated: number
          updated_at: string
          warnings: number
        }
        Insert: {
          academic_year?: string | null
          created_at?: string
          created_by?: string | null
          details?: Json
          duplicates?: number
          errors?: number
          file_name?: string | null
          group_id?: string | null
          id?: string
          inserted?: number
          kind?: string
          total?: number
          undone_at?: string | null
          updated?: number
          updated_at?: string
          warnings?: number
        }
        Update: {
          academic_year?: string | null
          created_at?: string
          created_by?: string | null
          details?: Json
          duplicates?: number
          errors?: number
          file_name?: string | null
          group_id?: string | null
          id?: string
          inserted?: number
          kind?: string
          total?: number
          undone_at?: string | null
          updated?: number
          updated_at?: string
          warnings?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      jarvis_github_requests: {
        Row: {
          actor_user_id: string | null
          created_at: string
          error: string | null
          github_external_id: string | null
          github_issue_number: number | null
          github_url: string | null
          id: string
          repository: string
          request_text: string
          status: string
          updated_at: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          error?: string | null
          github_external_id?: string | null
          github_issue_number?: number | null
          github_url?: string | null
          id?: string
          repository: string
          request_text: string
          status?: string
          updated_at?: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          error?: string | null
          github_external_id?: string | null
          github_issue_number?: number | null
          github_url?: string | null
          id?: string
          repository?: string
          request_text?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          course: string | null
          created_at: string
          id: string
          name: string
          note: string | null
          phone: string
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          course?: string | null
          created_at?: string
          id?: string
          name: string
          note?: string | null
          phone: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          course?: string | null
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          phone?: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      lessons: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          group_id: string
          id: string
          is_active: boolean
          notes: string | null
          room_id: string | null
          start_time: string
          subject_id: string | null
          teacher_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          group_id: string
          id?: string
          is_active?: boolean
          notes?: string | null
          room_id?: string | null
          start_time: string
          subject_id?: string | null
          teacher_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          group_id?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          room_id?: string | null
          start_time?: string
          subject_id?: string | null
          teacher_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      marketplace_orders: {
        Row: {
          created_at: string
          id: string
          note: string | null
          ordered_by: string | null
          product_id: string
          quantity: number
          status: string
          student_id: string | null
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          ordered_by?: string | null
          product_id: string
          quantity?: number
          status?: string
          student_id?: string | null
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          ordered_by?: string | null
          product_id?: string
          quantity?: number
          status?: string
          student_id?: string | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          price: number
          product_type: string | null
          stock: number | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          price?: number
          product_type?: string | null
          stock?: number | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          price?: number
          product_type?: string | null
          stock?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "marketplace_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          is_published: boolean
          published_at: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          published_at?: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          published_at?: string
          title?: string
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          message_text: string
          payment_id: string | null
          receipt_url: string | null
          recipient_type: string
          sent_at: string | null
          status: string
          telegram_chat_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          message_text: string
          payment_id?: string | null
          receipt_url?: string | null
          recipient_type?: string
          sent_at?: string | null
          status?: string
          telegram_chat_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          message_text?: string
          payment_id?: string | null
          receipt_url?: string | null
          recipient_type?: string
          sent_at?: string | null
          status?: string
          telegram_chat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_link_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          student_id: string
          token: string
          used_at: string | null
          used_by_chat_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          student_id: string
          token: string
          used_at?: string | null
          used_by_chat_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          student_id?: string
          token?: string
          used_at?: string | null
          used_by_chat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_link_tokens_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_notifications: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          error: string | null
          id: string
          kind: string
          payload: Json
          processing_started_at: string | null
          sent_at: string | null
          status: string
          student_id: string
        }
        Insert: {
          attempts?: number
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          payload?: Json
          processing_started_at?: string | null
          sent_at?: string | null
          status?: string
          student_id: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          payload?: Json
          processing_started_at?: string | null
          sent_at?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_teacher_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          parent_chat_id: string | null
          read_at: string | null
          sender_role: string
          status: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          parent_chat_id?: string | null
          read_at?: string | null
          sender_role: string
          status?: string
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          parent_chat_id?: string | null
          read_at?: string | null
          sender_role?: string
          status?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_teacher_messages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          payment_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          payment_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          payment_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_audit_log_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_notifications: {
        Row: {
          due_date: string | null
          error: string | null
          id: string
          notification_type: string
          parent_chat_id: string | null
          payload: Json | null
          period_month: string
          sent_at: string
          status: string
          student_id: string
        }
        Insert: {
          due_date?: string | null
          error?: string | null
          id?: string
          notification_type: string
          parent_chat_id?: string | null
          payload?: Json | null
          period_month: string
          sent_at?: string
          status?: string
          student_id: string
        }
        Update: {
          due_date?: string | null
          error?: string | null
          id?: string
          notification_type?: string
          parent_chat_id?: string | null
          payload?: Json | null
          period_month?: string
          sent_at?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          branch_id: string | null
          cash_account_id: string | null
          cashier_id: string | null
          course_id: string | null
          created_at: string
          discount_amount: number
          discount_reason: string | null
          fiscal_status: string
          fiscalized_at: string | null
          id: string
          idempotency_key: string | null
          next_due_date: string | null
          note: string | null
          paid_at: string | null
          payment_method: string
          period_month: string
          status: string
          student_id: string
          subtotal: number
          total_amount: number
        }
        Insert: {
          amount: number
          branch_id?: string | null
          cash_account_id?: string | null
          cashier_id?: string | null
          course_id?: string | null
          created_at?: string
          discount_amount?: number
          discount_reason?: string | null
          fiscal_status?: string
          fiscalized_at?: string | null
          id?: string
          idempotency_key?: string | null
          next_due_date?: string | null
          note?: string | null
          paid_at?: string | null
          payment_method?: string
          period_month: string
          status?: string
          student_id: string
          subtotal?: number
          total_amount?: number
        }
        Update: {
          amount?: number
          branch_id?: string | null
          cash_account_id?: string | null
          cashier_id?: string | null
          course_id?: string | null
          created_at?: string
          discount_amount?: number
          discount_reason?: string | null
          fiscal_status?: string
          fiscalized_at?: string | null
          id?: string
          idempotency_key?: string | null
          next_due_date?: string | null
          note?: string | null
          paid_at?: string | null
          payment_method?: string
          period_month?: string
          status?: string
          student_id?: string
          subtotal?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_cash_account_id_fkey"
            columns: ["cash_account_id"]
            isOneToOne: false
            referencedRelation: "cash_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          teacher_level: Database["public"]["Enums"]["teacher_level"] | null
          telegram_chat_id: string | null
          telegram_last_checked_at: string | null
          telegram_last_error: string | null
          telegram_username: string | null
          telegram_verified_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          teacher_level?: Database["public"]["Enums"]["teacher_level"] | null
          telegram_chat_id?: string | null
          telegram_last_checked_at?: string | null
          telegram_last_error?: string | null
          telegram_username?: string | null
          telegram_verified_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          teacher_level?: Database["public"]["Enums"]["teacher_level"] | null
          telegram_chat_id?: string | null
          telegram_last_checked_at?: string | null
          telegram_last_error?: string | null
          telegram_username?: string | null
          telegram_verified_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          capacity: number
          created_at: string
          floor: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          floor?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          floor?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          is_public: boolean
          key: string
          scope: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          is_public?: boolean
          key: string
          scope?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          is_public?: boolean
          key?: string
          scope?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      sip_config: {
        Row: {
          api_base_url: string | null
          auth_id: string | null
          caller_id: string | null
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          provider: string
          singleton: boolean
          sip_uri: string | null
          updated_at: string
          username: string | null
          webhook_secret: string | null
        }
        Insert: {
          api_base_url?: string | null
          auth_id?: string | null
          caller_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          provider?: string
          singleton?: boolean
          sip_uri?: string | null
          updated_at?: string
          username?: string | null
          webhook_secret?: string | null
        }
        Update: {
          api_base_url?: string | null
          auth_id?: string | null
          caller_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          provider?: string
          singleton?: boolean
          sip_uri?: string | null
          updated_at?: string
          username?: string | null
          webhook_secret?: string | null
        }
        Relationships: []
      }
      sip_extensions: {
        Row: {
          created_at: string
          display_name: string | null
          extension: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          extension: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          extension?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_telegram_links: {
        Row: {
          created_at: string
          full_name: string | null
          notifications_enabled: boolean
          role: string
          telegram_chat_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          notifications_enabled?: boolean
          role: string
          telegram_chat_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          notifications_enabled?: boolean
          role?: string
          telegram_chat_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      student_credentials: {
        Row: {
          access_code: string
          auth_user_id: string | null
          created_at: string
          created_by: string | null
          id: string
          student_id: string
          updated_at: string
          username: string
        }
        Insert: {
          access_code: string
          auth_user_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          student_id: string
          updated_at?: string
          username: string
        }
        Update: {
          access_code?: string
          auth_user_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          student_id?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_credentials_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_enrollments: {
        Row: {
          created_at: string
          ended_at: string | null
          group_id: string
          id: string
          monthly_fee: number | null
          notes: string | null
          started_at: string
          status: string
          student_id: string
          subject_id: string | null
          teacher_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          group_id: string
          id?: string
          monthly_fee?: number | null
          notes?: string | null
          started_at?: string
          status?: string
          student_id: string
          subject_id?: string | null
          teacher_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          group_id?: string
          id?: string
          monthly_fee?: number | null
          notes?: string | null
          started_at?: string
          status?: string
          student_id?: string
          subject_id?: string | null
          teacher_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      student_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["student_status"] | null
          id: string
          reason: string | null
          student_id: string
          to_status: Database["public"]["Enums"]["student_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["student_status"] | null
          id?: string
          reason?: string | null
          student_id: string
          to_status: Database["public"]["Enums"]["student_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["student_status"] | null
          id?: string
          reason?: string | null
          student_id?: string
          to_status?: Database["public"]["Enums"]["student_status"]
        }
        Relationships: [
          {
            foreignKeyName: "student_status_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          academic_year: string | null
          birth_date: string | null
          enrolled_at: string
          first_name: string | null
          full_name: string | null
          group_id: string | null
          id: string
          import_batch_id: string | null
          last_name: string | null
          lesson_time: string | null
          monthly_fee: number | null
          notes: string | null
          parent_full_name: string | null
          parent_notifications_enabled: boolean
          parent_phone: string | null
          parent_phones: string[]
          parent_telegram_chat_id: string | null
          profile_id: string | null
          schedule_raw: string | null
          schedule_type: string | null
          start_date: string | null
          status: string
          status_enum: Database["public"]["Enums"]["student_status"]
          telegram_chat_id: string | null
          telegram_last_checked_at: string | null
          telegram_last_error: string | null
          telegram_username: string | null
          telegram_verified_at: string | null
        }
        Insert: {
          academic_year?: string | null
          birth_date?: string | null
          enrolled_at?: string
          first_name?: string | null
          full_name?: string | null
          group_id?: string | null
          id?: string
          import_batch_id?: string | null
          last_name?: string | null
          lesson_time?: string | null
          monthly_fee?: number | null
          notes?: string | null
          parent_full_name?: string | null
          parent_notifications_enabled?: boolean
          parent_phone?: string | null
          parent_phones?: string[]
          parent_telegram_chat_id?: string | null
          profile_id?: string | null
          schedule_raw?: string | null
          schedule_type?: string | null
          start_date?: string | null
          status?: string
          status_enum?: Database["public"]["Enums"]["student_status"]
          telegram_chat_id?: string | null
          telegram_last_checked_at?: string | null
          telegram_last_error?: string | null
          telegram_username?: string | null
          telegram_verified_at?: string | null
        }
        Update: {
          academic_year?: string | null
          birth_date?: string | null
          enrolled_at?: string
          first_name?: string | null
          full_name?: string | null
          group_id?: string | null
          id?: string
          import_batch_id?: string | null
          last_name?: string | null
          lesson_time?: string | null
          monthly_fee?: number | null
          notes?: string | null
          parent_full_name?: string | null
          parent_notifications_enabled?: boolean
          parent_phone?: string | null
          parent_phones?: string[]
          parent_telegram_chat_id?: string | null
          profile_id?: string | null
          schedule_raw?: string | null
          schedule_type?: string | null
          start_date?: string | null
          status?: string
          status_enum?: Database["public"]["Enums"]["student_status"]
          telegram_chat_id?: string | null
          telegram_last_checked_at?: string | null
          telegram_last_error?: string | null
          telegram_username?: string | null
          telegram_verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      teacher_balance: {
        Row: {
          bonus: number
          created_at: string
          id: string
          kpi_score: number
          note: string | null
          penalty: number
          percent: number
          percent_earning: number
          period_month: string
          revenue_base: number
          salary: number
          teacher_user_id: string
          updated_at: string
          visible_to_teacher: boolean
        }
        Insert: {
          bonus?: number
          created_at?: string
          id?: string
          kpi_score?: number
          note?: string | null
          penalty?: number
          percent?: number
          percent_earning?: number
          period_month: string
          revenue_base?: number
          salary?: number
          teacher_user_id: string
          updated_at?: string
          visible_to_teacher?: boolean
        }
        Update: {
          bonus?: number
          created_at?: string
          id?: string
          kpi_score?: number
          note?: string | null
          penalty?: number
          percent?: number
          percent_earning?: number
          period_month?: string
          revenue_base?: number
          salary?: number
          teacher_user_id?: string
          updated_at?: string
          visible_to_teacher?: boolean
        }
        Relationships: []
      }
      teacher_checkins: {
        Row: {
          checked_in_at: string
          created_at: string
          id: string
          lesson_id: string | null
          method: string
          photo_url: string | null
          user_id: string
        }
        Insert: {
          checked_in_at?: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          method?: string
          photo_url?: string | null
          user_id: string
        }
        Update: {
          checked_in_at?: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          method?: string
          photo_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_checkins_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_credentials: {
        Row: {
          access_code: string
          created_at: string
          created_by: string | null
          id: string
          teacher_user_id: string
          updated_at: string
          username: string
        }
        Insert: {
          access_code: string
          created_at?: string
          created_by?: string | null
          id?: string
          teacher_user_id: string
          updated_at?: string
          username: string
        }
        Update: {
          access_code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          teacher_user_id?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      teacher_face_enrollments: {
        Row: {
          created_at: string
          descriptor: Json | null
          id: string
          image_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descriptor?: Json | null
          id?: string
          image_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          descriptor?: Json | null
          id?: string
          image_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      teacher_salary_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          paid_at: string
          teacher_user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          paid_at?: string
          teacher_user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          paid_at?: string
          teacher_user_id?: string
        }
        Relationships: []
      }
      teacher_ui_settings: {
        Row: {
          announcements: Json
          attendance_rules: Json
          background_url: string | null
          banner_url: string | null
          dashboard_cards: Json
          enabled_modules: Json
          id: string
          kpi_visible: boolean
          menu_items: Json
          updated_at: string
        }
        Insert: {
          announcements?: Json
          attendance_rules?: Json
          background_url?: string | null
          banner_url?: string | null
          dashboard_cards?: Json
          enabled_modules?: Json
          id?: string
          kpi_visible?: boolean
          menu_items?: Json
          updated_at?: string
        }
        Update: {
          announcements?: Json
          attendance_rules?: Json
          background_url?: string | null
          banner_url?: string | null
          dashboard_cards?: Json
          enabled_modules?: Json
          id?: string
          kpi_visible?: boolean
          menu_items?: Json
          updated_at?: string
        }
        Relationships: []
      }
      telegram_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          chat_id: string | null
          created_at: string
          error: string | null
          id: string
          subject_id: string
          subject_kind: string
          success: boolean
        }
        Insert: {
          action: string
          actor_id?: string | null
          chat_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          subject_id: string
          subject_kind: string
          success?: boolean
        }
        Update: {
          action?: string
          actor_id?: string | null
          chat_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          subject_id?: string
          subject_kind?: string
          success?: boolean
        }
        Relationships: []
      }
      telegram_link_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          kind: string
          label: string | null
          student_id: string | null
          token: string
          used_at: string | null
          used_by_chat_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          kind: string
          label?: string | null
          student_id?: string | null
          token: string
          used_at?: string | null
          used_by_chat_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          kind?: string
          label?: string | null
          student_id?: string | null
          token?: string
          used_at?: string | null
          used_by_chat_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_link_tokens_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_updates: {
        Row: {
          chat_id: string | null
          created_at: string
          error: string | null
          finished_at: string | null
          status: string
          update_id: number
          update_kind: string | null
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          status?: string
          update_id: number
          update_kind?: string | null
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          status?: string
          update_id?: number
          update_kind?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          cash_account_id: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          expense_id: string | null
          id: string
          occurred_at: string
          order_id: string | null
          payment_id: string | null
          source: Database["public"]["Enums"]["tx_source"]
          student_id: string | null
          type: Database["public"]["Enums"]["tx_type"]
        }
        Insert: {
          amount: number
          cash_account_id?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_id?: string | null
          id?: string
          occurred_at?: string
          order_id?: string | null
          payment_id?: string | null
          source?: Database["public"]["Enums"]["tx_source"]
          student_id?: string | null
          type: Database["public"]["Enums"]["tx_type"]
        }
        Update: {
          amount?: number
          cash_account_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_id?: string | null
          id?: string
          occurred_at?: string
          order_id?: string | null
          payment_id?: string | null
          source?: Database["public"]["Enums"]["tx_source"]
          student_id?: string | null
          type?: Database["public"]["Enums"]["tx_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_cash_account_id_fkey"
            columns: ["cash_account_id"]
            isOneToOne: false
            referencedRelation: "cash_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
      [_ in never]: never
    }
    Functions: {
      admin_desk_metrics: {
        Args: never
        Returns: {
          active_students: number
          debt_total: number
          debtors: number
          paid_this_month: number
          total_students: number
        }[]
      }
      claim_telegram_update: {
        Args: { p_chat_id: string; p_update_id: number; p_update_kind: string }
        Returns: boolean
      }
      finish_telegram_update: {
        Args: { p_error: string; p_success: boolean; p_update_id: number }
        Returns: undefined
      }
      schedule_insights: {
        Args: { p_since: string }
        Returns: {
          attendance_ok: number
          attendance_total: number
          enrolled_students: number
          group_id: string
          lesson_id: string
        }[]
      }
      schedule_week_attendance: {
        Args: { p_week_start: string }
        Returns: {
          attendance_count: number
          attendance_date: string
          lesson_id: string
        }[]
      }
      teachers_for_student: {
        Args: { _student_id: string }
        Returns: {
          group_name: string
          subject_name: string
          teacher_id: string
        }[]
      }
      telegram_center_report: {
        Args: never
        Returns: {
          active_students: number
          debt_total: number
          debtors: number
          groups_count: number
        }[]
      }
      telegram_students_by_parent_phone: {
        Args: { p_phone: string }
        Returns: {
          first_name: string
          full_name: string
          id: string
          last_name: string
          parent_phone: string
          parent_phones: string[]
          parent_telegram_chat_id: string
        }[]
      }
    }
    Enums: {
      app_role: "director" | "admin" | "teacher" | "student"
      behavior_rating: "qoniqarsiz" | "qoniqarli" | "yaxshi" | "alo"
      cash_account_type: "cash" | "card" | "bank" | "online" | "other"
      student_status: "trial" | "active" | "frozen" | "archived" | "left"
      teacher_level: "junior" | "middle" | "senior" | "lead"
      tx_source:
        | "payment"
        | "marketplace"
        | "expense"
        | "salary"
        | "manual"
        | "adjustment"
      tx_type: "income" | "expense"
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
      app_role: ["director", "admin", "teacher", "student"],
      behavior_rating: ["qoniqarsiz", "qoniqarli", "yaxshi", "alo"],
      cash_account_type: ["cash", "card", "bank", "online", "other"],
      student_status: ["trial", "active", "frozen", "archived", "left"],
      teacher_level: ["junior", "middle", "senior", "lead"],
      tx_source: [
        "payment",
        "marketplace",
        "expense",
        "salary",
        "manual",
        "adjustment",
      ],
      tx_type: ["income", "expense"],
    },
  },
} as const
