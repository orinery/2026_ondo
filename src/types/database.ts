// 자동 생성 파일 — 직접 수정하지 말고 `npm run db:types`로 다시 만드세요.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_role: string;
          after: Json | null;
          before: Json | null;
          created_at: string;
          entity: string;
          entity_id: string;
          id: string;
          order_id: string | null;
          reason: string | null;
          reason_code: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_role: string;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          entity: string;
          entity_id: string;
          id?: string;
          order_id?: string | null;
          reason?: string | null;
          reason_code?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_role?: string;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          entity?: string;
          entity_id?: string;
          id?: string;
          order_id?: string | null;
          reason?: string | null;
          reason_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_profiles_id_fk";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
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
          option_ids: string[];
          product_id: string;
          slot_id: string;
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
          option_ids?: string[];
          product_id: string;
          slot_id: string;
          updated_at?: string;
          use_date: string;
          user_id?: string;
        };
        Update: {
          adult_qty?: number;
          child_qty?: number;
          created_at?: string;
          id?: string;
          option_ids?: string[];
          product_id?: string;
          slot_id?: string;
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
            foreignKeyName: "cart_items_slot_id_product_slots_id_fk";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "product_slots";
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
      order_item_options: {
        Row: {
          amount: number;
          name: string;
          option_id: string | null;
          order_item_id: string;
          qty: number;
          unit: Database["public"]["Enums"]["option_unit"];
          unit_price: number;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          name: string;
          option_id?: string | null;
          order_item_id: string;
          qty: number;
          unit: Database["public"]["Enums"]["option_unit"];
          unit_price: number;
        };
        Update: {
          amount?: number;
          name?: string;
          option_id?: string | null;
          order_item_id?: string;
          qty?: number;
          unit?: Database["public"]["Enums"]["option_unit"];
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_item_options_option_id_product_options_id_fk";
            columns: ["option_id"];
            isOneToOne: false;
            referencedRelation: "product_options";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_item_options_order_item_id_order_items_id_fk";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          adult_price: number;
          adult_qty: number;
          cancel_policy: string;
          cancel_reason: string | null;
          cancel_tiers: NonNullable<Json>;
          cancelled_at: string | null;
          child_price: number | null;
          child_qty: number;
          commission_rate: number;
          confirm_deadline: string | null;
          confirmed_at: string | null;
          id: string;
          options_amount: number;
          order_id: string;
          partner_id: string;
          product_id: string;
          product_title: string;
          refund_amount: number | null;
          reject_reason: string | null;
          rejected_at: string | null;
          slot_id: string;
          start_time: string | null;
          status: Database["public"]["Enums"]["order_item_status"];
          subtotal: number;
          use_date: string;
          used_at: string | null;
          voucher_code: string | null;
        };
        ComputedFields: never;
        Insert: {
          adult_price: number;
          adult_qty: number;
          cancel_policy: string;
          cancel_reason?: string | null;
          cancel_tiers: NonNullable<Json>;
          cancelled_at?: string | null;
          child_price?: number | null;
          child_qty: number;
          commission_rate: number;
          confirm_deadline?: string | null;
          confirmed_at?: string | null;
          id?: string;
          options_amount?: number;
          order_id: string;
          partner_id: string;
          product_id: string;
          product_title: string;
          refund_amount?: number | null;
          reject_reason?: string | null;
          rejected_at?: string | null;
          slot_id: string;
          start_time?: string | null;
          status?: Database["public"]["Enums"]["order_item_status"];
          subtotal: number;
          use_date: string;
          used_at?: string | null;
          voucher_code?: string | null;
        };
        Update: {
          adult_price?: number;
          adult_qty?: number;
          cancel_policy?: string;
          cancel_reason?: string | null;
          cancel_tiers?: NonNullable<Json>;
          cancelled_at?: string | null;
          child_price?: number | null;
          child_qty?: number;
          commission_rate?: number;
          confirm_deadline?: string | null;
          confirmed_at?: string | null;
          id?: string;
          options_amount?: number;
          order_id?: string;
          partner_id?: string;
          product_id?: string;
          product_title?: string;
          refund_amount?: number | null;
          reject_reason?: string | null;
          rejected_at?: string | null;
          slot_id?: string;
          start_time?: string | null;
          status?: Database["public"]["Enums"]["order_item_status"];
          subtotal?: number;
          use_date?: string;
          used_at?: string | null;
          voucher_code?: string | null;
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
            foreignKeyName: "order_items_partner_id_partners_id_fk";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_products_id_fk";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_slot_id_product_slots_id_fk";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "product_slots";
            referencedColumns: ["id"];
          },
        ];
      };
      order_memos: {
        Row: {
          body: string;
          created_at: string;
          created_by: string | null;
          id: string;
          order_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          order_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_memos_created_by_profiles_id_fk";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_memos_order_id_orders_id_fk";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
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
      partner_applications: {
        Row: {
          business_name: string;
          contact_email: string;
          contact_name: string;
          contact_phone: string;
          created_at: string;
          id: string;
          intro: string;
          reject_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["application_status"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          business_name: string;
          contact_email: string;
          contact_name: string;
          contact_phone: string;
          created_at?: string;
          id?: string;
          intro: string;
          reject_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["application_status"];
          user_id?: string;
        };
        Update: {
          business_name?: string;
          contact_email?: string;
          contact_name?: string;
          contact_phone?: string;
          created_at?: string;
          id?: string;
          intro?: string;
          reject_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["application_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_applications_reviewed_by_profiles_id_fk";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_applications_user_id_profiles_id_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      partners: {
        Row: {
          commission_rate: number;
          contact_email: string;
          contact_name: string;
          contact_phone: string;
          created_at: string;
          id: string;
          intro: string;
          name: string;
          owner_user_id: string | null;
          status: Database["public"]["Enums"]["partner_status"];
        };
        ComputedFields: never;
        Insert: {
          commission_rate?: number;
          contact_email: string;
          contact_name: string;
          contact_phone: string;
          created_at?: string;
          id?: string;
          intro: string;
          name: string;
          owner_user_id?: string | null;
          status?: Database["public"]["Enums"]["partner_status"];
        };
        Update: {
          commission_rate?: number;
          contact_email?: string;
          contact_name?: string;
          contact_phone?: string;
          created_at?: string;
          id?: string;
          intro?: string;
          name?: string;
          owner_user_id?: string | null;
          status?: Database["public"]["Enums"]["partner_status"];
        };
        Relationships: [
          {
            foreignKeyName: "partners_owner_user_id_profiles_id_fk";
            columns: ["owner_user_id"];
            isOneToOne: true;
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
      product_options: {
        Row: {
          active: boolean;
          id: string;
          name: string;
          position: number;
          price: number;
          product_id: string;
          unit: Database["public"]["Enums"]["option_unit"];
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          id?: string;
          name: string;
          position?: number;
          price: number;
          product_id: string;
          unit?: Database["public"]["Enums"]["option_unit"];
        };
        Update: {
          active?: boolean;
          id?: string;
          name?: string;
          position?: number;
          price?: number;
          product_id?: string;
          unit?: Database["public"]["Enums"]["option_unit"];
        };
        Relationships: [
          {
            foreignKeyName: "product_options_product_id_products_id_fk";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_slots: {
        Row: {
          active: boolean;
          capacity: number;
          created_at: string;
          id: string;
          position: number;
          product_id: string;
          start_time: string | null;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          capacity?: number;
          created_at?: string;
          id?: string;
          position?: number;
          product_id: string;
          start_time?: string | null;
        };
        Update: {
          active?: boolean;
          capacity?: number;
          created_at?: string;
          id?: string;
          position?: number;
          product_id?: string;
          start_time?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_slots_product_id_products_id_fk";
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
          confirmation_mode: Database["public"]["Enums"]["confirmation_mode"];
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
          partner_id: string;
          published_at: string | null;
          rating_avg: number;
          recommend_rank: number | null;
          review_count: number;
          slug: string;
          start_time: string | null;
          summary: string;
          suspended_at: string | null;
          suspended_kind: Database["public"]["Enums"]["suspension_kind"] | null;
          suspended_reason: string | null;
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
          confirmation_mode?: Database["public"]["Enums"]["confirmation_mode"];
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
          partner_id?: string;
          published_at?: string | null;
          rating_avg?: number;
          recommend_rank?: number | null;
          review_count?: number;
          slug: string;
          start_time?: string | null;
          summary: string;
          suspended_at?: string | null;
          suspended_kind?: Database["public"]["Enums"]["suspension_kind"] | null;
          suspended_reason?: string | null;
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
          confirmation_mode?: Database["public"]["Enums"]["confirmation_mode"];
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
          partner_id?: string;
          published_at?: string | null;
          rating_avg?: number;
          recommend_rank?: number | null;
          review_count?: number;
          slug?: string;
          start_time?: string | null;
          summary?: string;
          suspended_at?: string | null;
          suspended_kind?: Database["public"]["Enums"]["suspension_kind"] | null;
          suspended_reason?: string | null;
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
          {
            foreignKeyName: "products_partner_id_partners_id_fk";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
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
          role: Database["public"]["Enums"]["user_role"];
          terms_agreed_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name: string;
          id: string;
          role?: Database["public"]["Enums"]["user_role"];
          terms_agreed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          role?: Database["public"]["Enums"]["user_role"];
          terms_agreed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      refund_adjustments: {
        Row: {
          after_amount: number;
          before_amount: number;
          created_at: string;
          created_by: string | null;
          id: string;
          order_item_id: string;
          reason: string;
        };
        ComputedFields: never;
        Insert: {
          after_amount: number;
          before_amount: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          order_item_id: string;
          reason: string;
        };
        Update: {
          after_amount?: number;
          before_amount?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          order_item_id?: string;
          reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: "refund_adjustments_created_by_profiles_id_fk";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refund_adjustments_order_item_id_order_items_id_fk";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
        ];
      };
      review_reports: {
        Row: {
          created_at: string;
          detail: string | null;
          handled_at: string | null;
          handled_by: string | null;
          id: string;
          reason: Database["public"]["Enums"]["report_reason"];
          reporter_id: string;
          review_id: string;
          status: Database["public"]["Enums"]["report_status"];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          detail?: string | null;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          reason: Database["public"]["Enums"]["report_reason"];
          reporter_id?: string;
          review_id: string;
          status?: Database["public"]["Enums"]["report_status"];
        };
        Update: {
          created_at?: string;
          detail?: string | null;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          reason?: Database["public"]["Enums"]["report_reason"];
          reporter_id?: string;
          review_id?: string;
          status?: Database["public"]["Enums"]["report_status"];
        };
        Relationships: [
          {
            foreignKeyName: "review_reports_handled_by_profiles_id_fk";
            columns: ["handled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_reports_reporter_id_profiles_id_fk";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_reports_review_id_reviews_id_fk";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          content: string;
          created_at: string;
          hidden_at: string | null;
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
          hidden_at?: string | null;
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
          hidden_at?: string | null;
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
      settlement_adjustments: {
        Row: {
          commission_delta: number;
          created_at: string;
          created_by: string | null;
          id: string;
          month: string;
          order_item_id: string;
          partner_id: string;
          revenue_delta: number;
          source: string;
        };
        ComputedFields: never;
        Insert: {
          commission_delta: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          month: string;
          order_item_id: string;
          partner_id: string;
          revenue_delta: number;
          source: string;
        };
        Update: {
          commission_delta?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          month?: string;
          order_item_id?: string;
          partner_id?: string;
          revenue_delta?: number;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settlement_adjustments_created_by_profiles_id_fk";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlement_adjustments_order_item_id_order_items_id_fk";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlement_adjustments_partner_id_partners_id_fk";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      settlements: {
        Row: {
          commission: number;
          item_count: number;
          month: string;
          partner_id: string;
          payout: number;
          revenue: number;
          settled_at: string;
          settled_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          commission: number;
          item_count: number;
          month: string;
          partner_id: string;
          payout: number;
          revenue: number;
          settled_at?: string;
          settled_by?: string | null;
        };
        Update: {
          commission?: number;
          item_count?: number;
          month?: string;
          partner_id?: string;
          payout?: number;
          revenue?: number;
          settled_at?: string;
          settled_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "settlements_partner_id_partners_id_fk";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlements_settled_by_profiles_id_fk";
            columns: ["settled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      slot_inventory: {
        Row: {
          adult_price: number | null;
          booked: number;
          capacity: number | null;
          child_price: number | null;
          closed: boolean;
          slot_id: string;
          use_date: string;
        };
        ComputedFields: never;
        Insert: {
          adult_price?: number | null;
          booked?: number;
          capacity?: number | null;
          child_price?: number | null;
          closed?: boolean;
          slot_id: string;
          use_date: string;
        };
        Update: {
          adult_price?: number | null;
          booked?: number;
          capacity?: number | null;
          child_price?: number | null;
          closed?: boolean;
          slot_id?: string;
          use_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "slot_inventory_slot_id_product_slots_id_fk";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "product_slots";
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
          created_by_order_id: string | null;
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
          created_by_order_id?: string | null;
          end_date: string;
          id?: string;
          start_date: string;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          created_by_order_id?: string | null;
          end_date?: string;
          id?: string;
          start_date?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trips_created_by_order_id_orders_id_fk";
            columns: ["created_by_order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
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
      add_booking_to_trip: {
        Args: { p_order_item_id: string; p_trip_id: string };
        Returns: undefined;
      };
      admin_adjust_refund: {
        Args: { p_amount: number; p_item_id: string; p_reason: string };
        Returns: number;
      };
      admin_breakdown: {
        Args: { p_by: string; p_from: string; p_to: string };
        Returns: {
          items: number;
          label: string;
          revenue: number;
        }[];
      };
      admin_cancel_item: {
        Args: { p_item_id: string; p_note: string; p_reason_code: string };
        Returns: number;
      };
      admin_daily_stats: {
        Args: { p_from: string; p_to: string };
        Returns: {
          day: string;
          gross: number;
          orders: number;
          refunds: number;
        }[];
      };
      admin_kpis: {
        Args: { p_from: string; p_to: string };
        Returns: {
          closed_items: number;
          gross: number;
          items: number;
          open_reports: number;
          orders: number;
          pending_applications: number;
          pending_items: number;
          refunds: number;
        }[];
      };
      admin_orders: {
        Args: {
          p_from: string;
          p_limit: number;
          p_offset: number;
          p_partner: string;
          p_q: string;
          p_status: string;
          p_to: string;
        };
        Returns: {
          booker_name: string;
          closed_count: number;
          display_status: string;
          first_title: string;
          id: string;
          item_count: number;
          order_no: string;
          paid_at: string;
          partial: boolean;
          partner_names: string;
          pending_count: number;
          refund_amount: number;
          total_amount: number;
          total_count: number;
          upcoming_count: number;
          used_count: number;
        }[];
      };
      admin_partner_impact: {
        Args: { p_partner_id: string };
        Returns: {
          confirmed_count: number;
          open_products: number;
          partner_suspended_products: number;
          pending_count: number;
        }[];
      };
      admin_product_impact: {
        Args: { p_product_id: string };
        Returns: {
          confirmed_count: number;
          pending_count: number;
          refund_total: number;
        }[];
      };
      admin_set_partner_status: {
        Args: { p_partner_id: string; p_reason: string; p_status: string };
        Returns: number;
      };
      admin_set_product_suspension: {
        Args: { p_kind: string; p_product_id: string; p_reason: string; p_suspend: boolean };
        Returns: number;
      };
      admin_set_review_hidden: {
        Args: { p_hidden: boolean; p_reason: string; p_review_id: string };
        Returns: undefined;
      };
      admin_settle_month: { Args: { p_month: string; p_partner: string }; Returns: number };
      approve_partner_application: { Args: { p_application_id: string }; Returns: string };
      attach_bookings: { Args: { p_trip_id: string }; Returns: number };
      booking_error: {
        Args: {
          p_adult: number;
          p_child: number;
          p_option_ids?: string[];
          p_product_id: string;
          p_slot_id: string;
          p_use_date: string;
        };
        Returns: string;
      };
      cancel_order: { Args: { p_order_id: string }; Returns: number };
      cancel_order_item: { Args: { p_item_id: string }; Returns: number };
      confirm_item: { Args: { p_item_id: string }; Returns: string };
      expire_pending_items: { Args: Record<PropertyKey, never>; Returns: number };
      generate_voucher_code: { Args: Record<PropertyKey, never>; Returns: string };
      has_used_product: { Args: { p_product_id: string }; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      line_price: {
        Args: {
          p_adult: number;
          p_child: number;
          p_option_ids?: string[];
          p_product_id: string;
          p_slot_id: string;
          p_use_date: string;
        };
        Returns: {
          adult_price: number;
          child_price: number;
          options_amount: number;
          subtotal: number;
        }[];
      };
      lock_partner_item: { Args: { p_item_id: string }; Returns: Record<string, unknown> };
      mark_used: {
        Args: { p_code: string };
        Returns: {
          booker_name: string;
          item_id: string;
          people: number;
          product_title: string;
          use_date: string;
        }[];
      };
      my_partner_id: { Args: Record<PropertyKey, never>; Returns: string };
      my_profile: {
        Args: Record<PropertyKey, never>;
        Returns: {
          avatar_url: string;
          display_name: string;
          partner_id: string;
          partner_name: string;
          partner_status: string;
          role: string;
        }[];
      };
      partner_bookings: {
        Args: { p_from: string; p_to: string };
        Returns: {
          adult_qty: number;
          booker_email: string;
          booker_name: string;
          booker_phone: string;
          child_qty: number;
          confirm_deadline: string;
          item_id: string;
          options: string;
          order_no: string;
          paid_at: string;
          product_id: string;
          product_title: string;
          refund_amount: number;
          reject_reason: string;
          start_time: string;
          status: string;
          subtotal: number;
          use_date: string;
          voucher_code: string;
        }[];
      };
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
          status: string;
        }[];
      };
      reject_item: { Args: { p_item_id: string; p_reason: string }; Returns: undefined };
      reject_partner_application: {
        Args: { p_application_id: string; p_reason: string };
        Returns: undefined;
      };
      release_item: {
        Args: { p_item_id: string; p_reason?: string; p_refund: number; p_status: string };
        Returns: undefined;
      };
      reorder_trip_items: {
        Args: { p_day_index: number; p_item_ids: string[]; p_trip_id: string };
        Returns: undefined;
      };
      resolve_review_report: {
        Args: { p_action: string; p_note: string; p_report_id: string };
        Returns: undefined;
      };
      save_product: {
        Args: {
          p_images: Json;
          p_itinerary: Json;
          p_options: Json;
          p_product: Json;
          p_product_id: string;
          p_slots: Json;
        };
        Returns: string;
      };
      seoul_today: { Args: Record<PropertyKey, never>; Returns: string };
      set_inventory_range: {
        Args: {
          p_adult_price: number;
          p_capacity: number;
          p_child_price: number;
          p_closed: boolean;
          p_from: string;
          p_slot_id: string;
          p_to: string;
          p_weekdays: number[];
        };
        Returns: number;
      };
      settlement_items: {
        Args: { p_from: string; p_partner: string; p_to: string };
        Returns: {
          commission: number;
          commission_rate: number;
          item_id: string;
          month: string;
          order_no: string;
          partner_id: string;
          product_title: string;
          refund: number;
          revenue: number;
          status: string;
          subtotal: number;
          use_date: string;
        }[];
      };
      settlement_scope: { Args: { p_partner: string }; Returns: Record<string, unknown> };
      settlement_summary: {
        Args: { p_from: string; p_partner: string; p_to: string };
        Returns: {
          commission: number;
          item_count: number;
          month: string;
          partner_id: string;
          partner_name: string;
          payout: number;
          revenue: number;
          settled_at: string;
        }[];
      };
      write_audit: {
        Args: {
          p_action: string;
          p_after?: Json;
          p_before?: Json;
          p_entity: string;
          p_entity_id: string;
          p_order_id: string;
          p_reason?: string;
          p_role?: string;
          p_system?: boolean;
        };
        Returns: undefined;
      };
    };
    Enums: {
      application_status: "pending" | "approved" | "rejected";
      confirmation_mode: "instant" | "manual";
      itinerary_item_type: "move" | "sight" | "food" | "booking";
      option_unit: "per_booking" | "per_person";
      order_item_status: "pending" | "confirmed" | "used" | "rejected" | "cancelled" | "expired";
      order_status: "paid" | "cancelled";
      partner_status: "active" | "suspended";
      product_category: "tour" | "ticket";
      product_theme: "sea" | "city" | "nature" | "culture";
      report_reason: "spam" | "abuse" | "irrelevant" | "privacy" | "other";
      report_status: "pending" | "dismissed" | "actioned";
      suspension_kind: "info_fix" | "unsafe" | "partner_suspended";
      user_role: "customer" | "partner" | "admin";
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
      application_status: ["pending", "approved", "rejected"],
      confirmation_mode: ["instant", "manual"],
      itinerary_item_type: ["move", "sight", "food", "booking"],
      option_unit: ["per_booking", "per_person"],
      order_item_status: ["pending", "confirmed", "used", "rejected", "cancelled", "expired"],
      order_status: ["paid", "cancelled"],
      partner_status: ["active", "suspended"],
      product_category: ["tour", "ticket"],
      product_theme: ["sea", "city", "nature", "culture"],
      report_reason: ["spam", "abuse", "irrelevant", "privacy", "other"],
      report_status: ["pending", "dismissed", "actioned"],
      suspension_kind: ["info_fix", "unsafe", "partner_suspended"],
      user_role: ["customer", "partner", "admin"],
    },
  },
} as const;
