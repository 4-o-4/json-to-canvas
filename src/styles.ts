import {HexColor, JsonPaint} from "./types";

const styleCache = {
    text: null as TextStyle[] | null,
    paint: null as PaintStyle[] | null,
};

export async function resolveTextStyle(name: string): Promise<TextStyle> {
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

export async function resolvePaintStyleId(name: string): Promise<string | null> {
    if (!styleCache.paint) {
        styleCache.paint = await figma.getLocalPaintStylesAsync();
    }
    return styleCache.paint.find((s) => s.name === name)?.id ?? null;
}

export function convertToFigmaPaints(paints: JsonPaint[]): Paint[] {
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

export function parseHexColor(hex: HexColor): { r: number; g: number; b: number } {
    const normalized = hex.replace("#", "").trim();
    if (normalized.length !== 3 && normalized.length !== 6) {
        throw new Error(`Неверный HEX цвет: ${hex}`);
    }
    const full =
        normalized.length === 3
            ? normalized
                .split("")
                .map((ch) => ch + ch)
                .join("")
            : normalized;
    const value = parseInt(full, 16);
    return {
        r: ((value >> 16) & 255) / 255,
        g: ((value >> 8) & 255) / 255,
        b: (value & 255) / 255,
    };
}
