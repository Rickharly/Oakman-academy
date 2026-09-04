import "dotenv/config";

// Tests always run against the mock AI provider and never touch Oak.
process.env.AI_PROVIDER = "mock";
process.env.CURRICULUM_PROVIDER = "fixture";
process.env.SESSION_SECRET ??= "test-session-secret";
