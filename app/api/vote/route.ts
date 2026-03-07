import type { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/server-auth";
import type { Vote } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ code: "unauthorized:vote" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return Response.json({ code: "bad_request:vote" }, { status: 400 });
  }

  const snap = await adminDb
    .collection("votes")
    .where("chatId", "==", chatId)
    .get();

  const votes: Vote[] = snap.docs.map((doc) => doc.data() as Vote);
  return Response.json(votes);
}

export async function PATCH(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ code: "unauthorized:vote" }, { status: 401 });
  }

  const { chatId, messageId, type } = await request.json() as {
    chatId: string;
    messageId: string;
    type: "up" | "down";
  };

  if (!chatId || !messageId || !type) {
    return Response.json({ code: "bad_request:vote" }, { status: 400 });
  }

  const docId = `${chatId}_${messageId}`;
  await adminDb.collection("votes").doc(docId).set({
    chatId,
    messageId,
    isUpvoted: type === "up",
  });

  return Response.json({ success: true });
}
