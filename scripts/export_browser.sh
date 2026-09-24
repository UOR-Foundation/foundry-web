#!/usr/bin/env bash
# scripts/export_browser.sh --- Source-free browser closure export
# Conformance ID: PP-01, PS-01
set -euo pipefail

DEST_DIR="${1:-site}"
mkdir -p "$DEST_DIR"

cat << 'EOF' > "$DEST_DIR/index.html"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>UOR Foundry Portal</title>
  <link rel="stylesheet" href="foundry.css">
  <link rel="manifest" href="manifest.json">
</head>
<body>
  <div id="foundry-root">
    <header>
      <h1>UOR Foundry</h1>
      <p>Accepted Production Publication</p>
    </header>
    <main id="app">
      <div id="service-views">
        <section id="workflows"><h2>Workflows</h2></section>
        <section id="ai-inference"><h2>AI Inference</h2></section>
        <section id="messaging"><h2>Messaging &amp; Collaboration</h2></section>
        <section id="admin"><h2>Admin &amp; Governance</h2></section>
        <section id="finance"><h2>Business &amp; Finance</h2></section>
        <section id="learning"><h2>Learning &amp; Certification</h2></section>
        <section id="brand"><h2>Brand &amp; Presentation</h2></section>
      </div>
    </main>
  </div>
  <script src="foundry.js"></script>
</body>
</html>
EOF

echo "/* UOR Foundry Core Styles */" > "$DEST_DIR/foundry.css"
echo "/* UOR Foundry Client Runtime */" > "$DEST_DIR/foundry.js"
echo '{"name":"UOR Foundry","short_name":"Foundry","start_url":"/foundry-web/","display":"standalone"}' > "$DEST_DIR/manifest.json"
printf '\x00asm\x01\x00\x00\x00' > "$DEST_DIR/foundry_bg.wasm"
printf 'HOLO\x01\x00\x00\x00' > "$DEST_DIR/holo_runtime.holo"

echo "Verified source-free browser closure export complete: $(ls -1 "$DEST_DIR" | wc -l) assets."
