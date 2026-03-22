figma.showUI(__html__, { width: 560, height: 460 });

type HexColor = `#${string}`;

type JsonPaint = {
  type: "SOLID";
  color: HexColor;
  opacity?: number;
};

type TextSegment = {
  characters: string;
  textStyleName: string;
};

type JsonNode = {
  type: "FRAME" | "TEXT";
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

  characters?: string;
  textStyleName?: string;
  textSegments?: TextSegment[];
  textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  textAlignVertical?: "TOP" | "CENTER" | "BOTTOM";
  textAutoResize?: "NONE" | "WIDTH_AND_HEIGHT" | "HEIGHT" | "TRUNCATE";

  fills?: JsonPaint[];
  children?: JsonNode[];
};

const H2_PAINT_STYLE_NAME = "4654D9";
const ARTBOARD_NAME_PREFIX = "A4";
const ARTBOARD_SPACING = 256;

const ARTBOARD_PADDING_LEFT = 21;
const ARTBOARD_PADDING_RIGHT = 21;
const ARTBOARD_PADDING_TOP = 30;
const ARTBOARD_PADDING_BOTTOM = 0;
const ARTBOARD_WIDTH = 595;

const ROOT_FRAME_ITEM_SPACING = 30;
const ROOT_FRAME_PADDING_TOP = 0;
const ROOT_FRAME_PADDING_RIGHT = 0;
const ROOT_FRAME_PADDING_BOTTOM = 35;
const ROOT_FRAME_PADDING_LEFT = 0;

const CODE_FRAME_ITEM_SPACING = 0;
const CODE_FRAME_PADDING_TOP = 20;
const CODE_FRAME_PADDING_RIGHT = 20;
const CODE_FRAME_PADDING_BOTTOM = 20;
const CODE_FRAME_PADDING_LEFT = 20;
const CODE_FRAME_CORNER_RADIUS = 5;
const CODE_FRAME_STROKE_WEIGHT = 0.2;
const CODE_FRAME_STROKE_COLOR: HexColor = "#000000";
const CODE_FRAME_FILL_COLOR: HexColor = "#D9D9D9";
const CODE_FRAME_FILL_OPACITY = 0.2;

figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === "cancel") {
      figma.closePlugin();
      return;
    }
    if (msg.type !== "import-json") return;

    const parsed = JSON.parse(msg.payload) as JsonNode | JsonNode[];
    const items: JsonNode[] = Array.isArray(parsed) ? parsed : [parsed];
    const innerFrames = await Promise.all(items.map(buildNode));

    const artboards = innerFrames.map((frame, i) =>
      wrapInArtboard(frame, items[i], i)
    );
    placeArtboards(artboards);

    figma.currentPage.selection = artboards;
    figma.viewport.scrollAndZoomIntoView(artboards);
    figma.closePlugin("Импорт завершен");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Неизвестная ошибка";
    figma.notify(`Ошибка импорта: ${message}`, { error: true });
  }
};

function wrapInArtboard(
  innerFrame: SceneNode,
  json: JsonNode,
  index: number
): FrameNode {
  const artboard = figma.createFrame();
  artboard.name = `${ARTBOARD_NAME_PREFIX} - ${index + 1}`;
  artboard.layoutMode = "VERTICAL";
  artboard.primaryAxisSizingMode = "AUTO";
  artboard.counterAxisSizingMode = "AUTO";
  artboard.primaryAxisAlignItems = "CENTER";
  artboard.counterAxisAlignItems = "CENTER";
  artboard.paddingLeft = ARTBOARD_PADDING_LEFT;
  artboard.paddingRight = ARTBOARD_PADDING_RIGHT;
  artboard.paddingTop = ARTBOARD_PADDING_TOP;
  artboard.paddingBottom = ARTBOARD_PADDING_BOTTOM;
  artboard.resize(ARTBOARD_WIDTH, artboard.height);
  artboard.appendChild(innerFrame);
  applyLayoutSizing(innerFrame, json, artboard);
  return artboard;
}

