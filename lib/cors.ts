export const getCorsHeaders = (origin: string | null) => {
    // Normalize origin: remove trailing slash if present
    let allowedOrigin = origin || "*";

    if (allowedOrigin && allowedOrigin.endsWith('/')) {
        allowedOrigin = allowedOrigin.slice(0, -1);
    }

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true'
    };
};
