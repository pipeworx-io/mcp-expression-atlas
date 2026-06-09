interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * EBI Expression Atlas MCP.
 *
 * Curated gene/protein expression data from the EMBL-EBI Expression Atlas
 * (https://www.ebi.ac.uk/gxa). Search ~4,500 baseline & differential
 * expression experiments by keyword / species / type, and fetch an
 * experiment's metadata. Keyless. Complements UniProt / Ensembl.
 */


const BASE = 'https://www.ebi.ac.uk/gxa';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

interface AtlasExperiment {
  experimentAccession?: string;
  experimentDescription?: string;
  species?: string;
  experimentType?: string;
  numberOfAssays?: number;
  lastUpdate?: string;
  experimentalFactors?: string[];
}

const tools: McpToolExport['tools'] = [
  {
    name: 'search_experiments',
    description:
      'Search EBI Expression Atlas — ~4,500 curated gene/protein expression experiments (baseline & differential) across species, tissues, and conditions. Filter by keyword (matches description/experimental factors), species (e.g. "Homo sapiens", "Mus musculus"), and/or type ("Baseline" or "Differential"). Returns accession, description, species, type, assay count, and factors. Keyless. Complements UniProt/Ensembl.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword matched (case-insensitive) against experiment description OR any experimental factor, e.g. "liver", "stress", "cancer".' },
        species: { type: 'string', description: 'Species substring (case-insensitive), e.g. "Homo sapiens", "Mus musculus", "Arabidopsis thaliana".' },
        type: { type: 'string', description: 'Experiment type: "Baseline" or "Differential".' },
        limit: { type: 'number', description: 'Max results (default 25, max 100).' },
      },
    },
  },
  {
    name: 'get_experiment',
    description:
      'Get metadata for a single EBI Expression Atlas experiment by accession (e.g. "E-MTAB-4045"). Returns accession, description, species, type, assay count, and experimental factors.',
    inputSchema: {
      type: 'object',
      properties: {
        accession: { type: 'string', description: 'Experiment accession, e.g. "E-MTAB-4045", "E-GEOD-61857".' },
      },
      required: ['accession'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'search_experiments':
        return await searchExperiments(args);
      case 'get_experiment':
        return await getExperiment(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function searchExperiments(args: Record<string, unknown>): Promise<unknown> {
  const query = optStr(args.query);
  const species = optStr(args.species);
  const type = optStr(args.type);
  const limit = clampLimit(args.limit);

  const data = (await atlasGet('/json/experiments')) as { experiments?: AtlasExperiment[] };
  const all = Array.isArray(data?.experiments) ? data.experiments : [];
  const total = all.length;

  const hasFilter = !!(query || species || type);
  if (!hasFilter) {
    const slice = all.slice(0, limit).map(mapExperiment);
    return {
      count: slice.length,
      total,
      note: `showing first ${limit} of ${total}; pass query/species/type to filter`,
      experiments: slice,
    };
  }

  const q = query?.toLowerCase();
  const sp = species?.toLowerCase();
  const ty = type?.toLowerCase();

  const filtered = all.filter((exp) => {
    if (q) {
      const desc = (exp.experimentDescription ?? '').toLowerCase();
      const factors = exp.experimentalFactors ?? [];
      const inDesc = desc.includes(q);
      const inFactors = factors.some((f) => (f ?? '').toLowerCase().includes(q));
      if (!inDesc && !inFactors) return false;
    }
    if (sp && !(exp.species ?? '').toLowerCase().includes(sp)) return false;
    if (ty && (exp.experimentType ?? '').toLowerCase() !== ty) return false;
    return true;
  });

  const capped = filtered.slice(0, limit).map(mapExperiment);
  return { count: capped.length, total, experiments: capped };
}

async function getExperiment(args: Record<string, unknown>): Promise<unknown> {
  const accession = optStr(args.accession);
  if (!accession) return { error: 'Required argument "accession" is missing. Pass a string like "E-MTAB-4045".' };

  let data: any;
  try {
    data = await atlasGet(`/json/experiments/${encodeURIComponent(accession)}`);
  } catch {
    return { error: 'experiment not found', accession };
  }
  if (!data || typeof data !== 'object') return { error: 'experiment not found', accession };

  const exp = (data.experiment ?? {}) as { accession?: string; description?: string; species?: string; type?: string };
  const columnHeaders = Array.isArray(data.columnHeaders) ? data.columnHeaders : [];

  const factorSet = new Set<string>();
  for (const ch of columnHeaders) {
    const props = ch?.assayGroupSummary?.properties;
    if (Array.isArray(props)) {
      for (const p of props) {
        if (p?.contrastPropertyType === 'FACTOR' && typeof p?.propertyName === 'string') factorSet.add(p.propertyName);
      }
    }
  }

  return {
    accession: exp.accession ?? accession,
    description: exp.description ?? null,
    species: exp.species ?? null,
    type: exp.type ?? null,
    assays: columnHeaders.length,
    factors: [...factorSet],
  };
}

function mapExperiment(exp: AtlasExperiment): Record<string, unknown> {
  return {
    accession: exp.experimentAccession ?? null,
    description: exp.experimentDescription ?? null,
    species: exp.species ?? null,
    type: exp.experimentType ?? null,
    assays: exp.numberOfAssays ?? null,
    factors: exp.experimentalFactors ?? [],
  };
}

async function atlasGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Expression Atlas: ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`);
  return res.json();
}

function optStr(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function clampLimit(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 25;
  return Math.max(1, Math.min(100, n));
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
