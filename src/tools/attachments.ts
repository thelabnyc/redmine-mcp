import {
    lstat,
    mkdir,
    readFile,
    realpath,
    stat,
    writeFile,
} from "node:fs/promises";
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

function resolvePathWithinRoot(filePath: string, config: Config): string {
    const resolvedRoot = path.resolve(config.fileRoot);
    const resolvedPath = path.resolve(filePath);

    if (!isPathWithinRoot(resolvedRoot, resolvedPath)) {
        throw new Error(`Path is outside configured file root: ${filePath}`);
    }

    return resolvedPath;
}

async function resolveUploadFilePath(
    filePath: string,
    config: Config,
): Promise<string> {
    const realRoot = await realpath(config.fileRoot);
    const realFilePath = await realpath(path.resolve(filePath));

    if (!isPathWithinRoot(realRoot, realFilePath)) {
        throw new Error(`Path is outside configured file root: ${filePath}`);
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

async function rejectSymlinkDestination(
    safeDestinationPath: string,
    destinationPath: string,
): Promise<void> {
    try {
        const destinationStat = await lstat(safeDestinationPath);
        if (destinationStat.isSymbolicLink()) {
            throw new Error(
                `Destination is a symbolic link: ${destinationPath}`,
            );
        }
    } catch (error) {
        if (
            error instanceof Error &&
            "code" in error &&
            (error as NodeJS.ErrnoException).code === "ENOENT"
        ) {
            return;
        }
        throw error;
    }
}

async function prepareDownloadDestinationPath(
    resolvedDestinationPath: string,
    destinationPath: string,
    config: Config,
    overwrite: boolean,
): Promise<string> {
    const destinationDir = path.dirname(resolvedDestinationPath);
    await mkdir(destinationDir, {
        recursive: true,
    });

    const realRoot = await realpath(config.fileRoot);
    const realDestinationDir = await realpath(destinationDir);
    if (!isPathWithinRoot(realRoot, realDestinationDir)) {
        throw new Error(
            `Path is outside configured file root: ${destinationPath}`,
        );
    }

    const safeDestinationPath = path.join(
        realDestinationDir,
        path.basename(resolvedDestinationPath),
    );
    if (overwrite) {
        await rejectSymlinkDestination(safeDestinationPath, destinationPath);
    }

    return safeDestinationPath;
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
                "Fetch Redmine attachment metadata, download its binary content_url, and save it to a local destination path. Creates parent directories as needed and refuses to overwrite existing files unless overwrite is true.",
            inputSchema: {
                attachmentId: attachmentIdSchema,
                destinationPath: z
                    .string()
                    .describe("Local destination path for the downloaded file"),
                overwrite: z
                    .boolean()
                    .optional()
                    .default(false)
                    .describe("Replace destinationPath if it already exists"),
            },
        },
        async ({ attachmentId, destinationPath, overwrite }) => {
            try {
                const resolvedDestinationPath = resolvePathWithinRoot(
                    destinationPath,
                    config,
                );
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
                const safeDestinationPath =
                    await prepareDownloadDestinationPath(
                        resolvedDestinationPath,
                        destinationPath,
                        config,
                        overwrite,
                    );
                try {
                    await writeFile(
                        safeDestinationPath,
                        Buffer.from(arrayBuffer),
                        { flag: overwrite ? "w" : "wx" },
                    );
                } catch (error) {
                    if (
                        error instanceof Error &&
                        "code" in error &&
                        (error as NodeJS.ErrnoException).code === "EEXIST"
                    ) {
                        return {
                            isError: true,
                            content: [
                                {
                                    type: "text" as const,
                                    text: `Destination already exists: ${destinationPath}. Pass overwrite: true to replace it.`,
                                },
                            ],
                        };
                    }
                    throw error;
                }

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
