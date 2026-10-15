// 자동 생성 파일 — 직접 수정하지 말고 `npm run db:types`로 다시 만드세요.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      cancellation_policies: {
        Row: {
          code: string;
          name: string;
          summary: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          name: string;
          summary: string;
        };
        Update: {
          code?: string;
          name?: string;
          summary?: string;
        };
        Relationships: [];
      };
      cancellation_policy_tiers: {
        Row: {
          days_before: number;
          policy_code: string;
          refund_rate: number;
        };
        ComputedFields: never;
        Insert: {
          days_before: number;
          policy_code: string;
          refund_rate: number;
        };
        Update: {
          days_before?: number;
          policy_code?: string;
          refund_rate?: number;
        };
        Relationships: [
          {
            foreignKeyName: "cancellation_policy_tiers_policy_code_cancellation_policies_cod";
            columns: ["policy_code"];
            isOneToOne: false;
            referencedRelation: "cancellation_policies";
            referencedColumns: ["code"];
          },
        ];
      };
      cart_items: {
        Row: {
          adult_qty: number;
          child_qty: number;
          created_at: string;
          id: string;
          product_id: string;
          updated_at: string;
          use_date: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          adult_qty?: number;
          child_qty?: number;
          created_at?: string;
          id?: string;
          product_id: string;
          updated_at?: string;
          use_date: string;
          user_id?: string;
        };
        Update: {
          adult_qty?: number;
          child_qty?: number;
          created_at?: string;
          id?: string;
          product_id?: string;
          updated_at?: string;
          use_date?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_products_id_fk";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_user_id_profiles_id_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cities: {
        Row: {
          id: string;
          image_alt: string;
          image_url: string;
          latitude: number;
          longitude: number;
          name: string;
          name_en: string;
          position: number;
          slug: string;
          summary: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          image_alt: string;
          image_url: string;
          latitude: number;
          longitude: number;
          name: string;
          name_en: string;
          position: number;
          slug: string;
          summary: string;
        };
        Update: {
          id?: string;
          image_alt?: string;
          image_url?: string;
          latitude?: number;
          longitude?: number;
          name?: string;
          name_en?: string;
          position?: number;
          slug?: string;
          summary?: string;
        };
        Relationships: [];
      };
      like_folders: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "like_folders_user_id_profiles_id_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      likes: {
        Row: {
          created_at: string;
          folder_id: string | null;
          product_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          folder_id?: string | null;
          product_id: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          folder_id?: string | null;
          product_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "likes_folder_id_like_folders_id_fk";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "like_folders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "likes_product_id_products_id_fk";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "likes_user_id_profiles_id_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          adult_price: number;
          adult_qty: number;
          cancel_policy: string;
          child_price: number | null;
          child_qty: number;
          id: string;
          order_id: string;
          product_id: string;
          product_title: string;
          refund_amount: number | null;
          subtotal: number;
          use_date: string;
        };
        ComputedFields: never;
        Insert: {
          adult_price: number;
          adult_qty: number;
          cancel_policy: string;
          child_price?: number | null;
          child_qty: number;
          id?: string;
          order_id: string;
          product_id: string;
          product_title: string;
          refund_amount?: number | null;
          subtotal: number;
          use_date: string;
        };
        Update: {
          adult_price?: number;
          adult_qty?: number;
          cancel_policy?: string;
          child_price?: number | null;
          child_qty?: number;
          id?: string;
          order_id?: string;
          product_id?: string;
          product_title?: string;
          refund_amount?: number | null;
          subtotal?: number;
          use_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_cancel_policy_cancellation_policies_code_fk";
            columns: ["cancel_policy"];
            isOneToOne: false;
            referencedRelation: "cancellation_policies";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "order_items_order_id_orders_id_fk";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_products_id_fk";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          booker_email: string;
          booker_name: string;
          booker_phone: string;
          cancelled_at: string | null;
          created_at: string;
          id: string;
          idempotency_key: string;
          order_no: string;
          paid_at: string;
          payment_method: string;
          policy_agreed_at: string;
          refund_amount: number | null;
          status: Database["public"]["Enums"]["order_status"];
          total_amount: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          booker_email: string;
          booker_name: string;
          booker_phone: string;
          cancelled_at?: string | null;
          created_at?: string;
          id?: string;
          idempotency_key: string;
          order_no: string;
          paid_at?: string;
          payment_method?: string;
          policy_agreed_at: string;
          refund_amount?: number | null;
          status?: Database["public"]["Enums"]["order_status"];
          total_amount: number;
          user_id: string;
        };
        Update: {
          booker_email?: string;
          booker_name?: string;
          booker_phone?: string;
          cancelled_at?: string | null;
          created_at?: string;
          id?: string;
          idempotency_key?: string;
          order_no?: string;
          paid_at?: string;
          payment_method?: string;
          policy_agreed_at?: string;
          refund_amount?: number | null;
          status?: Database["public"]["Enums"]["order_status"];
          total_amount?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_user_id_profiles_id_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: {
          alt: string;
          id: string;
          position: number;
          product_id: string;
          url: string;
        };
        ComputedFields: never;
        Insert: {
          alt: string;
          id?: string;
          position: number;
          product_id: string;
          url: string;
        };
        Update: {
          alt?: string;
          id?: string;
          position?: number;
          product_id?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_products_id_fk";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_itinerary_items: {
        Row: {
          caution: string | null;
          id: string;
          note: string | null;
          position: number;
          product_id: string;
          time: string | null;
          title: string;
          type: Database["public"]["Enums"]["itinerary_item_type"];
        };
        ComputedFields: never;
        Insert: {
          caution?: string | null;
          id?: string;
          note?: string | null;
          position: number;
          product_id: string;
          time?: string | null;
          title: string;
          type: Database["public"]["Enums"]["itinerary_item_type"];
        };
        Update: {
          caution?: string | null;
          id?: string;
          note?: string | null;
          position?: number;
          product_id?: string;
          time?: string | null;
          title?: string;
          type?: Database["public"]["Enums"]["itinerary_item_type"];
        };
        Relationships: [
          {
            foreignKeyName: "product_itinerary_items_product_id_products_id_fk";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          adult_price: number;
          cancel_policy: string;
          category: Database["public"]["Enums"]["product_category"];
          child_price: number | null;
          city_id: string;
          created_at: string;
          cutoff_days: number;
          description: string;
          duration_text: string;
          excludes: string[];
          highlights: string[];
          id: string;
          image_alt: string;
          image_url: string;
          includes: string[];
          latitude: number;
          list_adult_price: number | null;
          longitude: number;
          max_qty: number;
          meeting_point: string;
          operating_days: number[];
          rating_avg: number;
          recommend_rank: number | null;
          review_count: number;
          slug: string;
          start_time: string | null;
          summary: string;
          theme: Database["public"]["Enums"]["product_theme"];
          title: string;
          unavailable_reason: string | null;
          usage_info: string[];
        };
        ComputedFields: never;
        Insert: {
          adult_price: number;
          cancel_policy: string;
          category: Database["public"]["Enums"]["product_category"];
          child_price?: number | null;
          city_id: string;
          created_at?: string;
          cutoff_days?: number;
          description: string;
          duration_text: string;
          excludes?: string[];
          highlights?: string[];
          id?: string;
          image_alt: string;
          image_url: string;
          includes?: string[];
          latitude: number;
          list_adult_price?: number | null;
          longitude: number;
          max_qty?: number;
          meeting_point: string;
          operating_days: number[];
          rating_avg?: number;
          recommend_rank?: number | null;
          review_count?: number;
          slug: string;
          start_time?: string | null;
          summary: string;
          theme: Database["public"]["Enums"]["product_theme"];
          title: string;
          unavailable_reason?: string | null;
          usage_info?: string[];
        };
        Update: {
          adult_price?: number;
          cancel_policy?: string;
          category?: Database["public"]["Enums"]["product_category"];
          child_price?: number | null;
          city_id?: string;
          created_at?: string;
          cutoff_days?: number;
          description?: string;
          duration_text?: string;
          excludes?: string[];
          highlights?: string[];
          id?: string;
          image_alt?: string;
          image_url?: string;
          includes?: string[];
          latitude?: number;
          list_adult_price?: number | null;
          longitude?: number;
          max_qty?: number;
          meeting_point?: string;
          operating_days?: number[];
          rating_avg?: number;
          recommend_rank?: number | null;
          review_count?: number;
          slug?: string;
          start_time?: string | null;
          summary?: string;
          theme?: Database["public"]["Enums"]["product_theme"];
          title?: string;
          unavailable_reason?: string | null;
          usage_info?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "products_cancel_policy_cancellation_policies_code_fk";
            columns: ["cancel_policy"];
            isOneToOne: false;
            referencedRelation: "cancellation_policies";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "products_city_id_cities_id_fk";
            columns: ["city_id"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string;
          id: string;
          terms_agreed_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name: string;
          id: string;
          terms_agreed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          terms_agreed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          photo_path: string | null;
          product_id: string;
          rating: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          photo_path?: string | null;
          product_id: string;
          rating: number;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          photo_path?: string | null;
          product_id?: string;
          rating?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_products_id_fk";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_user_id_profiles_id_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_items: {
        Row: {
          caution: string | null;
          created_at: string;
          day_index: number;
          id: string;
          note: string | null;
          order_item_id: string | null;
          position: number;
          product_id: string | null;
          time: string | null;
          title: string;
          trip_id: string;
          type: Database["public"]["Enums"]["itinerary_item_type"];
        };
        ComputedFields: never;
        Insert: {
          caution?: string | null;
          created_at?: string;
          day_index: number;
          id?: string;
          note?: string | null;
          order_item_id?: string | null;
          position: number;
          product_id?: string | null;
          time?: string | null;
          title: string;
          trip_id: string;
          type?: Database["public"]["Enums"]["itinerary_item_type"];
        };
        Update: {
          caution?: string | null;
          created_at?: string;
          day_index?: number;
          id?: string;
          note?: string | null;
          order_item_id?: string | null;
          position?: number;
          product_id?: string | null;
          time?: string | null;
          title?: string;
          trip_id?: string;
          type?: Database["public"]["Enums"]["itinerary_item_type"];
        };
        Relationships: [
          {
            foreignKeyName: "trip_items_order_item_id_order_items_id_fk";
            columns: ["order_item_id"];
            isOneToOne: true;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_items_product_id_products_id_fk";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_items_trip_id_trips_id_fk";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trips: {
        Row: {
          created_at: string;
          end_date: string;
          id: string;
          start_date: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          end_date: string;
          id?: string;
          start_date: string;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          end_date?: string;
          id?: string;
          start_date?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trips_user_id_profiles_id_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      booking_error: {
        Args: { p_adult: number; p_child: number; p_product_id: string; p_use_date: string };
        Returns: string;
      };
      cancel_order: { Args: { p_order_id: string }; Returns: number };
      has_used_product: { Args: { p_product_id: string }; Returns: boolean };
      place_order: {
        Args: {
          p_booker_email: string;
          p_booker_name: string;
          p_booker_phone: string;
          p_cart_item_ids: string[];
          p_expected_total: number;
          p_idempotency_key: string;
          p_policy_agreed: boolean;
        };
        Returns: string;
      };
      refund_quote: {
        Args: { p_order_id: string };
        Returns: {
          days_before: number;
          order_item_id: string;
          refund_amount: number;
          refund_rate: number;
        }[];
      };
      reorder_trip_items: {
        Args: { p_day_index: number; p_item_ids: string[]; p_trip_id: string };
        Returns: undefined;
      };
      seoul_today: { Args: Record<PropertyKey, never>; Returns: string };
    };
    Enums: {
      itinerary_item_type: "move" | "sight" | "food" | "booking";
      order_status: "paid" | "cancelled";
      product_category: "tour" | "ticket";
      product_theme: "sea" | "city" | "nature" | "culture";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      itinerary_item_type: ["move", "sight", "food", "booking"],
      order_status: ["paid", "cancelled"],
      product_category: ["tour", "ticket"],
      product_theme: ["sea", "city", "nature", "culture"],
    },
  },
} as const;
