import {parseAndCreateArtboards, placeArtboardsOnCanvas} from "./builders";
import {MARKDOWN_STYLE_MAPPING} from "./markdown-config";
import {markdownFilesToLayout, type MarkdownFileInput} from "./markdown";

figma.showUI(__html__, {width: 560, height: 580});

figma.ui.onmessage = async (msg) => {
    if (msg.type === "cancel") {
        figma.closePlugin();
        return;
    }

    if (msg.type === "convert-markdown") {
        try {
            const files = resolveMarkdownFiles(msg);
            const {blocks, warnings} = markdownFilesToLayout(files, MARKDOWN_STYLE_MAPPING);
            figma.ui.postMessage({
                type: "markdown-converted",
                payload: JSON.stringify(blocks, null, 2),
                warnings,
                fileName: files.map((f) => f.name).join(", "),
                fileCount: files.length,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Неизвестная ошибка";
            figma.ui.postMessage({
                type: "markdown-error",
                message,
            });
        }
        return;
    }

    if (msg.type !== "import-json") return;

    try {
        const artboards = await parseAndCreateArtboards(
            msg.payload,
            msg.artboardNumberStart,
            msg.artboardNamePrefix,
        );
        placeArtboardsOnCanvas(artboards);
        figma.currentPage.selection = artboards;
        figma.viewport.scrollAndZoomIntoView(artboards);
        figma.closePlugin("Импорт завершен");
    } catch (error) {
        const message = error instanceof Error ? error.message : "Неизвестная ошибка";
        figma.notify(`Ошибка импорта: ${message}`, {error: true});
    }
};

function resolveMarkdownFiles(msg: {
    files?: unknown;
    payload?: unknown;
    fileName?: unknown;
}): MarkdownFileInput[] {
    if (Array.isArray(msg.files)) {
        const files: MarkdownFileInput[] = [];
        for (const item of msg.files) {
            if (!item || typeof item !== "object") continue;
            const record = item as Record<string, unknown>;
            if (typeof record.name !== "string" || typeof record.content !== "string") {
                continue;
            }
            files.push({name: record.name, content: record.content});
        }
        if (files.length === 0) {
            throw new Error("Не переданы markdown-файлы");
        }
        return files;
    }

    if (typeof msg.payload === "string") {
        return [
            {
                name: typeof msg.fileName === "string" ? msg.fileName : "document.md",
                content: msg.payload,
            },
        ];
    }

    throw new Error("Не переданы markdown-файлы");
}
