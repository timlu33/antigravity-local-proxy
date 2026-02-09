# Antigravity Claude Proxy

[![npm version](https://img.shields.io/npm/v/antigravity-claude-proxy.svg)](https://www.npmjs.com/package/antigravity-claude-proxy)
[![npm downloads](https://img.shields.io/npm/dm/antigravity-claude-proxy.svg)](https://www.npmjs.com/package/antigravity-claude-proxy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A proxy server that exposes **Anthropic, OpenAI, and Gemini compatible APIs** backed by **Antigravity's Cloud Code**, letting you use Claude and Gemini models with **Claude Code CLI**, **OpenAI SDKs**, **Google AI SDKs**, and other AI tools.

![Antigravity Claude Proxy Banner](images/banner.png)

<details>
<summary><strong>⚠️ Terms of Service Warning — Read Before Installing</strong></summary>

> [!CAUTION]
> Using this proxy may violate Google's Terms of Service. A small number of users have reported their Google accounts being **banned** or **shadow-banned** (restricted access without explicit notification).
>
> **High-risk scenarios:**
> - 🚨 **Fresh Google accounts** have a very high chance of getting banned
> - 🚨 **New accounts with Pro/Ultra subscriptions** are frequently flagged and banned
>
> **By using this proxy, you acknowledge:**
> - This is an unofficial tool not endorsed by Google
> - Your account may be suspended or permanently banned
> - You assume all risks associated with using this proxy
>
> **Recommendation:** Use an established Google account that you don't rely on for critical services. Avoid creating new accounts specifically for this proxy.

</details>

---

## How It Works

```
┌──────────────────┐     ┌─────────────────────┐     ┌────────────────────────────┐
│  AI Clients      │────▶│  This Proxy Server  │────▶│  Antigravity Cloud Code    │
│  - Claude Code   │     │  Multi-format API   │     │  (daily-cloudcode-pa.      │
│  - OpenAI SDK    │     │  Converter          │     │   sandbox.googleapis.com)  │
│  - Gemini SDK    │     │                     │     │                            │
└──────────────────┘     └─────────────────────┘     └────────────────────────────┘
```

**Supported API Formats:**
- **Anthropic Messages API** (`/v1/messages`) - For Claude Code CLI, OpenClaw, etc.
- **OpenAI Chat Completions API** (`/v1/chat/completions`) - For OpenAI SDKs and compatible tools
- **Gemini (Google AI) API** (`/v1/models/{model}:generateContent`) - For Google AI SDKs

**Request Flow:**
1. Receives requests in Anthropic, OpenAI, or Gemini format
2. Uses OAuth tokens from added Google accounts (or Antigravity's local database)
3. Converts all formats to Anthropic Messages API format (internal)
4. Transforms to **Google Generative AI format** with Cloud Code wrapping
5. Sends to Antigravity's Cloud Code API
6. Converts responses back to the **original request format** with full thinking/streaming support

## Prerequisites

- **Node.js** 18 or later
- **Antigravity** installed (for single-account mode) OR Google account(s) for multi-account mode

---

## Installation

### Clone Repository

```bash
git clone https://github.com/badri-s2001/antigravity-claude-proxy.git
cd antigravity-claude-proxy
npm install
npm start
```

---

## Quick Start

### 1. Start the Proxy Server

```bash
npm start
```

The server runs on `http://localhost:8080` by default.

### 2. Link Account(s)

Choose one of the following methods to authorize the proxy:

#### **Web Dashboard **

1. With the proxy running, open `http://localhost:8080` in your browser.
2. Navigate to the **Accounts** tab and click **Add Account**.
3. Complete the Google OAuth authorization in the popup window.

> **Headless/Remote Servers**: If running on a server without a browser, the WebUI supports a "Manual Authorization" mode. After clicking "Add Account", you can copy the OAuth URL, complete authorization on your local machine, and paste the authorization code back.

### 3. Verify It's Working

```bash
# Health check
curl http://localhost:8080/health

# Check account status and quota limits
curl "http://localhost:8080/account-limits?format=table"
```

---

## Using with Claude Code CLI

### Configure Claude Code

You can configure these settings in two ways:

#### **Via Web Console (Recommended)**

1. Open the WebUI at `http://localhost:8080`.
2. Go to **Settings** → **Claude CLI**.
3. Use the **Connection Mode** toggle to switch between:
   - **Proxy Mode**: Uses the local proxy server (Antigravity Cloud Code). Configure models, base URL, and presets here.
   - **Paid Mode**: Uses the official Anthropic Credits directly (requires your own subscription). This hides proxy settings to prevent accidental misconfiguration.
4. Click **Apply to Claude CLI** to save your changes.

> [!TIP] > **Configuration Precedence**: System environment variables (set in shell profile like `.zshrc`) take precedence over the `settings.json` file. If you use the Web Console to manage settings, ensure you haven't manually exported conflicting variables in your terminal.

#### **Manual Configuration**

Create or edit the Claude Code settings file:

**macOS:** `~/.claude/settings.json`
**Linux:** `~/.claude/settings.json`
**Windows:** `%USERPROFILE%\.claude\settings.json`

Add this configuration:

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "test",
    "ANTHROPIC_BASE_URL": "http://localhost:8080",
    "ANTHROPIC_MODEL": "claude-opus-4-5-thinking",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-5-thinking",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-5-thinking",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-sonnet-4-5",
    "CLAUDE_CODE_SUBAGENT_MODEL": "claude-sonnet-4-5-thinking",
    "ENABLE_EXPERIMENTAL_MCP_CLI": "true"
  }
}
```

Or to use Gemini models:

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "test",
    "ANTHROPIC_BASE_URL": "http://localhost:8080",
    "ANTHROPIC_MODEL": "gemini-3-pro-high[1m]",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "gemini-3-pro-high[1m]",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "gemini-3-flash[1m]",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "gemini-3-flash[1m]",
    "CLAUDE_CODE_SUBAGENT_MODEL": "gemini-3-flash[1m]",
    "ENABLE_EXPERIMENTAL_MCP_CLI": "true"
  }
}
```

### Load Environment Variables

Add the proxy settings to your shell profile:

**macOS / Linux:**

```bash
echo 'export ANTHROPIC_BASE_URL="http://localhost:8080"' >> ~/.zshrc
echo 'export ANTHROPIC_AUTH_TOKEN="test"' >> ~/.zshrc
source ~/.zshrc
```

> For Bash users, replace `~/.zshrc` with `~/.bashrc`

**Windows (PowerShell):**

```powershell
Add-Content $PROFILE "`n`$env:ANTHROPIC_BASE_URL = 'http://localhost:8080'"
Add-Content $PROFILE "`$env:ANTHROPIC_AUTH_TOKEN = 'test'"
. $PROFILE
```

**Windows (Command Prompt):**

```cmd
setx ANTHROPIC_BASE_URL "http://localhost:8080"
setx ANTHROPIC_AUTH_TOKEN "test"
```

Restart your terminal for changes to take effect.

### Run Claude Code

```bash
# Make sure the proxy is running first
npm start

# In another terminal, run Claude Code
claude
```

> **Note:** If Claude Code asks you to select a login method, add `"hasCompletedOnboarding": true` to `~/.claude.json` (macOS/Linux) or `%USERPROFILE%\.claude.json` (Windows), then restart your terminal and try again.

### Proxy Mode vs. Paid Mode

Toggle in **Settings** → **Claude CLI**:

| Feature | 🔌 Proxy Mode | 💳 Paid Mode |
| :--- | :--- | :--- |
| **Backend** | Local Server (Antigravity) | Official Anthropic Credits |
| **Cost** | Free (Google Cloud) | Paid (Anthropic Credits) |
| **Models** | Claude + Gemini | Claude Only |

**Paid Mode** automatically clears proxy settings so you can use your official Anthropic account directly.

### Multiple Claude Code Instances (Optional)

To run both the official Claude Code and Antigravity version simultaneously, add this alias:

**macOS / Linux:**

```bash
# Add to ~/.zshrc or ~/.bashrc
alias claude-antigravity='CLAUDE_CONFIG_DIR=~/.claude-account-antigravity ANTHROPIC_BASE_URL="http://localhost:8080" ANTHROPIC_AUTH_TOKEN="test" command claude'
```

**Windows (PowerShell):**

```powershell
# Add to $PROFILE
function claude-antigravity {
    $env:CLAUDE_CONFIG_DIR = "$env:USERPROFILE\.claude-account-antigravity"
    $env:ANTHROPIC_BASE_URL = "http://localhost:8080"
    $env:ANTHROPIC_AUTH_TOKEN = "test"
    claude
}
```

Then run `claude` for official API or `claude-antigravity` for this proxy.

---

## API Formats

The proxy supports three API formats, all backed by the same Antigravity Cloud Code service:

### 1. Anthropic Messages API (Default)

**Endpoint:** `POST /v1/messages`

This is the default format used by Claude Code CLI and OpenClaw.

**Example:**

```bash
curl http://localhost:8080/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: test" \
  -d '{
    "model": "claude-sonnet-4-5-thinking",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "max_tokens": 1024
  }'
```

**With Python SDK:**

```python
from anthropic import Anthropic

client = Anthropic(
    api_key="test",
    base_url="http://localhost:8080"
)

response = client.messages.create(
    model="claude-sonnet-4-5-thinking",
    messages=[{"role": "user", "content": "Hello!"}],
    max_tokens=1024
)
print(response.content[0].text)
```

### 2. OpenAI Chat Completions API

**Endpoint:** `POST /v1/chat/completions`

Compatible with OpenAI SDKs and tools that use the OpenAI API format.

**Example:**

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test" \
  -d '{
    "model": "gemini-3-flash",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "max_tokens": 1024
  }'
```

**With OpenAI Python SDK:**

```python
from openai import OpenAI

client = OpenAI(
    api_key="test",
    base_url="http://localhost:8080/v1"
)

response = client.chat.completions.create(
    model="gemini-3-flash",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"}
    ],
    max_tokens=1024
)
print(response.choices[0].message.content)
```

**Streaming:**

```python
stream = client.chat.completions.create(
    model="gemini-3-flash",
    messages=[{"role": "user", "content": "Hello!"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### 3. Gemini (Google AI) API

**Endpoint:** `POST /v1/models/{model}:generateContent`
**Streaming:** `POST /v1/models/{model}:streamGenerateContent`

Compatible with Google AI SDKs and tools.

**Example:**

```bash
curl http://localhost:8080/v1/models/gemini-3-flash:generateContent \
  -H "Content-Type: application/json" \
  -H "x-api-key: test" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [{"text": "Hello!"}]
      }
    ],
    "generationConfig": {
      "maxOutputTokens": 1024
    }
  }'
