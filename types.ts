export enum Role {
  USER = 'user',
  MODEL = 'model',
}

export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:3' | '3:4' | '9:19.5';

export interface ChatMessage {
  id: string;
  role: Role;
  text?: string;
  images?: string[]; // Array of base64 strings
  timestamp: number;
}

export interface GenerationConfig {
  aspectRatio: AspectRatio;
  imageCount: 1 | 4;
}