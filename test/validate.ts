import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { validate } from "../src/validate.js"

describe("validate", () => {
  it("accepts an empty document", () => {
    assert.deepEqual(validate(""), [])
  })

  it("accepts valid markdown", () => {
    assert.deepEqual(
      validate("# Heading\n\nThis is **bold** and [a link](https://example.com)."),
      [],
    )
  })
})
