/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            { name: 'firebase-firestore', test: /node_modules\/@firebase\/firestore\// },
            { name: 'firestore-regex', test: /node_modules\/re2js\// },
            { name: 'firebase-transport', test: /node_modules\/@firebase\/webchannel-wrapper\// },
            { name: 'firebase-auth', test: /node_modules\/@firebase\/auth\// },
            { name: 'firebase-core', test: /node_modules\/(?:@firebase\/(?:app|util|logger|component)|idb|tslib)\// },
          ],
        },
      },
    },
  },
  test: { environment: 'jsdom', globals: true },
})
