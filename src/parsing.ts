import {FramePreset, JsonNode, NodeType, TextSegment} from "./types";
import {FRAME_PRESET_BY_STYLE} from "./constants";

export function isJsonNode(value: unknown): value is JsonNode {
    if (typeof value !== "object" || value === null) return false;
    const type = (value as Record<string, unknown>).type;
    return type === NodeType.FRAME || type === NodeType.TEXT;
}

export function assertJsonNode(value: unknown): asserts value is JsonNode {
    if (!isJsonNode(value)) {
        throw new Error(
            "Некорректный JSON: объект должен содержать поле type (FRAME или TEXT)",
        );
    }
}

export function isStyleBlock(value: unknown): boolean {
    if (typeof value !== "object" || value === null) return false;
    const o = value as Record<string, unknown>;
    if ("type" in o) return false;
    return Object.keys(o).length === 1;
}

export function isStyleBlockArray(items: unknown[]): boolean {
    return items.every(isStyleBlock);
}

export function parseTextSegment(raw: unknown, index: number): TextSegment {
    if (typeof raw !== "object" || raw === null) {
        throw new Error(`Элемент [${index}]: ожидался объект, например {"p": "текст"}`);
    }
    const o = raw as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length !== 1) {
        throw new Error(
            `Элемент [${index}]: один ключ — имя текстового стиля в Figma, получено ключей: ${keys.length}`,
        );
    }
    const textStyleName = keys[0];
    const value = o[textStyleName];
    if (typeof value === "string") {
        return {textStyleName, characters: value};
    }
    if (Array.isArray(value) && value.every((x) => typeof x === "string")) {
        return {textStyleName, characters: value};
    }
    throw new Error(
        `Элемент [${index}]: значение для "${textStyleName}" должно быть строкой или массивом строк`,
    );
}

export function parseTextSegments(raw: unknown): TextSegment[] {
    if (!Array.isArray(raw) || raw.length === 0) {
        throw new Error("TEXT требует непустой массив textSegments");
    }
    return raw.map(parseTextSegment);
}

function convertSegmentsToStyleObjects(segments: TextSegment[]): unknown[] {
    return segments.map((s) => ({[s.textStyleName]: s.characters}));
}

function textNode(segments: TextSegment[]): JsonNode {
    return {
        type: NodeType.TEXT,
        textSegments: convertSegmentsToStyleObjects(segments),
    };
}

function frameNode(preset: FramePreset, segments: TextSegment[]): JsonNode {
    return {
        type: NodeType.FRAME,
        name: preset,
        children: [textNode(segments)],
    };
}

function takeRun(
    blocks: TextSegment[],
    start: number,
    matches: (block: TextSegment) => boolean,
): TextSegment[] {
    const run: TextSegment[] = [];
    for (let i = start; i < blocks.length && matches(blocks[i]); i++) {
        run.push(blocks[i]);
    }
    return run;
}

export function groupBlocksIntoNodes(blocks: TextSegment[]): JsonNode[] {
    const nodes: JsonNode[] = [];
    let i = 0;

    while (i < blocks.length) {
        const styleKey = blocks[i].textStyleName;
        const preset = FRAME_PRESET_BY_STYLE[styleKey];

        if (preset === FramePreset.CODE) {
            // Каждый блок кода — отдельный фрейм.
            nodes.push(frameNode(preset, [blocks[i]]));
            i += 1;
        } else if (preset) {
            const run = takeRun(blocks, i, (b) => b.textStyleName === styleKey);
            nodes.push(frameNode(preset, run));
            i += run.length;
        } else {
            const run = takeRun(blocks, i, (b) => !FRAME_PRESET_BY_STYLE[b.textStyleName]);
            nodes.push(textNode(run));
            i += run.length;
        }
    }

    return nodes;
}
