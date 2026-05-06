/** @type {import('next').NextConfig} */
const nextConfig = {
    ...(process.env.NODE_ENV === 'production' ? { output: 'standalone' } : {}),
    transpilePackages: ['@gang/database'],
    reactStrictMode: true,
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'X-XSS-Protection', value: '1; mode=block' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
                    { key: 'X-DNS-Prefetch-Control', value: 'off' },
                    { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
                    {
                        key: 'Content-Security-Policy-Report-Only',
                        value: [
                            "default-src 'self'",
                            "base-uri 'self'",
                            "frame-ancestors 'none'",
                            "object-src 'none'",
                            "form-action 'self'",
                            "img-src 'self' data: blob: https://cdn.discordapp.com https://media.discordapp.net https://images-ext-1.discordapp.net https://images-ext-2.discordapp.net https://res.cloudinary.com",
                            "script-src 'self' 'unsafe-inline'",
                            "style-src 'self' 'unsafe-inline'",
                            "connect-src 'self' https://discord.com https://api.slipok.com https://*.turso.io",
                            'upgrade-insecure-requests',
                        ].join('; '),
                    },
                ],
            },
        ];
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'cdn.discordapp.com',
            },
        ],
    },
    webpack: (config) => {
        config.externals.push({
            'utf-8-validate': 'commonjs utf-8-validate',
            'bufferutil': 'commonjs bufferutil',
            'zlib-sync': 'commonjs zlib-sync',
        });
        return config;
    },
    serverExternalPackages: ['discord.js', '@libsql/client', 'libsql'],
};

module.exports = nextConfig;
