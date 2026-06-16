export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface ParentalSettings {
  dnd_vendors: boolean;
  alert_window_minutes: number;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string | null;
          email: string | null;
          home_address: string | null;
          home_lat: number | null;
          home_lng: number | null;
          tsa_precheck: boolean;
          global_entry: boolean;
          preferred_transport: string;
          accessibility_needs: string[] | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["users"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      trips: {
        Row: {
          id: string;
          user_id: string;
          flight_number: string | null;
          airline: string | null;
          origin: string | null;
          destination: string | null;
          departure_time: string | null;
          boarding_time: string | null;
          gate: string | null;
          terminal: string | null;
          seat: string | null;
          status: string;
          confirmation_code: string | null;
          raw_boarding_pass: Json | null;
          parental_mode: boolean;
          parent_id: string | null;
          parental_settings: Json | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["trips"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["trips"]["Insert"]>;
      };
      itinerary_steps: {
        Row: {
          id: string;
          trip_id: string;
          position: number | null;
          time: string | null;
          label: string | null;
          icon: string | null;
          detail: string | null;
          step_type: string | null;
          status: string;
          action_url: string | null;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["itinerary_steps"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["itinerary_steps"]["Insert"]>;
      };
      alerts: {
        Row: {
          id: string;
          user_id: string;
          trip_id: string;
          message: string | null;
          trigger_time: string | null;
          type: string | null;
          priority: number;
          delivered: boolean;
          snoozed_until: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["alerts"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["alerts"]["Insert"]>;
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          key: string;
          value: Json | null;
          confidence_score: number;
          source: string | null;
          times_observed: number;
          last_updated: string;
        };
        Insert: Omit<Database["public"]["Tables"]["user_preferences"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["user_preferences"]["Insert"]>;
      };
      trip_events: {
        Row: {
          id: string;
          user_id: string;
          trip_id: string;
          event_type: string | null;
          data: Json | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["trip_events"]["Row"], "id" | "created_at">;
        Update: never;
      };
      family_links: {
        Row: {
          id: string;
          user_id: string;
          family_member_id: string;
          permissions: string[] | null;
          active: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["family_links"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["family_links"]["Insert"]>;
      };
    };
  };
}
