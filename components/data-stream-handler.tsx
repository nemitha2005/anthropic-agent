"use client";

import { useEffect, useRef } from "react";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { artifactDefinitions } from "./artifact";
import type { ArtifactKind } from "./artifact";
import { useDataStream } from "./data-stream-provider";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import { useArtifact } from "@/hooks/use-artifact";

export function DataStreamHandler() {
  const { dataStream, setDataStream } = useDataStream();
  const { mutate } = useSWRConfig();
  const { artifact, setArtifact, setMetadata } = useArtifact();

  const kindRef = useRef<ArtifactKind>(artifact.kind);

  useEffect(() => {
    if (!dataStream?.length) {
      return;
    }

    const newDeltas = dataStream.slice();
    setDataStream([]);

    for (const delta of newDeltas) {
      if (delta.type === "data-chat-title") {
        mutate(unstable_serialize(getChatHistoryPaginationKey));
      } else if (delta.type === "data-id") {
        setArtifact((current) => ({
          ...current,
          documentId: delta.data as string,
          status: "streaming",
        }));
      } else if (delta.type === "data-title") {
        setArtifact((current) => ({ ...current, title: delta.data as string }));
      } else if (delta.type === "data-kind") {
        kindRef.current = delta.data as ArtifactKind;
        setArtifact((current) => ({ ...current, kind: kindRef.current }));
      } else if (delta.type === "data-clear") {
        setArtifact((current) => ({ ...current, content: "", isVisible: true }));
      } else if (delta.type === "data-finish") {
        setArtifact((current) => ({ ...current, status: "idle" }));
      } else {
        const definition = artifactDefinitions.find((d) => d.kind === kindRef.current);
        if (definition) {
          definition.onStreamPart({ streamPart: delta, setArtifact, setMetadata });
        }
      }
    }
  }, [dataStream, setDataStream, mutate, setArtifact, setMetadata]);

  return null;
}
