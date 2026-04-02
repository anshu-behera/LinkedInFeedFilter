const manifest = {
  manifest_version: 3,
  name: "LinkedIn Feed Filter",
  description: "Filters LinkedIn feed posts with semantic embeddings using all-MiniLM-L6-v2.",
  version: "1.0.0",
  action: {
    default_popup: "src/popup.html",
    default_title: "LinkedIn Feed Filter"
  },
  permissions: ["storage"],
  host_permissions: [
    "https://www.linkedin.com/*"
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
    "128": "icon.png"
  },
  web_accessible_resources: [
    {
      resources: ["icon.png"],
      matches: ["https://www.linkedin.com/*"]
    }
  ]
};

export default manifest;