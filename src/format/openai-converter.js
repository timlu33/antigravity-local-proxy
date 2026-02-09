/**
 * OpenAI Format Converter
 * Converts between OpenAI Chat Completions API and Anthropic Messages API
 */

import crypto from 'crypto';

/**
 * Convert OpenAI Chat Completions request to Anthropic Messages API format
 * @param {Object} openaiRequest - OpenAI format request
 * @returns {Object} Anthropic format request
 */
export function convertOpenAIToAnthropic(openaiRequest) {
    const {
        model,
        messages,
        temperature,
        top_p,
        max_tokens,
        stream,
        tools,
        tool_choice,
        stop
    } = openaiRequest;

    const anthropicRequest = {
        model: model || 'claude-3-5-sonnet-20241022',
        messages: [],
        max_tokens: max_tokens || 4096,
        stream: stream || false
    };

    // Extract system message and convert to system field
    let systemMessage = null;
    const nonSystemMessages = [];

    for (const msg of messages || []) {
        if (msg.role === 'system') {
            // Combine multiple system messages if present
            if (systemMessage) {
                systemMessage += '\n\n' + msg.content;
            } else {
                systemMessage = msg.content;
            }
        } else {
            nonSystemMessages.push(msg);
        }
    }

    if (systemMessage) {
        anthropicRequest.system = systemMessage;
    }

    // Convert messages
    for (const msg of nonSystemMessages) {
        if (msg.role === 'user') {
            // Handle user message
            if (typeof msg.content === 'string') {
                anthropicRequest.messages.push({
                    role: 'user',
                    content: msg.content
                });
            } else if (Array.isArray(msg.content)) {
                // OpenAI supports content array for multimodal
                const anthropicContent = msg.content.map(part => {
                    if (part.type === 'text') {
                        return { type: 'text', text: part.text };
                    } else if (part.type === 'image_url') {
                        // Convert OpenAI image format to Anthropic
                        const imageUrl = part.image_url?.url || part.image_url;
                        if (imageUrl.startsWith('data:')) {
                            // Extract base64 data
                            const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
                            if (matches) {
                                return {
                                    type: 'image',
                                    source: {
                                        type: 'base64',
                                        media_type: matches[1],
                                        data: matches[2]
                                    }
                                };
                            }
                        }
                        // Fall back to URL format (if supported)
                        return {
                            type: 'image',
                            source: {
                                type: 'url',
                                url: imageUrl
                            }
                        };
                    }
                    return part;
                });
                anthropicRequest.messages.push({
                    role: 'user',
                    content: anthropicContent
                });
            }
        } else if (msg.role === 'assistant') {
            // Handle assistant message
            const content = [];

            // Add text content if present
            if (msg.content) {
                content.push({
                    type: 'text',
                    text: msg.content
                });
            }

            // Convert tool_calls to tool_use blocks
            if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
                for (const toolCall of msg.tool_calls) {
                    if (toolCall.type === 'function') {
                        content.push({
                            type: 'tool_use',
                            id: toolCall.id,
                            name: toolCall.function.name,
                            input: typeof toolCall.function.arguments === 'string'
                                ? JSON.parse(toolCall.function.arguments)
                                : toolCall.function.arguments
                        });
                    }
                }
            }

            if (content.length > 0) {
                anthropicRequest.messages.push({
                    role: 'assistant',
                    content: content
                });
            }
        } else if (msg.role === 'tool') {
            // Convert tool message to user message with tool_result
            anthropicRequest.messages.push({
                role: 'user',
                content: [{
                    type: 'tool_result',
                    tool_use_id: msg.tool_call_id,
                    content: msg.content
                }]
            });
        }
    }

    // Add generation parameters
    if (temperature !== undefined) {
        anthropicRequest.temperature = temperature;
    }
    if (top_p !== undefined) {
        anthropicRequest.top_p = top_p;
    }
    if (stop && Array.isArray(stop)) {
        anthropicRequest.stop_sequences = stop;
    }

    // Convert tools
    if (tools && Array.isArray(tools)) {
        anthropicRequest.tools = tools.map(tool => {
            if (tool.type === 'function') {
                return {
                    name: tool.function.name,
                    description: tool.function.description || '',
                    input_schema: tool.function.parameters || { type: 'object' }
                };
            }
            return tool;
        });
    }

    // Handle tool_choice
    if (tool_choice) {
        if (typeof tool_choice === 'string') {
            if (tool_choice === 'none') {
                anthropicRequest.tool_choice = { type: 'none' };
            } else if (tool_choice === 'auto') {
                anthropicRequest.tool_choice = { type: 'auto' };
            } else if (tool_choice === 'required') {
                anthropicRequest.tool_choice = { type: 'any' };
            }
        } else if (tool_choice.type === 'function') {
            anthropicRequest.tool_choice = {
                type: 'tool',
                name: tool_choice.function.name
            };
        }
    }

    return anthropicRequest;
}

