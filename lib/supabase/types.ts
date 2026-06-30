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
          has_real_id: boolean;
          has_clear: boolean;
          known_traveler_number: string | null;
          lounge_memberships:     string[] | null;
          preferred_transport:    string;
          accessibility_needs:    string[] | null;
          arrival_buffer_minutes: number;
          travel_frequency:       string | null;
          trip_scope:             string | null;
          travels_with:           string | null;
          travel_stressors:       string[] | null;
          family_auto_updates:    boolean;
          home_airport:           string | null;
          onboarding_completed:   boolean;
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
          departure_time:      string | null;
          departure_scheduled: string | null;
          departure_estimated: string | null;
          departure_actual:    string | null;
          arrival_time:        string | null;
          arrival_scheduled:   string | null;
          arrival_estimated:   string | null;
          arrival_actual:      string | null;
          boarding_time:       string | null;
          departure_timezone:  string | null;
          destination_timezone: string | null;
          gate: string | null;
          terminal: string | null;
          seat: string | null;
          status: string;
          confirmation_code: string | null;
          raw_boarding_pass: Json | null;
          parental_mode: boolean;
          parent_id: string | null;
          parental_settings: Json | null;
          share_token: string | null;
          share_enabled: boolean;
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
      trip_milestones: {
        Row: {
          id: string;
          trip_id: string;
          type: "left_home" | "cleared_security" | "at_gate" | "boarded";
          reached_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["trip_milestones"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["trip_milestones"]["Insert"]>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          trip_id: string | null;
          type: "delay" | "gate_change" | "cancellation" | "leave_soon" | null;
          title: string | null;
          body: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["notifications"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
      };
      trip_predictions: {
        Row: {
          id: string;
          trip_id: string;
          user_id: string;
          predicted_buffer_minutes: number;
          actual_buffer_minutes: number | null;
          rule_factors: Json | null;
          created_at: string;
          updated_at: string;  // added by migration 013
        };
        Insert: Omit<Database["public"]["Tables"]["trip_predictions"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["trip_predictions"]["Insert"]>;
      };
    };
  };
}
