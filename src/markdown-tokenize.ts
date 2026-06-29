import {Lexer, Tokenizer, type Token, type Tokens} from "marked";
import {CODE_LINE_SEPARATOR} from "./constants";

export function tokenizeMarkdown(markdown: string): Token[] {
    const tokenizer = new Tokenizer();
    const lexer = new Lexer({tokenizer});
    const normalized = markdown.replace(/\r\n|\r/g, "\n");
    const tokens: Token[] = [];

    collectBlockTokens(lexer, tokenizer, normalized, tokens);

    for (let i = 0; i < lexer.inlineQueue.length; i++) {
        const item = lexer.inlineQueue[i];
        lexer.inlineTokens(item.src, item.tokens);
    }

    return tokens;
}

function collectBlockTokens(
    lexer: Lexer,
    tokenizer: Tokenizer,
    src: string,
    tokens: Token[],
): void {
    tokenizer.lexer = lexer;

    let remaining = lexer.options.pedantic
        ? src.replace(/\t/g, "    ").replace(/^ +$/gm, "")
        : src;

    let minLength = Infinity;

    while (remaining) {
        if (remaining.length < minLength) {
            minLength = remaining.length;
        } else {
            throwInfiniteLoop(remaining);
        }

        const afterSpace = consumeSpace(tokenizer, remaining, tokens);
        if (afterSpace !== null) {
            remaining = afterSpace;
            continue;
        }

        const code = tokenizer.code(remaining);
        if (code) {
            remaining = remaining.substring(code.raw.length);
            mergeOrPushCodeBlock(lexer, tokens, code);
            continue;
        }

        const fences = tokenizer.fences(remaining);
        if (fences) {
            remaining = remaining.substring(fences.raw.length);
            tokens.push(fences);
            continue;
        }

        const heading = tokenizer.heading(remaining);
        if (heading) {
            remaining = remaining.substring(heading.raw.length);
            tokens.push(heading);
            continue;
        }

        const hr = tokenizer.hr(remaining);
        if (hr) {
            remaining = remaining.substring(hr.raw.length);
            tokens.push(hr);
            continue;
        }

        const blockquote = tokenizer.blockquote(remaining);
        if (blockquote) {
            remaining = remaining.substring(blockquote.raw.length);
            tokens.push(blockquote);
            continue;
        }

        const list = tokenizer.list(remaining);
        if (list) {
            remaining = remaining.substring(list.raw.length);
            tokens.push(list);
            continue;
        }

        const html = tokenizer.html(remaining);
        if (html) {
            remaining = remaining.substring(html.raw.length);
            tokens.push(html);
            continue;
        }

        const def = tokenizer.def(remaining);
        if (def) {
            remaining = remaining.substring(def.raw.length);
            mergeOrPushDef(lexer, tokens, def);
            continue;
        }

        const table = tokenizer.table(remaining);
        if (table) {
            remaining = remaining.substring(table.raw.length);
            tokens.push(table);
            continue;
        }

        const lheading = tokenizer.lheading(remaining);
        if (lheading) {
            remaining = remaining.substring(lheading.raw.length);
            tokens.push(lheading);
            continue;
        }

        if (lexer.state.top) {
            const paragraph = tokenizer.paragraph(remaining);
            if (paragraph) {
                remaining = remaining.substring(paragraph.raw.length);
                tokens.push(paragraph);
                continue;
            }
        }

        const text = tokenizer.text(remaining);
        if (text) {
            remaining = remaining.substring(text.raw.length);
            mergeOrPushTextBlock(lexer, tokens, text);
            continue;
        }

        throwInfiniteLoop(remaining);
    }

    lexer.state.top = true;
}

function lastToken(tokens: Token[]): Token | undefined {
    return tokens.length > 0 ? tokens[tokens.length - 1] : undefined;
}

function lastInlineQueueItem(lexer: Lexer): { src: string; tokens: Token[] } | undefined {
    const queue = lexer.inlineQueue;
    return queue.length > 0 ? queue[queue.length - 1] : undefined;
}

function isTextLikeToken(token: Token | undefined): token is Tokens.Paragraph | Tokens.Text {
    return token?.type === "paragraph" || token?.type === "text";
}

function rawSeparator(last: Token): string {
    return last.raw.endsWith("\n") ? "" : "\n";
}

function syncLastInlineSrc(lexer: Lexer, last: Token): void {
    const queueItem = lastInlineQueueItem(lexer);
    if (queueItem && "text" in last && typeof last.text === "string") {
        queueItem.src = last.text;
    }
}

function consumeSpace(
    tokenizer: Tokenizer,
    src: string,
    tokens: Token[],
): string | null {
    const space = tokenizer.space(src);
    if (!space) return null;

    const remaining = src.substring(space.raw.length);
    const last = lastToken(tokens);
    if (space.raw.length === 1 && last !== undefined) {
        last.raw += "\n";
    } else {
        tokens.push(space);
    }
    return remaining;
}

function mergeOrPushCodeBlock(lexer: Lexer, tokens: Token[], code: Token): void {
    const last = lastToken(tokens);
    if (isTextLikeToken(last)) {
        last.raw += rawSeparator(last) + code.raw;
        if ("text" in code && typeof code.text === "string") {
            last.text += CODE_LINE_SEPARATOR + code.text;
        }
        syncLastInlineSrc(lexer, last);
        return;
    }
    tokens.push(code);
}

function mergeOrPushDef(lexer: Lexer, tokens: Token[], def: Token): void {
    const last = lastToken(tokens);
    if (isTextLikeToken(last)) {
        last.raw += rawSeparator(last) + def.raw;
        last.text += "\n" + def.raw;
        syncLastInlineSrc(lexer, last);
        return;
    }

    if (def.type === "def" && !lexer.tokens.links[def.tag]) {
        lexer.tokens.links[def.tag] = {href: def.href, title: def.title};
        tokens.push(def);
    }
}

function mergeOrPushTextBlock(lexer: Lexer, tokens: Token[], text: Token): void {
    const last = lastToken(tokens);
    if (last?.type === "text" && "text" in text) {
        last.raw += rawSeparator(last) + text.raw;
        last.text += "\n" + text.text;
        lexer.inlineQueue.pop();
        syncLastInlineSrc(lexer, last);
        return;
    }
    tokens.push(text);
}

function throwInfiniteLoop(remaining: string): never {
    throw new Error(`Infinite loop on byte: ${remaining.charCodeAt(0)}`);
}
