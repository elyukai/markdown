# Markdown

This library is a simple Markdown parser implementation. It does not provide all features of Markdown and is more strict in terms of syntax. However, this makes it more predictable.

A rule it enforces is that there has to be at least a single blank line between blocks. Bold and italic formatting only works with asterisks; unordered lists only work with hyphens.

## Syntax Support

### Inline

- Bold (only `**`)
- Italic (only `*`)
- Footnote references (`[^1]`)
- Links (only explicitly using `^[link text](https://example.com)`)
- Attributed Strings (`^[content](attr1: "string", attr2: 42, attr3: true)`)
- Superscript (`^`)
- Inline code (`` ` ``)
- Superscript (`^`)

### Block

- Line breaks in paragraphs are always hard breaks
- Headings
- Unordered lists (only `-`)
- Ordered lists
- Tables, including captions and section headers
- Containers (`:::` with a name)
- Definition lists

## Implementation

The parser is implemented using a combination of parser combinators and a state monad implementation.
