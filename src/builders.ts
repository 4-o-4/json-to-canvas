import {
    JsonNode,
    NodeType,
    LayoutSizing,
    Padding,
    TextSegment,
    ResolvedSegment,
    FramePreset,
} from "./types";
import {ARTBOARD, CODE_FRAME, H2_PAINT_STYLE_NAME} from "./constants";
import {resolveTextStyle, resolvePaintStyleId, convertToFigmaPaints} from "./styles";
import {
    assertJsonNode,
    isStyleBlockArray,
    parseTextSegment,
    parseTextSegments,
    groupBlocksIntoNodes,
} from "./parsing";

export async function parseAndCreateArtboards(payload: string): Promise<FrameNode[]> {
    const parsed = JSON.parse(payload) as unknown;

    if (!Array.isArray(parsed)) {
        throw new Error("Некорректный JSON: ожидался массив блоков");
    }

    if (parsed.length > 0 && parsed.every(Array.isArray)) {
        return Promise.all(
            (parsed as unknown[][]).map((row, i) => createArtboardFromItems(row, i)),
        );
    }

    if (parsed.every((item) => !Array.isArray(item))) {
        return [await createArtboardFromItems(parsed as unknown[], 0)];
    }

    throw new Error("Некорректный JSON: используйте [блок, …] или [[блок, …], …]");
}

