figma.showUI(__html__, { width: 560, height: 460 });

type HexColor = `#${string}`;

type JsonPaint = {
  type: "SOLID";
  color: HexColor;
  opacity?: number;
};

type TextSegment = {
  characters?: string | string[];
  textStyleName: string;
};

type Padding = { top: number; right: number; bottom: number; left: number };

type ResolvedSegment = { seg: TextSegment; style: TextStyle };

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

  textSegments?: TextSegment[];
  textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  textAlignVertical?: "TOP" | "CENTER" | "BOTTOM";
  textAutoResize?: "NONE" | "WIDTH_AND_HEIGHT" | "HEIGHT" | "TRUNCATE";

  fills?: JsonPaint[];
  children?: JsonNode[];
};

const H2_PAINT_STYLE_NAME = "4654D9";

const ARTBOARD = {
  NAME_PREFIX: "A4",
  SPACING: 256,
  WIDTH: 595,
  ITEM_SPACING: 30,
  PADDING: { top: 30, right: 21, bottom: 35, left: 21 },
} as const;

const CODE_FRAME = {
  ITEM_SPACING: 0,
  CORNER_RADIUS: 5,
  STROKE_WEIGHT: 0.2,
  STROKE_COLOR: "#000000" as HexColor,
  FILL_COLOR: "#D9D9D9" as HexColor,
  FILL_OPACITY: 0.2,
  PADDING: { top: 20, right: 20, bottom: 20, left: 20 },
} as const;

const styleCache = {
  text: null as TextStyle[] | null,
  paint: null as PaintStyle[] | null,
};

figma.ui.onmessage = async (msg) => {
  if (msg.type === "cancel") {
    figma.closePlugin();
    return;
  }
  if (msg.type !== "import-json") return;

  try {
    const artboards = await parseAndBuild(msg.payload);
    placeArtboards(artboards);
    figma.currentPage.selection = artboards;
    figma.viewport.scrollAndZoomIntoView(artboards);
    figma.closePlugin("Импорт завершен");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    figma.notify(`Ошибка импорта: ${message}`, { error: true });
  }
};

async function parseAndBuild(payload: string): Promise<FrameNode[]> {
  const parsed = JSON.parse(payload) as JsonNode | JsonNode[] | JsonNode[][];

  if (!Array.isArray(parsed)) {
    assertJsonNode(parsed);
    return [wrapInArtboard(await buildNode(parsed), parsed, 0)];
  }

  if (parsed.length > 0 && parsed.every(Array.isArray)) {
    return Promise.all(
      (parsed as unknown[][]).map((items, i) => buildArtboardFromItems(items, i))
    );
  }

  if (parsed.every((item) => !Array.isArray(item))) {
    return [await buildArtboardFromItems(parsed as unknown[], 0)];
  }

  throw new Error("Некорректный JSON: используйте [node, ...] или [[node, ...], [node, ...]]");
}

function isJsonNode(value: unknown): value is JsonNode {
  if (typeof value !== "object" || value === null) return false;
  const type = (value as Record<string, unknown>).type;
  return type === "FRAME" || type === "TEXT";
}

function assertJsonNode(value: unknown): asserts value is JsonNode {
  if (!isJsonNode(value)) {
    throw new Error("Некорректный JSON: объект должен содержать поле type (FRAME или TEXT)");
  }
}

function wrapInArtboard(child: SceneNode, json: JsonNode, index: number): FrameNode {
  const artboard = createArtboard(index);
  artboard.appendChild(child);
  applyLayoutSizing(child, json, artboard);
  return artboard;
}

async function buildArtboardFromItems(items: unknown[], index: number): Promise<FrameNode> {
  const artboard = createArtboard(index);
  for (const item of items) {
    assertJsonNode(item);
    const child = await buildNode(item);
    artboard.appendChild(child);
    applyLayoutSizing(child, item, artboard);
  }
  return artboard;
}

function createArtboard(index: number): FrameNode {
  const artboard = figma.createFrame();
  artboard.name = `${ARTBOARD.NAME_PREFIX} - ${index + 1}`;
  artboard.layoutMode = "VERTICAL";
  artboard.primaryAxisSizingMode = "AUTO";
  artboard.counterAxisSizingMode = "AUTO";
  artboard.primaryAxisAlignItems = "CENTER";
  artboard.counterAxisAlignItems = "CENTER";
  artboard.itemSpacing = ARTBOARD.ITEM_SPACING;
  applyPadding(artboard, ARTBOARD.PADDING);
  artboard.resize(ARTBOARD.WIDTH, artboard.height);
  return artboard;
}

