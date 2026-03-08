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
    experimental: {
        serverComponentsExternalPackages: ['discord.js', '@libsql/client', 'libsql'],
    },
};

module.exports = nextConfig;
