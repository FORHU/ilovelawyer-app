import { describe, it, expect } from "vitest"
import { documentViewerHref, findViewerDocument } from "../document-viewer"

const docs = [
  { id: "a1", name: "22_POLICE_Phone_Records.pdf" },
  { id: "b2", name: "19_DEFENSE_Proof_of_Evidence.pdf" },
]

describe("documentViewerHref", () => {
  it("links by id, carrying the name as a fallback", () => {
    expect(documentViewerHref("c1", { docId: "a1", doc: "22_POLICE_Phone_Records.pdf" })).toBe(
      "/homepage/terminal/c1/document?id=a1&name=22_POLICE_Phone_Records.pdf",
    )
  })

  it("links by name alone when the record has no id", () => {
    expect(documentViewerHref("c1", { docId: null, doc: "Report.pdf" })).toBe("/homepage/terminal/c1/document?name=Report.pdf")
  })

  it("has nothing to link when there is neither an id nor a real name", () => {
    expect(documentViewerHref("c1", { docId: null, doc: "" })).toBeNull()
    expect(documentViewerHref("c1", { docId: null, doc: "0f8fad5b-d9cb-469f-a165-70867728950e" })).toBeNull()
  })
})

describe("findViewerDocument", () => {
  it("prefers the id, then falls back to a case-insensitive name match", () => {
    expect(findViewerDocument(docs, { id: "b2", name: "22_POLICE_Phone_Records.pdf" })?.id).toBe("b2")
    expect(findViewerDocument(docs, { id: "gone", name: " 22_police_phone_records.PDF " })?.id).toBe("a1")
  })

  it("finds nothing for an unknown document", () => {
    expect(findViewerDocument(docs, { id: "gone", name: "Other.pdf" })).toBeUndefined()
    expect(findViewerDocument(docs, { id: null, name: null })).toBeUndefined()
  })
})
