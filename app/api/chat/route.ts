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

// generateUUID kept for potential future use
void generateUUID;

function extractText(parts: ChatMessage["parts"]): string {
  return parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("");
}

const SYSTEM_PROMPT = `You are a helpful AI assistant. Answer clearly and concisely.`;

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


