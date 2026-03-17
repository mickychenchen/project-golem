const LanceDBMemoryDriver = require('../src/memory/LanceDBMemoryDriver');
const path = require('path');
const fs = require('fs');

async function testDriver() {
    console.log("🧪 Starting LanceDBMemoryDriver test...");
    const driver = new LanceDBMemoryDriver();
    
    try {
        // 1. Init
        await driver.init();
        console.log("✅ Initialization successful");

        // 2. Clear old data if any
        await driver.clearMemory();
        console.log("✅ Clear memory successful");

        // 3. Memorize
        console.log("📝 Storing some memories...");
        await driver.memorize("My favorite color is blue.", { importance: 0.8, type: 'personal' });
        await driver.memorize("The capital of France is Paris.", { importance: 0.5, type: 'fact' });
        await driver.memorize("I am a software engineer.", { importance: 0.9, type: 'work' });

        // 4. Recall
        console.log("🔍 Testing recall...");
        const results = await driver.recall("What is my job?");
        console.log("Recall results for 'What is my job?':");
        results.forEach((r, i) => console.log(`${i+1}. [Score: ${r.score.toFixed(4)}] ${r.text}`));

        if (results.length > 0 && results[0].text.includes("software engineer")) {
            console.log("✅ Recall match successful!");
        } else {
            console.log("❌ Recall match failed.");
        }

        const factResults = await driver.recall("Where is Paris?");
        console.log("Recall results for 'Where is Paris?':");
        factResults.forEach((r, i) => console.log(`${i+1}. [Score: ${r.score.toFixed(4)}] ${r.text}`));

        if (factResults.length > 0 && factResults[0].text.includes("France")) {
            console.log("✅ Fact recall successful!");
        } else {
            console.log("❌ Fact recall failed.");
        }

    } catch (e) {
        console.error("❌ Test failed with error:", e);
    }
}

testDriver();
