// 자동 생성 파일 — 직접 수정하지 말고 `npm run db:types`로 다시 만드세요.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      destination_images: {
        Row: {
          alt: string;
          destination_id: string;
          id: string;
          position: number;
          url: string;
        };
        ComputedFields: never;
        Insert: {
          alt: string;
          destination_id: string;
          id?: string;
          position: number;
          url: string;
        };
        Update: {
          alt?: string;
          destination_id?: string;
          id?: string;
          position?: number;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "destination_images_destination_id_destinations_id_fk";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
            referencedColumns: ["id"];
          },
        ];
      };
      destination_itinerary_items: {
        Row: {
          caution: string | null;
          day_number: number;
          destination_id: string;
          id: string;
          note: string | null;
          position: number;
          time: string | null;
          title: string;
          type: Database["public"]["Enums"]["itinerary_item_type"];
        };
        ComputedFields: never;
        Insert: {
          caution?: string | null;
          day_number: number;
          destination_id: string;
          id?: string;
          note?: string | null;
          position: number;
          time?: string | null;
          title: string;
          type: Database["public"]["Enums"]["itinerary_item_type"];
        };
        Update: {
          caution?: string | null;
          day_number?: number;
          destination_id?: string;
          id?: string;
          note?: string | null;
          position?: number;
          time?: string | null;
          title?: string;
          type?: Database["public"]["Enums"]["itinerary_item_type"];
        };
        Relationships: [
          {
            foreignKeyName: "destination_itinerary_items_destination_id_destinations_id_fk";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
            referencedColumns: ["id"];
          },
        ];
      };
      destinations: {
        Row: {
          best_seasons: Database["public"]["Enums"]["season"][];
          country: string;
          created_at: string;
          currency: string | null;
          description: string;
          flight_info: string | null;
          id: string;
          image_alt: string;
          image_url: string;
          latitude: number;
          longitude: number;
          name: string;
          name_en: string;
          rating_avg: number;
          review_count: number;
          season: Database["public"]["Enums"]["season"];
          slug: string;
          summary: string;
          theme: Database["public"]["Enums"]["destination_theme"];
          time_difference: string | null;
          unavailable_reason: string | null;
        };
        ComputedFields: never;
        Insert: {
          best_seasons: Database["public"]["Enums"]["season"][];
          country: string;
          created_at?: string;
          currency?: string | null;
          description: string;
          flight_info?: string | null;
          id?: string;
          image_alt: string;
          image_url: string;
          latitude: number;
          longitude: number;
          name: string;
          name_en: string;
          rating_avg?: number;
          review_count?: number;
          season: Database["public"]["Enums"]["season"];
          slug: string;
          summary: string;
          theme: Database["public"]["Enums"]["destination_theme"];
          time_difference?: string | null;
          unavailable_reason?: string | null;
        };
        Update: {
          best_seasons?: Database["public"]["Enums"]["season"][];
          country?: string;
          created_at?: string;
          currency?: string | null;
          description?: string;
          flight_info?: string | null;
          id?: string;
          image_alt?: string;
          image_url?: string;
          latitude?: number;
          longitude?: number;
          name?: string;
          name_en?: string;
          rating_avg?: number;
          review_count?: number;
          season?: Database["public"]["Enums"]["season"];
          slug?: string;
          summary?: string;
          theme?: Database["public"]["Enums"]["destination_theme"];
          time_difference?: string | null;
          unavailable_reason?: string | null;
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
          destination_id: string;
          folder_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          destination_id: string;
          folder_id?: string | null;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          destination_id?: string;
          folder_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "likes_destination_id_destinations_id_fk";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "likes_folder_id_like_folders_id_fk";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "like_folders";
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
          destination_id: string;
          id: string;
          photo_path: string | null;
          rating: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          content: string;
          created_at?: string;
          destination_id: string;
          id?: string;
          photo_path?: string | null;
          rating: number;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          destination_id?: string;
          id?: string;
          photo_path?: string | null;
          rating?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_destination_id_destinations_id_fk";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
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
          destination_id: string | null;
          id: string;
          note: string | null;
          position: number;
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
          destination_id?: string | null;
          id?: string;
          note?: string | null;
          position: number;
          time?: string | null;
          title: string;
          trip_id: string;
          type?: Database["public"]["Enums"]["itinerary_item_type"];
        };
        Update: {
          caution?: string | null;
          created_at?: string;
          day_index?: number;
          destination_id?: string | null;
          id?: string;
          note?: string | null;
          position?: number;
          time?: string | null;
          title?: string;
          trip_id?: string;
          type?: Database["public"]["Enums"]["itinerary_item_type"];
        };
        Relationships: [
          {
            foreignKeyName: "trip_items_destination_id_destinations_id_fk";
            columns: ["destination_id"];
            isOneToOne: false;
            referencedRelation: "destinations";
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
      [_ in never]: never;
    };
    Enums: {
      destination_theme: "sea" | "city" | "nature" | "culture";
      itinerary_item_type: "move" | "sight" | "food";
      season: "spring" | "summer" | "fall" | "winter";
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
      destination_theme: ["sea", "city", "nature", "culture"],
      itinerary_item_type: ["move", "sight", "food"],
      season: ["spring", "summer", "fall", "winter"],
    },
  },
} as const;
