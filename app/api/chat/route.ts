import { anthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import { FieldValue } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/server-auth";
import { chatModels, DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

function extractText(parts: ChatMessage["parts"]): string {
  return parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("");
}

const SYSTEM_PROMPT = `You are a helpful AI assistant with the ability to create and edit artifacts in a side panel canvas.

When users ask you to write code, create documents, write essays, or generate substantial content, use the createDocument tool to create an artifact. This opens a canvas panel where users can view, edit, and interact with the content.

Use updateDocument when a user asks to modify or improve an existing document.

For short conversational replies, answer directly without creating a document.`;

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ code: "unauthorized:chat" }, { status: 401 });
  }

  const body = await request.json();
  const {
    id,
    message,
    messages: overrideMessages,
    selectedChatModel: rawModel,
  } = body as {
    id: string;
    message?: ChatMessage;
    messages?: ChatMessage[];
    selectedChatModel: string;
  };

  const validModelIds = new Set(chatModels.map((m) => m.id));
  const selectedChatModel = validModelIds.has(rawModel)
    ? rawModel
    : DEFAULT_CHAT_MODEL;

  let conversationMessages: ChatMessage[];

  if (overrideMessages) {
    conversationMessages = overrideMessages;
  } else {
    const historySnap = await adminDb
      .collection("messages")
      .where("chatId", "==", id)
      .orderBy("createdAt", "asc")
      .get();

    const history = historySnap.docs.map((doc) => doc.data() as ChatMessage);
    conversationMessages = message ? [...history, message] : history;
  }

  const chatRef = adminDb.collection("chats").doc(id);
  const chatDoc = await chatRef.get();

  if (!chatDoc.exists) {
    const firstUserMsg = conversationMessages.find((m) => m.role === "user");
    const userText = firstUserMsg ? extractText(firstUserMsg.parts) : "";

    let title = "New Chat";
    if (userText) {
      const { text } = await generateText({
        model: anthropic("claude-haiku-4-5"),
        prompt: `Generate a short 4-6 word title for a chat that starts with this message. Reply with only the title, no quotes or punctuation:\n\n${userText.slice(0, 500)}`,
      });
      title = text.trim().slice(0, 60);
    }

    await chatRef.set({
      id,
      userId,
      title,
      visibility: "private",
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({
        model: anthropic(selectedChatModel),
        messages: await convertToModelMessages(conversationMessages),
        system: SYSTEM_PROMPT,
        stopWhen: stepCountIs(5),
        tools: {
          createDocument: tool({
            description:
              "Create a document or code artifact in the canvas panel. Use for code, essays, documents, spreadsheets, or any substantial content.",
            inputSchema: z.object({
              title: z
                .string()
                .describe("A short descriptive title for the document"),
              kind: z
                .enum(["text", "code", "sheet"])
                .describe(
                  "text for prose/essays, code for programming, sheet for spreadsheets/CSV data"
                ),
            }),
            execute: async ({ title, kind }) => {
              const docId = generateUUID();

              writer.write({ type: "data-id", data: docId });
              writer.write({ type: "data-title", data: title });
              writer.write({ type: "data-kind", data: kind });
              writer.write({ type: "data-clear", data: null });

              const prompt =
                kind === "code"
                  ? `Write complete, working ${title} code. Output only the code with no explanation or markdown fences.`
                  : kind === "sheet"
                    ? `Create a CSV spreadsheet for: ${title}. Output only the CSV data with headers, no explanation.`
                    : `Write a complete, well-structured ${title}. Output only the content itself.`;

              const { text: content } = await generateText({
                model: anthropic(selectedChatModel),
                system:
                  "You are an expert at creating high-quality content. Produce clean, complete output as requested.",
                prompt,
              });

              if (kind === "code") {
                writer.write({ type: "data-codeDelta", data: content });
              } else if (kind === "sheet") {
                writer.write({ type: "data-sheetDelta", data: content });
              } else {
                for (const char of content) {
                  writer.write({ type: "data-textDelta", data: char });
                }
              }

              writer.write({ type: "data-finish", data: null });

              const docRef = adminDb.collection("documents").doc(docId);
              await docRef.set({ userId, title, kind });
              await docRef.collection("versions").add({
                content,
                title,
                createdAt: FieldValue.serverTimestamp(),
              });

              return { id: docId, title, kind };
            },
          }),

          updateDocument: tool({
            description:
              "Update an existing document in the canvas with new content based on user instructions",
            inputSchema: z.object({
              id: z.string().describe("The document ID to update"),
              description: z
                .string()
                .describe("What changes to make to the document"),
            }),
            execute: async ({ id: docId, description }) => {
              const docRef = adminDb.collection("documents").doc(docId);
              const docMeta = await docRef.get();

              if (!docMeta.exists || docMeta.data()?.userId !== userId) {
                return { error: "Document not found" };
              }

              const { title, kind } = docMeta.data() as {
                title: string;
                kind: string;
              };

              const versionsSnap = await docRef
                .collection("versions")
                .orderBy("createdAt", "desc")
                .limit(1)
                .get();

              const currentContent =
                versionsSnap.docs[0]?.data()?.content ?? "";

              writer.write({ type: "data-id", data: docId });
              writer.write({ type: "data-title", data: title });
              writer.write({ type: "data-kind", data: kind });
              writer.write({ type: "data-clear", data: null });

              const { text: updatedContent } = await generateText({
                model: anthropic(selectedChatModel),
                system:
                  "You are an expert at updating documents based on instructions. Provide only the complete updated content, no explanation.",
                prompt: `Current ${kind} content:\n\n${currentContent}\n\nUpdate instruction: ${description}\n\nProvide the complete updated content:`,
              });

              if (kind === "code") {
                writer.write({ type: "data-codeDelta", data: updatedContent });
              } else if (kind === "sheet") {
                writer.write({
                  type: "data-sheetDelta",
                  data: updatedContent,
                });
              } else {
                for (const char of updatedContent) {
                  writer.write({ type: "data-textDelta", data: char });
                }
              }

              writer.write({ type: "data-finish", data: null });

              await docRef.collection("versions").add({
                content: updatedContent,
                title,
                createdAt: FieldValue.serverTimestamp(),
              });

              return { id: docId, title, kind };
            },
          }),

          getWeather: tool({
            description: "Get the current weather for a city",
            inputSchema: z.object({
              city: z.string().describe("The city name"),
            }),
            execute: async ({ city }) => {
              try {
                const geoRes = await fetch(
                  `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
                );
                const geoData = (await geoRes.json()) as {
                  results?: Array<{
                    name: string;
                    country: string;
                    latitude: number;
                    longitude: number;
                  }>;
                };
                const loc = geoData.results?.[0];
                if (!loc) return { error: `City not found: ${city}` };

                const weatherRes = await fetch(
                  `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weathercode,windspeed_10m&temperature_unit=celsius`
                );
                const weatherData = (await weatherRes.json()) as {
                  current: {
                    temperature_2m: number;
                    weathercode: number;
                    windspeed_10m: number;
                  };
                };

                return {
                  city: loc.name,
                  country: loc.country,
                  temperature: weatherData.current.temperature_2m,
                  unit: "°C",
                  windspeed: weatherData.current.windspeed_10m,
                };
              } catch {
                return { error: "Failed to fetch weather data" };
              }
            },
          }),
        },
        onFinish: async ({ text }) => {
          if (message) {
            await adminDb.collection("messages").doc(message.id).set({
              id: message.id,
              chatId: id,
              role: message.role,
              parts: message.parts,
              attachments: [],
              createdAt: FieldValue.serverTimestamp(),
            });
          }

          if (text) {
            const assistantId = crypto.randomUUID();
            await adminDb.collection("messages").doc(assistantId).set({
              id: assistantId,
              chatId: id,
              role: "assistant",
              parts: [{ type: "text", text }],
              attachments: [],
              createdAt: FieldValue.serverTimestamp(),
            });
          }
        },
      });

      writer.merge(result.toUIMessageStream());
    },
    onError: (error) => {
      console.error("Stream error:", error);
      return error instanceof Error ? error.message : "An error occurred";
    },
  });

  return createUIMessageStreamResponse({ stream });
}

export async function DELETE(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ code: "unauthorized:chat" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("id");

  if (!chatId) {
    return Response.json({ code: "bad_request:chat" }, { status: 400 });
  }

  const chatRef = adminDb.collection("chats").doc(chatId);
  const chatDoc = await chatRef.get();

  if (!chatDoc.exists || chatDoc.data()?.userId !== userId) {
    return Response.json({ code: "forbidden:chat" }, { status: 403 });
  }

  const messagesSnap = await adminDb
    .collection("messages")
    .where("chatId", "==", chatId)
    .get();

  const batch = adminDb.batch();
  for (const doc of messagesSnap.docs) {
    batch.delete(doc.ref);
  }
  batch.delete(chatRef);
  await batch.commit();

  return Response.json({ success: true });
}