function placeArtboards(artboards: FrameNode[]): void {
  const { center, bounds } = figma.viewport;
  const topY = Math.round(bounds.y);
  const totalWidth =
    artboards.reduce((sum, ab) => sum + ab.width, 0) +
    (artboards.length - 1) * ARTBOARD.SPACING;
  let x = Math.round(center.x - totalWidth / 2);

  for (const artboard of artboards) {
    figma.currentPage.appendChild(artboard);
    artboard.x = x;
    artboard.y = topY;
    x += artboard.width + ARTBOARD.SPACING;
  }
}

async function buildNode(json: JsonNode): Promise<SceneNode> {
  switch (json.type) {
    case "FRAME":
      return buildFrame(json);
    case "TEXT":
      return buildText(json);
    default:
      throw new Error(`Неподдерживаемый type: ${String((json as { type?: unknown }).type)}`);
  }
}

async function buildFrame(json: JsonNode): Promise<FrameNode> {
  const node = figma.createFrame();
  applyBaseProps(node, json);
  applyCodeFramePreset(node, json.name);
  applyFrameLayout(node, json);
  applyFrameSize(node, json);
  applyFillsAndStrokes(node, json);

  if (Array.isArray(json.children)) {
    await appendChildren(node, json.children);
  }

  resizeToFitSingleAxis(node, json);
  return node;
}

async function buildText(json: JsonNode): Promise<TextNode> {
  const segments = json.textSegments;
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error("TEXT требует textSegments");
  }

  const node = figma.createText();
  applyBaseProps(node, json);

  const h2PaintStyleId = await resolvePaintStyle(H2_PAINT_STYLE_NAME);
  await applyTextSegments(node, segments, h2PaintStyleId);

  if (json.textAlignHorizontal) node.textAlignHorizontal = json.textAlignHorizontal;
  if (json.textAlignVertical) node.textAlignVertical = json.textAlignVertical;
  node.textAutoResize = json.textAutoResize ?? "HEIGHT";

  if (
    typeof json.width === "number" &&
    typeof json.height === "number" &&
    node.textAutoResize === "NONE"
  ) {
    node.resize(json.width, json.height);
  }

  return node;
}

