/**
 * Gemini Native Format Converter
 * Converts between Gemini (Google AI) API and Anthropic Messages API
 */

import crypto from 'crypto';

/**
 * Convert Gemini generateContent request to Anthropic Messages API format
 * @param {Object} geminiRequest - Gemini format request
 * @param {string} model - Model name from URL path
 * @returns {Object} Anthropic format request
 */
export function convertGeminiToAnthropic(geminiRequest, model) {
    const {
        contents,
        systemInstruction,
        generationConfig,
        tools
    } = geminiRequest;

    const anthropicRequest = {
        model: model || 'gemini-3-flash',
        messages: [],
        max_tokens: generationConfig?.maxOutputTokens || 4096
    };

    // Convert system instruction
    if (systemInstruction) {
        if (typeof systemInstruction === 'string') {
            anthropicRequest.system = systemInstruction;
        } else if (systemInstruction.parts) {
            anthropicRequest.system = systemInstruction.parts
                .filter(p => p.text)
                .map(p => p.text)
                .join('\n\n');
        }
    }

    // Convert contents to messages
    for (const content of contents || []) {
        const role = content.role === 'model' ? 'assistant' : content.role;
        const parts = content.parts || [];

        const anthropicContent = [];

        for (const part of parts) {
            if (part.text !== undefined) {
                // Handle thinking blocks
                if (part.thought === true) {
                    anthropicContent.push({
                        type: 'thinking',
                        thinking: part.text,
                        signature: part.thoughtSignature || ''
                    });
                } else {
                    anthropicContent.push({
                        type: 'text',
                        text: part.text
                    });
                }
            } else if (part.functionCall) {
                // Convert functionCall to tool_use
                anthropicContent.push({
                    type: 'tool_use',
                    id: part.functionCall.id || `toolu_${crypto.randomBytes(12).toString('hex')}`,
                    name: part.functionCall.name,
                    input: part.functionCall.args || {}
                });
            } else if (part.functionResponse) {
                // Convert functionResponse to tool_result
                anthropicContent.push({
                    type: 'tool_result',
                    tool_use_id: part.functionResponse.name, // Gemini uses name as ID
                    content: JSON.stringify(part.functionResponse.response)
                });
            } else if (part.inlineData) {
                // Handle image content
                anthropicContent.push({
                    type: 'image',
                    source: {
                        type: 'base64',
                        media_type: part.inlineData.mimeType,
                        data: part.inlineData.data
                    }
                });
            } else if (part.fileData) {
                // Handle file content (convert to appropriate format)
                anthropicContent.push({
                    type: 'document',
                    source: {
                        type: 'base64',
                        media_type: part.fileData.mimeType,
                        data: part.fileData.fileUri
                    }
                });
            }
        }

        if (anthropicContent.length > 0) {
            // Group tool_result blocks with user role
            const hasToolResult = anthropicContent.some(c => c.type === 'tool_result');
            anthropicRequest.messages.push({
                role: hasToolResult ? 'user' : role,
                content: anthropicContent
            });
        }
    }

    // Add generation parameters
    if (generationConfig) {
        if (generationConfig.temperature !== undefined) {
            anthropicRequest.temperature = generationConfig.temperature;
        }
        if (generationConfig.topP !== undefined) {
            anthropicRequest.top_p = generationConfig.topP;
        }
        if (generationConfig.topK !== undefined) {
            anthropicRequest.top_k = generationConfig.topK;
        }
        if (generationConfig.stopSequences) {
            anthropicRequest.stop_sequences = generationConfig.stopSequences;
        }
    }

    // Convert tools
    if (tools && Array.isArray(tools)) {
        anthropicRequest.tools = [];
        for (const tool of tools) {
            if (tool.functionDeclarations) {
                for (const func of tool.functionDeclarations) {
                    anthropicRequest.tools.push({
                        name: func.name,
                        description: func.description || '',
                        input_schema: func.parameters || { type: 'object' }
                    });
                }
            }
        }
    }

    return anthropicRequest;
}

/**
 * Convert Anthropic Messages API response to Gemini generateContent format
 * @param {Object} anthropicResponse - Anthropic format response
 * @param {string} model - Model name
 * @param {boolean} isStreaming - Whether this is a streaming response
 * @returns {Object} Gemini format response
 */
