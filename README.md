# mcp-expression-atlas

EBI Expression Atlas MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search_experiments` | Search EBI Expression Atlas — ~4,500 curated gene/protein expression experiments (baseline & differential) across species, tissues, and conditions. Filter by keyword (matches description/experimental factors), species (e.g. "Homo sapiens", "Mus musculus"), and/or type ("Baseline" or "Differential"). Returns accession, description, species, type, assay count, and factors. Keyless. Complements UniProt/Ensembl. |
| `get_experiment` | Get metadata for a single EBI Expression Atlas experiment by accession (e.g. "E-MTAB-4045"). Returns accession, description, species, type, assay count, and experimental factors. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "expression-atlas": {
      "url": "https://gateway.pipeworx.io/expression-atlas/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Expression Atlas data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
