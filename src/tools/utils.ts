/**
 * Parse an issue ID string, handling optional # prefix
 * @param issueId - Issue ID string (e.g., "#12345" or "12345")
 * @returns Object with either numericId or error
 */
export function parseIssueId(
    issueId: string,
): { success: true; numericId: number } | { success: false; error: string } {
    const cleanId = issueId.replace(/^#/, "");
    const numericId = parseInt(cleanId, 10);

    if (isNaN(numericId)) {
        return { success: false, error: `Invalid issue ID: ${issueId}` };
    }

    return { success: true, numericId };
}
