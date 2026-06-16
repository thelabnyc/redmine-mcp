import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    type ToolResult,
    cleanupTestEnv,
    createTestClientServer,
    getTextContent,
    mockFetch,
    setupTestEnv,
} from "../../test-utils.js";

interface Attachment {
    id: number;
    filename: string;
    filesize: number;
    content_type: string;
    description?: string;
    author: { id: number; name: string };
    created_on: string;
    content_url?: string;
}

interface AttachmentResponse {
    attachment: Attachment;
}

interface IssueUploadRequestBody {
    issue: {
        uploads: Array<{
            token: string;
            filename: string;
            content_type?: string;
            description?: string;
        }>;
        notes?: string;
        private_notes?: boolean;
    };
}

function parseJsonResult<T>(result: ToolResult): T {
    return JSON.parse(getTextContent(result)) as T;
}

const sampleAttachment: Attachment = {
    id: 42,
    filename: "report final.txt",
    filesize: 14,
    content_type: "text/plain",
    description: "Final report",
    author: { id: 7, name: "Jane Smith" },
    created_on: "2026-06-16T12:34:56Z",
    content_url:
        "https://test.redmine.com/attachments/download/42/report%20final.txt",
};

describe("attachment tools", () => {
    let tempDir: string;
    let generatedDownloadDirs: string[];

    beforeEach(async () => {
        setupTestEnv();
        generatedDownloadDirs = [];
        tempDir = await mkdtemp(
            path.join(tmpdir(), "redmine-mcp-attachments-"),
        );
        process.env.REDMINE_MCP_FILE_ROOT = tempDir;
    });

    afterEach(async () => {
        cleanupTestEnv();
        await Promise.all(
            generatedDownloadDirs.map((dirPath) =>
                rm(dirPath, { recursive: true, force: true }),
            ),
        );
        await rm(tempDir, { recursive: true, force: true });
    });

    it("gets an attachment by ID", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    attachment: sampleAttachment,
                } satisfies AttachmentResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "get-attachment",
                arguments: { attachmentId: 42 },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("https://test.redmine.com/attachments/42.json");
            expect(options.method).toBe("GET");
            expect(
                (options.headers as Record<string, string>)[
                    "X-Redmine-API-Key"
                ],
            ).toBe("test-api-key");

            expect(result.isError).toBeFalsy();
            const attachment = parseJsonResult<Attachment>(result);
            expect(attachment.id).toBe(42);
            expect(attachment.content_url).toBe(sampleAttachment.content_url);
        } finally {
            await cleanup();
        }
    });

    it("surfaces get attachment API errors", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: "Not Found",
            json: () => Promise.resolve({ errors: ["Attachment not found"] }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "get-attachment",
                arguments: { attachmentId: 404 },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain(
                "Failed to fetch attachment 404: 404 Not Found - Attachment not found",
            );
        } finally {
            await cleanup();
        }
    });

    it("advertises download attachment without caller-controlled destination fields", async () => {
        const { client, cleanup } = await createTestClientServer();

        try {
            const tools = await client.listTools();
            const tool = tools.tools.find(
                (candidate) => candidate.name === "download-attachment",
            );
            const schema = tool?.inputSchema as {
                properties?: Record<string, unknown>;
                required?: string[];
            };

            expect(schema.properties).toHaveProperty("attachmentId");
            expect(schema.properties).not.toHaveProperty("destinationPath");
            expect(schema.properties).not.toHaveProperty("overwrite");
            expect(schema.required).toEqual(["attachmentId"]);
        } finally {
            await cleanup();
        }
    });

    it("uploads a local file and attaches it to an issue", async () => {
        const filePath = path.join(tempDir, "local upload.txt");
        const fileBytes = Buffer.from("hello attachment\n", "utf8");
        await writeFile(filePath, fileBytes);

        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: () =>
                    Promise.resolve({ upload: { token: "upload-token" } }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 204,
                json: () => Promise.resolve({}),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "attach-file-to-issue",
                arguments: {
                    issueId: "#12345",
                    filePath,
                    filename: "remote name.txt",
                    description: "Evidence file",
                    contentType: "text/plain",
                    notes: "Attached supporting evidence.",
                    privateNotes: true,
                },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(2);

            const [uploadUrl, uploadOptions] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(uploadUrl).toBe(
                "https://test.redmine.com/uploads.json?filename=remote+name.txt",
            );
            expect(uploadOptions.method).toBe("POST");
            expect(
                (uploadOptions.headers as Record<string, string>)[
                    "Content-Type"
                ],
            ).toBe("application/octet-stream");
            expect(Buffer.from(uploadOptions.body as Buffer)).toEqual(
                fileBytes,
            );

            const [attachUrl, attachOptions] = mockFetch.mock.calls[1] as [
                string,
                RequestInit,
            ];
            expect(attachUrl).toBe(
                "https://test.redmine.com/issues/12345.json",
            );
            expect(attachOptions.method).toBe("PUT");
            const attachBody = JSON.parse(
                attachOptions.body as string,
            ) as IssueUploadRequestBody;
            expect(attachBody.issue.uploads).toEqual([
                {
                    token: "upload-token",
                    filename: "remote name.txt",
                    content_type: "text/plain",
                    description: "Evidence file",
                },
            ]);
            expect(attachBody.issue.notes).toBe(
                "Attached supporting evidence.",
            );
            expect(attachBody.issue.private_notes).toBe(true);

            expect(result.isError).toBeFalsy();
            const data = parseJsonResult<{
                attached: boolean;
                issueId: number;
                upload: {
                    token: string;
                    filename: string;
                    content_type?: string;
                    description?: string;
                };
            }>(result);
            expect(data).toEqual({
                attached: true,
                issueId: 12345,
                upload: {
                    token: "upload-token",
                    filename: "remote name.txt",
                    content_type: "text/plain",
                    description: "Evidence file",
                },
            });
        } finally {
            await cleanup();
        }
    });

    it("uploads a local file from the OS temp directory outside the configured file root", async () => {
        const outsideTempDir = await mkdtemp(
            path.join(tmpdir(), "redmine-mcp-upload-temp-"),
        );
        const filePath = path.join(outsideTempDir, "temp-upload.txt");
        await writeFile(filePath, "temp body", "utf8");

        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: () =>
                    Promise.resolve({ upload: { token: "temp-token" } }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 204,
                json: () => Promise.resolve({}),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "attach-file-to-issue",
                arguments: {
                    issueId: 12345,
                    filePath,
                },
            })) as ToolResult;

            expect(result.isError).toBeFalsy();
            const [uploadUrl] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(uploadUrl).toBe(
                "https://test.redmine.com/uploads.json?filename=temp-upload.txt",
            );
        } finally {
            await cleanup();
            await rm(outsideTempDir, { recursive: true, force: true });
        }
    });

    it("uses the local basename when attaching without a filename", async () => {
        const filePath = path.join(tempDir, "basename.txt");
        await writeFile(filePath, "body", "utf8");

        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: () => Promise.resolve({ upload: { token: "token-2" } }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 204,
                json: () => Promise.resolve({}),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            await client.callTool({
                name: "attach-file-to-issue",
                arguments: {
                    issueId: 12345,
                    filePath,
                },
            });

            const [uploadUrl] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(uploadUrl).toBe(
                "https://test.redmine.com/uploads.json?filename=basename.txt",
            );

            const [, attachOptions] = mockFetch.mock.calls[1] as [
                string,
                RequestInit,
            ];
            const attachBody = JSON.parse(
                attachOptions.body as string,
            ) as IssueUploadRequestBody;
            expect(attachBody.issue.uploads[0]).toEqual({
                token: "token-2",
                filename: "basename.txt",
            });
        } finally {
            await cleanup();
        }
    });

    it("rejects invalid issue IDs when attaching files", async () => {
        const filePath = path.join(tempDir, "evidence.txt");
        await writeFile(filePath, "body", "utf8");

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "attach-file-to-issue",
                arguments: {
                    issueId: "abc",
                    filePath,
                },
            })) as ToolResult;

            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain("Invalid issue ID: abc");
        } finally {
            await cleanup();
        }
    });

    it("surfaces file read errors when attaching files", async () => {
        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "attach-file-to-issue",
                arguments: {
                    issueId: "12345",
                    filePath: path.join(tempDir, "missing.txt"),
                },
            })) as ToolResult;

            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain("Error attaching file:");
            expect(getTextContent(result)).toContain("missing.txt");
        } finally {
            await cleanup();
        }
    });

    it("rejects file uploads outside the configured file root", async () => {
        const outsideDir = await mkdtemp(
            path.join(process.cwd(), ".redmine-mcp-outside-"),
        );
        const outsidePath = path.join(outsideDir, "secret.txt");
        await writeFile(outsidePath, "do not upload", "utf8");

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "attach-file-to-issue",
                arguments: {
                    issueId: "12345",
                    filePath: outsidePath,
                },
            })) as ToolResult;

            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain(
                `Path is outside configured file root and OS temp directory: ${outsidePath}`,
            );
        } finally {
            await cleanup();
            await rm(outsideDir, { recursive: true, force: true });
        }
    });

    it("rejects file uploads that exceed the configured size limit", async () => {
        process.env.REDMINE_MCP_MAX_UPLOAD_BYTES = "4";
        const filePath = path.join(tempDir, "too-large.txt");
        await writeFile(filePath, "12345", "utf8");

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "attach-file-to-issue",
                arguments: {
                    issueId: "12345",
                    filePath,
                },
            })) as ToolResult;

            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain(
                "File too large to upload: 5 bytes (limit 4 bytes).",
            );
        } finally {
            await cleanup();
        }
    });

    it("surfaces upload API errors when attaching files", async () => {
        const filePath = path.join(tempDir, "upload.txt");
        await writeFile(filePath, "body", "utf8");

        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 422,
            statusText: "Unprocessable Content",
            json: () => Promise.resolve({ errors: ["Upload failed"] }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "attach-file-to-issue",
                arguments: {
                    issueId: "12345",
                    filePath,
                },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain(
                "Failed to upload attachment upload.txt: 422 Unprocessable Content - Upload failed",
            );
        } finally {
            await cleanup();
        }
    });

    it("surfaces network errors when fetching attachment metadata", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "get-attachment",
                arguments: { attachmentId: 42 },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain("Network error");
        } finally {
            await cleanup();
        }
    });

    it("downloads an attachment content URL to a generated temp path with the Redmine filename", async () => {
        const downloadedBytes = Uint8Array.from([0, 1, 2, 255]);

        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        attachment: sampleAttachment,
                    } satisfies AttachmentResponse),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                arrayBuffer: () => Promise.resolve(downloadedBytes.buffer),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "download-attachment",
                arguments: {
                    attachmentId: 42,
                },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(2);
            const [downloadUrl, downloadOptions] = mockFetch.mock.calls[1] as [
                string,
                RequestInit,
            ];
            expect(downloadUrl).toBe(sampleAttachment.content_url);
            expect(downloadOptions.method).toBe("GET");
            expect(
                (downloadOptions.headers as Record<string, string>)[
                    "X-Redmine-API-Key"
                ],
            ).toBe("test-api-key");

            expect(result.isError).toBeFalsy();
            const data = parseJsonResult<{
                attachment: Attachment;
                saved_path: string;
            }>(result);
            generatedDownloadDirs.push(path.dirname(data.saved_path));
            expect(data.attachment.id).toBe(42);
            expect(path.basename(data.saved_path)).toBe(
                sampleAttachment.filename,
            );
            expect(path.dirname(data.saved_path)).toContain(
                path.join(tmpdir(), "redmine-mcp-attachment-"),
            );
            await expect(readFile(data.saved_path)).resolves.toEqual(
                Buffer.from(downloadedBytes),
            );
        } finally {
            await cleanup();
        }
    });

    it("sanitizes Redmine filenames before writing to the generated temp directory", async () => {
        const unsafeFilenameAttachment: Attachment = {
            ...sampleAttachment,
            filename: "../report.pdf",
        };
        const downloadedBytes = Uint8Array.from([9, 8, 7]);

        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        attachment: unsafeFilenameAttachment,
                    } satisfies AttachmentResponse),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                arrayBuffer: () => Promise.resolve(downloadedBytes.buffer),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "download-attachment",
                arguments: {
                    attachmentId: 42,
                },
            })) as ToolResult;

            expect(result.isError).toBeFalsy();
            const data = parseJsonResult<{
                saved_path: string;
            }>(result);
            generatedDownloadDirs.push(path.dirname(data.saved_path));
            expect(path.basename(data.saved_path)).toBe("report.pdf");
            expect(path.dirname(data.saved_path)).toContain(
                path.join(tmpdir(), "redmine-mcp-attachment-"),
            );
            await expect(readFile(data.saved_path)).resolves.toEqual(
                Buffer.from(downloadedBytes),
            );
        } finally {
            await cleanup();
        }
    });

    it("omits the Redmine API key when downloading an external content URL", async () => {
        const externalAttachment: Attachment = {
            ...sampleAttachment,
            content_url: "https://cdn.example.test/files/report.txt",
        };
        const downloadedBytes = Uint8Array.from([7, 8, 9]);

        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        attachment: externalAttachment,
                    } satisfies AttachmentResponse),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                arrayBuffer: () => Promise.resolve(downloadedBytes.buffer),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "download-attachment",
                arguments: {
                    attachmentId: 42,
                },
            })) as ToolResult;

            expect(result.isError).toBeFalsy();
            const data = parseJsonResult<{
                saved_path: string;
            }>(result);
            generatedDownloadDirs.push(path.dirname(data.saved_path));
            const [downloadUrl, downloadOptions] = mockFetch.mock.calls[1] as [
                string,
                RequestInit,
            ];
            expect(downloadUrl).toBe(externalAttachment.content_url);
            expect(downloadOptions.headers).toEqual({
                Accept: "application/octet-stream",
            });
            await expect(readFile(data.saved_path)).resolves.toEqual(
                Buffer.from(downloadedBytes),
            );
        } finally {
            await cleanup();
        }
    });

    it("rejects cross-origin redirects while keeping attachment credentials scoped", async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        attachment: sampleAttachment,
                    } satisfies AttachmentResponse),
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 302,
                statusText: "Found",
                headers: {
                    get: (name: string) =>
                        name.toLowerCase() === "location"
                            ? "https://cdn.example.test/files/report.txt"
                            : null,
                },
                json: () => Promise.resolve({}),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "download-attachment",
                arguments: {
                    attachmentId: 42,
                },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain(
                "refused cross-origin redirect to https://cdn.example.test/files/report.txt",
            );
            expect(mockFetch).toHaveBeenCalledTimes(2);
            const [, downloadOptions] = mockFetch.mock.calls[1] as [
                string,
                RequestInit,
            ];
            expect(downloadOptions.redirect).toBe("manual");
            expect(
                (downloadOptions.headers as Record<string, string>)[
                    "X-Redmine-API-Key"
                ],
            ).toBe("test-api-key");
        } finally {
            await cleanup();
        }
    });

    it("rejects off-origin attachment downloads to link-local addresses", async () => {
        const unsafeAttachment: Attachment = {
            ...sampleAttachment,
            content_url: "http://169.254.169.254/latest/meta-data/",
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    attachment: unsafeAttachment,
                } satisfies AttachmentResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "download-attachment",
                arguments: {
                    attachmentId: 42,
                },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain(
                "refused unsafe attachment URL http://169.254.169.254/latest/meta-data/",
            );
            expect(mockFetch).toHaveBeenCalledTimes(1);
        } finally {
            await cleanup();
        }
    });

    it("rejects attachment downloads with unsupported URL protocols", async () => {
        const unsafeAttachment: Attachment = {
            ...sampleAttachment,
            content_url: "file:///etc/passwd",
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    attachment: unsafeAttachment,
                } satisfies AttachmentResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "download-attachment",
                arguments: {
                    attachmentId: 42,
                },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain(
                "unsupported attachment URL protocol file:",
            );
            expect(mockFetch).toHaveBeenCalledTimes(1);
        } finally {
            await cleanup();
        }
    });

    it("errors when attachment metadata has no content URL", async () => {
        const { content_url: _contentUrl, ...attachmentWithoutContentUrl } =
            sampleAttachment;

        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    attachment: attachmentWithoutContentUrl,
                } satisfies AttachmentResponse),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "download-attachment",
                arguments: {
                    attachmentId: 42,
                },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain(
                "Attachment 42 has no content_url",
            );
        } finally {
            await cleanup();
        }
    });

    it("surfaces download API errors", async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        attachment: sampleAttachment,
                    } satisfies AttachmentResponse),
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 403,
                statusText: "Forbidden",
                json: () => Promise.resolve({ errors: ["Denied"] }),
            });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "download-attachment",
                arguments: {
                    attachmentId: 42,
                },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain(
                "Failed to download attachment 42: 403 Forbidden - Denied",
            );
        } finally {
            await cleanup();
        }
    });

    it("updates an attachment description", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 204,
            json: () => Promise.resolve({}),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "update-attachment",
                arguments: {
                    attachmentId: 42,
                    description: "Updated attachment description",
                },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("https://test.redmine.com/attachments/42.json");
            expect(options.method).toBe("PATCH");
            expect(JSON.parse(options.body as string)).toEqual({
                attachment: { description: "Updated attachment description" },
            });

            expect(result.isError).toBeFalsy();
            expect(parseJsonResult(result)).toEqual({
                updated: true,
                attachmentId: 42,
            });
        } finally {
            await cleanup();
        }
    });

    it("deletes an attachment", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 204,
            json: () => Promise.resolve({}),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "delete-attachment",
                arguments: { attachmentId: 42 },
            })) as ToolResult;

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [url, options] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe("https://test.redmine.com/attachments/42.json");
            expect(options.method).toBe("DELETE");

            expect(result.isError).toBeFalsy();
            expect(parseJsonResult(result)).toEqual({
                deleted: true,
                attachmentId: 42,
            });
        } finally {
            await cleanup();
        }
    });

    it("surfaces delete attachment API errors", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 403,
            statusText: "Forbidden",
            json: () => Promise.resolve({ errors: ["Cannot delete file"] }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "delete-attachment",
                arguments: { attachmentId: 42 },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain(
                "Failed to delete attachment 42: 403 Forbidden - Cannot delete file",
            );
        } finally {
            await cleanup();
        }
    });

    it("surfaces mutation API errors", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 422,
            statusText: "Unprocessable Content",
            json: () =>
                Promise.resolve({ errors: ["Description is too long"] }),
        });

        const { client, cleanup } = await createTestClientServer();

        try {
            const result = (await client.callTool({
                name: "update-attachment",
                arguments: {
                    attachmentId: 42,
                    description: "Updated attachment description",
                },
            })) as ToolResult;

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain(
                "Failed to update attachment 42: 422 Unprocessable Content - Description is too long",
            );
        } finally {
            await cleanup();
        }
    });
});
