export type HexColor = `#${string}`;

export enum NodeType {
    FRAME = "FRAME",
    TEXT = "TEXT",
}

export enum FramePreset {
    CODE = "Code",
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

export type TextSegment = {
    textStyleName: string;
    characters: string | string[];
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
