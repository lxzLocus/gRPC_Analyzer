#!/usr/bin/env node

/**
 * Debug Test - デバッグ用のテストスクリプト
 */

console.log("🔍 Debug script starting...");
console.log("📋 Process arguments:", process.argv);
console.log("📁 Current working directory:", process.cwd());
console.log("💻 Node.js version:", process.version);

try {
    console.log("✅ Basic script execution working");
} catch (error) {
    console.error("❌ Error:", error.message);
}

console.log("🔍 Debug script completed.");