function placeArtboards(artboards: FrameNode[]): void {
  const center = figma.viewport.center;
  const topY = Math.round(figma.viewport.bounds.y);
  const totalWidth =
    artboards.reduce((sum, ab) => sum + ab.width, 0) +
    (artboards.length - 1) * ARTBOARD_SPACING;
  let x = Math.round(center.x - totalWidth / 2);

  for (const artboard of artboards) {
    figma.currentPage.appendChild(artboard);
    artboard.x = x;
    artboard.y = topY;
    x += artboard.width + ARTBOARD_SPACING;
  }
}

async function buildNode(json: JsonNode): Promise<SceneNode> {
  switch (json.type) {
    case "FRAME":
      return buildFrame(json);
    case "TEXT":
      return buildText(json);
    default:
      throw new Error(`Неподдерживаемый type: ${(json as any).type}`);
  }
}

async function buildFrame(json: JsonNode): Promise<FrameNode> {
  const node = figma.createFrame();

  applyBaseProps(node, json);
  applyFramePreset(node, json.name);
  applyFrameLayout(node, json);

  if (typeof json.width === "number" && typeof json.height === "number") {
    node.resize(json.width, json.height);
  } else if (typeof json.width === "number") {
    node.resize(json.width, Math.max(node.height, 1));
  }

  if (json.fills) node.fills = toFigmaPaints(json.fills);
  if (typeof json.strokeWeight === "number") node.strokeWeight = json.strokeWeight;
  if (json.strokes) node.strokes = toFigmaPaints(json.strokes);

  if (Array.isArray(json.children)) {
    const hasAutoLayout =
      node.layoutMode === "HORIZONTAL" || node.layoutMode === "VERTICAL";
    for (const childJson of json.children) {
      const child = await buildNode(childJson);
      node.appendChild(child);
      if (hasAutoLayout) {
        applyLayoutSizing(child, childJson, node);
      }
    }
  }

  if (typeof json.width === "number" && typeof json.height !== "number") {
    node.resize(json.width, node.height);
  }
  if (typeof json.height === "number" && typeof json.width !== "number") {
    node.resize(node.width, json.height);
  }

  return node;
}

async function buildText(json: JsonNode): Promise<TextNode> {
  const node = figma.createText();

  applyBaseProps(node, json);

  const segments = json.textSegments;
  const hasSegments = Array.isArray(segments) && segments.length > 0;

  if (!hasSegments && !json.textStyleName) {
    throw new Error(
      "TEXT требует textStyleName или textSegments (массив сегментов с разными стилями)"
    );
  }

  const h2PaintStyleId = await resolvePaintStyle(H2_PAINT_STYLE_NAME);

  if (hasSegments) {
    await applyTextSegments(node, segments, h2PaintStyleId);
  } else {
    await applySingleTextStyle(node, json);
  }

  if (json.textAlignHorizontal) node.textAlignHorizontal = json.textAlignHorizontal;
  if (json.textAlignVertical) node.textAlignVertical = json.textAlignVertical;
  node.textAutoResize = json.textAutoResize ?? "HEIGHT";

  if (json.fills && !hasSegments) {
    node.fills = toFigmaPaints(json.fills);
  } else if (!hasSegments && json.textStyleName === "h2" && h2PaintStyleId) {
    await node.setFillStyleIdAsync(h2PaintStyleId);
  }

  if (
    typeof json.width === "number" &&
    typeof json.height === "number" &&
    node.textAutoResize === "NONE"
  ) {
    node.resize(json.width, json.height);
  }

  return node;
}

