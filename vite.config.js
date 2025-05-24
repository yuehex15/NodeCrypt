import {
	defineConfig
} from 'vite';
export default defineConfig({
	root: 'web',
	base: './',
	plugins: [],
	build: {
		outDir: '../dist',
		emptyOutDir: true,
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: false,
				drop_debugger: false
			}
		},
		rollupOptions: {
			input: 'web/index.html',
			output: {
				manualChunks: (id) => {
					if (id.includes('node_modules')) {
						if (/aes-js|elliptic|js-chacha20|js-sha256/.test(id)) {
							return 'crypto-libs'
						}
						if (id.includes('buffer')) {
							return 'vendor'
						}
						if (id.includes('emoji-picker-element')) {
							return 'emoji-libs'
						}
						if (id.includes('@dicebear')) {
							return 'avatar-libs'
						}
						return 'vendor-deps'
					}
					return undefined
				},
			},
		},
		sourcemap: false,
		cssCodeSplit: true,
		chunkSizeWarningLimit: 1000,
	},
	resolve: {
		alias: {
			buffer: 'buffer',
		},
	},
	server: {
		hmr: true,
		open: true,
	},
	optimizeDeps: {
		include: ['buffer', 'aes-js', 'elliptic', 'js-chacha20', 'js-sha256', '@dicebear/core', '@dicebear/micah'],
	},
});