```

**With Google AI Python SDK:**

```python
import google.generativeai as genai

# Configure to use the proxy
genai.configure(
    api_key="test",
    transport="rest",
    client_options={"api_endpoint": "http://localhost:8080/v1"}
)

model = genai.GenerativeModel("gemini-3-flash")
response = model.generate_content("Hello!")
print(response.text)
```

**Streaming:**

```python
response = model.generate_content("Hello!", stream=True)
for chunk in response:
    print(chunk.text, end="")
```

### Model Compatibility

All three API formats support the same models:

| Model ID | Type | Context |
| --- | --- | --- |
| `claude-opus-4-5-thinking` | Claude Opus with thinking | 200K |
| `claude-sonnet-4-5-thinking` | Claude Sonnet with thinking | 200K |
| `claude-sonnet-4-5` | Claude Sonnet (fast) | 200K |
| `gemini-3-pro-high` | Gemini 3 Pro (high quality) | 2M |
| `gemini-3-pro-low` | Gemini 3 Pro (balanced) | 2M |
| `gemini-3-flash` | Gemini 3 Flash (fast) | 1M |

Use `/v1/models` endpoint to see the full list of available models.

---

## Documentation

- [Available Models](docs/models.md)
- [Multi-Account Load Balancing](docs/load-balancing.md)
- [Web Management Console](docs/web-console.md)
- [Advanced Configuration](docs/configuration.md)
- [macOS Menu Bar App](docs/menubar-app.md)
- [OpenClaw / ClawdBot Integration](docs/openclaw.md)
- [API Endpoints](docs/api-endpoints.md)
- [Testing](docs/testing.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Safety, Usage, and Risk Notices](docs/safety-notices.md)
- [Legal](docs/legal.md)
- [Development](docs/development.md)

---

## Credits

This project is based on insights and code from:

- Forked from [badrisnarayanan/antigravity-claude-proxy](https://github.com/badrisnarayanan/antigravity-claude-proxy).
- [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) - Antigravity OAuth plugin for OpenCode
- [claude-code-proxy](https://github.com/1rgs/claude-code-proxy) - Anthropic API proxy using LiteLLM

---

## License

MIT

---
