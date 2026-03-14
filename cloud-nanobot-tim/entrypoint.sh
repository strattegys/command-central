#!/bin/bash
set -e

# Prevent nanobot from auto-detecting Anthropic and using assistant prefill
# (Claude 4.6 removed prefill support, causing 400 errors)
unset ANTHROPIC_API_KEY

CONFIG_FILE="/root/.nanobot/config.json"

# Substitute environment variables in config.json
envsubst < "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"

# Substitute environment variables in tool scripts
for tool in /root/.nanobot/tools/*.sh; do
    envsubst < "$tool" > "${tool}.tmp" && mv "${tool}.tmp" "$tool"
    chmod +x "$tool"
done

echo "Starting Nanobot Tim..."
exec nanobot gateway
