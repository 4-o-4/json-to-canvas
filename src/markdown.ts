import {Parser, TextRenderer, type Token, type Tokens} from "marked";
import {CODE_LINE_SEPARATOR} from "./constants";
import type {MarkdownStyleMapping} from "./markdown-config";
import {tokenizeMarkdown} from "./markdown-tokenize";

export type StyleBlock = Record<string, string | string[]>;

export type MarkdownConversionResult = {
    blocks: StyleBlock[] | StyleBlock[][];
    warnings: string[];
};

type HeadingDepth = 1 | 2 | 3 | 4 | 5 | 6;
type TextToken = { text: string; tokens?: Token[] };

const textRenderer = new TextRenderer();
const inlineParser = new Parser();

function tokensToPlainText(tokens: Token[]): string {
    if (tokens.length === 0) return "";
    return inlineParser.parseInline(tokens, textRenderer);
}

function blockTokenText(token: TextToken): string {
    if (token.tokens && token.tokens.length > 0) {
        return tokensToPlainText(token.tokens);
    }
    return token.text;
}

function formatCodeBlockText(text: string): string {
    return text.split(/\r\n|\r|\n/).join(CODE_LINE_SEPARATOR);
}

export function markdownToLayout(
    markdown: string,
    mapping: MarkdownStyleMapping,
): MarkdownConversionResult {
    const warnings: string[] = [];
    const trimmed = markdown.trim();

    if (!trimmed) {
        return {blocks: [], warnings: ["Файл пуст"]};
    }

    const tokens = tokenizeMarkdown(trimmed);
    const artboards: StyleBlock[][] = [];
    let current: StyleBlock[] = [];

    for (const token of tokens) {
        if (token.type === "hr" && mapping.artboardSeparator !== false) {
            artboards.push(current);
            current = [];
            continue;
        }

        const block = tokenToStyleBlock(token, mapping, warnings);
        if (block) {
            current.push(block);
        }
    }

    artboards.push(current);

    const nonEmpty = artboards.filter((board) => board.length > 0);
    if (nonEmpty.length === 0) {
        return {blocks: [], warnings};
    }
    if (nonEmpty.length === 1) {
        return {blocks: nonEmpty[0], warnings};
    }
    return {blocks: nonEmpty, warnings};
}

function tokenToStyleBlock(
    token: Token,
    mapping: MarkdownStyleMapping,
    warnings: string[],
): StyleBlock | null {
    switch (token.type) {
        case "heading": {
            const depth = token.depth as HeadingDepth;
            const style = mapping.heading[depth];
            if (!style) {
                warnings.push(`Заголовок h${depth} не сопоставлен — пропущен`);
                return null;
            }
            const text = blockTokenText(token as Tokens.Heading).trim();
            if (!text) return null;
            return {[style]: text};
        }
        case "paragraph": {
            const text = blockTokenText(token as Tokens.Paragraph).trim();
            if (!text) return null;
            return {[mapping.paragraph]: text};
        }
        case "code":
            return {[mapping.code]: formatCodeBlockText(token.text)};
        case "list": {
            const items = token.items
                .map((item: Tokens.ListItem) => listItemText(item))
                .filter((text: string) => text.length > 0);
            if (items.length === 0) return null;
            if (items.length === 1) {
                return {[mapping.list]: items[0]};
            }
            return {[mapping.list]: items};
        }
        case "blockquote": {
            const text = token.text.trim();
            if (!text) return null;
            return {[mapping.blockquote]: text};
        }
        case "space":
            return null;
        default:
            warnings.push(`Блок «${token.type}» не поддерживается — пропущен`);
            return null;
    }
}

function listItemText(item: Tokens.ListItem): string {
    if (item.tokens.length > 0) {
        return item.tokens
            .map((t) => {
                if (t.type === "paragraph") return blockTokenText(t as Tokens.Paragraph);
                if (t.type === "text") return blockTokenText(t as Tokens.Text);
                if ("text" in t && typeof t.text === "string") return t.text;
                return "";
            })
            .join("\n")
            .trim();
    }
    return item.text.trim();
}
