import type { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/server-auth";
import type { Chat } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ code: "unauthorized:history" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "20");
  const endingBefore = searchParams.get("ending_before");

  let query = adminDb
    .collection("chats")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(limit + 1);

  if (endingBefore) {
    const cursorDoc = await adminDb.collection("chats").doc(endingBefore).get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  const snap = await query.get();
  const hasMore = snap.docs.length > limit;
  const docs = hasMore ? snap.docs.slice(0, limit) : snap.docs;

  const chats: Chat[] = docs.map((doc) => {
    const data = doc.data();
    return {
      id: data.id,
      title: data.title,
      userId: data.userId,
      visibility: data.visibility,
      createdAt: data.createdAt?.toDate() ?? new Date(),
    };
  });

  return Response.json({ chats, hasMore });
}
