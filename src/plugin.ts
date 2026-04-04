import {parseAndCreateArtboards, placeArtboardsOnCanvas} from "./builders";

figma.showUI(__html__, {width: 560, height: 500});

figma.ui.onmessage = async (msg) => {
    if (msg.type === "cancel") {
        figma.closePlugin();
        return;
    }
    if (msg.type !== "import-json") return;

    try {
        const artboards = await parseAndCreateArtboards(
            msg.payload,
            msg.artboardNumberStart,
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
