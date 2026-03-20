import { URL } from 'url';

/**
 * SSRF Protection Utility
 *
 * Prevents Server-Side Request Forgery attacks by validating URLs
 * before the server fetches them.
 */

/**
 * Private IP ranges that should be blocked
 */
const PRIVATE_IP_RANGES = [
    // IPv4 Private Ranges
    { start: '10.0.0.0', end: '10.255.255.255', name: 'Private Class A' },
    { start: '172.16.0.0', end: '172.31.255.255', name: 'Private Class B' },
    { start: '192.168.0.0', end: '192.168.255.255', name: 'Private Class C' },
    { start: '127.0.0.0', end: '127.255.255.255', name: 'Loopback' },
    { start: '169.254.0.0', end: '169.254.255.255', name: 'Link-local' },
    { start: '0.0.0.0', end: '0.255.255.255', name: 'Current network' },
    // Special addresses
    { start: '224.0.0.0', end: '239.255.255.255', name: 'Multicast' },
    { start: '240.0.0.0', end: '255.255.255.255', name: 'Reserved' },
];

/**
 * Hostnames that should be blocked (cloud metadata endpoints, etc.)
 */
const BLOCKED_HOSTNAMES = [
    'localhost',
    'metadata.google.internal',        // GCP metadata
    '169.254.169.254',                 // AWS/Azure/GCP metadata
    'instance-data',                   // AWS
    'metadata',                        // Generic
];

/**
 * Allowed URL schemes
 */
const ALLOWED_SCHEMES = ['http:', 'https:'];

/**
 * Trusted domains for storage/CDN (optional allowlist)
 * These domains are allowed when requireTrustedDomain option is enabled
 */
const TRUSTED_DOMAINS = [
    'r2.dev',                    // Cloudflare R2 public buckets
    'r2.cloudflarestorage.com',  // Cloudflare R2 storage
    'googleapis.com',            // Google Cloud Storage
    'googleusercontent.com',     // Google User Content
    'cloudflare.com',            // Cloudflare CDN
    'cloudfront.net',            // AWS CloudFront
    // Add your custom R2 domain here if using one (e.g. 'assets.yourdomain.com')
];

/**
 * Converts an IP address string to a 32-bit integer
 */
function ipToInt(ip: string): number {
    const parts = ip.split('.');
    if (parts.length !== 4) return 0;

    return parts.reduce((acc, part) => {
        return (acc << 8) + parseInt(part, 10);
    }, 0) >>> 0; // Unsigned 32-bit integer
}

/**
 * Checks if an IP address is within a range
 */
function isIpInRange(ip: string, start: string, end: string): boolean {
    const ipInt = ipToInt(ip);
    const startInt = ipToInt(start);
    const endInt = ipToInt(end);

    return ipInt >= startInt && ipInt <= endInt;
}

/**
 * Checks if an IP address is private or reserved
 */
function isPrivateOrReservedIp(ip: string): boolean {
    // Check against all private ranges
    for (const range of PRIVATE_IP_RANGES) {
        if (isIpInRange(ip, range.start, range.end)) {
            return true;
        }
    }

    // Check IPv6 loopback
    if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') {
        return true;
    }

    // Check IPv6 link-local (fe80::/10)
    if (ip.toLowerCase().startsWith('fe80:')) {
        return true;
    }

    // Check IPv6 unique local (fc00::/7)
    if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) {
        return true;
    }

    return false;
}

/**
 * Validates a hostname against blocked list
 */
function isBlockedHostname(hostname: string): boolean {
    const lowerHostname = hostname.toLowerCase();

    // Check exact matches
    if (BLOCKED_HOSTNAMES.includes(lowerHostname)) {
        return true;
    }

    // Check if it's an IP address
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    if (isIp && isPrivateOrReservedIp(hostname)) {
        return true;
    }

    return false;
}

/**
 * Validates if a URL is from a trusted domain
 */