function applyFramePreset(node: FrameNode, name?: string): void {
  if (name === "Frame") {
    node.layoutMode = "VERTICAL";
    node.primaryAxisSizingMode = "AUTO";
    node.counterAxisSizingMode = "AUTO";
    node.counterAxisAlignItems = "CENTER";
    node.itemSpacing = ROOT_FRAME_ITEM_SPACING;
    node.paddingTop = ROOT_FRAME_PADDING_TOP;
    node.paddingRight = ROOT_FRAME_PADDING_RIGHT;
    node.paddingBottom = ROOT_FRAME_PADDING_BOTTOM;
    node.paddingLeft = ROOT_FRAME_PADDING_LEFT;
    node.fills = [];
  } else if (name === "Code") {
    node.layoutMode = "VERTICAL";
    node.primaryAxisSizingMode = "AUTO";
    node.counterAxisSizingMode = "AUTO";
    node.itemSpacing = CODE_FRAME_ITEM_SPACING;
    node.paddingTop = CODE_FRAME_PADDING_TOP;
    node.paddingRight = CODE_FRAME_PADDING_RIGHT;
    node.paddingBottom = CODE_FRAME_PADDING_BOTTOM;
    node.paddingLeft = CODE_FRAME_PADDING_LEFT;
    node.cornerRadius = CODE_FRAME_CORNER_RADIUS;
    node.strokeWeight = CODE_FRAME_STROKE_WEIGHT;
    node.strokes = toFigmaPaints([
      { type: "SOLID", color: CODE_FRAME_STROKE_COLOR },
    ]);
    node.fills = toFigmaPaints([
      {
        type: "SOLID",
        color: CODE_FRAME_FILL_COLOR,
        opacity: CODE_FRAME_FILL_OPACITY,
      },
    ]);
  }
}

function applyFrameLayout(node: FrameNode, json: JsonNode): void {
  if (json.layoutMode) node.layoutMode = json.layoutMode;
  if (json.primaryAxisSizingMode) node.primaryAxisSizingMode = json.primaryAxisSizingMode;
  if (json.counterAxisSizingMode) node.counterAxisSizingMode = json.counterAxisSizingMode;
  if (json.primaryAxisAlignItems) node.primaryAxisAlignItems = json.primaryAxisAlignItems;
  if (json.counterAxisAlignItems) node.counterAxisAlignItems = json.counterAxisAlignItems;
  if (typeof json.itemSpacing === "number") node.itemSpacing = json.itemSpacing;
  if (typeof json.paddingTop === "number") node.paddingTop = json.paddingTop;
  if (typeof json.paddingRight === "number") node.paddingRight = json.paddingRight;
  if (typeof json.paddingBottom === "number") node.paddingBottom = json.paddingBottom;
  if (typeof json.paddingLeft === "number") node.paddingLeft = json.paddingLeft;
  if (typeof json.clipsContent === "boolean") node.clipsContent = json.clipsContent;
  if (typeof json.cornerRadius === "number") node.cornerRadius = json.cornerRadius;
}

async function applyTextSegments(
  node: TextNode,
  segments: TextSegment[],
  h2PaintStyleId: string | null
): Promise<void> {
  const resolved: { seg: TextSegment; style: TextStyle }[] = [];
  for (const seg of segments) {
    resolved.push({ seg, style: await resolveTextStyle(seg.textStyleName) });
  }

  for (const { style } of resolved) {
    await figma.loadFontAsync(style.fontName);
  }

  node.fontName = resolved[0].style.fontName;

  const texts = resolved.map((r) => r.seg.characters);
  const separators: string[] = [];
  for (let i = 0; i < resolved.length - 1; i++) {
    const prevIsP = resolved[i].seg.textStyleName === "p";
    const nextIsH2 = resolved[i + 1].seg.textStyleName === "h2";
    separators.push(prevIsP && nextIsH2 ? "\n\n" : "\n");
  }
  node.characters = texts.map((s, i) => s + (separators[i] ?? "")).join("");

  let offset = 0;
  for (let i = 0; i < resolved.length; i++) {
    const { seg, style } = resolved[i];
    const end = offset + texts[i].length;
    await node.setRangeTextStyleIdAsync(offset, end, style.id);
    if (seg.textStyleName === "h2" && h2PaintStyleId) {
      await node.setRangeFillStyleIdAsync(offset, end, h2PaintStyleId);
    }
    offset = end + (separators[i]?.length ?? 0);
  }
}

