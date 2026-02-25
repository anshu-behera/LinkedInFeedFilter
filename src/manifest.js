const manifest = {
  manifest_version: 3,
  name: "LinkedIn Feed Filter",
  description: "Filters LinkedIn feed posts with semantic embeddings using all-MiniLM-L6-v2.",
  version: "1.0.0",
  permissions: ["storage"],
  host_permissions: [
    "https://www.linkedin.com/*",
    "https://huggingface.co/*",
    "https://cdn-lfs.huggingface.co/*"
  ],
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
  },
  background: {
    service_worker: "src/background.js",
    type: "module"
  },
  content_scripts: [
    {
      matches: ["https://www.linkedin.com/*"],
      js: ["src/content.js"],
      run_at: "document_idle"
    }
  ],
  icons: {
    "128": "hello_extensions.png"
  },
  web_accessible_resources: [
    {
      resources: ["hello_extensions.png"],
      matches: ["https://www.linkedin.com/*"]
    }
  ]
};

export default manifest;