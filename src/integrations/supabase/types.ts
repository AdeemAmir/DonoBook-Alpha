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
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      books: {
        Row: {
          category: Database["public"]["Enums"]["book_category"]
          condition: Database["public"]["Enums"]["book_condition"]
          created_at: string
          description: string | null
          grade: string | null
          handover_confirmed: boolean | null
          id: string
          image_url: string | null
          is_available: boolean
          owner_id: string
          receiver_id: string | null
          status: string | null
          title: string
          type: Database["public"]["Enums"]["book_type"]
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["book_category"]
          condition: Database["public"]["Enums"]["book_condition"]
          created_at?: string
          description?: string | null
          grade?: string | null
          handover_confirmed?: boolean | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          owner_id: string
          receiver_id?: string | null
          status?: string | null
          title: string
          type: Database["public"]["Enums"]["book_type"]
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["book_category"]
          condition?: Database["public"]["Enums"]["book_condition"]
          created_at?: string
          description?: string | null
          grade?: string | null
          handover_confirmed?: boolean | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          owner_id?: string
          receiver_id?: string | null
          status?: string | null
          title?: string
          type?: Database["public"]["Enums"]["book_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      complaints: {
        Row: {
          admin_response: string | null
          created_at: string | null
          description: string
          id: string
          status: string | null
          subject: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          admin_response?: string | null
          created_at?: string | null
          description: string
          id?: string
          status?: string | null
          subject: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          admin_response?: string | null
          created_at?: string | null
          description?: string
          id?: string
          status?: string | null
          subject?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaints_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: Database["public"]["Enums"]["item_category"]
          condition: Database["public"]["Enums"]["book_condition"]
          created_at: string
          description: string | null
          handover_confirmed: boolean | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          owner_id: string
          receiver_id: string | null
          status: string | null
          type: Database["public"]["Enums"]["item_type"]
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["item_category"]
          condition: Database["public"]["Enums"]["book_condition"]
          created_at?: string
          description?: string | null
          handover_confirmed?: boolean | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          owner_id: string
          receiver_id?: string | null
          status?: string | null
          type: Database["public"]["Enums"]["item_type"]
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["item_category"]
          condition?: Database["public"]["Enums"]["book_condition"]
          created_at?: string
          description?: string | null
          handover_confirmed?: boolean | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          owner_id?: string
          receiver_id?: string | null
          status?: string | null
          type?: Database["public"]["Enums"]["item_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          business_id: string | null
          contact_number: string | null
          created_at: string
          id: string
          name: string
          organization_name: string | null
          user_type: Database["public"]["Enums"]["user_type"]
          verified: boolean | null
        }
        Insert: {
          address?: string | null
          business_id?: string | null
          contact_number?: string | null
          created_at?: string
          id: string
          name: string
          organization_name?: string | null
          user_type?: Database["public"]["Enums"]["user_type"]
          verified?: boolean | null
        }
        Update: {
          address?: string | null
          business_id?: string | null
          contact_number?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_name?: string | null
          user_type?: Database["public"]["Enums"]["user_type"]
          verified?: boolean | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          book_id: string | null
          comment: string | null
          created_at: string
          id: string
          item_id: string | null
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Insert: {
          book_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Update: {
          book_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_books: {
        Row: {
          book_id: string
          transaction_id: string
        }
        Insert: {
          book_id: string
          transaction_id: string
        }
        Update: {
          book_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_books_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_books_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_items: {
        Row: {
          item_id: string
          transaction_id: string
        }
        Insert: {
          item_id: string
          transaction_id: string
        }
        Update: {
          item_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          created_at: string | null
          id: string
          receiver_id: string
          resolved_at: string | null
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          receiver_id: string
          resolved_at?: string | null
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          receiver_id?: string
          resolved_at?: string | null
          sender_id?: string
          status?: string
        }
        Relationships: []
      }
      user_messages: {
        Row: {
          created_at: string | null
          edit_history: Json | null
          edited_at: string | null
          id: string
          read: boolean
          receiver_id: string
          sender_id: string
          text: string
          transaction_id: string | null
        }
        Insert: {
          created_at?: string | null
          edit_history?: Json | null
          edited_at?: string | null
          id?: string
          read?: boolean
          receiver_id: string
          sender_id: string
          text: string
          transaction_id?: string | null
        }
        Update: {
          created_at?: string | null
          edit_history?: Json | null
          edited_at?: string | null
          id?: string
          read?: boolean
          receiver_id?: string
          sender_id?: string
          text?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_messages_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey1"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      welfare_verifications: {
        Row: {
          business_id: string
          contact_number: string
          created_at: string | null
          id: string
          organization_address: string
          organization_name: string
          proof_image_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          business_id: string
          contact_number: string
          created_at?: string | null
          id?: string
          organization_address: string
          organization_name: string
          proof_image_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          business_id?: string
          contact_number?: string
          created_at?: string | null
          id?: string
          organization_address?: string
          organization_name?: string
          proof_image_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookstore_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      app_role: "admin" | "user"
      book_category: "textbook" | "story_book"
      book_condition: "new" | "used"
      book_type: "donate" | "exchange" | "sell"
      item_category:
        | "bag"
        | "water_bottle"
        | "pencil_box"
        | "lunchbox"
        | "stationery"
        | "other"
      item_type: "donate" | "exchange"
      user_type: "user" | "bookstore" | "welfare"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user"],
      book_category: ["textbook", "story_book"],
      book_condition: ["new", "used"],
      book_type: ["donate", "exchange", "sell"],
      item_category: [
        "bag",
        "water_bottle",
        "pencil_box",
        "lunchbox",
        "stationery",
        "other",
      ],
      item_type: ["donate", "exchange"],
      user_type: ["user", "bookstore", "welfare"],
    },
  },
} as const