export function convertAnthropicToGemini(anthropicResponse, model, isStreaming = false) {
    // Handle streaming events
    if (isStreaming && anthropicResponse.type) {
        return convertStreamingEventToGemini(anthropicResponse, model);
    }

    // Handle non-streaming response
    const content = anthropicResponse.content || [];
    const parts = [];

    for (const block of content) {
        if (block.type === 'text') {
            parts.push({ text: block.text });
        } else if (block.type === 'thinking') {
            parts.push({
                text: block.thinking,
                thought: true,
                thoughtSignature: block.signature || ''
            });
        } else if (block.type === 'tool_use') {
            parts.push({
                functionCall: {
                    id: block.id,
                    name: block.name,
                    args: block.input
                }
            });
        } else if (block.type === 'image') {
            parts.push({
                inlineData: {
                    mimeType: block.source.media_type,
                    data: block.source.data
                }
            });
        }
    }

    const geminiResponse = {
        candidates: [{
            content: {
                parts: parts,
                role: 'model'
            },
            finishReason: mapStopReasonToGemini(anthropicResponse.stop_reason),
            index: 0
        }],
        usageMetadata: {
            promptTokenCount: anthropicResponse.usage?.input_tokens || 0,
            candidatesTokenCount: anthropicResponse.usage?.output_tokens || 0,
            totalTokenCount: (anthropicResponse.usage?.input_tokens || 0) + (anthropicResponse.usage?.output_tokens || 0)
        }
    };

    return geminiResponse;
}

/**
 * Convert Anthropic streaming event to Gemini streaming event
 * @param {Object} event - Anthropic SSE event
 * @param {string} model - Model name
 * @returns {Object} Gemini SSE event
 */
function convertStreamingEventToGemini(event, model) {
    const eventType = event.type;

    switch (eventType) {
        case 'message_start':
            return {
                candidates: [{
                    content: {
                        parts: [],
                        role: 'model'
                    },
                    index: 0
                }]
            };

        case 'content_block_start':
            if (event.content_block?.type === 'tool_use') {
                return {
                    candidates: [{
                        content: {
                            parts: [{
                                functionCall: {
                                    id: event.content_block.id,
                                    name: event.content_block.name,
                                    args: {}
                                }
                            }],
                            role: 'model'
                        },
                        index: 0
                    }]
                };
            } else if (event.content_block?.type === 'thinking') {
                return {
                    candidates: [{
                        content: {
                            parts: [{
                                text: '',
                                thought: true,
                                thoughtSignature: event.content_block.signature || ''
                            }],
                            role: 'model'
                        },
                        index: 0
                    }]
                };
            }
            return null;

        case 'content_block_delta':
            if (event.delta?.type === 'text_delta') {
                return {
                    candidates: [{
                        content: {
                            parts: [{ text: event.delta.text }],
                            role: 'model'
                        },
                        index: 0
                    }]
                };
            } else if (event.delta?.type === 'thinking_delta') {
                return {
                    candidates: [{
                        content: {
                            parts: [{
                                text: event.delta.thinking,
                                thought: true
                            }],
                            role: 'model'
                        },
                        index: 0
                    }]
                };
            } else if (event.delta?.type === 'input_json_delta') {
                // For function call arguments streaming
                return {
                    candidates: [{
                        content: {
                            parts: [{
                                functionCall: {
                                    args: event.delta.partial_json
                                }
                            }],
                            role: 'model'
                        },
                        index: 0
                    }]
                };
            }
            return null;

        case 'message_delta':
            return {
                candidates: [{
                    finishReason: mapStopReasonToGemini(event.delta?.stop_reason),
                    index: 0
                }],
                usageMetadata: event.usage ? {
                    promptTokenCount: event.usage.input_tokens || 0,
                    candidatesTokenCount: event.usage.output_tokens || 0,
                    totalTokenCount: (event.usage.input_tokens || 0) + (event.usage.output_tokens || 0)
                } : undefined
            };

        case 'message_stop':
            return {
                candidates: [{
                    finishReason: 'STOP',
                    index: 0
                }]
            };

        case 'error':
            return {
                error: {
                    message: event.error?.message || 'Unknown error',
                    code: 500,
                    status: event.error?.type || 'INTERNAL'
                }
            };

        default:
            return null;
    }
}

/**
 * Map Anthropic stop_reason to Gemini finishReason
 * @param {string} stopReason - Anthropic stop_reason
 * @returns {string} Gemini finishReason
 */
function mapStopReasonToGemini(stopReason) {
    switch (stopReason) {
        case 'end_turn':
            return 'STOP';
        case 'max_tokens':
            return 'MAX_TOKENS';
        case 'tool_use':
            return 'TOOL_USE';
        case 'stop_sequence':
            return 'STOP';
        default:
            return 'STOP';
    }
}
