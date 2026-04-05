import {FramePreset, HexColor, Padding} from "./types";

export const H2_PAINT_STYLE_NAME = "4654D9";

export const FRAME_PRESET_BY_STYLE: Readonly<Record<string, FramePreset>> = {
    code: FramePreset.CODE,
};

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
