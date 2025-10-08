export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string | null;
          avatar_url: string | null;
          role: string | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          name?: string | null;
          avatar_url?: string | null;
          role?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string | null;
          avatar_url?: string | null;
          role?: string | null;
          created_at?: string | null;
        };
      };
      albums: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          slug: string;
          cover_url: string | null;
          visibility: 'public' | 'unlisted' | 'private';
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          slug: string;
          cover_url?: string | null;
          visibility?: 'public' | 'unlisted' | 'private';
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          slug?: string;
          cover_url?: string | null;
          visibility?: 'public' | 'unlisted' | 'private';
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      stickers: {
        Row: {
          id: string;
          album_id: string;
          title: string | null;
          orig_url: string;
          file_url: string;
          thumb_url: string | null;
          width: number | null;
          height: number | null;
          size_kb: number | null;
          tags: string[] | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          album_id: string;
          title?: string | null;
          orig_url: string;
          file_url: string;
          thumb_url?: string | null;
          width?: number | null;
          height?: number | null;
          size_kb?: number | null;
          tags?: string[] | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          album_id?: string;
          title?: string | null;
          orig_url?: string;
          file_url?: string;
          thumb_url?: string | null;
          width?: number | null;
          height?: number | null;
          size_kb?: number | null;
          tags?: string[] | null;
          created_at?: string | null;
        };
      };
      packs: {
        Row: {
          id: string;
          album_id: string | null;
          name: string;
          author: string | null;
          exported_zip_url: string | null;
          version: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          album_id?: string | null;
          name: string;
          author?: string | null;
          exported_zip_url?: string | null;
          version?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          album_id?: string | null;
          name?: string;
          author?: string | null;
          exported_zip_url?: string | null;
          version?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      pack_items: {
        Row: {
          id: string;
          pack_id: string | null;
          sticker_id: string | null;
          order_index: number | null;
        };
        Insert: {
          id?: string;
          pack_id?: string | null;
          sticker_id?: string | null;
          order_index?: number | null;
        };
        Update: {
          id?: string;
          pack_id?: string | null;
          sticker_id?: string | null;
          order_index?: number | null;
        };
      };
      shares: {
        Row: {
          id: string;
          target_type: string;
          target_id: string;
          kind: string;
          url: string;
          qr_png_url: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          target_type: string;
          target_id: string;
          kind: string;
          url: string;
          qr_png_url?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          target_type?: string;
          target_id?: string;
          kind?: string;
          url?: string;
          qr_png_url?: string | null;
          created_at?: string | null;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
