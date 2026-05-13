import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './src/**/*.{js,ts,jsx,tsx,mdx}'
    ],
    theme: {
        extend: {
            colors: {
                primary: '#0f172a',
                secondary: '#0ea5e9'
            },
            boxShadow: {
                soft: '0 24px 64px rgba(15, 23, 42, 0.12)'
            }
        }
    },
    plugins: []
};

export default config;