export function placeArtboardsOnCanvas(artboards: FrameNode[]): void {
    const {center, bounds} = figma.viewport;
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

async function createArtboardFromItems(
    items: unknown[],
    index: number,
): Promise<FrameNode> {
    const artboard = createArtboard(index);
    if (items.length === 0) return artboard;

    if (isStyleBlockArray(items)) {
        const blocks = items.map((raw, j) => parseTextSegment(raw, j));
        const nodeJsons = groupBlocksIntoNodes(blocks);
        for (const nodeJson of nodeJsons) {
            const child = await createSceneNode(nodeJson);
            artboard.appendChild(child);
            applyLayoutSizing(child, nodeJson, artboard);
        }
        return artboard;
    }

    for (const item of items) {
        assertJsonNode(item);
        const child = await createSceneNode(item);
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

async function createSceneNode(json: JsonNode): Promise<SceneNode> {
    switch (json.type) {
        case NodeType.FRAME:
            return createFrameNode(json);
        case NodeType.TEXT:
            return createTextNode(json);
        default:
            throw new Error(`Неподдерживаемый type: ${String(json.type)}`);
    }
}

async function createFrameNode(json: JsonNode): Promise<FrameNode> {
    const node = figma.createFrame();
    applyCommonProperties(node, json);
    applyFramePreset(node, json.name);
    applyFrameLayout(node, json);
    applyFrameSize(node, json);
    applyFillsAndStrokes(node, json);

    if (Array.isArray(json.children)) {
        await buildAndAppendChildren(node, json.children);
    }

    finalizeFrameSize(node, json);
    return node;
}

function applyFramePreset(node: FrameNode, name?: string): void {
    if (name !== FramePreset.CODE) return;

    node.layoutMode = "VERTICAL";
    node.primaryAxisSizingMode = "AUTO";
    node.counterAxisSizingMode = "AUTO";
    node.itemSpacing = CODE_FRAME.ITEM_SPACING;
    applyPadding(node, CODE_FRAME.PADDING);
    node.cornerRadius = CODE_FRAME.CORNER_RADIUS;
    node.strokeWeight = CODE_FRAME.STROKE_WEIGHT;
    node.strokes = convertToFigmaPaints([{type: "SOLID", color: CODE_FRAME.STROKE_COLOR}]);
    node.fills = convertToFigmaPaints([
        {type: "SOLID", color: CODE_FRAME.FILL_COLOR, opacity: CODE_FRAME.FILL_OPACITY},
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

function finalizeFrameSize(node: FrameNode, json: JsonNode): void {
    if (typeof json.width === "number" && typeof json.height !== "number") {
        node.resize(json.width, node.height);
    }
    if (typeof json.height === "number" && typeof json.width !== "number") {
        node.resize(node.width, json.height);
    }
}

function applyFillsAndStrokes(node: FrameNode, json: JsonNode): void {
    if (json.fills) node.fills = convertToFigmaPaints(json.fills);
    if (typeof json.strokeWeight === "number") node.strokeWeight = json.strokeWeight;
    if (json.strokes) node.strokes = convertToFigmaPaints(json.strokes);
}

async function buildAndAppendChildren(
    parent: FrameNode,
    children: JsonNode[],
): Promise<void> {
    const hasAutoLayout =
        parent.layoutMode === "HORIZONTAL" || parent.layoutMode === "VERTICAL";

    for (const childJson of children) {
        const child = await createSceneNode(childJson);
        parent.appendChild(child);
        if (hasAutoLayout) {
            applyLayoutSizing(child, childJson, parent);
        }
    }
}

async function createTextNode(json: JsonNode): Promise<TextNode> {
    const segments = parseTextSegments(json.textSegments);
    const node = figma.createText();
    applyCommonProperties(node, json);

    const h2PaintStyleId = await resolvePaintStyleId(H2_PAINT_STYLE_NAME);
    await applyStyledSegments(node, segments, h2PaintStyleId);

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

async function applyStyledSegments(
    node: TextNode,
    segments: TextSegment[],
    h2PaintStyleId: string | null,
): Promise<void> {
    const resolved = await resolveAllSegmentStyles(segments);

    for (const {style} of resolved) {
        await figma.loadFontAsync(style.fontName);
    }

    node.fontName = resolved[0].style.fontName;

    const texts = resolved.map((r) => flattenSegmentText(r.segment));
    const separators = computeSegmentSeparators(resolved);
    node.characters = texts.map((s, i) => s + (separators[i] ?? "")).join("");

    let offset = 0;
    for (let i = 0; i < resolved.length; i++) {
        const {segment, style} = resolved[i];
        const end = offset + texts[i].length;
        await node.setRangeTextStyleIdAsync(offset, end, style.id);
        if (Array.isArray(segment.characters)) {
            applyUnorderedListStyle(node, offset, end);
        }
        if (segment.textStyleName === "h2" && h2PaintStyleId) {
            await node.setRangeFillStyleIdAsync(offset, end, h2PaintStyleId);
        }
        offset = end + (separators[i]?.length ?? 0);
    }
}

async function resolveAllSegmentStyles(
    segments: TextSegment[],
): Promise<ResolvedSegment[]> {
    const resolved: ResolvedSegment[] = [];
    for (const segment of segments) {
        resolved.push({segment, style: await resolveTextStyle(segment.textStyleName)});
    }
    return resolved;
}

function flattenSegmentText(segment: TextSegment): string {
    return Array.isArray(segment.characters)
        ? segment.characters.join("\n")
        : segment.characters;
}

function computeSegmentSeparators(resolved: ResolvedSegment[]): string[] {
    return resolved.slice(0, -1).map((r, i) => {
        const isParagraph = r.segment.textStyleName === "p";
        const nextIsHeading = resolved[i + 1].segment.textStyleName === "h2";
        return isParagraph && nextIsHeading ? "\n\n" : "\n";
    });
}

function applyUnorderedListStyle(node: TextNode, start: number, end: number): void {
    if (end <= start) return;
    const ext = node as TextNode & {
        setRangeListOptions?: (s: number, e: number, opts: { type: "UNORDERED" }) => void;
    };
    if (typeof ext.setRangeListOptions !== "function") return;
    ext.setRangeListOptions(start, end, {type: "UNORDERED"});
}

function applyCommonProperties(node: SceneNode, json: JsonNode): void {
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
    parent: FrameNode,
): void {
    if (!("layoutSizingHorizontal" in child)) return;

    const layout = child as SceneNode & LayoutMixin;
    const horizontal = childJson.layoutSizingHorizontal ?? LayoutSizing.FILL;
    const canHug =
        child.type === "TEXT" ||
        (child.type === "FRAME" && (child as FrameNode).layoutMode !== "NONE");
    const vertical = childJson.layoutSizingVertical ?? (canHug ? LayoutSizing.HUG : LayoutSizing.FILL);

    if (horizontal === LayoutSizing.FILL || vertical === LayoutSizing.FILL) {
        layout.resize(
            horizontal === LayoutSizing.FILL ? parent.width : child.width,
            vertical === LayoutSizing.FILL ? parent.height : child.height,
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
