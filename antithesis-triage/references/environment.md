# Environment

The Environment section (`section.section_container` containing "Environment" title) shows the Docker images used in this run.

## Get source images

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.getEnvironmentSourceImages()"
```
