import {parseAndCreateArtboards, placeArtboardsOnCanvas} from "./builders";
import {MARKDOWN_STYLE_MAPPING} from "./markdown-config";
import {markdownToLayout} from "./markdown";

figma.showUI(__html__, {width: 560, height: 580});

figma.ui.onmessage = async (msg) => {
    if (msg.type === "cancel") {
        figma.closePlugin();
        return;
    }

    if (msg.type === "convert-markdown") {
        try {
            const {blocks, warnings} = markdownToLayout(msg.payload, MARKDOWN_STYLE_MAPPING);
            figma.ui.postMessage({
                type: "markdown-converted",
                payload: JSON.stringify(blocks, null, 2),
                warnings,
                fileName: msg.fileName,
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
