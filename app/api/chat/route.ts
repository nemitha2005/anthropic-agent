import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { FieldValue } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/server-auth";
import type { ChatMessage } from "@/lib/types";

function extractText(parts: ChatMessage["parts"]): string {
  return parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("");
}

function toAiMessages(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: extractText(m.parts),
    }))
    .filter((m) => m.content.length > 0);
}

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ code: "unauthorized:chat" }, { status: 401 });
  }

  const body = await request.json();
  const { id, message, messages: overrideMessages, selectedChatModel } = body as {
    id: string;
    message?: ChatMessage;
    messages?: ChatMessage[];
    selectedChatModel: string;
  };

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
    const title = firstUserMsg
      ? extractText(firstUserMsg.parts).slice(0, 60)
      : "New Chat";

    await chatRef.set({
      id,
      userId,
      title,
      visibility: "private",
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  const result = streamText({
    model: anthropic(selectedChatModel),
    messages: toAiMessages(conversationMessages),
    system: "You are a helpful AI assistant.",
    onFinish: async ({ text }) => {
      if (message) {
        await adminDb
          .collection("messages")
          .doc(message.id)
          .set({
            id: message.id,
            chatId: id,
            role: message.role,
            parts: message.parts,
            attachments: [],
            createdAt: FieldValue.serverTimestamp(),
          });
      }

      const assistantId = crypto.randomUUID();
      await adminDb
        .collection("messages")
        .doc(assistantId)
        .set({
          id: assistantId,
          chatId: id,
          role: "assistant",
          parts: [{ type: "text", text }],
          attachments: [],
          createdAt: FieldValue.serverTimestamp(),
        });
    },
  });

  return result.toUIMessageStreamResponse();
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
