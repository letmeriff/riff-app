Riff
Riff enables collaborative idea development. It is designed for professional teams and individuals to streamline rapid ideation and structured output generation.
It features an infinite, node-based canvas where users can create AI chat instances as nodes. Each chat node represents a conversation with an AI model, allowing users to generate, explore, and refine ideas efficiently.
It allows users to start with an idea, quickly develop it, branch out into parallel streams (nodes) of related ideas, riff on those ideas and when something valuable has emerged to structure it for better communication and creation of material to work with the developed ideas.
The app targets fast-paced environments like advertising agencies, startups, and academic research teams, bridging the gap between creative chaos and actionable deliverables.
Key aspects of RIFF include:
Real-time collaboration: Multiple users can work on a shared canvas, joining or creating chat nodes, with permissions to manage input conflicts.
Node-based AI chats: Each node is a chat instance with a chosen AI model and "Flavor" (a personality defined by system prompts), enabling diverse perspectives (e.g., a creative AI, a conservative AI, or a high-IQ venture capitalist).
Context management: Nodes can pull chat histories from other nodes, either in full, incrementally, or as summaries, to maintain evolving conversations.
Frameworks and templates: Frameworks guide users through structured initial conversations (e.g., a product interview), while templates extract and structure context into deliverables (e.g., a Product Requirements Document).
Branching and parallel workflows: Users can branch conversations into new nodes to explore ideas in parallel, pulling context from other nodes as needed to consolidate or refine outputs.
File attachments: Nodes support attaching files (e.g., PDFs, images) to enrich conversations.

Structured Feature Descriptions
Main Feature: Collaborative Node-Based AI Chat Canvas
Riff provides an infinite canvas where users can create, connect, and collaborate on AI chat nodes to ideate and produce structured outputs.
Sub-Features:
Real-Time Collaboration
Multiple users can work on a shared canvas.
Users can join existing chat nodes or create new ones.
Only one user can write in a chat node at a time (node owner, assigned during node creation).
Users can create parallel chat nodes to work independently, pulling context from other nodes.
Visual indicators show which users are in a node (e.g., dots with initials) and if someone is writing.
Context Management Across Nodes
Nodes can pull chat histories from other nodes (full history, incremental updates, or summaries).
Connections between nodes are visually represented by connections between nodes on the canvas.
Users can select specific parts of a chat history to pull or opt for a summarized version.
Pulled context is not displayed in the chat UI but is indicated with a placeholder.
Choice of AI Models and Flavors
Users can select an AI model for each chat node using a dropdown menu.
"Flavors" (predefined system prompts) give the AI a personality (e.g., creative, conservative, or venture capitalist).
Flavors can be applied when initializing a new chat node but a plain version is the default.
File Attachments
Users can attach files (e.g., PDFs, images) to chat nodes.
Attached files are visually indicated on the node (orange rectangles).
The chat UI shows when a file is attached, similar to context pull indicators.
Frameworks, Templates and Actions
Frameworks: Prompts that initiate a structured process to guide users through a set of questions in order to gather information (e.g., product development framework that guides users through a set of basic product related questions, providing a summary at the end).
Templates: Prompts that extract and structure context into deliverables (e.g., a Product Requirements Document or a story based on the context).
Actions: Actions allow users to quickly string together action sequences to accelerate processes like creating multiple branches from a single chat node, each with different flavors to continue the conversation in.
Users can edit frameworks, templates and actions on-the-fly.
A library sidebar in the chat UI allows users to access and favorite frameworks/templates/actions.
Frameworks/templates/actions are dragged onto the canvas and dropped onto individual nodes to apply them to the node or they can be dropped directly into the ChatUI.
Branching and Parallel Workflows
Users can branch a chat node, creating a duplicate with the same history to explore ideas in parallel.
Branched nodes can pull updated context from the original node or other nodes.
Parallel conversations can be consolidated later using templates.

Example user flows:
develop a website where you start with the initial conversation then branch out and have every page be a different conversation and then pull it into a page framework
develop an app where you develop and riff on the initial idea and then branch out to develop individual features then have each feature extracted with an implementation plan prompt.
Grow and consolidate: Quickly branch out an idea into three different streams where a different model/flavor riffs on the idea. Review the streams, flesh out what sounds promising. Just leave behind what does not resonate. Then consolidate.

Example frameworks:
Product framework: Starts with an interview about the product
Brainstorming framework?
Personality questionnaire

Example prompt templates:
Story prompt: “Tell a story about the provided context”
Riff prompt: “Riff on the provided context, be creative”. (You can riff in the conversation, or branch and riff in a side conversation, get new ideas, write some more then have it riff again, or branch out twice and have two different llm's riff on the same idea while repeatedly pulling their context from each other.)
Implicit and explicit assumptions template: identifies the explicit and implicit assumptions in the given context.
