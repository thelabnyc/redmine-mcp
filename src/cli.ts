#!/usr/bin/env node
import { startServer } from "./server.js";

async function main() {
    try {
        await startServer();
    } catch (error) {
        console.error("Failed to start Redmine MCP server:", error);
        process.exit(1);
    }
}

void main();