function applyCodeFramePreset(node: FrameNode, name?: string): void {
  if (name !== "Code") return;
  node.layoutMode = "VERTICAL";
  node.primaryAxisSizingMode = "AUTO";
  node.counterAxisSizingMode = "AUTO";
  node.itemSpacing = CODE_FRAME.ITEM_SPACING;
  applyPadding(node, CODE_FRAME.PADDING);
  node.cornerRadius = CODE_FRAME.CORNER_RADIUS;
  node.strokeWeight = CODE_FRAME.STROKE_WEIGHT;
  node.strokes = toFigmaPaints([{ type: "SOLID", color: CODE_FRAME.STROKE_COLOR }]);
  node.fills = toFigmaPaints([
    { type: "SOLID", color: CODE_FRAME.FILL_COLOR, opacity: CODE_FRAME.FILL_OPACITY },
  ]);
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

function applyFrameSize(node: FrameNode, json: JsonNode): void {
  if (typeof json.width === "number" && typeof json.height === "number") {
    node.resize(json.width, json.height);
  } else if (typeof json.width === "number") {
    node.resize(json.width, Math.max(node.height, 1));
  }
}

function applyFillsAndStrokes(node: FrameNode, json: JsonNode): void {
  if (json.fills) node.fills = toFigmaPaints(json.fills);
  if (typeof json.strokeWeight === "number") node.strokeWeight = json.strokeWeight;
  if (json.strokes) node.strokes = toFigmaPaints(json.strokes);
}

async function appendChildren(parent: FrameNode, children: JsonNode[]): Promise<void> {
  const hasAutoLayout =
    parent.layoutMode === "HORIZONTAL" || parent.layoutMode === "VERTICAL";

  for (const childJson of children) {
    const child = await buildNode(childJson);
    parent.appendChild(child);
    if (hasAutoLayout) {
      applyLayoutSizing(child, childJson, parent);
    }
  }
}

function resizeToFitSingleAxis(node: FrameNode, json: JsonNode): void {
  if (typeof json.width === "number" && typeof json.height !== "number") {
    node.resize(json.width, node.height);
  }
  if (typeof json.height === "number" && typeof json.width !== "number") {
    node.resize(node.width, json.height);
  }
}

async function applyTextSegments(
  node: TextNode,
  segments: TextSegment[],
  h2PaintStyleId: string | null
): Promise<void> {
  const resolved = await resolveSegments(segments);

  for (const { style } of resolved) {
    await figma.loadFontAsync(style.fontName);
  }

  node.fontName = resolved[0].style.fontName;

  const texts = resolved.map((r) => segmentToText(r.seg));
  const separators = buildSegmentSeparators(resolved);
  node.characters = texts.map((s, i) => s + (separators[i] ?? "")).join("");

  let offset = 0;
  for (let i = 0; i < resolved.length; i++) {
    const { seg, style } = resolved[i];
    const end = offset + texts[i].length;
    await node.setRangeTextStyleIdAsync(offset, end, style.id);
    if (Array.isArray(seg.characters)) {
      applyListStyle(node, offset, end);
    }
    if (seg.textStyleName === "h2" && h2PaintStyleId) {
      await node.setRangeFillStyleIdAsync(offset, end, h2PaintStyleId);
    }
    offset = end + (separators[i]?.length ?? 0);
  }
}

async function resolveSegments(segments: TextSegment[]): Promise<ResolvedSegment[]> {
  const resolved: ResolvedSegment[] = [];
  for (const seg of segments) {
    resolved.push({ seg, style: await resolveTextStyle(seg.textStyleName) });
  }
  return resolved;
}

function segmentToText(segment: TextSegment): string {
  return Array.isArray(segment.characters)
    ? segment.characters.join("\n")
    : segment.characters ?? "";
}

function buildSegmentSeparators(resolved: ResolvedSegment[]): string[] {
  return resolved.slice(0, -1).map((r, i) => {
    const prevIsP = r.seg.textStyleName === "p";
    const nextIsH2 = resolved[i + 1].seg.textStyleName === "h2";
    return prevIsP && nextIsH2 ? "\n\n" : "\n";
  });
}

function applyListStyle(
  node: TextNode,
  start: number,
  end: number
): void {
  if (end <= start) return;
  const ext = node as TextNode & {
    setRangeListOptions?: (
      s: number,
      e: number,
      opts: { type: "UNORDERED" }
    ) => void;
  };
  if (typeof ext.setRangeListOptions !== "function") return;
  ext.setRangeListOptions(start, end, { type: "UNORDERED" });
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

function applyLayoutSizing(
  child: SceneNode,
  childJson: JsonNode,
  parent: FrameNode
): void {
  if (!("layoutSizingHorizontal" in child)) return;

  const layout = child as SceneNode & LayoutMixin;
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

function applyPadding(node: FrameNode, padding: Padding): void {
  node.paddingTop = padding.top;
  node.paddingRight = padding.right;
  node.paddingBottom = padding.bottom;
  node.paddingLeft = padding.left;
}

async function resolveTextStyle(name: string): Promise<TextStyle> {
  if (!styleCache.text) {
    styleCache.text = await figma.getLocalTextStylesAsync();
  }
  const style = styleCache.text.find((s) => s.name === name);
  if (!style) {
    const available = styleCache.text.map((s) => s.name).join(", ") || "нет";
    throw new Error(`Текстовый стиль "${name}" не найден. Доступные: ${available}`);
  }
  return style;
}

async function resolvePaintStyle(name: string): Promise<string | null> {
  if (!styleCache.paint) {
    styleCache.paint = await figma.getLocalPaintStylesAsync();
  }
  return styleCache.paint.find((s) => s.name === name)?.id ?? null;
}

function toFigmaPaints(paints: JsonPaint[]): Paint[] {
  return paints.map((paint) => {
    if (paint.type !== "SOLID") {
      throw new Error(`Неподдерживаемый fill type: ${(paint as { type?: unknown }).type}`);
    }
    return {
      type: "SOLID",
      color: parseHexColor(paint.color),
      opacity: paint.opacity ?? 1,
    } as SolidPaint;
  });
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "").trim();
  if (normalized.length !== 3 && normalized.length !== 6) {
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
