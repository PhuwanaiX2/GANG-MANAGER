/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    transpilePackages: ['@gang/database'],
    reactStrictMode: true,
    images: {
        domains: ['cdn.discordapp.com'],
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
        serverComponentsExternalPackages: ['discord.js'],
    },
};

module.exports = nextConfig;
