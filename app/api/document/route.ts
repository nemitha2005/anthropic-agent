import { FieldValue } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/server-auth";
import type { Document } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const docId = searchParams.get("id");

  if (!docId) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  const docRef = adminDb.collection("documents").doc(docId);
  const docMeta = await docRef.get();

  if (!docMeta.exists || docMeta.data()?.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { title, kind } = docMeta.data() as { title: string; kind: string };

  const versionsSnap = await docRef
    .collection("versions")
    .orderBy("createdAt", "asc")
    .get();

  const documents: Document[] = versionsSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: docId,
      createdAt: data.createdAt?.toDate() ?? new Date(),
      title: data.title ?? title,
      content: data.content ?? null,
      kind: kind as Document["kind"],
      userId,
    };
  });

  return Response.json(documents);
}

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const docId = searchParams.get("id");

  if (!docId) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  const docRef = adminDb.collection("documents").doc(docId);
  const docMeta = await docRef.get();

  if (!docMeta.exists || docMeta.data()?.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    title: string;
    content: string;
    kind: string;
  };

  await docRef.collection("versions").add({
    content: body.content,
    title: body.title ?? docMeta.data()?.title,
    createdAt: FieldValue.serverTimestamp(),
  });

  return Response.json({ success: true });
}
