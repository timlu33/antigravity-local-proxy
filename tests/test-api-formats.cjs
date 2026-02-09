/**
 * Test script for all three API formats (Anthropic, OpenAI, Gemini)
 *
 * Run this test with the server running on port 8080:
 * node tests/test-api-formats.cjs
 */

const http = require('http');

// Test configuration
const BASE_URL = 'http://localhost:8080';
const API_KEY = 'test';

/**
 * Make HTTP request
 */
function makeRequest(method, path, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, data: json, headers: res.headers });
                } catch (e) {
                    resolve({ status: res.statusCode, data, headers: res.headers });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

/**
 * Test Anthropic Messages API
 */
async function testAnthropicAPI() {
    console.log('\n📝 Testing Anthropic Messages API...');

    const response = await makeRequest('POST', '/v1/messages', {
        'x-api-key': API_KEY
    }, {
        model: 'gemini-3-flash',
        messages: [
            { role: 'user', content: 'Say "Hello from Anthropic API" in exactly those words.' }
        ],
        max_tokens: 100
    });

    if (response.status === 200 && response.data.content) {
        const text = response.data.content.find(c => c.type === 'text')?.text || '';
        console.log('✅ Anthropic API test passed');
        console.log('   Response:', text.substring(0, 100));
        return true;
    } else {
        console.log('❌ Anthropic API test failed');
        console.log('   Status:', response.status);
        console.log('   Response:', JSON.stringify(response.data, null, 2));
        return false;
    }
}

/**
 * Test OpenAI Chat Completions API
 */
async function testOpenAIAPI() {
    console.log('\n💬 Testing OpenAI Chat Completions API...');

    const response = await makeRequest('POST', '/v1/chat/completions', {
        'Authorization': `Bearer ${API_KEY}`
    }, {
        model: 'gemini-3-flash',
        messages: [
            { role: 'user', content: 'Say "Hello from OpenAI API" in exactly those words.' }
        ],
        max_tokens: 100
    });

    if (response.status === 200 && response.data.choices) {
        const text = response.data.choices[0]?.message?.content || '';
        console.log('✅ OpenAI API test passed');
        console.log('   Response:', text.substring(0, 100));
        console.log('   Model:', response.data.model);
        console.log('   Usage:', JSON.stringify(response.data.usage));
        return true;
    } else {
        console.log('❌ OpenAI API test failed');
        console.log('   Status:', response.status);
        console.log('   Response:', JSON.stringify(response.data, null, 2));
        return false;
    }
}

/**
 * Test Gemini (Google AI) API
 */
async function testGeminiAPI() {
    console.log('\n🔷 Testing Gemini (Google AI) API...');

    const response = await makeRequest('POST', '/v1/models/gemini-3-flash:generateContent', {
        'x-api-key': API_KEY
    }, {
        contents: [
            {
                role: 'user',
                parts: [{ text: 'Say "Hello from Gemini API" in exactly those words.' }]
            }
        ],
        generationConfig: {
            maxOutputTokens: 100
        }
    });

    if (response.status === 200 && response.data.candidates) {
        const text = response.data.candidates[0]?.content?.parts?.[0]?.text || '';
        console.log('✅ Gemini API test passed');
        console.log('   Response:', text.substring(0, 100));
        console.log('   Finish reason:', response.data.candidates[0]?.finishReason);
        console.log('   Usage:', JSON.stringify(response.data.usageMetadata));
        return true;
    } else {
        console.log('❌ Gemini API test failed');
        console.log('   Status:', response.status);
        console.log('   Response:', JSON.stringify(response.data, null, 2));
        return false;
    }
}

/**
 * Test OpenAI streaming
 */
async function testOpenAIStreaming() {
    console.log('\n🌊 Testing OpenAI Streaming...');

    return new Promise((resolve, reject) => {
        const url = new URL('/v1/chat/completions', BASE_URL);
        const options = {
            method: 'POST',
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            }
        };

        const req = http.request(options, (res) => {
            let chunks = [];
            let hasData = false;

            res.on('data', chunk => {
                hasData = true;
                chunks.push(chunk.toString());
            });

            res.on('end', () => {
                if (hasData && chunks.length > 0) {
                    console.log('✅ OpenAI Streaming test passed');
                    console.log('   Received chunks:', chunks.length);
                    console.log('   Sample:', chunks[0].substring(0, 100));
                    resolve(true);
                } else {
                    console.log('❌ OpenAI Streaming test failed - no data received');
                    resolve(false);
                }
            });
        });

        req.on('error', (err) => {
            console.log('❌ OpenAI Streaming test failed:', err.message);
            resolve(false);
        });

        req.write(JSON.stringify({
            model: 'gemini-3-flash',
            messages: [
                { role: 'user', content: 'Count from 1 to 5.' }
            ],
            stream: true,
            max_tokens: 50
        }));

        req.end();
    });
}

/**
 * Run all tests
 */
async function runTests() {
    console.log('🧪 Starting API Format Tests');
    console.log('===========================');

    const results = [];

    try {
        results.push(await testAnthropicAPI());
        results.push(await testOpenAIAPI());
        results.push(await testGeminiAPI());
        results.push(await testOpenAIStreaming());
    } catch (error) {
        console.error('\n❌ Test error:', error.message);
        process.exit(1);
    }

    const passed = results.filter(r => r).length;
    const total = results.length;

    console.log('\n===========================');
    console.log(`📊 Test Results: ${passed}/${total} passed`);

    if (passed === total) {
        console.log('✅ All tests passed!');
        process.exit(0);
    } else {
        console.log('❌ Some tests failed');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
