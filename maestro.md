# Maestro Workflow Context
Generated: 2026-07-21

## Models & Providers
- **Primary Model**: Gemini 3.6 Flash
- **Interface/Environment**: IDE Agent Environment
- **Context Window Size**: ~1,000,000 tokens

## Workflow Architecture
- **Overview**: High-level task flow where the user defines web application development and refactoring tasks. The AI agent generates/modifies code and executes shell commands.
- **Agent System**: Multi-agent / Subagent orchestration architecture.
- **Available Tools**: File read/write, terminal command execution, web search.

## Quality & Evaluation
- **Evaluation Method**: Direct code/UI review.
- **Test Cases / Golden Examples**: None currently configured.
- **Primary Failure Mode**: Regressions (fixing one part of the codebase breaks another part).

## Constraints
- **Cost Constraints**: No strict budget constraints.
- **Latency Requirements**: Not critical.
- **Compliance & Security**: Standard project constraints; no specialized regulatory compliance required.

## Priorities
1. **Quality** (Highest)
2. **Safety**
3. **Speed**
4. **Cost** (Lowest)

### Core Objective
Eliminate code regressions during refactoring and feature implementation.
