export type HexColor = `#${string}`;

export enum NodeType {
    FRAME = "FRAME",
    TEXT = "TEXT",
}

export enum FramePreset {
    CODE = "Code",
    TABLE = "Table",
}

export const LayoutSizing = {
    FIXED: "FIXED",
    HUG: "HUG",
    FILL: "FILL",
} as const;

export type JsonPaint = {
    type: "SOLID";
    color: HexColor;
    opacity?: number;
};

export type TableContent = string[][];

export function tableColumnCount(rows: TableContent): number {
    return rows[0]?.length ?? 0;
}

export function isTableContent(value: unknown): value is TableContent {
    if (!Array.isArray(value) || value.length === 0) return false;
    const firstRow = value[0];
    if (!Array.isArray(firstRow) || firstRow.length === 0) return false;
    if (!firstRow.every((cell) => typeof cell === "string")) return false;
    const columns = firstRow.length;
    return value.every(
        (row) =>
            Array.isArray(row) &&
            row.length === columns &&
            row.every((cell) => typeof cell === "string"),
    );
}

export type TextSegment = {
    textStyleName: string;
    characters: string | string[];
    table?: TableContent;
};

export type Padding = {
    top: number;
    right: number;
    bottom: number;
    left: number;
};

export type ResolvedSegment = {
    segment: TextSegment;
    style: TextStyle;
};

export type JsonNode = {
    type: NodeType;
    name?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    visible?: boolean;
    opacity?: number;

    layoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL";
    primaryAxisSizingMode?: "FIXED" | "AUTO";
    counterAxisSizingMode?: "FIXED" | "AUTO";
    primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
    counterAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "BASELINE";
    itemSpacing?: number;
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    clipsContent?: boolean;
    cornerRadius?: number;
    strokeWeight?: number;
    strokeTopWeight?: number;
    strokeRightWeight?: number;
    strokeBottomWeight?: number;
    strokeLeftWeight?: number;
    strokes?: JsonPaint[];

    layoutSizingHorizontal?: "FIXED" | "HUG" | "FILL";
    layoutSizingVertical?: "FIXED" | "HUG" | "FILL";

    textSegments?: unknown[];
    textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
    textAlignVertical?: "TOP" | "CENTER" | "BOTTOM";
    textAutoResize?: "NONE" | "WIDTH_AND_HEIGHT" | "HEIGHT" | "TRUNCATE";

    fills?: JsonPaint[];
    children?: JsonNode[];
};
