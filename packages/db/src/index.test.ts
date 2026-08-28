import { describe, expect, it, vi } from "vitest"
import { handleIdlePoolErrors } from "./index"

describe("database pool errors", () => {
  it("handles an idle disconnect instead of letting EventEmitter terminate the process", () => {
    let listener: ((error: Error) => void) | undefined
    const source = {
      on: (_event: "error", next: (error: Error) => void) => {
        listener = next
      },
    }
    const report = vi.fn<(message: string) => void>()
    handleIdlePoolErrors(source, report)

    const error = Object.assign(new Error("terminating connection due to administrator command"), {
      code: "57P01",
    })

    expect(() => listener?.(error)).not.toThrow()
    expect(report).toHaveBeenCalledOnce()
    expect(JSON.parse(report.mock.calls[0]?.[0])).toEqual({
      level: "error",
      message: "idle database connection was dropped; the pool will reconnect",
      error: error.message,
      code: "57P01",
    })
  })
})
