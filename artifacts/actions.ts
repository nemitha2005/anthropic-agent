"use server";

import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/server-auth";
import type { Suggestion } from "@/lib/db/schema";

export async function getSuggestions({
  documentId,
}: {
  documentId: string;
}): Promise<Suggestion[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const snap = await adminDb
    .collection("suggestions")
    .where("documentId", "==", documentId)
    .where("userId", "==", userId)
    .where("isResolved", "==", false)
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      documentId: data.documentId,
      documentCreatedAt: data.documentCreatedAt?.toDate() ?? new Date(),
      originalText: data.originalText,
      suggestedText: data.suggestedText,
      description: data.description ?? null,
      isResolved: data.isResolved,
      userId: data.userId,
      createdAt: data.createdAt?.toDate() ?? new Date(),
    } as Suggestion;
  });
}
