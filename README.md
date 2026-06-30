# json-to-canvas

#### Document structure

Single artboard — a flat array of style blocks:

```json
[
  {"h2": "Heading"},
  {"p": "Paragraph text"}
]
```

Multiple artboards:

```json
[ [ … ], [ … ] ]
```

#### Style blocks

| Key | Description |
|-----|-------------|
| `h1` | Text with the `h1` style |
| `h2` | Text with the `h2` style |
| `h3` | Text with the `h3` style |
| `p` | Paragraph with the `p` style |
| `code` | Code in a frame with the Code preset |

The key is the name of a local text style in the Figma file.

```json
[
  {"h1": "H1 Heading"},
  {"h2": "H2 Heading"},
  {"p": "Main paragraph text."},
  {"p": "Another paragraph in a row."},
  {"code": "print(\"Hello, World!\")"}
]
```

Consecutive blocks (except `code`) are merged into a single text node.

#### Value type

- String — plain text.
- Array of strings — bulleted list.

```json
{"p": ["First item", "Second item", "Third item"]}
```

#### Special behavior for specific keys

| Key | Behavior |
|-----|----------|
| `code` | Wrapped in a frame with the Code preset (background, stroke, padding) |
| `h2`, `h3` | Additionally applies a paint style named `"4654D9"` |
| `p` | Inserts a double line break `\n\n` before the next `h2` or `h3` instead of a single one |