/**
 * Convert Anthropic Messages API response to OpenAI Chat Completions format
 * @param {Object} anthropicResponse - Anthropic format response
 * @param {string} model - Model name
 * @param {boolean} isStreaming - Whether this is a streaming response
 * @returns {Object} OpenAI format response
 */
export function convertAnthropicToOpenAI(anthropicResponse, model, isStreaming = false) {
    // Handle streaming events
    if (isStreaming && anthropicResponse.type) {
        return convertStreamingEventToOpenAI(anthropicResponse, model);
    }

    // Handle non-streaming response
    const content = anthropicResponse.content || [];

    // Extract text and tool calls
    let textContent = '';
    const toolCalls = [];

    for (const block of content) {
        if (block.type === 'text') {
            textContent += block.text;
        } else if (block.type === 'tool_use') {
            toolCalls.push({
                id: block.id,
                type: 'function',
                function: {
                    name: block.name,
                    arguments: JSON.stringify(block.input)
                }
            });
        }
    }

    const choice = {
        index: 0,
        message: {
            role: 'assistant',
            content: textContent || null
        },
        finish_reason: mapStopReason(anthropicResponse.stop_reason)
    };

    if (toolCalls.length > 0) {
        choice.message.tool_calls = toolCalls;
        choice.finish_reason = 'tool_calls';
    }

    // Build OpenAI response
    const openaiResponse = {
        id: anthropicResponse.id || `chatcmpl-${crypto.randomBytes(12).toString('hex')}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [choice],
        usage: {
            prompt_tokens: anthropicResponse.usage?.input_tokens || 0,
            completion_tokens: anthropicResponse.usage?.output_tokens || 0,
            total_tokens: (anthropicResponse.usage?.input_tokens || 0) + (anthropicResponse.usage?.output_tokens || 0)
        }
    };

    return openaiResponse;
}

/**
 * Convert Anthropic streaming event to OpenAI streaming event
 * @param {Object} event - Anthropic SSE event
 * @param {string} model - Model name
 * @returns {Object} OpenAI SSE event
 */
function convertStreamingEventToOpenAI(event, model) {
    const eventType = event.type;

    switch (eventType) {
        case 'message_start':
            return {
                id: event.message?.id || `chatcmpl-${crypto.randomBytes(12).toString('hex')}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [{
                    index: 0,
                    delta: { role: 'assistant', content: '' },
                    finish_reason: null
                }]
            };

        case 'content_block_start':
            if (event.content_block?.type === 'tool_use') {
                return {
                    id: event.message?.id || `chatcmpl-${crypto.randomBytes(12).toString('hex')}`,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: model,
                    choices: [{
                        index: 0,
                        delta: {
                            tool_calls: [{
                                index: event.index || 0,
                                id: event.content_block.id,
                                type: 'function',
                                function: {
                                    name: event.content_block.name,
                                    arguments: ''
                                }
                            }]
                        },
                        finish_reason: null
                    }]
                };
            }
            return null;

        case 'content_block_delta':
            if (event.delta?.type === 'text_delta') {
                return {
                    id: `chatcmpl-${crypto.randomBytes(12).toString('hex')}`,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: model,
                    choices: [{
                        index: 0,
                        delta: { content: event.delta.text },
                        finish_reason: null
                    }]
                };
            } else if (event.delta?.type === 'input_json_delta') {
                return {
                    id: `chatcmpl-${crypto.randomBytes(12).toString('hex')}`,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: model,
                    choices: [{
                        index: 0,
                        delta: {
                            tool_calls: [{
                                index: event.index || 0,
                                function: {
                                    arguments: event.delta.partial_json
                                }
                            }]
                        },
                        finish_reason: null
                    }]
                };
            }
            return null;

        case 'message_delta':
            return {
                id: `chatcmpl-${crypto.randomBytes(12).toString('hex')}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [{
                    index: 0,
                    delta: {},
                    finish_reason: mapStopReason(event.delta?.stop_reason)
                }],
                usage: event.usage ? {
                    prompt_tokens: event.usage.input_tokens || 0,
                    completion_tokens: event.usage.output_tokens || 0,
                    total_tokens: (event.usage.input_tokens || 0) + (event.usage.output_tokens || 0)
                } : undefined
            };

        case 'message_stop':
            return {
                id: `chatcmpl-${crypto.randomBytes(12).toString('hex')}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [{
                    index: 0,
                    delta: {},
                    finish_reason: 'stop'
                }]
            };

        case 'error':
            return {
                error: {
                    message: event.error?.message || 'Unknown error',
                    type: event.error?.type || 'api_error',
                    code: event.error?.code || null
                }
            };

        default:
            return null;
    }
}

/**
 * Map Anthropic stop_reason to OpenAI finish_reason
 * @param {string} stopReason - Anthropic stop_reason
 * @returns {string} OpenAI finish_reason
 */
function mapStopReason(stopReason) {
    switch (stopReason) {
        case 'end_turn':
            return 'stop';
        case 'max_tokens':
            return 'length';
        case 'tool_use':
            return 'tool_calls';
        case 'stop_sequence':
            return 'stop';
        default:
            return stopReason || null;
    }
}
