import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { caseKeys } from "@/lib/query-keys"

/**
 * Contract stub: ilovelawyer-api does not yet expose these routes.
 * Shape matches the presigned-URL, direct-to-S3 upload flow — backend
 * issues a short-lived PUT URL, the browser uploads bytes straight to S3,
 * then the case is created referencing the resulting object keys.
 */
export interface PresignedUpload {
  uploadUrl: string
  key: string
}

export function useCreateDocumentUploadUrlMutation() {
  return useMutation({
    mutationFn: ({ fileName, fileType, fileSize }: { fileName: string; fileType: string; fileSize: number }) =>
      apiFetch<PresignedUpload>("/api/cases/documents/presign", {
        method: "POST",
        body: JSON.stringify({ fileName, fileType, fileSize }),
      }),
  })
}

/** Uploads bytes directly to S3 via a presigned URL — must bypass apiFetch (no auth header, not our API host). */
export function uploadFileToS3(uploadUrl: string, file: File, onProgress?: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", uploadUrl)
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`S3 upload failed with status ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error("Network error during S3 upload"))
    xhr.send(file)
  })
}

export interface CaseDocumentInput {
  key: string
  fileName: string
}

export interface CasePartyInput {
  name: string
  designation: string
}

export interface CreateCasePayload {
  caseTitle: string
  actionType: string
  jurisdiction: string
  parties: CasePartyInput[]
  documents: CaseDocumentInput[]
}

export interface Case {
  id: string
  caseTitle: string
  createdAt: string
}

export function useCreateCaseMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateCasePayload) =>
      apiFetch<Case>("/api/cases", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.lists() })
    },
  })
}
