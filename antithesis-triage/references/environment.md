# Environment

The Environment section (`section.section_container` containing "Environment" title) shows the Docker images used in this run.

## Get source images

Use this query file:

- `assets/report/environment-source-images.js`

Each item in the array returned is one docker image, with name `from.name`, digest at `locked_reference`, and date created at `from_metadata.Created`