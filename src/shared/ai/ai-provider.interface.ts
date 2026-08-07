export interface GenerateParams {
  model: string;
  prompt: string;
  maxTokens?: number;
}

export interface GenerateUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface GenerateResult {
  content: string;
  usage: GenerateUsage;
}

export interface AIProvider {
  generate(params: GenerateParams): Promise<GenerateResult>;
}
