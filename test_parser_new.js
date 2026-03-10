const ResponseParser = require('./src/utils/ResponseParser');

const testCases = [
    {
        name: "Normal Order (Mem -> Act -> Rep)",
        input: "[GOLEM_MEMORY] fact [GOLEM_ACTION] ```json [{\"action\": \"command\"}] ``` [GOLEM_REPLY] Hello world"
    },
    {
        name: "Swapped Order (Mem -> Rep -> Act)",
        input: "[GOLEM_MEMORY] fact [GOLEM_REPLY] Hello world [GOLEM_ACTION] ```json [{\"action\": \"command\"}] ```"
    },
    {
        name: "Action First (Act -> Rep)",
        input: "[GOLEM_ACTION] ```json [{\"action\": \"command\"}] ``` [GOLEM_REPLY] All done"
    },
    {
        name: "Reply First (Rep -> Act)",
        input: "[GOLEM_REPLY] All done [GOLEM_ACTION] ```json [{\"action\": \"command\"}] ```"
    }
];

testCases.forEach(tc => {
    console.log(`--- Test: ${tc.name} ---`);
    const result = ResponseParser.parse(tc.input);
    console.log("Memory:", result.memory);
    console.log("Actions:", result.actions.length);
    console.log("Reply:", result.reply);
    console.log("");
});
