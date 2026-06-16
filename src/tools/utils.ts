type ParseNumericIdResult =
    | { success: true; numericId: number }
    | { success: false; error: string };

export function parseNumericId(
    value: string | number,
    label: string,
    options: { allowHashPrefix?: boolean } = {},
): ParseNumericIdResult {
    const rawValue =
        typeof value === "number"
            ? value
            : options.allowHashPrefix === true
              ? value.replace(/^#/, "")
              : value;
    const stringPattern =
        options.allowHashPrefix === true ? /^#?[1-9]\d*$/ : /^[1-9]\d*$/;

    if (typeof value === "string" && !stringPattern.test(value)) {
        return { success: false, error: `Invalid ${label}: ${value}` };
    }

    const numericId = Number(rawValue);
    if (!Number.isSafeInteger(numericId) || numericId <= 0) {
        return { success: false, error: `Invalid ${label}: ${value}` };
    }

    return { success: true, numericId };
}

/**
 * Parse an issue ID, handling optional # prefix.
 * @param issueId - Issue ID (e.g., "#12345", "12345", or 12345)
 * @returns Object with either numericId or error
 */
export function parseIssueId(issueId: string | number): ParseNumericIdResult {
    return parseNumericId(issueId, "issue ID", { allowHashPrefix: true });
}
