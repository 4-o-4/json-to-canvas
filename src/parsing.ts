import {
    FramePreset,
    JsonNode,
    isTableContent,
    LayoutSizing,
    NodeType,
    TableContent,
    TextSegment,
    tableColumnCount,
} from "./types";
import {FRAME_PRESET_BY_STYLE, TABLE_ROW_FRAME, tableCellWidth} from "./constants";

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
    const keys = Object.keys(o);
    if (keys.length !== 1) return false;
    const blockValue = o[keys[0]];
    if (typeof blockValue === "string") return true;
    if (isTableContent(blockValue)) return true;
    if (Array.isArray(blockValue) && blockValue.every((x) => typeof x === "string")) return true;
    return false;
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
    if (isTableContent(value)) {
        return {textStyleName, characters: "", table: value};
    }
    if (typeof value === "string") {
        return {textStyleName, characters: value};
    }
    if (Array.isArray(value) && value.every((x) => typeof x === "string")) {
        return {textStyleName, characters: value};
    }
    throw new Error(
        `Элемент [${index}]: значение для "${textStyleName}" должно быть строкой, массивом строк или таблицей`,
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

function tableCellNode(textStyleName: string, text: string, columns: number): JsonNode {
    return {
        type: NodeType.TEXT,
        width: tableCellWidth(columns),
        layoutSizingHorizontal: LayoutSizing.FIXED,
        textAutoResize: "HEIGHT",
        textSegments: [{[textStyleName]: text}],
    };
}

function tableRowNode(
    textStyleName: string,
    cells: string[],
    columns: number,
    isLast: boolean,
): JsonNode {
    return {
        type: NodeType.FRAME,
        layoutMode: "HORIZONTAL",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        paddingTop: TABLE_ROW_FRAME.PADDING.top,
        paddingBottom: TABLE_ROW_FRAME.PADDING.bottom,
        itemSpacing: TABLE_ROW_FRAME.ITEM_SPACING,
        ...(isLast
            ? {}
            : {
                strokeTopWeight: 0,
                strokeRightWeight: 0,
                strokeBottomWeight: TABLE_ROW_FRAME.STROKE_WEIGHT,
                strokeLeftWeight: 0,
                strokes: [{type: "SOLID" as const, color: TABLE_ROW_FRAME.STROKE_COLOR}],
                fills: [],
            }),
        children: cells.map((cell) => tableCellNode(textStyleName, cell, columns)),
    };
}

function tableNode(textStyleName: string, rows: TableContent): JsonNode {
    const columns = tableColumnCount(rows);
    const lastRowIndex = rows.length - 1;
    return {
        type: NodeType.FRAME,
        name: FramePreset.TABLE,
        children: rows.map((row, index) =>
            tableRowNode(textStyleName, row, columns, index === lastRowIndex),
        ),
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
        } else if (preset === FramePreset.TABLE) {
            const segment = blocks[i];
            if (!segment.table) {
                throw new Error(`Блок "${styleKey}" должен содержать таблицу`);
            }
            nodes.push(tableNode(styleKey, segment.table));
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
