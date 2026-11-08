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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      _backup_movements_20261028: {
        Row: {
          created_at: string | null
          id: string | null
          product_id: string | null
          quantity: number | null
          reason: string | null
          type: Database["public"]["Enums"]["stock_movement_type"] | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          product_id?: string | null
          quantity?: number | null
          reason?: string | null
          type?: Database["public"]["Enums"]["stock_movement_type"] | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          product_id?: string | null
          quantity?: number | null
          reason?: string | null
          type?: Database["public"]["Enums"]["stock_movement_type"] | null
          user_id?: string | null
        }
        Relationships: []
      }
      _backup_products_20261028: {
        Row: {
          active: boolean | null
          category_id: string | null
          cost: number | null
          created_at: string | null
          description: string | null
          id: string | null
          image_url: string | null
          min_stock: number | null
          name: string | null
          price: number | null
          slug: string | null
          stock: number | null
          supplier: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          category_id?: string | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image_url?: string | null
          min_stock?: number | null
          name?: string | null
          price?: number | null
          slug?: string | null
          stock?: number | null
          supplier?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          category_id?: string | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image_url?: string | null
          min_stock?: number | null
          name?: string | null
          price?: number | null
          slug?: string | null
          stock?: number | null
          supplier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      banners: {
        Row: {
          active: boolean
          created_at: string
          id: string
          image_url: string
          link: string
          sort: number
          subtitle: string
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          image_url?: string
          link?: string
          sort?: number
          subtitle?: string
          title?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          image_url?: string
          link?: string
          sort?: number
          subtitle?: string
          title?: string
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          address: string
          email: string
          hours: string
          id: number
          instagram: string
          name: string
          tiktok: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          address?: string
          email?: string
          hours?: string
          id?: number
          instagram?: string
          name?: string
          tiktok?: string
          updated_at?: string
          whatsapp?: string
        }
        Update: {
          address?: string
          email?: string
          hours?: string
          id?: number
          instagram?: string
          name?: string
          tiktok?: string
          updated_at?: string
          whatsapp?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          sort: number
        }
        Insert: {
          id?: string
          name: string
          slug: string
          sort?: number
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          sort?: number
        }
        Relationships: []
      }
      combo_items: {
        Row: {
          combo_id: string
          component_id: string
          quantity: number
        }
        Insert: {
          combo_id: string
          component_id: string
          quantity: number
        }
        Update: {
          combo_id?: string
          component_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "combo_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "products_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_items_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_items_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "products_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          date: string
          description: string
          id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          id?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          channel: string
          confirmed_at: string | null
          cost_total: number
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivery_address: Json
          delivery_method: string
          edited_at: string | null
          event_date: string | null
          id: string
          items: Json
          notes: string
          number: number
          status: Database["public"]["Enums"]["order_status"]
          total: number
        }
        Insert: {
          channel?: string
          confirmed_at?: string | null
          cost_total?: number
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivery_address?: Json
          delivery_method?: string
          edited_at?: string | null
          event_date?: string | null
          id?: string
          items?: Json
          notes?: string
          number?: number
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
        }
        Update: {
          channel?: string
          confirmed_at?: string | null
          cost_total?: number
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivery_address?: Json
          delivery_method?: string
          edited_at?: string | null
          event_date?: string | null
          id?: string
          items?: Json
          notes?: string
          number?: number
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
        }
        Relationships: []
      }
      price_history: {
        Row: {
          batch_id: string | null
          changed_at: string
          changed_by: string | null
          id: string
          new_cost: number | null
          new_price: number | null
          old_cost: number | null
          old_price: number | null
          product_id: string
          reason: string
        }
        Insert: {
          batch_id?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_cost?: number | null
          new_price?: number | null
          old_cost?: number | null
          old_price?: number | null
          product_id: string
          reason?: string
        }
        Update: {
          batch_id?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_cost?: number | null
          new_price?: number | null
          old_cost?: number | null
          old_price?: number | null
          product_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          badge: string
          category_id: string | null
          cost: number
          created_at: string
          description: string
          expiration_date: string | null
          featured: boolean
          id: string
          image_url: string
          image_urls: Json
          min_stock: number
          name: string
          price: number
          slug: string
          stock: number
          supplier: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          badge?: string
          category_id?: string | null
          cost?: number
          created_at?: string
          description?: string
          expiration_date?: string | null
          featured?: boolean
          id?: string
          image_url?: string
          image_urls?: Json
          min_stock?: number
          name: string
          price?: number
          slug: string
          stock?: number
          supplier?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          badge?: string
          category_id?: string | null
          cost?: number
          created_at?: string
          description?: string
          expiration_date?: string | null
          featured?: boolean
          id?: string
          image_url?: string
          image_urls?: Json
          min_stock?: number
          name?: string
          price?: number
          slug?: string
          stock?: number
          supplier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          id: string
          product_id: string
          purchase_id: string
          quantity: number
          unit_cost: number
        }
        Insert: {
          id?: string
          product_id: string
          purchase_id: string
          quantity: number
          unit_cost: number
        }
        Update: {
          id?: string
          product_id?: string
          purchase_id?: string
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          id: string
          notes: string
          number: number
          supplier_id: string | null
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string
          number?: never
          supplier_id?: string | null
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string
          number?: never
          supplier_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          reason: string
          type: Database["public"]["Enums"]["stock_movement_type"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          reason?: string
          type: Database["public"]["Enums"]["stock_movement_type"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          reason?: string
          type?: Database["public"]["Enums"]["stock_movement_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string
          phone: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string
          phone?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string
          phone?: string
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
    }
    Views: {
      orders_staff: {
        Row: {
          channel: string | null
          confirmed_at: string | null
          cost_total: number | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          delivered_at: string | null
          delivery_address: Json | null
          delivery_method: string | null
          edited_at: string | null
          event_date: string | null
          id: string | null
          items: Json | null
          notes: string | null
          number: number | null
          status: Database["public"]["Enums"]["order_status"] | null
          total: number | null
        }
        Insert: {
          channel?: string | null
          confirmed_at?: string | null
          cost_total?: number | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_address?: Json | null
          delivery_method?: string | null
          edited_at?: string | null
          event_date?: string | null
          id?: string | null
          items?: Json | null
          notes?: string | null
          number?: number | null
          status?: Database["public"]["Enums"]["order_status"] | null
          total?: number | null
        }
        Update: {
          channel?: string | null
          confirmed_at?: string | null
          cost_total?: number | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_address?: Json | null
          delivery_method?: string | null
          edited_at?: string | null
          event_date?: string | null
          id?: string | null
          items?: Json | null
          notes?: string | null
          number?: number | null
          status?: Database["public"]["Enums"]["order_status"] | null
          total?: number | null
        }
        Relationships: []
      }
      products_staff: {
        Row: {
          active: boolean | null
          badge: string | null
          category_id: string | null
          cost: number | null
          created_at: string | null
          description: string | null
          expiration_date: string | null
          featured: boolean | null
          id: string | null
          image_url: string | null
          image_urls: Json | null
          min_stock: number | null
          name: string | null
          price: number | null
          slug: string | null
          stock: number | null
          stock_disponible: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          badge?: string | null
          category_id?: string | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          expiration_date?: string | null
          featured?: boolean | null
          id?: string | null
          image_url?: string | null
          image_urls?: Json | null
          min_stock?: number | null
          name?: string | null
          price?: number | null
          slug?: string | null
          stock?: number | null
          stock_disponible?: never
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          badge?: string | null
          category_id?: string | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          expiration_date?: string | null
          featured?: boolean | null
          id?: string | null
          image_url?: string | null
          image_urls?: Json | null
          min_stock?: number | null
          name?: string | null
          price?: number | null
          slug?: string | null
          stock?: number | null
          stock_disponible?: never
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      adjust_stock: {
        Args: {
          p_product_id: string
          p_quantity: number
          p_reason: string
          p_type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Returns: undefined
      }
      apply_costs: { Args: { p_rows: Json }; Returns: number }
      apply_price_changes: {
        Args: { p_changes: Json; p_reason?: string }
        Returns: string
      }
      apply_stock_count: {
        Args: { p_counts: Json; p_reason?: string }
        Returns: number
      }
      business_report: { Args: { p_from: string; p_to: string }; Returns: Json }
      cancel_order: { Args: { p_order_id: string }; Returns: undefined }
      confirm_order: {
        Args: { p_allow_negative?: boolean; p_order_id: string }
        Returns: undefined
      }
      consume_product_stock: {
        Args: {
          p_product_id: string
          p_qty: number
          p_reason: string
          p_user: string
        }
        Returns: undefined
      }
      copy_combo_recipe: {
        Args: { p_factor?: number; p_from: string; p_to: string }
        Returns: number
      }
      create_counter_sale: {
        Args: { p_allow_negative?: boolean; p_items: Json; p_note?: string }
        Returns: {
          order_number: number
          order_total: number
        }[]
      }
      create_order: {
        Args: {
          p_customer_email?: string
          p_customer_name?: string
          p_customer_phone?: string
          p_delivery_address?: Json
          p_delivery_method?: string
          p_event_date?: string
          p_hp?: string
          p_items: Json
          p_notes?: string
        }
        Returns: {
          items: Json
          order_number: number
          total: number
        }[]
      }
      expire_pending_orders: { Args: { p_hours?: number }; Returns: number }
      get_public_bestsellers: {
        Args: never
        Returns: {
          slug: string
        }[]
      }
      get_public_products: {
        Args: never
        Returns: {
          availability: string
          badge: string
          category_name: string
          category_slug: string
          description: string
          featured: boolean
          image_url: string
          image_urls: Json
          name: string
          price: number
          slug: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      link_product_photos: { Args: { p_base_url: string }; Returns: number }
      list_team: {
        Args: never
        Returns: {
          created_at: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      mark_order_delivered: { Args: { p_order_id: string }; Returns: undefined }
      product_effective_cost: { Args: { p_id: string }; Returns: number }
      product_effective_stock: { Args: { p_id: string }; Returns: number }
      register_purchase: {
        Args: {
          p_date: string
          p_items: Json
          p_notes: string
          p_supplier_id: string
          p_update_cost?: boolean
        }
        Returns: {
          purchase_number: number
          total: number
        }[]
      }
      replenishment_suggestions: {
        Args: { p_cover_days?: number; p_days?: number }
        Returns: {
          category: string
          cost: number
          dias_cobertura: number
          min_stock: number
          name: string
          product_id: string
          stock: number
          sugerido: number
          supplier: string
          unidades_vendidas: number
          venta_diaria: number
        }[]
      }
      round_price: {
        Args: { p_step?: number; p_value: number }
        Returns: number
      }
      save_staff_catalog_product: {
        Args: {
          p_badge: string
          p_category_id: string
          p_description: string
          p_expiration_date: string
          p_featured: boolean
          p_image_url: string
          p_image_urls: Json
          p_name: string
          p_price: number
          p_product_id: string
          p_slug: string
        }
        Returns: string
      }
      set_user_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: undefined
      }
      undo_price_batch: { Args: { p_batch: string }; Returns: number }
      update_order_items: {
        Args: { p_items: Json; p_order_id: string }
        Returns: number
      }
      void_confirmed_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "vendedor"
      order_status: "pendiente" | "confirmado" | "cancelado"
      stock_movement_type: "entrada" | "salida" | "ajuste"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "vendedor"],
      order_status: ["pendiente", "confirmado", "cancelado"],
      stock_movement_type: ["entrada", "salida", "ajuste"],
    },
  },
} as const