function isTrustedDomain(hostname: string): boolean {
    const lowerHostname = hostname.toLowerCase();

    for (const domain of TRUSTED_DOMAINS) {
        if (lowerHostname === domain || lowerHostname.endsWith('.' + domain)) {
            return true;
        }
    }

    return false;
}

/**
 * Validation result
 */
export interface UrlValidationResult {
    valid: boolean;
    error?: string;
    url?: URL;
}

/**
 * Validates a URL for SSRF protection
 *
 * @param urlString - The URL to validate
 * @param options - Validation options
 * @returns Validation result
 */
export function validateUrl(
    urlString: string,
    options: {
        requireTrustedDomain?: boolean;  // If true, only allow trusted domains
        allowPrivateIps?: boolean;       // If true, allow private IPs (NOT RECOMMENDED)
    } = {}
): UrlValidationResult {
    try {
        // Parse URL
        const url = new URL(urlString);

        // Check scheme
        if (!ALLOWED_SCHEMES.includes(url.protocol)) {
            return {
                valid: false,
                error: `Invalid URL scheme: ${url.protocol}. Only HTTP/HTTPS allowed.`,
            };
        }

        // Check for empty hostname
        if (!url.hostname) {
            return {
                valid: false,
                error: 'URL must have a valid hostname',
            };
        }

        // Check if hostname is blocked
        if (isBlockedHostname(url.hostname)) {
            return {
                valid: false,
                error: `Blocked hostname: ${url.hostname}`,
            };
        }

        // Check if hostname is a private IP (unless explicitly allowed)
        if (!options.allowPrivateIps) {
            const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(url.hostname) ||
                         url.hostname.includes(':'); // Basic IPv6 check

            if (isIp && isPrivateOrReservedIp(url.hostname)) {
                return {
                    valid: false,
                    error: 'Private or reserved IP addresses are not allowed',
                };
            }
        }

        // Check if trusted domain is required
        if (options.requireTrustedDomain && !isTrustedDomain(url.hostname)) {
            return {
                valid: false,
                error: `URL must be from a trusted domain. Got: ${url.hostname}`,
            };
        }

        // Check for authentication in URL (username:password@host)
        if (url.username || url.password) {
            return {
                valid: false,
                error: 'URLs with authentication are not allowed',
            };
        }

        return {
            valid: true,
            url,
        };
    } catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : 'Invalid URL format',
        };
    }
}

/**
 * Safe fetch wrapper that validates URLs before fetching
 *
 * @param url - URL to fetch
 * @param options - Fetch options + validation options
 * @returns Fetch response
 * @throws Error if URL validation fails
 */
export async function safeFetch(
    url: string,
    options: RequestInit & {
        requireTrustedDomain?: boolean;
        allowPrivateIps?: boolean;
    } = {}
): Promise<Response> {
    // Extract validation options
    const { requireTrustedDomain, allowPrivateIps, ...fetchOptions } = options;

    // Validate URL
    const validation = validateUrl(url, {
        requireTrustedDomain,
        allowPrivateIps,
    });

    if (!validation.valid) {
        throw new Error(`SSRF Protection: ${validation.error}`);
    }

    // Add timeout if not specified (30 seconds default)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: fetchOptions.signal || controller.signal,
        });

        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * Validates and sanitizes a URL from user input or database
 *
 * Use this before fetching any URL that comes from:
 * - User input
 * - Database records
 * - External APIs
 *
 * @param url - URL to validate
 * @param requireTrusted - If true, only allow trusted domains
 * @returns Validated URL or null if invalid
 */
export function sanitizeUrl(url: string, requireTrusted: boolean = false): string | null {
    const validation = validateUrl(url, { requireTrustedDomain: requireTrusted });

    if (!validation.valid) {
        console.warn(`[SSRF Protection] Blocked URL: ${url} - Reason: ${validation.error}`);
        return null;
    }

    return validation.url!.toString();
}

/**
 * Checks if a URL is safe without throwing errors
 *
 * @param url - URL to check
 * @returns True if URL is safe
 */
export function isUrlSafe(url: string): boolean {
    const validation = validateUrl(url);
    return validation.valid;
}
