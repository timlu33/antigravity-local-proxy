/**
 * Format Converter Module
 * Converts between Anthropic Messages API format and Google Generative AI format
 * Also supports OpenAI and Gemini native formats
 */

// Re-export all from each module
export * from './request-converter.js';
export * from './response-converter.js';
export * from './content-converter.js';
export * from './schema-sanitizer.js';
export * from './thinking-utils.js';
export * from './openai-converter.js';
export * from './gemini-converter.js';

// Default export for backward compatibility
import { convertAnthropicToGoogle } from './request-converter.js';
import { convertGoogleToAnthropic } from './response-converter.js';
import { convertOpenAIToAnthropic, convertAnthropicToOpenAI } from './openai-converter.js';
import { convertGeminiToAnthropic, convertAnthropicToGemini } from './gemini-converter.js';

export default {
    convertAnthropicToGoogle,
    convertGoogleToAnthropic,
    convertOpenAIToAnthropic,
    convertAnthropicToOpenAI,
    convertGeminiToAnthropic,
    convertAnthropicToGemini
};
