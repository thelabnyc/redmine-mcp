import { mkdtemp, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";

import type { Config } from "../config.js";
import type { RedmineClient, RedmineIssueUpload } from "../redmine.js";
import { parseIssueId } from "./utils.js";

const attachmentIdSchema = z
    .number()
    .int()
    .positive()
    .describe("Attachment ID");

function isPathWithinRoot(rootPath: string, candidatePath: string): boolean {
    const relativePath = path.relative(rootPath, candidatePath);
    return (
        relativePath === "" ||
        (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
    );
}

async function resolveUploadFilePath(
    filePath: string,
    config: Config,
): Promise<string> {
    const [realRoot, realTempRoot] = await Promise.all([
        realpath(config.fileRoot),
        realpath(tmpdir()),
    ]);
    const realFilePath = await realpath(path.resolve(filePath));

    if (
        ![realRoot, realTempRoot].some((allowedRoot) =>
            isPathWithinRoot(allowedRoot, realFilePath),
        )
    ) {
        throw new Error(
            `Path is outside configured file root and OS temp directory: ${filePath}`,
        );
    }

    const fileStat = await stat(realFilePath);
    if (!fileStat.isFile()) {
        throw new Error(`Path is not a regular file: ${filePath}`);
    }
    if (fileStat.size > config.maxUploadBytes) {
        throw new Error(
            `File too large to upload: ${fileStat.size} bytes (limit ${config.maxUploadBytes} bytes).`,
        );
    }

    return realFilePath;
}

function sanitizeAttachmentFilename(
    filename: string,
    attachmentId: number,
): string {
    const basename = path.posix.basename(filename.replace(/\\/g, "/"));
    if (basename === "" || basename === "." || basename === "..") {
        return `attachment-${attachmentId}`;
    }

    return basename;
}

async function createDownloadDestinationPath(
    filename: string,
    attachmentId: number,
): Promise<string> {
    const downloadDir = await mkdtemp(
        path.join(tmpdir(), "redmine-mcp-attachment-"),
    );
    return path.join(
        downloadDir,
        sanitizeAttachmentFilename(filename, attachmentId),
    );
}

export function registerAttachmentTools(
    server: McpServer,
    redmineClient: RedmineClient,
    config: Config,
): void {
    server.registerTool(
        "get-attachment",
        {
            title: "Get Redmine Attachment",
            description:
                "Fetch metadata for a Redmine attachment by ID. Returns the attachment JSON from Redmine.",
            inputSchema: {
                attachmentId: attachmentIdSchema,
            },
        },
        async ({ attachmentId }) => {
            try {
                const attachment =
                    await redmineClient.getAttachment(attachmentId);

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(attachment, null, 2),
                        },
                    ],
                };
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                return {
                    isError: true,
                    content: [
                        {
                            type: "text" as const,
                            text: `Error fetching attachment: ${message}`,
                        },
                    ],
                };
            }
        },
    );

    server.registerTool(
        "attach-file-to-issue",
        {
            title: "Attach File to Redmine Issue",
            description:
                "Upload a local file to Redmine and attach it to an issue. IMPORTANT: Before calling this tool, you MUST present the user with a human-readable summary of the file path, target issue, filename, description, content type, notes, and private-notes setting, then get their explicit confirmation before proceeding.",
            inputSchema: {
                issueId: z
                    .union([z.string(), z.number()])
                    .describe("Issue ID (e.g., '#12345' or '12345')"),
                filePath: z.string().describe("Local path to the file to read"),
                filename: z
                    .string()
                    .optional()
                    .describe(
                        "Filename to store in Redmine. Defaults to basename of filePath.",
                    ),
                description: z
                    .string()
                    .optional()
                    .describe("Attachment description"),
                contentType: z
                    .string()
                    .optional()
                    .describe("Attachment content type"),
                notes: z
                    .string()
                    .optional()
                    .describe("Optional issue note to add with the upload"),
                privateNotes: z
                    .boolean()
                    .optional()
                    .describe("Make the issue note private"),
            },
        },
        async ({
            issueId,
            filePath,
            filename,
            description,
            contentType,
            notes,
            privateNotes,
        }) => {
            try {
                const parsed = parseIssueId(String(issueId));
                if (!parsed.success) {
                    return {
                        isError: true,
                        content: [
                            {
                                type: "text" as const,
                                text: parsed.error,
                            },
                        ],
                    };
                }

                const resolvedFilePath = await resolveUploadFilePath(
                    filePath,
                    config,
                );
                const resolvedFilename =
                    filename ?? path.basename(resolvedFilePath);
                const fileBytes = await readFile(resolvedFilePath);
                const uploadToken = await redmineClient.uploadAttachment(
                    resolvedFilename,
                    fileBytes,
                );

                const upload: RedmineIssueUpload = {
                    token: uploadToken.token,
                    filename: resolvedFilename,
                };
                if (contentType !== undefined) {
                    upload.content_type = contentType;
                }
                if (description !== undefined) {
                    upload.description = description;
                }

                const result = await redmineClient.attachUploadedFileToIssue(
                    parsed.numericId,
                    upload,
                    { notes, privateNotes },
                );

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                return {
                    isError: true,
                    content: [
                        {
                            type: "text" as const,
                            text: `Error attaching file: ${message}`,
                        },
                    ],
                };
            }
        },
    );

    server.registerTool(
        "download-attachment",
        {
            title: "Download Redmine Attachment",
            description:
                "Fetch Redmine attachment metadata, download its binary content_url, and save it to a generated OS temp directory using the Redmine filename.",
            inputSchema: {
                attachmentId: attachmentIdSchema,
            },
        },
        async ({ attachmentId }) => {
            try {
                const attachment =
                    await redmineClient.getAttachment(attachmentId);

                if (attachment.content_url === undefined) {
                    return {
                        isError: true,
                        content: [
                            {
                                type: "text" as const,
                                text: `Attachment ${attachmentId} has no content_url and cannot be downloaded.`,
                            },
                        ],
                    };
                }

                const arrayBuffer =
                    await redmineClient.downloadAttachmentContent(
                        attachmentId,
                        attachment.content_url,
                    );
                const destinationPath = await createDownloadDestinationPath(
                    attachment.filename,
                    attachmentId,
                );
                await writeFile(destinationPath, Buffer.from(arrayBuffer), {
                    flag: "wx",
                });

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(
                                {
                                    attachment,
                                    saved_path: destinationPath,
                                },
                                null,
                                2,
                            ),
                        },
                    ],
                };
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                return {
                    isError: true,
                    content: [
                        {
                            type: "text" as const,
                            text: `Error downloading attachment: ${message}`,
                        },
                    ],
                };
            }
        },
    );

    server.registerTool(
        "update-attachment",
        {
            title: "Update Redmine Attachment",
            description:
                "Update a Redmine attachment description. IMPORTANT: Before calling this tool, you MUST present the user with a human-readable summary of the attachment ID and new description, then get their explicit confirmation before proceeding.",
            inputSchema: {
                attachmentId: attachmentIdSchema,
                description: z.string().describe("New attachment description"),
            },
        },
        async ({ attachmentId, description }) => {
            try {
                await redmineClient.updateAttachment(attachmentId, description);

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(
                                { updated: true, attachmentId },
                                null,
                                2,
                            ),
                        },
                    ],
                };
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                return {
                    isError: true,
                    content: [
                        {
                            type: "text" as const,
                            text: `Error updating attachment: ${message}`,
                        },
                    ],
                };
            }
        },
    );

    server.registerTool(
        "delete-attachment",
        {
            title: "Delete Redmine Attachment",
            description:
                "Delete a Redmine attachment by ID. IMPORTANT: Before calling this tool, you MUST present the user with a human-readable summary of the attachment ID and that the attachment will be deleted, then get their explicit confirmation before proceeding.",
            inputSchema: {
                attachmentId: attachmentIdSchema,
            },
        },
        async ({ attachmentId }) => {
            try {
                await redmineClient.deleteAttachment(attachmentId);

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(
                                { deleted: true, attachmentId },
                                null,
                                2,
                            ),
                        },
                    ],
                };
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                return {
                    isError: true,
                    content: [
                        {
                            type: "text" as const,
                            text: `Error deleting attachment: ${message}`,
                        },
                    ],
                };
            }
        },
    );
}
