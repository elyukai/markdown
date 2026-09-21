import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { format, formatInline } from "../../src/render/format.ts"

describe("formatInline", () => {
  it("formats markdown syntax while preserving text", () => {
    assert.equal(formatInline("Hello **world**"), "Hello **world**")
    assert.equal(
      formatInline('A ^[link](url:"test",number:1) and ` code `.'),
      'A ^[link](url: "test", number: 1) and ` code `.',
    )
  })

  it("handles empty input", () => {
    assert.equal(formatInline(""), "")
  })
})

describe("format", () => {
  it("does not align table columns by default", () => {
    const input = `| Header 1 | Header 2 |
|---|:-:|
| Row 1  | Row 1    |
| Row 2   | Row 2   |
`
    const expected = `| Header 1 | Header 2 |
| --- | :-: |
| Row 1 | Row 1 |
| Row 2 | Row 2 |`

    assert.equal(format(input), expected)
  })

  it("aligns table columns when option set", () => {
    const input = `| Header 1 | Header 2 |
|---|:-:|
| Row 1 | Row 1 |
| Row 2 | Row 2 |
`
    const expected = `| Header 1 | Header 2 |
| -------- | :------: |
| Row 1    | Row 1    |
| Row 2    | Row 2    |`

    assert.equal(format(input, { alignTableDividers: true }), expected)
  })
})
