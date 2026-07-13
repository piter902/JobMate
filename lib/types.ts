/** 招呼语侧重点选项 */
export type FocusOption = 'none' | 'experience' | 'skills' | 'projects';

export const FOCUS_LABELS: Record<FocusOption, string> = {
  none: '通用',
  experience: '经验匹配',
  skills: '技能',
  projects: '项目经历',
};

export interface GenerateGreetingRequest {
  type: 'GENERATE_GREETING';
  jdText: string;
  focus: FocusOption;
}

export interface GenerateGreetingResponse {
  type: 'GENERATE_GREETING_RESULT';
  greeting?: string;
  error?: string;
}

export interface ValidateApiKeyRequest {
  type: 'VALIDATE_API_KEY';
  apiKey: string;
}

export interface ValidateApiKeyResponse {
  type: 'VALIDATE_API_KEY_RESULT';
  valid: boolean;
  error?: string;
}

export const STORAGE_KEYS = {
  API_KEY: 'deepseekApiKey',
  RESUME_TEXT: 'resumeText',
  RESUME_FILE_NAME: 'resumeFileName',
} as const;

export const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
export const DEEPSEEK_MODEL = 'deepseek-chat';
export const GENERATE_TIMEOUT_MS = 30_000;
