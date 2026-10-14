import {FramePreset, HexColor, Padding} from "./types";

export const HEADING_PAINT_STYLE_NAME = "4654D9";

export const HEADING_TEXT_STYLE_NAMES = new Set(["h2", "h3"]);

export const FRAME_PRESET_BY_STYLE: Readonly<Record<string, FramePreset>> = {
    code: FramePreset.CODE,
    table: FramePreset.TABLE,
};

export const CODE_LINE_SEPARATOR = "\u2028";

export const ARTBOARD = {
    SPACING: 256,
    WIDTH: 595,
    ITEM_SPACING: 30,
    PADDING: {top: 30, right: 21, bottom: 35, left: 21} as Padding,
} as const;

export const CODE_FRAME = {
    ITEM_SPACING: 0,
    CORNER_RADIUS: 5,
    STROKE_WEIGHT: 0.2,
    STROKE_COLOR: "#000000" as HexColor,
    FILL_COLOR: "#D9D9D9" as HexColor,
    FILL_OPACITY: 0.2,
    PADDING: {top: 20, right: 20, bottom: 20, left: 20} as Padding,
} as const;

export const TABLE_FRAME = {
    ITEM_SPACING: 0,
    STROKE_WEIGHT: 0,
    STROKE_COLOR: "#000000" as HexColor,
    PADDING: {top: 0, right: 0, bottom: 0, left: 0} as Padding,
} as const;

export const TABLE_ROW_FRAME = {
    ITEM_SPACING: 10,
    STROKE_WEIGHT: 0.2,
    STROKE_COLOR: "#000000" as HexColor,
    PADDING: {top: 10, right: 0, bottom: 10, left: 0} as Padding,
} as const;

export function tableCellWidth(columnCount: number, parentWidth = ARTBOARD.WIDTH): number {
    const parentInner = parentWidth - ARTBOARD.PADDING.left - ARTBOARD.PADDING.right;
    const tableInner = parentInner - TABLE_FRAME.PADDING.left - TABLE_FRAME.PADDING.right;
    const gaps = Math.max(0, columnCount - 1) * TABLE_ROW_FRAME.ITEM_SPACING;
    return (tableInner - gaps) / columnCount;
}
