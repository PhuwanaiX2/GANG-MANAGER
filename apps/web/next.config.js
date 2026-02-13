/** @type {import('next').NextConfig} */
const nextConfig = {
    ...(process.env.NODE_ENV === 'production' ? { output: 'standalone' } : {}),
    transpilePackages: ['@gang/database'],
    reactStrictMode: true,
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
