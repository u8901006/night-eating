#!/usr/bin/env node
/**
 * Fetch latest Night Eating Syndrome research papers from PubMed E-utilities API.
 * Uses NES-specific keywords from the research toolkit.
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { parseArgs } from "node:util";

const PUBMED_SEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const PUBMED_FETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";

const HEADERS = { "User-Agent": "NightEatingResearchBot/1.0 (research aggregator)" };

const NES_SEARCH_TERMS = [
  '"night eating syndrome"[Title/Abstract]',
  '"night-eating syndrome"[Title/Abstract]',
  '"night eating"[Title/Abstract]',
  '"nocturnal eating"[Title/Abstract]',
  '"nocturnal ingestion"[Title/Abstract]',
  '"evening hyperphagia"[Title/Abstract]',
];

const DOMAIN_QUERIES = [
  "",
  'AND (insomnia[Title/Abstract] OR "sleep quality"[Title/Abstract] OR "sleep-related eating disorder"[Title/Abstract] OR parasomnia[Title/Abstract])',
  'AND ("circadian rhythm"[Title/Abstract] OR chronotype[Title/Abstract] OR chrononutrition[Title/Abstract] OR "meal timing"[Title/Abstract])',
  'AND (obesity[Title/Abstract] OR bariatric[Title/Abstract] OR "weight loss"[Title/Abstract] OR "weight regain"[Title/Abstract])',
  'AND (depression[Title/Abstract] OR anxiety[Title/Abstract] OR stress[Title/Abstract] OR "quality of life"[Title/Abstract])',
  'AND ("type 2 diabetes"[Title/Abstract] OR "metabolic syndrome"[Title/Abstract] OR "insulin resistance"[Title/Abstract] OR HbA1c[Title/Abstract])',
  'AND ("physical activity"[Title/Abstract] OR exercise[Title/Abstract] OR "sedentary behavior"[Title/Abstract])',
  'AND (treatment[Title/Abstract] OR CBT[Title/Abstract] OR "cognitive behavioral therapy"[Title/Abstract] OR sertraline[Title/Abstract] OR SSRI[Title/Abstract])',
  'AND ("Night Eating Questionnaire"[Title/Abstract] OR NEQ[Title/Abstract] OR assessment[Title/Abstract] OR screening[Title/Abstract] OR psychometric[Title/Abstract])',
  'AND ("binge eating"[Title/Abstract] OR "emotional eating"[Title/Abstract] OR "food addiction"[Title/Abstract] OR "loss of control eating"[Title/Abstract])',
];

function buildDateFilter(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const from = d.toISOString().slice(0, 10).replace(/-/g, "/");
  return `"${from}"[Date - Publication] : "3000"[Date - Publication]`;
}

function buildQueries(days) {
  const dateFilter = buildDateFilter(days);
  const nesBase = `(${NES_SEARCH_TERMS.join(" OR ")})`;
  return DOMAIN_QUERIES.map((domain) => {
    return `${nesBase} ${domain} AND ${dateFilter}`;
  });
}

async function searchPapers(query, retmax = 20) {
  const params = new URLSearchParams({
    db: "pubmed",
    term: query,
    retmax: String(retmax),
    sort: "date",
    retmode: "json",
  });
  try {
    const resp = await fetch(`${PUBMED_SEARCH}?${params}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) throw new Error(`PubMed search HTTP ${resp.status}`);
    const data = await resp.json();
    return data?.esearchresult?.idlist ?? [];
  } catch (err) {
    console.error(`[ERROR] PubMed search failed: ${err.message}`);
    return [];
  }
}

async function fetchDetails(pmids) {
  if (!pmids.length) return [];
  const params = new URLSearchParams({
    db: "pubmed",
    id: pmids.join(","),
    retmode: "xml",
  });
  try {
    const resp = await fetch(`${PUBMED_FETCH}?${params}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(60000),
    });
    if (!resp.ok) throw new Error(`PubMed fetch HTTP ${resp.status}`);
    const xml = await resp.text();
    return parseXmlPapers(xml);
  } catch (err) {
    console.error(`[ERROR] PubMed fetch failed: ${err.message}`);
    return [];
  }
}

function parseXmlPapers(xml) {
  const papers = [];
  const articleRegex = /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g;
  let match;
  while ((match = articleRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, "ArticleTitle");
    const abstract = extractAbstract(block);
    const journal = extractTag(block, "<Title>", "</Title>");
    const pmid = extractTag(block, "<PMID", "PMID>");
    const pmidClean = pmid.replace(/^[^>]*>/, "");
    const date = extractPubDate(block);
    const keywords = extractKeywords(block);
    const url = pmidClean ? `https://pubmed.ncbi.nlm.nih.gov/${pmidClean}/` : "";

    if (title) {
      papers.push({
        pmid: pmidClean,
        title,
        journal,
        date,
        abstract,
        url,
        keywords,
      });
    }
  }
  return papers;
}

function extractTag(block, openTag, closeTag) {
  if (!closeTag) {
    closeTag = openTag.replace("<", "</");
  }
  const openIdx = block.indexOf(openTag);
  if (openIdx === -1) return "";
  const start = block.indexOf(">", openIdx) + 1;
  const end = block.indexOf(closeTag, start);
  if (end === -1) return "";
  return block.slice(start, end).replace(/<[^>]+>/g, "").trim();
}

function extractAbstract(block) {
  const parts = [];
  const absRegex = /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g;
  let m;
  while ((m = absRegex.exec(block)) !== null) {
    const labelMatch = m[0].match(/Label="([^"]*)"/);
    const label = labelMatch ? labelMatch[1] : "";
    const text = m[1].replace(/<[^>]+>/g, "").trim();
    if (text) {
      parts.push(label ? `${label}: ${text}` : text);
    }
  }
  return parts.join(" ").slice(0, 2000);
}

function extractPubDate(block) {
  const year = extractTag(block, "<Year>", "</Year>");
  const month = extractTag(block, "<Month>", "</Month>");
  const day = extractTag(block, "<Day>", "</Day>");
  return [year, month, day].filter(Boolean).join(" ");
}

function extractKeywords(block) {
  const kws = [];
  const kwRegex = /<Keyword>([\s\S]*?)<\/Keyword>/g;
  let m;
  while ((m = kwRegex.exec(block)) !== null) {
    const t = m[1].trim();
    if (t) kws.push(t);
  }
  return kws;
}

function loadSummarizedPmids() {
  const path = "docs/.summarized.json";
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return {};
  }
}

function cleanOldPmids(tracked, days = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const cleaned = {};
  for (const [pmid, date] of Object.entries(tracked)) {
    if (date >= cutoffStr) {
      cleaned[pmid] = date;
    }
  }
  return cleaned;
}

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      days: { type: "string", default: "7" },
      "max-papers": { type: "string", default: "50" },
      output: { type: "string", default: "-" },
    },
    strict: true,
  });
  return {
    days: parseInt(values.days, 10),
    maxPapers: parseInt(values["max-papers"], 10),
    output: values.output,
  };
}

async function main() {
  const args = parseCliArgs();
  const tracked = cleanOldPmids(loadSummarizedPmids());
  const alreadySummarized = new Set(Object.keys(tracked));

  console.error(`[INFO] Searching PubMed for NES papers (last ${args.days} days)...`);
  console.error(`[INFO] Already summarized: ${alreadySummarized.size} PMIDs`);

  const queries = buildQueries(args.days);
  const allPmids = new Set();

  for (const query of queries) {
    const pmids = await searchPapers(query, 15);
    pmids.forEach((id) => allPmids.add(id));
  }

  let newPmids = [...allPmids].filter((id) => !alreadySummarized.has(id));
  console.error(`[INFO] Total unique: ${allPmids.size}, New: ${newPmids.length}`);

  if (newPmids.length > args.maxPapers) {
    newPmids = newPmids.slice(0, args.maxPapers);
  }

  if (!newPmids.length) {
    console.error("[INFO] No new papers found");
    const output = {
      date: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }),
      count: 0,
      papers: [],
    };
    const json = JSON.stringify(output, null, 2);
    if (args.output === "-") console.log(json);
    else writeFileSync(args.output, json, "utf-8");
    return;
  }

  const papers = await fetchDetails(newPmids);
  console.error(`[INFO] Fetched details for ${papers.length} papers`);

  const output = {
    date: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }),
    count: papers.length,
    papers,
  };

  const json = JSON.stringify(output, null, 2);
  if (args.output === "-") console.log(json);
  else writeFileSync(args.output, json, "utf-8");
  console.error(`[INFO] Saved to ${args.output}`);
}

main().catch((err) => {
  console.error(`[FATAL] ${err.message}`);
  process.exit(1);
});
