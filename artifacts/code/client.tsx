import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/code-editor";
import {
  Console,
  type ConsoleOutput,
  type ConsoleOutputContent,
} from "@/components/console";
import { Artifact } from "@/components/create-artifact";
import {
  CodeIcon,
  CopyIcon,
  LogsIcon,
  MessageIcon,
  PlayIcon,
  RedoIcon,
  UndoIcon,
} from "@/components/icons";
import { generateUUID } from "@/lib/utils";
import { EyeIcon } from "lucide-react";

const OUTPUT_HANDLERS = {
  matplotlib: `
    import io
    import base64
    from matplotlib import pyplot as plt

    # Clear any existing plots
    plt.clf()
    plt.close('all')

    # Switch to agg backend
    plt.switch_backend('agg')

    def setup_matplotlib_output():
        def custom_show():
            if plt.gcf().get_size_inches().prod() * plt.gcf().dpi ** 2 > 25_000_000:
                print("Warning: Plot size too large, reducing quality")
                plt.gcf().set_dpi(100)

            png_buf = io.BytesIO()
            plt.savefig(png_buf, format='png')
            png_buf.seek(0)
            png_base64 = base64.b64encode(png_buf.read()).decode('utf-8')
            print(f'data:image/png;base64,{png_base64}')
            png_buf.close()

            plt.clf()
            plt.close('all')

        plt.show = custom_show
  `,
  basic: `
    # Basic output capture setup
  `,
};

function detectRequiredHandlers(code: string): string[] {
  const handlers: string[] = ["basic"];

  if (code.includes("matplotlib") || code.includes("plt.")) {
    handlers.push("matplotlib");
  }

  return handlers;
}

type Metadata = {
  outputs: ConsoleOutput[];
  activeView: "code" | "output";
};

export const codeArtifact = new Artifact<"code", Metadata>({
  kind: "code",
  description:
    "Useful for code generation; Code execution is only available for python code.",
  initialize: ({ setMetadata }) => {
    setMetadata({
      outputs: [],
      activeView: "code",
    });
  },
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-codeDelta") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: draftArtifact.content + streamPart.data,
        status: "streaming",
      }));
    }
    if (streamPart.type === "data-finish") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: draftArtifact.content.replace(/^```[\w]*\n?/, "").replace(/\n?```\s*$/, ""),
        status: "idle",
      }));
    }
  },
  content: ({ metadata, setMetadata, ...props }) => {
    const activeView = metadata?.activeView ?? "code";
    const isHtml =
      props.content.trimStart().startsWith("<") ||
      props.content.trimStart().toLowerCase().startsWith("<!doctype");
    const hasHtmlOutput = isHtml && props.status === "idle";
    const hasConsoleOutput = Boolean(metadata?.outputs?.length);

    const setView = (view: "code" | "output") => {
      setMetadata((currentMetadata) => ({
        ...(currentMetadata ?? { outputs: [] }),
        activeView: view,
      }));
    };

    return (
      <>
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="inline-flex items-center gap-1 rounded-md bg-muted p-1">
            <Button
              size="sm"
              variant={activeView === "code" ? "secondary" : "ghost"}
              onClick={() => setView("code")}
              aria-pressed={activeView === "code"}
            >
              <CodeIcon size={16} />
              Code
            </Button>
            <Button
              size="sm"
              variant={activeView === "output" ? "secondary" : "ghost"}
              onClick={() => setView("output")}
              aria-pressed={activeView === "output"}
            >
              <EyeIcon size={16} />
              Output
            </Button>
          </div>
        </div>

        <div className="px-1">
          {activeView === "code" ? (
            <CodeEditor {...props} />
          ) : hasHtmlOutput ? (
            <iframe
              sandbox="allow-scripts"
              srcDoc={props.content}
              className="h-[calc(80dvh)] w-full bg-white"
              title="HTML Preview"
            />
          ) : hasConsoleOutput ? (
            <Console
              consoleOutputs={metadata.outputs}
              setConsoleOutputs={() => {
                setMetadata((currentMetadata) => ({
                  ...(currentMetadata ?? { activeView: "output" }),
                  outputs: [],
                }));
              }}
            />
          ) : (
            <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              No output yet. Run the code or generate HTML to preview output.
            </div>
          )}
        </div>

      </>
    );
  },
  actions: [
    {
      icon: <PlayIcon size={18} />,
      label: "Run",
      description: "Execute code",
      onClick: async ({ content, setMetadata }) => {
        const runId = generateUUID();
        const outputContent: ConsoleOutputContent[] = [];

        setMetadata((metadata) => ({
          ...metadata,
          activeView: "output",
          outputs: [
            ...(metadata?.outputs ?? []),
            {
              id: runId,
              contents: [],
              status: "in_progress",
            },
          ],
        }));

        try {
          // @ts-expect-error - loadPyodide is not defined
          const currentPyodideInstance = await globalThis.loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/",
          });

          currentPyodideInstance.setStdout({
            batched: (output: string) => {
              outputContent.push({
                type: output.startsWith("data:image/png;base64")
                  ? "image"
                  : "text",
                value: output,
              });
            },
          });

          await currentPyodideInstance.loadPackagesFromImports(content, {
            messageCallback: (message: string) => {
              setMetadata((metadata) => ({
                ...metadata,
                outputs: [
                  ...metadata.outputs.filter((output) => output.id !== runId),
                  {
                    id: runId,
                    contents: [{ type: "text", value: message }],
                    status: "loading_packages",
                  },
                ],
              }));
            },
          });

          const requiredHandlers = detectRequiredHandlers(content);
          for (const handler of requiredHandlers) {
            if (OUTPUT_HANDLERS[handler as keyof typeof OUTPUT_HANDLERS]) {
              await currentPyodideInstance.runPythonAsync(
                OUTPUT_HANDLERS[handler as keyof typeof OUTPUT_HANDLERS]
              );

              if (handler === "matplotlib") {
                await currentPyodideInstance.runPythonAsync(
                  "setup_matplotlib_output()"
                );
              }
            }
          }

          await currentPyodideInstance.runPythonAsync(content);

          setMetadata((metadata) => ({
            ...metadata,
            outputs: [
              ...(metadata?.outputs ?? []).filter((output) => output.id !== runId),
              {
                id: runId,
                contents: outputContent,
                status: "completed",
              },
            ],
          }));
        } catch (error: any) {
          setMetadata((metadata) => ({
            ...metadata,
            outputs: [
              ...(metadata?.outputs ?? []).filter((output) => output.id !== runId),
              {
                id: runId,
                contents: [{ type: "text", value: error.message }],
                status: "failed",
              },
            ],
          }));
        }
      },
    },
    {
      icon: <UndoIcon size={18} />,
      description: "View Previous version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: "View Next version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: "Copy code to clipboard",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Copied to clipboard!");
      },
    },
  ],
  toolbar: [
    {
      icon: <MessageIcon />,
      description: "Add comments",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Add comments to the code snippet for understanding",
            },
          ],
        });
      },
    },
    {
      icon: <LogsIcon />,
      description: "Add logs",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Add logs to the code snippet for debugging",
            },
          ],
        });
      },
    },
  ],
});