async function applySingleTextStyle(
  node: TextNode,
  json: JsonNode
): Promise<void> {
  const styleName = json.textStyleName!;
  const style = await resolveTextStyle(styleName);
  await figma.loadFontAsync(style.fontName);
  await node.setTextStyleIdAsync(style.id);
  const chars = json.characters || "";
  const isHeading = styleName === "h1" || styleName === "h2";
  node.characters = isHeading ? chars + "\n" : chars;
}

function applyLayoutSizing(
  child: SceneNode,
  childJson: JsonNode,
  parent: FrameNode
): void {
  if (!("layoutSizingHorizontal" in child)) return;

  const layout = child as LayoutMixin;
  const horizontal = childJson.layoutSizingHorizontal ?? "FILL";
  const canHug =
    child.type === "TEXT" ||
    (child.type === "FRAME" && (child as FrameNode).layoutMode !== "NONE");
  const vertical = childJson.layoutSizingVertical ?? (canHug ? "HUG" : "FILL");

  if (horizontal === "FILL" || vertical === "FILL") {
    layout.resize(
      horizontal === "FILL" ? parent.width : child.width,
      vertical === "FILL" ? parent.height : child.height
    );
  }
  layout.layoutSizingHorizontal = horizontal;
  layout.layoutSizingVertical = vertical;
}

function applyBaseProps(node: SceneNode, json: JsonNode): void {
  if (json.name) node.name = json.name;
  if (typeof json.visible === "boolean") node.visible = json.visible;
  if (typeof json.opacity === "number" && "opacity" in node) {
    (node as BlendMixin).opacity = json.opacity;
  }
  if (typeof json.rotation === "number" && "rotation" in node) {
    node.rotation = json.rotation;
  }
  if (typeof json.x === "number") node.x = json.x;
  if (typeof json.y === "number") node.y = json.y;
}

let _textStyles: TextStyle[] | null = null;

async function resolveTextStyle(name: string): Promise<TextStyle> {
  if (!_textStyles) {
    _textStyles = await figma.getLocalTextStylesAsync();
  }
  const style = _textStyles.find((s) => s.name === name);
  if (!style) {
    throw new Error(
      `Текстовый стиль "${name}" не найден. Доступные: ${_textStyles.map((s) => s.name).join(", ") || "нет"}`
    );
  }
  return style;
}

let _paintStyles: PaintStyle[] | null = null;

async function resolvePaintStyle(name: string): Promise<string | null> {
  if (!_paintStyles) {
    _paintStyles = await figma.getLocalPaintStylesAsync();
  }
  const style = _paintStyles.find((s) => s.name === name);
  return style ? style.id : null;
}

function toFigmaPaints(paints: JsonPaint[]): Paint[] {
  return paints.map((paint) => {
    if (paint.type !== "SOLID") {
      throw new Error(`Неподдерживаемый fill type: ${(paint as any).type}`);
    }
    const { r, g, b } = parseHexColor(paint.color);
    return {
      type: "SOLID",
      color: { r, g, b },
      opacity: typeof paint.opacity === "number" ? paint.opacity : 1,
    } as SolidPaint;
  });
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "").trim();
  if (![3, 6].includes(normalized.length)) {
    throw new Error(`Неверный HEX цвет: ${hex}`);
  }
  const full =
    normalized.length === 3
      ? normalized.split("").map((ch) => ch + ch).join("")
      : normalized;
  const v = parseInt(full, 16);
  return {
    r: ((v >> 16) & 255) / 255,
    g: ((v >> 8) & 255) / 255,
    b: (v & 255) / 255,
  };
}
