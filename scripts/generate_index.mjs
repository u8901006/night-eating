#!/usr/bin/env node
/**
 * Generate index.html listing all NES daily reports.
 */

import { readdirSync, writeFileSync } from "node:fs";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function main() {
  let files;
  try {
    files = readdirSync("docs")
      .filter((f) => f.startsWith("nes-") && f.endsWith(".html"))
      .sort()
      .reverse();
  } catch {
    files = [];
  }

  let links = "";
  for (const name of files.slice(0, 30)) {
    const dateStr = name.replace("nes-", "").replace(".html", "");
    const parts = dateStr.split("-");
    if (parts.length !== 3) continue;
    const d = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
    if (isNaN(d.getTime())) continue;
    const display = `${parts[0]}年${parseInt(parts[1])}月${parseInt(parts[2])}日`;
    const wd = WEEKDAYS[d.getDay()];
    links += `<li><a href="${name}">&#x1F4C5; ${display}（週${wd}）</a></li>\n`;
  }

  const total = files.length;

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Night Eating Research &middot; 夜食症研究文獻日報</title>
<style>
  :root { --bg: #f6f1e8; --surface: #fffaf2; --line: #d8c5ab; --text: #2b2118; --muted: #766453; --accent: #8c4f2b; --accent-soft: #ead2bf; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: radial-gradient(circle at top, #fff6ea 0, var(--bg) 55%, #ead8c6 100%); color: var(--text); font-family: "Noto Sans TC", "PingFang TC", "Helvetica Neue", Arial, sans-serif; min-height: 100vh; }
  .container { position: relative; z-index: 1; max-width: 640px; margin: 0 auto; padding: 80px 24px; }
  .logo { font-size: 48px; text-align: center; margin-bottom: 16px; }
  h1 { text-align: center; font-size: 24px; color: var(--text); margin-bottom: 8px; }
  .subtitle { text-align: center; color: var(--accent); font-size: 14px; margin-bottom: 48px; }
  .count { text-align: center; color: var(--muted); font-size: 13px; margin-bottom: 32px; }
  ul { list-style: none; }
  li { margin-bottom: 8px; }
  a { color: var(--text); text-decoration: none; display: block; padding: 14px 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; transition: all 0.2s; font-size: 15px; }
  a:hover { background: var(--accent-soft); border-color: var(--accent); transform: translateX(4px); }
  .links-section { margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--line); }
  .link-row { display: flex; align-items: center; gap: 10px; padding: 12px 0; }
  .link-row a { display: flex; align-items: center; gap: 10px; padding: 12px 20px; }
  footer { margin-top: 56px; text-align: center; font-size: 12px; color: var(--muted); }
  footer a { display: inline; padding: 0; background: none; border: none; color: var(--muted); }
  footer a:hover { color: var(--accent); }
</style>
</head>
<body>
<div class="container">
  <div class="logo">&#x1F319;</div>
  <h1>Night Eating Research</h1>
  <p class="subtitle">夜食症研究文獻日報 &middot; 每日自動更新</p>
  <p class="count">共 ${total} 期日報</p>
  <ul>${links}</ul>
  <div class="links-section">
    <div class="link-row"><a href="https://www.leepsyclinic.com/" target="_blank">&#x1F3E5; 李政洋身心診所首頁</a></div>
    <div class="link-row"><a href="https://blog.leepsyclinic.com/" target="_blank">&#x1F4EC; 訂閱電子報</a></div>
    <div class="link-row"><a href="https://buymeacoffee.com/CYlee" target="_blank">&#x2615; Buy Me a Coffee</a></div>
  </div>
  <footer>
    <p>Powered by PubMed + Zhipu AI &middot; <a href="https://github.com/u8901006/night-eating">GitHub</a></p>
  </footer>
</div>
</body>
</html>`;

  writeFileSync("docs/index.html", html, "utf-8");
  console.log("Index page generated");
}

main();
