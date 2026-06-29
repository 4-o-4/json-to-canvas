export type MarkdownStyleMapping = {
    heading: Partial<Record<1 | 2 | 3 | 4 | 5 | 6, string>>;
    paragraph: string;
    code: string;
    list: string;
    blockquote: string;
    /** false — не разбивать документ на артборды по горизонтальной линии `---` */
    artboardSeparator?: boolean;
};

export const MARKDOWN_STYLE_MAPPING: MarkdownStyleMapping = {
    heading: {
        1: "h1",
        2: "h2",
        3: "h2",
        4: "h2",
        5: "h2",
        6: "h2"
    },
    paragraph: "p",
    code: "code",
    list: "p",
    blockquote: "p",
};
